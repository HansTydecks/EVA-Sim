import { roundRect, button, inRect, TOPBAR } from './os.js';
import { MIDI_NOTES } from '../scene/models.js';
import { PRODUCTS, PRODUCT_BY_EAN, formatEan, euro } from '../game/products.js';

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


// ---------------------------------------------------------------- Kasse (Barcode-Scanner)
class ScannerApp {
    constructor(os) {
        this.os = os;
        this.title = 'Kasse';
        this.cart = [];
        this.last = null;
        this.lastNew = false;
        this.flash = 0;
        this.done = false;
        this.doneT = 0;
    }
    get found() { return new Set(this.cart.map(p => p.ean)); }
    scan(code) {
        const p = PRODUCT_BY_EAN[code];
        if (!p) return false;
        this.last = p;
        this.flash = 1;
        const isNew = !this.cart.includes(p);
        this.lastNew = isNew;
        if (isNew) this.cart.push(p);
        this.os.game.audio.kaching();
        if (isNew && this.cart.length === PRODUCTS.length && !this.done) {
            this.done = true;
            this.os.showBanner('Alles gescannt – danke für Ihren Einkauf! 🎉', '#2fae5f', 3);
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.os.game.audio.tone(f, 0.3, { type: 'triangle', vol: 0.16, bus: 'pc', delay: 0.5 + i * 0.13 }));
        }
        return isNew;
    }
    update(dt) {
        this.flash = Math.max(0, this.flash - dt * 1.2);
        if (this.done) {
            this.doneT += dt;
            if (this.doneT > 2.4 && !this.reported) { this.reported = true; this.os.appDone('scanner'); }
        }
    }
    draw(ctx) {
        title(ctx, '🛒 Kasse – scanne deine Einkäufe!', `${this.cart.length} von ${PRODUCTS.length} Einkäufen gescannt`);
        ctx.textBaseline = 'middle';
        // linke Seite: was der Scanner gerade erkannt hat
        const x0 = 40, y0 = 160, w0 = 560, h0 = 420;
        ctx.fillStyle = this.flash > 0 ? `rgba(47,174,95,${0.25 + this.flash * 0.5})` : 'rgba(0,0,0,0.35)';
        roundRect(ctx, x0, y0, w0, h0, 24); ctx.fill();
        ctx.textAlign = 'center';
        if (this.last) {
            const p = this.last;
            ctx.fillStyle = '#b8f5c9'; ctx.font = `bold 30px ${FONT}`;
            ctx.fillText('✅ Barcode erkannt:', x0 + w0 / 2, y0 + 40);
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 46px Courier New, monospace`;
            ctx.fillText(formatEan(p.ean), x0 + w0 / 2, y0 + 96);
            ctx.fillStyle = '#e0c5d0'; ctx.font = `24px ${FONT}`;
            ctx.fillText('⬇ Computer sucht die Nummer in seiner Liste ⬇', x0 + w0 / 2, y0 + 150);
            ctx.font = `110px ${FONT}`;
            ctx.fillText(p.emoji, x0 + w0 / 2, y0 + 250);
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 40px ${FONT}`;
            ctx.fillText(p.name, x0 + w0 / 2, y0 + 340);
            ctx.fillStyle = '#ffd43b'; ctx.font = `bold 36px ${FONT}`;
            ctx.fillText(this.lastNew ? euro(p.price) : '✓ ist schon im Einkaufswagen', x0 + w0 / 2, y0 + 388);
        } else {
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${FONT}`;
            ctx.fillText('Bereit …', x0 + w0 / 2, y0 + 150);
            ctx.fillStyle = '#e0c5d0'; ctx.font = `26px ${FONT}`;
            ctx.fillText('Halte den Scanner über eine Ware.', x0 + w0 / 2, y0 + 210);
            ctx.fillText('Der rote Laser liest den Strichcode.', x0 + w0 / 2, y0 + 250);
            ctx.font = `80px ${FONT}`;
            ctx.fillText(PRODUCTS.map(p => p.emoji).join(' '), x0 + w0 / 2, y0 + 340);
        }
        // rechte Seite: Kassenbon
        const x1 = 630, y1 = 160, w1 = 354, h1 = 420;
        ctx.fillStyle = '#fffdf6';
        roundRect(ctx, x1, y1, w1, h1, 12); ctx.fill();
        ctx.fillStyle = '#4a1f3a'; ctx.font = `bold 28px ${FONT}`;
        ctx.fillText('Kassenbon 🧾', x1 + w1 / 2, y1 + 36);
        ctx.fillStyle = '#ccc'; ctx.fillRect(x1 + 20, y1 + 62, w1 - 40, 2);
        ctx.font = `24px ${FONT}`;
        this.cart.forEach((p, i) => {
            const y = y1 + 96 + i * 46;
            ctx.textAlign = 'left'; ctx.fillStyle = '#333';
            ctx.fillText(`${p.emoji} ${p.name}`, x1 + 20, y);
            ctx.textAlign = 'right';
            ctx.fillText(euro(p.price), x1 + w1 - 20, y);
        });
        for (let i = this.cart.length; i < PRODUCTS.length; i++) {
            ctx.textAlign = 'left'; ctx.fillStyle = '#bbb';
            ctx.fillText('· · ·', x1 + 20, y1 + 96 + i * 46);
        }
        const sum = this.cart.reduce((a, p) => a + p.price, 0);
        ctx.fillStyle = '#4a1f3a'; ctx.fillRect(x1 + 20, y1 + h1 - 80, w1 - 40, 3);
        ctx.font = `bold 30px ${FONT}`;
        ctx.textAlign = 'left'; ctx.fillText('SUMME', x1 + 20, y1 + h1 - 42);
        ctx.textAlign = 'right'; ctx.fillText(euro(sum), x1 + w1 - 20, y1 + h1 - 42);
    }
}

// ---------------------------------------------------------------- Tonleiter (MIDI-Keyboard)
const SCALE = [0, 1, 2, 3, 4, 5, 6, 7];
const ENTCHEN = [0, 1, 2, 3, 4, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 4, 3, 3, 3, 3, 2, 2, 1, 1, 1, 1, 0];

class ScaleApp {
    constructor(os) {
        this.os = os;
        this.title = 'Tonleiter';
        this.phase = 'scale';
        this.seq = SCALE;
        this.pos = 0;
        this.keyFlash = new Array(8).fill(0);
        this.okFlash = 0;
        this.wrong = null;
        this.wrongT = 0;
        this.done = false;
        this.doneT = 0;
        this.t = 0;
    }
    get targetNote() { return this.pos < this.seq.length ? this.seq[this.pos] : null; }
    noteOn(i) {
        this.keyFlash[i] = 1;
        this.os.game.audio.note(MIDI_NOTES[i].freq, 0.6);
        const tgt = this.targetNote;
        if (tgt === null) return;
        if (i === tgt) {
            this.pos++;
            this.okFlash = 1;
            this.wrongT = 0;
            if (this.pos >= this.seq.length) this.finish();
        } else {
            this.wrong = i;
            this.wrongT = 2.2;
        }
    }
    finish() {
        const a = this.os.game.audio;
        if (this.phase === 'scale') {
            this.done = true;
            this.os.showBanner('Tonleiter geschafft! 🎉', '#2fae5f', 3);
            [0, 2, 4, 7].forEach((n, k) => a.tone(MIDI_NOTES[n].freq, 0.5, { type: 'triangle', vol: 0.15, bus: 'pc', delay: 0.7 + k * 0.05 }));
        } else {
            this.os.showBanner('Alle meine Entchen – super gespielt! 🦆', '#2fae5f', 3.5);
            a.success();
            this.phase = 'free';
        }
    }
    update(dt) {
        this.t += dt;
        this.keyFlash = this.keyFlash.map(v => Math.max(0, v - dt * 3));
        this.okFlash = Math.max(0, this.okFlash - dt * 2.5);
        this.wrongT = Math.max(0, this.wrongT - dt);
        if (this.done && this.phase === 'scale') {
            this.doneT += dt;
            if (this.doneT > 1.6 && !this.reported) {
                this.reported = true;
                this.os.appDone('scale');
                // freiwillige Bonus-Aufgabe
                this.phase = 'bonus';
                this.seq = ENTCHEN;
                this.pos = 0;
            }
        }
    }
    draw(ctx) {
        const head = this.phase === 'scale' ? ['🎹 Spiele die Tonleiter!', 'Von unten nach oben: C D E F G A H C – die leuchtende Taste ist die nächste']
            : this.phase === 'bonus' ? ['🦆 Bonus: Alle meine Entchen', 'Freiwillig! Spiel das Lied nach – die leuchtende Taste zeigt dir den Weg']
                : ['🎵 Freies Spiel', 'Spiel, was du möchtest!'];
        title(ctx, head[0], head[1]);
        // Notenzeile
        const sx = 90, sw = W - 180, gap = 22, eLine = 330;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(sx, eLine - k * gap); ctx.lineTo(sx + sw, eLine - k * gap); ctx.stroke(); }
        ctx.fillStyle = '#ffffff'; ctx.font = `bold 120px serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('𝄞', sx - 6, eLine + 28);
        const STEP = [-2, -1, 0, 1, 2, 3, 4, 5]; // Halbe Linienabstände über der unteren E-Linie
        const show = 10;
        const first = this.seq.length <= show ? 0 : Math.min(Math.max(0, this.pos - 3), this.seq.length - show);
        const vis = this.seq.slice(first, first + show);
        const nx0 = sx + 110, ndx = (sw - 140) / Math.max(vis.length - 1, 1);
        vis.forEach((n, k) => {
            const idx = first + k;
            const x = nx0 + k * ndx;
            const y = eLine - STEP[n] * gap / 2;
            const isCur = idx === this.pos;
            const doneN = idx < this.pos;
            // Hilfslinie für C
            if (n === 0) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x - 24, eLine + gap); ctx.lineTo(x + 24, eLine + gap); ctx.stroke(); }
            if (n === 7) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x - 24, eLine - 5 * gap); ctx.lineTo(x + 24, eLine - 5 * gap); ctx.stroke(); }
            const r = isCur ? 15 + Math.sin(this.t * 8) * 2.5 : 13;
            ctx.fillStyle = doneN ? '#2fae5f' : MIDI_NOTES[n].color;
            ctx.globalAlpha = doneN || isCur ? 1 : 0.55;
            ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r, -0.35, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x + r * 1.15, y); ctx.lineTo(x + r * 1.15, y - 62); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = doneN ? '#b8f5c9' : '#ffffff';
            ctx.font = `bold ${isCur ? 28 : 22}px ${FONT}`;
            ctx.fillText(doneN ? '✓' : MIDI_NOTES[n].name, x, eLine + 62);
            if (isCur) { ctx.fillStyle = '#ffd43b'; ctx.font = `bold 30px ${FONT}`; ctx.fillText('▼', x, eLine - 5.5 * gap - 22); }
        });
        // Klaviatur unten
        const kx = 152, ky = 440, kw = 90, kh = 150;
        const tgt = this.targetNote;
        MIDI_NOTES.forEach((n, i) => {
            const x = kx + i * kw;
            const isT = i === tgt;
            ctx.fillStyle = this.keyFlash[i] > 0 ? n.color : '#fafafa';
            roundRect(ctx, x + 3, ky, kw - 6, kh, 10); ctx.fill();
            if (isT) {
                ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6 + Math.sin(this.t * 8) * 2;
                roundRect(ctx, x + 3, ky, kw - 6, kh, 10); ctx.stroke();
            }
            ctx.fillStyle = n.color;
            ctx.beginPath(); ctx.arc(x + kw / 2, ky + kh - 70, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4a1f3a'; ctx.font = `bold 30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(n.name, x + kw / 2, ky + kh - 32);
            ctx.font = `16px ${FONT}`; ctx.fillStyle = '#888';
            ctx.fillText(`Taste ${n.key}`, x + kw / 2, ky + 20);
        });
        if (this.wrongT > 0 && this.wrong !== null && tgt !== null) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            roundRect(ctx, 262, 380, 500, 50, 14); ctx.fill();
            ctx.fillStyle = '#ffd6d6'; ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'center';
            ctx.fillText(`Das war ${MIDI_NOTES[this.wrong].name} – gesucht ist ${MIDI_NOTES[tgt].name}`, W / 2, 405);
        }
        if (this.okFlash > 0) {
            ctx.fillStyle = `rgba(47,174,95,${this.okFlash * 0.25})`;
            ctx.fillRect(0, TOPBAR, W, H - TOPBAR);
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
        this.burnBtn = { x: 712, y: TOPBAR + 500, w: 280, h: 60 };
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
        else if (this.burnVisible && inRect(x, y, this.burnBtn)) this.burn();
    }
    onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') { this.takePhoto(); return true; }
        if (this.burnVisible && (e.key === 'b' || e.key === 'B')) { this.burn(); return true; }
        return false;
    }
    get burnVisible() { return !!this.os.game.storage?.burnEnabled; }
    burn() {
        const st = this.os.game.storage;
        const err = st.requestBurn();
        if (err) { this.say(err); this.os.game.audio.error(); }
        else this.os.game.audio.pcBlip(660);
        this.os.game.activity();
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
        if (g.storage) g.storage.photo = photo;
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
        const st = this.os.game.storage;
        if (this.burnVisible) {
            const burning = st.burnT > 0;
            button(ctx, this.burnBtn, burning ? '🔥 Brennt …' : st.cdBurned ? '💿 Gebrannt ✓' : '💿 Auf CD brennen (B)', { color: '#14a3a3', hover: inRect(cur.x, cur.y, this.burnBtn), font: `bold 24px ${FONT}` });
            if (burning) {
                const k = 1 - st.burnT / st.burnDur;
                const p = this.preview;
                ctx.fillStyle = 'rgba(0,0,0,0.72)';
                roundRect(ctx, p.x + 60, p.y + p.h / 2 - 70, p.w - 120, 140, 18); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = `bold 30px ${FONT}`; ctx.textAlign = 'center';
                ctx.fillText('💿 Laser brennt dein Foto auf die CD …', p.x + p.w / 2, p.y + p.h / 2 - 28);
                ctx.fillStyle = '#333'; roundRect(ctx, p.x + 100, p.y + p.h / 2 + 10, p.w - 200, 26, 13); ctx.fill();
                ctx.fillStyle = '#ff7a3d'; roundRect(ctx, p.x + 100, p.y + p.h / 2 + 10, (p.w - 200) * k, 26, 13); ctx.fill();
                ctx.fillStyle = '#e0c5d0'; ctx.font = `20px ${FONT}`;
                ctx.fillText(`${Math.round(k * 100)} %`, p.x + p.w / 2, p.y + p.h / 2 + 58);
            }
        } else ctx.fillText('Klicken oder Leertaste', this.shutter.x + this.shutter.w / 2, this.shutter.y + this.shutter.h + 22);
        if (this.msgT > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            roundRect(ctx, p.x + 60, p.y + p.h - 70, p.w - 120, 54, 14); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(this.msg, p.x + p.w / 2, p.y + p.h - 42);
        }
    }
}


// ---------------------------------------------------------------- Texteditor mit Speichern (Festplatte)
class EditorApp {
    constructor(os) {
        this.os = os;
        this.title = 'Textverarbeitung – hallo.txt';
        this.text = 'HALLO COMPUTER';
        this.extra = '';
        this.mode = 'save';     // save | saving | saved | extra
        this.progress = 0;
        this.msg = ''; this.msgT = 0; this.msgBad = false;
        this.shake = 0;
        this.saveBtn = { x: 744, y: TOPBAR + 16, w: 250, h: 62 };
        this.t = 0;
    }
    get game() { return this.os.game; }
    say(m, bad = false, dur = 3.5) { this.msg = m; this.msgT = dur; this.msgBad = bad; }
    startExtra() { this.mode = 'extra'; this.extra = ''; this.say('Tippe deinen Namen – aber NICHT speichern!', false, 99); }
    trySave() {
        const g = this.game;
        g.activity();
        if (this.mode === 'extra') { this.say('Psst – diesmal NICHT speichern! 😉', true); g.audio.error(); return; }
        if (this.mode !== 'save') return;
        if (!g.devices.hdd?.plugged) {
            this.say('⚠ Kein Speicher gefunden! Wohin soll ich die Datei schreiben?', true, 4);
            this.shake = 0.5;
            g.audio.error();
            g.flags.saveFailed = true;
            return;
        }
        this.mode = 'saving';
        this.progress = 0;
        g.audio.hddWrite(1.5);
        g.storage.blink(g.devices.hdd, 1.5, 0x22aaff);
    }
    onClick(x, y) { if (inRect(x, y, this.saveBtn)) this.trySave(); }
    onKey(e) {
        const k = e.key;
        if (((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) || k === 'Enter') { this.trySave(); return true; }
        if (this.mode === 'extra') {
            if (k === 'Backspace') { this.extra = this.extra.slice(0, -1); return true; }
            if (k.length === 1 && this.extra.length < 18) {
                this.extra += k.toUpperCase();
                this.game.audio.pcBlip(560 + this.extra.length * 25);
                this.game.storage.unsaved = this.extra.trim();
                if (this.extra.trim().length >= 3) this.game.flags.extraTyped = true;
            }
            return true;
        }
        if (k.length === 1 && this.mode === 'save') this.say('Erst speichern: Strg + S oder Enter', false, 2.5);
        return true;
    }
    update(dt) {
        this.t += dt;
        this.msgT = Math.max(0, this.msgT - dt);
        this.shake = Math.max(0, this.shake - dt);
        if (this.mode === 'saving') {
            this.progress = Math.min(1, this.progress + dt / 1.5);
            if (this.progress >= 1) {
                this.mode = 'saved';
                const st = this.game.storage;
                if (!st.hdd.find(f => f.name === 'hallo.txt')) st.hdd.push({ name: 'hallo.txt', icon: '📄', text: this.text });
                this.os.showBanner('💽 Gespeichert auf der Festplatte!', '#14a3a3', 3);
                this.game.audio.chime();
                this.game.flags.saved = true;
            }
        }
    }
    draw(ctx) {
        // Werkzeugleiste
        const cur = this.os.cursor;
        const can = this.mode === 'save';
        button(ctx, this.saveBtn, this.mode === 'saving' ? 'Speichert …' : '💾 Speichern', { color: can ? '#14a3a3' : '#5b6170', hover: can && inRect(cur.x, cur.y, this.saveBtn), font: `bold 28px ${FONT}` });
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e0c5d0'; ctx.font = `22px ${FONT}`;
        ctx.fillText('Speichern: Strg + S  oder  Enter  oder  💾 anklicken', 40, TOPBAR + 47);
        // Blatt Papier
        const px = 90, py = TOPBAR + 96, pw = W - 180, ph = 270;
        const sx = this.shake > 0 ? Math.sin(this.shake * 70) * 8 : 0;
        ctx.fillStyle = '#fdfcfa';
        roundRect(ctx, px + sx, py, pw, ph, 10); ctx.fill();
        ctx.fillStyle = '#d9d3cc';
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 40 + sx, py + 120 + i * 34, pw - 80, 2);
        ctx.fillStyle = '#2a1a2e'; ctx.font = `bold 52px ${FONT}`;
        ctx.fillText(this.text, px + 40 + sx, py + 70);
        let x = px + 40 + sx + ctx.measureText(this.text).width;
        if (this.extra) {
            ctx.fillStyle = '#d6336c';
            const ex = ' ' + this.extra;
            ctx.fillText(ex, x, py + 70);
            x += ctx.measureText(ex).width;
        }
        if (this.mode === 'extra' && Math.sin(this.t * 6) > 0) { ctx.fillStyle = '#2a1a2e'; ctx.fillRect(x + 4, py + 44, 4, 52); }
        // Status
        ctx.textAlign = 'center';
        if (this.mode === 'saving') {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, 232, 300, 560, 130, 18); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 30px ${FONT}`;
            ctx.fillText('💽 Schreibe auf die Festplatte …', W / 2, 340);
            ctx.fillStyle = '#333'; roundRect(ctx, 282, 372, 460, 26, 13); ctx.fill();
            ctx.fillStyle = '#14a3a3'; roundRect(ctx, 282, 372, 460 * this.progress, 26, 13); ctx.fill();
        }
        const st = this.game.storage;
        ctx.fillStyle = '#e0c5d0'; ctx.font = `22px ${FONT}`;
        const where = st.hdd.find(f => f.name === 'hallo.txt') ? '💽 Festplatte: hallo.txt ✓ gespeichert' : '⚠ noch nicht gespeichert';
        ctx.fillText(this.mode === 'extra' && this.extra ? `${where}   ·   „${this.extra.trim()}“ ist NICHT gespeichert` : where, W / 2, py + ph + 30);
        if (this.msgT > 0) {
            ctx.fillStyle = this.msgBad ? 'rgba(200,40,40,0.92)' : 'rgba(20,163,163,0.92)';
            roundRect(ctx, 140, py + ph + 52, W - 280, 52, 14); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(this.msg, W / 2, py + ph + 79);
        }
    }
}

// ---------------------------------------------------------------- Datei-Explorer
const DRIVE_DEFS = [
    { id: 'hdd', icon: '💽', name: 'Festplatte' },
    { id: 'usb', icon: '💾', name: 'USB-Stick' },
    { id: 'cd', icon: '💿', name: 'CD' },
];
class FilesApp {
    constructor(os, opts = {}) {
        this.os = os;
        this.title = 'Dateien';
        this.lost = opts.lost || '';
        this.open = null;
        this.drive = 'hdd';
        this.t = 0;
        if (opts.open) this.openFile(this.files('hdd').find(f => f.name === opts.open));
    }
    get game() { return this.os.game; }
    drives() {
        const D = this.game.devices, st = this.game.storage;
        return DRIVE_DEFS.filter(d => (d.id === 'hdd' ? D.hdd?.plugged : d.id === 'usb' ? D.usbstick?.plugged : st.cd?.inTray));
    }
    files(id) {
        const st = this.game.storage;
        if (id === 'hdd') return st.hdd;
        if (id === 'usb') return st.usb;
        if (id === 'cd') return st.cdBurned ? [{ name: 'mein_foto.png', icon: '🖼️', photo: st.photo }] : [];
        return [];
    }
    openFile(f) {
        if (!f) return;
        this.open = f;
        this.game.audio.pcBlip(760);
        if (f.notes) {
            let t = 0;
            for (const n of f.notes) { this.game.audio.tone(MIDI_NOTES[n.i].freq, 0.4, { type: 'triangle', vol: 0.2, bus: 'pc', delay: t }); t += n.d; }
        }
    }
    onClick(x, y) {
        if (this.open) { this.open = null; return; }
        this.drives().forEach((d, i) => { if (inRect(x, y, { x: 30, y: TOPBAR + 70 + i * 90, w: 250, h: 76 })) { this.drive = d.id; this.game.audio.pcBlip(640); } });
        this.files(this.drive).forEach((f, i) => { if (inRect(x, y, this.tile(i))) this.openFile(f); });
    }
    tile(i) { return { x: 320 + (i % 3) * 225, y: TOPBAR + 70 + Math.floor(i / 3) * 190, w: 205, h: 170 }; }
    update(dt) { this.t += dt; }
    draw(ctx) {
        const cur = this.os.cursor;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
        ctx.fillText('Laufwerke', 34, TOPBAR + 40);
        const drives = this.drives();
        if (!drives.find(d => d.id === this.drive) && drives.length) this.drive = drives[0].id;
        drives.forEach((d, i) => {
            const b = { x: 30, y: TOPBAR + 70 + i * 90, w: 250, h: 76 };
            ctx.fillStyle = d.id === this.drive ? '#14a3a3' : inRect(cur.x, cur.y, b) ? '#5a3a52' : 'rgba(255,255,255,0.08)';
            roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `36px ${FONT}`; ctx.fillText(d.icon, b.x + 16, b.y + 40);
            ctx.font = `bold 24px ${FONT}`; ctx.fillText(d.name, b.x + 72, b.y + 40);
        });
        if (!drives.length) { ctx.fillStyle = '#e0c5d0'; ctx.font = `22px ${FONT}`; ctx.fillText('Kein Speicher verbunden', 34, TOPBAR + 100); }
        const files = drives.length ? this.files(this.drive) : [];
        files.forEach((f, i) => {
            const b = this.tile(i);
            ctx.fillStyle = inRect(cur.x, cur.y, b) ? '#5a3a52' : 'rgba(255,255,255,0.1)';
            roundRect(ctx, b.x, b.y, b.w, b.h, 16); ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff'; ctx.font = `70px ${FONT}`; ctx.fillText(f.icon, b.x + b.w / 2, b.y + 70);
            ctx.font = `bold 22px ${FONT}`; ctx.fillText(f.name, b.x + b.w / 2, b.y + 140);
            ctx.textAlign = 'left';
        });
        if (drives.length && !files.length) { ctx.fillStyle = '#e0c5d0'; ctx.font = `24px ${FONT}`; ctx.fillText('(leer)', 330, TOPBAR + 100); }
        if (this.open) this.drawOpen(ctx);
    }
    drawOpen(ctx) {
        const f = this.open;
        const x = 150, y = TOPBAR + 40, w = W - 300, h = 470;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, TOPBAR, W, H - TOPBAR);
        ctx.fillStyle = '#fdfcfa'; roundRect(ctx, x, y, w, h, 16); ctx.fill();
        ctx.fillStyle = '#14a3a3'; roundRect(ctx, x, y, w, 56, 16); ctx.fill(); ctx.fillRect(x, y + 30, w, 26);
        ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`${f.icon} ${f.name}`, x + 20, y + 29);
        ctx.textAlign = 'right'; ctx.font = `20px ${FONT}`; ctx.fillText('Klicken zum Schließen ✕', x + w - 20, y + 29);
        ctx.textAlign = 'left';
        if (f.text) {
            ctx.fillStyle = '#2a1a2e'; ctx.font = `bold 52px ${FONT}`;
            ctx.fillText(f.text, x + 40, y + 140);
            if (this.lost) {
                const tw = ctx.measureText(f.text + ' ').width;
                ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 4);
                ctx.fillStyle = '#d6336c';
                ctx.fillText(this.lost, x + 40 + tw, y + 140);
                const lw = ctx.measureText(this.lost).width;
                ctx.globalAlpha = 1;
                ctx.strokeStyle = '#d6336c'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(x + 36 + tw, y + 140); ctx.lineTo(x + 44 + tw + lw, y + 140); ctx.stroke();
                ctx.textAlign = 'center';
                ctx.fillStyle = '#2fae5f'; ctx.font = `bold 30px ${FONT}`;
                ctx.fillText(`✓ „${f.text}“ war gespeichert – es ist noch da!`, x + w / 2, y + 270);
                ctx.fillStyle = '#d6336c';
                ctx.fillText(`✗ „${this.lost}“ war nicht gespeichert – weg!`, x + w / 2, y + 330);
                ctx.fillStyle = '#6b7180'; ctx.font = `22px ${FONT}`;
                ctx.fillText('Ohne Strom vergisst der Arbeitsspeicher alles. Die Festplatte nicht.', x + w / 2, y + 400);
            }
        } else if (f.notes) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#2a1a2e'; ctx.font = `bold 30px ${FONT}`;
            ctx.fillText('🎵 Dein Lied', x + w / 2, y + 110);
            f.notes.forEach((n, i) => {
                ctx.fillStyle = MIDI_NOTES[n.i].color;
                const bx = x + 60 + i * ((w - 120) / f.notes.length);
                const bh = 30 + n.i * 22;
                roundRect(ctx, bx, y + 400 - bh, (w - 120) / f.notes.length - 10, bh, 8); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = `bold 22px ${FONT}`;
                ctx.fillText(MIDI_NOTES[n.i].name, bx + ((w - 120) / f.notes.length - 10) / 2, y + 385);
            });
        } else if (f.photo) {
            const pw = w - 120, ph = pw * f.photo.height / f.photo.width;
            ctx.drawImage(f.photo, x + 60, y + 76, pw, Math.min(ph, h - 100));
        }
    }
}

// ---------------------------------------------------------------- Aufnahme-Studio (MIDI → USB-Stick)
const REC_LEN = 8;
class RecordApp {
    constructor(os) {
        this.os = os;
        this.title = 'Aufnahme-Studio';
        this.notes = [];
        this.lastT = 0;
        this.t = 0;
        this.mode = 'rec';    // rec | ready | saving | saved
        this.progress = 0;
        this.keyFlash = new Array(8).fill(0);
        this.msg = ''; this.msgT = 0; this.msgBad = false;
        this.saveBtn = { x: 560, y: 452, w: 330, h: 60 };
        this.againBtn = { x: 134, y: 452, w: 330, h: 60 };
    }
    get game() { return this.os.game; }
    get targetNote() { return null; }
    say(m, bad = false) { this.msg = m; this.msgT = 3.5; this.msgBad = bad; }
    noteOn(i) {
        this.keyFlash[i] = 1;
        this.game.audio.note(MIDI_NOTES[i].freq, 0.6);
        if (this.mode !== 'rec') return;
        const now = this.t;
        if (this.notes.length) this.notes[this.notes.length - 1].d = THREE_clamp(now - this.lastT, 0.18, 0.7);
        this.notes.push({ i, d: 0.4 });
        this.lastT = now;
        if (this.notes.length >= REC_LEN) {
            this.mode = 'ready';
            this.os.showBanner('🎵 Aufnahme fertig!', '#2fae5f', 2.5);
            this.game.flags.recorded = true;
        }
    }
    again() { this.notes = []; this.mode = 'rec'; this.game.audio.pcBlip(500); }
    save() {
        const g = this.game;
        g.activity();
        if (this.mode === 'rec') { this.say(`Spiel erst ${REC_LEN} Töne!`, true); return; }
        if (this.mode !== 'ready') return;
        if (!g.devices.usbstick?.plugged) { this.say('⚠ Kein USB-Stick im Computer!', true); g.audio.error(); return; }
        this.mode = 'saving';
        this.progress = 0;
        g.storage.blink(g.devices.usbstick, 1.2, 0xff9933);
        g.audio.noise(0.6, { vol: 0.05, freq: 5000, q: 2 });
    }
    onClick(x, y) {
        if (inRect(x, y, this.saveBtn)) this.save();
        else if (inRect(x, y, this.againBtn) && this.mode !== 'saving') this.again();
    }
    onKey(e) {
        const k = e.key;
        if (((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) || k === 'Enter') { this.save(); return true; }
        if (k === 'Backspace' && this.mode !== 'saving') { this.again(); return true; }
        return false;
    }
    update(dt) {
        this.t += dt;
        this.msgT = Math.max(0, this.msgT - dt);
        this.keyFlash = this.keyFlash.map(v => Math.max(0, v - dt * 3));
        if (this.mode === 'saving') {
            this.progress = Math.min(1, this.progress + dt / 1.2);
            if (this.progress >= 1) {
                this.mode = 'saved';
                this.game.storage.usb = [{ name: 'mein_lied.mid', icon: '🎵', notes: this.notes.map(n => ({ ...n })) }];
                this.os.showBanner('💾 Lied auf dem USB-Stick gespeichert!', '#14a3a3', 3);
                this.game.audio.chime();
                this.game.flags.songSaved = true;
            }
        }
    }
    draw(ctx) {
        const head = this.mode === 'rec' ? ['● REC – Spiel dein eigenes Lied!', `Drück ${REC_LEN} Tasten auf dem MIDI-Keyboard – ganz wie du willst`]
            : this.mode === 'saved' ? ['✓ Gespeichert: mein_lied.mid', 'Das Lied liegt jetzt auf dem USB-Stick']
                : ['🎵 Dein Lied ist fertig!', 'Jetzt auf den USB-Stick speichern: Enter, Strg + S oder 💾'];
        title(ctx, head[0], head[1]);
        if (this.mode === 'rec' && Math.sin(this.t * 5) > 0) {
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(80, TOPBAR + 34, 14, 0, Math.PI * 2); ctx.fill();
        }
        // Notenband
        const x0 = 100, w = W - 200, y0 = 150, h = 255;
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(ctx, x0, y0, w, h, 16); ctx.fill();
        const cw = w / REC_LEN;
        for (let k = 0; k < REC_LEN; k++) {
            const n = this.notes[k];
            const bx = x0 + k * cw + 8;
            if (!n) {
                ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
                roundRect(ctx, bx, y0 + h - 60, cw - 16, 44, 10); ctx.stroke(); ctx.setLineDash([]);
                continue;
            }
            const bh = 40 + n.i * 25;
            ctx.fillStyle = MIDI_NOTES[n.i].color;
            roundRect(ctx, bx, y0 + h - 16 - bh, cw - 16, bh, 10); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 28px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(MIDI_NOTES[n.i].name, bx + (cw - 16) / 2, y0 + h - 40);
        }
        ctx.fillStyle = '#e0c5d0'; ctx.font = `22px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(`${this.notes.length} / ${REC_LEN} Töne`, W / 2, y0 + h + 24);
        const cur = this.os.cursor;
        const canSave = this.mode === 'ready';
        button(ctx, this.againBtn, '↺ Neu aufnehmen', { color: '#7a4a66', hover: inRect(cur.x, cur.y, this.againBtn), font: `bold 26px ${FONT}` });
        button(ctx, this.saveBtn, this.mode === 'saving' ? 'Speichert …' : '💾 Auf USB-Stick speichern', { color: canSave ? '#14a3a3' : '#5b6170', hover: canSave && inRect(cur.x, cur.y, this.saveBtn), font: `bold 24px ${FONT}` });
        if (this.mode === 'saving') {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, 232, 250, 560, 120, 18); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 28px ${FONT}`;
            ctx.fillText('💾 Schreibe auf den USB-Stick …', W / 2, 288);
            ctx.fillStyle = '#333'; roundRect(ctx, 282, 318, 460, 24, 12); ctx.fill();
            ctx.fillStyle = '#ff9933'; roundRect(ctx, 282, 318, 460 * this.progress, 24, 12); ctx.fill();
        }
        if (this.msgT > 0) {
            ctx.fillStyle = this.msgBad ? 'rgba(200,40,40,0.92)' : 'rgba(20,163,163,0.92)';
            roundRect(ctx, 200, 380, W - 400, 52, 14); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
            ctx.fillText(this.msg, W / 2, 407);
        }
    }
}
function THREE_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------------------------------------------------------------- Touchscreen-Hinweis auf dem Hauptmonitor
class TouchInfoApp {
    constructor(os) { this.os = os; this.title = 'Touchscreen'; }
    draw(ctx) {
        title(ctx, 'Der Touchscreen ist verbunden!', 'Schau auf den kleinen Bildschirm: Tippen, Wischen, Ziehen');
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
    scale: ScaleApp,
    sing: SingApp,
    camera: CameraApp,
    touchinfo: TouchInfoApp,
    editor: EditorApp,
    files: FilesApp,
    record: RecordApp,
};

// ---------------------------------------------------------------- Touch-App auf dem Touchscreen-Gerät
export class TouchApp {
    // Drei kurze Teile, die typische Touch-Gesten zeigen: Tippen → Wischen → Ziehen
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.w = canvas.width; this.h = canvas.height;
        this.phase = 'tap';
        this.bubbles = [];
        this.pops = [];
        this.trail = [];
        this.spawnT = 0;
        this.popped = 0;
        this.goal = 6;
        // Wischen
        this.photos = ['🐶', '🌈', '🚀', '🍕'];
        this.photo = 0;
        this.slide = 0;      // Verschiebung beim Wischen (px)
        this.swipeStart = null;
        this.swipes = 0;
        this.swipeGoal = 3;
        // Ziehen
        this.shapes = [];
        this.dragging = null;
        this.placed = 0;
        this.phaseT = 0;
        this.done = false;
        this.doneT = 0;
        this.on = false;
    }
    get progressText() {
        if (this.done) return 'Super! Alle drei Gesten geschafft 🎉';
        if (this.phase === 'tap') return `1/3 TIPPEN: Bring die Blasen zum Platzen (${this.popped}/${this.goal})`;
        if (this.phase === 'swipe') return `2/3 WISCHEN: Zieh das Bild nach links (${this.swipes}/${this.swipeGoal})`;
        return `3/3 ZIEHEN: Schieb jede Form in ihr Loch (${this.placed}/3)`;
    }
    setPhase(p) {
        this.phase = p;
        this.phaseT = 0;
        this.game.audio.tone(660, 0.12, { type: 'triangle', vol: 0.16, bus: 'pc' });
        this.game.audio.tone(990, 0.2, { type: 'triangle', vol: 0.14, bus: 'pc', delay: 0.1 });
        if (p === 'drag') {
            const w = this.w;
            this.shapes = [
                { shape: 'circle', color: '#ff6b6b', x: 80, y: 250, hx: w - 110, hy: 105 },
                { shape: 'square', color: '#4dabf7', x: 190, y: 270, hx: w - 230, hy: 230 },
                { shape: 'triangle', color: '#69db7c', x: 300, y: 245, hx: w - 350, hy: 105 },
            ];
            this.shapes.forEach(sh => { sh.sx = sh.x; sh.sy = sh.y; });
        }
        this.game.emit('touchPhase', p);
    }
    touch(u, v) {
        // erster Kontakt (Klick)
        if (!this.on || this.done) return;
        const x = u * this.w, y = (1 - v) * this.h;
        this.trail.push({ x, y, t: 0.6, c: `hsl(${(performance.now() / 5) % 360},90%,65%)` });
        this.game.activity();
        if (this.phase === 'tap') {
            for (const b of this.bubbles) {
                if (!b.dead && Math.hypot(b.x - x, b.y - y) < b.r + 12) {
                    b.dead = true;
                    this.popped++;
                    this.pops.push({ x: b.x, y: b.y, r: b.r, t: 0.4, c: b.c });
                    this.game.audio.tone(500 + Math.random() * 500, 0.12, { type: 'sine', vol: 0.2, bus: 'pc', slideTo: 1200 });
                    if (this.popped >= this.goal) this.setPhase('swipe');
                    break;
                }
            }
        } else if (this.phase === 'swipe') {
            this.swipeStart = { x, slide: this.slide };
        } else if (this.phase === 'drag') {
            this.dragging = this.shapes.find(sh => !sh.placed && Math.hypot(sh.x - x, sh.y - y) < 46) || null;
            if (this.dragging) { this.dragging.ox = this.dragging.x - x; this.dragging.oy = this.dragging.y - y; }
        }
    }
    move(u, v) {
        // Finger wird über den Bildschirm gezogen
        if (!this.on || this.done) return;
        const x = u * this.w, y = (1 - v) * this.h;
        this.trail.push({ x, y, t: 0.5, c: `hsl(${(performance.now() / 5) % 360},90%,65%)` });
        if (this.phase === 'tap') this.touch(u, v);
        else if (this.phase === 'swipe' && this.swipeStart) this.slide = Math.min(40, x - this.swipeStart.x);
        else if (this.phase === 'drag' && this.dragging) {
            this.dragging.x = x + this.dragging.ox;
            this.dragging.y = y + this.dragging.oy;
        }
    }
    up() {
        if (!this.on || this.done) return;
        if (this.phase === 'swipe' && this.swipeStart) {
            if (this.slide < -this.w * 0.2) {
                this.swipes++;
                this.photo = (this.photo + 1) % this.photos.length;
                this.slide += this.w; // neues Bild rutscht von rechts herein
                this.game.audio.noise(0.12, { vol: 0.12, freq: 2500, q: 0.8, bus: 'pc' });
                if (this.swipes >= this.swipeGoal) setTimeout(() => this.setPhase('drag'), 500);
            }
            this.swipeStart = null;
        }
        if (this.phase === 'drag' && this.dragging) {
            const sh = this.dragging;
            if (Math.hypot(sh.x - sh.hx, sh.y - sh.hy) < 42) {
                sh.placed = true; sh.x = sh.hx; sh.y = sh.hy;
                this.placed++;
                this.game.audio.tone(880, 0.15, { type: 'triangle', vol: 0.18, bus: 'pc' });
                if (this.placed >= 3) this.done = true;
            } else { sh.x = sh.sx; sh.y = sh.sy; this.game.audio.tone(220, 0.12, { type: 'sine', vol: 0.12, bus: 'pc' }); }
            this.dragging = null;
        }
    }
    update(dt) {
        if (!this.on) return;
        this.phaseT += dt;
        if (this.phase === 'tap') {
            this.spawnT -= dt;
            if (this.spawnT <= 0) {
                this.spawnT = 0.85;
                this.bubbles.push({ x: 40 + Math.random() * (this.w - 80), y: this.h + 40, r: 30 + Math.random() * 18, vy: 50 + Math.random() * 40, c: `hsl(${Math.random() * 360},80%,65%)` });
            }
        }
        for (const b of this.bubbles) b.y -= b.vy * dt * (this.phase === 'tap' ? 1 : 4);
        this.bubbles = this.bubbles.filter(b => !b.dead && b.y > -60);
        if (!this.swipeStart) this.slide += (0 - this.slide) * Math.min(1, dt * 10);
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
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (this.phase === 'swipe' && !this.done) {
            // Fotoalbum
            for (const k of [-1, 0, 1]) {
                const x = w / 2 + this.slide + k * w;
                const idx = (this.photo + k + this.photos.length) % this.photos.length;
                ctx.fillStyle = '#fffdf6';
                roundRect(ctx, x - 130, 70, 260, 200, 16); ctx.fill();
                ctx.font = '120px Segoe UI, sans-serif';
                ctx.fillText(this.photos[idx], x, 172);
            }
            const a = 0.5 + Math.sin(this.phaseT * 4) * 0.4;
            ctx.globalAlpha = a; ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 40px Segoe UI, sans-serif';
            ctx.fillText('👆 ⬅⬅', w / 2, 300);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff'; ctx.font = '18px Segoe UI, sans-serif';
            ctx.fillText(`Foto ${this.photo + 1} von ${this.photos.length}`, w / 2, 56);
        }
        if (this.phase === 'drag' || this.done) {
            for (const sh of this.shapes) {
                // Loch
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.setLineDash([8, 6]);
                ctx.strokeStyle = sh.color; ctx.lineWidth = 4;
                shapePath(ctx, sh.shape, sh.hx, sh.hy, 38); ctx.stroke();
                ctx.restore();
            }
            for (const sh of this.shapes) {
                ctx.fillStyle = sh.color;
                shapePath(ctx, sh.shape, sh.x, sh.y, sh === this.dragging ? 40 : 34); ctx.fill();
                if (sh.placed) { ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Segoe UI, sans-serif'; ctx.fillText('✓', sh.x, sh.y + 2); }
            }
            if (!this.done && !this.dragging) {
                ctx.globalAlpha = 0.5 + Math.sin(this.phaseT * 4) * 0.4;
                ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 30px Segoe UI, sans-serif';
                ctx.fillText('👆 halten und ziehen ➜', w / 2, 175);
                ctx.globalAlpha = 1;
            }
        }
        for (const p of this.trail) {
            ctx.globalAlpha = Math.max(0, p.t);
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
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
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, w, 40);
        ctx.fillStyle = '#fff';
        ctx.font = `bold 21px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.progressText, w / 2, 21);
    }
}

function shapePath(ctx, shape, cx, cy, r) {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
    else if (shape === 'square') ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    else { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); ctx.closePath(); }
}
