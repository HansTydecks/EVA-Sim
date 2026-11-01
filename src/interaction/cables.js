import * as THREE from 'three';
import { mat, rbox, box, cyl } from '../scene/models.js';

export const PORT_TYPES = {
    hdmi: { color: 0xf4c430, css: '#f4c430', label: 'HDMI (gelb)', round: false, w: 0.06, h: 0.026 },
    usb: { color: 0x2f7cf6, css: '#2f7cf6', label: 'USB (blau)', round: false, w: 0.048, h: 0.024 },
    usbc: { color: 0x9b59b6, css: '#9b59b6', label: 'USB-C (lila)', round: false, w: 0.04, h: 0.02 },
    audio: { color: 0x2ecc71, css: '#2ecc71', label: 'Lautsprecher-Buchse (grün)', round: true, w: 0.03, h: 0.03 },
    mic: { color: 0xff6fa8, css: '#ff6fa8', label: 'Mikrofon-Buchse (rosa)', round: true, w: 0.03, h: 0.03 },
};

// Anordnung der Buchsen auf der Vorderseite des Computers (lokale Koordinaten des Towers)
export const PORT_LAYOUT = [
    ['hdmi', -0.046, 0.355], ['usbc', 0.046, 0.355],
    ['usb', -0.046, 0.295], ['usb', 0.046, 0.295],
    ['usb', -0.046, 0.235], ['usb', 0.046, 0.235],
    ['usb', -0.046, 0.175], ['usb', 0.046, 0.175],
    ['audio', -0.046, 0.115], ['mic', 0.046, 0.115],
];

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Port {
    // opts.external: Buchse an einem anderen Gerät (z. B. Radio), opts.stickOnly: nur für den USB-Stick
    constructor(tower, type, x, y, frontZ, opts = {}) {
        this.tower = tower;
        this.type = type;
        this.plug = null;
        this.external = !!opts.external;
        this.stickOnly = !!opts.stickOnly;
        this.owner = opts.owner || 'computer';
        const t = PORT_TYPES[type];
        this.local = new THREE.Vector3(x, y, frontZ);
        const g = new THREE.Group();
        g.position.copy(this.local);
        this.frameMat = mat(t.color, { emissive: t.color, emissiveIntensity: 0.15 });
        if (t.round) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(t.w * 0.42, 0.005, 8, 20), this.frameMat);
            g.add(ring);
            const hole = new THREE.Mesh(new THREE.CircleGeometry(t.w * 0.38, 20), new THREE.MeshBasicMaterial({ color: 0x050505 }));
            hole.position.z = 0.001;
            g.add(hole);
        } else {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.01, t.h + 0.01, 0.006), this.frameMat);
            g.add(frame);
            const hole = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.h), new THREE.MeshBasicMaterial({ color: 0x050505 }));
            hole.position.z = 0.0032;
            g.add(hole);
        }
        g.userData.port = this;
        this.mesh = g;
        tower.add(g);
        this.highlight = 'none';
    }

    worldPos(target = new THREE.Vector3()) {
        return this.mesh.getWorldPosition(target);
    }

    outward(target = new THREE.Vector3()) {
        this.tower.getWorldQuaternion(_q);
        return target.set(0, 0, 1).applyQuaternion(_q);
    }

    setHighlight(mode, time = 0) {
        // mode: none | good | bad | hint
        this.highlight = mode;
        const m = this.frameMat;
        if (mode === 'good') { m.emissive.setHex(0x44ff66); m.emissiveIntensity = 1.2; }
        else if (mode === 'bad') { m.emissive.setHex(0xff3333); m.emissiveIntensity = 1.2; }
        else if (mode === 'hint') { m.emissive.setHex(PORT_TYPES[this.type].color); m.emissiveIntensity = 0.5 + 0.5 * Math.sin(time * 8); }
        else { m.emissive.setHex(PORT_TYPES[this.type].color); m.emissiveIntensity = 0.15; }
    }
}

function makePlugMesh(type) {
    const t = PORT_TYPES[type];
    const g = new THREE.Group();
    // Spitze zeigt nach -z, Kabel geht hinten (+z) raus
    if (t.round) {
        const body = cyl(0.012, 0.012, 0.05, t.color, 16);
        body.rotation.x = Math.PI / 2;
        body.position.z = 0.03;
        g.add(body);
        const pin = cyl(0.0045, 0.0045, 0.028, 0xd8dbe2, 12, { metalness: 0.9, roughness: 0.25 });
        pin.rotation.x = Math.PI / 2;
        pin.position.z = -0.008;
        g.add(pin);
        for (const z of [-0.012, -0.002]) {
            const ring = cyl(0.0048, 0.0048, 0.0015, 0x333333, 12);
            ring.rotation.x = Math.PI / 2;
            ring.position.z = z;
            g.add(ring);
        }
    } else {
        const body = rbox(t.w + 0.008, t.h + 0.012, 0.05, t.color, { r: 0.006 });
        body.position.z = 0.03;
        g.add(body);
        const tip = box(t.w, t.h * 0.6, 0.022, 0xd8dbe2, { metalness: 0.9, roughness: 0.25 });
        tip.position.z = -0.006;
        g.add(tip);
    }
    const boot = cyl(0.007, 0.01, 0.02, 0x222222, 10);
    boot.rotation.x = Math.PI / 2;
    boot.position.z = 0.062;
    g.add(boot);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return g;
}

// Stecker mit Kabel, gehört zu einem Gerät
export class Plug {
    constructor(game, device, type, cableLen) {
        this.game = game;
        this.device = device;
        this.type = type;
        this.cableLen = cableLen;
        this.port = null;
        this.held = false;
        this.hidden = false;
        this.kind = 'plug';
        this.object = makePlugMesh(type);
        this.object.userData.interactable = this;
        game.scene.add(this.object);
        this.restPos = new THREE.Vector3();
        this.restDir = new THREE.Vector3(1, 0, 0);

        this.cableMat = mat(0x2a2d35, { roughness: 0.7 });
        this.cable = new THREE.Mesh(new THREE.BufferGeometry(), this.cableMat);
        this.cable.castShadow = true;
        this.cable.userData.noRaycast = true;
        game.scene.add(this.cable);
        this.lastKey = '';
        this.hoverPort = null;
    }

    get name() { return `Stecker: ${PORT_TYPES[this.type].label}`; }

    tooltip() {
        if (this.port) return `${this.device.def.name}-Kabel (eingesteckt ✓)`;
        return `${this.device.def.name}-Stecker · ${PORT_TYPES[this.type].label}`;
    }

    canGrab() { return !this.hidden && !this.device.sorted && !this.port; }

    tailWorld(target = new THREE.Vector3()) {
        return this.object.localToWorld(target.set(0, 0, 0.07));
    }

    placeRest(pos, dir) {
        this.restPos.copy(pos);
        if (dir) this.restDir.copy(dir).setY(0).normalize();
        this.applyRest();
    }

    applyRest() {
        this.object.position.copy(this.restPos);
        // restDir zeigt vom Gerät weg -> Kabelseite (+z) zeigt zum Gerät
        _v.copy(this.restPos).sub(this.restDir);
        this.object.lookAt(_v);
    }

    grab() {
        this.held = true;
        this.game.audio.pickup();
    }

    // Wird von der Hand jedes Frame aufgerufen
    holdAt(point, normal) {
        const anchor = this.device.anchorWorld(_v.clone());
        const pos = point.clone().addScaledVector(normal, 0.045);
        if (normal.y > 0.7) pos.y += 0.02;
        // Kabellänge begrenzen
        const d = pos.distanceTo(anchor);
        if (d > this.cableLen) pos.sub(anchor).setLength(this.cableLen).add(anchor);

        // Nächste Buchse suchen
        let best = null, bestD = 0.09;
        for (const p of this.game.ports) {
            if (p.stickOnly || !p.mesh.visible) continue;
            const pp = p.worldPos(new THREE.Vector3()).addScaledVector(p.outward(new THREE.Vector3()), 0.03);
            const dd = pp.distanceTo(pos);
            if (dd < bestD) { bestD = dd; best = p; }
        }
        for (const p of this.game.ports) if (p.highlight === 'good' || p.highlight === 'bad') p.setHighlight('none');
        this.hoverPort = best;
        const out = this.game.ports[0].outward(new THREE.Vector3());
        if (best) {
            const ok = best.type === this.type && !best.plug;
            best.setHighlight(ok ? 'good' : 'bad');
            if (ok) {
                // magnetisch zur Buchse ziehen
                const target = best.worldPos(new THREE.Vector3()).addScaledVector(out, 0.05);
                pos.lerp(target, 0.6);
            }
        }
        this.object.position.copy(pos);
        // Spitze zeigt in Richtung Computer
        this.object.lookAt(_v.copy(pos).add(out));
    }

    release() {
        this.held = false;
        const p = this.hoverPort;
        for (const port of this.game.ports) if (port.highlight === 'good' || port.highlight === 'bad') port.setHighlight('none');
        this.hoverPort = null;
        if (p) {
            if (p.type === this.type && !p.plug) {
                this.plugInto(p);
                return;
            }
            this.game.audio.error();
            this.game.emit('wrongPort', { plug: this, port: p });
        }
        // auf den Tisch fallen lassen
        const ground = this.game.groundAt(this.object.position, this);
        const dir = new THREE.Vector3().subVectors(this.object.position, this.device.anchorWorld(new THREE.Vector3()));
        this.placeRest(new THREE.Vector3(this.object.position.x, ground + 0.013, this.object.position.z), dir.lengthSq() > 1e-4 ? dir : null);
        this.game.audio.drop();
    }

    plugInto(port, silent = false) {
        this.port = port;
        port.plug = this;
        this.followPort();
        if (!silent) this.game.audio.plugIn();
        this.game.emit('plugged', { plug: this, device: this.device, port });
    }

    unplug(silent = false) {
        if (!this.port) return;
        const port = this.port;
        port.plug = null;
        this.port = null;
        if (!silent) this.game.audio.unplug();
        this.game.emit('unplugged', { plug: this, device: this.device, port });
    }

    followPort() {
        const out = this.port.outward(new THREE.Vector3());
        const pos = this.port.worldPos(new THREE.Vector3()).addScaledVector(out, 0.018);
        this.object.position.copy(pos);
        this.object.lookAt(_v.copy(pos).add(out));
    }

    hide() {
        this.unplug(true);
        this.hidden = true;
        this.object.visible = false;
        this.cable.visible = false;
    }

    update() {
        if (this.hidden) return;
        if (this.port) {
            this.followPort();
        } else if (!this.held) {
            // Wenn das Gerät weggezogen wird, kommt der Stecker hinterher
            const anchor = this.device.anchorWorld(new THREE.Vector3());
            const d = this.restPos.distanceTo(anchor);
            if (d > this.cableLen * 0.98) {
                const np = this.restPos.clone().sub(anchor).setLength(this.cableLen * 0.95).add(anchor);
                np.y = this.game.groundAt(np, this) + 0.013;
                this.placeRest(np, new THREE.Vector3().subVectors(np, anchor));
            }
        }
        this.updateCable();
    }

    updateCable() {
        const a = this.device.anchorWorld(new THREE.Vector3());
        const b = this.tailWorld(new THREE.Vector3());
        const key = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}|${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
        if (key === this.lastKey) return;
        this.lastKey = key;
        const dist = a.distanceTo(b);
        const slack = Math.max(0, this.cableLen - dist);
        const sag = Math.min(0.25, 0.04 + slack * 0.45);
        const back = this.object.localToWorld(new THREE.Vector3(0, 0, 0.13));
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= sag;
        const floorY = Math.min(a.y, b.y) - 0.005;
        const minY = Math.max(0.01, this.game.groundAt(mid, this, true) + 0.006);
        mid.y = Math.max(mid.y, Math.min(minY, floorY));
        const a2 = a.clone(); a2.y -= 0.01;
        const pts = [a, a2, mid, back, b];
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const geo = new THREE.TubeGeometry(curve, 36, 0.0055, 6, false);
        this.cable.geometry.dispose();
        this.cable.geometry = geo;
    }
}

// USB-Stick: Das Gerät IST der Stecker (kein Kabel). Passt in jede freie blaue USB-Buchse –
// am Computer und am Radio. Die Hand hält das Gerät selbst; diese Klasse kümmert sich ums Einstecken.
export class StickPlug {
    constructor(game, device) {
        this.game = game;
        this.device = device;
        this.type = 'usb';
        this.port = null;
        this.held = false;
        this.hidden = false;
        this.kind = 'plug';
        this.isStick = true;
        this.object = device.object;
        this.cable = { visible: false };
        this.restPos = new THREE.Vector3();
        this.cableLen = 99;
        this.hoverPort = null;
    }

    placeRest() {}
    applyRest() {}

    // Wird aufgerufen, während die Hand den Stick hält: nächste Buchse suchen und magnetisch hinziehen
    hover(pos) {
        let best = null, bestD = 0.1;
        for (const p of this.game.ports) {
            if (!p.mesh.visible) continue;
            const pp = p.worldPos(new THREE.Vector3()).addScaledVector(p.outward(new THREE.Vector3()), 0.04);
            const dd = pp.distanceTo(pos);
            if (dd < bestD) { bestD = dd; best = p; }
        }
        for (const p of this.game.ports) if (p.highlight === 'good' || p.highlight === 'bad') p.setHighlight('none');
        this.hoverPort = best;
        if (!best) return false;
        const ok = best.type === 'usb' && !best.plug;
        best.setHighlight(ok ? 'good' : 'bad');
        if (ok) {
            // Stick vor der Buchse ausrichten (Stecker zeigt hinein)
            const out = best.outward(new THREE.Vector3());
            const target = this.seatPos(best, 0.035);
            const o = this.object;
            o.position.lerp(target, 0.75);
            o.lookAt(_v.copy(o.position).add(out));
            return true;
        }
        return false;
    }

    seatPos(port, extra = 0) {
        const out = port.outward(new THREE.Vector3());
        const tipZ = -(this.object.userData.tipZ ?? -0.035);
        const h = this.object.userData.size.y / 2;
        return port.worldPos(new THREE.Vector3()).addScaledVector(out, tipZ - 0.011 + extra).add(_v.set(0, -h, 0));
    }

    releaseInto() {
        const p = this.hoverPort;
        for (const port of this.game.ports) if (port.highlight === 'good' || port.highlight === 'bad') port.setHighlight('none');
        this.hoverPort = null;
        if (!p) return false;
        if (p.type === 'usb' && !p.plug) { this.plugInto(p); return true; }
        this.game.audio.error();
        this.game.emit('wrongPort', { plug: this, port: p });
        return false;
    }

    plugInto(port, silent = false) {
        this.port = port;
        port.plug = this;
        this.game.physics.makeKinematic(this.device.body);
        this.followPort();
        if (!silent) this.game.audio.plugIn();
        this.game.emit('plugged', { plug: this, device: this.device, port });
    }

    unplug(silent = false) {
        if (!this.port) return;
        const port = this.port;
        port.plug = null;
        this.port = null;
        if (!silent) this.game.audio.unplug();
        this.game.emit('unplugged', { plug: this, device: this.device, port });
    }

    followPort() {
        const o = this.object;
        o.position.copy(this.seatPos(this.port));
        o.lookAt(_v.copy(o.position).add(this.port.outward(new THREE.Vector3())));
        this.game.physics.placeBody(this.device.body, o);
    }

    hide() { this.unplug(true); }

    update() {
        if (this.port && !this.device.held) this.followPort();
    }
}
