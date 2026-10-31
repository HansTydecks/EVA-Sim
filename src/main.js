import * as THREE from 'three';
import { Physics } from './physics.js';
import { Audio } from './audio.js';
import { buildRoom } from './scene/room.js';
import { makeBarcodeCard, makePaper, MIDI_NOTES } from './scene/models.js';
import { Device, PhysItem, createItem } from './devices.js';
import { Port, PORT_LAYOUT } from './interaction/cables.js';
import { HandController } from './interaction/hand.js';
import { CameraRig } from './interaction/cameraRig.js';
import { Computer } from './computer/os.js';
import { TouchApp, CameraApp, SCAN_CODES } from './computer/apps.js';
import { Guide } from './ui/guide.js';
import { Hud } from './ui/hud.js';
import { Sorter } from './game/sorting.js';
import { Progression } from './game/progression.js';

// ------------------------------------------------------------ Grundgerüst
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3e3ea);
scene.fog = new THREE.Fog(0xf3e3ea, 4, 9);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.03, 30);

const listeners = {};
const game = {
    scene, camera, renderer,
    devices: {},
    items: [],
    itemsById: {},
    ports: [],
    cards: [],
    flags: {},
    stats: { wrong: 0 },
    time: 0,
    cameraBase: new THREE.Vector3(0, 1.32, 0.86),
    on(ev, fn) { (listeners[ev] ||= []).push(fn); },
    emit(ev, data) { (listeners[ev] || []).forEach(fn => fn(data)); },
    activity() { game.progression?.activity(); },
};
window.__eva = { game };

game.physics = new Physics();
game.audio = new Audio();
game.hud = new Hud(game);
const room = buildRoom(game);
game.room = room;
game.boxes = room.boxes;
game.rig = new CameraRig(game, camera);
game.guide = new Guide(game);
game.effects = game.guide;

// ------------------------------------------------------------ Geräte
const D = game.devices;
D.tower = new Device(game, 'tower', { position: new THREE.Vector3(0.72, 0.75, -0.12), yaw: -0.45, isStatic: true });
D.monitor = new Device(game, 'monitor', { position: new THREE.Vector3(-0.02, 0.75, -0.2), yaw: 0, isStatic: true });
for (const [type, x, y] of PORT_LAYOUT) game.ports.push(new Port(D.tower.object, type, x, y, D.tower.object.userData.frontZ));
D.monitor.plug.placeRest(new THREE.Vector3(0.3, 0.763, 0.0), new THREE.Vector3(1, 0, 0.6));

for (const id of ['mouse', 'keyboard', 'speakers', 'scanner', 'midi', 'mic', 'webcam', 'printer', 'touch']) {
    D[id] = new Device(game, id, { position: new THREE.Vector3(0, -5, 0) });
    D[id].hide();
}

game.computer = new Computer(game, D.monitor);

// Touchscreen hat seine eigene kleine Anzeige
const touchCanvas = document.createElement('canvas');
touchCanvas.width = 512; touchCanvas.height = 330;
const touchTex = new THREE.CanvasTexture(touchCanvas);
touchTex.colorSpace = THREE.SRGBColorSpace;
game.touchApp = new TouchApp(game, touchCanvas);

// Gegenstände
for (const [kind, pos, yaw] of [['mug', [-0.3, 0.75, 0.2], 0.4], ['plant', [0.43, 0.75, -0.36], 0]]) {
    const it = createItem(game, kind, new THREE.Vector3(...pos), yaw);
    game.items.push(it);
    game.itemsById[kind] = it;
}

game.spawnCards = () => {
    Object.keys(SCAN_CODES).forEach((code, i) => {
        const obj = makeBarcodeCard(code);
        obj.position.set(-0.64 + i * 0.128, 0.76 + i * 0.01, 0.27);
        obj.rotation.y = (Math.random() - 0.5) * 0.3;
        const it = new PhysItem(game, obj, { name: `Strichcode ${code}`, emoji: '🏷️', mass: 0.02 });
        it.code = code;
        it.home = obj.position.clone();
        game.cards.push(it);
        game.items.push(it);
    });
};
game.removeCards = () => {
    for (const c of game.cards) {
        c.sorted = true;
        game.physics.remove(c.body);
        game.guide.burst(c.object.position.clone(), [0xffffff, 0xd67c9c], 8, 0.5);
        scene.remove(c.object);
    }
    game.items = game.items.filter(i => !game.cards.includes(i));
    game.cards = [];
};
game.spawnDuck = () => {
    if (game.itemsById.duck) return;
    const duck = createItem(game, 'duck', new THREE.Vector3(-0.08, 1.1, 0.05), 0.3);
    game.items.push(duck);
    game.itemsById.duck = duck;
    game.guide.burst(new THREE.Vector3(-0.08, 0.85, 0.05));
};

// Bodenhöhe unter einem Punkt (für Stecker und Kabel)
const downRay = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
game.groundAt = (pos) => {
    downRay.set(new THREE.Vector3(pos.x, Math.max(pos.y + 0.25, 0.3), pos.z), DOWN);
    downRay.far = 3;
    const roots = [room.staticGroup];
    for (const d of Object.values(D)) if (d.visible && !d.held && !d.sorted) roots.push(d.object);
    const hits = downRay.intersectObjects(roots, true);
    for (const h of hits) if (h.object.visible && !h.object.userData.noRaycast) return h.point.y;
    return 0;
};

game.raycastRoots = () => {
    const r = [room.staticGroup];
    for (const d of Object.values(D)) {
        if (!d.visible) continue;
        r.push(d.object);
        if (d.plug && !d.plug.hidden) r.push(d.plug.object);
    }
    for (const it of game.items) r.push(it.object);
    return r;
};

game.hand = new HandController(game);
game.sorter = new Sorter(game, game.boxes);
game.progression = new Progression(game);

// ------------------------------------------------------------ Geräte-Verhalten
D.mouse.clickHandler = () => {
    if (D.mouse.plugged && game.computer.booted && !D.mouse.sortable && !D.mouse.sorted) {
        game.hand.enterMouseMode();
        game.audio.mouseClick();
        return true;
    }
    if (!D.mouse.plugged && game.computer.booted && !D.mouse.sortable) {
        game.progression.interject('Die Maus ist nicht verbunden 🔌', 'Ohne Kabel kommt keine Eingabe beim Computer an. Steck sie zuerst ein!', 'thinking', 4);
    }
    return false;
};

const midiPressed = [];
function pressMidi(i) {
    const k = D.midi.object.userData.keys[i];
    k.position.y = k.userData.baseY - 0.007;
    midiPressed.push({ k, t: 0.18 });
    game.audio.keyClick();
    const app = game.computer.app;
    if (app?.noteOn) app.noteOn(i);
    else game.audio.note(MIDI_NOTES[i].freq, 0.5);
    game.activity();
}
D.midi.clickHandler = (hit) => {
    const note = hit?.object?.userData?.note;
    if (note === undefined || D.midi.sortable) return false;
    if (!D.midi.plugged) {
        game.audio.keyClick();
        game.progression.interject('Kein Ton? 🤔', 'Das MIDI-Keyboard ist noch nicht eingesteckt. Ohne Verbindung kommt die Eingabe nicht beim Computer an.', 'thinking', 4);
        return true;
    }
    pressMidi(note);
    return true;
};

const touchScreen = D.touch.object.userData.screen;
D.touch.pressHandler = {
    drag(hit) { if (hit && hit.object === touchScreen && hit.uv && D.touch.plugged) game.touchApp.touch(hit.uv.x, hit.uv.y); },
};
D.touch.clickHandler = (hit) => {
    if (D.touch.sortable || hit?.object !== touchScreen) return false;
    if (!D.touch.plugged) {
        game.progression.interject('Schwarzer Bildschirm', 'Der Touchscreen ist noch nicht eingesteckt. Ohne Kabel kann er weder etwas anzeigen noch deinen Finger spüren.', 'thinking', 4);
        return false;
    }
    if (hit.uv) game.touchApp.touch(hit.uv.x, hit.uv.y);
    return true;
};

// ------------------------------------------------------------ Ereignisse
game.on('plugged', ({ device }) => {
    game.activity();
    game.guide.burst(device.plug.object.position.clone(), [0x44ff66, 0xffffff], 12, 0.5);
    switch (device.id) {
        case 'monitor': game.computer.powerOn(); break;
        case 'speakers':
            game.audio.setSpeakers(true);
            setTimeout(() => game.audio.startupJingle(), 250);
            break;
        case 'webcam': device.object.userData.led.material.emissive.setHex(0x22ff55); break;
        case 'printer': device.object.userData.led.material.emissive.setHex(0x22ff55); break;
        case 'touch': {
            const m = device.object.userData.screenMat;
            m.map = touchTex; m.color.setHex(0xffffff); m.needsUpdate = true;
            game.touchApp.draw();
            break;
        }
    }
    if (device.id !== 'monitor') game.hud.toast(`🔌 ${device.def.name} verbunden!`, 'good', 1.6);
});
game.on('unplugged', ({ device }) => {
    if (device?.id === 'speakers') game.audio.setSpeakers(false);
    if (device?.id === 'monitor') game.computer.powerOff();
});
game.on('appDone', name => { game.flags[name] = true; game.audio.success(); });
game.on('wrongPort', ({ plug, port }) => {
    const pt = port.plug ? 'Diese Buchse ist schon belegt.' : `Der ${plug.type === port.type ? '' : 'Stecker passt nicht in diese Buchse.'}`;
    game.progression.interject('Passt nicht! 🔌', `${pt} Achte auf die <b>Farbe</b> und <b>Form</b>: Stecker und Buchse müssen zusammenpassen.`, 'sad', 4.5);
});
game.on('cannotGrab', it => {
    if (it.sorted) game.hud.toast('Schon einsortiert ✓', '', 1.2);
    else if (it.isFixed) game.hud.toast('Der bleibt stehen – erst am Ende wird aufgeräumt!', '', 2);
});
let mugStart = null;
game.on('handGrab', it => { if (it === game.itemsById.mug) mugStart = it.object.position.clone(); });
game.on('handRelease', it => {
    if (it === game.itemsById.mug && mugStart && it.object.position.distanceTo(mugStart) > 0.08) game.flags.mugMoved = true;
});
game.on('wheel', d => {
    const app = game.computer.app;
    if (app?.shift && D.mic.plugged) app.shift(-d * 0.7);
});
game.on('mouseMode', on => {
    game.hud.controls(on
        ? '<b>Maus bewegen:</b> Zeiger bewegen<br><b>Linksklick:</b> klicken<br><b>Rechtsklick / Esc:</b> Hand von der Maus nehmen'
        : game.progression.step?.controls || '<b>Linke Taste halten:</b> greifen<br><b>Loslassen:</b> ablegen / werfen<br><b>Mausrad:</b> Gegenstand drehen<br><b>Bildschirmrand:</b> umschauen');
    if (on) game.progression.showHint();
});

// Drucker: Blatt mit dem Foto kommt heraus
const printJobs = [];
game.on('print', photo => {
    const tex = new THREE.CanvasTexture(photo);
    tex.colorSpace = THREE.SRGBColorSpace;
    const obj = makePaper(tex);
    const paper = new PhysItem(game, obj, { name: 'Ausdruck', emoji: '🖼️', mass: 0.05 });
    paper.id = 'paper';
    game.physics.makeKinematic(paper.body);
    paper.body.collisionResponse = false; // beim Herausfahren den Drucker nicht wegschieben
    paper.locked = true;
    const p0 = D.printer.object.localToWorld(D.printer.object.userData.slotPos.clone());
    paper.setPosition(p0);
    game.physics.makeKinematic(paper.body);
    game.items.push(paper);
    printJobs.push({ paper, t: 0 });
    game.audio.printer();
});

// Scanner-Laser
const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.85 }));
laser.visible = false;
laser.userData.noRaycast = true;
scene.add(laser);
const laserRay = new THREE.Raycaster();
const scanCooldown = {};
let scannerWarnT = 0;
function updateScanner(dt) {
    const sc = D.scanner;
    laser.visible = false;
    if (!sc.visible || sc.sorted || !sc.held || sc.sortable) return;
    if (!sc.plugged) {
        scannerWarnT -= dt;
        if (scannerWarnT <= 0) {
            scannerWarnT = 6;
            game.progression.interject('Kein Strom! ⚡', 'Der Scanner ist noch nicht eingesteckt. Ohne Kabel kann er nichts an den Computer schicken.', 'thinking', 4);
        }
        return;
    }
    const origin = sc.object.localToWorld(sc.object.userData.laserOrigin.clone());
    laserRay.set(origin, DOWN);
    laserRay.far = 0.6;
    const hits = laserRay.intersectObjects([room.staticGroup, ...game.cards.map(c => c.object), ...Object.values(D).filter(d => d.visible && d !== sc).map(d => d.object)], true);
    const hit = hits.find(h => h.object.visible);
    const len = hit ? hit.distance : 0.6;
    laser.visible = true;
    laser.scale.set(1, len, 1);
    laser.position.copy(origin).addScaledVector(DOWN, len / 2);
    laser.material.opacity = 0.6 + Math.random() * 0.3;
    if (!hit) return;
    const card = game.cards.find(c => isChild(hit.object, c.object));
    if (!card) return;
    const now = game.time;
    if ((scanCooldown[card.code] || 0) > now) return;
    scanCooldown[card.code] = now + 1.3;
    game.audio.scannerBeep();
    game.guide.burst(hit.point, [0xff3333, 0xffffff], 6, 0.3);
    if (game.computer.app?.scan) game.computer.app.scan(card.code);
    game.activity();
}
function isChild(o, root) { while (o) { if (o === root) return true; o = o.parent; } return false; }

// Webcam-Bild für das Foto-Studio
const camRT = new THREE.WebGLRenderTarget(320, 200, { colorSpace: THREE.SRGBColorSpace });
const camBuf = new Uint8Array(320 * 200 * 4);
let camFrame = 0;
function updateWebcam() {
    const app = game.computer.app;
    if (!(app instanceof CameraApp) || !D.webcam.plugged || !game.computer.booted) return;
    if (camFrame++ % 2) return;
    const cam = D.webcam.object.userData.cam;
    const markerVis = game.hand.marker.visible;
    game.hand.marker.visible = false;
    game.guide.arrow.visible = false;
    renderer.setRenderTarget(camRT);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(camRT, 0, 0, 320, 200, camBuf);
    game.hand.marker.visible = markerVis;
    app.setFrame(camBuf);
}

// ------------------------------------------------------------ Tastatur
const kbPressed = [];
const heldKeys = new Set();
let kbWarnT = 0;
function animateKey(k) {
    const keys = D.keyboard.object.userData.keys;
    let id = k.length === 1 ? k.toUpperCase() : k.toUpperCase();
    if (k === ' ') id = ' ';
    const mesh = keys[id];
    if (!mesh) return;
    mesh.position.y = mesh.userData.baseY - 0.006;
    mesh.material.emissive?.setHex(0x553344);
    kbPressed.push({ k: mesh, t: 0.14 });
}

window.addEventListener('keydown', e => {
    if (!game.hand.enabled) return;
    const k = e.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab'].includes(k)) e.preventDefault();
    game.audio.init();
    game.activity();
    if (k === 'Escape') { game.hand.exitMouseMode(); return; }
    const app = game.computer.app;
    // Mikrofon-Simulation
    if (app?.setSinging && D.mic.plugged) {
        if (k === ' ') { app.setSinging(true); D.mic.object.userData.grill.material.emissive.setHex(0x553344); return; }
        if (k === 'ArrowUp' || k === 'ArrowDown') { heldKeys.add(k); return; }
    }
    // MIDI-Keyboard über Buchstaben
    if (app?.noteOn && D.midi.visible && !D.midi.sorted) {
        const i = MIDI_NOTES.findIndex(n => n.key === k.toUpperCase());
        if (i >= 0) {
            if (D.midi.plugged) { if (!e.repeat) pressMidi(i); }
            else game.progression.interject('Kein Ton? 🤔', 'Das MIDI-Keyboard ist noch nicht eingesteckt.', 'thinking', 3);
            return;
        }
    }
    // Normale Computer-Tastatur
    const kb = D.keyboard;
    if (!kb.visible || kb.sorted) return;
    if (!kb.plugged) {
        if ((k.length === 1 || k === 'Enter') && game.time > kbWarnT) {
            kbWarnT = game.time + 4;
            game.progression.interject('Nichts passiert? 🤔', 'Die Tastatur ist noch <b>nicht eingesteckt</b>. Ohne Kabel kommt deine Eingabe nicht beim Computer an!', 'thinking', 4);
        }
        return;
    }
    if (e.repeat && k.length === 1) return;
    animateKey(k);
    game.audio.keyClick();
    game.computer.key(e);
});
window.addEventListener('keyup', e => {
    const app = game.computer.app;
    if (e.key === ' ' && app?.setSinging) { app.setSinging(false); D.mic.object.userData.grill.material.emissive.setHex(0); }
    heldKeys.delete(e.key);
});

// ------------------------------------------------------------ Größe
function resize() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    // Horizontal mindestens ~88° Sicht, damit Tisch und Computer drauf sind
    const minH = THREE.MathUtils.degToRad(88);
    const vfov = Math.max(THREE.MathUtils.degToRad(56), 2 * Math.atan(Math.tan(minH / 2) / aspect));
    camera.fov = Math.min(THREE.MathUtils.radToDeg(vfov), 85);
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ Schleife
let lastT = performance.now();
function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 1 / 20);
    lastT = now;
    game.time += dt;
    const t = game.time;

    game.physics.step(dt);
    game.rig.update(dt);
    game.hand.update(dt, t);
    for (const d of Object.values(D)) d.update(dt);
    for (const it of game.items) it.update(dt);
    game.sorter.update(dt, t);
    game.progression.update(dt);
    game.computer.update(dt);
    game.touchApp.update(dt);
    if (game.touchApp.on) touchTex.needsUpdate = true;
    game.guide.update(dt, t);
    updateScanner(dt);

    // Mikrofon: Tonhöhe mit Pfeiltasten gleiten lassen
    const app = game.computer.app;
    if (app?.shift) {
        if (heldKeys.has('ArrowUp')) app.shift(dt * 5);
        if (heldKeys.has('ArrowDown')) app.shift(-dt * 5);
    }
    // gedrückte Tasten zurückfedern
    for (const p of [...kbPressed, ...midiPressed]) {
        p.t -= dt;
        if (p.t <= 0) { p.k.position.y = p.k.userData.baseY; p.k.material.emissive?.setHex(0); }
    }
    for (const arr of [kbPressed, midiPressed]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t <= 0) arr.splice(i, 1);

    // Druckaufträge
    for (const job of printJobs) {
        job.t += dt / 2.8;
        const pr = D.printer.object;
        const slot = pr.userData.slotPos;
        const e = Math.min(1, job.t);
        const local = new THREE.Vector3(slot.x, slot.y - 0.003, slot.z - 0.07 + e * 0.17);
        const p = pr.localToWorld(local);
        job.paper.object.position.copy(p);
        job.paper.object.quaternion.copy(pr.quaternion);
        job.paper.body.position.set(p.x, p.y, p.z);
        if (job.t >= 1 && !job.done) {
            job.done = true;
            job.paper.locked = false;
            job.paper.body.collisionResponse = true;
            game.physics.makeDynamic(job.paper.body);
            job.paper.home = p.clone();
            game.flags.printed = true;
            game.hud.toast('🖨️ Gedruckt!', 'good', 1.8);
            game.audio.chime();
        }
    }
    for (let i = printJobs.length - 1; i >= 0; i--) if (printJobs[i].done) printJobs.splice(i, 1);

    // Lautsprecher wippen, wenn Ton kommt
    if (D.speakers.visible && D.speakers.plugged) {
        const s = 1 + Math.max(0, Math.sin(t * 30)) * 0.04 * (game.audio.voice ? 1 : 0.2);
        D.speakers.object.userData.cones.forEach(c => c.scale.setScalar(s));
    }

    updateWebcam();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

// ------------------------------------------------------------ Start
const startBtn = document.getElementById('startBtn');
document.getElementById('loadingNote').textContent = 'Tipp: Am besten mit Maus und Lautsprechern/Kopfhörern spielen.';
startBtn.addEventListener('click', () => {
    game.audio.init();
    document.getElementById('startScreen').classList.add('hidden');
    game.hud.show();
    game.hand.enabled = true;
    game.progression.start();
});
document.getElementById('againBtn').addEventListener('click', () => location.reload());

// Debug-/Test-Hilfen (für automatisierte Tests und Lehrkräfte)
Object.assign(window.__eva, {
    start() { startBtn.click(); },
    skipTo(id) { game.progression.skipTo(id); },
    step() { return game.progression.step?.id; },
    plug(id) {
        const d = D[id];
        const p = game.ports.find(p => p.type === d.plug.type && !p.plug);
        d.plug.plugInto(p);
    },
    sortInto(id, cat) {
        const d = D[id];
        const b = game.boxes.find(b => b.cat === cat);
        if (d.plug && !d.plug.hidden && d.sortable) d.plug.hide();
        d.setFixed?.(false);
        d.setPosition(b.group.position.clone().setY(b.group.position.y + 0.12));
    },
    flags: game.flags,
});

loop();
