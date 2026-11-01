// HTML-Oberfläche: Byte mit Sprechblase, Fortschritt, Tooltip, Toasts, EVA-Karte, Endbildschirm
const $ = id => document.getElementById(id);

const MOODS = { normal: 'normal', happy: 'happy', thinking: 'thinking', sad: 'sad' };

export const STATIONS = [
    { id: 'monitor', label: '🖥️ Bildschirm' },
    { id: 'mouse', label: '🖱️ Maus' },
    { id: 'keyboard', label: '⌨️ Text 💽' },
    { id: 'scanner', label: '🔊 Scanner' },
    { id: 'midi', label: '🎹 MIDI 💾' },
    { id: 'mic', label: '🎤 Mikrofon' },
    { id: 'camera', label: '📷 Foto 💿' },
    { id: 'touch', label: '📱 Touch' },
    { id: 'final', label: '📦 Aufräumen' },
];

export class Hud {
    constructor(game) {
        this.game = game;
        this.el = {
            hud: $('hud'), progress: $('progress'), help: $('helpBtn'),
            img: $('byteImg'), title: $('byteTitle'), text: $('byteText'), next: $('byteNext'), panel: $('bytePanel'),
            tooltip: $('tooltip'), toast: $('toast'), controls: $('controls'),
            evaCard: $('evaCard'), evaE: $('evaE'), evaV: $('evaV'), evaA: $('evaA'), evaS: $('evaS'),
            lookL: $('lookLeftBtn'), lookR: $('lookRightBtn'),
        };
        this.chips = {};
        for (const s of STATIONS) {
            const c = document.createElement('div');
            c.className = 'chip';
            c.textContent = s.label;
            this.el.progress.appendChild(c);
            this.chips[s.id] = c;
        }
        this.toastT = null;
        this.nextCb = null;
        this.el.next.addEventListener('click', () => { const cb = this.nextCb; this.nextCb = null; this.el.next.classList.add('hidden'); cb?.(); });
        this.el.help.addEventListener('click', () => game.progression.help());
        this.el.lookL.addEventListener('click', () => game.rig.lookBoxes());
        this.el.lookR.addEventListener('click', () => game.rig.lookDesk());
        this.lastTip = '';
    }

    show() { this.el.hud.classList.remove('hidden'); }

    say(title, html, mood = 'normal', { next = null } = {}) {
        this.el.title.textContent = title;
        this.el.text.innerHTML = html;
        this.el.img.src = `assets/byte/${MOODS[mood] || 'normal'}.png`;
        this.el.panel.classList.remove('bounce');
        void this.el.panel.offsetWidth;
        this.el.panel.classList.add('bounce');
        if (next) {
            this.nextCb = next;
            this.el.next.classList.remove('hidden');
        } else {
            this.nextCb = null;
            this.el.next.classList.add('hidden');
        }
    }

    mood(m) { this.el.img.src = `assets/byte/${MOODS[m] || 'normal'}.png`; }

    station(id, done = []) {
        for (const s of STATIONS) {
            const c = this.chips[s.id];
            c.classList.toggle('active', s.id === id);
            c.classList.toggle('done', done.includes(s.id));
        }
    }

    toast(text, kind = '', dur = 1.8) {
        const t = this.el.toast;
        t.textContent = text;
        t.className = `toast ${kind}`;
        clearTimeout(this.toastT);
        this.toastT = setTimeout(() => t.classList.add('hidden'), dur * 1000);
    }

    tooltip(it, pointer) {
        const el = this.el.tooltip;
        if (!it || !pointer || !it.tooltip) { if (this.lastTip) { el.classList.add('hidden'); this.lastTip = ''; } return; }
        const txt = it.tooltip(this.game.hand.hoverHit);
        if (txt !== this.lastTip) { el.textContent = txt; this.lastTip = txt; }
        el.classList.remove('hidden');
        const x = Math.min(pointer.x + 18, innerWidth - el.offsetWidth - 8);
        el.style.left = `${x}px`;
        el.style.top = `${pointer.y + 20}px`;
    }

    controls(html) { this.el.controls.innerHTML = html; }

    eva(e, v, a, s = null) {
        if (!e) { this.el.evaCard.classList.add('hidden'); return; }
        this.el.evaE.textContent = e;
        this.el.evaV.textContent = v;
        this.el.evaA.textContent = a;
        this.el.evaS.textContent = s || '';
        this.el.evaCard.classList.toggle('no-s', !s);
        this.el.evaCard.classList.remove('hidden');
        // Animation neu starten
        this.el.evaCard.style.animation = 'none';
        void this.el.evaCard.offsetWidth;
        this.el.evaCard.style.animation = '';
    }

    pulseHelp(on) { this.el.help.classList.toggle('pulse', on); }
    pulseLookLeft(on) { this.el.lookL.classList.toggle('pulse', on); }

    setLookButtons(yaw) {
        this.el.lookL.classList.toggle('hidden', yaw > 0.6);
        this.el.lookR.classList.toggle('hidden', yaw < 0.35);
    }

    end(boxes) {
        const map = { E: $('endE'), V: $('endV'), A: $('endA'), S: $('endS') };
        for (const b of boxes) {
            map[b.cat].innerHTML = b.contents.map(d => `<li>${d.def.emoji} ${d.def.name}</li>`).join('');
        }
        $('endScreen').classList.remove('hidden');
    }
}
