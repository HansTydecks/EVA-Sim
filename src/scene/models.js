import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// Prozedurale Low-Poly-Modelle. Konvention: Ursprung = Unterseite Mitte, "vorne" = +z (zum Spieler).

export function mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, ...opts });
}

export function rbox(w, h, d, color, { r = null, seg = 2, matOpts = {}, material = null } = {}) {
    const radius = r ?? Math.min(w, h, d) * 0.18;
    const g = new RoundedBoxGeometry(w, h, d, seg, radius);
    const m = new THREE.Mesh(g, material || mat(color, matOpts));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function box(w, h, d, color, matOpts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, matOpts));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function cyl(rt, rb, h, color, seg = 20, matOpts = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, matOpts));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

export function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function labelPlane(w, h, text, { bg = '#00000000', fg = '#ffffff', font = 'bold 64px Segoe UI, sans-serif' } = {}) {
    const tex = canvasTexture(256, Math.round(256 * h / w), (ctx, cw, ch) => {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, cw / 2, ch / 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    return m;
}

// ---------------- Computer (Tower) ----------------
export function makeTower() {
    const g = new THREE.Group();
    const W = 0.2, H = 0.46, D = 0.42;
    g.add(at(rbox(W, H, D, 0x3a3f4b, { r: 0.015 }), 0, H / 2, 0));
    const front = rbox(W - 0.02, H - 0.02, 0.012, 0x4b5262, { r: 0.004 });
    at(front, 0, H / 2, D / 2 + 0.002);
    g.add(front);
    // Lüftungsschlitze
    for (let i = 0; i < 6; i++) {
        const s = box(0.12, 0.006, 0.004, 0x23262e);
        at(s, 0, 0.04 + i * 0.012, D / 2 + 0.01);
        g.add(s);
    }
    // Power-Knopf + LED
    const btn = cyl(0.016, 0.016, 0.01, 0xdddddd);
    btn.rotation.x = Math.PI / 2;
    at(btn, -0.05, H - 0.055, D / 2 + 0.01);
    g.add(btn);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), mat(0x222222, { emissive: 0x000000 }));
    at(led, 0.05, H - 0.055, D / 2 + 0.01);
    g.add(led);
    // Aufschrift
    const lbl = labelPlane(0.16, 0.03, 'COMPUTER', { fg: '#cfd6e4', font: 'bold 34px Segoe UI, sans-serif' });
    at(lbl, 0, H - 0.022, D / 2 + 0.0095);
    g.add(lbl);
    g.userData = { size: new THREE.Vector3(W, H, D), led, frontZ: D / 2 + 0.009 };
    return g;
}

// ---------------- Bildschirm ----------------
export function makeMonitor(screenTexture) {
    const g = new THREE.Group();
    g.add(at(rbox(0.24, 0.016, 0.17, 0x2b2e36, { r: 0.006 }), 0, 0.008, 0));
    g.add(at(rbox(0.045, 0.2, 0.03, 0x2b2e36, { r: 0.008 }), 0, 0.11, -0.04));
    const panel = rbox(0.6, 0.38, 0.03, 0x1b1d22, { r: 0.012 });
    at(panel, 0, 0.32, -0.015);
    g.add(panel);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x050608, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), screenMat);
    at(screen, 0, 0.325, 0.0015);
    g.add(screen);
    const brand = labelPlane(0.08, 0.012, 'EVA', { fg: '#8890a0', font: 'bold 40px Segoe UI, sans-serif' });
    at(brand, 0, 0.14, 0.001);
    g.add(brand);
    g.userData = { size: new THREE.Vector3(0.6, 0.51, 0.17), screen, screenMat, screenTexture, anchor: new THREE.Vector3(0, 0.1, -0.06) };
    return g;
}

// ---------------- Maus ----------------
export function makeMouse() {
    const g = new THREE.Group();
    const body = rbox(0.066, 0.034, 0.11, 0xe9ecf2, { r: 0.016, seg: 3 });
    at(body, 0, 0.017, 0);
    g.add(body);
    const split = box(0.002, 0.006, 0.045, 0x9aa3b5);
    at(split, 0, 0.034, -0.03);
    g.add(split);
    const wheel = cyl(0.007, 0.007, 0.008, 0x40444f, 14);
    wheel.rotation.z = Math.PI / 2;
    at(wheel, 0, 0.034, -0.03);
    g.add(wheel);
    const leftBtn = box(0.03, 0.004, 0.045, 0xd6dbe5);
    at(leftBtn, -0.0165, 0.033, -0.03);
    g.add(leftBtn);
    g.userData = { size: new THREE.Vector3(0.066, 0.036, 0.11), anchor: new THREE.Vector3(0, 0.015, -0.055), leftBtn };
    return g;
}

// ---------------- Tastatur ----------------
export const KEY_ROWS = [
    '1234567890ß',
    'QWERTZUIOPÜ',
    'ASDFGHJKLÖÄ',
    'YXCVBNM,.-',
];

export function makeKeyboard() {
    const g = new THREE.Group();
    const W = 0.44, D = 0.15;
    g.add(at(rbox(W, 0.022, D, 0x2c303a, { r: 0.008 }), 0, 0.011, 0));
    const keys = {};
    const keyMat = () => mat(0xf2f3f7);
    const kw = 0.031, gap = 0.0045;
    KEY_ROWS.forEach((row, ri) => {
        const z = -0.05 + ri * (kw + gap);
        const off = ri * 0.008 - 0.012;
        for (let i = 0; i < row.length; i++) {
            const k = rbox(kw, 0.012, kw, 0, { r: 0.004, material: keyMat() });
            const x = -W / 2 + 0.03 + off + i * (kw + gap);
            at(k, x, 0.026, z);
            k.userData.baseY = 0.026;
            keys[row[i]] = k;
            g.add(k);
        }
        // Enter/Backspace als breite Tasten
    });
    const space = rbox(0.2, 0.012, kw, 0, { r: 0.004, material: keyMat() });
    at(space, -0.01, 0.026, -0.05 + 4 * (kw + gap));
    space.userData.baseY = 0.026;
    keys[' '] = space;
    g.add(space);
    const enter = rbox(0.05, 0.012, kw * 2 + gap, 0, { r: 0.004, material: mat(0xd67c9c) });
    at(enter, W / 2 - 0.035, 0.026, -0.05 + 1.5 * (kw + gap));
    enter.userData.baseY = 0.026;
    keys['ENTER'] = enter;
    g.add(enter);
    const back = rbox(0.05, 0.012, kw, 0, { r: 0.004, material: mat(0xcfd3dc) });
    at(back, W / 2 - 0.035, 0.026, -0.05);
    back.userData.baseY = 0.026;
    keys['BACKSPACE'] = back;
    g.add(back);
    // Buchstaben auf die Tasten (eine gemeinsame Textur über die Oberseite)
    g.userData = { size: new THREE.Vector3(W, 0.034, D), anchor: new THREE.Vector3(0, 0.012, -D / 2), keys };
    // Beschriftung als Overlay-Plane
    const tex = canvasTexture(1024, 350, (ctx, cw, ch) => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#3a3f4b';
        ctx.font = 'bold 34px Segoe UI, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sx = cw / W, sz = ch / D;
        for (const [ch_, k] of Object.entries(keys)) {
            if (ch_.length !== 1 || ch_ === ' ') continue;
            ctx.fillText(ch_, (k.position.x + W / 2) * sx, (k.position.z + D / 2) * sz);
        }
    });
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.y = 0.0326;
    lbl.userData.noRaycast = true;
    g.add(lbl);
    g.userData.label = lbl;
    return g;
}

// ---------------- Lautsprecher ----------------
export function makeSpeakers() {
    const g = new THREE.Group();
    g.add(at(rbox(0.24, 0.012, 0.1, 0x6b4f3a, { r: 0.004 }), 0, 0.006, 0));
    const cones = [];
    for (const sx of [-0.075, 0.075]) {
        const cab = rbox(0.085, 0.15, 0.085, 0x2f3340, { r: 0.01 });
        at(cab, sx, 0.012 + 0.075, 0);
        g.add(cab);
        const big = cyl(0.028, 0.028, 0.006, 0x15171c, 24);
        big.rotation.x = Math.PI / 2;
        at(big, sx, 0.06, 0.044);
        g.add(big);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a8f9c, { metalness: 0.4 }));
        dome.rotation.x = Math.PI / 2;
        at(dome, sx, 0.06, 0.046);
        g.add(dome);
        cones.push(dome);
        const tw = cyl(0.012, 0.012, 0.006, 0x15171c, 16);
        tw.rotation.x = Math.PI / 2;
        at(tw, sx, 0.125, 0.044);
        g.add(tw);
    }
    g.userData = { size: new THREE.Vector3(0.24, 0.165, 0.1), anchor: new THREE.Vector3(0, 0.03, -0.045), cones };
    return g;
}

// ---------------- Barcode-Scanner ----------------
export function makeScanner() {
    const g = new THREE.Group();
    const grip = rbox(0.035, 0.11, 0.045, 0x2b2e36, { r: 0.012 });
    at(grip, 0, 0.055, 0.02);
    grip.rotation.x = -0.25;
    g.add(grip);
    const head = rbox(0.06, 0.05, 0.12, 0xf0a020, { r: 0.015 });
    at(head, 0, 0.115, -0.015);
    g.add(head);
    const window_ = box(0.05, 0.035, 0.004, 0x441111, { emissive: 0x330000 });
    at(window_, 0, 0.115, -0.076);
    g.add(window_);
    const trigger = box(0.012, 0.025, 0.012, 0x15171c);
    at(trigger, 0, 0.08, -0.025);
    g.add(trigger);
    g.userData = {
        size: new THREE.Vector3(0.06, 0.14, 0.12),
        anchor: new THREE.Vector3(0, 0.01, 0.04),
        laserOrigin: new THREE.Vector3(0, 0.095, -0.07),
        windowMesh: window_,
    };
    return g;
}

export function makeBarcodeCard(code, color = '#ffffff') {
    const W = 0.11, D = 0.07;
    const tex = canvasTexture(440, 280, (ctx, cw, ch) => {
        ctx.fillStyle = color; ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = '#999'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, cw - 6, ch - 6);
        // Pseudo-Strichcode aus dem Text erzeugen (deterministisch)
        let seed = 0;
        for (const c of code) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
        let x = 40;
        ctx.fillStyle = '#111';
        while (x < cw - 40) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            const w = 3 + (seed >> 16) % 9;
            if ((seed >> 8) & 1) ctx.fillRect(x, 30, w, 170);
            x += w + 3;
        }
        ctx.fillRect(40, 30, 6, 185); ctx.fillRect(cw - 46, 30, 6, 185);
        ctx.font = 'bold 44px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(code, cw / 2, 255);
    });
    const g = new THREE.Group();
    const base = box(W, 0.004, D, 0xffffff);
    at(base, 0, 0.002, 0);
    g.add(base);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.0042;
    top.receiveShadow = true;
    g.add(top);
    g.userData = { size: new THREE.Vector3(W, 0.004, D) };
    return g;
}

// ---------------- MIDI-Keyboard ----------------
export const MIDI_NOTES = [
    { name: 'C', key: 'C', freq: 261.63, color: '#ff6b6b' },
    { name: 'D', key: 'D', freq: 293.66, color: '#ffa94d' },
    { name: 'E', key: 'E', freq: 329.63, color: '#ffd43b' },
    { name: 'F', key: 'F', freq: 349.23, color: '#69db7c' },
    { name: 'G', key: 'G', freq: 392.0, color: '#38d9a9' },
    { name: 'A', key: 'A', freq: 440.0, color: '#4dabf7' },
    { name: 'H', key: 'H', freq: 493.88, color: '#9775fa' },
    { name: "C'", key: 'K', freq: 523.25, color: '#f783ac' },
];

export function makeMidi() {
    const g = new THREE.Group();
    const W = 0.42, D = 0.15;
    g.add(at(rbox(W, 0.035, D, 0x22252d, { r: 0.008 }), 0, 0.0175, 0));
    const keys = [];
    const kw = 0.042;
    const x0 = -((MIDI_NOTES.length - 1) * kw) / 2;
    MIDI_NOTES.forEach((n, i) => {
        const k = rbox(kw - 0.003, 0.016, 0.1, 0, { r: 0.003, material: mat(0xfafafa) });
        at(k, x0 + i * kw, 0.04, 0.02);
        k.userData.note = i;
        k.userData.baseY = 0.04;
        g.add(k);
        keys.push(k);
        // farbiger Punkt + Notenname
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), new THREE.MeshBasicMaterial({ color: n.color }));
        dot.rotation.x = -Math.PI / 2;
        at(dot, 0, 0.0085, 0.035);
        dot.userData.noRaycast = true;
        k.add(dot);
    });
    // schwarze Tasten (Deko)
    [0, 1, 3, 4, 5].forEach(i => {
        const b = rbox(0.022, 0.016, 0.06, 0x111111, { r: 0.003 });
        at(b, x0 + i * kw + kw / 2, 0.052, -0.005);
        b.userData.decor = true;
        g.add(b);
    });
    // Drehregler
    for (let i = 0; i < 4; i++) {
        const k = cyl(0.009, 0.01, 0.014, 0xd67c9c, 14);
        at(k, -0.17 + i * 0.03, 0.042, -0.055);
        g.add(k);
    }
    const lbl = labelPlane(0.08, 0.02, 'MIDI', { fg: '#e092b0', font: 'bold 60px Segoe UI, sans-serif' });
    lbl.rotation.x = -Math.PI / 2;
    at(lbl, 0.13, 0.0355, -0.055);
    g.add(lbl);
    g.userData = { size: new THREE.Vector3(W, 0.05, D), anchor: new THREE.Vector3(0, 0.02, -D / 2), keys };
    return g;
}

// ---------------- Studiomikrofon ----------------
export function makeMic() {
    const g = new THREE.Group();
    g.add(at(cyl(0.06, 0.065, 0.014, 0x2b2e36, 28), 0, 0.007, 0));
    const pole = cyl(0.007, 0.007, 0.17, 0x9aa0ad, 12, { metalness: 0.6, roughness: 0.3 });
    at(pole, 0, 0.1, 0);
    g.add(pole);
    const head = new THREE.Group();
    const body = cyl(0.026, 0.022, 0.09, 0x30343e, 24, { metalness: 0.4 });
    head.add(body);
    const grill = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), mat(0xb8bec9, { metalness: 0.7, roughness: 0.35, wireframe: false }));
    grill.position.y = 0.055;
    grill.castShadow = true;
    head.add(grill);
    const ring = cyl(0.031, 0.031, 0.008, 0xd67c9c, 24);
    ring.position.y = 0.035;
    head.add(ring);
    head.position.set(0, 0.215, 0.01);
    head.rotation.x = 0.35;
    g.add(head);
    g.userData = { size: new THREE.Vector3(0.12, 0.3, 0.12), anchor: new THREE.Vector3(0, 0.012, -0.055), grill };
    return g;
}

// ---------------- Webcam ----------------
export function makeWebcam() {
    const g = new THREE.Group();
    g.add(at(rbox(0.05, 0.012, 0.05, 0x2b2e36, { r: 0.005 }), 0, 0.006, 0));
    g.add(at(cyl(0.006, 0.006, 0.03, 0x2b2e36, 10), 0, 0.027, 0));
    const body = rbox(0.1, 0.04, 0.04, 0x3a3f4b, { r: 0.016 });
    at(body, 0, 0.06, 0);
    g.add(body);
    const lens = cyl(0.014, 0.014, 0.008, 0x0a0c10, 20);
    lens.rotation.x = Math.PI / 2;
    at(lens, 0, 0.06, -0.022);
    g.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), mat(0x3355aa, { metalness: 0.8, roughness: 0.1, emissive: 0x111833 }));
    glass.rotation.y = Math.PI;
    at(glass, 0, 0.06, -0.0265);
    g.add(glass);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), mat(0x222222));
    at(led, 0.03, 0.068, -0.02);
    g.add(led);
    const cam = new THREE.PerspectiveCamera(62, 16 / 10, 0.02, 20);
    cam.position.set(0, 0.06, -0.03);
    g.add(cam);
    g.userData = { size: new THREE.Vector3(0.1, 0.08, 0.05), anchor: new THREE.Vector3(0, 0.06, 0.02), cam, led };
    return g;
}

// ---------------- Drucker ----------------
export function makePrinter() {
    const g = new THREE.Group();
    const W = 0.34, H = 0.15, D = 0.26;
    g.add(at(rbox(W, H, D, 0xe4e6ec, { r: 0.02 }), 0, H / 2, 0));
    const top = rbox(W - 0.03, 0.01, D - 0.06, 0xcfd3dc, { r: 0.004 });
    at(top, 0, H + 0.002, -0.01);
    g.add(top);
    const tray = box(0.22, 0.004, 0.12, 0xffffff);
    tray.rotation.x = 0.9;
    at(tray, 0, H + 0.03, -D / 2 + 0.01);
    g.add(tray);
    const slot = box(0.24, 0.012, 0.01, 0x1a1c22);
    at(slot, 0, 0.06, D / 2 + 0.002);
    g.add(slot);
    const panel = box(0.06, 0.03, 0.006, 0x2b2e36);
    at(panel, 0.11, 0.115, D / 2 + 0.002);
    g.add(panel);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mat(0x222222));
    at(led, 0.14, 0.115, D / 2 + 0.006);
    g.add(led);
    const lbl = labelPlane(0.1, 0.02, 'DRUCKER', { fg: '#6b7180', font: 'bold 44px Segoe UI, sans-serif' });
    at(lbl, -0.09, 0.115, D / 2 + 0.001);
    g.add(lbl);
    g.userData = { size: new THREE.Vector3(W, H, D), anchor: new THREE.Vector3(0.1, 0.03, -D / 2), slotPos: new THREE.Vector3(0, 0.06, D / 2), led };
    return g;
}

// ---------------- Touchscreen ----------------
export function makeTouchscreen(texture) {
    const g = new THREE.Group();
    g.add(at(rbox(0.2, 0.014, 0.12, 0x2b2e36, { r: 0.006 }), 0, 0.007, 0));
    const tilt = new THREE.Group();
    tilt.position.set(0, 0.03, -0.02);
    tilt.rotation.x = -0.32;
    const panel = rbox(0.34, 0.23, 0.016, 0x15171c, { r: 0.012 });
    panel.position.set(0, 0.115, 0);
    tilt.add(panel);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x050608, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), screenMat);
    screen.position.set(0, 0.115, 0.0085);
    tilt.add(screen);
    g.add(tilt);
    const lbl = labelPlane(0.12, 0.02, 'TOUCH', { fg: '#8890a0', font: 'bold 50px Segoe UI, sans-serif' });
    lbl.rotation.x = -Math.PI / 2;
    at(lbl, 0, 0.0145, 0.04);
    g.add(lbl);
    g.userData = { size: new THREE.Vector3(0.34, 0.26, 0.14), anchor: new THREE.Vector3(0, 0.01, -0.06), screen, screenMat, screenTexture: texture };
    return g;
}

// ---------------- Kleinkram ----------------
export function makeMug() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24, 1, true), mat(0xd67c9c, { side: THREE.DoubleSide }));
    c.castShadow = true;
    at(c, 0, 0.05, 0);
    g.add(c);
    g.add(at(cyl(0.036, 0.036, 0.004, 0xd67c9c, 24), 0, 0.002, 0));
    const coffee = cyl(0.037, 0.037, 0.004, 0x4a2c1a, 24);
    coffee.castShadow = false;
    at(coffee, 0, 0.085, 0);
    g.add(coffee);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 8, 16, Math.PI), mat(0xd67c9c));
    handle.rotation.z = -Math.PI / 2;
    at(handle, 0.04, 0.05, 0);
    handle.castShadow = true;
    g.add(handle);
    g.userData = { size: new THREE.Vector3(0.09, 0.1, 0.08) };
    return g;
}

export function makePlant() {
    const g = new THREE.Group();
    g.add(at(cyl(0.05, 0.04, 0.09, 0xc96f3b, 18), 0, 0.045, 0));
    g.add(at(cyl(0.046, 0.046, 0.006, 0x3d2a1c, 18), 0, 0.088, 0));
    const leafMat = mat(0x3fae5a);
    for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), leafMat);
        leaf.scale.set(0.5, 1.6, 0.25);
        const a = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.025, 0.14 + (i % 2) * 0.02, Math.sin(a) * 0.025);
        leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
        leaf.castShadow = true;
        g.add(leaf);
    }
    g.userData = { size: new THREE.Vector3(0.1, 0.2, 0.1) };
    return g;
}

export function makeDuck() {
    const g = new THREE.Group();
    const yellow = mat(0xffd43b);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.04, 18, 14), yellow);
    body.scale.set(1.2, 0.8, 1);
    body.position.y = 0.032;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), yellow);
    head.position.set(0, 0.07, 0.022);
    head.castShadow = true;
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.022, 10), mat(0xff8c1a));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.066, 0.05);
    g.add(beak);
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), mat(0x111111));
        eye.position.set(s * 0.011, 0.078, 0.042);
        g.add(eye);
    }
    g.userData = { size: new THREE.Vector3(0.1, 0.095, 0.08) };
    return g;
}

export function makePaper(texture) {
    const g = new THREE.Group();
    const base = box(0.2, 0.002, 0.14, 0xffffff);
    base.position.y = 0.001;
    g.add(base);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1125), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    img.rotation.x = -Math.PI / 2;
    img.position.set(0, 0.0022, -0.008);
    g.add(img);
    g.userData = { size: new THREE.Vector3(0.2, 0.003, 0.14) };
    return g;
}

// ---------------- Hand (Handschuh) ----------------
export function makeHand({ ghost = false } = {}) {
    const g = new THREE.Group();
    const glove = ghost
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, emissive: 0xd67c9c, emissiveIntensity: 0.6, depthWrite: false })
        : mat(0xffffff, { roughness: 0.55 });
    const cuffMat = ghost ? glove : mat(0xe9a3bd);
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.028, 0.08, 2, 0.012), glove);
    palm.castShadow = !ghost;
    g.add(palm);
    const fingers = [];
    const fx = [-0.027, -0.009, 0.009, 0.027];
    const fl = [0.036, 0.044, 0.042, 0.032];
    fx.forEach((x, i) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0, -0.038);
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, fl[i], 4, 8), glove);
        f.rotation.x = Math.PI / 2;
        f.position.z = -fl[i] / 2 - 0.004;
        f.castShadow = !ghost;
        pivot.add(f);
        g.add(pivot);
        fingers.push(pivot);
    });
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.036, -0.002, -0.005);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.03, 4, 8), glove);
    thumb.rotation.set(Math.PI / 2, 0, 0.9);
    thumb.position.set(-0.014, 0, -0.012);
    thumb.castShadow = !ghost;
    thumbPivot.add(thumb);
    g.add(thumbPivot);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.023, 0.02, 16), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.scale.set(1.25, 1, 0.55);
    cuff.position.z = 0.05;
    cuff.castShadow = !ghost;
    g.add(cuff);
    g.userData = { fingers, thumbPivot };
    g.scale.setScalar(1.55);
    return g;
}

export function setHandGrip(hand, amount) {
    // amount: 0 = offen, 1 = geschlossen
    const { fingers, thumbPivot } = hand.userData;
    fingers.forEach(f => { f.rotation.x = -amount * 1.25; });
    thumbPivot.rotation.y = -amount * 0.6;
    thumbPivot.rotation.x = -amount * 0.4;
}
