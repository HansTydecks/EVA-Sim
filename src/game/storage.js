import * as THREE from 'three';
import { makeRadio, drawCdLabel, MIDI_NOTES } from '../scene/models.js';
import { PhysItem } from '../devices.js';
import { Port } from '../interaction/cables.js';
import { CANNON } from '../physics.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Alles rund um SPEICHER: Dateien, CD-Laufwerk, Brennen, Radio mit USB-Buchse, Stromausfall und CD-Frisbee.
export class Storage {
    constructor(game) {
        this.game = game;
        this.hdd = [];          // Dateien auf der Festplatte
        this.usb = [];          // Dateien auf dem USB-Stick
        this.photo = null;      // zuletzt gedrucktes Foto (Canvas) – kann auf CD gebrannt werden
        this.cdBurned = false;
        this.unsaved = '';      // nach dem Speichern dazugetippt (geht beim Stromausfall verloren)
        this.burnEnabled = false;
        this.burnT = 0;
        this.burnDur = 4;
        this.trayOpen = false;
        this.trayT = 0;          // 0 = zu, 1 = offen
        this.blackoutT = -1;
        this.blinks = [];
        this.radio = null;
        this.radioPort = null;
        this.radioPlayT = 0;
        this.radioNotesT = 0;

        const tower = game.devices.tower;
        this.tower = tower;
        this.tray = tower.object.userData.tray;
        this.tray.traverse(o => { if (o.isMesh && o.userData.eject && !this.ejectMesh) this.ejectMesh = o; });
        tower.clickable = hit => !tower.sortable && !!hit?.object?.userData?.drive;
        tower.clickHandler = hit => {
            if (tower.sortable || !hit?.object?.userData?.drive) return false;
            this.toggleTray();
            return true;
        };
        this.setupCd(game.devices.cd);

        game.on('plugged', ({ device, port }) => {
            if (device.id === 'usbstick' && port.owner === 'radio') this.radioPlay();
            if (device.id === 'hdd') this.blink(device, 0.6, 0x22aaff);
            if (device.id === 'usbstick' && !port.external) this.blink(device, 0.6, 0xff9933);
        });
        game.on('unplugged', ({ device, port }) => {
            if (device?.id === 'usbstick' && port?.owner === 'radio') this.radioStop();
        });
        game.on('booted', () => {
            if (this.blackoutT >= 0) {
                this.blackoutT = -1;
                game.computer.startApp('files', { open: 'hallo.txt', lost: this.unsaved });
                setTimeout(() => { game.flags.rebooted = true; }, 1200);
            }
        });
    }

    // ---------------------------------------------------------------- LEDs
    blink(device, dur, color) {
        const led = device.object.userData.led;
        if (led) this.blinks.push({ led, t: dur, color });
    }

    // ---------------------------------------------------------------- CD-Laufwerk
    toggleTray(open = !this.trayOpen) {
        if (this.burnT > 0) { this.game.hud.toast('🔥 Die CD wird gerade gebrannt …', '', 1.6); return; }
        if (open === this.trayOpen) return;
        this.trayOpen = open;
        this.game.audio.driveMotor();
        this.game.activity();
    }

    ejectWorld(target = new THREE.Vector3()) { return this.ejectMesh.getWorldPosition(target); }

    trayReady() { return this.trayOpen && this.trayT > 0.95; }

    cdSpotWorld(target = new THREE.Vector3()) {
        const ud = this.tower.object.userData;
        return this.tray.localToWorld(target.copy(ud.cdSpot));
    }

    setupCd(cd) {
        this.cd = cd;
        cd.inTray = false;
        cd.canGrabExtra = () => !cd.inTray || (this.trayReady() && this.burnT <= 0);
        cd.extraTip = () => (this.cdBurned ? ' mit deinem Foto' : ' (leerer Rohling)') + (cd.inTray ? (this.trayOpen ? ' · im Laufwerk' : ' · im Laufwerk (zu)') : '');
        cd.liftY = 0.03;
        cd.onHold = () => {
            cd.nearTray = false;
            if (!this.trayReady()) return;
            const spot = this.cdSpotWorld(_v);
            if (cd.object.position.distanceTo(spot) < 0.11) {
                cd.nearTray = true;
                cd.object.position.lerp(spot.setY(spot.y + 0.012), 0.7);
                this.tower.object.getWorldQuaternion(_q);
                cd.object.quaternion.copy(_q);
                this.game.physics.placeBody(cd.body, cd.object);
            }
        };
        cd.onReleaseHook = () => {
            if (!cd.nearTray || !this.trayReady()) return false;
            this.insertCd();
            return true;
        };
        this.game.on('handGrab', it => {
            if (it === cd && cd.inTray) { cd.inTray = false; this.game.emit('cdRemoved'); }
        });
        this.game.on('handRelease', it => {
            if (it !== cd || cd.inTray || cd.sorted) return;
            const v = cd.body.velocity;
            if (Math.hypot(v.x, v.z) > 1.0) {
                cd.flying = true;
                cd.body.angularVelocity.set(0, 22, 0);
                if (!this.frisbeeSaid) {
                    this.frisbeeSaid = true;
                    this.game.hud.toast('🥏 Frisbee!', 'good', 1.4);
                }
            }
        });
    }

    insertCd() {
        const cd = this.cd;
        cd.inTray = true;
        cd.nearTray = false;
        cd.flying = false;
        this.game.physics.makeKinematic(cd.body);
        this.placeCdInTray();
        this.game.audio.drop();
        this.game.emit('cdInserted');
        this.game.activity();
        // Schublade fährt von allein zu
        this.autoCloseT = 0.7;
    }

    placeCdInTray() {
        const cd = this.cd;
        this.cdSpotWorld(cd.object.position);
        this.tower.object.getWorldQuaternion(cd.object.quaternion);
        this.game.physics.placeBody(cd.body, cd.object);
    }

    get cdReady() { return this.cd.inTray && !this.trayOpen && this.trayT < 0.02; }

    // Wird von der Foto-App aufgerufen. Gibt eine Meldung zurück, falls es nicht geht.
    requestBurn() {
        if (this.burnT > 0) return 'Wird schon gebrannt …';
        if (!this.photo) return 'Mach zuerst ein Foto!';
        if (!this.cd.visible || !this.cd.inTray) return 'Leg zuerst eine CD ins Laufwerk!';
        if (this.cdBurned) return 'Die CD ist schon gebrannt!';
        if (this.trayOpen) { this.toggleTray(false); this.burnQueued = true; return null; }
        this.startBurn();
        return null;
    }

    startBurn() {
        this.burnQueued = false;
        this.burnT = this.burnDur;
        this.game.audio.burnHum(this.burnDur);
        this.game.activity();
    }

    finishBurn() {
        const cd = this.cd;
        const ud = cd.object.userData;
        drawCdLabel(ud.labelCanvas, this.photo);
        ud.labelTex.needsUpdate = true;
        this.cdBurned = true;
        this.autoCloseT = 0;
        this.game.flags.burned = true;
        this.game.audio.chime();
        this.game.hud.toast('💿 CD gebrannt!', 'good', 2);
        this.toggleTray(true);
        setTimeout(() => this.game.guide.burst(this.cdSpotWorld(new THREE.Vector3()).setY(this.cdSpotWorld(_v).y + 0.05), [0xffd43b, 0x4dabf7, 0xd67c9c, 0x69db7c], 26, 0.9), 600);
    }

    // ---------------------------------------------------------------- Radio
    spawnRadio(pos, yaw) {
        if (this.radio) return;
        const obj = makeRadio();
        obj.position.copy(pos);
        obj.rotation.y = yaw;
        const radio = new PhysItem(this.game, obj, { name: 'Radio', emoji: '📻', mass: 1.2 });
        radio.id = 'radio';
        radio.home = pos.clone();
        radio.homeYaw = yaw;
        radio.tooltip = () => `📻 Radio${this.radioPort?.plug ? ' · spielt dein Lied ♪' : ' · hat eine USB-Buchse'}`;
        radio.setPosition(pos.clone().setY(pos.y + 0.35), yaw);
        this.game.items.push(radio);
        this.game.itemsById.radio = radio;
        const ud = obj.userData;
        this.radioPort = new Port(obj, 'usb', ud.portPos.x, ud.portPos.y, ud.frontZ, { external: true, stickOnly: true, owner: 'radio' });
        this.game.ports.push(this.radioPort);
        this.radio = radio;
        this.game.guide.burst(pos.clone().setY(pos.y + 0.12));
        this.game.audio.plop();
    }

    removeRadio() {
        const r = this.radio;
        if (!r) return;
        if (this.radioPort.plug) {
            const stick = this.radioPort.plug.device;
            this.radioPort.plug.unplug(true);
            this.game.physics.makeDynamic(stick.body);
        }
        if (this.game.hand.held === r) return;
        this.radioStop();
        this.game.ports = this.game.ports.filter(p => p !== this.radioPort);
        this.game.physics.remove(r.body);
        this.game.scene.remove(r.object);
        this.game.items = this.game.items.filter(i => i !== r);
        delete this.game.itemsById.radio;
        this.game.guide.burst(r.object.position.clone().setY(r.object.position.y + 0.1), [0xffffff, 0xffd43b], 12, 0.6);
        this.radio = null;
        this.radioPort = null;
    }

    radioPlay() {
        const song = this.usb.find(f => f.notes);
        const g = this.game;
        if (!song) {
            g.audio.error();
            g.progression.interject('Stille … 🤫', 'Auf dem USB-Stick ist noch <b>kein Lied</b>. Steck ihn zuerst in den Computer und speichere dein Lied darauf!', 'thinking', 5);
            return;
        }
        let t = 0.35;
        for (let rep = 0; rep < 2; rep++) {
            for (const n of song.notes) {
                g.audio.radioNote(MIDI_NOTES[n.i].freq, Math.max(0.25, n.d * 0.9), t);
                t += n.d;
            }
            t += 0.4;
        }
        this.radioPlayT = t;
        g.flags.radio = true;
        g.hud.toast('📻 Das Radio spielt dein Lied!', 'good', 2.4);
        g.activity();
    }

    radioStop() { this.radioPlayT = 0; this.resetRadioLook(); }

    resetRadioLook() {
        if (!this.radio) return;
        const ud = this.radio.object.userData;
        ud.cones.forEach(c => c.scale.setScalar(1));
        ud.disp.material.color.setHex(0x0f2a2a);
    }

    // ---------------------------------------------------------------- Stromausfall
    blackout() {
        const g = this.game;
        this.blackoutT = 0;
        this.blackoutPhase = 0;
        g.audio.powerDown();
        g.audio.thud(2);
        g.computer.powerOff();
        g.computer.booted = false;
        g.devices.tower.object.userData.led.material.emissive.setHex(0x000000);
        g.hand.exitMouseMode();
    }

    // ---------------------------------------------------------------- Schleife
    update(dt, time) {
        const g = this.game;
        // Schublade (fährt nach dem Einlegen von allein zu)
        if (this.autoCloseT > 0) {
            this.autoCloseT -= dt;
            if (this.autoCloseT <= 0 && this.cd.inTray && !this.cd.held) this.toggleTray(false);
        }
        const target = this.trayOpen ? 1 : 0;
        if (this.trayT !== target) {
            this.trayT = THREE.MathUtils.clamp(this.trayT + (target > this.trayT ? dt : -dt) / 0.6, 0, 1);
            const e = this.trayT * this.trayT * (3 - 2 * this.trayT);
            this.tray.position.z = THREE.MathUtils.lerp(this.tray.userData.closedZ, this.tray.userData.openZ, e);
            if (this.trayT === 0 && this.burnQueued) this.startBurn();
        }
        // CD in der Schublade fährt mit
        const cd = this.cd;
        if (cd.inTray && !cd.held && cd.visible) {
            if (cd.body.type !== CANNON.Body.KINEMATIC) g.physics.makeKinematic(cd.body);
            this.placeCdInTray();
        }
        // CD-Frisbee: Auftrieb, solange sie schnell fliegt
        if (cd.flying) {
            const v = cd.body.velocity;
            const hs = Math.hypot(v.x, v.z);
            if (cd.held || cd.inTray || cd.sorted || hs < 0.35 || cd.object.position.y < 0.05) cd.flying = false;
            else {
                const m = cd.body.mass;
                cd.body.force.y += m * 9.82 * Math.min(0.88, hs / 2.6);
                cd.body.angularVelocity.x *= 0.9;
                cd.body.angularVelocity.z *= 0.9;
            }
        }
        // Brennen
        const dl = this.tower.object.userData.driveLed;
        if (this.burnT > 0) {
            this.burnT -= dt;
            dl.material.emissive.setHex(Math.sin(time * 18) > 0 ? 0xff5522 : 0x331100);
            if (this.burnT <= 0) { this.burnT = 0; this.finishBurn(); }
        } else if (this.trayT > 0 && this.trayT < 1) {
            dl.material.emissive.setHex(0x22ff55);
        } else dl.material.emissive.setHex(0x000000);
        // LEDs
        for (const b of this.blinks) {
            b.t -= dt;
            b.led.material.emissive.setHex(b.t > 0 && Math.sin(time * 30) > 0 ? b.color : 0x000000);
        }
        this.blinks = this.blinks.filter(b => b.t > 0);
        // Radio spielt
        if (this.radio && this.radioPlayT > 0) {
            this.radioPlayT -= dt;
            const ud = this.radio.object.userData;
            const s = 1 + Math.max(0, Math.sin(time * 26)) * 0.12;
            ud.cones.forEach(c => c.scale.setScalar(s));
            ud.disp.material.color.setHSL((time * 0.4) % 1, 0.8, 0.55);
            this.radioNotesT -= dt;
            if (this.radioNotesT <= 0) {
                this.radioNotesT = 0.45;
                const p = this.radio.object.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.16, 0.04));
                g.guide.burst(p, [0xffd43b, 0xd67c9c, 0x4dabf7], 5, 0.45);
            }
            if (this.radioPlayT <= 0) this.resetRadioLook();
        }
        // Stromausfall: Licht flackert, wird dunkel, kommt zurück – dann startet der Computer neu
        if (this.blackoutT >= 0 && this.blackoutPhase < 2) {
            this.blackoutT += dt;
            const t = this.blackoutT;
            let k;
            if (t < 0.5) k = Math.random() < 0.5 ? 0.2 : 0.9;
            else if (t < 1.7) k = 0.22;
            else if (t < 2.1) k = Math.random() < 0.5 ? 0.4 : 1;
            else k = 1;
            for (const l of g.room.lights) l.light.intensity = l.base * k;
            if (t >= 2.1 && this.blackoutPhase === 0) {
                this.blackoutPhase = 2;
                for (const l of g.room.lights) l.light.intensity = l.base;
                g.computer.powerOn();
            }
        }
    }
}
