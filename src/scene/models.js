import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { drawEan } from '../game/products.js';

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
    // flacher, ovaler Sockel
    const base = cyl(1, 1, 0.009, 0x3a3f4b, 28);
    base.scale.set(0.0295, 1, 0.052);
    g.add(at(base, 0, 0.0045, 0));
    // Gehäuse: gestreckte Halbkugel
    const shellGeo = new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const shell = new THREE.Mesh(shellGeo, mat(0xd9dde6, { roughness: 0.45 }));
    shell.scale.set(0.031, 0.025, 0.054);
    at(shell, 0, 0.009, 0);
    shell.castShadow = true;
    g.add(shell);
    // zwei gleich große Tasten vorne (vorne = -z), Spalt in der Mitte
    const btnMat = mat(0xf2f4f8, { roughness: 0.4 });
    const gap = 0.07;
    const mkBtn = (phiStart) => {
        const geo = new THREE.SphereGeometry(1, 16, 10, phiStart, Math.PI / 2 - gap, 0, 1.15);
        const m = new THREE.Mesh(geo, btnMat);
        m.scale.set(0.0314, 0.0254, 0.0546);
        at(m, 0, 0.009, 0);
        m.castShadow = true;
        m.userData.baseY = 0.009;
        g.add(m);
        return m;
    };
    // x = -cos(phi)·sin(theta), z = sin(phi)·sin(theta) → vorne links: phi ∈ (3π/2, 2π)
    const leftBtn = mkBtn(1.5 * Math.PI + gap);
    const rightBtn = mkBtn(Math.PI);
    // Fugen: zwischen den Tasten und am hinteren Tastenrand
    const seamMat = mat(0x8a90a0);
    const arc = (fn) => new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => fn(-1.15 + (i / 8) * 2.3)));
    const seamA = new THREE.Mesh(new THREE.TubeGeometry(arc(t => new THREE.Vector3(-Math.sin(t) * 0.0318, 0.009 + Math.cos(t) * 0.0257, 0)), 16, 0.0007, 4), seamMat);
    const seamB = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 7 }, (_, i) => {
        const t = (i / 6) * 1.15;
        return new THREE.Vector3(0, 0.009 + Math.cos(t) * 0.0257, -Math.sin(t) * 0.0553);
    })), 12, 0.0008, 4), seamMat);
    g.add(seamA, seamB);
    // Mausrad im Spalt
    const wheel = cyl(0.0068, 0.0068, 0.006, 0x40444f, 16);
    wheel.rotation.z = Math.PI / 2;
    at(wheel, 0, 0.0305, -0.026);
    g.add(wheel);
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.0068, 0.0012, 4, 16), mat(0x6a7080));
    grip.rotation.y = Math.PI / 2;
    at(grip, 0, 0.0305, -0.026);
    g.add(grip);
    // kleines Logo hinten
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 16), new THREE.MeshBasicMaterial({ color: 0xd67c9c }));
    logo.rotation.x = -Math.PI / 2 + 0.35;
    at(logo, 0, 0.031, 0.022);
    logo.userData.noRaycast = true;
    g.add(logo);
    g.userData = { size: new THREE.Vector3(0.064, 0.036, 0.11), anchor: new THREE.Vector3(0, 0.012, -0.054), leftBtn, rightBtn };
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
    const H = 0.1, R = 0.041, Rb = 0.037;
    const print = canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#d67c9c'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c4688a'; ctx.fillRect(0, h - 14, w, 6); ctx.fillRect(0, 8, w, 6);
        // Aufdruck in der Mitte (u = 0.5) – wird nach vorne gedreht
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 46px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('EVA', w / 2 + 18, h / 2 + 2);
        ctx.fillStyle = '#ffe3ec';
        ctx.beginPath();
        const hx = w / 2 - 52, hy = h / 2 - 4;
        ctx.moveTo(hx, hy + 14);
        ctx.bezierCurveTo(hx - 26, hy - 4, hx - 10, hy - 22, hx, hy - 8);
        ctx.bezierCurveTo(hx + 10, hy - 22, hx + 26, hy - 4, hx, hy + 14);
        ctx.fill();
    });
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, Rb, H, 32, 1, true),
        new THREE.MeshStandardMaterial({ map: print, roughness: 0.35 }));
    outer.rotation.y = Math.PI; // Aufdruck nach vorne (+z)
    at(outer, 0, H / 2, 0);
    outer.castShadow = true;
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.004, Rb - 0.004, H - 0.006, 32, 1, true),
        mat(0xfbeef3, { side: THREE.BackSide, roughness: 0.3 }));
    at(inner, 0, H / 2 + 0.003, 0);
    g.add(inner);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.0022, 6, 32), mat(0xe9a3bd, { roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    at(rim, 0, H, 0);
    g.add(rim);
    g.add(at(cyl(Rb, Rb - 0.002, 0.007, 0xc4688a, 32), 0, 0.0035, 0));
    g.add(at(cyl(Rb - 0.004, Rb - 0.004, 0.002, 0xfbeef3, 24), 0, 0.007, 0));
    // Henkel
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(R - 0.004, 0.084, 0), new THREE.Vector3(R + 0.022, 0.082, 0),
        new THREE.Vector3(R + 0.031, 0.056, 0), new THREE.Vector3(R + 0.022, 0.026, 0),
        new THREE.Vector3(Rb - 0.003, 0.022, 0),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0062, 8, false), mat(0xd67c9c, { roughness: 0.35 }));
    handle.castShadow = true;
    g.add(handle);
    // Kaffee mit Schaumrand
    const foam = canvasTexture(128, 128, (ctx, w, h) => {
        const gr = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#3b2213'); gr.addColorStop(0.72, '#5a341c'); gr.addColorStop(0.86, '#b98a5e'); gr.addColorStop(1, '#d9b48a');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    });
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ map: foam, roughness: 0.15 }));
    coffee.rotation.x = -Math.PI / 2;
    coffee.userData.noRaycast = true;
    g.add(coffee);
    // Dampf
    const steamTex = canvasTexture(64, 64, (ctx, w, h) => {
        const gr = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    });
    const steam = [];
    for (let i = 0; i < 4; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
        s.scale.setScalar(0.03);
        s.userData.noRaycast = true;
        s.raycast = () => {}; // Sprites brauchen sonst eine Kamera beim Raycasten
        s.userData.phase = i / 4;
        g.add(s);
        steam.push(s);
    }
    g.userData = { size: new THREE.Vector3(0.09, H, 0.084), coffee, steam, fill: 1, rimY: H, innerR: R - 0.004, innerRb: Rb - 0.004 };
    setMugFill(g, 1);
    return g;
}

export function setMugFill(g, fill) {
    const u = g.userData;
    u.fill = fill;
    const y = 0.012 + fill * 0.074;
    const r = u.innerRb + (u.innerR - u.innerRb) * (y / u.rimY);
    u.coffee.position.set(0, y, 0);
    u.coffee.scale.setScalar(r);
    u.coffee.visible = fill > 0.02;
}

// Säule mit Rippen (für den Kaktus): Kapsel-Profil, gedreht, dann radial gewellt
function ribbedCapsule(r, h, ribs, color) {
    const pts = [];
    pts.push(new THREE.Vector2(0.0001, 0));
    pts.push(new THREE.Vector2(r * 0.92, 0));
    pts.push(new THREE.Vector2(r, h * 0.08));
    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI / 2;
        pts.push(new THREE.Vector2(Math.cos(a) * r + 0.0001, h - r + Math.sin(a) * r));
    }
    const geo = new THREE.LatheGeometry(pts, ribs * 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const a = Math.atan2(z, x);
        const k = 1 + 0.11 * Math.cos(a * ribs);
        p.setX(i, x * k); p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat(color, { roughness: 0.55 }));
    m.castShadow = true;
    return m;
}

function addSpines(group, r, h, ribs, y0 = 0) {
    const pos = [];
    for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * Math.PI * 2;
        for (let y = 0.012; y < h - r * 0.4; y += 0.016) {
            pos.push(Math.cos(a) * r * 1.13, y0 + y + (i % 2) * 0.008, Math.sin(a) * r * 1.13);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff4d6, size: 0.0045 }));
    pts.userData.noRaycast = true;
    pts.raycast = () => {}; // Punkte hätten sonst einen riesigen Trefferradius
    group.add(pts);
}

export function makeCactus() {
    const g = new THREE.Group();
    // Topf
    const pot = new THREE.Group();
    const terra = 0xc96f3b;
    pot.add(at(cyl(0.044, 0.035, 0.078, terra, 24), 0, 0.039, 0));
    pot.add(at(cyl(0.051, 0.049, 0.02, 0xd27a45, 24), 0, 0.083, 0));
    pot.add(at(cyl(0.0445, 0.0425, 0.01, 0xf3e3c8, 24), 0, 0.045, 0));
    pot.add(at(cyl(0.036, 0.034, 0.004, 0x9c5530, 24), 0, 0.002, 0));
    g.add(pot);
    // Erde + Kiesel
    g.add(at(cyl(0.046, 0.046, 0.006, 0x3d2a1c, 24), 0, 0.09, 0));
    const pebbleMat = mat(0xe8e2d6);
    for (let i = 0; i < 7; i++) {
        const peb = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 5), pebbleMat);
        const a = i * 2.3, rr = 0.03 + (i % 3) * 0.004;
        peb.position.set(Math.cos(a) * rr, 0.094, Math.sin(a) * rr);
        peb.scale.y = 0.6;
        g.add(peb);
    }
    // Kaktus
    const plant = new THREE.Group();
    const green = 0x3e9b4f;
    const body = ribbedCapsule(0.026, 0.15, 8, green);
    plant.add(body);
    addSpines(plant, 0.026, 0.15, 8);
    // Arme: kurzes Querstück + senkrechter Teil
    for (const [side, y, hh] of [[1, 0.055, 0.065], [-1, 0.085, 0.05]]) {
        const arm = new THREE.Group();
        const stub = ribbedCapsule(0.0135, 0.04, 6, green);
        stub.rotation.z = -side * Math.PI / 2;
        arm.add(stub);
        const up = ribbedCapsule(0.0135, hh, 6, green);
        up.position.set(side * 0.034, -0.002, 0);
        arm.add(up);
        const sp = new THREE.Group();
        addSpines(sp, 0.0135, hh, 6);
        sp.position.copy(up.position);
        arm.add(sp);
        arm.position.set(side * 0.012, y, 0);
        arm.rotation.y = side * 0.4;
        plant.add(arm);
    }
    // Blüte
    const flower = new THREE.Group();
    const petalMat = mat(0xff7fb0, { roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
        const pe = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), petalMat);
        const a = (i / 6) * Math.PI * 2;
        pe.scale.set(1, 0.45, 0.6);
        pe.position.set(Math.cos(a) * 0.008, 0, Math.sin(a) * 0.008);
        pe.rotation.y = -a;
        flower.add(pe);
    }
    flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), mat(0xffd43b)));
    flower.position.set(0.004, 0.152, 0);
    flower.rotation.z = -0.2;
    plant.add(flower);
    plant.position.y = 0.092;
    g.add(plant);
    g.userData = { size: new THREE.Vector3(0.11, 0.25, 0.104), pot, plant };
    return g;
}

// Scherbe eines Tontopfs (gebogenes Wandstück)
export function makeShard(color = 0xc96f3b) {
    const len = 0.5 + Math.random() * 0.7;
    const geo = new THREE.CylinderGeometry(0.044, 0.04, 0.02 + Math.random() * 0.025, 4, 1, true, 0, len);
    geo.translate(-Math.sin(len / 2) * 0.042, 0, -Math.cos(len / 2) * 0.042);
    const m = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide }));
    m.castShadow = true;
    m.userData.noRaycast = true;
    return m;
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
// Lokales Koordinatensystem: Finger zeigen nach -z, Handrücken nach +y, rechte Hand (Daumen bei -x).
// Verjüngtes Fingerglied von 0 bis -len entlang z; beide Enden sind Halbkugeln, die Basis-Kugel bildet das Gelenk.
function taperSegment(r0, r1, len) {
    const geo = new THREE.CapsuleGeometry(r0, len, 5, 12);
    geo.rotateX(-Math.PI / 2);          // Achse entlang z, Spitze bei -z
    geo.translate(0, 0, -len / 2);
    const p = geo.attributes.position;
    const k = r1 / r0;
    for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i);
        const t = THREE.MathUtils.clamp(-z / len, 0, 1);
        const s = 1 + (k - 1) * t;
        p.setX(i, p.getX(i) * s);
        p.setY(i, p.getY(i) * s * 0.92);  // leicht oval: Finger sind etwas flacher als breit
    }
    geo.computeVertexNormals();
    return geo;
}

function palmGeometry() {
    // Handumriss (x, s): s = vorwärts. Handgelenk schmaler, Knöchellinie breiter, alles gerundet.
    const sh = new THREE.Shape();
    sh.moveTo(-0.026, -0.046);
    sh.lineTo(0.024, -0.046);
    sh.quadraticCurveTo(0.033, -0.045, 0.036, -0.03);
    sh.quadraticCurveTo(0.041, 0.0, 0.039, 0.03);
    sh.quadraticCurveTo(0.036, 0.042, 0.022, 0.043);
    sh.quadraticCurveTo(0.0, 0.046, -0.024, 0.043);
    sh.quadraticCurveTo(-0.037, 0.041, -0.038, 0.028);
    sh.quadraticCurveTo(-0.04, 0.0, -0.036, -0.03);
    sh.quadraticCurveTo(-0.034, -0.045, -0.026, -0.046);
    const geo = new THREE.ExtrudeGeometry(sh, {
        depth: 0.004, bevelEnabled: true, bevelThickness: 0.0125, bevelSize: 0.0105, bevelSegments: 6, curveSegments: 10,
    });
    geo.rotateX(-Math.PI / 2);        // Umriss liegt jetzt in x/z, Dicke entlang y
    geo.translate(0, -0.002, 0);
    geo.scale(0.95, 1, 0.95);
    // gewölbter Handrücken, flachere Handinnenfläche
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        p.setY(i, y - 3.2 * x * x + (y > 0 ? 0.004 * (1 - Math.min(1, Math.abs(x) / 0.045)) : 0));
    }
    geo.computeVertexNormals();
    return geo;
}

const FINGERS = [
    // x, Länge der drei Glieder, Radius Basis → Spitze, Fächerung, Vorversatz der Knöchel
    { x: -0.0285, len: [0.031, 0.022, 0.018], r: [0.0094, 0.0085, 0.0077, 0.0069], fan: 0.08, z: -0.044 },
    { x: -0.0095, len: [0.034, 0.024, 0.019], r: [0.0096, 0.0087, 0.0079, 0.0071], fan: 0.015, z: -0.047 },
    { x: 0.0100, len: [0.032, 0.022, 0.018], r: [0.0092, 0.0083, 0.0076, 0.0068], fan: -0.05, z: -0.045 },
    { x: 0.0275, len: [0.025, 0.017, 0.015], r: [0.0083, 0.0076, 0.0069, 0.0062], fan: -0.13, z: -0.039 },
];

export function makeHand({ ghost = false } = {}) {
    const g = new THREE.Group();
    const glove = ghost
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, emissive: 0xd67c9c, emissiveIntensity: 0.6, depthWrite: false })
        : mat(0xf4f2f5, { roughness: 0.62 });
    const cuffMat = ghost ? glove : mat(0xe9a3bd, { roughness: 0.7 });
    const seamMat = ghost ? glove : mat(0xd9c7d2, { roughness: 0.7 });
    const add = (parent, mesh) => { mesh.castShadow = !ghost; parent.add(mesh); return mesh; };

    add(g, new THREE.Mesh(palmGeometry(), glove));

    // Finger: je drei Glieder an verschachtelten Gelenken
    const fingers = [];
    for (const f of FINGERS) {
        const knuckle = new THREE.Group();
        knuckle.rotation.order = 'YXZ';
        knuckle.position.set(f.x, 0.001 - 3.2 * f.x * f.x, f.z);
        knuckle.rotation.y = f.fan;
        g.add(knuckle);
        const joints = [knuckle];
        let parent = knuckle;
        f.len.forEach((len, i) => {
            add(parent, new THREE.Mesh(taperSegment(f.r[i], f.r[i + 1], len), glove));
            if (i < 2) {
                const j = new THREE.Group();
                j.position.z = -len;
                parent.add(j);
                joints.push(j);
                parent = j;
            }
        });
        fingers.push({ joints, fan: f.fan });
    }
    // Ankerpunkt an der Zeigefingerspitze (leicht unterhalb = Fingerkuppe)
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.003, -FINGERS[0].len[2] - FINGERS[0].r[3] * 0.85);
    fingers[0].joints[2].add(tip);

    // Daumen: Ballen + zwei Glieder
    const ball = add(g, new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glove));
    ball.scale.set(0.017, 0.013, 0.026);
    ball.position.set(-0.031, -0.006, 0.006);
    ball.rotation.y = 0.5;
    const thumbPivot = new THREE.Group();
    thumbPivot.rotation.order = 'YXZ';
    thumbPivot.position.set(-0.042, -0.006, -0.008);
    g.add(thumbPivot);
    add(thumbPivot, new THREE.Mesh(taperSegment(0.0118, 0.0106, 0.022), glove));
    const thumbJoint = new THREE.Group();
    thumbJoint.position.z = -0.022;
    thumbPivot.add(thumbJoint);
    add(thumbJoint, new THREE.Mesh(taperSegment(0.0106, 0.0092, 0.017), glove));

    // Ziernähte auf dem Handrücken (wie bei Comic-Handschuhen)
    if (!ghost) {
        for (const x of [-0.015, 0, 0.015]) {
            const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.0013, 0.036, 2, 6), seamMat);
            s.rotation.x = Math.PI / 2;
            s.position.set(x, 0.0215 - 3.2 * x * x + 0.004 * (1 - Math.abs(x) / 0.045) - 0.0012, 0.008);
            g.add(s);
        }
    }

    // Stulpe mit Rollrand
    const cuff = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.033, 0.024, 28), cuffMat));
    cuff.geometry.rotateX(Math.PI / 2);
    cuff.scale.set(1, 0.6, 1);
    cuff.position.set(0, 0.001, 0.058);
    const rim = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 10, 28), cuffMat));
    rim.scale.set(1, 0.6, 1);
    rim.position.set(0, 0.001, 0.07);
    g.scale.setScalar(1.3);

    g.userData = { fingers, thumbPivot, thumbJoint, tip };
    setHandGrip(g, 0);
    return g;
}

// grip: 0 = offen, 1 = Faust.  point: 0…1 = Zeigefinger gestreckt, übrige Finger eingerollt.
// press: kurzes Antippen mit dem Zeigefinger (0…1).
export function setHandGrip(hand, grip, point = 0, press = 0) {
    const { fingers, thumbPivot, thumbJoint } = hand.userData;
    fingers.forEach((f, i) => {
        let c = 0.1 + 0.9 * grip;                         // leichte Grundkrümmung wirkt natürlicher
        if (i === 0) c = c * (1 - point) + 0.02 * point + press * 0.18;
        else c = Math.max(c, 0.1 + 0.9 * point);
        const [a, b, d] = f.joints;
        a.rotation.x = -c * 1.45;
        b.rotation.x = -c * 1.6;
        d.rotation.x = -c * 1.05;
        a.rotation.y = f.fan * (1 - 0.6 * Math.max(grip, i === 0 ? 0 : point));
    });
    // Daumen legt sich beim Zeigen auf die eingerollten Finger, beim Greifen um den Gegenstand
    const p = point * (1 - grip);
    thumbPivot.rotation.y = 0.85 - 0.6 * grip - 1.15 * p;
    thumbPivot.rotation.x = -0.3 - 0.55 * grip - 0.25 * p;
    thumbJoint.rotation.x = -0.25 - 0.55 * grip - 0.35 * p;
}

// ---------------- Einkäufe (Scanner-Station) ----------------
function stdMat(tex, opts = {}) { return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, ...opts }); }

export function makeProduct(def) {
    const g = new THREE.Group();
    let size;
    if (def.model === 'bottle') {
        // PET-Flasche mit Etikett
        const pts = [[0.0001, 0], [0.028, 0], [0.032, 0.006], [0.032, 0.03], [0.029, 0.04], [0.032, 0.05], [0.032, 0.125],
            [0.028, 0.15], [0.016, 0.178], [0.012, 0.19], [0.012, 0.198]].map(([x, y]) => new THREE.Vector2(x, y));
        const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 24),
            new THREE.MeshStandardMaterial({ color: 0x3a0d06, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 }));
        bottle.castShadow = true;
        g.add(bottle);
        const tex = canvasTexture(512, 128, (ctx, w, h) => {
            ctx.fillStyle = '#d7262e'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(0, 92);
            for (let x = 0; x <= w; x += 8) ctx.lineTo(x, 92 + Math.sin(x / 40) * 10);
            ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = 'italic bold 58px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Cola', w * 0.25, 52);
            drawEan(ctx, def.ean, w * 0.56, 12, 190, 100);
        });
        const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0326, 0.0326, 0.066, 28, 1, true), stdMat(tex));
        label.rotation.y = -Math.PI * 0.62; // Strichcode zeigt grob zum Spieler
        at(label, 0, 0.088, 0);
        g.add(label);
        g.add(at(cyl(0.0135, 0.0135, 0.014, 0xd7262e, 16), 0, 0.2, 0));
        size = new THREE.Vector3(0.066, 0.207, 0.066);
    } else if (def.model === 'carton') {
        const W = 0.07, H = 0.15;
        const side = canvasTexture(256, 512, (ctx, w, h) => {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#2f7cf6'; ctx.fillRect(0, h - 120, w, 120);
            ctx.fillStyle = '#111';
            for (const [x, y, r] of [[60, 110, 28], [180, 80, 20], [150, 190, 34], [50, 250, 18]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0.4, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#2f7cf6'; ctx.font = 'bold 56px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MILCH', w / 2, 340);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Segoe UI, sans-serif'; ctx.fillText('frisch · 1 l', w / 2, h - 50);
        });
        const front = canvasTexture(256, 512, (ctx, w, h) => {
            ctx.drawImage(side.image, 0, 0);
            drawEan(ctx, def.ean, 20, 150, 216, 120);
        });
        const top = mat(0xf4f6fb);
        const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, W), [stdMat(side), stdMat(side), top, top, stdMat(front), stdMat(side)]);
        at(body, 0, H / 2, 0);
        body.castShadow = true;
        g.add(body);
        // Giebel
        const gable = new THREE.Group();
        const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, 0.028)]);
        for (const z of [-W / 2, W / 2]) {
            const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(0xf4f6fb, { side: THREE.DoubleSide }));
            m.position.set(0, H, z);
            gable.add(m);
        }
        for (const sx of [-1, 1]) {
            const slope = box(Math.hypot(W / 2, 0.028) + 0.002, 0.002, W, 0xe8ecf4);
            slope.position.set(sx * W / 4, H + 0.014, 0);
            slope.rotation.z = -sx * Math.atan2(0.028, W / 2);
            gable.add(slope);
        }
        gable.add(at(box(0.004, 0.012, W + 0.004, 0xe8ecf4), 0, H + 0.032, 0));
        g.add(gable);
        size = new THREE.Vector3(W, H + 0.035, W);
    } else if (def.model === 'bar') {
        const W = 0.16, H = 0.016, D = 0.075;
        const topTex = canvasTexture(512, 240, (ctx, w, h) => {
            ctx.fillStyle = '#6b3fa0'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px Segoe UI, sans-serif'; ctx.textBaseline = 'middle';
            ctx.fillText('SCHOKO', 26, 72);
            ctx.font = '30px Segoe UI, sans-serif'; ctx.fillText('Vollmilch · 100 g', 30, 135);
            ctx.fillStyle = '#4b2b14';
            for (let i = 0; i < 3; i++) { ctx.fillRect(30 + i * 52, 165, 44, 44); }
            drawEan(ctx, def.ean, 300, 120, 196, 108);
        });
        const side = mat(0x6b3fa0, { roughness: 0.35 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [side, side, stdMat(topTex, { roughness: 0.35 }), side, side, side]);
        at(bar, 0, H / 2, 0);
        bar.castShadow = true;
        g.add(bar);
        size = new THREE.Vector3(W, H, D);
    } else {
        // Saftpäckchen mit Strohhalm
        const W = 0.06, H = 0.1, D = 0.04;
        const tex = canvasTexture(256, 420, (ctx, w, h) => {
            ctx.fillStyle = '#ffd43b'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#2fae5f'; ctx.fillRect(0, 0, w, 70);
            ctx.fillStyle = '#e03131'; ctx.beginPath(); ctx.arc(w / 2, 150, 52, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2fae5f'; ctx.fillRect(w / 2 - 4, 88, 8, 22);
            ctx.fillStyle = '#7a4a12'; ctx.font = 'bold 40px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('APFEL', w / 2, 250);
            drawEan(ctx, def.ean, 22, 280, 212, 120);
        });
        const plain = mat(0xffd43b);
        const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [plain, plain, mat(0x2fae5f), plain, stdMat(tex), plain]);
        at(body, 0, H / 2, 0);
        body.castShadow = true;
        g.add(body);
        const straw = cyl(0.0025, 0.0025, 0.05, 0xff6fa8, 8);
        straw.rotation.z = 0.25;
        at(straw, 0.012, H + 0.02, 0);
        g.add(straw);
        size = new THREE.Vector3(W, H + 0.04, D);
    }
    g.userData.size = size;
    return g;
}
