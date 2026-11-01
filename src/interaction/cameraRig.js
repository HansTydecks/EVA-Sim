import * as THREE from 'three';

// Sitzende Kamera: schaut auf den Tisch, dreht sich am Bildschirmrand (oder per Knopf) nach links zu den Kartons.
export class CameraRig {
    constructor(game, camera) {
        this.game = game;
        this.camera = camera;
        this.base = new THREE.Vector3(0, 1.32, 0.86);
        this.yaw = 0;
        this.yawTarget = 0;
        this.pitch = -0.43;
        this.minYaw = -0.3;
        this.maxYaw = 1.65;
        this.boxYaw = 1.5;
        this.focus = 0; // 0 = normal, 1 = nah am Monitor
        this.focusTarget = 0;
        this.edgeHold = 0;
        this.maxYawSeen = 0;
        this.minYawSeenAfter = 0;
        this.pos = this.base.clone();
    }

    lookBoxes() { this.yawTarget = this.boxYaw; }
    lookDesk() { this.yawTarget = 0; }

    update(dt) {
        const hand = this.game.hand;
        const p = hand.pointer;
        if (!hand.mouseMode && hand.enabled && p.inside) {
            const edge = Math.max(36, innerWidth * 0.045);
            let dir = 0;
            if (p.x < edge) dir = 1;
            else if (p.x > innerWidth - edge) dir = -1;
            if (dir !== 0) {
                this.edgeHold += dt;
                if (this.edgeHold > 0.12) this.yawTarget = THREE.MathUtils.clamp(this.yawTarget + dir * dt * 1.6, this.minYaw, this.maxYaw);
            } else this.edgeHold = 0;
        }
        this.yawTarget = THREE.MathUtils.clamp(this.yawTarget, this.minYaw, this.maxYaw);
        this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 6);
        this.maxYawSeen = Math.max(this.maxYawSeen, this.yaw);

        this.focusTarget = hand.mouseMode ? 1 : 0;
        this.focus += (this.focusTarget - this.focus) * Math.min(1, dt * 5);
        if (hand.mouseMode) this.yawTarget = 0;

        // Position: beim Fokus etwas näher an den Monitor
        const f = this.focus;
        this.pos.set(this.base.x, this.base.y - f * 0.12, this.base.z - f * 0.32);
        this.camera.position.copy(this.pos);
        const pitch = this.pitch + f * 0.3 - Math.max(0, this.yaw) * 0.12;
        const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(this.yaw) * Math.cos(pitch));
        this.camera.lookAt(this.pos.clone().add(dir));

        this.game.hud.setLookButtons(this.yaw);
    }
}
