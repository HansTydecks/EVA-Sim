import * as THREE from 'three';
import { PORT_TYPES } from '../interaction/cables.js';

// Ablauf der Simulation als Liste von Schritten.
// Jeder Schritt: { station, title, text, mood, enter(), exit(), done(), guide(), info }

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SPAWN = {
    mouse: [V(0.4, 0.754, 0.13), 0],
    keyboard: [V(0.0, 0.75, 0.16), 0],
    speakers: [V(-0.5, 0.75, -0.33), 0.2],
    scanner: [V(-0.34, 0.75, -0.1), 0.3],
    midi: [V(-0.42, 0.75, -0.06), 0.1],
    mic: [V(-0.42, 0.75, 0.02), 0.4],
    webcam: [V(-0.22, 0.75, 0.03), 0],
    printer: [V(-0.5, 0.75, -0.1), 0.2],
    touch: [V(-0.44, 0.75, -0.02), 0.35],
    hdd: [V(0.4, 0.75, -0.13), -0.35],
    usbstick: [V(0.3, 0.75, 0.27), 0.9],
    cd: [V(0.68, 0.75, 0.22), 0],
};
const RADIO_SPAWN = [V(-0.53, 0.75, 0.07), 0.4];

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
        // Eine laufende Rückmeldung (z. B. "Richtig!") noch zu Ende zeigen
        // (Info-Schritte mit "Weiter"-Knopf aber immer sofort zeigen)
        if (s.info || this.interjectT <= 0) { this.interjectT = 0; this.showHint(); }
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
    }

    activity() { this.idle = 0; }

    update(dt) {
        const s = this.step;
        if (!s) return;
        if (this.interjectT > 0) {
            this.interjectT -= dt;
            // (Info-Schritte mit "Weiter"-Knopf aber immer sofort zeigen)
        if (s.info || this.interjectT <= 0) { this.interjectT = 0; this.showHint(); }
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
    const own = game.ports.filter(p => p.type === dev.plug.type && !p.external);
    return own.find(p => !p.plug) || own[0];
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
            from: () => (dev().plugged || dev().held ? null : dev().plug.object.position.clone()),
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
    const ST = () => game.storage;
    let extraIdle = 0, lastExtra = '';
    const spawn = id => { const [p, yaw] = SPAWN[id]; D[id].spawn(p, yaw); };

    return [
        // ---------------- Tutorial
        waitStep(game, 'intro', 'monitor', 'Hallo, ich bin Byte! 👋',
            'Deine Maus ist jetzt deine <b>Hand</b>. <b>Halte die linke Maustaste gedrückt</b>, um etwas zu greifen, und lass los, um es abzulegen.<br>Probier es aus: <b>Nimm die Tasse und stell sie woanders hin!</b>',
            () => F.mugMoved,
            {
                mood: 'happy',
                guide: () => ({ from: () => game.itemsById.mug.object.position.clone().setY(0.87), to: () => V(0.25, 0.8, 0.29) }),
            }),
        waitStep(game, 'look', 'monitor', 'Schau dich um! 👀',
            'Fahre mit der Maus an den <b>linken Bildschirmrand</b> (oder klicke auf <b>◀ Kartons</b>). Dort stehen vier Kartons: <b style="color:#6fdc98">EINGABE</b>, <b style="color:#7fb0f5">VERARBEITUNG</b>, <b style="color:#ffb066">AUSGABE</b> und <b style="color:#5fd6d6">SPEICHER</b>.',
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
        waitStep(game, 'save_try', 'keyboard', '💾 Und jetzt: speichern!',
            'Super getippt! Damit dein Text nicht verloren geht, musst du ihn <b>speichern</b>. Drück <b>Strg + S</b> (oder einfach <b>Enter</b>) – so wie in echten Programmen.',
            () => F.saveFailed,
            { mood: 'happy', enter() { game.hand.exitMouseMode(); game.computer.startApp('editor'); }, controls: '<b>Strg + S</b> oder <b>Enter:</b> speichern' }),
        waitStep(game, 'hdd_spawn', 'keyboard', '💽 Eine Festplatte!', '', () => true, { enter() { spawn('hdd'); } }),
        plugStep(game, 'hdd', 'keyboard', {
            title: '😮 Kein Speicher!',
            text: 'Der Computer weiß nicht, <b>wohin</b> mit deinem Text – ihm fehlt ein <b>Speicher</b>! Da ist eine <b>Festplatte</b> aufgetaucht. Steck ihr <b style="color:#2f7cf6">blaues USB-Kabel</b> in eine <b style="color:#2f7cf6">blaue USB-Buchse</b>.<br><small>Meistens ist die Festplatte im Computer eingebaut – diese hier ist eine externe.</small>',
            mood: 'thinking',
        }),
        waitStep(game, 'save_hdd', 'keyboard', '💾 Jetzt klappt es!',
            'Drück noch einmal <b>Strg + S</b> (oder Enter). Hörst du die Festplatte <b>rattern</b>? Sie schreibt deinen Text auf ihre Scheibe.',
            () => F.saved,
            { enter() { if (!game.computer.app?.trySave) game.computer.startApp('editor'); }, controls: '<b>Strg + S</b> oder <b>Enter:</b> speichern' }),
        waitStep(game, 'extra_type', 'keyboard', '✏️ Ein kleiner Test …',
            'Gespeichert! Tippe jetzt noch <b>deinen Namen</b> dazu – aber diesmal <b>nicht speichern</b>! Du wirst gleich sehen, warum.',
            () => F.extraTyped && extraIdle > 1.8,
            {
                enter() { extraIdle = 0; game.computer.app?.startExtra?.(); },
                update(dt) {
                    const u = ST().unsaved;
                    if (u !== lastExtra) { lastExtra = u; extraIdle = 0; } else extraIdle += dt;
                },
                controls: '<b>Echte Tastatur:</b> Namen tippen<br><b>Nicht</b> speichern!',
            }),
        waitStep(game, 'blackout', 'keyboard', 'Uiii! 😱',
            'Ich bin über das <b>Stromkabel</b> gestolpert! Der Computer ist einfach ausgegangen … Was wohl mit deinem Text passiert ist? Warte, er startet neu.',
            () => F.rebooted,
            { mood: 'sad', enter() { ST().blackout(); }, controls: 'Einen Moment …' }),
        infoStep(game, 'hdd_eva', 'keyboard', 'Puh – gerettet! 💽',
            '<b>HALLO COMPUTER</b> ist noch da: Es war auf der <b>Festplatte gespeichert</b>. Dein Name war nur im Arbeitsspeicher – und der vergisst ohne Strom alles.<br>Tastatur: <b>EINGABE</b> · Computer: <b>VERARBEITUNG</b> · Bildschirm: <b>AUSGABE</b> · Festplatte: <b>SPEICHER</b><br><small>Tastatur und Festplatte bleiben bis zum Schluss auf dem Tisch.</small>',
            'happy',
            { enter() { game.hud.eva('⌨️ Tastatur', '💻 Computer', '🖥️ Bildschirm', '💽 Festplatte'); }, exit() { game.hud.eva(null); game.computer.startApp(null); } }),

        // ---------------- Lautsprecher + Scanner
        waitStep(game, 'spk_spawn', 'scanner', '🔊 Lautsprecher!', '', () => true, { enter() { spawn('speakers'); } }),
        plugStep(game, 'speakers', 'scanner', {
            text: 'Bisher war der Computer stumm. Steck den <b style="color:#2ecc71">grünen Stecker</b> der <b>Lautsprecher</b> in die <b style="color:#2ecc71">grüne Buchse</b> am Computer!',
        }),
        waitStep(game, 'scan_spawn', 'scanner', '🏷️ Ein Barcode-Scanner!', '', () => true, {
            enter() { spawn('scanner'); game.spawnProducts(); },
        }),
        plugStep(game, 'scanner', 'scanner', {
            text: 'Hörst du den Ton? Die Lautsprecher funktionieren! Jetzt ist ein <b>Barcode-Scanner</b> wie an der Supermarkt-Kasse aufgetaucht – und ein paar <b>Einkäufe</b>. Steck sein <b style="color:#2f7cf6">blaues USB-Kabel</b> in eine <b style="color:#2f7cf6">blaue USB-Buchse</b>.',
            mood: 'happy',
        }),
        waitStep(game, 'scan_use', 'scanner', '🛒 Du bist an der Kasse!',
            'Greif den <b>Scanner</b> (linke Taste gedrückt halten) und halte ihn <b>über die Einkäufe</b> – die Cola, die Milch, die Schokolade und den Saft. Der rote Laser liest den <b>Strichcode</b>. Am Bildschirm siehst du, was erkannt wurde und was es kostet. <b>Scanne alle 4 Sachen!</b>',
            () => F.scanner,
            {
                enter() { game.computer.startApp('scanner'); },
                guide: () => ({
                    from: () => (D.scanner.held ? null : D.scanner.object.position.clone().setY(0.9)),
                    to: () => { const c = game.products.find(c => !game.computer.app?.found?.has(c.product.ean)); return c ? c.object.position.clone().setY(c.object.position.y + c.half.y * 2 + 0.08) : null; },
                }),
                controls: '<b>Scanner greifen</b> und über eine Ware halten<br>Der Laser scannt automatisch',
            }),
        infoStep(game, 'scan_eva', 'scanner', 'Fertig eingekauft! 🛒',
            'Der <b>Scanner</b> liest nur eine Nummer ein: <b>EINGABE</b>. Der Computer schaut in seiner Liste nach, welche Ware zu der Nummer gehört, und rechnet den Preis zusammen: <b>VERARBEITUNG</b>. Der <b>Bildschirm</b> zeigt Ware und Summe, die <b>Lautsprecher</b> machen „Pling“: <b>AUSGABE</b>.',
            'happy',
            { enter() { game.hud.eva('🏷️ Scanner', '💻 Computer', '🔊 Lautsprecher + 🖥️'); } }),
        sortStep(game, ['scanner'], 'scanner', '📦 Aufräumen!',
            'Den Scanner brauchen wir nicht mehr. <b>Leg ihn in den richtigen Karton!</b> Ist er ein Eingabe-, Verarbeitungs- oder Ausgabegerät?<br><small>Die Lautsprecher bleiben noch auf dem Tisch – die brauchen wir gleich wieder.</small>'),

        // ---------------- MIDI
        waitStep(game, 'midi_spawn', 'midi', '🎹 Ein MIDI-Keyboard!', '', () => true, { enter() { game.removeProducts(); game.computer.startApp(null); spawn('midi'); } }),
        plugStep(game, 'midi', 'midi'),
        waitStep(game, 'midi_use', 'midi', '🎹 Spiel die Tonleiter!',
            'Klicke mit der Hand auf die <b>Tasten des MIDI-Keyboards</b> (oder drücke <b>C D E F G A H K</b> auf deiner Tastatur). Spiel die <b>Tonleiter</b> von unten nach oben: <b>C D E F G A H C</b>. Die Taste, die als Nächstes dran ist, <b>leuchtet</b> – auf dem Keyboard und am Bildschirm!',
            () => F.scale,
            {
                enter() { game.computer.startApp('scale'); },
                guide: () => ({
                    at: () => {
                        const n = game.computer.app?.targetNote;
                        const k = n != null ? D.midi.object.userData.keys[n] : null;
                        return k ? k.getWorldPosition(new THREE.Vector3()).setY(0.84) : D.midi.object.position.clone().setY(0.82);
                    },
                }),
                controls: '<b>Klick auf eine Klaviertaste:</b> Ton spielen<br><b>Tasten C D E F G A H K:</b> auch möglich',
            }),
        infoStep(game, 'midi_eva', 'midi', 'Du bist ein Musik-Profi! 🎵',
            'Das <b>MIDI-Keyboard</b> macht selbst keinen Ton! Es schickt nur die Information „Taste C gedrückt“: <b>EINGABE</b>. Der Computer <b>VERARBEITET</b> sie und erzeugt den Klang. Die <b>Lautsprecher</b> geben ihn aus: <b>AUSGABE</b>.',
            'happy',
            { enter() { game.hud.eva('🎹 MIDI-Keyboard', '💻 Computer', '🔊 Lautsprecher + 🖥️'); }, exit() { game.hud.eva(null); } }),
        waitStep(game, 'usb_spawn', 'midi', '💾 Ein USB-Stick!', '', () => true, { enter() { spawn('usbstick'); } }),
        plugStep(game, 'usbstick', 'midi', {
            title: '💾 Ein USB-Stick!',
            text: 'Jetzt machst du <b>dein eigenes Lied</b> – und das soll nicht verloren gehen! Steck den <b>USB-Stick</b> in eine <b style="color:#2f7cf6">blaue USB-Buchse</b> am Computer. Er hat kein Kabel: Er <b>ist</b> selbst der Stecker.',
            mood: 'happy',
        }),
        waitStep(game, 'rec_use', 'midi', '● Nimm dein Lied auf!',
            'Spiel <b>8 Töne</b> auf dem MIDI-Keyboard – ganz egal welche, es ist <b>dein Lied</b>! Dann speichere es mit <b>Enter</b> (oder Strg + S) auf dem <b>USB-Stick</b>.',
            () => F.songSaved,
            {
                enter() { game.computer.startApp('record'); },
                guide: () => ({ at: () => (F.recorded ? null : D.midi.object.position.clone().setY(0.82)) }),
                controls: '<b>Klaviertasten</b> oder <b>C D E F G A H K:</b> spielen<br><b>Enter:</b> speichern · <b>⌫:</b> neu aufnehmen',
            }),
        waitStep(game, 'radio_use', 'midi', '📻 Nimm dein Lied mit!',
            'Auf dem Tisch steht jetzt ein <b>Radio</b>. Es hat auch eine USB-Buchse! <b>Zieh den USB-Stick</b> aus dem Computer und <b>steck ihn ins Radio</b>.',
            () => F.radio,
            {
                mood: 'happy',
                enter() { const [p, yaw] = RADIO_SPAWN; ST().spawnRadio(p, yaw); },
                guide: () => ({
                    from: () => (D.usbstick.held || D.usbstick.plug.port?.external ? null : D.usbstick.object.position.clone()),
                    to: () => { const rp = ST().radioPort; return rp ? rp.worldPos(new THREE.Vector3()).addScaledVector(rp.outward(new THREE.Vector3()), 0.06) : null; },
                }),
                controls: '<b>USB-Stick greifen:</b> herausziehen<br><b>Vor die Buchse am Radio halten</b> und loslassen',
            }),
        infoStep(game, 'usb_eva', 'midi', 'Dein Lied läuft! 🎶',
            'Das Radio kannte dein Lied nicht – es liest es vom <b>USB-Stick</b>. Ein Speicher merkt sich Daten, und den Stick kannst du <b>mitnehmen</b>.<br>MIDI-Keyboard: <b>EINGABE</b> · Computer: <b>VERARBEITUNG</b> · Lautsprecher: <b>AUSGABE</b> · USB-Stick: <b>SPEICHER</b>',
            'happy',
            { enter() { game.hud.eva('🎹 MIDI-Keyboard', '💻 Computer', '🔊 Lautsprecher', '💾 USB-Stick'); } }),
        sortStep(game, ['midi', 'usbstick'], 'midi', '📦 Ab in die Kartons!', 'Räum das <b>MIDI-Keyboard</b> und den <b>USB-Stick</b> in die richtigen Kartons. Für Speicher gibt es einen <b style="color:#5fd6d6">eigenen Karton</b>!'),

        // ---------------- Mikrofon
        waitStep(game, 'mic_spawn', 'mic', '🎤 Ein Studiomikrofon!', '', () => true, { enter() { ST().removeRadio(); game.computer.startApp(null); spawn('mic'); } }),
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
            { enter() { game.hand.exitMouseMode(); game.hud.eva('📷 Webcam', '💻 Computer', '🖨️ Drucker + 🖥️'); }, exit() { game.hud.eva(null); } }),
        waitStep(game, 'cd_spawn', 'camera', '💿 Eine CD!', '', () => true, { enter() { ST().burnEnabled = true; spawn('cd'); } }),
        waitStep(game, 'cd_insert', 'camera', '💿 Leg die CD ein!',
            'Dein Foto soll <b>für immer</b> bleiben – wir brennen es auf eine <b>CD</b>! Klicke oben am Computer auf das <b>CD-Laufwerk</b> (⏏), dann fährt die Schublade heraus. <b>Leg die CD hinein.</b>',
            () => D.cd.inTray,
            {
                guide: () => ({
                    at: () => (ST().trayOpen ? (D.cd.held ? ST().cdSpotWorld().setY(ST().cdSpotWorld().y + 0.03) : D.cd.object.position.clone()) : ST().ejectWorld()),
                    from: () => (ST().trayReady() && !D.cd.held ? D.cd.object.position.clone() : null),
                    to: () => ST().cdSpotWorld().setY(ST().cdSpotWorld().y + 0.02),
                }),
                controls: '<b>Klick aufs CD-Laufwerk:</b> Schublade auf/zu<br><b>CD greifen</b> und über der Schublade loslassen',
            }),
        waitStep(game, 'cd_burn', 'camera', '🔥 Brenn die CD!',
            'Die CD ist drin! Klicke in der Foto-App auf <b>„Auf CD brennen“</b> (mit der Maus) oder drücke <b>B</b> auf der Tastatur. Ein <b>Laser</b> brennt dein Foto in die CD.',
            () => F.burned,
            {
                enter() { if (!game.computer.app?.burn) game.computer.startApp('camera'); },
                controls: '<b>B</b> oder <b>Maus → „Auf CD brennen“</b>',
            }),
        infoStep(game, 'cd_eva', 'camera', 'Für immer gespeichert! 💿',
            'Schau: Dein Foto ist jetzt <b>auf der CD</b>! Webcam: <b>EINGABE</b> · Computer: <b>VERARBEITUNG</b> · Bildschirm und Drucker: <b>AUSGABE</b> · CD: <b>SPEICHER</b>.<br><small>Tipp: Wirf die CD mal wie ein Frisbee 🥏</small>',
            'happy',
            { enter() { game.hand.exitMouseMode(); game.hud.eva('📷 Webcam', '💻 Computer', '🖨️ Drucker + 🖥️', '💿 CD'); } }),
        sortStep(game, ['webcam', 'printer', 'cd'], 'camera', '📦 Drei Sachen aufräumen!', 'Sortiere die <b>Webcam</b>, den <b>Drucker</b> und die <b>CD</b> in die richtigen Kartons.'),

        // ---------------- Touchscreen
        waitStep(game, 'touch_spawn', 'touch', '📱 Ein Touchscreen!', '', () => true, { enter() { game.computer.startApp(null); spawn('touch'); } }),
        plugStep(game, 'touch', 'touch', {
            text: 'Der <b>Touchscreen</b> hat einen <b style="color:#9b59b6">lila USB-C-Stecker</b>. Steck ihn in die <b style="color:#9b59b6">lila Buchse</b>!',
        }),
        waitStep(game, 'touch_use', 'touch', '📱 Tipp auf den Bildschirm!',
            'Bedien den <b>Touchscreen</b> direkt mit der Hand (linke Maustaste) – so wie ein Tablet: <b>1. Tippen</b> (Blasen platzen lassen), <b>2. Wischen</b> (Taste halten und das Foto nach links ziehen), <b>3. Ziehen</b> (Formen in die passenden Löcher schieben).',
            () => F.touch,
            {
                enter() { game.computer.startApp('touchinfo'); game.touchApp.on = true; },
                guide: () => ({ at: () => D.touch.object.position.clone().setY(1.05) }),
                controls: '<b>Linksklick auf den Touchscreen:</b> tippen<br><b>Gedrückt halten + ziehen:</b> wischen / schieben',
            }),
        infoStep(game, 'touch_eva', 'touch', 'Ein besonderes Gerät! ✨',
            'Der <b>Touchscreen</b> kann <b>beides</b>: Er spürt deinen Finger (<b>EINGABE</b>) und zeigt Bilder (<b>AUSGABE</b>). Dazwischen <b>VERARBEITET</b> der Computer, wo du hingetippt hast.',
            'happy',
            { enter() { game.hud.eva('📱 Touch (Finger)', '💻 Computer', '📱 Touch (Bild)'); } }),
        sortStep(game, ['touch'], 'touch', '📦 Wohin damit?', 'Der Touchscreen ist Eingabe <b>und</b> Ausgabe. Such dir einen passenden Karton aus!'),

        // ---------------- Finale
        infoStep(game, 'final_intro', 'final', 'Feierabend! 🧹',
            'Du hast alle Geräte ausprobiert. Jetzt räumen wir <b>alles</b> auf: <b>Maus</b>, <b>Tastatur</b>, <b>Lautsprecher</b>, <b>Bildschirm</b>, <b>Festplatte</b> und sogar den <b>Computer</b> selbst. Wohin gehört der Computer wohl?',
            'happy',
            { enter() { game.hand.exitMouseMode(); game.touchApp.on = false; } }),
        sortStep(game, ['mouse', 'keyboard', 'speakers', 'monitor', 'hdd', 'tower'], 'final', '📦 Großes Aufräumen!',
            'Sortiere <b>Maus, Tastatur, Lautsprecher, Bildschirm, Festplatte</b> und den <b>Computer</b> in die Kartons. Tipp: Der Computer ist das Gehirn – er <b>verarbeitet</b>!'),
        {
            id: 'end', station: 'final', title: 'Alles aufgeräumt! 🏆', mood: 'happy',
            text: 'Du kennst jetzt das <b>EVAS-Prinzip</b>: Eingabe → Verarbeitung → Ausgabe – und der <b>Speicher</b> merkt sich alles!',
            enter() {
                game.audio.success();
                prog.doneStations.push('final');
                game.hud.station(null, prog.doneStations);
                for (let i = 0; i < 8; i++) setTimeout(() => { const b = game.boxes[i % game.boxes.length]; game.guide.burst(b.group.position.clone().setY(0.85), [b.hex, 0xffd43b, 0xffffff], 30, 1.4); }, i * 250);
                setTimeout(() => game.hud.end(game.boxes), 1600);
            },
            done: () => false,
        },
    ];
}
