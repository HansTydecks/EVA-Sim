import * as THREE from 'three';
import { APPS } from './apps.js';

export const SCREEN_W = 1024;
export const SCREEN_H = 640;
export const TOPBAR = 44;

// Der virtuelle Computer: zeichnet sein "Betriebssystem" in eine Canvas, die als Textur auf dem Monitor liegt.
export class Computer {
    constructor(game, monitor) {
        this.game = game;
        this.monitor = monitor;
        this.canvas = document.createElement('canvas');
        this.canvas.width = SCREEN_W;
        this.canvas.height = SCREEN_H;
        this.ctx = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 4;
        this.on = false;
        this.booted = false;
        this.bootT = 0;
        this.app = null;
        this.cursor = { x: SCREEN_W / 2, y: SCREEN_H / 2 };
        this.banner = null;
        this.flash = null;
        this.time = 0;
        this.drawAcc = 0;
    }

    get mouseConnected() { return !!this.game.devices.mouse?.plugged; }

    powerOn() {
        if (this.on) return;
        this.on = true;
        this.booted = false;
        this.bootT = 0;
        const sm = this.monitor.object.userData.screenMat;
        sm.map = this.texture;
        sm.color.setHex(0xffffff);
        sm.needsUpdate = true;
        this.game.devices.tower.object.userData.led.material.emissive.setHex(0x22ff55);
    }

    powerOff() {
        this.on = false;
        const sm = this.monitor.object.userData.screenMat;
        sm.map = null;
        sm.color.setHex(0x050608);
        sm.needsUpdate = true;
    }

    startApp(name, opts) {
        this.app?.stop?.();
        this.app = name ? new APPS[name](this, opts) : null;
        this.app?.start?.();
    }

    appDone(name) {
        this.game.emit('appDone', name);
    }

    showBanner(text, color = '#2fae5f', dur = 2.5) {
        this.banner = { text, color, t: dur };
    }

    setCursorNorm(u, v) {
        this.cursor.x = THREE.MathUtils.clamp(u, 0, 1) * SCREEN_W;
        this.cursor.y = THREE.MathUtils.clamp(v, 0, 1) * SCREEN_H;
        this.app?.onMouseMove?.(this.cursor.x, this.cursor.y);
    }

    click() {
        if (!this.on || !this.booted) return;
        this.app?.onClick?.(this.cursor.x, this.cursor.y);
    }

    key(e) {
        if (!this.on || !this.booted) return false;
        return this.app?.onKey?.(e) ?? false;
    }

    update(dt) {
        this.time += dt;
        if (!this.on) return;
        if (!this.booted) {
            this.bootT += dt;
            if (this.bootT > 2.6) {
                this.booted = true;
                this.game.audio.startupJingle();
                this.game.emit('booted');
            }
        }
        if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
        if (this.booted) this.app?.update?.(dt);
        // ~30 fps reichen für den Bildschirm
        this.drawAcc += dt;
        if (this.drawAcc >= 1 / 30) {
            this.drawAcc = 0;
            this.draw();
            this.texture.needsUpdate = true;
        }
    }

    draw() {
        const ctx = this.ctx;
        const W = SCREEN_W, H = SCREEN_H;
        if (!this.booted) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
            const p = Math.min(1, this.bootT / 2.4);
            ctx.fillStyle = '#e092b0';
            ctx.font = 'bold 84px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.min(1, this.bootT * 2);
            ctx.fillText('EVA-OS', W / 2, H / 2 - 40);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#333';
            roundRect(ctx, W / 2 - 200, H / 2 + 40, 400, 18, 9); ctx.fill();
            ctx.fillStyle = '#d67c9c';
            roundRect(ctx, W / 2 - 200, H / 2 + 40, 400 * p, 18, 9); ctx.fill();
            ctx.fillStyle = '#aaa';
            ctx.font = '26px Segoe UI, sans-serif';
            ctx.fillText('Computer startet …', W / 2, H / 2 + 100);
            return;
        }
        // Hintergrund
        const gr = ctx.createLinearGradient(0, 0, W, H);
        gr.addColorStop(0, '#2a1a2e'); gr.addColorStop(0.6, '#3e1e2e'); gr.addColorStop(1, '#4a1f3a');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);

        if (this.app) this.app.draw(ctx, W, H);
        else drawDesktop(this, ctx, W, H);

        // Taskleiste oben
        ctx.fillStyle = 'rgba(15,8,18,0.85)';
        ctx.fillRect(0, 0, W, TOPBAR);
        ctx.fillStyle = '#e092b0';
        ctx.font = 'bold 24px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('● EVA-OS', 14, TOPBAR / 2);
        ctx.fillStyle = '#e0c5d0';
        ctx.font = '22px Segoe UI, sans-serif';
        ctx.fillText(this.app?.title || 'Schreibtisch', 160, TOPBAR / 2);
        // Geräte-Symbole rechts
        const devs = Object.values(this.game.devices).filter(d => d.plugged && d.id !== 'monitor');
        ctx.textAlign = 'right';
        ctx.font = '24px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif';
        ctx.fillText(devs.map(d => d.def.emoji).join(' '), W - 14, TOPBAR / 2 + 1);

        if (this.banner) {
            const a = Math.min(1, this.banner.t * 3);
            ctx.globalAlpha = a;
            ctx.fillStyle = this.banner.color;
            roundRect(ctx, W / 2 - 330, H - 120, 660, 76, 20); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 34px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.banner.text, W / 2, H - 82);
            ctx.globalAlpha = 1;
        }

        // Mauszeiger
        if (this.mouseConnected) drawCursor(ctx, this.cursor.x, this.cursor.y, this.game.hand?.mouseMode);
    }
}

function drawDesktop(os, ctx, W, H) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e092b0';
    ctx.font = 'bold 54px Segoe UI, sans-serif';
    ctx.fillText('Hallo! Ich bin dein Computer.', W / 2, 150);
    ctx.fillStyle = '#e0c5d0';
    ctx.font = '28px Segoe UI, sans-serif';
    ctx.fillText('Ich VERARBEITE alles, was du eingibst.', W / 2, 210);
    const devs = Object.values(os.game.devices).filter(d => d.plugged);
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Verbundene Geräte:', W / 2, 300);
    ctx.font = '26px Segoe UI, sans-serif';
    devs.forEach((d, i) => {
        const col = d.def.cat.includes('E') && d.def.cat.includes('A') ? '#c58cf0' : d.def.cat[0] === 'E' ? '#6fdc98' : d.def.cat[0] === 'S' ? '#5fd6d6' : '#ffb066';
        ctx.fillStyle = col;
        ctx.fillText(`${d.def.name}`, W / 2, 345 + i * 38);
    });
}

function drawCursor(ctx, x, y, active) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.6, 1.6);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15);
    ctx.closePath();
    ctx.fillStyle = active ? '#fff' : '#ddd';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.6;
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function button(ctx, b, label, { color = '#d67c9c', hover = false, font = 'bold 28px Segoe UI, sans-serif', active = false } = {}) {
    ctx.fillStyle = active ? '#ffffff' : hover ? lighten(color) : color;
    roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
    if (active) { ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke(); }
    ctx.fillStyle = active ? color : '#fff';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
}

function lighten(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 30), g = Math.min(255, ((n >> 8) & 255) + 30), b = Math.min(255, (n & 255) + 30);
    return `rgb(${r},${g},${b})`;
}

export function inRect(x, y, b) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
