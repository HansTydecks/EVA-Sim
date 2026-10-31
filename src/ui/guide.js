import * as THREE from 'three';
import { makeHand, setHandGrip } from '../scene/models.js';

// Hilfen in der 3D-Welt: hüpfender Pfeil, "Geisterhand", die die Bewegung vormacht, und kleine Effekte.
export class Guide {
    constructor(game) {
        this.game = game;
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd43b, depthTest: false, transparent: true });
        this.arrow = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 16), arrowMat);
        cone.rotation.x = Math.PI;
        cone.position.y = 0.03;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 10), arrowMat);
        stem.position.y = 0.09;
        this.arrow.add(cone, stem);
        this.arrow.renderOrder = 20;
        this.arrow.traverse(o => { o.renderOrder = 20; });
        this.arrow.visible = false;
        game.scene.add(this.arrow);

        this.ghost = makeHand({ ghost: true });
        this.ghost.traverse(o => { o.renderOrder = 19; });
        this.ghost.visible = false;
        game.scene.add(this.ghost);
        this.ghostT = 0;

        this.level = 0; // 0 nichts, 1 Pfeil, 2 Pfeil + Geisterhand
        this.target = null;

        this.particles = [];
    }

    // target: { at: () => Vector3 }  oder  { from: () => Vector3, to: () => Vector3 }
    setTarget(t) { this.target = t; this.ghostT = 0; }

    update(dt, time) {
        const t = this.target;
        const showArrow = this.level >= 1 && t;
        const arrowPos = t ? (t.to && this.level >= 1 && t.arrowAtTo ? t.to() : (t.at ? t.at() : t.from?.())) : null;
        if (showArrow && arrowPos) {
            this.arrow.visible = true;
            this.arrow.position.copy(arrowPos);
            this.arrow.position.y += 0.06 + Math.abs(Math.sin(time * 4)) * 0.05;
            this.arrow.rotation.y = time * 2;
        } else this.arrow.visible = false;

        if (this.level >= 2 && t && t.from && t.to) {
            const a = t.from(), b = t.to();
            if (a && b) {
                this.ghost.visible = true;
                this.ghostT = (this.ghostT + dt / 2.4) % 1;
                const k = this.ghostT;
                let p, grip;
                if (k < 0.15) { p = a; grip = k / 0.15; }
                else if (k < 0.75) {
                    const s = (k - 0.15) / 0.6;
                    const e = s * s * (3 - 2 * s);
                    p = a.clone().lerp(b, e);
                    p.y += Math.sin(e * Math.PI) * 0.15;
                    grip = 1;
                } else { p = b; grip = 1 - (k - 0.75) / 0.25; }
                this.ghost.position.copy(p).add(new THREE.Vector3(0, 0.07, 0.04));
                this.ghost.rotation.set(0, this.game.rig.yaw + 0.45, 0);
                this.ghost.rotateX(0.05);
                setHandGrip(this.ghost, grip);
            } else this.ghost.visible = false;
        } else this.ghost.visible = false;

        // Partikel
        for (const p of this.particles) {
            p.life -= dt;
            p.v.y -= 2.5 * dt;
            p.mesh.position.addScaledVector(p.v, dt);
            p.mesh.scale.setScalar(Math.max(0.01, p.life / p.max));
            p.mesh.rotation.x += dt * 5;
        }
        this.particles = this.particles.filter(p => {
            if (p.life <= 0) { this.game.scene.remove(p.mesh); p.mesh.geometry.dispose(); return false; }
            return true;
        });
    }

    burst(pos, colors = [0xffd43b, 0xd67c9c, 0x4dabf7, 0x69db7c], n = 18, speed = 0.9) {
        for (let i = 0; i < n; i++) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
            mesh.position.copy(pos);
            this.game.scene.add(mesh);
            const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.4, (Math.random() - 0.5)).normalize().multiplyScalar(speed * (0.5 + Math.random()));
            const life = 0.7 + Math.random() * 0.5;
            this.particles.push({ mesh, v, life, max: life });
        }
    }
}
