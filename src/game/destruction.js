import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CANNON } from '../physics.js';
import { makeHammer, makeBomb, setHandGrip } from '../scene/models.js';
import { SPAWN } from './progression.js';

// Zerstörmodus: Nach dem Aufräumen (oder mit ?boom) darf alles kaputt gemacht werden.
// Werkzeuge: Hammer, Superkraft-Werfen, Bombe, Schwerelos, Konfetti-Kanone.

const WORDS = ['BONK!', 'KRACH!', 'BÄM!', 'ZONK!', 'WUMMS!', 'KLONK!', 'PENG!', 'RUMMS!', 'ZACK!'];
const BIG_WORDS = ['KA-WUMM!', 'KRAWUMM!', 'BOOOM!'];
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _box = new THREE.Box3();
const rand = (a, b) => a + Math.random() * (b - a);

function softDotTexture(size = 64, inner = 0.0, outer = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.5 * inner, size / 2, size / 2, size * 0.5 * outer);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function smokeTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
        const x = s / 2 + rand(-22, 22), y = s / 2 + rand(-22, 22), r = rand(26, 44);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function wordTexture(word, big) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.translate(256, 128);
    ctx.rotate(rand(-0.15, 0.15));
    // Comic-Zacken
    ctx.beginPath();
    const n = 14;
    for (let i = 0; i <= n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const r = i % 2 ? 0.62 : 1;
        ctx.lineTo(Math.cos(a) * 230 * r, Math.sin(a) * 110 * r);
    }
    ctx.closePath();
    ctx.fillStyle = big ? '#ff5a36' : ['#ffd43b', '#ff8fb8', '#74e0ff', '#9bf28a'][Math.floor(Math.random() * 4)];
    ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = '#2a1a2e'; ctx.stroke();
    ctx.font = `900 ${big ? 92 : 84}px "Comic Sans MS", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 14; ctx.strokeStyle = '#2a1a2e'; ctx.strokeText(word, 0, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillText(word, 0, 6);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Destruction {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.tool = 'hammer';
        this.timeScale = 1;
        this.slowT = 0;
        this.shakeAmt = 0;
        this.shakeOff = new THREE.Vector3();
        this.debris = [];
        this.bombs = [];
        this.balls = [];
        this.fx = [];          // kurzlebige Effekte (Text, Ringe, Feuerbälle, Lichter)
        this.loose = new Map(); // Deko-Objekt -> { body }
        this.hp = new Map();
        this.broken = new Set();
        this.total = 1;
        this.combo = 0;
        this.comboT = 0;
        this.swing = null;
        this.swingA = -1.1;
        this.zeroG = false;
        this.root = new THREE.Group();
        this.root.name = 'destruction';
        this.hitRoot = new THREE.Group();   // Trümmer und Bälle: kann die Hand treffen
        this.root.add(this.hitRoot);
        this.ray = new THREE.Raycaster();
    }

    // ------------------------------------------------------------------ Start
    start({ quick = false } = {}) {
        if (this.active) return;
        const g = this.game;
        this.active = true;
        this.quick = quick;
        g.scene.add(this.root);
        document.getElementById('endScreen').classList.add('hidden');
        document.getElementById('destroyBar').classList.remove('hidden');
        document.getElementById('chaosBox').classList.remove('hidden');
        g.hand.exitMouseMode();
        g.guide.level = 0;
        g.guide.setTarget(null);
        g.hud.eva(null);
        g.hud.say('Zerstörmodus! 😈', 'Feierabend – jetzt darfst du <b>alles kaputt machen</b>! Oben wählst du dein Werkzeug: <b>🔨 Hammer</b>, <b>✋ Superkraft-Werfen</b>, <b>💣 Bombe</b>, <b>🪐 Schwerelos</b> und <b>🎉 Konfetti</b>. Keine Sorge: Hier ist alles nur virtuell! 😄', 'happy');
        g.hud.controls('<b>Klick:</b> Werkzeug benutzen<br><b>Tasten 1–5:</b> Werkzeug wechseln<br><b>Bildschirmrand:</b> umschauen');
        g.audio.success();

        this.setupEffects();
        this.setupComposer();
        // Decke, damit bei Schwerelosigkeit nichts davonfliegt
        g.physics.addStaticBox({ x: 5, y: 0.05, z: 5 }, { x: 0, y: 2.45, z: 0 });
        this.liberate();
        this.setTool('hammer');
        this.updateChaos();
    }

    setupComposer() {
        const g = this.game;
        try {
            const composer = new EffectComposer(g.renderer);
            composer.setPixelRatio(g.renderer.getPixelRatio());
            composer.setSize(innerWidth, innerHeight);
            composer.addPass(new RenderPass(g.scene, g.camera));
            this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.45, 0.88);
            composer.addPass(this.bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
            addEventListener('resize', () => composer.setSize(innerWidth, innerHeight));
        } catch (e) {
            console.warn('Kein Bloom:', e);
            this.composer = null;
        }
    }

    setupEffects() {
        // Funken & Glut: ein Points-Objekt mit Ringpuffer
        const N = 900;
        this.sparkN = N;
        this.sparkPos = new Float32Array(N * 3).fill(-100);
        this.sparkCol = new Float32Array(N * 3);
        this.sparkVel = new Float32Array(N * 3);
        this.sparkLife = new Float32Array(N);
        this.sparkMax = new Float32Array(N).fill(1);
        this.sparkBase = new Float32Array(N * 3);
        this.sparkI = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
        this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.028, vertexColors: true, map: softDotTexture(), transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true,
        }));
        this.sparks.frustumCulled = false;
        this.sparks.userData.noRaycast = true;
        this.root.add(this.sparks);

        // Konfetti: InstancedMesh mit Farbe pro Schnipsel
        const C = 700;
        this.confN = C;
        this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.014, 0.009), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), C);
        this.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.conf.frustumCulled = false;
        this.conf.userData.noRaycast = true;
        this.confData = Array.from({ length: C }, () => ({ p: new THREE.Vector3(0, -100, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
        const col = new THREE.Color();
        const pal = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xd67c9c, 0x9775fa, 0xffffff];
        for (let i = 0; i < C; i++) { col.setHex(pal[i % pal.length]); this.conf.setColorAt(i, col); _m.makeScale(0, 0, 0); this.conf.setMatrixAt(i, _m); }
        this.conf.instanceColor.needsUpdate = true;
        this.confI = 0;
        this.root.add(this.conf);

        this.smokeTex = smokeTexture();
        this.glowTex = softDotTexture(128, 0, 1);
        this.wordTex = {};
        this.debrisGeo = [new THREE.BoxGeometry(1, 1, 1), new THREE.DodecahedronGeometry(0.6, 0), new THREE.TetrahedronGeometry(0.75, 0)];
        this.matCache = new Map();
        this.ballGeo = new THREE.SphereGeometry(1, 20, 14);
    }

    // Alles beweglich machen: einsortierte Geräte springen aus den Kartons, Kartons werden lose
    liberate() {
        const g = this.game;
        const ph = g.physics;
        const D = g.devices;
        if (this.quick) {
            for (const [id, [p, yaw]] of Object.entries(SPAWN)) if (D[id] && !D[id].visible) D[id].spawn(p, yaw);
        }
        for (const p of g.ports) if (p.plug && !p.plug.isStick) p.plug.hide();
        for (const d of Object.values(D)) {
            if (!d.visible && !d.sorted) continue;
            if (d.plug && !d.plug.isStick) d.plug.hide();
            if (d.plug?.isStick && d.plug.port) d.plug.unplug(true);
            d.inTray = false;
            if (d.sorted) {
                d.sorted = false;
                d.object.scale.setScalar(1);
                const box = g.boxes.find(b => b.contents.includes(d));
                const from = box ? box.group.position.clone().setY(box.group.position.y + 0.35 + Math.random() * 0.2) : d.object.position.clone().setY(1.0);
                d.object.position.copy(from);
                ph.world.addBody(d.body);
                ph.links.push({ body: d.body, object: d.object });
                ph.placeBody(d.body, d.object);
            }
            d.visible = true;
            d.object.visible = true;
            d.sortable = false;
            d.locked = false;
            d.isFixed = false;
            ph.makeDynamic(d.body);
            this.hp.set(d, d.id === 'monitor' || d.id === 'tower' ? 3 : d.id === 'cd' || d.id === 'usbstick' ? 1 : 2);
        }
        for (const b of g.boxes) {
            b.contents = [];
            b.drawLabel();
            // statischen Karton durch einen beweglichen ersetzen
            ph.world.removeBody(b.body);
            const body = new CANNON.Body({ mass: 1.6, linearDamping: 0.1, angularDamping: 0.3 });
            for (const p of b.parts) body.addShape(new CANNON.Box(new CANNON.Vec3(p.half.x, p.half.y, p.half.z)), new CANNON.Vec3(p.offset.x, p.offset.y, p.offset.z));
            body.position.set(b.group.position.x, b.group.position.y, b.group.position.z);
            body.quaternion.set(b.group.quaternion.x, b.group.quaternion.y, b.group.quaternion.z, b.group.quaternion.w);
            ph.world.addBody(body);
            ph.links.push({ body, object: b.group });
            b.body = body;
            this.hp.set(b, 3);
        }
        for (const it of g.items) { it.locked = false; this.hp.set(it, it.id === 'duck' ? Infinity : it.id === 'mug' || it.id === 'paper' ? 1 : 2); }
        for (const o of g.room.decor) this.hp.set(o, 2);
        this.hp.set('desk', 6);
        this.hp.set('glass', 1);
        g.room.windowInfo.glass.userData.noRaycast = false;
        g.room.windowInfo.glass.userData.glass = true;
        this.total = [...this.hp.values()].filter(v => v !== Infinity).length;
    }

    // ------------------------------------------------------------------ Werkzeuge
    setTool(t) {
        const g = this.game;
        if (t === 'gravity') { this.toggleGravity(); return; }
        if (t === 'reset') { this.restart(); return; }
        this.tool = t;
        for (const b of document.querySelectorAll('#destroyBar [data-tool]')) b.classList.toggle('active', b.dataset.tool === t || (b.dataset.tool === 'gravity' && this.zeroG));
        if (!this.hammer) { this.hammer = makeHammer(); this.root.add(this.hammer); }
        this.hammer.visible = t === 'hammer';
        g.audio.pickup();
    }

    restart() {
        const q = new URLSearchParams(location.search);
        q.set('boom', '1');
        location.search = q.toString();
    }

    toggleGravity() {
        const g = this.game;
        this.zeroG = !this.zeroG;
        g.physics.world.gravity.set(0, this.zeroG ? 0 : -9.82, 0);
        for (const b of g.physics.world.bodies) {
            if (b.type !== CANNON.Body.DYNAMIC) continue;
            b.wakeUp();
            if (this.zeroG) {
                b.velocity.y += rand(0.25, 0.7);
                b.velocity.x += rand(-0.15, 0.15);
                b.velocity.z += rand(-0.15, 0.15);
                b.angularVelocity.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
            }
        }
        g.audio.whoosh(this.zeroG);
        g.hud.toast(this.zeroG ? '🪐 Schwerelos!' : '🌍 Schwerkraft ist zurück!', 'good', 1.8);
        for (const b of document.querySelectorAll('#destroyBar [data-tool]')) b.classList.toggle('active', b.dataset.tool === this.tool || (b.dataset.tool === 'gravity' && this.zeroG));
    }

    // Von der Hand aufgerufen. true = Klick wurde hier verarbeitet (kein Greifen)
    onDown(hit) {
        const g = this.game;
        g.audio.init();
        if (this.tool === 'throw') return false;
        if (this.tool === 'hammer') {
            if (!this.swing) { this.swing = { t: 0, hitDone: false }; g.audio.swoosh(); }
            return true;
        }
        if (this.tool === 'bomb') { this.placeBomb(hit); return true; }
        if (this.tool === 'confetti') { this.fireConfetti(hit); return true; }
        return false;
    }

    throwFactor() { return this.active && this.tool === 'throw' ? 2.8 : 1; }

    // ------------------------------------------------------------------ Ziele
    resolve(o) {
        const g = this.game;
        const room = g.room;
        let x = o;
        while (x) {
            if (x.userData.debrisRef) return { kind: 'debris', d: x.userData.debrisRef, obj: x };
            if (x.userData.bombRef) return { kind: 'bomb', b: x.userData.bombRef, obj: x };
            if (x.userData.ballRef) return { kind: 'ball', b: x.userData.ballRef, obj: x };
            const it = x.userData.interactable;
            if (it && it.kind !== 'plug') return { kind: 'item', it, obj: it.object, key: it };
            if (x.userData.box) return { kind: 'box', box: x.userData.box, obj: x, key: x.userData.box };
            if (x.userData.glass) return { kind: 'glass', obj: x, key: 'glass' };
            if (room.decor.includes(x)) return { kind: 'decor', obj: x, key: x };
            if (x === room.desk.top || x === room.desk.pad || room.desk.legs.includes(x)) return { kind: 'desk', obj: x, key: 'desk' };
            x = x.parent;
        }
        return null;
    }

    bodyOf(t) {
        if (!t) return null;
        if (t.kind === 'item') return t.it.body;
        if (t.kind === 'box') return t.box.body;
        if (t.kind === 'debris') return t.d.body;
        if (t.kind === 'bomb' || t.kind === 'ball') return t.b.body;
        if (t.kind === 'decor') return this.loose.get(t.obj)?.body || null;
        if (t.kind === 'desk' && this.deskDown) return this.loose.get(t.obj)?.body || null;
        return null;
    }

    push(body, dir, speed) {
        if (!body || body.type !== CANNON.Body.DYNAMIC) return;
        const m = Math.max(0.15, body.mass);
        const k = Math.min(9, speed / Math.sqrt(m));
        body.wakeUp();
        body.velocity.x += dir.x * k; body.velocity.y += dir.y * k; body.velocity.z += dir.z * k;
        body.angularVelocity.set(rand(-1, 1) * k * 3, rand(-1, 1) * k * 3, rand(-1, 1) * k * 3);
    }

    // ------------------------------------------------------------------ Hammer
    hammerPose(target, swingA) {
        // Schlagrichtung = in die Oberfläche hinein
        const g = this.game;
        const h = g.hand;
        const p = h.point;
        const n = h.normal.lengthSq() > 0.5 ? h.normal : UP;
        const d = _v.copy(n).negate();
        // Griff soll unten rechts (Richtung Spieler) liegen, der Kopf vorne über dem Ziel
        const camDir = _v2.copy(p).sub(g.camera.position).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.camera.quaternion);
        const f = camDir.clone().addScaledVector(UP, 0.55).addScaledVector(right, -0.3);
        f.addScaledVector(d, -f.dot(d));
        if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
        f.normalize();
        const x = new THREE.Vector3().crossVectors(f, d).normalize();
        _m.makeBasis(x, f, d);
        _q.setFromRotationMatrix(_m);
        const L = this.hammer.userData.length;
        const headCenter = p.clone().addScaledVector(d, -this.hammer.userData.faceOffset);
        const grip = headCenter.addScaledVector(f, -L);
        target.position.copy(grip);
        target.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), swingA));
    }

    afterHand(dt) {
        if (!this.active) return;
        const g = this.game;
        const h = g.hand;
        const hm = this.hammer;
        if (!hm || this.tool !== 'hammer' || h.mouseMode) { if (hm) hm.visible = false; return; }
        hm.visible = true;
        // Schwung: Ausholen → Schlag → zurück
        let a = -1.1;
        if (this.swing) {
            const s = this.swing;
            s.t += dt;
            const down = 0.11, back = 0.26;
            if (s.t < down) { const e = s.t / down; a = -1.1 + 1.12 * e * e; }
            else {
                if (!s.hitDone) { s.hitDone = true; this.hammerHit(); }
                const e = Math.min(1, (s.t - down) / back);
                a = 0.02 - 1.12 * (1 - (1 - e) * (1 - e));
                if (s.t > down + back) this.swing = null;
            }
        }
        this.swingA = a;
        this.hammerPose(hm, a);
        // Hand hält den Griff (Faust)
        const fist = hm.localToWorld(new THREE.Vector3(0, 0.055, 0));
        const hq = hm.quaternion.clone().multiply(this.handInHammer || (this.handInHammer = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
            new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1)))));
        h.hand.quaternion.copy(hq);
        setHandGrip(h.hand, 1, 0, 0);
        const fistLocal = new THREE.Vector3(0, -0.012, -0.045).multiplyScalar(h.hand.scale.x).applyQuaternion(hq);
        h.hand.position.copy(fist).sub(fistLocal);
    }

    hammerHit() {
        const g = this.game;
        const hit = g.hand.hoverHit;
        if (!hit) return;
        const t = this.resolve(hit.object);
        const p = hit.point.clone();
        const n = g.hand.normal.clone();
        const dir = n.clone().negate().multiplyScalar(0.55).add(_v.copy(p).sub(g.camera.position).setY(0).normalize().multiplyScalar(0.6)).add(UP.clone().multiplyScalar(0.55)).normalize();
        this.sparkBurst(p.clone().addScaledVector(n, 0.01), 22, 1.6, [3, 2.2, 0.8]);
        this.shake(0.012);
        g.audio.bonk(1);
        this.word(p.clone().addScaledVector(n, 0.06).setY(p.y + 0.1));
        this.addCombo();
        if (!t) { this.dust(p, 6); return; }
        if (t.kind === 'debris' || t.kind === 'ball' || t.kind === 'bomb') { this.push(this.bodyOf(t), dir, 4); return; }
        this.push(this.bodyOf(t), dir, 3.2);
        this.damage(t, 1, p, dir, hit);
    }

    // ------------------------------------------------------------------ Schaden & Zerbrechen
    damage(t, amount, p, dir, hit = null, quiet = false) {
        const g = this.game;
        if (!t || !t.key || this.broken.has(t.key)) return;
        const hp = (this.hp.get(t.key) ?? 2) - amount;
        this.hp.set(t.key, hp);
        if (t.kind === 'item' && t.it.id === 'duck') {
            g.audio.squeak();
            this.word(p.clone().setY(p.y + 0.12), 'QUIETSCH!');
            this.push(t.it.body, dir.clone().add(UP), 4);
            return;
        }
        if (t.kind === 'item' && t.it.id === 'monitor' && hp > 0) this.crackScreen(t.it, hit);
        if (t.kind === 'item' && t.it.id === 'tower') { this.sparkBurst(p, 40, 2.2, [0.8, 1.6, 3]); this.smokePuff(p, 3); g.audio.zap(); }
        if (t.kind === 'desk' && hp > 0) this.bumpDesk();
        if (t.kind === 'decor' && hp > 0 && !this.loose.has(t.obj)) this.makeLoose(t.obj, 0.4, dir);
        if (t.kind === 'glass') { this.shatterGlass(p); return; }
        if (hp <= 0) this.breakTarget(t, p, dir, quiet);
    }

    breakTarget(t, p, dir, quiet = false) {
        const g = this.game;
        this.broken.add(t.key);
        if (!quiet) {
            g.audio.crash(1);
            this.shake(0.03);
            this.word(p.clone().setY(p.y + 0.15), WORDS[Math.floor(Math.random() * WORDS.length)], true);
        }
        if (t.kind === 'item') {
            const it = t.it;
            if (it.id === 'cactus' && g.fun) { g.fun.breakCactus(); this.updateChaos(); return; }
            const extra = it.id === 'monitor' ? 'glass' : it.id === 'tower' ? 'sparks' : it.id === 'mug' ? 'coffee' : null;
            this.shatterObject(it.object, dir, { extra, mass: it.mass });
            this.removeItem(it);
        } else if (t.kind === 'box') {
            this.shatterObject(t.box.group, dir, { mass: 1.5, count: 22 });
            g.physics.remove(t.box.body);
            t.box.group.parent?.remove(t.box.group);
        } else if (t.kind === 'decor') {
            const l = this.loose.get(t.obj);
            this.shatterObject(t.obj, dir, { mass: 0.5 });
            if (l) g.physics.remove(l.body);
            t.obj.parent?.remove(t.obj);
        } else if (t.kind === 'desk') {
            this.collapseDesk(dir);
        }
        // schlafende Körper aufwecken, damit nichts in der Luft hängen bleibt
        for (const b of g.physics.world.bodies) if (b.type === CANNON.Body.DYNAMIC) b.wakeUp();
        this.updateChaos();
    }

    removeItem(it) {
        const g = this.game;
        if (g.hand.held === it) g.hand.held = null;
        g.physics.remove(it.body);
        it.object.parent?.remove(it.object);
        it.sorted = true;
        it.destroyed = true;
        it.visible = false;
        it.object.visible = false;
        if (it.plug && !it.plug.isStick) it.plug.hide();
        g.items = g.items.filter(x => x !== it);
        if (it.kind === 'device' && it.id === 'monitor') g.computer.powerOff();
    }

    materialColors(obj) {
        const counts = new Map();
        obj.traverse(o => {
            if (!o.isMesh || !o.material || o.userData.noRaycast) return;
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of ms) {
                if (!m.color) continue;
                o.geometry.computeBoundingSphere?.();
                const r = (o.geometry.boundingSphere?.radius || 0.01) * Math.max(o.scale.x, o.scale.y, o.scale.z);
                const hex = m.color.getHex();
                counts.set(hex, (counts.get(hex) || 0) + r * r + 0.0001);
            }
        });
        const cols = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
        return cols.length ? cols.slice(0, 5) : [0xcccccc];
    }

    debrisMat(hex, glass = false) {
        const key = glass ? 'glass' : hex;
        if (!this.matCache.has(key)) {
            this.matCache.set(key, glass
                ? new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, clearcoat: 1 })
                : new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.1 }));
        }
        return this.matCache.get(key);
    }

    shatterObject(obj, dir, { extra = null, mass = 1, count = null } = {}) {
        obj.updateMatrixWorld(true);
        _box.setFromObject(obj);
        if (_box.isEmpty()) return;
        const center = _box.getCenter(new THREE.Vector3());
        const size = _box.getSize(new THREE.Vector3());
        const vol = size.x * size.y * size.z;
        const n = count ?? THREE.MathUtils.clamp(Math.round(8 + vol * 900), 8, 26);
        const cols = this.materialColors(obj);
        const piece = Math.max(0.01, Math.cbrt(vol / n) * 0.7);
        for (let i = 0; i < n; i++) {
            const geo = this.debrisGeo[i % 3];
            const m = new THREE.Mesh(geo, this.debrisMat(cols[i % cols.length]));
            const s = piece * rand(0.6, 1.3);
            m.scale.set(s * rand(0.7, 1.4), s * rand(0.5, 1.1), s * rand(0.7, 1.4));
            m.position.set(rand(_box.min.x, _box.max.x), rand(_box.min.y, _box.max.y), rand(_box.min.z, _box.max.z));
            m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
            const out = m.position.clone().sub(center).normalize();
            const v = out.multiplyScalar(rand(1, 2.6)).addScaledVector(dir, rand(1, 2.5)).add(new THREE.Vector3(0, rand(0.5, 2), 0));
            this.addDebris(m, { x: m.scale.x / 2, y: m.scale.y / 2, z: m.scale.z / 2 }, Math.max(0.02, mass / n), v, 16 + rand(0, 6));
        }
        if (extra === 'glass') {
            for (let i = 0; i < 16; i++) this.glassShard(center.clone().add(new THREE.Vector3(rand(-0.25, 0.25), rand(0, 0.25), 0.02)), dir, 0.05);
            this.game.audio.shatter();
        }
        if (extra === 'sparks') { this.sparkBurst(center, 120, 3, [0.9, 1.8, 3.5]); this.smokePuff(center, 6); this.flash(center, 0x66aaff, 8); }
        if (extra === 'coffee') { this.sparkBurst(center, 1, 0.1, [0, 0, 0]); this.dust(center, 10, 0x4a2c1a); }
        this.dust(center, 8);
    }

    addDebris(mesh, half, mass, vel, life = 18) {
        const g = this.game;
        mesh.castShadow = half.x > 0.02;
        mesh.userData.debrisRef = null;
        this.hitRoot.add(mesh);
        const body = new CANNON.Body({ mass, linearDamping: 0.05, angularDamping: 0.15 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(0.004, half.x), Math.max(0.004, half.y), Math.max(0.004, half.z))));
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
        body.velocity.set(vel.x, vel.y, vel.z);
        body.angularVelocity.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
        g.physics.world.addBody(body);
        const d = { mesh, body, t: 0, life, s0: mesh.scale.clone() };
        mesh.userData.debrisRef = d;
        this.debris.push(d);
        // Obergrenze für die Bildrate
        while (this.debris.length > 260) this.killDebris(this.debris.shift());
        return d;
    }

    killDebris(d) {
        this.hitRoot.remove(d.mesh);
        this.game.physics.world.removeBody(d.body);
        d.dead = true;
    }

    glassShard(p, dir, size = 0.08) {
        const s = size * rand(0.6, 1.6);
        const shape = new THREE.Shape();
        shape.moveTo(rand(-0.5, 0), rand(-0.5, 0));
        shape.lineTo(rand(0.2, 0.6), rand(-0.6, 0.1));
        shape.lineTo(rand(-0.2, 0.4), rand(0.3, 0.7));
        const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.debrisMat(0, true));
        m.scale.setScalar(s);
        m.position.copy(p);
        m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        const v = new THREE.Vector3(rand(-0.6, 0.6), rand(0, 1.2), rand(-0.6, 0.6)).addScaledVector(dir, rand(0.5, 1.6));
        this.addDebris(m, { x: s * 0.4, y: s * 0.4, z: 0.003 }, 0.02, v, 14);
    }

    // Bildschirm-Risse auf dem Monitor
    crackScreen(mon, hit) {
        const ud = mon.object.userData;
        if (!ud.crack) {
            const c = document.createElement('canvas');
            c.width = 512; c.height = 320;
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
            m.position.copy(ud.screen.position).setZ(ud.screen.position.z + 0.001);
            m.userData.noRaycast = true;
            mon.object.add(m);
            ud.crack = { c, tex };
        }
        const { c, tex } = ud.crack;
        const ctx = c.getContext('2d');
        let u = 0.5, v = 0.5;
        if (hit?.object === ud.screen && hit.uv) { u = hit.uv.x; v = 1 - hit.uv.y; } else { u = rand(0.3, 0.7); v = rand(0.3, 0.7); }
        const x0 = u * c.width, y0 = v * c.height;
        ctx.lineCap = 'round';
        for (let k = 0; k < 11; k++) {
            let x = x0, y = y0, a = rand(0, Math.PI * 2);
            ctx.beginPath(); ctx.moveTo(x, y);
            const steps = Math.floor(rand(4, 9));
            for (let i = 0; i < steps; i++) { a += rand(-0.6, 0.6); x += Math.cos(a) * rand(12, 40); y += Math.sin(a) * rand(12, 40); ctx.lineTo(x, y); }
            ctx.strokeStyle = 'rgba(20,20,30,0.8)'; ctx.lineWidth = 4; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.6; ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x0, y0, 7, 0, Math.PI * 2); ctx.fill();
        tex.needsUpdate = true;
        this.game.audio.shatter();
    }

    shatterGlass(p) {
        const g = this.game;
        if (this.broken.has('glass')) return;
        this.broken.add('glass');
        const w = g.room.windowInfo;
        w.glass.visible = false;
        w.glass.userData.noRaycast = true;
        for (let i = 0; i < 46; i++) {
            const q = new THREE.Vector3(rand(w.x0, w.x1), rand(w.y0, w.y1), w.z + 0.03);
            if (i < 18) q.lerp(p, 0.7);
            this.glassShard(q, new THREE.Vector3(0, -0.3, 1), 0.12);
        }
        g.audio.shatter(); g.audio.crash(0.7);
        this.word(p.clone().setZ(p.z + 0.2), 'KLIRR!', true);
        this.shake(0.025);
        this.updateChaos();
    }

    // Deko von der Wand / Fensterbank lösen: wird ein eigener Physik-Körper
    makeLoose(obj, mass, dir) {
        const g = this.game;
        if (this.loose.has(obj)) return this.loose.get(obj);
        const pos = obj.position.clone(), quat = obj.quaternion.clone();
        obj.position.set(0, 0, 0); obj.quaternion.identity();
        obj.updateMatrixWorld(true);
        _box.setFromObject(obj);
        const c = _box.getCenter(new THREE.Vector3());
        const hs = _box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        obj.position.copy(pos); obj.quaternion.copy(quat);
        if (obj.parent !== g.room.staticGroup) { obj.parent?.remove(obj); g.room.staticGroup.add(obj); }
        const body = new CANNON.Body({ mass, linearDamping: 0.08, angularDamping: 0.2 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(0.006, hs.x), Math.max(0.006, hs.y), Math.max(0.006, hs.z))), new CANNON.Vec3(c.x, c.y, c.z));
        body.position.set(pos.x, pos.y, pos.z);
        body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        g.physics.world.addBody(body);
        g.physics.links.push({ body, object: obj });
        if (dir) this.push(body, dir, 1.5);
        const l = { body };
        this.loose.set(obj, l);
        return l;
    }

    bumpDesk() {
        const g = this.game;
        const D = g.room.desk;
        g.audio.thud(2);
        this.shake(0.02);
        for (const b of g.physics.world.bodies) {
            if (b.type !== CANNON.Body.DYNAMIC) continue;
            const p = b.position;
            if (p.y > 0.72 && p.y < 1.3 && p.x > D.top.position.x - D.half.x && p.x < D.top.position.x + D.half.x && p.z > D.top.position.z - D.half.z && p.z < D.top.position.z + D.half.z) {
                b.wakeUp();
                b.velocity.y += rand(1.2, 2.2);
                b.angularVelocity.set(rand(-5, 5), rand(-5, 5), rand(-5, 5));
            }
        }
    }

    collapseDesk(dir) {
        const g = this.game;
        const D = g.room.desk;
        this.deskDown = true;
        g.physics.world.removeBody(D.body);
        const top = this.makeLoose(D.top, 14, null);
        top.body.angularVelocity.set(rand(-1, 1), 0, rand(-1.5, 1.5));
        this.makeLoose(D.pad, 0.2, null);
        for (const leg of D.legs) {
            const l = this.makeLoose(leg, 2, null);
            const out = new THREE.Vector3(leg.position.x - D.top.position.x, 0.4, leg.position.z - D.top.position.z).normalize();
            this.push(l.body, out, 3);
        }
        g.audio.explosion();
        this.shake(0.05);
        this.word(D.top.position.clone().setY(1.0), 'KRAWUMM!', true);
        this.dust(D.top.position.clone().setY(0.6), 24);
        this.slowMo(0.8);
    }

    // ------------------------------------------------------------------ Bombe
    placeBomb(hit) {
        const g = this.game;
        if (this.bombs.length >= 6) return;
        const p = hit ? hit.point.clone().addScaledVector(g.hand.normal, 0.07) : g.camera.position.clone().add(new THREE.Vector3(0, -0.3, -0.6));
        const mesh = makeBomb();
        const holder = new THREE.Group();
        holder.add(mesh);
        mesh.position.y = -0.055;
        holder.position.copy(p);
        this.root.add(holder);
        const body = new CANNON.Body({ mass: 1.2, linearDamping: 0.1, angularDamping: 0.4 });
        body.addShape(new CANNON.Sphere(0.055));
        body.position.set(p.x, p.y, p.z);
        g.physics.world.addBody(body);
        const b = { mesh: holder, body, t: 1.8, spark: mesh.userData.spark };
        holder.traverse(o => { o.userData.bombRef = b; });
        this.bombs.push(b);
        g.audio.plop();
        g.audio.fuse(1.8);
    }

    explode(c) {
        const g = this.game;
        g.audio.explosion();
        this.shake(0.07);
        this.slowMo(0.9);
        this.flash(c, 0xffaa55, 12);
        this.word(c.clone().setY(c.y + 0.25), BIG_WORDS[Math.floor(Math.random() * BIG_WORDS.length)], true, 0.5);
        // Feuerball: heller Kern (leuchtet mit Bloom) + orange Glut-Sprites
        const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.8, 0.8), transparent: true, toneMapped: false, depthWrite: false }));
        core.position.copy(c); core.scale.setScalar(0.05); core.userData.noRaycast = true;
        this.root.add(core);
        this.fx.push({ obj: core, t: 0, life: 0.45, update: (f, k) => { f.obj.scale.setScalar(0.04 + k * 0.22); f.obj.material.opacity = (1 - k) * 0.9; } });
        for (let i = 0; i < 9; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color().setHSL(rand(0.02, 0.1), 1, rand(0.5, 0.6)).multiplyScalar(1.25), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
            sp.position.copy(c).add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.05, 0.12), rand(-0.1, 0.1)));
            sp.userData.noRaycast = true;
            const s0 = rand(0.1, 0.2), s1 = rand(0.35, 0.6);
            this.root.add(sp);
            this.fx.push({ obj: sp, t: 0, life: rand(0.5, 0.9), update: (f, k) => { f.obj.scale.setScalar(s0 + (s1 - s0) * Math.sqrt(k)); f.obj.material.opacity = (1 - k) * 0.6; f.obj.position.y += 0.004; } });
        }
        // Stoßwelle am Boden
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(c).setY(c.y - 0.04);
        ring.userData.noRaycast = true;
        this.root.add(ring);
        this.fx.push({ obj: ring, t: 0, life: 0.6, update: (f, k) => { f.obj.scale.setScalar(0.1 + k * 1.6); f.obj.material.opacity = 1 - k; } });
        this.sparkBurst(c, 160, 4, [3, 1.6, 0.5]);
        this.smokePuff(c, 12);
        this.confettiBurst(c, new THREE.Vector3(0, 1, 0), 60, 2.5);
        // Brandfleck
        const scorch = new THREE.Mesh(new THREE.CircleGeometry(rand(0.12, 0.18), 24), new THREE.MeshBasicMaterial({ color: 0x1a1210, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
        scorch.rotation.x = -Math.PI / 2;
        const gy = this.groundY(c);
        scorch.position.set(c.x, gy + 0.003, c.z);
        scorch.userData.noRaycast = true;
        this.root.add(scorch);
        // Druckwelle auf alle Körper
        const R = 1.3;
        for (const b of g.physics.world.bodies) {
            if (b.type !== CANNON.Body.DYNAMIC) continue;
            const dv = _v.set(b.position.x - c.x, b.position.y - c.y, b.position.z - c.z);
            const dist = dv.length();
            if (dist > R) continue;
            dv.normalize().add(new THREE.Vector3(0, 0.5, 0)).normalize();
            this.push(b, dv, 7 * (1 - dist / R) + 1);
        }
        // Schaden in der Nähe
        const near = [];
        for (const it of [...g.items, ...Object.values(g.devices)]) if (it.visible !== false && !it.destroyed && it.object.position.distanceTo(c) < 0.6) near.push({ kind: 'item', it, obj: it.object, key: it });
        for (const b of g.boxes) if (!this.broken.has(b) && b.group.parent && b.group.position.distanceTo(c) < 0.6) near.push({ kind: 'box', box: b, obj: b.group, key: b });
        for (const o of g.room.decor) if (!this.broken.has(o) && o.parent && o.getWorldPosition(_v2).distanceTo(c) < 0.6) near.push({ kind: 'decor', obj: o, key: o });
        if (!this.deskDown && c.y > 0.6 && c.y < 1.0 && Math.abs(c.x - g.room.desk.top.position.x) < g.room.desk.half.x && Math.abs(c.z - g.room.desk.top.position.z) < g.room.desk.half.z) near.push({ kind: 'desk', obj: g.room.desk.top, key: 'desk' });
        const w = g.room.windowInfo;
        if (Math.abs(c.z - w.z) < 0.6 && c.x > w.x0 - 0.2 && c.x < w.x1 + 0.2 && c.y > w.y0 - 0.3) near.push({ kind: 'glass', obj: w.glass, key: 'glass' });
        for (const t of near) {
            const dir = t.obj.getWorldPosition(new THREE.Vector3()).sub(c).normalize().add(UP).normalize();
            this.damage(t, 3, t.obj.getWorldPosition(new THREE.Vector3()), dir, null, true);
        }
        this.addCombo(3);
    }

    groundY(p) {
        this.ray.set(p.clone().setY(p.y + 0.05), new THREE.Vector3(0, -1, 0));
        this.ray.far = 3;
        const hits = this.ray.intersectObject(this.game.room.staticGroup, true);
        for (const h of hits) if (h.object.visible && !h.object.userData.noRaycast) return h.point.y;
        return 0;
    }

    // ------------------------------------------------------------------ Konfetti-Kanone
    fireConfetti(hit) {
        const g = this.game;
        const cam = g.camera.position;
        const target = hit ? hit.point.clone() : cam.clone().add(new THREE.Vector3(0, -0.2, -1).applyQuaternion(g.camera.quaternion));
        const origin = cam.clone().add(new THREE.Vector3(0.18, -0.22, -0.25).applyQuaternion(g.camera.quaternion));
        const dir = target.clone().sub(origin).normalize();
        this.confettiBurst(origin.clone().addScaledVector(dir, 0.1), dir, 90, 4.5);
        for (let i = 0; i < 5; i++) this.spawnBall(origin.clone().addScaledVector(dir, 0.12 + i * 0.03), dir.clone().add(new THREE.Vector3(rand(-0.12, 0.12), rand(0, 0.25), rand(-0.12, 0.12))).normalize().multiplyScalar(rand(4.5, 6.5)));
        g.audio.pop(); setTimeout(() => g.audio.pop(), 60); setTimeout(() => g.audio.pop(), 130);
        this.addCombo();
    }

    spawnBall(p, v) {
        const g = this.game;
        const r = rand(0.025, 0.045);
        const m = new THREE.Mesh(this.ballGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.85, 0.58), roughness: 0.3, emissive: 0x111111 }));
        m.scale.setScalar(r);
        m.position.copy(p);
        m.castShadow = true;
        this.hitRoot.add(m);
        const body = new CANNON.Body({ mass: 0.08, linearDamping: 0.02, angularDamping: 0.1 });
        body.addShape(new CANNON.Sphere(r));
        body.position.set(p.x, p.y, p.z);
        body.velocity.set(v.x, v.y, v.z);
        g.physics.world.addBody(body);
        const b = { mesh: m, body, t: 0, prev: new THREE.Vector3(), bounce: null };
        body.addEventListener('collide', e => {
            const n = e.contact.ni;
            const s = e.contact.bi === body ? -1 : 1;
            b.bounce = new THREE.Vector3(n.x * s, n.y * s, n.z * s);
        });
        m.userData.ballRef = b;
        this.balls.push(b);
        while (this.balls.length > 45) { const o = this.balls.shift(); this.hitRoot.remove(o.mesh); g.physics.world.removeBody(o.body); }
    }

    // ------------------------------------------------------------------ Effekte
    sparkBurst(p, n, speed, rgb) {
        for (let k = 0; k < n; k++) {
            const i = this.sparkI;
            this.sparkI = (this.sparkI + 1) % this.sparkN;
            this.sparkPos[i * 3] = p.x; this.sparkPos[i * 3 + 1] = p.y; this.sparkPos[i * 3 + 2] = p.z;
            const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
            this.sparkVel[i * 3] = v.x; this.sparkVel[i * 3 + 1] = v.y; this.sparkVel[i * 3 + 2] = v.z;
            const life = rand(0.35, 0.9);
            this.sparkLife[i] = life; this.sparkMax[i] = life;
            const j = rand(0.7, 1.2);
            this.sparkBase[i * 3] = rgb[0] * j; this.sparkBase[i * 3 + 1] = rgb[1] * j; this.sparkBase[i * 3 + 2] = rgb[2] * j;
        }
    }

    confettiBurst(p, dir, n, speed) {
        for (let k = 0; k < n; k++) {
            const c = this.confData[this.confI];
            this.confI = (this.confI + 1) % this.confN;
            c.p.copy(p);
            c.v.copy(dir).multiplyScalar(speed * rand(0.4, 1)).add(new THREE.Vector3(rand(-1, 1), rand(-0.3, 1.2), rand(-1, 1)).multiplyScalar(speed * 0.35));
            c.r.set(rand(0, 6), rand(0, 6), rand(0, 6));
            c.w.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
            c.life = rand(2.5, 4.5);
        }
    }

    smokePuff(p, n) {
        for (let i = 0; i < n; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: new THREE.Color().setScalar(rand(0.35, 0.6)), transparent: true, depthWrite: false, opacity: 0 }));
            sp.position.copy(p).add(new THREE.Vector3(rand(-0.08, 0.08), rand(0, 0.1), rand(-0.08, 0.08)));
            sp.userData.noRaycast = true;
            const s0 = rand(0.1, 0.2), s1 = rand(0.45, 0.8), drift = new THREE.Vector3(rand(-0.05, 0.05), rand(0.15, 0.3), rand(-0.05, 0.05));
            sp.material.rotation = rand(0, 6);
            this.root.add(sp);
            this.fx.push({ obj: sp, t: 0, life: rand(2, 3.5), update: (f, k, dt) => { f.obj.scale.setScalar(s0 + (s1 - s0) * k); f.obj.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.3)) * 0.55; f.obj.position.addScaledVector(drift, dt); f.obj.material.rotation += dt * 0.3; } });
        }
    }

    dust(p, n, color = 0xd9c7b0) {
        this.game.guide.burst(p.clone(), [color, 0xffffff, color], n, 0.7);
    }

    flash(p, color, intensity) {
        const l = new THREE.PointLight(color, intensity, 4, 2);
        l.position.copy(p);
        this.root.add(l);
        this.fx.push({ obj: l, t: 0, life: 0.45, update: (f, k) => { f.obj.intensity = intensity * (1 - k) * (1 - k); } });
    }

    word(p, text = null, big = false, scale = 0.32) {
        const w = text || WORDS[Math.floor(Math.random() * WORDS.length)];
        const key = w + (big ? '!' : '');
        if (!this.wordTex[key]) this.wordTex[key] = wordTexture(w, big);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.wordTex[key], transparent: true, depthTest: false, depthWrite: false }));
        sp.renderOrder = 30;
        sp.position.copy(p);
        sp.userData.noRaycast = true;
        const S = (big ? 1.4 : 1) * scale;
        this.root.add(sp);
        this.fx.push({ obj: sp, t: 0, life: big ? 1.3 : 0.9, real: true, update: (f, k, dt) => {
            const pop = k < 0.15 ? k / 0.15 * 1.15 : k < 0.25 ? 1.15 - (k - 0.15) * 1.5 : 1;
            f.obj.scale.set(S * pop, S * pop * 0.5, 1);
            f.obj.position.y += dt * 0.12;
            f.obj.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        } });
    }

    shake(a) { this.shakeAmt = Math.min(0.09, this.shakeAmt + a); }
    slowMo(dur) { this.slowT = Math.max(this.slowT, dur); }

    addCombo(n = 1) {
        this.combo = this.comboT > 0 ? this.combo + n : n;
        this.comboT = 1.4;
        const el = document.getElementById('comboText');
        if (el) {
            el.textContent = this.combo >= 2 ? `Combo ×${this.combo}!` : '';
            el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        }
    }

    updateChaos() {
        const pct = Math.min(100, Math.round((this.broken.size / Math.max(1, this.total)) * 100));
        const el = document.getElementById('chaosPct');
        if (el) el.textContent = `${pct} %`;
        const bar = document.getElementById('chaosFill');
        if (bar) bar.style.width = `${pct}%`;
        if (pct >= 100 && !this.allDone) {
            this.allDone = true;
            this.game.hud.say('ALLES KAPUTT! 🏆', 'Wow – du hast <b>wirklich alles</b> zerlegt! Zum Glück war alles nur virtuell. Mit <b>🧹 Alles neu</b> geht es von vorne los.', 'happy');
            for (let i = 0; i < 6; i++) setTimeout(() => this.confettiBurst(new THREE.Vector3(rand(-1.2, 0.8), 1.6, rand(-0.6, 1)), UP.clone().negate(), 80, 1), i * 200);
            this.game.audio.success();
        }
    }

    // Faktor für die Spielzeit (Zeitlupe)
    get scale() { return this.timeScale; }

    shakeOffset() { return this.shakeOff; }

    // ------------------------------------------------------------------ Schleife
    update(rawDt) {
        if (!this.active) return;
        const g = this.game;
        // Zeitlupe weich ein- und ausblenden
        if (this.slowT > 0) this.slowT -= rawDt;
        const target = this.slowT > 0 ? 0.25 : 1;
        this.timeScale += (target - this.timeScale) * Math.min(1, rawDt * 10);
        const dt = rawDt * this.timeScale;
        g.progression.idle = 0;
        if (this.comboT > 0) { this.comboT -= rawDt; if (this.comboT <= 0) { this.combo = 0; const el = document.getElementById('comboText'); if (el) el.textContent = ''; } }
        // Kamera-Wackeln
        this.shakeAmt *= Math.pow(0.02, rawDt);
        if (this.shakeAmt < 0.0005) this.shakeAmt = 0;
        this.shakeOff.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.shakeAmt);
        // Trümmer
        for (const d of this.debris) {
            d.t += dt;
            d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
            d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
            if (d.t > d.life - 0.6) d.mesh.scale.copy(d.s0).multiplyScalar(Math.max(0.001, (d.life - d.t) / 0.6));
            if (d.t > d.life) this.killDebris(d);
        }
        this.debris = this.debris.filter(d => !d.dead);
        // Bomben
        for (const b of this.bombs) {
            b.t -= dt;
            b.mesh.position.set(b.body.position.x, b.body.position.y, b.body.position.z);
            b.mesh.quaternion.set(b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w);
            const sp = b.spark.getWorldPosition(new THREE.Vector3());
            b.spark.scale.setScalar(0.8 + Math.random() * 0.8);
            if (Math.random() < 0.7) this.sparkBurst(sp, 2, 0.5, [3, 2, 0.6]);
            const pulse = 1 + Math.max(0, 0.6 - b.t) * Math.abs(Math.sin(b.t * 40)) * 0.25;
            b.mesh.scale.setScalar(pulse);
            if (b.t <= 0) {
                b.dead = true;
                this.root.remove(b.mesh);
                g.physics.world.removeBody(b.body);
                this.explode(new THREE.Vector3(b.body.position.x, b.body.position.y, b.body.position.z));
            }
        }
        this.bombs = this.bombs.filter(b => !b.dead);
        // Hüpfbälle
        for (const b of this.balls) {
            if (b.bounce) {
                const v = b.prev;
                const n = b.bounce;
                const vn = v.dot(n);
                if (vn < -0.3) {
                    const r = v.clone().addScaledVector(n, -2 * vn).multiplyScalar(0.82);
                    b.body.velocity.set(r.x, r.y, r.z);
                    if (Math.abs(vn) > 1.2 && Math.random() < 0.4) g.audio.tone(300 + Math.random() * 300, 0.06, { type: 'sine', vol: 0.05 });
                }
                b.bounce = null;
            }
            b.prev.set(b.body.velocity.x, b.body.velocity.y, b.body.velocity.z);
            b.mesh.position.set(b.body.position.x, b.body.position.y, b.body.position.z);
            b.mesh.quaternion.set(b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w);
        }
        // Funken
        const grav = this.zeroG ? 0 : 6;
        for (let i = 0; i < this.sparkN; i++) {
            if (this.sparkLife[i] <= 0) continue;
            this.sparkLife[i] -= dt;
            const k = Math.max(0, this.sparkLife[i] / this.sparkMax[i]);
            this.sparkVel[i * 3 + 1] -= grav * dt;
            this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;
            this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
            this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
            if (this.sparkPos[i * 3 + 1] < 0.005) { this.sparkPos[i * 3 + 1] = 0.005; this.sparkVel[i * 3 + 1] *= -0.3; }
            this.sparkCol[i * 3] = this.sparkBase[i * 3] * k;
            this.sparkCol[i * 3 + 1] = this.sparkBase[i * 3 + 1] * k;
            this.sparkCol[i * 3 + 2] = this.sparkBase[i * 3 + 2] * k;
            if (this.sparkLife[i] <= 0) this.sparkPos[i * 3 + 1] = -100;
        }
        this.sparks.geometry.attributes.position.needsUpdate = true;
        this.sparks.geometry.attributes.color.needsUpdate = true;
        // Konfetti flattert
        for (let i = 0; i < this.confN; i++) {
            const c = this.confData[i];
            if (c.life <= 0) continue;
            c.life -= dt;
            c.v.multiplyScalar(Math.pow(0.25, dt));
            c.v.y -= (this.zeroG ? 0 : 1.6) * dt;
            c.p.addScaledVector(c.v, dt);
            if (c.p.y < 0.003) { c.p.y = 0.003; c.v.set(0, 0, 0); c.w.multiplyScalar(0.9); }
            c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
            const s = c.life > 0 ? Math.min(1, c.life * 2) : 0;
            _q.setFromEuler(c.r);
            _m.compose(c.p, _q, _v.set(s, s, s));
            this.conf.setMatrixAt(i, _m);
        }
        this.conf.instanceMatrix.needsUpdate = true;
        // kurzlebige Effekte
        for (const f of this.fx) {
            const step = f.real ? rawDt : dt;
            f.t += step;
            const k = Math.min(1, f.t / f.life);
            f.update(f, k, step);
            if (f.t >= f.life) { f.dead = true; this.root.remove(f.obj); f.obj.material?.dispose?.(); }
        }
        this.fx = this.fx.filter(f => !f.dead);
    }

    raycastRoots() { return this.active ? [this.hitRoot] : []; }

    render() {
        if (this.composer) this.composer.render();
        else this.game.renderer.render(this.game.scene, this.game.camera);
    }
}
