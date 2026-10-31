import * as THREE from 'three';
import { BOX_SIZE } from '../scene/room.js';

const G = 9.82;

// Prüft, ob Geräte in einem Karton gelandet sind, und gibt Rückmeldung.
export class Sorter {
    constructor(game, boxes) {
        this.game = game;
        this.boxes = boxes;
        this.anims = [];
        this.cooldown = new Map();
    }

    inside(box, pos) {
        const l = box.group.worldToLocal(pos.clone());
        return Math.abs(l.x) < BOX_SIZE.w / 2 + 0.01 && Math.abs(l.z) < BOX_SIZE.d / 2 + 0.01 && l.y < BOX_SIZE.h + 0.06 && l.y > -0.06;
    }

    update(dt, time) {
        const g = this.game;
        const things = [...Object.values(g.devices), ...g.items];
        for (const it of things) {
            if (it.held || it.sorted || it.visible === false || it.isFixed) continue;
            if ((this.cooldown.get(it) || 0) > time) continue;
            const center = it.object.position.clone();
            center.y += it.half.y;
            for (const box of this.boxes) {
                if (this.inside(box, center)) { this.handle(it, box, time); break; }
            }
        }
        for (const b of this.boxes) {
            if (b.glowT > 0) {
                b.glowT -= dt;
                b.glow.material.opacity = Math.max(0, Math.sin(b.glowT * 10)) * 0.8 * Math.min(1, b.glowT);
                b.label.material.emissive.setHex(b.glowBad ? 0x551111 : 0x225522);
                b.label.material.emissiveIntensity = Math.max(0, b.glowT);
            }
        }
        for (const a of this.anims) {
            a.t = Math.min(1, a.t + dt / 0.7);
            const e = a.t * a.t * (3 - 2 * a.t);
            const p = a.from.clone().lerp(a.to, e);
            p.y += Math.sin(e * Math.PI) * 0.18;
            a.obj.position.copy(p);
            a.obj.scale.setScalar(THREE.MathUtils.lerp(1, a.scale, e));
            a.obj.quaternion.slerpQuaternions(a.q0, a.q1, e);
        }
        this.anims = this.anims.filter(a => a.t < 1);
    }

    handle(it, box, time) {
        const g = this.game;
        if (it.kind !== 'device') {
            this.reject(it, box, time, 'Das ist doch kein Computer-Gerät! 😄', `${it.name} gehört auf den Tisch, nicht in den Karton.`);
            return;
        }
        if (!it.sortable) {
            this.reject(it, box, time, `${it.def.name} brauchen wir noch!`, 'Benutze das Gerät zuerst. Wenn es fertig ist, sage ich dir Bescheid, dass es in einen Karton darf.');
            return;
        }
        if (it.def.cat.includes(box.cat)) this.accept(it, box);
        else this.reject(it, box, time, `Hmm, nicht ${box.name}…`, `${it.def.why}`, true);
    }

    accept(dev, box) {
        const g = this.game;
        if (dev.plug && !dev.plug.hidden) dev.plug.hide();
        g.physics.remove(dev.body);
        dev.sorted = true;
        dev.sortable = false;
        const i = box.contents.length;
        box.contents.push(dev);
        box.drawLabel();
        const col = i % 2, row = (i >> 1) % 2, layer = i >> 2;
        const local = new THREE.Vector3((col - 0.5) * 0.17, 0.02 + layer * 0.08, (row - 0.5) * 0.14);
        const to = box.group.localToWorld(local);
        const s = dev.object.userData.size;
        const scale = Math.min(1, 0.2 / Math.max(s.x, s.z), 0.16 / s.y);
        const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, box.group.rotation.y + (Math.random() - 0.5) * 0.4, 0));
        this.anims.push({ obj: dev.object, from: dev.object.position.clone(), to, scale, t: 0, q0: dev.object.quaternion.clone(), q1 });
        box.glowT = 1.5;
        box.glowBad = false;
        box.glow.material.color.setHex(box.hex);
        g.audio.chime();
        g.guide.burst(to.clone().setY(to.y + 0.25), [box.hex, 0xffd43b, 0xffffff], 26, 1.1);
        let extra = '';
        if (dev.id === 'touch') extra = box.cat === 'E' ? ' Er ist aber auch AUSGABE – er kann beides!' : ' Er ist aber auch EINGABE – er kann beides!';
        g.hud.toast(`✓ ${dev.def.name} → ${box.name}`, 'good', 2.2);
        g.progression.interject('Richtig! ✓', `${dev.def.why}${extra}`, 'happy', 4.5);
        g.emit('sorted', { device: dev, box });
    }

    reject(it, box, time, title, text, wrongBox = false) {
        const g = this.game;
        this.cooldown.set(it, time + 1.2);
        // Zurück auf den Tisch hüpfen lassen
        const from = it.object.position;
        const home = (it.home || new THREE.Vector3(-0.4, 0.75, 0.05)).clone();
        home.y = Math.max(home.y, 0.76) + 0.05;
        const T = 0.85;
        const v = new THREE.Vector3((home.x - from.x) / T, (home.y - from.y + 0.5 * G * T * T) / T, (home.z - from.z) / T);
        it.body.velocity.set(v.x, v.y, v.z);
        it.body.angularVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0);
        it.body.wakeUp();
        box.glowT = 1.2;
        box.glowBad = true;
        box.glow.material.color.setHex(0xe74c3c);
        g.audio.error();
        g.hud.toast(wrongBox ? '✗ Falscher Karton' : '↩ Zurück auf den Tisch', 'bad', 1.8);
        g.progression.interject(title, text, wrongBox ? 'sad' : 'thinking', 5.5);
        if (wrongBox) g.stats.wrong++;
    }
}
