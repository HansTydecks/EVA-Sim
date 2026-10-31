import * as THREE from 'three';
import * as M from './scene/models.js';
import { Plug, PORT_TYPES } from './interaction/cables.js';

const _e = new THREE.Euler();
const _v = new THREE.Vector3();

// Greifbares Objekt mit Physik (Gerät oder Gegenstand)
export class PhysItem {
    constructor(game, object, { name, mass = 0.5, kind = 'item', emoji = '', com = 1 } = {}) {
        this.game = game;
        this.object = object;
        this.name = name;
        this.emoji = emoji;
        this.kind = kind;
        this.held = false;
        this.sorted = false;
        this.locked = false;
        object.userData.interactable = this;
        const s = object.userData.size || new THREE.Vector3(0.1, 0.1, 0.1);
        this.half = new THREE.Vector3(s.x / 2, s.y / 2, s.z / 2);
        this.mass = mass;
        game.scene.add(object);
        this.body = game.physics.addDynamic(object, this.half, mass, { com });
        this.yaw = 0;
        this.liftY = 0.05;
    }

    tooltip() { return `${this.emoji} ${this.name}`.trim(); }
    canGrab() { return !this.sorted && !this.locked; }

    setPosition(p, yaw = null) {
        this.object.position.copy(p);
        if (yaw !== null) this.object.rotation.set(0, yaw, 0);
        this.game.physics.placeBody(this.body, this.object);
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
        this.body.wakeUp();
    }

    grab() {
        this.held = true;
        _e.setFromQuaternion(this.object.quaternion, 'YXZ');
        this.yaw = _e.y;
        this.game.physics.makeKinematic(this.body);
        this.game.audio.pickup();
    }

    rotateYaw(d) { this.yaw += d; }

    holdAt(point, normal) {
        const p = point.clone();
        if (normal.y > 0.5) {
            p.y += this.liftY;
        } else {
            p.addScaledVector(normal, Math.max(this.half.x, this.half.z) + 0.03);
            p.y -= this.half.y;
        }
        p.y = Math.max(p.y, 0.02);
        if (this.holdPivot) {
            // so halten, dass dieser Punkt (z. B. das Scanner-Fenster) über der Zielstelle liegt
            const off = new THREE.Vector3(this.holdPivot.x, 0, this.holdPivot.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            p.x -= off.x; p.z -= off.z;
        }
        this.constrain?.(p);
        this.object.position.copy(p);
        this.object.rotation.set(0, this.yaw, 0);
        this.game.physics.placeBody(this.body, this.object);
    }

    release(vel) {
        this.held = false;
        this.game.physics.makeDynamic(this.body);
        this.body.velocity.set(vel.x, vel.y, vel.z);
        this.body.angularVelocity.set(0, 0, 0);
        this.game.audio.drop();
    }

    topWorld(target = new THREE.Vector3()) {
        return target.copy(this.object.position).setY(this.object.position.y + this.half.y * 2);
    }

    update(dt = 1 / 60) {
        // Vom Tisch gefallen? Nach kurzer Zeit zurück auf den Tisch teleportieren.
        if (this.held || this.sorted || this.visible === false || this.locked || this.noRespawn) { this.floorT = 0; return; }
        const y = this.object.position.y;
        if (y < -0.5) { this.respawnToDesk(); return; }
        // Boden (y = 0) – die Kartonbank liegt bei 0.42, der Tisch bei 0.75
        if (y < 0.3) {
            this.floorT = (this.floorT || 0) + dt;
            if (this.floorT > 0.8) this.respawnToDesk();
        } else this.floorT = 0;
    }

    respawnToDesk() {
        this.floorT = 0;
        const g = this.game;
        const from = this.object.position.clone();
        const home = (this.home || new THREE.Vector3(-0.2, 0.75, 0.05)).clone();
        g.guide?.burst(from.setY(Math.max(from.y, 0) + 0.05), [0xffffff, 0xd67c9c, 0xffd43b], 14, 0.6);
        this.setPosition(home.clone().setY(home.y + 0.25), this.homeYaw ?? 0);
        g.guide?.burst(home.setY(home.y + 0.12), [0xffffff, 0xffd43b], 16, 0.7);
        g.audio.plop();
        this.onRespawn?.();
        g.emit('respawned', this);
    }
}

export const DEVICE_DEFS = {
    monitor: {
        gen: 'des Bildschirms', name: 'Bildschirm', emoji: '🖥️', cat: ['A'], port: 'hdmi', cable: 1.0, mass: 5,
        why: 'Der Bildschirm zeigt dir, was der Computer berechnet hat. Er gibt etwas AUS.',
    },
    tower: {
        gen: 'des Computers', name: 'Computer', emoji: '💻', cat: ['V'], port: null, mass: 8,
        why: 'Im Computer arbeitet der Prozessor. Er VERARBEITET alle Eingaben.',
    },
    mouse: {
        gen: 'der Maus', name: 'Maus', emoji: '🖱️', cat: ['E'], port: 'usb', cable: 0.95, mass: 0.15,
        why: 'Mit der Maus gibst du dem Computer Befehle. Das ist eine EINGABE.',
    },
    keyboard: {
        gen: 'der Tastatur', name: 'Tastatur', emoji: '⌨️', cat: ['E'], port: 'usb', cable: 1.1, mass: 0.8,
        why: 'Mit der Tastatur tippst du Buchstaben in den Computer. Das ist eine EINGABE.',
    },
    speakers: {
        gen: 'der Lautsprecher', name: 'Lautsprecher', emoji: '🔊', cat: ['A'], port: 'audio', cable: 1.7, mass: 1.2,
        why: 'Aus den Lautsprechern kommt der Ton, den der Computer erzeugt. Das ist eine AUSGABE.',
    },
    scanner: {
        gen: 'des Scanners', name: 'Barcode-Scanner', emoji: '🏷️', cat: ['E'], port: 'usb', cable: 1.6, mass: 0.3,
        why: 'Der Scanner liest Strichcodes und schickt sie in den Computer. Das ist eine EINGABE.',
    },
    midi: {
        gen: 'des MIDI-Keyboards', name: 'MIDI-Keyboard', emoji: '🎹', cat: ['E'], port: 'usb', cable: 1.6, mass: 1.0,
        why: 'Das MIDI-Keyboard schickt Noten an den Computer – den Ton machen erst die Lautsprecher. EINGABE!',
    },
    mic: {
        gen: 'des Mikrofons', name: 'Mikrofon', emoji: '🎤', cat: ['E'], port: 'mic', cable: 1.6, mass: 0.6,
        why: 'Das Mikrofon nimmt deine Stimme auf und gibt sie in den Computer. EINGABE!',
    },
    webcam: {
        gen: 'der Webcam', name: 'Webcam', emoji: '📷', cat: ['E'], port: 'usb', cable: 1.6, mass: 0.2,
        why: 'Die Webcam nimmt Bilder auf und schickt sie in den Computer. EINGABE!',
    },
    printer: {
        gen: 'des Druckers', name: 'Drucker', emoji: '🖨️', cat: ['A'], port: 'usb', cable: 1.8, mass: 3,
        why: 'Der Drucker bringt das Ergebnis aufs Papier. Das ist eine AUSGABE.',
    },
    touch: {
        gen: 'des Touchscreens', name: 'Touchscreen', emoji: '📱', cat: ['E', 'A'], port: 'usbc', cable: 1.7, mass: 1.2,
        why: 'Der Touchscreen zeigt Bilder (Ausgabe) und spürt deinen Finger (Eingabe).',
    },
};

const BUILDERS = {
    monitor: () => M.makeMonitor(),
    tower: () => M.makeTower(),
    mouse: () => M.makeMouse(),
    keyboard: () => M.makeKeyboard(),
    speakers: () => M.makeSpeakers(),
    scanner: () => M.makeScanner(),
    midi: () => M.makeMidi(),
    mic: () => M.makeMic(),
    webcam: () => M.makeWebcam(),
    printer: () => M.makePrinter(),
    touch: () => M.makeTouchscreen(),
};

export class Device extends PhysItem {
    constructor(game, id, { position, yaw = 0, isStatic = false } = {}) {
        const def = DEVICE_DEFS[id];
        const object = BUILDERS[id]();
        object.position.copy(position);
        object.rotation.y = yaw;
        // Geräte haben einen schweren Fuß: Schwerpunkt tief, damit sie nicht ständig umkippen
        super(game, object, { name: def.name, emoji: def.emoji, mass: def.mass, kind: 'device', com: 0.3 });
        this.id = id;
        this.def = def;
        this.home = position.clone();
        this.homeYaw = yaw;
        this.sortable = false;
        this.plug = def.port ? new Plug(game, this, def.port, def.cable) : null;
        this.isFixed = isStatic;
        if (isStatic) this.setFixed(true);
        this.clickHandler = null;
        this.visible = true;
        if (id === 'scanner') { this.holdPivot = object.userData.laserOrigin; this.liftY = 0.06; }
    }

    setFixed(fixed) {
        this.isFixed = fixed;
        if (fixed) {
            // kinematisch = bleibt stehen, andere Dinge prallen trotzdem ab
            this.game.physics.makeKinematic(this.body);
            this.locked = true;
        } else {
            this.locked = false;
            this.game.physics.makeDynamic(this.body);
        }
    }

    get plugged() { return !!(this.plug && this.plug.port); }

    anchorWorld(target = new THREE.Vector3()) {
        return this.object.localToWorld(target.copy(this.object.userData.anchor || _v.set(0, 0.02, 0)));
    }

    tooltip(hit) {
        const d = this.def;
        // Zeigt die Hand auf eine Buchse?
        let o = hit?.object;
        while (o && o !== this.object) {
            if (o.userData.port) {
                const p = o.userData.port;
                return `Buchse: ${PORT_TYPES[p.type].label}${p.plug ? ' – belegt (' + p.plug.device.def.name + ')' : ' – frei'}`;
            }
            o = o.parent;
        }
        if (this.sorted) return `${d.emoji} ${d.name} – einsortiert ✓`;
        let s = `${d.emoji} ${d.name}`;
        if (this.plug && !this.plug.hidden) s += this.plugged ? ' · eingesteckt ✓' : ' · nicht eingesteckt';
        if (this.sortable) s += ' · ab in den Karton!';
        else if (this.locked && this.id !== 'tower' && this.id !== 'monitor') s += '';
        return s;
    }

    canGrab() { return !this.sorted && !this.locked && this.visible; }

    click(hit) {
        return this.clickHandler ? this.clickHandler(hit) : false;
    }

    grab() {
        if (this.id === 'tower') {
            // Computer wird weggeräumt: alle Kabel ziehen
            for (const p of this.game.ports) if (p.plug) p.plug.hide();
        }
        if (this.sortable && this.plug && !this.plug.hidden) {
            this.plug.hide();
            this.game.audio.unplug();
            this.game.emit('unplugged', { device: this });
        }
        super.grab();
        this.game.emit('grab', { device: this });
    }

    constrain(p) {
        if (this.plugged && !this.sortable) {
            const port = this.plug.port.worldPos(new THREE.Vector3());
            const max = this.def.cable - 0.08;
            const a = p.clone(); a.y += 0.03;
            const d = a.distanceTo(port);
            if (d > max) {
                const np = a.sub(port).setLength(max).add(port);
                p.x = np.x; p.z = np.z;
                p.y = Math.max(np.y - 0.03, p.y - 0.2);
            }
        }
    }

    // Stecker neben das Gerät legen (Richtung Computer)
    placePlugNear(pos) {
        const tower = this.game.devices.tower.object.position;
        const dir = new THREE.Vector3(tower.x - pos.x, 0, tower.z - pos.z).normalize();
        const pp = pos.clone().addScaledVector(dir, Math.min(0.22, this.def.cable * 0.3));
        pp.z = Math.min(pp.z + 0.06, 0.3);
        pp.y = 0.75 + 0.013;
        this.plug.placeRest(pp, dir);
    }

    onRespawn() {
        if (this.plug && !this.plug.hidden && !this.plugged && !this.plug.held) this.placePlugNear(this.home);
    }

    spawn(pos, yaw = 0) {
        this.home = pos.clone();
        this.homeYaw = yaw;
        this.visible = true;
        this.object.visible = true;
        this.game.physics.makeDynamic(this.body);
        this.setPosition(pos.clone().setY(pos.y + 0.45), yaw);
        if (this.plug) {
            this.placePlugNear(pos);
            this.plug.object.visible = true;
            this.plug.cable.visible = true;
        }
        this.game.effects?.burst(pos.clone().setY(pos.y + 0.1));
        this.game.audio.plop();
        this.game.rig?.lookDesk();
    }

    hide() {
        this.visible = false;
        this.object.visible = false;
        this.game.physics.makeKinematic(this.body);
        this.body.position.set(0, -5, 0);
        this.object.position.set(0, -5, 0);
        if (this.plug) { this.plug.object.visible = false; this.plug.cable.visible = false; }
    }

    update(dt) {
        super.update(dt);
        if (this.plug && this.visible) {
            // loser Stecker auf dem Boden? Zurück neben das Gerät
            const pl = this.plug;
            if (!pl.hidden && !pl.held && !pl.port && pl.restPos.y < 0.3 && this.object.position.y > 0.5) {
                pl.floorT = (pl.floorT || 0) + dt;
                if (pl.floorT > 0.8) {
                    pl.floorT = 0;
                    this.game.guide?.burst(pl.restPos.clone().setY(0.05), [0xffffff], 8, 0.4);
                    this.placePlugNear(this.object.position);
                    this.game.audio.plop();
                }
            } else pl.floorT = 0;
            pl.update(dt);
        }
    }
}

export function createItem(game, kind, pos, yaw = 0) {
    const builders = {
        mug: [M.makeMug, 'Tasse', '☕', 0.3],
        cactus: [M.makeCactus, 'Kaktus', '🌵', 0.6],
        duck: [M.makeDuck, 'Quietscheente', '🦆', 0.15],
    };
    const [fn, name, emoji, mass] = builders[kind];
    const obj = fn();
    obj.position.copy(pos);
    obj.rotation.y = yaw;
    const it = new PhysItem(game, obj, { name, emoji, mass });
    it.home = pos.clone();
    it.homeYaw = yaw;
    it.id = kind;
    return it;
}
