// Kleiner WebAudio-Synthesizer.
// Zwei "Busse": room = Geräusche im Raum (Klick, Plopp, Scanner-Piep) – immer hörbar.
//               pc   = Ton, den der Computer ausgibt – nur hörbar, wenn Lautsprecher eingesteckt sind.

export const NOTE_FREQ = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, H4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.speakersOn = false;
        this.voice = null;
    }

    init() {
        if (this.ctx) { this.ctx.resume?.(); return; }
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Kein WebAudio:', e);
            return;
        }
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(c.destination);
        this.room = c.createGain();
        this.room.gain.value = 1;
        this.room.connect(this.master);
        this.pc = c.createGain();
        this.pc.gain.value = 0;
        this.pc.connect(this.master);
    }

    get ok() { return !!this.ctx; }

    setSpeakers(on) {
        this.speakersOn = on;
        if (!this.ok) return;
        this.pc.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03);
    }

    bus(name) { return name === 'pc' ? this.pc : this.room; }

    tone(freq, dur = 0.2, { type = 'sine', vol = 0.25, bus = 'room', attack = 0.005, delay = 0, slideTo = null } = {}) {
        if (!this.ok) return;
        const c = this.ctx;
        const t = c.currentTime + delay;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.bus(bus));
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    noise(dur = 0.08, { vol = 0.2, bus = 'room', freq = 2000, q = 1, type = 'bandpass', delay = 0 } = {}) {
        if (!this.ok) return;
        const c = this.ctx;
        const t = c.currentTime + delay;
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource();
        src.buffer = buf;
        const f = c.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = c.createGain();
        g.gain.value = vol;
        src.connect(f).connect(g).connect(this.bus(bus));
        src.start(t);
    }

    // ---------- Raum-Geräusche ----------
    pickup() { this.tone(520, 0.09, { type: 'triangle', vol: 0.12, slideTo: 780 }); }
    drop() { this.tone(300, 0.1, { type: 'triangle', vol: 0.1, slideTo: 180 }); }
    thud(strength = 1) { this.noise(0.09, { vol: 0.12 * strength, freq: 300, q: 0.8, type: 'lowpass' }); }
    plugIn() {
        this.noise(0.05, { vol: 0.35, freq: 3200, q: 2 });
        this.tone(880, 0.12, { type: 'square', vol: 0.05, delay: 0.04 });
        this.tone(1320, 0.15, { type: 'square', vol: 0.05, delay: 0.1 });
    }
    unplug() { this.noise(0.06, { vol: 0.25, freq: 1800, q: 2 }); this.tone(500, 0.12, { vol: 0.1, slideTo: 300 }); }
    plop() { this.tone(180, 0.25, { type: 'sine', vol: 0.3, slideTo: 620 }); this.noise(0.05, { vol: 0.1, freq: 4000, delay: 0.02 }); }
    error() { this.tone(160, 0.25, { type: 'sawtooth', vol: 0.08 }); this.tone(120, 0.3, { type: 'sawtooth', vol: 0.08, delay: 0.12 }); }
    chime() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
    }
    success() {
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.12, delay: i * 0.1 }));
    }
    // Physik-Spaß
    shatter() {
        this.noise(0.35, { vol: 0.35, freq: 3200, q: 0.7 });
        this.noise(0.18, { vol: 0.3, freq: 600, q: 0.9, type: 'lowpass' });
        for (let i = 0; i < 5; i++) this.tone(2200 + Math.random() * 2600, 0.06, { type: 'triangle', vol: 0.05, delay: 0.03 + i * 0.045 });
    }
    splash() { this.noise(0.12, { vol: 0.08, freq: 900, q: 0.6, type: 'lowpass' }); }
    zap() {
        this.noise(0.16, { vol: 0.12, freq: 4500, q: 6 });
        this.tone(90, 0.16, { type: 'sawtooth', vol: 0.06, slideTo: 60 });
    }
    kaching() {
        this.tone(1318, 0.12, { type: 'triangle', vol: 0.14, bus: 'pc' });
        this.tone(1760, 0.25, { type: 'triangle', vol: 0.12, bus: 'pc', delay: 0.08 });
    }
    scannerBeep() { this.tone(1900, 0.09, { type: 'square', vol: 0.06 }); }
    keyClick() { this.noise(0.025, { vol: 0.12, freq: 5000, q: 3 }); }
    mouseClick() { this.noise(0.02, { vol: 0.15, freq: 6000, q: 4 }); }
    printer() {
        if (!this.ok) return;
        for (let i = 0; i < 10; i++) this.noise(0.12, { vol: 0.08, freq: 900 + (i % 2) * 400, q: 3, delay: i * 0.17 });
    }

    // Speicher-Geräusche
    hddWrite(dur = 1.4) {
        // Festplatte: leises Surren + Klackern des Lesekopfs
        this.tone(118, dur, { type: 'triangle', vol: 0.05, attack: 0.08 });
        const n = Math.round(dur * 14);
        for (let i = 0; i < n; i++) this.noise(0.014, { vol: 0.16, freq: 2200 + Math.random() * 1800, q: 3, delay: Math.random() * dur });
    }
    driveMotor() {
        this.tone(85, 0.55, { type: 'sawtooth', vol: 0.035, slideTo: 150, attack: 0.04 });
        this.noise(0.5, { vol: 0.05, freq: 420, q: 0.7, type: 'lowpass' });
        this.noise(0.05, { vol: 0.14, freq: 700, q: 1, delay: 0.5 });
    }
    burnHum(dur = 4) {
        this.tone(150, dur, { type: 'triangle', vol: 0.05, attack: 0.3, slideTo: 260 });
        this.tone(2600, dur, { type: 'sine', vol: 0.012, attack: 0.3 });
        for (let i = 0; i < dur * 3; i++) this.noise(0.3, { vol: 0.035, freq: 900, q: 0.5, delay: i / 3 });
    }
    powerDown() {
        this.tone(240, 0.9, { type: 'sawtooth', vol: 0.07, slideTo: 30 });
        this.noise(0.25, { vol: 0.18, freq: 300, q: 0.7, type: 'lowpass' });
    }
    // Radio hat einen eigenen kleinen Lautsprecher (Raum-Bus, immer hörbar)
    radioNote(freq, dur = 0.35, delay = 0) {
        this.tone(freq, dur, { type: 'square', vol: 0.045, delay, attack: 0.01 });
        this.tone(freq, dur * 1.2, { type: 'triangle', vol: 0.16, delay, attack: 0.01 });
        this.tone(freq / 2, dur, { type: 'sine', vol: 0.08, delay, attack: 0.01 });
    }

    // ---------- Computer-Ausgabe (nur mit Lautsprechern) ----------
    pcBlip(freq = 880) { this.tone(freq, 0.1, { type: 'sine', vol: 0.12, bus: 'pc' }); }
    startupJingle() {
        [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.15, bus: 'pc', delay: i * 0.12 }));
    }
    note(freq, dur = 0.7) {
        // Klavierähnlich: Grundton + Obertöne mit Abklingen
        this.tone(freq, dur, { type: 'triangle', vol: 0.25, bus: 'pc', attack: 0.004 });
        this.tone(freq * 2, dur * 0.6, { type: 'sine', vol: 0.06, bus: 'pc', attack: 0.004 });
        this.tone(freq * 3, dur * 0.3, { type: 'sine', vol: 0.03, bus: 'pc', attack: 0.004 });
    }

    // Simulierte Stimme für das Mikrofon (gibt der Computer leise über die Lautsprecher wieder)
    voiceStart(freq) {
        if (!this.ok || this.voice) return;
        const c = this.ctx;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        const vib = c.createOscillator();
        vib.frequency.value = 5.5;
        const vibG = c.createGain();
        vibG.gain.value = 2.5;
        vib.connect(vibG).connect(o.frequency);
        const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5;
        const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
        const g = c.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.35, c.currentTime, 0.05);
        o.connect(f1).connect(g);
        o.connect(f2).connect(g);
        g.connect(this.pc);
        o.start(); vib.start();
        this.voice = { o, vib, g };
    }
    voiceFreq(freq) {
        if (this.voice) this.voice.o.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
    }
    voiceStop() {
        if (!this.voice) return;
        const { o, vib, g } = this.voice;
        const t = this.ctx.currentTime;
        g.gain.setTargetAtTime(0, t, 0.05);
        o.stop(t + 0.3); vib.stop(t + 0.3);
        this.voice = null;
    }
}
