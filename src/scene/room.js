import * as THREE from 'three';
import { mat, box, rbox, cyl, canvasTexture } from './models.js';

export const DESK = { x0: -0.72, x1: 0.95, z0: -0.45, z1: 0.35, top: 0.75 };
// Die Kartons stehen im Halbkreis um den Sitzplatz (links vom Tisch), damit alle vier gleichzeitig zu sehen sind.
const SEAT = { x: 0, z: 0.86 };
const ARC_R = 1.4;
const onArc = (a, y) => new THREE.Vector3(SEAT.x - Math.sin(a) * ARC_R, y, SEAT.z - Math.cos(a) * ARC_R);
export const BENCH = { cx: -1.2, cz: 0.12, w: 0.56, d: 1.55, top: 0.42 };
export const BOX_DEFS = [
    { cat: 'E', name: 'EINGABE', color: '#2fae5f', hex: 0x2fae5f, pos: onArc(1.96, BENCH.top), sub: 'Informationen hinein' },
    { cat: 'V', name: 'VERARBEITUNG', color: '#3b7ddd', hex: 0x3b7ddd, pos: onArc(1.68, BENCH.top), sub: 'Der Computer rechnet' },
    { cat: 'A', name: 'AUSGABE', color: '#f08a24', hex: 0xf08a24, pos: onArc(1.4, BENCH.top), sub: 'Ergebnis heraus' },
    { cat: 'S', name: 'SPEICHER', color: '#14a3a3', hex: 0x14a3a3, pos: onArc(1.12, BENCH.top), sub: 'Merkt sich Daten' },
];
export const BOX_SIZE = { w: 0.37, h: 0.28, d: 0.34, t: 0.015 };

export function buildRoom(game) {
    const { scene, physics } = game;
    const staticGroup = new THREE.Group();
    staticGroup.name = 'room';
    scene.add(staticGroup);

    // ---------- Licht ----------
    const hemi = new THREE.HemisphereLight(0xfff4ea, 0x5a4050, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(1.4, 3.2, 1.6);
    sun.target.position.set(-0.2, 0.6, -0.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -2.2; sun.shadow.camera.right = 1.6;
    sun.shadow.camera.top = 1.8; sun.shadow.camera.bottom = -1.4;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 7;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    scene.add(sun, sun.target);
    const fill = new THREE.PointLight(0xffd6e6, 0.6, 6);
    fill.position.set(-1.2, 1.8, 1.0);
    scene.add(fill);

    // ---------- Boden & Wände ----------
    const floorTex = canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b98a62'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 ? '#b1825b' : '#c09069';
            ctx.fillRect(0, i * 64, w, 62);
            ctx.fillStyle = '#9c7350';
            ctx.fillRect(((i * 197) % 400) + 40, i * 64, 3, 62);
        }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);
    // Boden nur innerhalb des Raums (hinter der Rückwand liegt die Außenwelt)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.4), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floorTex.repeat.set(2, 1.4);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0.1, 0, 0.6);
    floor.receiveShadow = true;
    staticGroup.add(floor);
    physics.addStaticBox({ x: 5, y: 0.05, z: 5 }, { x: 0, y: -0.05, z: 0 });

    const wallMat = mat(0xf3e3ea, { roughness: 0.95 });
    // Rückwand mit großer Fensteröffnung
    const WIN = { x0: -0.45, x1: 2.05, y0: 0.8, y1: 2.05 };
    for (const [x0, x1, y0, y1] of [[-2.2, WIN.x0, 0, 4], [WIN.x1, 2.4, 0, 4], [WIN.x0, WIN.x1, 0, WIN.y0], [WIN.x0, WIN.x1, WIN.y1, 4]]) {
        const part = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat);
        part.position.set((x0 + x1) / 2, (y0 + y1) / 2, -1.1);
        part.receiveShadow = true;
        staticGroup.add(part);
    }
    const left = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4), mat(0xead5df, { roughness: 0.95 }));
    left.rotation.y = Math.PI / 2;
    left.position.set(-2.2, 2, 0.6);
    left.receiveShadow = true;
    staticGroup.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4), mat(0xead5df, { roughness: 0.95 }));
    right.rotation.y = -Math.PI / 2;
    right.position.set(2.4, 2, 0.6);
    staticGroup.add(right);
    // Wand hinter dem Sitzplatz (beim Blick zu den Kartons links im Bild) – mit Tür
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4), mat(0xead5df, { roughness: 0.95 }));
    back.rotation.y = Math.PI;
    back.position.set(0.1, 2, 2.2);
    staticGroup.add(back);
    const door = rbox(0.86, 2.02, 0.04, 0xc9a06b, { r: 0.01 });
    door.position.set(-1.45, 1.01, 2.19);
    staticGroup.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat(0xd8dbe2, { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(-1.12, 1.0, 2.15);
    staticGroup.add(knob);
    physics.addStaticBox({ x: 5, y: 2, z: 0.05 }, { x: 0, y: 2, z: -1.15 });
    physics.addStaticBox({ x: 0.05, y: 2, z: 5 }, { x: -2.25, y: 2, z: 0 });
    physics.addStaticBox({ x: 0.05, y: 2, z: 5 }, { x: 2.45, y: 2, z: 0 });
    physics.addStaticBox({ x: 5, y: 2, z: 0.05 }, { x: 0, y: 2, z: 2.2 });

    // Panoramafenster (die Außenwelt baut outside.js)
    const frameMat = mat(0xffffff, { roughness: 0.5 });
    const wcx = (WIN.x0 + WIN.x1) / 2, wcy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
    const addFrame = (w, h, x, y, z = -1.1, d = 0.07) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        b.position.set(x, y, z);
        b.castShadow = true;
        staticGroup.add(b);
    };
    addFrame(ww + 0.1, 0.06, wcx, WIN.y1 + 0.02);
    addFrame(0.06, wh + 0.06, WIN.x0 - 0.02, wcy);
    addFrame(0.06, wh + 0.06, WIN.x1 + 0.02, wcy);
    for (const x of [WIN.x0 + ww / 3, WIN.x0 + (2 * ww) / 3]) addFrame(0.05, wh, x, wcy, -1.1, 0.06);
    addFrame(ww, 0.035, wcx, WIN.y0 + wh * 0.72, -1.1, 0.05);
    // Glas: ganz leichter Schimmer
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshStandardMaterial({
        color: 0xdff3ff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.2, depthWrite: false,
    }));
    glass.position.set(wcx, wcy, -1.1);
    glass.userData.noRaycast = true;
    staticGroup.add(glass);
    // Fensterbank
    const sill = rbox(ww + 0.2, 0.03, 0.16, 0xf7f2ee, { r: 0.006 });
    sill.position.set(wcx, WIN.y0 - 0.015, -1.04);
    staticGroup.add(sill);
    physics.addStaticBox({ x: (ww + 0.2) / 2, y: 0.015, z: 0.08 }, { x: wcx, y: WIN.y0 - 0.015, z: -1.04 });
    // Deko auf der Fensterbank: Bücher, Globus, Stiftebecher
    const bookCols = [0x3b7ddd, 0xf08a24, 0x2fae5f, 0xd67c9c, 0xffd43b];
    bookCols.forEach((c, i) => {
        const bk = box(0.035, 0.17 + (i % 3) * 0.025, 0.12, c);
        bk.position.set(-0.32 + i * 0.038, WIN.y0 + bk.geometry.parameters.height / 2, -1.04);
        if (i === 4) { bk.rotation.z = -0.35; bk.position.x += 0.03; }
        staticGroup.add(bk);
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 128, (ctx, w, h) => {
            ctx.fillStyle = '#4dabf7'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#69db7c';
            for (const [x, y, rx, ry] of [[50, 50, 28, 22], [70, 85, 14, 24], [130, 45, 30, 18], [145, 80, 18, 20], [205, 55, 26, 16], [215, 95, 14, 10]]) {
                ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
            }
        }), roughness: 0.4,
    }));
    globe.position.set(1.55, WIN.y0 + 0.11, -1.04);
    globe.rotation.z = 0.4;
    staticGroup.add(globe);
    const gstand = cyl(0.03, 0.035, 0.04, 0x8a6d4f, 14);
    gstand.position.set(1.55, WIN.y0 + 0.02, -1.04);
    staticGroup.add(gstand);
    const cup = cyl(0.03, 0.026, 0.09, 0x4a1f3a, 16);
    cup.position.set(0.95, WIN.y0 + 0.045, -1.05);
    staticGroup.add(cup);
    [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c].forEach((c, i) => {
        const pen = cyl(0.004, 0.004, 0.13, c, 6);
        pen.position.set(0.95 + (i - 1.5) * 0.012, WIN.y0 + 0.1, -1.05 + (i % 2) * 0.01);
        pen.rotation.z = (i - 1.5) * 0.12;
        staticGroup.add(pen);
    });
    // Heizkörper unter dem Fenster
    const rad = new THREE.Group();
    for (let i = 0; i < 18; i++) {
        const fin = rbox(0.045, 0.4, 0.05, 0xf4f4f6, { r: 0.012 });
        fin.position.set(i * 0.06, 0, 0);
        rad.add(fin);
    }
    rad.position.set(wcx - 0.5, 0.42, -1.06);
    staticGroup.add(rad);

    // Wanduhr (zeigt die echte Uhrzeit)
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.11, 40), new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4a1f3a';
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                ctx.save(); ctx.translate(w / 2 + Math.sin(a) * 104, h / 2 - Math.cos(a) * 104); ctx.rotate(a);
                ctx.fillRect(-3, -10, 6, i % 3 ? 14 : 22); ctx.restore();
            }
        }), roughness: 0.6,
    }));
    clock.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.01, 8, 40), mat(0xd67c9c));
    clock.add(ring);
    const mkHand = (len, wid, col, z) => {
        const hnd = new THREE.Group();
        const b = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.004), new THREE.MeshBasicMaterial({ color: col }));
        b.position.y = len / 2 - 0.012;
        hnd.add(b);
        hnd.position.z = z;
        clock.add(hnd);
        return hnd;
    };
    const hourHand = mkHand(0.06, 0.008, 0x2a1a2e, 0.004);
    const minHand = mkHand(0.09, 0.005, 0x2a1a2e, 0.008);
    const secHand = mkHand(0.095, 0.002, 0xe03131, 0.012);
    clock.position.set(-0.8, 1.2, -1.095);
    staticGroup.add(clock);
    const updateClock = () => {
        const d = new Date();
        const sec = d.getSeconds() + d.getMilliseconds() / 1000;
        const min = d.getMinutes() + sec / 60;
        const hr = (d.getHours() % 12) + min / 60;
        secHand.rotation.z = -sec / 60 * Math.PI * 2;
        minHand.rotation.z = -min / 60 * Math.PI * 2;
        hourHand.rotation.z = -hr / 12 * Math.PI * 2;
    };

    // Poster
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshStandardMaterial({
        map: canvasTexture(620, 420, (ctx, w, h) => {
            ctx.fillStyle = '#2a1a2e'; ctx.fillRect(0, 0, w, h);
            ctx.font = 'bold 54px Segoe UI, sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = '#e092b0'; ctx.fillText('Das EVAS-Prinzip', w / 2, 76);
            const cols = [['#2fae5f', 'E', 'Eingabe'], ['#3b7ddd', 'V', 'Verarbeitung'], ['#f08a24', 'A', 'Ausgabe']];
            cols.forEach(([c, l, t], i) => {
                const x = 110 + i * 200;
                ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 180, 62, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 72px Segoe UI, sans-serif'; ctx.fillText(l, x, 205);
                ctx.font = 'bold 26px Segoe UI, sans-serif'; ctx.fillText(t, x, 275);
                if (i < 2) { ctx.fillStyle = '#e0c5d0'; ctx.font = 'bold 46px Segoe UI'; ctx.fillText('➜', x + 100, 198); }
            });
            // Speicher als Band darunter: alle drei können ihn benutzen
            ctx.fillStyle = '#14a3a3';
            ctx.beginPath(); ctx.roundRect?.(60, 310, 500, 80, 40); if (!ctx.roundRect) ctx.rect(60, 310, 500, 80); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Segoe UI, sans-serif'; ctx.fillText('S  Speicher', w / 2, 365);
            ctx.fillStyle = '#e0c5d0'; ctx.font = 'bold 30px Segoe UI';
            for (const x of [110, 310, 510]) ctx.fillText('⇅', x, 302);
        }),
    }));
    poster.position.set(-1.5, 1.12, -1.095);
    staticGroup.add(poster);

    // Schild über den Kartons
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.24), new THREE.MeshStandardMaterial({
        map: canvasTexture(1000, 240, (ctx, w, h) => {
            ctx.fillStyle = '#fff6fa'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#d67c9c'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14);
            ctx.fillStyle = '#4a1f3a'; ctx.font = 'bold 64px Segoe UI, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('Sortier-Station 📦', w / 2, 110);
            ctx.font = '40px Segoe UI, sans-serif';
            ctx.fillText('Benutzte Geräte hier einräumen', w / 2, 180);
        }),
    }));
    sign.rotation.y = Math.PI / 2;
    sign.position.set(-2.19, 1.35, 0.08);
    staticGroup.add(sign);

    // ---------- Schreibtisch ----------
    const deskW = DESK.x1 - DESK.x0, deskD = DESK.z1 - DESK.z0;
    const deskCx = (DESK.x0 + DESK.x1) / 2, deskCz = (DESK.z0 + DESK.z1) / 2;
    const top = rbox(deskW, 0.04, deskD, 0xe8c9a0, { r: 0.012 });
    top.position.set(deskCx, DESK.top - 0.02, deskCz);
    top.userData.surface = true;
    staticGroup.add(top);
    physics.addStaticBox({ x: deskW / 2, y: 0.02, z: deskD / 2 }, { x: deskCx, y: DESK.top - 0.02, z: deskCz });
    for (const [x, z] of [[DESK.x0 + 0.05, DESK.z0 + 0.05], [DESK.x1 - 0.05, DESK.z0 + 0.05], [DESK.x0 + 0.05, DESK.z1 - 0.05], [DESK.x1 - 0.05, DESK.z1 - 0.05]]) {
        const leg = box(0.045, DESK.top - 0.04, 0.045, 0xa8a8b4, { metalness: 0.5, roughness: 0.4 });
        leg.position.set(x, (DESK.top - 0.04) / 2, z);
        staticGroup.add(leg);
    }
    // Mauspad
    const pad = rbox(0.26, 0.004, 0.21, 0x4a1f3a, { r: 0.002 });
    pad.position.set(0.4, DESK.top + 0.002, 0.13);
    staticGroup.add(pad);
    game.mousePad = { center: new THREE.Vector3(0.4, DESK.top + 0.004, 0.13), hx: 0.1, hz: 0.075 };

    // ---------- Bänkchen für die Kartons (eins pro Karton, zum Sitzplatz gedreht) ----------
    for (const def of BOX_DEFS) {
        const yaw = Math.atan2(game.cameraBase.x - def.pos.x, game.cameraBase.z - def.pos.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
        const bw = BOX_SIZE.w + 0.08, bd = BOX_SIZE.d + 0.1;
        const top = rbox(bw, 0.04, bd, 0xc3a37f, { r: 0.01 });
        top.position.set(def.pos.x, BENCH.top - 0.02, def.pos.z);
        top.quaternion.copy(q);
        staticGroup.add(top);
        physics.addStaticBox({ x: bw / 2, y: 0.02, z: bd / 2 }, { x: def.pos.x, y: BENCH.top - 0.02, z: def.pos.z }, q);
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
            const leg = box(0.035, BENCH.top - 0.04, 0.035, 0x8a6d4f);
            leg.position.set(dx * (bw / 2 - 0.04), -(BENCH.top - 0.04) / 2 - 0.02, dz * (bd / 2 - 0.04));
            top.add(leg);
        }
    }

    // ---------- Kartons ----------
    const camPos = game.cameraBase;
    const boxes = BOX_DEFS.map(def => buildCardboardBox(game, staticGroup, def, camPos));

    const lights = [hemi, sun, fill].map(l => ({ light: l, base: l.intensity }));
    return { staticGroup, boxes, sun, lights, update: updateClock };
}

function buildCardboardBox(game, parent, def, camPos) {
    const { w, h, d, t } = BOX_SIZE;
    const g = new THREE.Group();
    g.position.copy(def.pos);
    // zur Kamera drehen (nur um y)
    const dir = new THREE.Vector3(camPos.x - def.pos.x, 0, camPos.z - def.pos.z).normalize();
    g.rotation.y = Math.atan2(dir.x, dir.z);
    parent.add(g);

    const card = mat(0xc9a06b, { roughness: 0.9 });
    const cardIn = mat(0xa9824f, { roughness: 0.95, side: THREE.DoubleSide });
    const parts = [
        { half: { x: w / 2, y: t / 2, z: d / 2 }, offset: { x: 0, y: t / 2, z: 0 } },
        { half: { x: w / 2, y: h / 2, z: t / 2 }, offset: { x: 0, y: h / 2, z: d / 2 - t / 2 } },
        { half: { x: w / 2, y: h / 2, z: t / 2 }, offset: { x: 0, y: h / 2, z: -d / 2 + t / 2 } },
        { half: { x: t / 2, y: h / 2, z: d / 2 }, offset: { x: w / 2 - t / 2, y: h / 2, z: 0 } },
        { half: { x: t / 2, y: h / 2, z: d / 2 }, offset: { x: -w / 2 + t / 2, y: h / 2, z: 0 } },
    ];
    parts.forEach((p, i) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.half.x * 2, p.half.y * 2, p.half.z * 2), i === 0 ? cardIn : card);
        m.position.set(p.offset.x, p.offset.y, p.offset.z);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
    });
    // aufgeklappte Laschen
    const flapMat = mat(0xd4ad78, { roughness: 0.9, side: THREE.DoubleSide });
    // Hintere und seitliche Laschen stehen schräg nach oben (vorne offen, damit das Etikett sichtbar bleibt)
    const flapDefs = [
        { size: [w, d * 0.42], pos: [0, h, -d / 2], axis: 'x', angle: 1.05, dir: [0, -1] },
        { size: [w * 0.42, d], pos: [w / 2, h, 0], axis: 'z', angle: 1.05, dir: [1, 0] },
        { size: [w * 0.42, d], pos: [-w / 2, h, 0], axis: 'z', angle: -1.05, dir: [-1, 0] },
    ];
    for (const f of flapDefs) {
        const pivot = new THREE.Group();
        pivot.position.set(...f.pos);
        const flap = new THREE.Mesh(new THREE.BoxGeometry(f.size[0], 0.006, f.size[1]), flapMat);
        flap.position.set(f.dir[0] * f.size[0] / 2, 0, f.dir[1] * f.size[1] / 2);
        flap.castShadow = true;
        pivot.add(flap);
        pivot.rotation[f.axis] = f.angle;
        g.add(pivot);
    }

    // Etikett vorne
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512; labelCanvas.height = 256;
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.45), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8, emissive: 0x000000 }));
    label.position.set(0, h * 0.5, d / 2 + 0.002);
    g.add(label);

    // Glüh-Rahmen für Rückmeldung
    const glow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.02, d + 0.03), new THREE.MeshBasicMaterial({ color: def.hex, transparent: true, opacity: 0 }));
    glow.position.y = h + 0.01;
    g.add(glow);

    g.updateMatrixWorld(true);
    const q = g.quaternion;
    game.physics.addStaticCompound(parts, def.pos, q);

    const boxObj = {
        ...def,
        group: g,
        label, labelCanvas, labelTex, glow,
        contents: [],
        glowT: 0,
        drawLabel() {
            const ctx = labelCanvas.getContext('2d');
            const W = labelCanvas.width, H = labelCanvas.height;
            ctx.fillStyle = '#f7ead6'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = def.color; ctx.fillRect(0, 0, W, 84);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 58px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(def.name, W / 2, 46);
            ctx.fillStyle = '#4a3420'; ctx.font = '34px Segoe UI, sans-serif';
            ctx.fillText(def.sub, W / 2, 130);
            ctx.font = 'bold 44px Segoe UI, sans-serif';
            const icons = this.contents.map(dv => dv.def.emoji).join(' ');
            ctx.fillText(icons || '· · ·', W / 2, 200);
            labelTex.needsUpdate = true;
        },
    };
    boxObj.drawLabel();
    g.userData.box = boxObj;
    return boxObj;
}
