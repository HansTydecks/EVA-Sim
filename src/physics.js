import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const _off = new THREE.Vector3();

// Dünne Hülle um cannon-es: statische Kollider + dynamische Körper, die mit Three-Objekten verknüpft sind.
export class Physics {
    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
        this.world.allowSleep = true;
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = 14;
        this.world.defaultContactMaterial.friction = 0.6;
        this.world.defaultContactMaterial.restitution = 0.12;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
        this.world.defaultContactMaterial.contactEquationRelaxation = 4;
        this.links = [];
    }

    addStaticBox(half, pos, quat = null) {
        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
        body.addShape(new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)));
        body.position.set(pos.x, pos.y, pos.z);
        if (quat) body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        this.world.addBody(body);
        return body;
    }

    // Statischer Körper aus mehreren Boxen (z. B. Karton mit Wänden). parts: [{half, offset}]
    addStaticCompound(parts, pos, quat = null) {
        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
        for (const p of parts) {
            body.addShape(new CANNON.Box(new CANNON.Vec3(p.half.x, p.half.y, p.half.z)),
                new CANNON.Vec3(p.offset.x, p.offset.y, p.offset.z));
        }
        body.position.set(pos.x, pos.y, pos.z);
        if (quat) body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        this.world.addBody(body);
        return body;
    }

    // Dynamischer Körper. Ursprung des Objekts = Unterseite Mitte, der Körper sitzt aber in der Mitte der Box
    // (sonst läge der Schwerpunkt am Boden und nichts würde je umkippen). body.offsetY merkt sich den Abstand.
    // com: Höhe des Schwerpunkts als Anteil der halben Höhe (1 = Mitte, kleiner = standfester).
    addDynamic(object, half, mass, { isStatic = false, com = 1 } = {}) {
        const body = new CANNON.Body({
            mass: isStatic ? 0 : mass,
            type: isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
            linearDamping: 0.08,
            angularDamping: 0.25,
            sleepSpeedLimit: 0.08,
            sleepTimeLimit: 0.6,
        });
        body.offsetY = half.y * com;
        body.addShape(new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)), new CANNON.Vec3(0, half.y - body.offsetY, 0));
        body.userMass = mass;
        this.placeBody(body, object);
        this.world.addBody(body);
        const link = { body, object };
        this.links.push(link);
        return body;
    }

    // Körper an die Pose des Three-Objekts setzen
    placeBody(body, object) {
        const q = object.quaternion;
        body.quaternion.set(q.x, q.y, q.z, q.w);
        _off.set(0, body.offsetY || 0, 0).applyQuaternion(q);
        body.position.set(object.position.x + _off.x, object.position.y + _off.y, object.position.z + _off.z);
    }

    makeDynamic(body) {
        body.type = CANNON.Body.DYNAMIC;
        body.mass = body.userMass || 1;
        body.updateMassProperties();
        body.wakeUp();
    }

    makeKinematic(body) {
        body.type = CANNON.Body.KINEMATIC;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.wakeUp();
    }

    remove(body) {
        this.world.removeBody(body);
        this.links = this.links.filter(l => l.body !== body);
    }

    step(dt) {
        this.world.step(1 / 60, dt, 4);
        for (const { body, object } of this.links) {
            if (body.type === CANNON.Body.KINEMATIC) continue; // wird von der Hand gesetzt
            object.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
            _off.set(0, body.offsetY || 0, 0).applyQuaternion(object.quaternion);
            object.position.set(body.position.x - _off.x, body.position.y - _off.y, body.position.z - _off.z);
        }
    }
}

export { CANNON };
