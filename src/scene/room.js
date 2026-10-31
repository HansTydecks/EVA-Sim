import * as THREE from 'three';
import { mat, box, rbox, cyl, canvasTexture } from './models.js';

export const DESK = { x0: -0.72, x1: 0.95, z0: -0.45, z1: 0.35, top: 0.75 };
export const BENCH = { cx: -1.2, cz: 0.12, w: 0.56, d: 1.55, top: 0.42 };

export const BOX_DEFS = [
    { cat: 'E', name: 'EINGABE', color: '#2fae5f', hex: 0x2fae5f, pos: new THREE.Vector3(-1.13, BENCH.top, 0.62), sub: 'Informationen hinein' },
    { cat: 'V', name: 'VERARBEITUNG', color: '#3b7ddd', hex: 0x3b7ddd, pos: new THREE.Vector3(-1.2, BENCH.top, 0.14), sub: 'Der Computer rechnet' },
    { cat: 'A', name: 'AUSGABE', color: '#f08a24', hex: 0xf08a24, pos: new THREE.Vector3(-1.13, BENCH.top, -0.36), sub: 'Ergebnis heraus' },
];
export const BOX_SIZE = { w: 0.44, h: 0.3, d: 0.38, t: 0.015 };

export function buildRoom(game) {
    const { scene, physics } = game;
    const staticGroup = new THREE.Group();
    staticGroup.name = 'room';
    scene.add(staticGroup);

    // ---------- Licht ----------
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0x5a4050, 1.25));
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    staticGroup.add(floor);
    physics.addStaticBox({ x: 5, y: 0.05, z: 5 }, { x: 0, y: -0.05, z: 0 });

    const wallMat = mat(0xf3e3ea, { roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wallMat);
    back.position.set(0, 2, -1.1);
    back.receiveShadow = true;
    staticGroup.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), mat(0xead5df, { roughness: 0.95 }));
    left.rotation.y = Math.PI / 2;
    left.position.set(-2.2, 2, 0);
    left.receiveShadow = true;
    staticGroup.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), mat(0xead5df, { roughness: 0.95 }));
    right.rotation.y = -Math.PI / 2;
    right.position.set(2.4, 2, 0);
    staticGroup.add(right);
    physics.addStaticBox({ x: 5, y: 2, z: 0.05 }, { x: 0, y: 2, z: -1.15 });
    physics.addStaticBox({ x: 0.05, y: 2, z: 5 }, { x: -2.25, y: 2, z: 0 });
    physics.addStaticBox({ x: 0.05, y: 2, z: 5 }, { x: 2.45, y: 2, z: 0 });
    physics.addStaticBox({ x: 5, y: 2, z: 0.05 }, { x: 0, y: 2, z: 2.2 });

    // Fenster
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({
        map: canvasTexture(256, 192, (ctx, w, h) => {
            const gr = ctx.createLinearGradient(0, 0, 0, h);
            gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(1, '#d9f1ff');
            ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            for (const [x, y, r] of [[60, 50, 22], [85, 45, 28], [110, 52, 20], [180, 90, 18], [200, 84, 24]]) {
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#6cc070'; ctx.fillRect(0, h - 40, w, 40);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - 4, 0, 8, h); ctx.fillRect(0, h / 2 - 4, w, 8);
        }),
    }));
    win.position.set(0.95, 1.75, -1.095);
    staticGroup.add(win);
    const frame = rbox(1.18, 0.88, 0.04, 0xffffff, { r: 0.01 });
    frame.position.set(0.95, 1.75, -1.12);
    staticGroup.add(frame);

    // Poster
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshStandardMaterial({
        map: canvasTexture(620, 420, (ctx, w, h) => {
            ctx.fillStyle = '#2a1a2e'; ctx.fillRect(0, 0, w, h);
            ctx.font = 'bold 54px Segoe UI, sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = '#e092b0'; ctx.fillText('Das EVA-Prinzip', w / 2, 80);
            const cols = [['#2fae5f', 'E', 'Eingabe'], ['#3b7ddd', 'V', 'Verarbeitung'], ['#f08a24', 'A', 'Ausgabe']];
            cols.forEach(([c, l, t], i) => {
                const x = 110 + i * 200;
                ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 210, 70, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 80px Segoe UI, sans-serif'; ctx.fillText(l, x, 238);
                ctx.font = 'bold 30px Segoe UI, sans-serif'; ctx.fillText(t, x, 335);
                if (i < 2) { ctx.fillStyle = '#e0c5d0'; ctx.font = 'bold 50px Segoe UI'; ctx.fillText('➜', x + 100, 228); }
            });
        }),
    }));
    poster.position.set(-0.55, 1.6, -1.095);
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

    // ---------- Bank für Kartons ----------
    const bench = rbox(BENCH.w, 0.04, BENCH.d, 0xc3a37f, { r: 0.01 });
    bench.position.set(BENCH.cx, BENCH.top - 0.02, BENCH.cz);
    staticGroup.add(bench);
    physics.addStaticBox({ x: BENCH.w / 2, y: 0.02, z: BENCH.d / 2 }, { x: BENCH.cx, y: BENCH.top - 0.02, z: BENCH.cz });
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        const leg = box(0.04, BENCH.top - 0.04, 0.04, 0x8a6d4f);
        leg.position.set(BENCH.cx + dx * (BENCH.w / 2 - 0.04), (BENCH.top - 0.04) / 2, BENCH.cz + dz * (BENCH.d / 2 - 0.04));
        staticGroup.add(leg);
    }

    // ---------- Kartons ----------
    const camPos = game.cameraBase;
    const boxes = BOX_DEFS.map(def => buildCardboardBox(game, staticGroup, def, camPos));

    return { staticGroup, boxes, sun };
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
