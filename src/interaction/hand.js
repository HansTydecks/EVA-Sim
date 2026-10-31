import * as THREE from 'three';
import { makeHand, setHandGrip } from '../scene/models.js';

// ?nolock in der URL: Maus-Modus ohne Pointer-Lock (z. B. wenn der Browser ihn blockiert)
const NO_LOCK = new URLSearchParams(location.search).has('nolock');
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
const _tip = new THREE.Vector3();

// Die echte Maus steuert eine 3D-Hand ("Greifhand").
// Linke Taste halten = greifen, loslassen = ablegen/werfen. Auf eingesteckte Geräte klicken = benutzen.
export class HandController {
    constructor(game) {
        this.game = game;
        this.dom = game.renderer.domElement;
        this.hand = makeHand();
        game.scene.add(this.hand);
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2(0, -0.2);
        this.pointer = { x: innerWidth / 2, y: innerHeight * 0.6, inside: false };
        this.point = new THREE.Vector3(0, 0.75, 0.1);   // geglätteter Zielpunkt auf einer Oberfläche
        this.pointTarget = this.point.clone();
        this.normal = new THREE.Vector3(0, 1, 0);
        this.normalTarget = this.normal.clone();
        this.held = null;
        this.hovered = null;
        this.hoverHit = null;
        this.pressed = null;   // Objekt, das gerade "geklickt" (nicht gegriffen) wird, z.B. Touchscreen
        this.grip = 0;
        this.pointAmt = 1;
        this.tilt = -0.3;
        this.anchorBlend = 1;
        this.yawOff = 0.85;
        this.mouseMode = false;
        this.pad = { u: 0, v: 0 };
        this.hist = [];
        this.enabled = false;
        this.highlighted = [];

        // Zielmarkierung auf der Oberfläche (hilft beim Einschätzen der Tiefe)
        this.marker = new THREE.Mesh(
            new THREE.RingGeometry(0.011, 0.016, 28),
            new THREE.MeshBasicMaterial({ color: 0xd67c9c, transparent: true, opacity: 0.85, depthWrite: false }),
        );
        this.marker.renderOrder = 5;
        game.scene.add(this.marker);

        const d = this.dom;
        d.addEventListener('pointermove', e => { if (!this.mouseMode) this.onMove(e); });
        d.addEventListener('pointerdown', e => { if (!this.mouseMode) this.onDown(e); });
        // Im Maus-Modus fensterweit hören, damit HUD-Elemente keine Klicks/Bewegungen schlucken
        window.addEventListener('pointermove', e => { if (this.mouseMode) this.onMove(e); });
        window.addEventListener('pointerdown', e => { if (this.mouseMode) { e.preventDefault(); this.onDown(e); } }, true);
        window.addEventListener('pointerup', e => this.onUp(e));
        // Zeigerposition fensterweit verfolgen: über HUD-Knöpfen wird nicht geschwenkt
        window.addEventListener('pointermove', e => {
            this.pointer.inside = e.target === d;
            if (!this.mouseMode) { this.pointer.x = e.clientX; this.pointer.y = e.clientY; }
        });
        d.addEventListener('pointerleave', () => { this.pointer.inside = false; });
        d.addEventListener('contextmenu', e => e.preventDefault());
        d.addEventListener('wheel', e => this.onWheel(e), { passive: false });
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.mouseMode) this.exitMouseMode();
        });
    }

    onMove(e) {
        if (this.mouseMode) {
            const k = 1 / 380;
            // einzelne Ausreißer (kommen bei Pointer-Lock manchmal vor) abfangen
            if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200) return;
            this.pad.u = THREE.MathUtils.clamp(this.pad.u + e.movementX * k * 2, -1, 1);
            this.pad.v = THREE.MathUtils.clamp(this.pad.v + e.movementY * k * 2.6, -1, 1);
            if (!document.pointerLockElement) {
                // ohne Pointer-Lock: absolute Position nutzen
                this.pad.u = THREE.MathUtils.clamp((e.clientX / innerWidth) * 2.4 - 1.2, -1, 1);
                this.pad.v = THREE.MathUtils.clamp((e.clientY / innerHeight) * 2.4 - 1.2, -1, 1);
            }
            return;
        }
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    }

    onDown(e) {
        if (!this.enabled) return;
        this.game.audio.init();
        this.game.activity();
        if (this.mouseMode) {
            if (e.button === 2) { this.exitMouseMode(); return; }
            if (e.button === 0) {
                this.game.audio.mouseClick();
                this.clickAnim = 0.15;
                this.game.computer.click();
            }
            return;
        }
        if (e.button !== 0) return;
        const it = this.hovered;
        if (!it) return;
        if (it.click && it.click(this.hoverHit)) {
            this.pressed = it.pressHandler || null;
            this.clickAnim = 0.15;
            return;
        }
        if (it.canGrab && it.canGrab()) {
            this.held = it;
            this.hist = [];
            it.grab();
            this.setHighlight(null);
            this.game.emit('handGrab', it);
        } else if (it.kind === 'device' || it.kind === 'item') {
            this.game.emit('cannotGrab', it);
        }
    }

    onUp(e) {
        if (e.button !== 0) return;
        if (this.pressed) { this.pressed.up?.(); this.pressed = null; }
        if (!this.held) return;
        const it = this.held;
        this.held = null;
        const vel = this.velocity();
        it.release(vel);
        this.game.activity();
        this.game.emit('handRelease', it);
    }

    onWheel(e) {
        e.preventDefault();
        if (!this.enabled) return;
        const d = Math.sign(e.deltaY);
        if (this.held && this.held.rotateYaw) { this.held.rotateYaw(d * 0.22); return; }
        this.game.emit('wheel', d);
    }

    velocity() {
        const h = this.hist;
        if (h.length < 2) return new THREE.Vector3();
        const a = h[0], b = h[h.length - 1];
        const dt = Math.max(0.016, b.t - a.t);
        const v = b.p.clone().sub(a.p).divideScalar(dt);
        if (v.length() > 3.5) v.setLength(3.5);
        return v.multiplyScalar(0.85);
    }

    enterMouseMode() {
        if (this.mouseMode) return;
        this.mouseMode = true;
        this.setHighlight(null);
        this.pad.u = (this.game.computer.cursor.x / 1024) * 2 - 1;
        this.pad.v = (this.game.computer.cursor.y / 640) * 2 - 1;
        if (!NO_LOCK) {
            try { this.dom.requestPointerLock?.()?.catch?.(() => {}); } catch (_) { /* ohne Pointer-Lock geht es auch */ }
        }
        this.game.physics.makeKinematic(this.game.devices.mouse.body);
        this.game.emit('mouseMode', true);
    }

    exitMouseMode() {
        if (!this.mouseMode) return;
        this.mouseMode = false;
        if (document.pointerLockElement) document.exitPointerLock();
        const m = this.game.devices.mouse;
        this.game.physics.makeDynamic(m.body);
        this.game.emit('mouseMode', false);
    }

    setHighlight(it) {
        if (this.highlighted.length) {
            for (const m of this.highlighted) {
                if (m.material && m.userData._origEm !== undefined) {
                    m.material.emissive.setHex(m.userData._origEm);
                    m.material.emissiveIntensity = m.userData._origEmI;
                }
            }
            this.highlighted = [];
        }
        if (!it) return;
        it.object.traverse(o => {
            if (!o.isMesh || !o.material || !o.material.emissive || o.userData.noHighlight) return;
            if (o.material.emissive.getHex() !== 0 && o.userData._origEm === undefined) return; // LEDs nicht anfassen
            if (o.userData._origEm === undefined) { o.userData._origEm = o.material.emissive.getHex(); o.userData._origEmI = o.material.emissiveIntensity; }
            o.material.emissive.setHex(0x5a2a44);
            o.material.emissiveIntensity = 1;
            this.highlighted.push(o);
        });
    }

    raycast() {
        this.raycaster.setFromCamera(this.ndc, this.game.camera);
        const hits = this.raycaster.intersectObjects(this.game.raycastRoots(), true);
        const held = this.held?.object;
        for (const h of hits) {
            const o = h.object;
            if (!o.visible || o.userData.noRaycast) continue;
            if (held && isDescendant(o, held)) continue;
            if (!isVisibleChain(o)) continue;
            return h;
        }
        return null;
    }

    update(dt, time) {
        const g = this.game;
        let targetGrip = 0;
        if (this.mouseMode) {
            const m = g.devices.mouse;
            const pad = g.mousePad;
            const p = pad.center.clone();
            p.x += this.pad.u * pad.hx;
            p.z += this.pad.v * pad.hz;
            m.object.position.copy(p);
            m.object.rotation.set(0, 0, 0);
            g.physics.placeBody(m.body, m.object);
            g.computer.setCursorNorm((this.pad.u + 1) / 2, (this.pad.v + 1) / 2);
            this.pointTarget.set(p.x, p.y + 0.035, p.z + 0.01);
            this.normalTarget.set(0, 1, 0);
            targetGrip = 0.35;
            this.hovered = null;
            this.marker.visible = false;
            g.hud.tooltip(null);
        } else {
            const hit = this.raycast();
            this.hoverHit = hit;
            if (hit) {
                this.pointTarget.copy(hit.point);
                if (hit.face) {
                    _m3.getNormalMatrix(hit.object.matrixWorld);
                    this.normalTarget.copy(hit.face.normal).applyMatrix3(_m3).normalize();
                } else this.normalTarget.set(0, 1, 0);
                // Einwurf-Hilfe: zeigt die Hand mit einem Gegenstand irgendwo auf einen Karton,
                // wird der Gegenstand mittig über die Öffnung gehalten.
                const box = this.held ? findBox(hit.object) : null;
                if (box) {
                    this.pointTarget.copy(box.group.position);
                    this.pointTarget.y += 0.36;
                    this.normalTarget.set(0, 1, 0);
                    if (box.glowT <= 0) { box.glow.material.color.setHex(box.hex); box.glow.material.opacity = 0.5; }
                    this.boxHover = box;
                } else if (this.boxHover) {
                    if (this.boxHover.glowT <= 0) this.boxHover.glow.material.opacity = 0;
                    this.boxHover = null;
                }
                if (!this.held) {
                    const it = findInteractable(hit.object);
                    if (it !== this.hovered) {
                        this.hovered = it;
                        this.setHighlight(it && (it.canGrab?.() || it.clickable?.(hit)) ? it : null);
                    }
                }
            } else if (!this.held) {
                this.hovered = null;
                this.setHighlight(null);
            }
            if (this.pressed?.drag && hit) this.pressed.drag(hit);
            if (this.held) targetGrip = 1;
            this.marker.visible = !!hit;
            g.hud.tooltip(this.held ? null : this.hovered, this.pointer);
        }

        const k = 1 - Math.exp(-dt * 22);
        this.point.lerp(this.pointTarget, k);
        this.normal.lerp(this.normalTarget, k).normalize();

        // Markierung
        this.marker.position.copy(this.point).addScaledVector(this.normal, 0.003);
        this.marker.lookAt(_v.copy(this.marker.position).add(this.normal));
        this.marker.material.color.setHex(this.held ? 0x2fae5f : 0xd67c9c);

        // Gehaltenes Objekt mitführen
        let anchorTip = true;          // Zeigefingerspitze sitzt genau auf dem Zielpunkt
        const handPos = _v.copy(this.point).addScaledVector(this.normal, 0.004);
        if (this.held) {
            anchorTip = false;
            this.held.holdAt(this.point.clone(), this.normal.clone());
            const o = this.held.object;
            if (this.held.kind === 'plug') {
                handPos.copy(o.position).add(_n.set(0, 0.05, 0));
            } else {
                handPos.copy(o.position);
                handPos.y += (this.held.half?.y || 0.03) * 2 + 0.03;
            }
            this.hist.push({ t: time, p: this.point.clone() });
            while (this.hist.length > 2 && time - this.hist[0].t > 0.1) this.hist.shift();
        } else if (this.mouseMode) {
            // Zeigefinger liegt auf der linken Maustaste
            const m = g.devices.mouse.object;
            handPos.copy(m.position).add(_n.set(-0.013, 0.031, -0.03));
        }

        // Pose: zeigen (Standard), offen (über Greifbarem), Faust (gehalten), locker auf der Maus
        const canGrab = !this.mouseMode && !this.held && !this.pressed && this.hovered?.canGrab?.();
        if (this.clickAnim > 0) this.clickAnim -= dt;
        const press = this.clickAnim > 0 ? Math.sin((this.clickAnim / 0.15) * Math.PI) : 0;
        let targetPoint = 1, targetTilt = -0.3;
        if (this.held) { targetPoint = 0; targetTilt = 0.05; }
        else if (this.mouseMode) { targetPoint = 0.25; targetTilt = -0.32; }
        else if (canGrab) { targetPoint = 0; targetGrip = 0.28; targetTilt = -0.4; }
        const kk = Math.min(1, dt * 14);
        this.grip += (targetGrip - this.grip) * Math.min(1, dt * 16);
        this.pointAmt += (targetPoint - this.pointAmt) * kk;
        this.tilt += (targetTilt - this.tilt) * kk;
        setHandGrip(this.hand, this.grip, this.pointAmt, press * (this.mouseMode ? 1.4 : 0.6));

        // Ausrichtung: wie eine rechte Hand, die von rechts unten in die Szene greift
        const camYaw = g.rig.yaw;
        this.yawOff += ((this.mouseMode ? 0.12 : this.held ? 0.45 : 0.85) - this.yawOff) * kk;
        this.hand.rotation.set(0, camYaw + this.yawOff, 0);
        this.hand.rotateX(this.tilt - press * 0.12);
        this.hand.rotateZ(this.mouseMode ? 0 : -0.25);

        // Position: Fingerspitze auf den Punkt legen (bzw. Hand über den gehaltenen Gegenstand)
        this.anchorBlend += ((anchorTip ? 1 : 0) - this.anchorBlend) * Math.min(1, dt * 18);
        const blend = this.anchorBlend;
        this.hand.position.copy(handPos);
        if (blend > 0.001) {
            this.hand.updateMatrixWorld(true);
            this.hand.userData.tip.getWorldPosition(_tip);
            this.hand.position.addScaledVector(_tip.sub(this.hand.position), -blend);
        }

        // Maustaste der virtuellen Maus sichtbar drücken
        const lb = this.game.devices.mouse?.object.userData.leftBtn;
        if (lb) lb.position.y = (this.mouseMode && this.clickAnim > 0) ? lb.userData.baseY - 0.0018 : lb.userData.baseY;

        // echten Mauszeiger über der Szene ausblenden – die Fingerspitze ist der Zeiger
        const hideCursor = this.enabled && (this.mouseMode || (this.marker.visible && this.pointer.inside));
        if (hideCursor !== this._cursorHidden) {
            this._cursorHidden = hideCursor;
            this.dom.classList.toggle('hand-cursor', hideCursor);
        }
    }
}

export function findInteractable(o) {
    while (o) {
        if (o.userData && o.userData.interactable) return o.userData.interactable;
        o = o.parent;
    }
    return null;
}

function findBox(o) {
    while (o) { if (o.userData && o.userData.box) return o.userData.box; o = o.parent; }
    return null;
}

function isDescendant(o, root) {
    while (o) { if (o === root) return true; o = o.parent; }
    return false;
}

function isVisibleChain(o) {
    while (o) { if (!o.visible) return false; o = o.parent; }
    return true;
}
