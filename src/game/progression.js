import * as THREE from 'three';
import { PORT_TYPES } from '../interaction/cables.js';

// Ablauf der Simulation als Liste von Schritten.
// Jeder Schritt: { station, title, text, mood, enter(), exit(), done(), guide(), info }

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SPAWN = {
    mouse: [V(0.4, 0.754, 0.13), 0],
    keyboard: [V(0.0, 0.75, 0.16), 0],
    speakers: [V(-0.5, 0.75, -0.33), 0.2],
    scanner: [V(-0.36, 0.75, 0.02), 0.3],
    midi: [V(-0.43, 0.75, 0.1), 0.1],
    mic: [V(-0.42, 0.75, 0.02), 0.4],
    webcam: [V(-0.28, 0.75, 0.1), 0],
    printer: [V(-0.46, 0.75, -0.04), 0.2],
    touch: [V(-0.44, 0.75, -0.02), 0.35],
};

export class Progression {
    constructor(game) {
        this.game = game;
        this.idx = -1;
        this.idle = 0;
        this.helpT = 0;
        this.interjectT = 0;
        this.nextPressed = false;
        this.doneStations = [];
        this.steps = buildSteps(game, this);
    }

    get step() { return this.steps[this.idx]; }

    start() { this.goto(0); }

    goto(i) {
        const g = this.game;
        this.step?.exit?.();
        if (this.step?.station && this.steps[i]?.station !== this.step.station && !this.doneStations.includes(this.step.station)) {
            this.doneStations.push(this.step.station);
        }
        this.idx = i;
        const s = this.step;
        if (!s) return;
        this.nextPressed = false;
        s.enter?.();
        this.interjectT = 0;
        this.showHint();
        this.idle = 0;
        this.helpT = 0;
        g.guide.setTarget(s.guide ? s.guide() : null);
        g.hud.station(s.station, this.doneStations);
        g.hud.pulseLookLeft(!!s.sort);
        g.hud.controls(s.controls || defaultControls());
    }

    skipTo(id) {
        const i = this.steps.findIndex(s => s.id === id);
        if (i >= 0) this.goto(i);
    }

    showHint() {
        const s = this.step;
        if (!s) return;
        const text = typeof s.text === 'function' ? s.text() : s.text;
        this.game.hud.say(s.title, text, s.mood || 'normal', { next: s.info ? () => { this.nextPressed = true; } : null });
    }

    interject(title, text, mood = 'thinking', dur = 5) {
        this.game.hud.say(title, text, mood);
        this.interjectT = dur;
    }

    help() {
        this.interjectT = 0;
        this.showHint();
        this.helpT = 9;
        this.game.guide.ghostT = 0;
        this.game.audio.pcBlip?.(0);
    }

    activity() { this.idle = 0; }

    update(dt) {
        const s = this.step;
        if (!s) return;
        if (this.interjectT > 0) {
            this.interjectT -= dt;
            if (this.interjectT <= 0) this.showHint();
        }
        this.idle += dt;
        this.helpT = Math.max(0, this.helpT - dt);
        const g = this.game;
        const lvl = this.helpT > 0 ? 2 : this.idle > 30 ? 2 : this.idle > 12 ? 1 : 0;
        g.guide.level = s.info ? 0 : lvl;
        g.hud.pulseHelp(this.idle > 20 && !s.info);
        s.update?.(dt);
        if (s.done && s.done()) this.goto(this.idx + 1);
    }
}

function defaultControls() {
    return '<b>Linke Taste halten:</b> greifen<br><b>Loslassen:</b> ablegen / werfen<br><b>Mausrad:</b> Gegenstand drehen<br><b>Bildschirmrand:</b> umschauen';
}

function portFor(game, dev) {
    const free = game.ports.filter(p => p.type === dev.plug.type && !p.plug);
    return free[0] || game.ports.find(p => p.type === dev.plug.type);
}

const PLUG_WORDS = {
    usb: ['blauen USB-Stecker', 'blaue USB-Buchse'],
    hdmi: ['gelben HDMI-Stecker', 'gelbe HDMI-Buchse'],
    usbc: ['lila USB-C-Stecker', 'lila USB-C-Buchse'],
    audio: ['grünen Stecker', 'grüne Buchse'],
    mic: ['rosa Stecker', 'rosa Buchse'],
};

function plugStep(game, id, station, extra = {}) {
    const dev = () => game.devices[id];
    const t = () => PORT_TYPES[dev().plug.type];
    return {
        id: `${id}_plug`,
        station,
        title: extra.title || `${game.devices[id].def.emoji} Einstecken!`,
        text: extra.text || (() => {
            const w = PLUG_WORDS[dev().plug.type];
            return `Steck den <b style="color:${t().css}">${w[0]}</b> ${dev().def.gen} in eine <b style="color:${t().css}">${w[1]}</b> vorne am Computer (rechts). Tipp: Stecker und Buchse haben die <b>gleiche Farbe</b>!`;
        }),
        mood: extra.mood || 'normal',
        enter() {
            extra.enter?.();
        },
        update() {
            // Hinweis-Leuchten an der richtigen Buchse
            if (game.progression.idle > 6 || game.progression.helpT > 0) {
                const p = portFor(game, dev());
                if (p && p.highlight !== 'good' && p.highlight !== 'bad') p.setHighlight('hint', game.time);
            }
        },
        exit() { for (const p of game.ports) if (p.highlight === 'hint') p.setHighlight('none'); },
        guide: () => ({
            from: () => (dev().plug.port ? null : dev().plug.object.position.clone()),
            to: () => { const p = portFor(game, dev()); return p ? p.worldPos().addScaledVector(p.outward(), 0.05) : null; },
        }),
        done: () => dev().plugged,
    };
}

function sortStep(game, ids, station, title, text) {
    const devs = () => ids.map(id => game.devices[id]);
    const firstOpen = () => devs().find(d => !d.sorted);
    const boxFor = d => game.boxes.find(b => d.def.cat.includes(b.cat));
    return {
        id: `sort_${ids.join('_')}`,
        station,
        sort: true,
        title,
        text,
        mood: 'happy',
        enter() {
            for (const d of devs()) { d.sortable = true; d.setFixed?.(false); }
        },
        exit() { game.hud.eva(null); },
        guide: () => ({
            from: () => { const d = firstOpen(); return d && !d.held ? d.object.position.clone().setY(d.object.position.y + d.half.y * 2) : null; },
            to: () => { const d = firstOpen(); const b = d && boxFor(d); return b ? b.group.position.clone().setY(b.group.position.y + 0.38) : null; },
        }),
        done: () => devs().every(d => d.sorted),
        controls: '<b>Gerät greifen</b> und zum <b>linken Bildschirmrand</b> ziehen – dort stehen die Kartons.<br><b>Über dem Karton loslassen</b> (oder hineinwerfen).',
    };
}

function infoStep(game, id, station, title, text, mood = 'happy', extra = {}) {
    return {
        id, station, title, text, mood, info: true,
        enter: extra.enter,
        exit: extra.exit,
        done: () => game.progression.nextPressed,
    };
}

function waitStep(game, id, station, title, text, done, extra = {}) {
    return { id, station, title, text, mood: extra.mood || 'normal', enter: extra.enter, exit: extra.exit, update: extra.update, guide: extra.guide, controls: extra.controls, done };
}

function buildSteps(game, prog) {
    const D = game.devices;
    const F = game.flags;
    const spawn = id => { const [p, yaw] = SPAWN[id]; D[id].spawn(p, yaw); };

    return [
        // ---------------- Tutorial
        waitStep(game, 'intro', 'monitor', 'Hallo, ich bin Byte! 👋',
            'Deine Maus ist jetzt deine <b>Hand</b>. <b>Halte die linke Maustaste gedrückt</b>, um etwas zu greifen, und lass los, um es abzulegen.<br>Probier es aus: <b>Nimm die Tasse und stell sie woanders hin!</b>',
            () => F.mugMoved,
            {
                mood: 'happy',
                guide: () => ({ from: () => game.itemsById.mug.object.position.clone().setY(0.87), to: () => V(-0.55, 0.8, 0.2) }),
            }),
        waitStep(game, 'look', 'monitor', 'Schau dich um! 👀',
            'Fahre mit der Maus an den <b>linken Bildschirmrand</b> (oder klicke auf <b>◀ Kartons</b>). Dort stehen drei Kartons: <b style="color:#6fdc98">EINGABE</b>, <b style="color:#7fb0f5">VERARBEITUNG</b> und <b style="color:#ffb066">AUSGABE</b>.',
            () => game.rig.yaw > 0.75,
            { enter() { game.hud.pulseLookLeft(true); }, exit() { game.hud.pulseLookLeft(false); } }),
        waitStep(game, 'lookback', 'monitor', 'Genau! 📦',
            'In diese Kartons räumst du später jedes Gerät, das du benutzt hast. Jetzt geht es <b>zurück zum Tisch</b>: rechter Bildschirmrand oder <b>Tisch ▶</b>.',
            () => game.rig.yaw < 0.2, { mood: 'happy' }),

        // ---------------- Bildschirm
        plugStep(game, 'monitor', 'monitor', {
            title: '🖥️ Der Bildschirm ist dunkel!',
            text: 'Der Bildschirm ist noch nicht mit dem Computer verbunden. Greif den <b style="color:#f4c430">gelben HDMI-Stecker</b> (er liegt neben dem Bildschirm) und steck ihn in die <b style="color:#f4c430">gelbe Buchse</b> vorne am Computer (rechts)!',
        }),
        waitStep(game, 'boot', 'monitor', 'Der Computer startet … ⏳',
            'Siehst du? Jetzt zeigt der Bildschirm etwas an. Der Bildschirm ist ein <b>AUSGABE</b>-Gerät: Er zeigt, was der Computer macht.',
            () => game.computer.booted, { mood: 'happy' }),

        // ---------------- Maus
        waitStep(game, 'mouse_spawn', 'mouse', '🖱️ Eine Maus!', 'Oh, da ist eine Maus aufgetaucht!', () => true, { enter() { spawn('mouse'); } }),
        plugStep(game, 'mouse', 'mouse'),
        waitStep(game, 'mouse_use', 'mouse', '🖱️ Benutze die Maus!',
            () => (game.hand.mouseMode
                ? 'Super! Jetzt bewegst du die Maus auf dem Mauspad – und der <b>Zeiger auf dem Bildschirm</b> bewegt sich mit. <b>Klicke auf zwei Karten</b> und finde alle Paare!<br><small>Rechtsklick oder Esc: Hand von der Maus nehmen.</small>'
                : '<b>Klicke einmal auf die Maus</b> auf dem Tisch. Dann liegt deine Hand auf der Maus und du kannst den Computer bedienen. Spiele das <b>Memory</b>!'),
            () => F.memory,
            {
                enter() { game.computer.startApp('memory'); },
                guide: () => ({ at: () => (game.hand.mouseMode ? null : D.mouse.object.position.clone().setY(0.8)) }),
                controls: '<b>Auf die Maus klicken:</b> Maus benutzen<br><b>Linksklick:</b> am Computer klicken<br><b>Rechtsklick / Esc:</b> Maus loslassen',
            }),
        infoStep(game, 'mouse_eva', 'mouse', 'Geschafft! 🎉',
            'Du hast die Maus bewegt und geklickt: Das ist eine <b>EINGABE</b>. Der Computer hat das <b>VERARBEITET</b> und der Bildschirm hat die Karten gezeigt: <b>AUSGABE</b>.<br><small>Die Maus brauchen wir noch – sie kommt ganz am Ende in den Karton.</small>',
            'happy',
            { enter() { game.hand.exitMouseMode(); game.hud.eva('🖱️ Maus', '💻 Computer', '🖥️ Bildschirm'); game.computer.startApp(null); }, exit() { game.hud.eva(null); } }),

        // ---------------- Tastatur
        waitStep(game, 'kb_spawn', 'keyboard', '⌨️ Eine Tastatur!', '', () => true, { enter() { spawn('keyboard'); } }),
        plugStep(game, 'keyboard', 'keyboard'),
        waitStep(game, 'kb_use', 'keyboard', '⌨️ Jetzt tippen!',
            'Benutze deine <b>echte Tastatur</b>: Tippe <b>HALLO COMPUTER</b>. Die virtuelle Tastatur ist jetzt verbunden – schau, wie sich ihre Tasten mitbewegen!',
            () => F.typing,
            { enter() { game.hand.exitMouseMode(); game.computer.startApp('typing'); }, controls: '<b>Echte Tastatur:</b> tippen<br><b>Leertaste:</b> Leerzeichen' }),
        infoStep(game, 'kb_eva', 'keyboard', 'Super getippt! 🎉',
            'Jeder Tastendruck ist eine <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> ihn und zeigt den Buchstaben auf dem Bildschirm an: <b>AUSGABE</b>.<br><small>Auch die Tastatur bleibt bis zum Schluss auf dem Tisch.</small>',
            'happy',
            { enter() { game.hud.eva('⌨️ Tastatur', '💻 Computer', '🖥️ Bildschirm'); game.computer.startApp(null); }, exit() { game.hud.eva(null); } }),

        // ---------------- Lautsprecher + Scanner
        waitStep(game, 'spk_spawn', 'scanner', '🔊 Lautsprecher!', '', () => true, { enter() { spawn('speakers'); } }),
        plugStep(game, 'speakers', 'scanner', {
            text: 'Bisher war der Computer stumm. Steck den <b style="color:#2ecc71">grünen Stecker</b> der <b>Lautsprecher</b> in die <b style="color:#2ecc71">grüne Buchse</b> am Computer!',
        }),
        waitStep(game, 'scan_spawn', 'scanner', '🏷️ Ein Barcode-Scanner!', '', () => true, {
            enter() { spawn('scanner'); game.spawnCards(); },
        }),
        plugStep(game, 'scanner', 'scanner', {
            text: 'Hörst du den Ton? Die Lautsprecher funktionieren! Jetzt ist ein <b>Barcode-Scanner</b> aufgetaucht. Steck sein <b style="color:#2f7cf6">blaues USB-Kabel</b> in eine <b style="color:#2f7cf6">blaue USB-Buchse</b>.',
            mood: 'happy',
        }),
        waitStep(game, 'scan_use', 'scanner', '🏷️ Scanne die Strichcodes!',
            'Greif den <b>Scanner</b> (linke Taste gedrückt halten) und halte ihn <b>über die Kärtchen mit den Strichcodes</b>. Der rote Laser liest den Code. Scanne <b>alle 5 Codes</b> – jeder spielt einen Ton!',
            () => F.scanner,
            {
                enter() { game.computer.startApp('scanner'); },
                guide: () => ({
                    from: () => (D.scanner.held ? null : D.scanner.object.position.clone().setY(0.9)),
                    to: () => { const c = game.cards.find(c => !game.computer.app?.found?.has(c.code)); return c ? c.object.position.clone().setY(0.85) : null; },
                }),
                controls: '<b>Scanner greifen</b> und über die Kärtchen halten<br>Der Laser scannt automatisch',
            }),
        infoStep(game, 'scan_eva', 'scanner', 'Klasse! 🎶',
            'Der <b>Scanner</b> liest den Strichcode ein: <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> den Code und sucht den passenden Ton. Die <b>Lautsprecher</b> spielen ihn ab und der Bildschirm zeigt den Code: <b>AUSGABE</b>.',
            'happy',
            { enter() { game.hud.eva('🏷️ Scanner', '💻 Computer', '🔊 Lautsprecher + 🖥️'); } }),
        sortStep(game, ['scanner'], 'scanner', '📦 Aufräumen!',
            'Den Scanner brauchen wir nicht mehr. <b>Leg ihn in den richtigen Karton!</b> Ist er ein Eingabe-, Verarbeitungs- oder Ausgabegerät?<br><small>Die Lautsprecher bleiben noch auf dem Tisch – die brauchen wir gleich wieder.</small>'),

        // ---------------- MIDI
        waitStep(game, 'midi_spawn', 'midi', '🎹 Ein MIDI-Keyboard!', '', () => true, { enter() { game.removeCards(); game.computer.startApp(null); spawn('midi'); } }),
        plugStep(game, 'midi', 'midi'),
        waitStep(game, 'midi_use', 'midi', '🎹 Spiel Musik!',
            'Klicke mit der Hand auf die <b>Tasten des MIDI-Keyboards</b> (oder drücke <b>C D E F G A H K</b> auf deiner Tastatur). Jeder Ton bringt deine Figur auf eine andere Bahn. <b>Weiche den roten Blöcken aus</b> und sammle <b>12 Punkte</b>!',
            () => F.runner,
            {
                enter() { game.computer.startApp('runner'); },
                guide: () => ({ at: () => D.midi.object.position.clone().setY(0.82) }),
                controls: '<b>Klick auf eine Klaviertaste:</b> Ton spielen<br><b>Tasten C D E F G A H K:</b> auch möglich',
            }),
        infoStep(game, 'midi_eva', 'midi', 'Du bist ein Musik-Profi! 🎵',
            'Das <b>MIDI-Keyboard</b> macht selbst keinen Ton! Es schickt nur die Information „Taste C gedrückt“: <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> sie und erzeugt den Klang. Die <b>Lautsprecher</b> geben ihn aus: <b>AUSGABE</b>.',
            'happy',
            { enter() { game.hud.eva('🎹 MIDI-Keyboard', '💻 Computer', '🔊 Lautsprecher + 🖥️'); } }),
        sortStep(game, ['midi'], 'midi', '📦 Ab in den Karton!', 'Räum das <b>MIDI-Keyboard</b> in den richtigen Karton.'),

        // ---------------- Mikrofon
        waitStep(game, 'mic_spawn', 'mic', '🎤 Ein Studiomikrofon!', '', () => true, { enter() { game.computer.startApp(null); spawn('mic'); } }),
        plugStep(game, 'mic', 'mic', {
            text: 'Mikrofone haben am Computer eine eigene Buchse: Steck den <b style="color:#ff6fa8">rosa Stecker</b> in die <b style="color:#ff6fa8">rosa Buchse</b>!',
        }),
        waitStep(game, 'mic_use', 'mic', '🎤 Sing ein C!',
            '<b>Halte die Leertaste gedrückt</b> – dann singst du ins Mikrofon. Mit dem <b>Mausrad</b> oder den Pfeiltasten <b>↑ ↓</b> änderst du die Tonhöhe. Triff die <b>rote Linie (C)</b> und halte den Ton <b>1,5 Sekunden</b>!',
            () => F.sing,
            {
                enter() { game.computer.startApp('sing'); },
                controls: '<b>Leertaste halten:</b> singen<br><b>Mausrad / ↑ ↓:</b> Ton höher oder tiefer',
            }),
        infoStep(game, 'mic_eva', 'mic', 'Wunderschön gesungen! 🎤',
            'Das <b>Mikrofon</b> nimmt deine Stimme auf: <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> den Ton und misst, wie hoch er ist. Der <b>Bildschirm</b> zeigt dir die Tonhöhe als Linie: <b>AUSGABE</b>.',
            'happy',
            { enter() { game.hud.eva('🎤 Mikrofon', '💻 Computer', '🖥️ Bildschirm'); } }),
        sortStep(game, ['mic'], 'mic', '📦 Aufräumen!', 'Wohin gehört das <b>Mikrofon</b>? Leg es in den richtigen Karton.'),

        // ---------------- Webcam + Drucker
        waitStep(game, 'cam_spawn', 'camera', '📷 Webcam und Drucker!', '', () => true, {
            enter() { game.computer.startApp(null); spawn('webcam'); spawn('printer'); game.spawnDuck(); },
        }),
        plugStep(game, 'webcam', 'camera', {
            title: '📷 Zwei neue Geräte!',
            text: 'Eine <b>Webcam</b> und ein <b>Drucker</b>! Steck zuerst die <b>Webcam</b> mit ihrem <b style="color:#2f7cf6">blauen USB-Kabel</b> ein.',
        }),
        plugStep(game, 'printer', 'camera', {
            text: 'Jetzt noch den <b>Drucker</b>: Auch er hat ein <b style="color:#2f7cf6">blaues USB-Kabel</b>.',
        }),
        waitStep(game, 'cam_use', 'camera', '📸 Mach ein Foto!',
            'Greif die <b>Webcam</b> und richte sie auf etwas Schönes – zum Beispiel die <b>Ente 🦆</b>. Mit dem <b>Mausrad drehst du die Webcam</b>. Dann <b>klicke am Computer auf „Foto + Drucken“</b> (mit der Maus) oder drücke die <b>Leertaste</b>.',
            () => F.printed,
            {
                enter() { game.computer.startApp('camera'); },
                guide: () => ({ at: () => D.webcam.object.position.clone().setY(0.86) }),
                controls: '<b>Webcam greifen + Mausrad:</b> ausrichten<br><b>Leertaste</b> oder <b>Maus → Foto-Knopf:</b> auslösen',
            }),
        infoStep(game, 'cam_eva', 'camera', 'Schönes Foto! 🖼️',
            'Die <b>Webcam</b> nimmt das Bild auf: <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> es (zum Beispiel mit einem Filter). Bildschirm und <b>Drucker</b> geben es aus: <b>AUSGABE</b>. Du kannst das Blatt sogar hochheben!',
            'happy',
            { enter() { game.hand.exitMouseMode(); game.hud.eva('📷 Webcam', '💻 Computer', '🖨️ Drucker + 🖥️'); } }),
        sortStep(game, ['webcam', 'printer'], 'camera', '📦 Zwei Geräte aufräumen!', 'Sortiere die <b>Webcam</b> und den <b>Drucker</b> in die richtigen Kartons.'),

        // ---------------- Touchscreen
        waitStep(game, 'touch_spawn', 'touch', '📱 Ein Touchscreen!', '', () => true, { enter() { game.computer.startApp(null); spawn('touch'); } }),
        plugStep(game, 'touch', 'touch', {
            text: 'Der <b>Touchscreen</b> hat einen <b style="color:#9b59b6">lila USB-C-Stecker</b>. Steck ihn in die <b style="color:#9b59b6">lila Buchse</b>!',
        }),
        waitStep(game, 'touch_use', 'touch', '📱 Tipp auf den Bildschirm!',
            'Tippe mit der Hand direkt auf den <b>Touchscreen</b> (linke Maustaste). <b>Bring 8 Blasen zum Platzen!</b>',
            () => F.touch,
            {
                enter() { game.computer.startApp('touchinfo'); game.touchApp.on = true; },
                guide: () => ({ at: () => D.touch.object.position.clone().setY(1.05) }),
                controls: '<b>Linksklick auf den Touchscreen:</b> tippen<br><b>Gedrückt halten + ziehen:</b> malen',
            }),
        infoStep(game, 'touch_eva', 'touch', 'Ein besonderes Gerät! ✨',
            'Der <b>Touchscreen</b> kann <b>beides</b>: Er spürt deinen Finger (<b>EINGABE</b>) und zeigt Bilder (<b>AUSGABE</b>). Dazwischen <b>VERARBEITET</b> der Computer, wo du hingetippt hast.',
            'happy',
            { enter() { game.hud.eva('📱 Touch (Finger)', '💻 Computer', '📱 Touch (Bild)'); } }),
        sortStep(game, ['touch'], 'touch', '📦 Wohin damit?', 'Der Touchscreen ist Eingabe <b>und</b> Ausgabe. Such dir einen passenden Karton aus!'),

        // ---------------- Finale
        infoStep(game, 'final_intro', 'final', 'Feierabend! 🧹',
            'Du hast alle Geräte ausprobiert. Jetzt räumen wir <b>alles</b> auf: <b>Maus</b>, <b>Tastatur</b>, <b>Lautsprecher</b>, <b>Bildschirm</b> und sogar den <b>Computer</b> selbst. Wohin gehört der Computer wohl?',
            'happy',
            { enter() { game.hand.exitMouseMode(); game.touchApp.on = false; } }),
        sortStep(game, ['mouse', 'keyboard', 'speakers', 'monitor', 'tower'], 'final', '📦 Großes Aufräumen!',
            'Sortiere <b>Maus, Tastatur, Lautsprecher, Bildschirm</b> und den <b>Computer</b> in die Kartons. Tipp: Der Computer ist das Gehirn – er <b>verarbeitet</b>!'),
        {
            id: 'end', station: 'final', title: 'Alles aufgeräumt! 🏆', mood: 'happy',
            text: 'Du kennst jetzt das <b>EVA-Prinzip</b>: Eingabe → Verarbeitung → Ausgabe!',
            enter() {
                game.audio.success();
                prog.doneStations.push('final');
                game.hud.station(null, prog.doneStations);
                for (let i = 0; i < 6; i++) setTimeout(() => game.guide.burst(V(-1.25 + Math.random() * 0.2, 0.9, -0.4 + Math.random() * 1.0), undefined, 30, 1.4), i * 250);
                setTimeout(() => game.hud.end(game.boxes), 1600);
            },
            done: () => false,
        },
    ];
}
