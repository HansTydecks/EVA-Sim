import { roundRect, button, inRect, TOPBAR } from './os.js';
import { MIDI_NOTES } from '../scene/models.js';

const W = 1024, H = 640;
const FONT = 'Segoe UI, sans-serif';

function title(ctx, text, sub) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(text, W / 2, TOPBAR + 34);
    if (sub) {
        ctx.fillStyle = '#e0c5d0';
        ctx.font = `22px ${FONT}`;
        ctx.fillText(sub, W / 2, TOPBAR + 68);
    }
}

// ---------------------------------------------------------------- Memory (Maus)
const SHAPES = [
    ['circle', '#ff6b6b'], ['square', '#4dabf7'], ['triangle', '#69db7c'],
    ['star', '#ffd43b'], ['heart', '#f783ac'], ['diamond', '#9775fa'],
];

function drawShape(ctx, shape, color, cx, cy, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    switch (shape) {
        case 'circle': ctx.arc(cx, cy, r, 0, Math.PI * 2); break;
        case 'square': ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7); break;
        case 'triangle': ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); break;
        case 'diamond': ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); break;
        case 'star':
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * Math.PI / 5;
                const rr = i % 2 ? r * 0.45 : r;
                ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            break;
        case 'heart':
            ctx.moveTo(cx, cy + r * 0.9);
            ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.1, cx - r * 0.6, cy - r * 1.1, cx, cy - r * 0.4);
            ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.1, cx + r * 1.4, cy - r * 0.1, cx, cy + r * 0.9);
            break;
    }
    ctx.closePath();
    ctx.fill();
}

class MemoryApp {
    constructor(os) {
        this.os = os;
        this.title = 'Memory';
        const idx = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        const cw = 150, chh = 140, gap = 22;
        const x0 = (W - (4 * cw + 3 * gap)) / 2, y0 = TOPBAR + 100;
        this.cards = idx.map((s, i) => ({ s, open: false, matched: false, flip: 0, x: x0 + (i % 4) * (cw + gap), y: y0 + Math.floor(i / 4) * (chh + gap), w: cw, h: chh }));
        this.openCards = [];
        this.wait = 0;
        this.done = false;
        this.doneT = 0;
        this.tries = 0;
    }
    onClick(x, y) {
        if (this.wait > 0 || this.done) return;
        const c = this.cards.find(c => inRect(x, y, c));
        if (!c || c.open || c.matched) return;
        c.open = true;
        this.os.game.audio.pcBlip(660);
        this.os.game.activity();
        this.openCards.push(c);
        if (this.openCards.length === 2) {
            this.tries++;
            const [a, b] = this.openCards;
            if (a.s === b.s) {
                a.matched = b.matched = true;
                this.openCards = [];
                this.os.game.audio.pcBlip(990);
                if (this.cards.every(c => c.matched)) {
                    this.done = true;
                    this.os.showBanner('Alle Paare gefunden! 🎉', '#2fae5f', 3);
                }
            } else {
                this.wait = 0.9;
            }
        }
    }
    update(dt) {
        for (const c of this.cards) c.flip += ((c.open || c.matched ? 1 : 0) - c.flip) * Math.min(1, dt * 14);
        if (this.wait > 0) {
            this.wait -= dt;
            if (this.wait <= 0) { this.openCards.forEach(c => { c.open = false; }); this.openCards = []; }
        }
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 1.2 && !this.reported) { this.reported = true; this.os.appDone('memory'); }
        }
    }
    draw(ctx) {
        title(ctx, 'Memory: Finde alle Paare!', 'Klicke mit der Maus auf zwei Karten');
        const cur = this.os.cursor;
        for (const c of this.cards) {
            const s = Math.abs(Math.cos(c.flip * Math.PI));
            const showFace = c.flip > 0.5;
            const hover = inRect(cur.x, cur.y, c) && !c.open && !c.matched;
            ctx.save();
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.scale(Math.max(0.04, s), hover ? 1.04 : 1);
            if (showFace) {
                ctx.fillStyle = c.matched ? '#e8f8ee' : '#ffffff';
                roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 16); ctx.fill();
                if (c.matched) { ctx.strokeStyle = '#2fae5f'; ctx.lineWidth = 6; ctx.stroke(); }
                drawShape(ctx, SHAPES[c.s][0], SHAPES[c.s][1], 0, 0, 42);
            } else {
                ctx.fillStyle = hover ? '#e092b0' : '#d67c9c';
                roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 16); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.font = `bold 64px ${FONT}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('?', 0, 4);
            }
            ctx.restore();
        }
    }
}

// ---------------------------------------------------------------- Tippen (Tastatur)
class TypingApp {
    constructor(os) {
        this.os = os;
        this.title = 'Textverarbeitung';
        this.target = 'HALLO COMPUTER';
        this.typed = '';
        this.err = 0;
        this.wrong = '';
        this.last = '';
        this.lastT = 0;
        this.done = false;
        this.doneT = 0;
    }
    onKey(e) {
        if (this.done) return true;
        let k = e.key;
        if (k.length !== 1) return false;
        k = k.toUpperCase();
        this.last = k === ' ' ? '␣' : k;
        this.lastT = 0.6;
        const next = this.target[this.typed.length];
        if (k === next) {
            this.typed += k;
            this.os.game.audio.pcBlip(520 + this.typed.length * 30);
            if (this.typed === this.target) {
                this.done = true;
                this.os.showBanner('Super getippt! 🎉', '#2fae5f', 3);
            }
        } else {
            this.err = 0.5;
            this.wrong = this.last;
        }
        return true;
    }
    update(dt) {
        this.err = Math.max(0, this.err - dt);
        this.lastT = Math.max(0, this.lastT - dt);
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 1.2 && !this.reported) { this.reported = true; this.os.appDone('typing'); }
        }
    }
    draw(ctx) {
        title(ctx, 'Tippe auf deiner Tastatur:', 'Jeder Tastendruck wird vom Computer verarbeitet und hier angezeigt');
        const n = this.target.length;
        const bw = 58, gap = 8;
        const x0 = (W - (n * bw + (n - 1) * gap)) / 2;
        const y = 230;
        const shake = this.err > 0 ? Math.sin(this.err * 60) * 6 : 0;
        for (let i = 0; i < n; i++) {
            const ch = this.target[i];
            const x = x0 + i * (bw + gap) + (i === this.typed.length ? shake : 0);
            const doneCh = i < this.typed.length;
            const isNext = i === this.typed.length;
            if (ch === ' ') {
                ctx.fillStyle = doneCh ? '#2fae5f' : isNext ? '#d67c9c' : 'rgba(255,255,255,0.15)';
                roundRect(ctx, x + 8, y + 70, bw - 16, 8, 4); ctx.fill();
                continue;
            }
            ctx.fillStyle = doneCh ? '#2fae5f' : isNext ? (this.err > 0 ? '#e74c3c' : '#ffffff') : 'rgba(255,255,255,0.12)';
            roundRect(ctx, x, y, bw, 80, 10); ctx.fill();
            ctx.fillStyle = doneCh ? '#fff' : isNext ? '#4a1f3a' : 'rgba(255,255,255,0.55)';
            ctx.font = `bold 48px ${FONT}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(ch, x + bw / 2, y + 42);
        }
        // Zuletzt gedrückte Taste
        ctx.fillStyle = '#e0c5d0';
        ctx.font = `24px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('Zuletzt gedrückt:', W / 2, 400);
        if (this.last) {
            const s = 1 + this.lastT * 0.4;
            ctx.save();
            ctx.translate(W / 2, 470);
            ctx.scale(s, s);
            ctx.fillStyle = this.err > 0 ? '#e74c3c' : '#d67c9c';
            roundRect(ctx, -45, -40, 90, 80, 14); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold 50px ${FONT}`;
            ctx.textBaseline = 'middle';
            ctx.fillText(this.last, 0, 2);
            ctx.restore();
        }
        if (this.err > 0) {
            ctx.fillStyle = '#ffb3b3';
            ctx.font = `bold 24px ${FONT}`;
            ctx.fillText(`„${this.wrong}“ ist nicht der nächste Buchstabe – gesucht: „${this.target[this.typed.length] === ' ' ? 'Leertaste' : this.target[this.typed.length]}“`, W / 2, 570);
        }
    }
}

// ---------------------------------------------------------------- Scanner
export const SCAN_CODES = {
    '12345': { note: 'G', freq: 392.0, color: '#ff6b6b' },
    '67890': { note: 'A', freq: 440.0, color: '#ffa94d' },
    'ABCDE': { note: 'H', freq: 493.88, color: '#69db7c' },
    'HELLO': { note: 'D', freq: 587.33, color: '#4dabf7' },
    'WORLD': { note: 'E', freq: 659.25, color: '#9775fa' },
};

class ScannerApp {
    constructor(os) {
        this.os = os;
        this.title = 'Kassen-Programm';
        this.found = new Set();
        this.last = null;
        this.flash = 0;
        this.done = false;
        this.doneT = 0;
    }
    scan(code) {
        const c = SCAN_CODES[code];
        if (!c) return;
        this.last = code;
        this.flash = 1;
        this.os.game.audio.note(c.freq, 0.9);
        const isNew = !this.found.has(code);
        this.found.add(code);
        if (isNew && this.found.size === 5 && !this.done) {
            this.done = true;
            this.os.showBanner('Alle 5 Codes gescannt! 🎉', '#2fae5f', 3);
            // kleine Melodie zur Belohnung
            ['12345', '67890', 'ABCDE', 'HELLO', 'WORLD'].forEach((k, i) => this.os.game.audio.tone(SCAN_CODES[k].freq, 0.3, { type: 'triangle', vol: 0.18, bus: 'pc', delay: 0.9 + i * 0.16 }));
        }
        return isNew;
    }
    update(dt) {
        this.flash = Math.max(0, this.flash - dt * 1.5);
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 2.2 && !this.reported) { this.reported = true; this.os.appDone('scanner'); }
        }
    }
    draw(ctx) {
        title(ctx, 'Scanne die Strichcodes!', `${this.found.size} von 5 Codes gefunden`);
        // Anzeige
        ctx.fillStyle = this.flash > 0 ? `rgba(47,174,95,${0.3 + this.flash * 0.6})` : 'rgba(0,0,0,0.35)';
        roundRect(ctx, 212, 160, 600, 200, 24); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (this.last) {
            const c = SCAN_CODES[this.last];
            ctx.fillStyle = '#fff';
            ctx.font = `bold 76px Courier New, monospace`;
            ctx.fillText(this.last, W / 2, 235);
            ctx.font = `bold 32px ${FONT}`;
            ctx.fillStyle = c.color;
            ctx.fillText(`♪ Ton ${c.note}`, W / 2, 315);
        } else {
            ctx.fillStyle = '#e0c5d0';
            ctx.font = `30px ${FONT}`;
            ctx.fillText('Bereit … warte auf einen Code', W / 2, 260);
        }
        // Liste
        const keys = Object.keys(SCAN_CODES);
        keys.forEach((k, i) => {
            const x = 112 + i * 166, y = 420;
            const ok = this.found.has(k);
            ctx.fillStyle = ok ? SCAN_CODES[k].color : 'rgba(255,255,255,0.1)';
            roundRect(ctx, x, y, 140, 110, 14); ctx.fill();
            ctx.fillStyle = ok ? '#fff' : 'rgba(255,255,255,0.4)';
            ctx.font = `bold 28px Courier New, monospace`;
            ctx.fillText(ok ? k : '?????', x + 70, y + 40);
            ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(ok ? `♪ ${SCAN_CODES[k].note}` : '', x + 70, y + 80);
        });
    }
}

// ---------------------------------------------------------------- Runner (MIDI-Keyboard)
class RunnerApp {
    constructor(os) {
        this.os = os;
        this.title = 'Noten-Läufer';
        this.lanes = 8;
        this.top = TOPBAR + 80;
        this.laneH = (H - this.top - 20) / this.lanes;
        this.playerLane = 3;
        this.playerY = this.laneY(3);
        this.obstacles = [];
        this.spawnT = 1.2;
        this.score = 0;
        this.goal = 12;
        this.started = false;
        this.hitFlash = 0;
        this.keyFlash = new Array(8).fill(0);
        this.done = false;
        this.doneT = 0;
        this.speed = 230;
    }
    laneY(i) { return this.top + (this.lanes - 1 - i) * this.laneH + this.laneH / 2; }
    noteOn(i) {
        this.playerLane = i;
        this.keyFlash[i] = 1;
        this.started = true;
        this.os.game.audio.note(MIDI_NOTES[i].freq, 0.6);
    }
    update(dt) {
        this.keyFlash = this.keyFlash.map(v => Math.max(0, v - dt * 3));
        this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
        this.playerY += (this.laneY(this.playerLane) - this.playerY) * Math.min(1, dt * 14);
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 1.5 && !this.reported) { this.reported = true; this.os.appDone('runner'); }
            return;
        }
        if (!this.started) return;
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
            this.spawnT = Math.max(1.0, 1.9 - this.score * 0.05);
            const len = 1 + Math.floor(Math.random() * 3);
            let start = Math.floor(Math.random() * (this.lanes - len + 1));
            // nicht immer genau auf den Spieler
            const lanes = [];
            for (let i = 0; i < len; i++) lanes.push(start + i);
            this.obstacles.push({ x: W + 40, lanes, passed: false });
        }
        const px = 150;
        for (const o of this.obstacles) {
            o.x -= this.speed * dt * (1 + this.score * 0.02);
            const curLane = Math.round(this.lanes - 1 - (this.playerY - this.top - this.laneH / 2) / this.laneH);
            if (!o.passed && !o.hit && o.x < px + 26 && o.x + 40 > px - 26 && o.lanes.includes(curLane)) {
                o.hit = true;
                this.hitFlash = 1;
                this.score = Math.max(0, this.score - 2);
                this.os.game.audio.tone(140, 0.25, { type: 'sawtooth', vol: 0.12, bus: 'pc' });
            }
            if (!o.passed && o.x + 40 < px - 26) {
                o.passed = true;
                if (!o.hit) {
                    this.score++;
                    if (this.score >= this.goal) {
                        this.done = true;
                        this.os.showBanner(`${this.goal} Punkte geschafft! 🎉`, '#2fae5f', 3);
                    }
                }
            }
        }
        this.obstacles = this.obstacles.filter(o => o.x > -80);
    }
    draw(ctx) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = `bold 30px ${FONT}`;
        ctx.fillText(`Weiche aus!  Punkte: ${this.score} / ${this.goal}`, W / 2, TOPBAR + 36);
        for (let i = 0; i < this.lanes; i++) {
            const y = this.laneY(i) - this.laneH / 2;
            ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
            ctx.fillRect(0, y, W, this.laneH);
            const n = MIDI_NOTES[i];
            ctx.fillStyle = n.color;
            ctx.globalAlpha = 0.45 + this.keyFlash[i] * 0.55;
            roundRect(ctx, 8, y + 4, 62, this.laneH - 8, 10); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(n.name, 39, y + this.laneH / 2);
        }
        for (const o of this.obstacles) {
            for (const l of o.lanes) {
                const y = this.laneY(l) - this.laneH / 2;
                ctx.fillStyle = o.hit ? '#7a3a3a' : '#e74c3c';
                roundRect(ctx, o.x, y + 6, 40, this.laneH - 12, 8); ctx.fill();
            }
        }
        // Spieler
        ctx.fillStyle = this.hitFlash > 0 ? '#ff7777' : '#ffd43b';
        ctx.beginPath(); ctx.arc(150, this.playerY, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a1f3a';
        ctx.beginPath(); ctx.arc(158, this.playerY - 6, 4, 0, Math.PI * 2); ctx.fill();
        if (!this.started) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, 212, 260, 600, 120, 20); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold 32px ${FONT}`;
            ctx.fillText('Spiele eine Note zum Starten!', W / 2, 300);
            ctx.font = `24px ${FONT}`;
            ctx.fillText('Jede Taste bringt dich auf eine andere Bahn', W / 2, 345);
        }
    }
}

// ---------------------------------------------------------------- Singen (Mikrofon)
const NOTE_NAMES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];
export function noteName(f) {
    const n = Math.round(12 * Math.log2(f / 440) + 69);
    return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

class SingApp {
    constructor(os) {
        this.os = os;
        this.title = 'Stimm-Analyse';
        this.target = 261.63;
        this.pitch = 196;
        this.singing = false;
        this.hold = 0;
        this.need = 1.5;
        this.history = [];
        this.acc = 0;
        this.done = false;
        this.doneT = 0;
        this.fMin = 130; this.fMax = 520;
    }
    stop() { this.os.game.audio.voiceStop(); }
    setSinging(on) {
        if (this.done && on) return;
        if (on === this.singing) return;
        this.singing = on;
        if (on) this.os.game.audio.voiceStart(this.pitch); else this.os.game.audio.voiceStop();
    }
    shift(semitones) {
        this.pitch = Math.min(this.fMax * 0.98, Math.max(this.fMin * 1.02, this.pitch * Math.pow(2, semitones / 12)));
        this.os.game.audio.voiceFreq(this.pitch);
    }
    yOf(f) {
        const t = Math.log(f / this.fMin) / Math.log(this.fMax / this.fMin);
        return H - 40 - t * (H - 40 - TOPBAR - 100);
    }
    get hitting() { return this.singing && Math.abs(Math.log2(this.pitch / this.target) * 12) < 0.5; }
    update(dt) {
        this.acc += dt;
        while (this.acc > 1 / 30) {
            this.acc -= 1 / 30;
            this.history.push(this.singing ? this.pitch : null);
            if (this.history.length > 200) this.history.shift();
        }
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 1.6 && !this.reported) { this.reported = true; this.os.appDone('sing'); }
            return;
        }
        if (this.hitting) {
            this.hold += dt;
            if (this.hold >= this.need) {
                this.done = true;
                this.setSinging(false);
                this.os.showBanner('Du hast ein C gesungen! 🎉', '#2fae5f', 3);
            }
        } else {
            this.hold = 0;
        }
    }
    draw(ctx) {
        title(ctx, 'Singe ein C!', 'Triff die rote Linie und halte den Ton 1,5 Sekunden');
        const x0 = 90, x1 = W - 40;
        // Notenlinien
        ctx.font = `20px ${FONT}`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (const [n, f] of [['G3', 196], ['C4', 261.63], ['E4', 329.63], ['G4', 392], ['C5', 523.25], ['C3', 130.81], ['E3', 164.81]]) {
            const y = this.yOf(f);
            if (y < TOPBAR + 90 || y > H - 30) continue;
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(n.replace('H', 'H'), x0 - 10, y);
        }
        // Ziel
        const ty = this.yOf(this.target);
        const band = this.yOf(this.target * Math.pow(2, -0.5 / 12)) - ty;
        ctx.fillStyle = this.hitting ? 'rgba(47,174,95,0.35)' : 'rgba(255,80,80,0.18)';
        ctx.fillRect(x0, ty - band, x1 - x0, band * 2);
        ctx.strokeStyle = this.hitting ? '#2fae5f' : '#ff4d4d';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x1, ty); ctx.stroke();
        ctx.fillStyle = '#ff4d4d';
        ctx.font = `bold 24px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText('Ziel: C', x1 - 110, ty - 22);
        // Verlauf
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let pen = false;
        const n = this.history.length;
        this.history.forEach((f, i) => {
            const x = x1 - (n - 1 - i) * ((x1 - x0) / 200);
            if (f == null) { pen = false; return; }
            const y = this.yOf(f);
            if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        // aktueller Ton
        const cy = this.yOf(this.pitch);
        ctx.fillStyle = this.singing ? '#ffd43b' : 'rgba(255,212,59,0.35)';
        ctx.beginPath(); ctx.arc(x1, cy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'right';
        ctx.font = `bold 26px ${FONT}`;
        ctx.fillStyle = '#fff';
        ctx.fillText(this.singing ? `♪ ${noteName(this.pitch)}` : '(still)', x1 - 26, cy - 26);
        // Fortschritt
        const p = Math.min(1, this.hold / this.need);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, 312, H - 34, 400, 18, 9); ctx.fill();
        ctx.fillStyle = '#2fae5f';
        roundRect(ctx, 312, H - 34, 400 * p, 18, 9); ctx.fill();
    }
}

// ---------------------------------------------------------------- Kamera + Drucker
const FILTERS = [
    ['normal', 'Normal'], ['gray', 'Schwarz-Weiß'], ['sepia', 'Sepia'], ['negative', 'Negativ'], ['pixel', 'Pixel'],
];

export class CameraApp {
    constructor(os) {
        this.os = os;
        this.title = 'Foto-Studio';
        this.fw = 320; this.fh = 200;
        this.feed = document.createElement('canvas');
        this.feed.width = this.fw; this.feed.height = this.fh;
        this.fctx = this.feed.getContext('2d');
        this.img = this.fctx.createImageData(this.fw, this.fh);
        this.hasFrame = false;
        this.filter = 'normal';
        this.preview = { x: 40, y: TOPBAR + 70, w: 640, h: 400 };
        this.filterBtns = FILTERS.map((f, i) => ({ id: f[0], label: f[1], x: 712, y: TOPBAR + 70 + i * 62, w: 280, h: 52 }));
        this.shutter = { x: 712, y: TOPBAR + 400, w: 280, h: 72 };
        this.flash = 0;
        this.printing = 0;
        this.photos = 0;
        this.msg = '';
        this.msgT = 0;
    }
    setFrame(pixels) {
        // pixels: Uint8Array RGBA, unten-links zuerst (WebGL)
        const d = this.img.data, w = this.fw, h = this.fh;
        const f = this.filter;
        for (let y = 0; y < h; y++) {
            const src = (h - 1 - y) * w * 4, dst = y * w * 4;
            for (let x = 0; x < w * 4; x += 4) {
                let r = pixels[src + x], g = pixels[src + x + 1], b = pixels[src + x + 2];
                if (f === 'gray') { const l = r * 0.3 + g * 0.59 + b * 0.11; r = g = b = l; }
                else if (f === 'sepia') { const rr = r * 0.393 + g * 0.769 + b * 0.189, gg = r * 0.349 + g * 0.686 + b * 0.168, bb = r * 0.272 + g * 0.534 + b * 0.131; r = rr; g = gg; b = bb; }
                else if (f === 'negative') { r = 255 - r; g = 255 - g; b = 255 - b; }
                d[dst + x] = r; d[dst + x + 1] = g; d[dst + x + 2] = b; d[dst + x + 3] = 255;
            }
        }
        if (f === 'pixel') {
            const s = 10;
            for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
                const i = (y * w + x) * 4;
                for (let yy = y; yy < Math.min(h, y + s); yy++) for (let xx = x; xx < Math.min(w, x + s); xx++) {
                    const j = (yy * w + xx) * 4;
                    d[j] = d[i]; d[j + 1] = d[i + 1]; d[j + 2] = d[i + 2];
                }
            }
        }
        this.fctx.putImageData(this.img, 0, 0);
        this.hasFrame = true;
    }
    onClick(x, y) {
        for (const b of this.filterBtns) if (inRect(x, y, b)) { this.filter = b.id; this.os.game.audio.pcBlip(700); this.os.game.activity(); return; }
        if (inRect(x, y, this.shutter)) this.takePhoto();
    }
    onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') { this.takePhoto(); return true; }
        return false;
    }
    say(m) { this.msg = m; this.msgT = 3; }
    takePhoto() {
        const g = this.os.game;
        if (this.printing > 0) return;
        if (!g.devices.webcam?.plugged || !this.hasFrame) { this.say('Keine Kamera verbunden!'); g.audio.error(); return; }
        this.flash = 1;
        g.audio.noise(0.08, { vol: 0.25, freq: 3000, bus: 'pc' });
        g.activity();
        if (!g.devices.printer?.plugged) { this.say('Foto gemacht – aber kein Drucker verbunden!'); g.emit('printFailed'); return; }
        const photo = document.createElement('canvas');
        photo.width = this.fw; photo.height = this.fh;
        photo.getContext('2d').drawImage(this.feed, 0, 0);
        this.printing = 3;
        this.photos++;
        this.say('Wird gedruckt …');
        g.emit('print', photo);
    }
    update(dt) {
        this.flash = Math.max(0, this.flash - dt * 2.5);
        this.msgT = Math.max(0, this.msgT - dt);
        if (this.printing > 0) this.printing = Math.max(0, this.printing - dt);
    }
    draw(ctx) {
        const p = this.preview;
        ctx.fillStyle = '#000';
        roundRect(ctx, p.x - 6, p.y - 6, p.w + 12, p.h + 12, 12); ctx.fill();
        if (this.hasFrame && this.os.game.devices.webcam?.plugged) {
            ctx.imageSmoothingEnabled = this.filter !== 'pixel';
            ctx.drawImage(this.feed, p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(p.x + 24, p.y + 24, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('LIVE', p.x + 40, p.y + 25);
        } else {
            ctx.fillStyle = '#e0c5d0'; ctx.font = `28px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Keine Kamera verbunden', p.x + p.w / 2, p.y + p.h / 2);
        }
        if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(p.x, p.y, p.w, p.h); }
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff'; ctx.font = `bold 22px ${FONT}`;
        ctx.fillText('Filter:', 712, TOPBAR + 50);
        const cur = this.os.cursor;
        for (const b of this.filterBtns) button(ctx, b, b.label, { color: '#7a4a66', hover: inRect(cur.x, cur.y, b), active: this.filter === b.id, font: `bold 24px ${FONT}` });
        button(ctx, this.shutter, this.printing > 0 ? 'Druckt …' : '📸 Foto + Drucken', { color: '#2fae5f', hover: inRect(cur.x, cur.y, this.shutter), font: `bold 26px ${FONT}` });
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0c5d0';
        ctx.font = `20px ${FONT}`;
        ctx.fillText('Klicken oder Leertaste', this.shutter.x + this.shutter.w / 2, this.shutter.y + this.shutter.h + 22);
        if (this.msgT > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            roundRect(ctx, p.x + 60, p.y + p.h - 70, p.w - 120, 54, 14); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(this.msg, p.x + p.w / 2, p.y + p.h - 42);
        }
    }
}

// ---------------------------------------------------------------- Touchscreen-Hinweis auf dem Hauptmonitor
class TouchInfoApp {
    constructor(os) { this.os = os; this.title = 'Touchscreen'; }
    draw(ctx) {
        title(ctx, 'Der Touchscreen ist verbunden!', 'Schau auf den kleinen Bildschirm und tippe die Blasen an');
        ctx.font = `bold 120px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e092b0';
        ctx.fillText('👉 📱', W / 2, 360);
    }
}

export const APPS = {
    memory: MemoryApp,
    typing: TypingApp,
    scanner: ScannerApp,
    runner: RunnerApp,
    sing: SingApp,
    camera: CameraApp,
    touchinfo: TouchInfoApp,
};

// ---------------------------------------------------------------- Touch-App auf dem Touchscreen-Gerät
export class TouchApp {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.w = canvas.width; this.h = canvas.height;
        this.bubbles = [];
        this.pops = [];
        this.trail = [];
        this.spawnT = 0;
        this.popped = 0;
        this.goal = 8;
        this.done = false;
        this.doneT = 0;
        this.on = false;
    }
    touch(u, v) {
        if (!this.on) return;
        const x = u * this.w, y = (1 - v) * this.h;
        this.trail.push({ x, y, t: 0.8, c: `hsl(${(performance.now() / 5) % 360},90%,65%)` });
        for (const b of this.bubbles) {
            if (!b.dead && Math.hypot(b.x - x, b.y - y) < b.r + 10) {
                b.dead = true;
                this.popped++;
                this.pops.push({ x: b.x, y: b.y, r: b.r, t: 0.4, c: b.c });
                this.game.audio.tone(500 + Math.random() * 500, 0.12, { type: 'sine', vol: 0.2, bus: 'pc', slideTo: 1200 });
                this.game.activity();
                if (this.popped >= this.goal && !this.done) this.done = true;
                break;
            }
        }
    }
    update(dt) {
        if (!this.on) return;
        this.spawnT -= dt;
        if (this.spawnT <= 0 && !this.done) {
            this.spawnT = 0.9;
            this.bubbles.push({ x: 40 + Math.random() * (this.w - 80), y: this.h + 40, r: 30 + Math.random() * 18, vy: 50 + Math.random() * 40, c: `hsl(${Math.random() * 360},80%,65%)` });
        }
        for (const b of this.bubbles) b.y -= b.vy * dt;
        this.bubbles = this.bubbles.filter(b => !b.dead && b.y > -60);
        this.pops.forEach(p => p.t -= dt);
        this.pops = this.pops.filter(p => p.t > 0);
        this.trail.forEach(p => p.t -= dt);
        this.trail = this.trail.filter(p => p.t > 0);
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 1.2 && !this.reported) { this.reported = true; this.game.emit('appDone', 'touch'); }
        }
        this.draw();
    }
    draw() {
        const ctx = this.ctx, w = this.w, h = this.h;
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#1d3557'); gr.addColorStop(1, '#3e1e2e');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
        for (const p of this.trail) {
            ctx.globalAlpha = p.t;
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const b of this.bubbles) {
            ctx.fillStyle = b.c;
            ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        for (const p of this.pops) {
            ctx.globalAlpha = p.t / 0.4;
            ctx.strokeStyle = p.c;
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + (0.4 - p.t) * 3), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = `bold 30px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(this.done ? 'Super! 🎉' : `Tippe die Blasen an: ${this.popped} / ${this.goal}`, w / 2, 12);
    }
}
