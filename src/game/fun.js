import * as THREE from 'three';
import { CANNON } from '../physics.js';
import { setMugFill, makeShard } from '../scene/models.js';
import { createItem } from '../devices.js';

// Physik-Spaß: Kaffee läuft aus, der Kaktus kann zerbrechen.
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _up = new THREE.Vector3();
const _d = new THREE.Vector3();

export class FunFx {
    constructor(game) {
        this.game = game;
        this.drops = [];
        this.puddles = [];
        this.debris = [];
        this.ray = new THREE.Raycaster();
        this.dropGeo = new THREE.SphereGeometry(0.0055, 6, 5);
        this.dropMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.15 });
        this.puddleGeo = new THREE.CircleGeometry(1, 22);
        this.dropAcc = 0;
        this.uprightT = 0;
        this.zapT = 0;
        this.said = {};
        this.cactusRespawnT = 0;
        this.time = 0;
        game.on('respawned', it => {
            if (it === game.itemsById.mug) this.refill(false);
            if (it === game.itemsById.cactus) it.noBreakUntil = this.time + 1.5;
        });
        this.watchCactus(game.itemsById.cactus);
    }

    once(key, title, text, mood = 'thinking', dur = 4) {
        if (this.said[key]) return;
        this.said[key] = true;
        this.game.progression.interject(title, text, mood, dur);
    }

    // ------------------------------------------------ Tasse
    refill(fx = true) {
        const mug = this.game.itemsById.mug;
        if (!mug) return;
        setMugFill(mug.object, 1);
        if (fx) {
            this.game.guide.burst(mug.object.position.clone().setY(mug.object.position.y + 0.12), [0xffffff, 0xd9b48a], 10, 0.35);
            this.game.hud.toast('☕ Kaffee nachgefüllt', 'good', 1.6);
        }
    }

    spillMug() {
        // für Tests: Tasse umkippen
        const mug = this.game.itemsById.mug;
        mug.body.quaternion.setFromEuler(Math.PI / 2, 0, 0);
        mug.body.position.y += 0.06;
        mug.body.wakeUp();
    }

    updateMug(dt) {
        const g = this.game;
        const mug = g.itemsById.mug;
        if (!mug) return;
        const u = mug.object.userData;
        _up.copy(UP).applyQuaternion(mug.object.quaternion);
        const tilt = Math.acos(THREE.MathUtils.clamp(_up.y, -1, 1));
        // Auslaufen
        if (!mug.held && u.fill > 0 && tilt > 1.0) {
            const rate = 0.35 + (tilt - 1.0) * 0.9;
            setMugFill(mug.object, Math.max(0, u.fill - rate * dt));
            this.dropAcc += dt * (18 + tilt * 10);
            const rimC = mug.object.localToWorld(new THREE.Vector3(0, u.rimY, 0));
            // tiefster Punkt am Rand
            _d.copy(DOWN).addScaledVector(_up, -DOWN.dot(_up));
            if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0);
            _d.normalize();
            while (this.dropAcc > 1 && this.drops.length < 60) {
                this.dropAcc -= 1;
                const m = new THREE.Mesh(this.dropGeo, this.dropMat);
                m.position.copy(rimC).addScaledVector(_d, 0.04 + Math.random() * 0.006);
                m.userData.noRaycast = true;
                g.scene.add(m);
                const v = _d.clone().multiplyScalar(0.25 + Math.random() * 0.3);
                v.x += (Math.random() - 0.5) * 0.15; v.z += (Math.random() - 0.5) * 0.15;
                v.addScaledVector(mug.body.velocity, 0.5);
                this.drops.push({ m, v, ground: this.findGround(m.position) });
            }
            if (u.fill <= 0.6) this.once('spill', 'Ups, der Kaffee! ☕💦', 'Die Tasse ist umgekippt. Gut, dass das nur ein Spiel ist! Stell sie wieder hin – dann gibt es frischen Kaffee.', 'sad', 4);
        }
        // Nachfüllen, wenn sie eine Weile aufrecht steht
        if (u.fill < 1 && !mug.held && tilt < 0.3) {
            this.uprightT += dt;
            if (this.uprightT > 12) { this.uprightT = 0; this.refill(true); }
        } else this.uprightT = 0;
        // Dampf
        const showSteam = u.fill > 0.5 && tilt < 0.35;
        for (const s of u.steam) {
            s.userData.phase = (s.userData.phase + dt * 0.45) % 1;
            const p = s.userData.phase;
            s.position.set(Math.sin(p * 9 + s.id) * 0.008, u.rimY + 0.01 + p * 0.09, Math.cos(p * 7 + s.id) * 0.006);
            s.scale.setScalar(0.02 + p * 0.035);
            const target = showSteam ? Math.sin(p * Math.PI) * 0.28 : 0;
            s.material.opacity += (target - s.material.opacity) * Math.min(1, dt * 4);
        }
    }

    findGround(pos) {
        const g = this.game;
        this.ray.set(pos.clone().setY(pos.y + 0.02), DOWN);
        this.ray.far = 3;
        const roots = [g.room.staticGroup];
        for (const d of Object.values(g.devices)) if (d.visible && !d.sorted) roots.push(d.object);
        const hits = this.ray.intersectObjects(roots, true);
        for (const h of hits) {
            if (!h.object.visible || h.object.userData.noRaycast) continue;
            let o = h.object, dev = null;
            while (o) { if (o.userData.interactable?.kind === 'device') { dev = o.userData.interactable; break; } o = o.parent; }
            return { y: h.point.y, dev, normalY: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y : 1 };
        }
        return { y: 0, dev: null, normalY: 1 };
    }

    updateDrops(dt) {
        const g = this.game;
        for (const d of this.drops) {
            d.v.y -= 9.82 * dt;
            d.m.position.addScaledVector(d.v, dt);
            if (d.m.position.y <= d.ground.y + 0.003) {
                d.dead = true;
                g.scene.remove(d.m);
                const p = d.m.position.clone().setY(d.ground.y);
                if (d.ground.normalY > 0.6 && !d.ground.dev) this.addPuddle(p);
                if (d.ground.dev && this.zapT <= 0) {
                    this.zapT = 0.6;
                    g.audio.zap();
                    g.guide.burst(p.clone().setY(p.y + 0.02), [0xffe066, 0xffffff, 0x66ccff], 10, 0.5);
                    const def = d.ground.dev.def;
                    this.once('zap', 'Bzzzt! ⚡', `Kaffee + ${def.emoji} ${def.name} = keine gute Idee! Elektronik und Flüssigkeit vertragen sich gar nicht – im echten Leben kann das Gerät kaputtgehen.`, 'sad', 5);
                } else if (Math.random() < 0.15) g.audio.splash();
            }
        }
        this.drops = this.drops.filter(d => !d.dead);
        this.zapT -= dt;
        // Pfützen verblassen langsam
        for (const p of this.puddles) {
            p.age += dt;
            p.m.scale.setScalar(p.m.scale.x + (p.r - p.m.scale.x) * Math.min(1, dt * 6));
            if (p.age > 40) p.m.material.opacity = Math.max(0, 0.85 * (1 - (p.age - 40) / 6));
            if (p.age > 46) { g.scene.remove(p.m); p.dead = true; }
        }
        this.puddles = this.puddles.filter(p => !p.dead);
    }

    addPuddle(p) {
        const near = this.puddles.find(q => Math.abs(q.m.position.y - p.y) < 0.01 && q.m.position.distanceTo(p) < q.r + 0.02);
        if (near) { near.r = Math.min(0.13, near.r + 0.0035); near.age = Math.min(near.age, 30); return; }
        if (this.puddles.length > 14) return;
        const m = new THREE.Mesh(this.puddleGeo, new THREE.MeshStandardMaterial({
            color: 0x4a2c1a, roughness: 0.08, transparent: true, opacity: 0.85, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        }));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(p).setY(p.y + 0.0015);
        m.scale.setScalar(0.004);
        m.userData.noRaycast = true;
        m.receiveShadow = true;
        this.game.scene.add(m);
        this.puddles.push({ m, r: 0.018 + Math.random() * 0.01, age: 0 });
    }

    // ------------------------------------------------ Kaktus
    watchCactus(it) {
        if (!it) return;
        it.noBreakUntil = this.time + 1.5;
        it.body.addEventListener('collide', e => {
            if (it.held || it.broken || this.time < (it.noBreakUntil || 0)) return;
            const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
            if (v > 2.4) it.pendingBreak = v;
            else if (v > 0.9) this.game.audio.thud(Math.min(1, v / 2));
        });
    }

    breakCactus() {
        const g = this.game;
        const it = g.itemsById.cactus;
        if (!it || it.broken) return;
        it.broken = true;
        it.pendingBreak = 0;
        if (g.hand.held === it) g.hand.held = null;
        const obj = it.object;
        obj.updateMatrixWorld(true);
        const center = obj.localToWorld(new THREE.Vector3(0, 0.05, 0));
        const vel = new THREE.Vector3(it.body.velocity.x, it.body.velocity.y, it.body.velocity.z).multiplyScalar(0.3);
        // Scherben
        const colors = [0xc96f3b, 0xc96f3b, 0xd27a45, 0xf3e3c8];
        for (let i = 0; i < 10; i++) {
            const m = makeShard(colors[i % colors.length]);
            const a = (i / 10) * Math.PI * 2;
            const p = center.clone().add(new THREE.Vector3(Math.cos(a) * 0.03, (i % 3) * 0.025, Math.sin(a) * 0.03));
            m.position.copy(p);
            m.rotation.set(Math.random() * 3, a, Math.random() * 3);
            const dir = new THREE.Vector3(Math.cos(a), 0.6 + Math.random() * 0.8, Math.sin(a)).multiplyScalar(0.9 + Math.random() * 0.9).add(vel);
            this.addDebris(m, { x: 0.018, y: 0.012, z: 0.006 }, 0.02, dir);
        }
        // Erdkrümel
        g.guide.burst(center.clone().setY(center.y + 0.03), [0x3d2a1c, 0x5a3d26, 0x3d2a1c, 0xe8e2d6], 26, 0.8);
        // Der Kaktus selbst purzelt heraus
        const plant = obj.userData.plant;
        const pw = plant.getWorldPosition(new THREE.Vector3());
        const pq = plant.getWorldQuaternion(new THREE.Quaternion());
        const holder = new THREE.Group();
        holder.add(plant);
        plant.position.set(0, -0.075, 0);
        plant.quaternion.identity();
        holder.position.copy(pw).setY(pw.y + 0.075);
        holder.quaternion.copy(pq);
        this.addDebris(holder, { x: 0.035, y: 0.075, z: 0.03 }, 0.2, vel.clone().add(new THREE.Vector3(0.3, 0.9, 0.2)), true);
        // altes Objekt entfernen
        g.physics.remove(it.body);
        g.scene.remove(obj);
        it.sorted = true; // nimmt nicht mehr am Spiel teil
        g.items = g.items.filter(x => x !== it);
        delete g.itemsById.cactus;
        g.audio.shatter();
        this.cactusRespawnT = 6;
        this.cactusHome = it.home.clone();
        g.flags.cactusBroken = true;
        g.progression.interject('Autsch! 🌵💥', 'Der Kaktus ist kaputtgegangen! Keine Sorge – gleich steht ein neuer da.', 'sad', 4);
    }

    addDebris(mesh, half, mass, vel, rotate = false) {
        const g = this.game;
        g.scene.add(mesh);
        const body = new CANNON.Body({ mass, linearDamping: 0.1, angularDamping: 0.3 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)));
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
        body.velocity.set(vel.x, vel.y, vel.z);
        body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        if (rotate) body.angularVelocity.scale(0.3, body.angularVelocity);
        g.physics.world.addBody(body);
        this.debris.push({ mesh, body, t: 0 });
    }

    updateDebris(dt) {
        const g = this.game;
        for (const d of this.debris) {
            d.t += dt;
            d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
            d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
            if (d.t > 6.5) {
                const s = Math.max(0.001, 1 - (d.t - 6.5) / 0.6);
                d.mesh.scale.setScalar(s);
            }
            if (d.t > 7.1) {
                g.scene.remove(d.mesh);
                g.physics.world.removeBody(d.body);
                d.dead = true;
            }
        }
        this.debris = this.debris.filter(d => !d.dead);
        if (this.cactusRespawnT > 0) {
            this.cactusRespawnT -= dt;
            if (this.cactusRespawnT <= 0) this.spawnCactus();
        }
    }

    spawnCactus() {
        const g = this.game;
        const home = this.cactusHome || new THREE.Vector3(0.43, 0.75, -0.36);
        const it = createItem(g, 'cactus', home.clone().setY(home.y + 0.05), 0);
        it.home = home.clone();
        g.items.push(it);
        g.itemsById.cactus = it;
        this.watchCactus(it);
        g.guide.burst(home.clone().setY(home.y + 0.15), [0x3fae5a, 0xff7fb0, 0xffd43b, 0xffffff], 22, 0.8);
        g.audio.plop();
    }

    update(dt) {
        this.time += dt;
        const c = this.game.itemsById.cactus;
        if (c?.pendingBreak) this.breakCactus();
        this.updateMug(dt);
        this.updateDrops(dt);
        this.updateDebris(dt);
    }
}
