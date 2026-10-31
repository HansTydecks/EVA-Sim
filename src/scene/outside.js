import * as THREE from 'three';
import { canvasTexture } from './models.js';

// Die Welt vor dem Fenster: Himmel, Stadt, Bäume – und Dinge, die herumfliegen oder fahren.
// Alles mit fog: false, damit der Raum-Nebel die Außenwelt nicht rosa färbt.
const GROUND_Y = -2.6;

// Fasst alle Meshes einer Gruppe mit gleichem Material zu einem Mesh zusammen (Geometrie in Gruppen-Koordinaten).
function mergeByMaterial(group) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map();
    const done = [];
    group.traverse(o => {
        if (!o.isMesh || o.material.vertexColors || o.renderOrder !== 0) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (!buckets.has(o.material)) buckets.set(o.material, []);
        buckets.get(o.material).push(g);
        done.push(o);
    });
    done.forEach(o => o.parent.remove(o));
    for (const [material, geos] of buckets) {
        const out = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
            if (!geos.every(g => g.attributes[name])) continue;
            const arr = new Float32Array(geos.reduce((a, g) => a + g.attributes[name].array.length, 0));
            let off = 0;
            for (const g of geos) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
            out.setAttribute(name, new THREE.BufferAttribute(arr, geos[0].attributes[name].itemSize));
        }
        geos.forEach(g => g.dispose());
        out.computeBoundingSphere();
        group.add(new THREE.Mesh(out, material));
    }
}

function lam(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, fog: false, ...opts }); }
function basic(color, opts = {}) { return new THREE.MeshBasicMaterial({ color, fog: false, ...opts }); }

export class Outside {
    constructor(game) {
        this.game = game;
        const root = new THREE.Group();
        root.name = 'outside';
        this.root = root;
        game.scene.add(root);
        this.movers = [];

        this.buildSky();
        this.buildGround();
        this.buildTown();
        this.buildTrees();
        // Alles Unbewegliche zu wenigen Meshes zusammenfassen (spart Zeichenaufrufe auf Schul-PCs)
        mergeByMaterial(root);
        this.buildClouds();
        this.buildBirds();
        this.buildBalloon();
        this.buildPlane();
        this.buildTraffic();
        this.buildLeaves();
        root.traverse(o => { o.userData.noRaycast = true; o.castShadow = false; o.receiveShadow = false; });
    }

    buildSky() {
        const geo = new THREE.SphereGeometry(60, 32, 16);
        const col = [];
        const p = geo.attributes.position;
        const top = new THREE.Color(0x5fb4f2), hor = new THREE.Color(0xdff3ff), c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            const t = THREE.MathUtils.clamp(p.getY(i) / 60, 0, 1);
            c.copy(hor).lerp(top, Math.pow(t, 0.6));
            col.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        sky.position.set(0.6, 1.3, 0);
        sky.renderOrder = -10;
        this.root.add(sky);
        // Sonne
        const sunTex = canvasTexture(128, 128, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.35, 'rgba(255,236,150,0.9)'); g.addColorStop(1, 'rgba(255,236,150,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
        sun.position.set(9, 3.4, -22);
        sun.scale.setScalar(4.5);
        this.root.add(sun);
    }

    buildGround() {
        const tex = canvasTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#7cc66a'; ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 900; i++) {
                ctx.fillStyle = Math.random() < 0.5 ? '#72bb60' : '#88d176';
                ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
            }
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(20, 20);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshLambertMaterial({ map: tex, fog: false }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(4, GROUND_Y, -30);
        this.root.add(ground);
        // Schulhof
        const yardTex = canvasTexture(512, 256, (ctx, w, h) => {
            ctx.fillStyle = '#9aa0aa'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
            // Hüpfkästchen
            for (let i = 0; i < 6; i++) ctx.strokeRect(60 + i * 46, 100, 46, 46);
            ctx.strokeStyle = '#ffd43b';
            ctx.beginPath(); ctx.arc(390, 128, 60, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ff6fa8'; ctx.font = 'bold 40px Segoe UI, sans-serif'; ctx.fillText('EVA', 355, 142);
        });
        const yard = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshLambertMaterial({ map: yardTex, fog: false }));
        yard.rotation.x = -Math.PI / 2;
        yard.position.set(3, GROUND_Y + 0.01, -5.5);
        this.root.add(yard);
        // Zaun
        const fenceMat = lam(0x8a5a3c);
        for (let x = -6; x <= 12; x += 0.5) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), fenceMat);
            post.position.set(x, GROUND_Y + 0.5, -9.2);
            this.root.add(post);
        }
        for (const y of [0.35, 0.8]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 0.05), fenceMat);
            rail.position.set(3, GROUND_Y + y, -9.2);
            this.root.add(rail);
        }
        // Straße
        const roadTex = canvasTexture(512, 64, (ctx, w, h) => {
            ctx.fillStyle = '#4a4e57'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            for (let x = 0; x < w; x += 64) ctx.fillRect(x, h / 2 - 3, 34, 6);
        });
        roadTex.wrapS = THREE.RepeatWrapping;
        roadTex.repeat.set(8, 1);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), new THREE.MeshLambertMaterial({ map: roadTex, fog: false }));
        road.rotation.x = -Math.PI / 2;
        road.position.set(4, GROUND_Y + 0.02, -11.5);
        this.root.add(road);
        // Hügel am Horizont
        [[-8, -42, 14, 0x6fb35e], [6, -46, 18, 0x5ea552], [22, -40, 12, 0x79bd66], [34, -48, 16, 0x67ad58]].forEach(([x, z, r, c]) => {
            const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(c));
            hill.scale.y = 0.32;
            hill.position.set(x, GROUND_Y, z);
            this.root.add(hill);
        });
    }

    buildTown() {
        const winTex = canvasTexture(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#8fc8f0';
            for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.fillRect(18 + x * 58, 18 + y * 58, 34, 34);
        });
        const houses = [[-5, -17, 0xf4b6c2], [-1.5, -19, 0xffe08a], [2.5, -16.5, 0xa9d8f5], [6.5, -18.5, 0xf7c59f], [10.5, -16, 0xc6e3a9], [14, -19, 0xe0c3f0], [18, -17.5, 0xf4b6c2]];
        for (const [x, z, c] of houses) {
            const g = new THREE.Group();
            const w = 2.2 + Math.random() * 1.2, h = 1.8 + Math.random() * 1.6, d = 2;
            const wallMat = new THREE.MeshLambertMaterial({ color: c, map: winTex, fog: false });
            winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
            const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            body.position.y = h / 2;
            g.add(body);
            const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.78, 1.1, 4, 1), lam(0xb5524a));
            roof.rotation.y = Math.PI / 4;
            roof.scale.z = d / w;
            roof.position.y = h + 0.55;
            g.add(roof);
            g.position.set(x, GROUND_Y, z);
            this.root.add(g);
        }
    }

    buildTrees() {
        this.trees = [];
        const trunkMat = lam(0x8a5a3c);
        const leafMats = [lam(0x3f9e4d), lam(0x4fb35a), lam(0x2f8a45), lam(0xe8913a)];
        const spots = [[-3.5, -6], [-1.5, -7.5], [0.8, -4], [5.5, -7.8], [8.5, -4.5], [11, -7], [13.5, -5], [-4.5, -13], [1, -13.5], [4.5, -14], [9, -13], [12.5, -14.5], [16, -12]];
        spots.forEach(([x, z], i) => {
            const g = new THREE.Group();
            const h = 1.2 + (i % 3) * 0.5;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, h, 8), trunkMat);
            trunk.position.y = h / 2;
            g.add(trunk);
            const crown = new THREE.Group();
            const m = leafMats[i % 7 === 3 ? 3 : i % 3];
            if (i % 2) {
                for (let k = 0; k < 3; k++) {
                    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95 - k * 0.22, 1.1, 10), m);
                    cone.position.y = k * 0.55;
                    crown.add(cone);
                }
            } else {
                for (const [dx, dy, dz, r] of [[0, 0.3, 0, 0.9], [0.5, 0, 0.2, 0.6], [-0.45, 0.1, -0.1, 0.65], [0.1, 0.8, 0.1, 0.6]]) {
                    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
                    s.position.set(dx, dy, dz);
                    crown.add(s);
                }
            }
            crown.position.y = h + 0.4;
            g.add(crown);
            g.position.set(x, GROUND_Y, z);
            g.userData.phase = Math.random() * 6;
            this.root.add(g);
            this.trees.push(crown);
        });
    }

    buildClouds() {
        this.clouds = [];
        const m = basic(0xffffff, { transparent: true, opacity: 0.95 });
        for (let i = 0; i < 9; i++) {
            const g = new THREE.Group();
            const n = 4 + (i % 3);
            for (let k = 0; k < n; k++) {
                const s = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.7, 12, 8), m);
                s.position.set(k * 1.1 - n * 0.5, Math.random() * 0.4, Math.random() * 0.6);
                s.scale.y = 0.7;
                g.add(s);
            }
            g.position.set(-20 + i * 6, 2.6 + (i % 3) * 0.9, -28 - (i % 4) * 4);
            mergeByMaterial(g);
            g.userData.speed = 0.25 + Math.random() * 0.2;
            this.root.add(g);
            this.clouds.push(g);
        }
    }

    makeBird(color = 0x2b2e36) {
        const g = new THREE.Group();
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.06, 0, 0, 0.06, 0.32, 0, 0], 3));
        wingGeo.computeVertexNormals();
        const wm = basic(color, { side: THREE.DoubleSide });
        const l = new THREE.Mesh(wingGeo, wm), r = new THREE.Mesh(wingGeo, wm);
        r.rotation.y = Math.PI;
        g.add(l, r);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wm);
        body.scale.z = 2.2;
        g.add(body);
        g.userData = { l, r };
        return g;
    }

    buildBirds() {
        this.flocks = [];
        for (let f = 0; f < 3; f++) {
            const flock = new THREE.Group();
            const birds = [];
            const n = 4 + f;
            for (let i = 0; i < n; i++) {
                const b = this.makeBird();
                const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
                b.position.set(-row * 0.45, (Math.random() - 0.5) * 0.2, side * row * 0.4);
                b.rotation.y = Math.PI / 2;
                b.userData.phase = Math.random() * 6;
                flock.add(b);
                birds.push(b);
            }
            flock.userData = { birds, t: -f * 14, speed: 1.6 + f * 0.4, z: -5 - f * 3, y: 0.5 + f * 0.55, dir: f === 1 ? -1 : 1 };
            this.root.add(flock);
            this.flocks.push(flock);
        }
    }

    buildBalloon() {
        const tex = canvasTexture(256, 128, (ctx, w, h) => {
            const cols = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#d67c9c', '#ffa94d', '#9775fa', '#38d9a9'];
            for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % 8]; ctx.fillRect(i * 16, 0, 16, h); }
        });
        const g = new THREE.Group();
        const env = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), new THREE.MeshLambertMaterial({ map: tex, fog: false }));
        env.scale.y = 1.15;
        env.position.y = 1.6;
        g.add(env);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 16, 1, true), new THREE.MeshLambertMaterial({ map: tex, fog: false, side: THREE.DoubleSide }));
        cone.rotation.x = Math.PI;
        cone.position.y = 0.6;
        g.add(cone);
        const basket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.32), lam(0x8a5a3c));
        basket.position.y = 0.05;
        g.add(basket);
        this.balloon = g;
        g.position.set(-6, 0.2, -15);
        this.root.add(g);
    }

    buildPlane() {
        const g = new THREE.Group();
        const white = lam(0xffffff), pink = lam(0xd67c9c);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 2.2, 10), white);
        body.rotation.z = Math.PI / 2;
        g.add(body);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white);
        nose.position.x = 1.1;
        g.add(nose);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 2.4), pink);
        wing.position.x = 0.15;
        g.add(wing);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.04), pink);
        tail.position.set(-1.0, 0.25, 0);
        g.add(tail);
        // Banner
        const tex = canvasTexture(1024, 128, (ctx, w, h) => {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#d67c9c'; ctx.font = 'bold 80px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('EINGABE · VERARBEITUNG · AUSGABE', w / 2, h / 2 + 4);
        });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.DoubleSide }));
        banner.position.set(-4.6, -0.1, 0);
        g.add(banner);
        const rope = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.02), lam(0x555555));
        rope.position.set(-1.6, -0.05, 0);
        g.add(rope);
        g.userData = { banner, t: 8 };
        g.scale.setScalar(0.8);
        this.plane = g;
        this.root.add(g);
    }

    buildTraffic() {
        this.cars = [];
        const colors = [0xff6b6b, 0x4dabf7, 0xffd43b];
        colors.forEach((c, i) => {
            const g = new THREE.Group();
            const bus = i === 2;
            const len = bus ? 3.2 : 1.6;
            const body = new THREE.Mesh(new THREE.BoxGeometry(len, bus ? 1.0 : 0.45, 0.8), lam(c));
            body.position.y = bus ? 0.65 : 0.4;
            g.add(body);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(bus ? len * 0.96 : 0.9, bus ? 0.3 : 0.35, 0.74), lam(0xbfe3ff));
            cab.position.set(bus ? 0 : -0.1, bus ? 1.0 : 0.78, 0);
            g.add(cab);
            for (const dx of [-len * 0.32, len * 0.32]) for (const dz of [-0.4, 0.4]) {
                const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12), lam(0x222222));
                w.rotation.x = Math.PI / 2;
                w.position.set(dx, 0.17, dz);
                g.add(w);
            }
            const dir = i === 1 ? -1 : 1;
            g.userData = { dir, speed: bus ? 2.2 : 3.2 + i, x: -14 + i * 11 };
            g.rotation.y = dir < 0 ? Math.PI : 0;
            g.position.set(0, GROUND_Y + 0.02, dir > 0 ? -11 : -12);
            this.root.add(g);
            this.cars.push(g);
        });
    }

    buildLeaves() {
        // ein paar Blätter wehen direkt am Fenster vorbei
        this.leaves = [];
        const geo = new THREE.PlaneGeometry(0.05, 0.035);
        const cols = [0xe8913a, 0xf2c14e, 0xd9534f, 0x9bc53d];
        for (let i = 0; i < 9; i++) {
            const m = new THREE.Mesh(geo, basic(cols[i % 4], { side: THREE.DoubleSide }));
            this.resetLeaf(m, true);
            this.root.add(m);
            this.leaves.push(m);
        }
    }

    resetLeaf(m, initial = false) {
        m.position.set(-0.6 + Math.random() * 2.8, initial ? -1 + Math.random() * 3.5 : 2.6, -1.3 - Math.random() * 1.6);
        m.userData.vx = 0.15 + Math.random() * 0.25;
        m.userData.vy = -(0.18 + Math.random() * 0.2);
        m.userData.spin = Math.random() * 6;
    }

    update(dt, t) {
        for (const c of this.clouds) {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > 32) c.position.x = -24;
        }
        for (const f of this.flocks) {
            const u = f.userData;
            u.t += dt;
            const span = 30;
            const x = (-10 + ((u.t * u.speed) % span + span) % span) * u.dir + (u.dir < 0 ? 6 : 0);
            f.position.set(x, u.y + Math.sin(u.t * 0.7) * 0.25, u.z + Math.sin(u.t * 0.4) * 0.8);
            f.rotation.y = u.dir < 0 ? Math.PI : 0;
            for (const b of u.birds) {
                const a = Math.sin(t * 9 + b.userData.phase) * 0.6;
                b.userData.l.rotation.x = a;
                b.userData.r.rotation.x = -a;
            }
        }
        // Heißluftballon schwebt langsam vorbei
        const bl = this.balloon;
        bl.position.x += dt * 0.18;
        if (bl.position.x > 16) bl.position.x = -8;
        bl.position.y = 0.2 + Math.sin(t * 0.3) * 0.25;
        // Flugzeug mit Banner, etwa alle 45 s
        const pl = this.plane, pu = pl.userData;
        pu.t += dt;
        const cycle = pu.t % 45;
        if (cycle < 22) {
            pl.visible = true;
            pl.position.set(-26 + cycle * 2.6, 2.4 + Math.sin(cycle * 0.5) * 0.08, -30);
            pu.banner.rotation.x = Math.sin(t * 6) * 0.15;
        } else pl.visible = false;
        for (const c of this.cars) {
            const u = c.userData;
            u.x += u.dir * u.speed * dt;
            if (u.dir > 0 && u.x > 26) u.x = -20;
            if (u.dir < 0 && u.x < -20) u.x = 26;
            c.position.x = u.x;
        }
        for (const l of this.leaves) {
            const u = l.userData;
            l.position.x += (u.vx + Math.sin(t * 1.3 + u.spin) * 0.15) * dt;
            l.position.y += u.vy * dt;
            l.rotation.set(t * 2 + u.spin, t * 1.4 + u.spin, 0);
            if (l.position.y < GROUND_Y) this.resetLeaf(l);
        }
    }
}
