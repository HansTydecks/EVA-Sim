// Einkäufe für die Scanner-Station (Kasse). Die Nummern sind ausgedacht, aber gültige EAN-13-Codes.

export function eanWithCheck(d12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
    return d12 + ((10 - (sum % 10)) % 10);
}

export const PRODUCTS = [
    { id: 'cola', name: 'Cola 0,5 l', emoji: '🥤', price: 1.29, ean: eanWithCheck('400638133393'), model: 'bottle' },
    { id: 'milk', name: 'Frische Milch 1 l', emoji: '🥛', price: 1.09, ean: eanWithCheck('401234500072'), model: 'carton' },
    { id: 'choco', name: 'Vollmilch-Schokolade', emoji: '🍫', price: 0.99, ean: eanWithCheck('400050009148'), model: 'bar' },
    { id: 'juice', name: 'Apfelsaft 0,2 l', emoji: '🧃', price: 0.79, ean: eanWithCheck('428806210015'), model: 'juice' },
];

export const PRODUCT_BY_EAN = Object.fromEntries(PRODUCTS.map(p => [p.ean, p]));

export function formatEan(e) { return `${e[0]} ${e.slice(1, 7)} ${e.slice(7)}`; }
export function euro(v) { return v.toFixed(2).replace('.', ',') + ' €'; }

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const R = L.map(c => [...c].map(b => (b === '1' ? '0' : '1')).join(''));
const G = R.map(c => [...c].reverse().join(''));

// Zeichnet einen EAN-13-Strichcode samt Ziffern in ein Rechteck (weißer Aufkleber).
export function drawEan(ctx, ean, x, y, w, h) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    let bits = '101';
    const par = PARITY[Number(ean[0])];
    for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? L : G)[Number(ean[i])];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[Number(ean[i])];
    bits += '101';
    const quiet = w * 0.1;
    const mw = (w - quiet * 1.4) / bits.length;
    const barH = h * 0.72;
    ctx.fillStyle = '#111111';
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] !== '1') continue;
        const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
        ctx.fillRect(x + quiet + i * mw, y + h * 0.06, mw + 0.4, barH + (guard ? h * 0.08 : 0));
    }
    ctx.font = `bold ${Math.round(h * 0.17)}px Courier New, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ean[0], x + quiet * 0.5, y + h * 0.95);
    ctx.fillText(ean.slice(1, 7), x + quiet + 24.5 * mw, y + h * 0.95);
    ctx.fillText(ean.slice(7), x + quiet + 70.5 * mw, y + h * 0.95);
}
