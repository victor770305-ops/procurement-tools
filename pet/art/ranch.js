/* =====================================================================
   糰糰夥伴 牧場環境美術庫
   依賴 creatures.js（場景中的寵物）。
   Ranch.plaza({time, season, level}) / Ranch.cabin({time}) / Ranch.market()
   Ranch.habitat(fam) / Ranch.map() / Ranch.props() → SVG 字串
   time: dawn | day | dusk | night    season: spring | summer | autumn | winter
   ===================================================================== */
(function (root) {
'use strict';
const INK = '#46324F';
const hex = c => { c = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const pal = c => ({ c, hi: mix(c, '#ffffff', .55), lt: mix(c, '#ffffff', .3), dk: mix(c, '#2a1838', .2), ln: mix(c, INK, .7) });
const f1 = n => +n.toFixed(1);

let SEQ = 0;
class Scene {
  constructor(w, h) { this.w = w; this.h = h; this.id = 'rn' + (SEQ++).toString(36); this.defs = {}; this.l = []; this.lights = []; this.k = 0; }
  g(p) { const id = this.id + 'r' + p.c.slice(1); if (!this.defs[id]) this.defs[id] = `<radialGradient id="${id}" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${p.hi}"/><stop offset=".5" stop-color="${p.c}"/><stop offset="1" stop-color="${p.dk}"/></radialGradient>`; return `url(#${id})`; }
  lin(stops, x2 = 0, y2 = 1) { const id = this.id + 'l' + (this.k++); this.defs[id] = `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`; return `url(#${id})`; }
  ulin(x1, y1, x2, y2, stops) { const id = this.id + 'u' + (this.k++); this.defs[id] = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`; return `url(#${id})`; }
  glow(c, op = .6) { const id = this.id + 'g' + (this.k++); this.defs[id] = `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${op}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; return `url(#${id})`; }
  add(...x) { this.l.push(...x); return this; }
  light(...x) { this.lights.push(...x); return this; }
  svg(cls = '') { return `<svg viewBox="0 0 ${this.w} ${this.h}" xmlns="http://www.w3.org/2000/svg" class="rn ${cls}"><defs>${Object.values(this.defs).join('')}</defs>${this.l.join('')}${this.lights.join('')}</svg>`; }
}
const st = (o = {}) => o.ns ? 'stroke="none"' : `stroke="${o.ln || INK}" stroke-width="${o.w || 3}" stroke-linejoin="round" stroke-linecap="round"`;
const E = (cx, cy, rx, ry, fill, o = {}) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" ${st(o)}${o.op ? ` opacity="${o.op}"` : ''}${o.r ? ` transform="rotate(${o.r} ${f1(cx)} ${f1(cy)})"` : ''}/>`;
const P = (d, fill, o = {}) => `<path d="${d}" fill="${fill}" ${st(o)}${o.op ? ` opacity="${o.op}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}/>`;
const R = (x, y, w, h, rx, fill, o = {}) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(rx)}" fill="${fill}" ${st(o)}${o.op ? ` opacity="${o.op}"` : ''}/>`;
const L = (d, c = INK, w = 3, op = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const T = (x, y, txt, size, fill = INK, w = 900) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="middle" font-family="-apple-system,'PingFang TC','Noto Sans TC','Noto Sans CJK TC',sans-serif">${txt}</text>`;
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* 合併輪廓：先畫粗描邊，再蓋上無描邊的填色 → 像一整塊剪影 */
function merged(shapes, fill, w = 3) {
  const out = shapes.map(([cx, cy, rx, ry]) => E(cx, cy, rx, ry ?? rx, INK, { ln: INK, w: w * 2 })).join('');
  return out + shapes.map(([cx, cy, rx, ry]) => E(cx, cy, rx, ry ?? rx, fill, { ns: 1 })).join('');
}
const star4 = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
const heartD = (x, y, k) => `M${x} ${y + 9 * k}C${x - 15 * k} ${y} ${x - 9 * k} ${y - 11 * k} ${x} ${y - 4 * k}C${x + 9 * k} ${y - 11 * k} ${x + 15 * k} ${y} ${x} ${y + 9 * k}Z`;
function gearD(cx, cy, r, n = 8) { let d = ''; const ri = r * .76; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n, q = i % 2 ? ri : r, w = Math.PI / n / 2.3; d += (i ? 'L' : 'M') + f1(cx + q * Math.cos(a - w)) + ' ' + f1(cy + q * Math.sin(a - w)) + 'L' + f1(cx + q * Math.cos(a + w)) + ' ' + f1(cy + q * Math.sin(a + w)); } return d + 'Z'; }

/* ---------- 調色盤 ---------- */
const WOOD = pal('#C98B55'), WOODL = pal('#E8B87F'), STONE = pal('#C9CCD8'), RED = pal('#E2584F'), CREAM = '#FFF5E6', GOLD = pal('#FFC93C');
const SKY = {
  dawn:  { sky: ['#FFC9A6', '#FFE3C8', '#DDEBFF'], orb: '#FFB25C', orbY: .62, hill: .0 },
  day:   { sky: ['#6FC1FF', '#B4E0FF', '#E6F6FF'], orb: '#FFE066', orbY: .22, hill: .0 },
  dusk:  { sky: ['#6E5ACB', '#FF8F7A', '#FFD08E'], orb: '#FF7A4F', orbY: .7, hill: .08 },
  night: { sky: ['#141A4A', '#2B3380', '#4C4596'], orb: '#FFF4C2', orbY: .2, hill: .0, night: true },
};
const SEASON = {
  spring: { grass: ['#B2E68C', '#86CC67'], hill: ['#C7EDA6', '#A6DD86'], far: '#D3EEC0', canopy: ['#A4DE80', '#6CBF5C'], blossom: '#FFB7CF', particle: 'petal' },
  summer: { grass: ['#93DB72', '#5DBA55'], hill: ['#A9E388', '#7FCF68'], far: '#C2E9AC', canopy: ['#72C966', '#3F9F4E'], particle: 'fly' },
  autumn: { grass: ['#E3CF77', '#C9A64E'], hill: ['#EDC777', '#DCA75A'], far: '#F2DDA6', canopy: ['#FFB54A', '#E06A35'], particle: 'leaf' },
  winter: { grass: ['#F4F8FC', '#DCE6F1'], hill: ['#FFFFFF', '#E6EEF7'], far: '#F2F6FB', canopy: ['#8CC4B0', '#5A9783'], snow: true, particle: 'snow' },
};

/* ---------- 天空與地形 ---------- */
function sky(s, time, h, opt = {}) {
  const t = SKY[time];
  s.add(R(-2, -2, s.w + 4, h + 4, 0, s.ulin(0, 0, 0, h, t.sky), { ns: 1 }));
  if (t.night) { const r = rng(7); for (let i = 0; i < 40; i++) s.add(`<circle cx="${f1(r() * s.w)}" cy="${f1(r() * h * .8)}" r="${f1(.8 + r() * 1.6)}" fill="#FFF8D6" opacity="${f1(.5 + r() * .5)}" class="rn-twinkle" style="animation-delay:${f1(r() * 3)}s"/>`); }
  const ox = opt.orbX ?? s.w * .8, oy = h * t.orbY;
  s.add(`<circle cx="${ox}" cy="${oy}" r="${t.night ? 38 : 60}" fill="${s.glow(t.orb, .55)}"/>`);
  if (t.night) s.add(`<circle cx="${ox}" cy="${oy}" r="18" fill="${t.orb}"/><circle cx="${ox + 8}" cy="${oy - 5}" r="15" fill="${t.sky[0]}"/>`);
  else s.add(`<circle cx="${ox}" cy="${oy}" r="${time === 'day' ? 22 : 26}" fill="${t.orb}"/>`);
  if (!t.night) [[s.w * .18, h * .26, .9], [s.w * .52, h * .14, .7], [s.w * .4, h * .42, .55]].forEach(([x, y, k]) => s.add(cloud(x, y, k, time === 'dusk' ? '#FFE6EE' : '#FFFFFF')));
}
function cloud(x, y, k, c = '#fff') {
  return `<g class="rn-cloud" opacity=".92">${E(x, y, 34 * k, 13 * k, c, { ns: 1 })}${E(x - 16 * k, y - 6 * k, 16 * k, 12 * k, c, { ns: 1 })}${E(x + 10 * k, y - 11 * k, 20 * k, 15 * k, c, { ns: 1 })}</g>`;
}
function hills(s, season, y, time) {
  const S = SEASON[season], W = s.w, dark = time === 'dusk' ? .12 : 0;
  s.add(P(`M-10 ${y}Q${W * .12} ${y - 70} ${W * .3} ${y - 40}Q${W * .48} ${y - 90} ${W * .68} ${y - 46}Q${W * .86} ${y - 80} ${W + 10} ${y - 36}V${y + 60}H-10Z`, mix(S.far, '#8C7AB8', dark), { ns: 1 }));
  s.add(P(`M-10 ${y + 10}Q${W * .2} ${y - 40} ${W * .42} ${y}Q${W * .64} ${y - 34} ${W * .82} ${y - 6}Q${W * .92} ${y - 20} ${W + 10} ${y}V${y + 60}H-10Z`, s.ulin(0, y - 40, 0, y + 30, [mix(S.hill[0], '#8C7AB8', dark), mix(S.hill[1], '#8C7AB8', dark)]), { ln: mix(S.hill[1], INK, .35), w: 2.4 }));
}
function ground(s, season, y, h) {
  const S = SEASON[season];
  s.add(R(-2, y, s.w + 4, h - y + 2, 0, s.ulin(0, y, 0, h, S.grass), { ns: 1 }));
  const r = rng(11);
  for (let i = 0; i < 70; i++) { const gx = r() * s.w, gy = y + 12 + r() * (h - y - 14); s.add(L(`M${f1(gx)} ${f1(gy)}l-3 -6M${f1(gx)} ${f1(gy)}l3 -7`, mix(S.grass[1], INK, .25), 1.6, .4)); }
}
function timeOverlay(s, time) {
  if (time === 'night') s.add(R(-2, -2, s.w + 4, s.h + 4, 0, '#1B1F5C', { ns: 1, op: .42 }));
  if (time === 'dusk') s.add(R(-2, -2, s.w + 4, s.h + 4, 0, '#FF7A5C', { ns: 1, op: .12 }));
  if (time === 'dawn') s.add(R(-2, -2, s.w + 4, s.h + 4, 0, '#FFB27A', { ns: 1, op: .08 }));
}
function particles(s, season, time, y0 = 0) {
  const r = rng(23), S = SEASON[season];
  if (time === 'night') for (let i = 0; i < 14; i++) s.light(`<circle cx="${f1(r() * s.w)}" cy="${f1(y0 + r() * (s.h - y0))}" r="2.6" fill="#FFF7A0" class="rn-firefly" style="animation-delay:${f1(r() * 3)}s"/><circle cx="${f1(r() * s.w)}" cy="${f1(y0 + r() * (s.h - y0))}" r="7" fill="${s.glow('#FFF7A0', .5)}"/>`);
  for (let i = 0; i < 18; i++) {
    const x = f1(r() * s.w), y = f1(r() * s.h * .9), a = f1(r() * 360);
    if (S.particle === 'petal') s.light(`<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" fill="#FFC6DA" transform="rotate(${a} ${x} ${y})" class="rn-fall" style="animation-delay:-${f1(r() * 6)}s"/>`);
    if (S.particle === 'leaf') s.light(`<path d="M${x} ${y}q6 -6 12 0q-6 6 -12 0z" fill="${r() > .5 ? '#F28B3C' : '#E05A35'}" transform="rotate(${a} ${x} ${y})" class="rn-fall" style="animation-delay:-${f1(r() * 6)}s"/>`);
    if (S.particle === 'snow') s.light(`<circle cx="${x}" cy="${y}" r="${f1(1.6 + r() * 2.4)}" fill="#fff" class="rn-fall" style="animation-delay:-${f1(r() * 6)}s"/>`);
  }
}

/* ---------- 植物 ---------- */
function tree(s, x, y, k = 1, season = 'summer', type = 'round') {
  const S = SEASON[season], r = rng(Math.round(x * 7 + y));
  let o = P(`M${x - 7 * k} ${y}Q${x - 5 * k} ${y - 30 * k} ${x - 4 * k} ${y - 52 * k}L${x + 4 * k} ${y - 52 * k}Q${x + 5 * k} ${y - 30 * k} ${x + 7 * k} ${y}Z`, s.lin([WOOD.lt, WOOD.dk], 1, 0), { w: 2.6 * k });
  const cs = [[x - 22 * k, y - 62 * k, 23 * k], [x + 22 * k, y - 62 * k, 23 * k], [x, y - 84 * k, 30 * k], [x, y - 58 * k, 26 * k], [x - 12 * k, y - 96 * k, 18 * k]];
  const canopy = type === 'gold' ? ['#FFE27A', '#F2B230'] : S.canopy;
  o += merged(cs, s.ulin(x, y - 118 * k, x, y - 36 * k, [mix(canopy[0], '#ffffff', .25), canopy[0], canopy[1]]), 2.6 * k);
  o += E(x - 12 * k, y - 98 * k, 13 * k, 7 * k, '#fff', { ns: 1, op: .35, r: -20 });
  if (season === 'spring' && type !== 'gold') for (let i = 0; i < 9; i++) o += `<circle cx="${f1(x + (r() - .5) * 64 * k)}" cy="${f1(y - 50 * k - r() * 56 * k)}" r="${f1(3.4 * k)}" fill="${S.blossom}" stroke="#E07FA6" stroke-width="${f1(1 * k)}"/>`;
  if (type === 'fruit' && season !== 'winter') for (let i = 0; i < 7; i++) { const fx = x + (r() - .5) * 60 * k, fy = y - 48 * k - r() * 50 * k; o += `<circle cx="${f1(fx)}" cy="${f1(fy)}" r="${f1(5 * k)}" fill="${s.g(pal('#FF5B5B'))}" stroke="${INK}" stroke-width="${f1(1.4 * k)}"/>`; }
  if (type === 'gold') for (let i = 0; i < 8; i++) o += `<path d="${star4(f1(x + (r() - .5) * 60 * k), f1(y - 50 * k - r() * 56 * k), f1(5 * k))}" fill="#fff" class="rn-twinkle"/>`;
  if (S.snow) o += E(x, y - 110 * k, 22 * k, 8 * k, '#fff', { ns: 1 }) + E(x - 26 * k, y - 80 * k, 13 * k, 5 * k, '#fff', { ns: 1 }) + E(x + 26 * k, y - 80 * k, 13 * k, 5 * k, '#fff', { ns: 1 });
  return o;
}
function pine(s, x, y, k = 1, season = 'summer') {
  const c = season === 'winter' ? ['#6FA992', '#477C69'] : ['#5DB873', '#2F8452'];
  const tri = (cy, w, h) => `M${x} ${cy - h}L${x + w} ${cy}Q${x} ${cy + 8 * k} ${x - w} ${cy}Z`;
  const ts = [tri(y - 18 * k, 30 * k, 36 * k), tri(y - 40 * k, 25 * k, 32 * k), tri(y - 60 * k, 19 * k, 28 * k)];
  let o = R(x - 4 * k, y - 20 * k, 8 * k, 20 * k, 2 * k, WOOD.c, { w: 2.4 * k });
  const fill = s.ulin(x - 30 * k, 0, x + 30 * k, 0, [c[0], c[1]]);
  o += ts.map(d => P(d, INK, { ln: INK, w: 5 * k })).join('') + ts.map(d => P(d, fill, { ns: 1 })).join('');
  if (season === 'winter') o += [y - 50 * k, y - 72 * k, y - 86 * k].map((cy, i) => E(x, cy, [16, 12, 7][i] * k, 4 * k, '#fff', { ns: 1 })).join('');
  return o;
}
function bush(s, x, y, k = 1, season = 'summer', flower) {
  const S = SEASON[season];
  let o = merged([[x - 16 * k, y - 12 * k, 15 * k], [x + 14 * k, y - 12 * k, 15 * k], [x, y - 22 * k, 18 * k]], s.ulin(x, y - 40 * k, x, y, [S.canopy[0], S.canopy[1]]), 2.4 * k);
  if (flower) { const r = rng(Math.round(x + y)); for (let i = 0; i < 6; i++) o += `<circle cx="${f1(x + (r() - .5) * 40 * k)}" cy="${f1(y - 8 * k - r() * 26 * k)}" r="${f1(3.4 * k)}" fill="${flower}" stroke="${INK}" stroke-width="${f1(1.1 * k)}"/>`; }
  if (S.snow) o += E(x, y - 36 * k, 14 * k, 5 * k, '#fff', { ns: 1 });
  return o;
}
function flower(x, y, r, c) {
  let o = ''; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; o += `<circle cx="${f1(x + r * Math.cos(a))}" cy="${f1(y + r * Math.sin(a))}" r="${f1(r * .8)}" fill="${c}" stroke="${mix(c, INK, .55)}" stroke-width="1.2"/>`; }
  return o + `<circle cx="${x}" cy="${y}" r="${f1(r * .62)}" fill="#FFE27A" stroke="#C9A227" stroke-width="1.1"/>`;
}
function flowers(x, y, k = 1, cols = ['#FF8FB1', '#FFE27A', '#B79CFF', '#FFFFFF'], n = 6, seed = 1) {
  const r = rng(seed + Math.round(x)); let o = '';
  for (let i = 0; i < n; i++) { const fx = x + (r() - .5) * 46 * k, fy = y - r() * 14 * k; o += L(`M${f1(fx)} ${f1(fy + 12 * k)}V${f1(fy)}`, '#4E9A4A', 2 * k) + flower(f1(fx), f1(fy), 4 * k, cols[i % cols.length]); }
  return o;
}
function sunflower(s, x, y, k = 1) {
  let o = L(`M${x} ${y}V${y - 46 * k}`, '#4E9A4A', 4 * k) + E(x - 8 * k, y - 22 * k, 9 * k, 4 * k, '#6CBF5C', { w: 1.8 * k, r: -30 });
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; o += E(x + 12 * k * Math.cos(a), y - 52 * k + 12 * k * Math.sin(a), 7 * k, 3.6 * k, '#FFD233', { w: 1.6 * k, r: a * 180 / Math.PI }); }
  return o + `<circle cx="${x}" cy="${y - 52 * k}" r="${8 * k}" fill="#8A5A2B" stroke="${INK}" stroke-width="${2 * k}"/>`;
}

/* ---------- 牧場設施 ---------- */
function fence(s, x1, x2, y, k = 1) {
  let o = R(x1, y - 26 * k, x2 - x1, 5 * k, 2 * k, CREAM, { w: 2.2 * k }) + R(x1, y - 14 * k, x2 - x1, 5 * k, 2 * k, CREAM, { w: 2.2 * k });
  for (let x = x1 + 6 * k; x <= x2 - 4 * k; x += 34 * k) o += P(`M${f1(x - 4 * k)} ${y}V${f1(y - 30 * k)}L${f1(x)} ${f1(y - 36 * k)}L${f1(x + 4 * k)} ${f1(y - 30 * k)}V${y}Z`, CREAM, { w: 2.2 * k });
  return o;
}
function hay(s, x, y, k = 1) {
  const g = pal('#F2C55C');
  return R(x - 24 * k, y - 30 * k, 36 * k, 30 * k, 8 * k, s.g(g), { w: 2.6 * k }) + E(x + 12 * k, y - 15 * k, 10 * k, 15 * k, g.lt, { w: 2.6 * k })
    + L(`M${x + 12 * k} ${y - 15 * k}m-4 0a4 5 0 1 0 8 0a6 8 0 1 0 -12 0`, g.ln, 1.6 * k, .7) + L(`M${x - 18 * k} ${y - 22 * k}h18M${x - 20 * k} ${y - 12 * k}h22`, g.ln, 1.4 * k, .5);
}
function barn(s, x, y, k = 1, night) {
  const W = 52 * k;
  let o = R(x - W, y - 70 * k, W * 2, 70 * k, 3 * k, s.ulin(x, y - 70 * k, x, y, [RED.lt, RED.c, RED.dk]), { w: 3 * k });
  o += L(`M${x - W + 8 * k} ${y - 66 * k}V${y - 4 * k}M${x + W - 8 * k} ${y - 66 * k}V${y - 4 * k}`, '#fff', 3 * k, .8);
  o += P(`M${x - W - 8 * k} ${y - 68 * k}L${x - W + 6 * k} ${y - 104 * k}L${x} ${y - 126 * k}L${x + W - 6 * k} ${y - 104 * k}L${x + W + 8 * k} ${y - 68 * k}Z`, s.ulin(x, y - 126 * k, x, y - 68 * k, ['#A44A44', '#7A3236']), { w: 3 * k });
  o += L(`M${x - W - 8 * k} ${y - 68 * k}L${x - W + 6 * k} ${y - 104 * k}L${x} ${y - 126 * k}L${x + W - 6 * k} ${y - 104 * k}L${x + W + 8 * k} ${y - 68 * k}`, '#fff', 2.4 * k, .85);
  o += R(x - 20 * k, y - 46 * k, 40 * k, 46 * k, 2 * k, '#B9473F', { w: 2.6 * k }) + L(`M${x - 20 * k} ${y - 46 * k}L${x + 20 * k} ${y}M${x + 20 * k} ${y - 46 * k}L${x - 20 * k} ${y}`, '#fff', 3 * k);
  o += R(x - 12 * k, y - 100 * k, 24 * k, 20 * k, 3 * k, night ? '#FFE48A' : '#5A3A3A', { w: 2.4 * k }) + L(`M${x} ${y - 100 * k}V${y - 80 * k}`, '#fff', 2 * k);
  if (night) s.light(`<circle cx="${x}" cy="${y - 90 * k}" r="${30 * k}" fill="${s.glow('#FFE48A', .55)}"/>`);
  return o;
}
function cabin(s, x, y, k = 1, roof = '#E0705C', night, opt = {}) {
  const W = 36 * k, wd = pal('#E9BA80'), rf = pal(roof);
  let o = '';
  if (opt.chimney !== false) o += R(x + 14 * k, y - 82 * k, 11 * k, 24 * k, 2 * k, STONE.c, { w: 2.4 * k }) + (night ? '' : `<g class="rn-smoke">${E(x + 20 * k, y - 92 * k, 7 * k, 5 * k, '#fff', { ns: 1, op: .8 })}${E(x + 26 * k, y - 104 * k, 9 * k, 6 * k, '#fff', { ns: 1, op: .6 })}</g>`);
  o += R(x - W, y - 50 * k, W * 2, 50 * k, 3 * k, s.ulin(x, y - 50 * k, x, y, [wd.lt, wd.c, wd.dk]), { w: 3 * k });
  o += L(`M${x - W} ${y - 38 * k}H${x + W}M${x - W} ${y - 26 * k}H${x + W}M${x - W} ${y - 14 * k}H${x + W}`, wd.ln, 1.4 * k, .35);
  o += P(`M${x - W - 9 * k} ${y - 46 * k}L${x} ${y - 84 * k}L${x + W + 9 * k} ${y - 46 * k}Z`, s.ulin(x, y - 84 * k, x, y - 46 * k, [rf.lt, rf.dk]), { w: 3 * k });
  o += R(x - 9 * k, y - 30 * k, 18 * k, 30 * k, 8 * k, '#9B6338', { w: 2.4 * k }) + `<circle cx="${x + 5 * k}" cy="${y - 14 * k}" r="${1.8 * k}" fill="${GOLD.c}"/>`;
  o += R(x - 30 * k, y - 38 * k, 15 * k, 14 * k, 3 * k, night ? '#FFE48A' : '#BFE6FF', { w: 2.2 * k }) + R(x + 15 * k, y - 38 * k, 15 * k, 14 * k, 3 * k, night ? '#FFE48A' : '#BFE6FF', { w: 2.2 * k });
  if (opt.sign) o += R(x - 16 * k, y - 62 * k, 32 * k, 12 * k, 3 * k, CREAM, { w: 2 * k }) + T(x, y - 53 * k, opt.sign, 8 * k);
  if (night) s.light(`<circle cx="${x}" cy="${y - 30 * k}" r="${40 * k}" fill="${s.glow('#FFE48A', .45)}"/>`);
  return o;
}
function windmill(s, x, y, k = 1) {
  let o = P(`M${x - 22 * k} ${y}L${x - 13 * k} ${y - 92 * k}H${x + 13 * k}L${x + 22 * k} ${y}Z`, s.ulin(x - 22 * k, 0, x + 22 * k, 0, [CREAM, '#E9D9C2']), { w: 3 * k });
  o += P(`M${x - 18 * k} ${y - 90 * k}Q${x} ${y - 118 * k} ${x + 18 * k} ${y - 90 * k}Z`, '#5B8DEF', { w: 3 * k }) + R(x - 7 * k, y - 26 * k, 14 * k, 26 * k, 6 * k, '#9B6338', { w: 2.4 * k }) + `<circle cx="${x}" cy="${y - 58 * k}" r="${6 * k}" fill="#BFE6FF" stroke="${INK}" stroke-width="${2 * k}"/>`;
  let bl = '';
  for (let i = 0; i < 4; i++) bl += `<g transform="rotate(${i * 90 + 20} ${x} ${y - 98 * k})">${R(x - 4 * k, y - 160 * k, 16 * k, 56 * k, 2 * k, '#FFF8EE', { w: 2.4 * k })}${L(`M${x} ${y - 98 * k}V${y - 160 * k}M${x} ${y - 146 * k}h12M${x} ${y - 132 * k}h12M${x} ${y - 118 * k}h12`, INK, 1.6 * k, .6)}</g>`;
  return o + `<g class="rn-spin" style="transform-origin:${x}px ${f1(y - 98 * k)}px">${bl}</g><circle cx="${x}" cy="${y - 98 * k}" r="${6 * k}" fill="${GOLD.c}" stroke="${INK}" stroke-width="${2.4 * k}"/>`;
}
function tower(s, x, y, k = 1) {
  const W = 22 * k;
  let o = R(x - W, y - 110 * k, W * 2, 110 * k, 4 * k, s.ulin(x - W, 0, x + W, 0, [STONE.hi, STONE.c, STONE.dk]), { w: 3 * k });
  for (let i = 0; i < 6; i++) o += L(`M${x - W} ${y - 18 * k * (i + 1)}H${x + W}`, STONE.ln, 1.4 * k, .4) + L(`M${x + (i % 2 ? -8 : 8) * k} ${y - 18 * k * (i + 1)}v18`, STONE.ln, 1.4 * k, .4);
  o += P(`M${x - W - 6 * k} ${y - 110 * k}V${y - 126 * k}H${x - W + 4 * k}V${y - 118 * k}H${x - 5 * k}V${y - 126 * k}H${x + 5 * k}V${y - 118 * k}H${x + W - 4 * k}V${y - 126 * k}H${x + W + 6 * k}V${y - 110 * k}Z`, STONE.c, { w: 3 * k });
  o += R(x - 5 * k, y - 84 * k, 10 * k, 18 * k, 5 * k, '#3D3550', { w: 2 * k }) + R(x - 9 * k, y - 26 * k, 18 * k, 26 * k, 9 * k, '#9B6338', { w: 2.4 * k });
  o += L(`M${x} ${y - 126 * k}V${y - 160 * k}`, INK, 2.6 * k) + P(`M${x} ${y - 160 * k}L${x + 26 * k} ${y - 152 * k}L${x} ${y - 144 * k}Z`, '#5B8DEF', { w: 2 * k, cls: 'rn-flag' });
  return o;
}
function observatory(s, x, y, k = 1) {
  const W = 34 * k, d = pal('#8C6CF0');
  let o = R(x - W, y - 46 * k, W * 2, 46 * k, 4 * k, s.ulin(x - W, 0, x + W, 0, ['#FFFFFF', '#E4DEF5']), { w: 3 * k });
  o += L(`M${x + 18 * k} ${y - 78 * k}L${x + 50 * k} ${y - 106 * k}`, INK, 13 * k) + L(`M${x + 18 * k} ${y - 78 * k}L${x + 50 * k} ${y - 106 * k}`, '#C9CED8', 8 * k);
  o += P(`M${x - W - 4 * k} ${y - 44 * k}A${W + 4 * k} ${W + 4 * k} 0 0 1 ${x + W + 4 * k} ${y - 44 * k}Z`, s.ulin(x, y - 84 * k, x, y - 44 * k, [d.hi, d.c, d.dk]), { w: 3 * k });
  o += P(`M${x + 2 * k} ${y - 80 * k}L${x + 10 * k} ${y - 80 * k}L${x + 12 * k} ${y - 46 * k}L${x} ${y - 46 * k}Z`, '#2E2A6B', { w: 2 * k });
  o += R(x - 8 * k, y - 28 * k, 16 * k, 28 * k, 8 * k, '#6E5BC4', { w: 2.4 * k }) + `<path d="${star4(x - 18 * k, y - 66 * k, 5 * k)}" fill="#FFF3B0"/>`;
  return o;
}
function clawMachine(s, x, y, k = 1, c = '#FF7AA2') {
  const p = pal(c), W = 26 * k;
  let o = R(x - W, y - 96 * k, W * 2, 96 * k, 8 * k, s.ulin(x - W, 0, x + W, 0, [p.lt, p.c, p.dk]), { w: 3 * k });
  o += R(x - W + 5 * k, y - 84 * k, W * 2 - 10 * k, 44 * k, 5 * k, s.lin(['#F4FBFF', '#CDEBFF']), { w: 2.4 * k });
  ['#FFD45C', '#7FD68E', '#8CC4FF', '#B79CFF'].forEach((cc, i) => { o += `<circle cx="${f1(x - 13 * k + i * 8.6 * k)}" cy="${f1(y - 47 * k)}" r="${f1(4.2 * k)}" fill="${cc}" stroke="${INK}" stroke-width="${f1(1.2 * k)}"/>`; });
  o += L(`M${x} ${y - 84 * k}V${y - 70 * k}`, '#8A93A6', 1.6 * k) + L(`M${x - 5 * k} ${y - 62 * k}Q${x - 6 * k} ${y - 68 * k} ${x} ${y - 70 * k}Q${x + 6 * k} ${y - 68 * k} ${x + 5 * k} ${y - 62 * k}`, '#8A93A6', 2.2 * k);
  for (let i = 0; i < 6; i++) o += `<circle cx="${f1(x - 20 * k + i * 8 * k)}" cy="${f1(y - 90 * k)}" r="${f1(2.2 * k)}" fill="${['#FFF27A', '#7FE3FF'][i % 2]}" class="rn-blink" style="animation-delay:${i * .15}s"/>`;
  o += R(x - 10 * k, y - 30 * k, 20 * k, 14 * k, 3 * k, '#3D3550', { w: 2 * k }) + R(x - 4 * k, y - 36 * k, 8 * k, 3 * k, 1, GOLD.c, { ns: 1 });
  return o;
}
function stall(s, x, y, k = 1, label = '雜貨鋪', stripe = '#FF8FB1') {
  const W = 50 * k;
  let o = L(`M${x - W + 4 * k} ${y}V${y - 86 * k}M${x + W - 4 * k} ${y}V${y - 86 * k}`, INK, 6 * k) + L(`M${x - W + 4 * k} ${y}V${y - 86 * k}M${x + W - 4 * k} ${y}V${y - 86 * k}`, WOODL.c, 3 * k);
  o += R(x - W, y - 34 * k, W * 2, 34 * k, 4 * k, s.ulin(x, y - 34 * k, x, y, [WOODL.lt, WOOD.c]), { w: 3 * k }) + L(`M${x - W} ${y - 22 * k}H${x + W}`, WOOD.ln, 1.4 * k, .4);
  let aw = `M${x - W - 6 * k} ${y - 70 * k}L${x - W + 2 * k} ${y - 96 * k}H${x + W - 2 * k}L${x + W + 6 * k} ${y - 70 * k}`;
  const n = 6, sw = (W * 2 + 12 * k) / n;
  for (let i = n - 1; i >= 0; i--) aw += `Q${f1(x - W - 6 * k + sw * (i + .5))} ${f1(y - 58 * k)} ${f1(x - W - 6 * k + sw * i)} ${f1(y - 70 * k)}`;
  o += P(aw + 'Z', '#fff', { w: 3 * k });
  for (let i = 0; i < n; i += 2) o += P(`M${f1(x - W - 6 * k + sw * i)} ${y - 70 * k}L${f1(x - W + 2 * k + (W * 2 - 4 * k) / n * i)} ${y - 96 * k}H${f1(x - W + 2 * k + (W * 2 - 4 * k) / n * (i + 1))}L${f1(x - W - 6 * k + sw * (i + 1))} ${y - 70 * k}Q${f1(x - W - 6 * k + sw * (i + .5))} ${f1(y - 58 * k)} ${f1(x - W - 6 * k + sw * i)} ${y - 70 * k}Z`, stripe, { w: 2 * k });
  o += R(x - 26 * k, y - 118 * k, 52 * k, 20 * k, 6 * k, CREAM, { w: 2.6 * k }) + T(x, y - 103 * k, label, 12 * k);
  return o;
}
function board(s, x, y, k = 1) {
  let o = L(`M${x - 30 * k} ${y}V${y - 70 * k}M${x + 30 * k} ${y}V${y - 70 * k}`, INK, 7 * k) + L(`M${x - 30 * k} ${y}V${y - 70 * k}M${x + 30 * k} ${y}V${y - 70 * k}`, WOOD.c, 4 * k);
  o += P(`M${x - 42 * k} ${y - 76 * k}L${x} ${y - 94 * k}L${x + 42 * k} ${y - 76 * k}Z`, '#E0705C', { w: 2.6 * k });
  o += R(x - 38 * k, y - 76 * k, 76 * k, 50 * k, 4 * k, s.ulin(x, y - 76 * k, x, y - 26 * k, [WOODL.lt, WOODL.c]), { w: 2.6 * k });
  [['#FFF6C9', -24, -68, -6], ['#D9F2FF', -4, -70, 4], ['#FFE0EC', 16, -66, -3], ['#E6F7E0', -14, -50, 3], ['#FFFFFF', 8, -48, -5]].forEach(([c, dx, dy, a]) => {
    o += `<g transform="rotate(${a} ${x + dx * k} ${y + dy * k})">${R(x + (dx - 8) * k, y + dy * k, 17 * k, 18 * k, 1.5 * k, c, { w: 1.6 * k })}${L(`M${x + (dx - 5) * k} ${y + (dy + 6) * k}h11M${x + (dx - 5) * k} ${y + (dy + 10) * k}h8`, '#A895B5', 1.2 * k)}<circle cx="${x + (dx + .5) * k}" cy="${y + (dy + 2) * k}" r="${1.8 * k}" fill="#FF6B6B"/></g>`;
  });
  return o;
}
function incubator(s, x, y, k = 1, night) {
  const W = 34 * k;
  let o = P(`M${x - W} ${y}V${y - 34 * k}Q${x - W} ${y - 50 * k} ${x} ${y - 52 * k}Q${x + W} ${y - 50 * k} ${x + W} ${y - 34 * k}V${y}Z`, s.ulin(x, y - 52 * k, x, y, ['#FFF1DE', '#F1D7B5']), { w: 3 * k });
  o += P(`M${x - W - 8 * k} ${y - 36 * k}Q${x} ${y - 96 * k} ${x + W + 8 * k} ${y - 36 * k}Q${x} ${y - 48 * k} ${x - W - 8 * k} ${y - 36 * k}Z`, s.ulin(x, y - 80 * k, x, y - 36 * k, ['#F7D27A', '#D9A443']), { w: 3 * k });
  o += L(`M${x - 30 * k} ${y - 44 * k}Q${x} ${y - 80 * k} ${x + 30 * k} ${y - 44 * k}`, '#B98A2E', 1.4 * k, .5);
  o += `<circle cx="${x}" cy="${y - 26 * k}" r="${14 * k}" fill="${night ? '#FFE48A' : '#FFF6DE'}" stroke="${INK}" stroke-width="${2.6 * k}"/>` + E(x, y - 24 * k, 7 * k, 9 * k, '#FFFFFF', { w: 1.8 * k }) + `<circle cx="${x - 2 * k}" cy="${y - 26 * k}" r="${1.8 * k}" fill="#FF9EC4"/><circle cx="${x + 3 * k}" cy="${y - 21 * k}" r="${1.4 * k}" fill="#8CC4FF"/>`;
  s.light(`<circle cx="${x}" cy="${y - 26 * k}" r="${26 * k}" fill="${s.glow('#FFD27A', night ? .6 : .35)}"/>`);
  return o;
}
function pond(s, x, y, rx, ry, season = 'summer', crystal) {
  const ice = season === 'winter';
  let o = E(x, y, rx + 8, ry + 6, s.ulin(0, y - ry, 0, y + ry, ['#D6CCB8', '#BDB2A0']), { w: 2.6 });
  o += E(x, y, rx, ry, s.ulin(0, y - ry, 0, y + ry, ice ? ['#E8F6FF', '#C3E2F5'] : ['#8FD7F5', '#5BB3E0']), { w: 2.4 });
  o += L(`M${x - rx * .5} ${y - ry * .2}h${rx * .3}M${x + rx * .1} ${y + ry * .25}h${rx * .35}`, '#fff', 2.4, .8);
  if (!ice && !crystal) o += E(x - rx * .45, y + ry * .2, 9, 5, '#6CBF5C', { w: 1.8 }) + flower(f1(x - rx * .45), f1(y + ry * .1), 3, '#FF9EC4') + E(x + rx * .5, y - ry * .15, 7, 4, '#6CBF5C', { w: 1.6 });
  return o;
}
function crystals(s, x, y, k = 1) {
  const cr = (cx, h, w, c, a) => `<g transform="rotate(${a} ${cx} ${y})">${P(`M${cx} ${y - h}L${cx + w} ${y - h * .7}L${cx + w * .7} ${y}L${cx - w * .7} ${y}L${cx - w} ${y - h * .7}Z`, s.ulin(cx - w, 0, cx + w, 0, [mix(c, '#ffffff', .6), c]), { w: 2.2 * k })}${L(`M${cx} ${y - h}L${cx - w * .2} ${y - h * .7}L${cx - w * .6} ${y}`, '#fff', 1.6 * k, .8)}</g>`;
  return cr(x - 12 * k, 30 * k, 8 * k, '#A8E6F5', -18) + cr(x + 12 * k, 26 * k, 7 * k, '#CDB8FF', 16) + cr(x, 44 * k, 10 * k, '#B6A0FF', 0);
}
function stage(s, x, y, k = 1, level = 3) {
  if (level === 1) return R(x - 34 * k, y - 26 * k, 68 * k, 26 * k, 5 * k, s.ulin(x, y - 26 * k, x, y, [WOODL.lt, WOOD.c]), { w: 3 * k }) + L(`M${x - 34 * k} ${y - 13 * k}H${x + 34 * k}`, WOOD.ln, 1.6 * k, .5);
  let o = `<ellipse cx="${x}" cy="${y - 30 * k}" rx="${110 * k}" ry="${34 * k}" fill="${s.glow('#FFE7A0', .7)}"/>`;
  o += E(x, y - 8 * k, 88 * k, 22 * k, s.ulin(0, y - 30 * k, 0, y + 14 * k, [STONE.hi, STONE.dk]), { w: 3 * k });
  o += P(`M${x - 88 * k} ${y - 8 * k}V${y - 20 * k}A${88 * k} ${22 * k} 0 0 1 ${x + 88 * k} ${y - 20 * k}V${y - 8 * k}`, 'none', { w: 3 * k });
  o += E(x, y - 22 * k, 70 * k, 17 * k, s.ulin(0, y - 40 * k, 0, y - 5 * k, ['#FFFFFF', '#E6E8F2']), { w: 3 * k });
  if (level >= 3) o += E(x, y - 22 * k, 60 * k, 13 * k, 'none', { ln: GOLD.c, w: 3 * k }) + [-1, 1].map(g => L(`M${x + g * 96 * k} ${y - 4 * k}V${y - 120 * k}`, INK, 6 * k) + L(`M${x + g * 96 * k} ${y - 4 * k}V${y - 120 * k}`, GOLD.c, 3 * k) + P(`M${x + g * 96 * k} ${y - 116 * k}h${-g * 24 * k}v34l${g * 12 * k} -8l${g * 12 * k} 8z`, '#5B8DEF', { w: 2.2 * k, cls: 'rn-flag' }) + `<circle cx="${x + g * 96 * k}" cy="${y - 124 * k}" r="${5 * k}" fill="${GOLD.c}" stroke="${INK}" stroke-width="${2 * k}"/>`).join('');
  return o;
}
function arch(s, x, y, k = 1, text = '糰糰牧場') {
  let o = [-1, 1].map(g => R(x + g * 60 * k - 7 * k, y - 96 * k, 14 * k, 96 * k, 4 * k, s.ulin(0, y - 96 * k, 0, y, [WOODL.lt, WOOD.c]), { w: 3 * k })).join('');
  o += P(`M${x - 74 * k} ${y - 84 * k}Q${x} ${y - 128 * k} ${x + 74 * k} ${y - 84 * k}L${x + 70 * k} ${y - 70 * k}Q${x} ${y - 110 * k} ${x - 70 * k} ${y - 70 * k}Z`, s.ulin(0, y - 128 * k, 0, y - 70 * k, [WOODL.lt, WOODL.c]), { w: 3 * k });
  o += R(x - 46 * k, y - 118 * k, 92 * k, 26 * k, 8 * k, CREAM, { w: 2.6 * k }) + T(x, y - 99 * k, text, 15 * k);
  [-58, -36, 36, 58].forEach((dx, i) => { o += flower(f1(x + dx * k), f1(y - 84 * k - Math.abs(dx) * -.18 * k - 12 * k), 4 * k, ['#FF8FB1', '#FFE27A', '#B79CFF', '#FF8FB1'][i]); });
  return o;
}
function lamp(s, x, y, k = 1, night) {
  let o = L(`M${x} ${y}V${y - 58 * k}`, INK, 5 * k) + L(`M${x} ${y}V${y - 58 * k}`, '#5B5470', 2.4 * k);
  o += P(`M${x - 9 * k} ${y - 58 * k}L${x - 7 * k} ${y - 76 * k}H${x + 7 * k}L${x + 9 * k} ${y - 58 * k}Z`, night ? '#FFE48A' : '#FFF8E0', { w: 2.4 * k }) + P(`M${x - 11 * k} ${y - 76 * k}L${x} ${y - 86 * k}L${x + 11 * k} ${y - 76 * k}Z`, '#5B5470', { w: 2.2 * k });
  if (night) s.light(`<circle cx="${x}" cy="${y - 66 * k}" r="${38 * k}" fill="${s.glow('#FFE48A', .55)}"/>`);
  return o;
}
function bunting(x1, y1, x2, y2, sag = 26, n = 9) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
  let o = L(`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, INK, 1.6);
  const cols = ['#FF8FB1', '#FFD45C', '#7FD68E', '#8CC4FF', '#B79CFF'];
  for (let i = 1; i < n; i++) { const t = i / n, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2; o += P(`M${f1(x - 7)} ${f1(y)}L${f1(x + 7)} ${f1(y)}L${f1(x)} ${f1(y + 14)}Z`, cols[i % 5], { w: 1.6, cls: 'rn-flag' }); }
  return o;
}
function path(s, d, w = 34, season = 'summer') {
  const c = season === 'winter' ? ['#E6DED2', '#D2C6B6'] : ['#F3DDB4', '#DCC096'];
  return L(d, c[1], w + 6) + L(d, c[0], w) + L(d, '#fff', 2, .25);
}
function wall(s, x1, x2, y, k = 1) {
  let o = R(x1, y - 36 * k, x2 - x1, 36 * k, 3 * k, s.ulin(0, y - 36 * k, 0, y, [STONE.hi, STONE.dk]), { w: 3 * k });
  for (let x = x1; x < x2 - 6 * k; x += 20 * k) o += R(x + 2 * k, y - 46 * k, 12 * k, 12 * k, 2 * k, STONE.c, { w: 2.4 * k });
  for (let i = 0; i < (x2 - x1) / (24 * k); i++) o += L(`M${f1(x1 + i * 24 * k + (i % 2) * 12 * k)} ${y - 24 * k}h14M${f1(x1 + i * 24 * k + 6 * k)} ${y - 12 * k}h14`, STONE.ln, 1.4 * k, .4);
  return o;
}
function banner(s, x, y, k = 1, c = '#5B8DEF') {
  return L(`M${x} ${y}V${y - 70 * k}`, INK, 5 * k) + L(`M${x} ${y}V${y - 70 * k}`, WOOD.c, 2.4 * k) + P(`M${x} ${y - 66 * k}h${22 * k}v${30 * k}l-${11 * k} -6l-${11 * k} 6z`, c, { w: 2 * k, cls: 'rn-flag' }) + P(`M${x + 11 * k} ${y - 58 * k}l6 2v7q-6 7 -12 0v-7z`, '#FFD45C', { w: 1.4 * k });
}
function gearStatue(s, x, y, k = 1) {
  return R(x - 22 * k, y - 18 * k, 44 * k, 18 * k, 4 * k, STONE.c, { w: 2.6 * k }) + `<g class="rn-spin" style="transform-origin:${x}px ${f1(y - 50 * k)}px">${P(gearD(x, y - 50 * k, 30 * k, 10), s.ulin(x - 30 * k, 0, x + 30 * k, 0, ['#FFE08A', '#F2A23B']), { w: 2.8 * k })}</g><circle cx="${x}" cy="${y - 50 * k}" r="${10 * k}" fill="${STONE.c}" stroke="${INK}" stroke-width="${2.4 * k}"/>`;
}
function workshop(s, x, y, k = 1, night) {
  const W = 46 * k, wd = pal('#A9B6C8');
  let o = R(x - W, y - 54 * k, W * 2, 54 * k, 3 * k, s.ulin(x, y - 54 * k, x, y, [wd.lt, wd.dk]), { w: 3 * k });
  o += P(`M${x - W - 8 * k} ${y - 50 * k}L${x - W + 10 * k} ${y - 78 * k}H${x + W - 10 * k}L${x + W + 8 * k} ${y - 50 * k}Z`, s.ulin(0, y - 78 * k, 0, y - 50 * k, ['#FFB36B', '#E2733A']), { w: 3 * k });
  o += R(x - 22 * k, y - 38 * k, 44 * k, 38 * k, 3 * k, '#5B5470', { w: 2.6 * k }) + L(`M${x - 22 * k} ${y - 28 * k}H${x + 22 * k}M${x - 22 * k} ${y - 18 * k}H${x + 22 * k}M${x - 22 * k} ${y - 8 * k}H${x + 22 * k}`, '#8A84A0', 2 * k);
  o += P(gearD(x, y - 66 * k, 9 * k, 8), GOLD.c, { w: 2 * k }) + R(x + W - 18 * k, y - 96 * k, 12 * k, 30 * k, 2 * k, STONE.c, { w: 2.4 * k });
  if (!night) o += `<g class="rn-smoke">${E(x + W - 12 * k, y - 104 * k, 8 * k, 6 * k, '#fff', { ns: 1, op: .8 })}${E(x + W - 4 * k, y - 116 * k, 10 * k, 7 * k, '#fff', { ns: 1, op: .6 })}</g>`;
  return o;
}
function cloudBench(s, x, y, k = 1) {
  return P(`M${x - 40 * k} ${y}Q${x - 52 * k} ${y - 10 * k} ${x - 40 * k} ${y - 20 * k}Q${x - 36 * k} ${y - 36 * k} ${x - 16 * k} ${y - 30 * k}Q${x} ${y - 44 * k} ${x + 16 * k} ${y - 30 * k}Q${x + 36 * k} ${y - 36 * k} ${x + 40 * k} ${y - 20 * k}Q${x + 52 * k} ${y - 10 * k} ${x + 40 * k} ${y}Z`, s.ulin(0, y - 44 * k, 0, y, ['#FFFFFF', '#FFE0EE']), { w: 2.8 * k });
}
function heartArch(s, x, y, k = 1) {
  let o = L(`M${x - 40 * k} ${y}V${y - 60 * k}Q${x - 40 * k} ${y - 100 * k} ${x} ${y - 100 * k}Q${x + 40 * k} ${y - 100 * k} ${x + 40 * k} ${y - 60 * k}V${y}`, INK, 9 * k) + L(`M${x - 40 * k} ${y}V${y - 60 * k}Q${x - 40 * k} ${y - 100 * k} ${x} ${y - 100 * k}Q${x + 40 * k} ${y - 100 * k} ${x + 40 * k} ${y - 60 * k}V${y}`, '#FFFFFF', 5 * k);
  const r = rng(Math.round(x));
  for (let i = 0; i < 14; i++) { const t = i / 13, a = Math.PI * (1 - t), px = t < .25 ? x - 40 * k : t > .75 ? x + 40 * k : x - 40 * k * Math.cos(a * 1), py = t < .25 ? y - t * 240 * k : t > .75 ? y - (1 - t) * 240 * k : y - 60 * k - 40 * k * Math.sin(Math.PI * (t - .25) * 2); o += flower(f1(px + (r() - .5) * 6), f1(py), 4.4 * k, ['#FF8FB1', '#FFFFFF', '#FFB7CF'][i % 3]); }
  return o + `<path d="${heartD(x, y - 100 * k, 1.1 * k)}" fill="#FF6F9A" stroke="${INK}" stroke-width="${2 * k}"/>`;
}
function balloons(x, y, k = 1) {
  return [['#FF8FB1', -10, -70], ['#FFD45C', 6, -82], ['#8CC4FF', 16, -66]].map(([c, dx, dy]) => L(`M${x} ${y}Q${x + dx * k * .5} ${y + dy * k * .5} ${x + dx * k} ${y + (dy + 12) * k}`, '#9A8AA8', 1.4) + `<path d="${heartD(x + dx * k, y + dy * k, 1.1 * k)}" fill="${c}" stroke="${INK}" stroke-width="${2 * k}"/>`).join('');
}
function field(s, x, y, w, h, season = 'summer', crop = 'sprout') {
  let o = P(`M${x} ${y}L${x + w} ${y}L${x + w + 16} ${y + h}L${x - 16} ${y + h}Z`, s.ulin(0, y, 0, y + h, ['#B98257', '#9C6A44']), { w: 2.6 });
  const rows = Math.round(h / 16);
  for (let i = 0; i < rows; i++) { const ry = y + 8 + i * 16, sx = x - 16 * (ry - y) / h, ex = x + w + 16 * (ry - y) / h; o += L(`M${f1(sx + 4)} ${f1(ry)}H${f1(ex - 4)}`, '#8A5A38', 3, .5);
    if (season !== 'winter') for (let cx = sx + 10; cx < ex - 6; cx += 16) o += crop === 'wheat' ? L(`M${f1(cx)} ${f1(ry)}l-2 -10M${f1(cx)} ${f1(ry)}l2 -9`, '#E7B53C', 2.4) + E(cx - 2, ry - 11, 2.4, 3.6, '#F2C94C', { ns: 1 }) : E(cx, ry - 4, 5, 3.6, '#6CBF5C', { w: 1.4, r: -30 }) + E(cx + 4, ry - 5, 5, 3.6, '#86D67A', { w: 1.4, r: 30 });
    else o += L(`M${f1(sx + 4)} ${f1(ry - 2)}H${f1(ex - 4)}`, '#fff', 5, .9); }
  return o;
}
function honor(s, x, y, k = 1, season) {
  let o = tree(s, x, y, 1.1 * k, season, 'gold');
  [-46, 46].forEach(dx => { o += R(x + dx * k - 10 * k, y - 22 * k, 20 * k, 22 * k, 3 * k, STONE.c, { w: 2.4 * k }) + P(`M${x + dx * k - 9 * k} ${y - 36 * k}h18l-3 14h-12z`, GOLD.c, { w: 2 * k }) + E(x + dx * k, y - 38 * k, 11 * k, 4 * k, GOLD.lt, { w: 2 * k }); });
  return o + R(x - 20 * k, y - 12 * k, 40 * k, 12 * k, 3 * k, CREAM, { w: 2 * k }) + T(x, y - 3 * k, '名人堂', 8 * k);
}
function crate(s, x, y, k = 1, top) {
  return R(x - 16 * k, y - 26 * k, 32 * k, 26 * k, 3 * k, s.ulin(0, y - 26 * k, 0, y, [WOODL.lt, WOOD.c]), { w: 2.6 * k }) + L(`M${x - 16 * k} ${y - 13 * k}H${x + 16 * k}M${x - 16 * k} ${y - 26 * k}L${x + 16 * k} ${y}`, WOOD.ln, 1.6 * k, .5) + (top || '');
}
function label(x, y, title, sub, c = '#FF7A59') {
  const w = Math.max(title.length * 15 + 24, (sub || '').length * 11 + 24);
  return `<g>${R(x - w / 2, y - 18, w, sub ? 40 : 28, 14, '#fff', { ln: c, w: 2.6 })}${T(x, y + 1, title, 14, c)}${sub ? T(x, y + 16, sub, 10, '#7A6E88', 700) : ''}</g>`;
}

/* ---------- 寵物 ---------- */
function pet(id, stage, x, y, size, opt = {}) {
  if (!root.Creatures) return '';
  const svg = root.Creatures.draw(id, stage, opt);
  return svg.replace('<svg ', `<svg x="${f1(x - size / 2)}" y="${f1(y - size * .9)}" width="${size}" height="${size}" `);
}

/* ======================= 場景 ======================= */
function plaza(o = {}) {
  const time = o.time || 'day', season = o.season || 'summer', lv = o.level || 3, night = time === 'night';
  const s = new Scene(400, 540);
  sky(s, time, 300, { orbX: 312 });
  if (lv >= 3) s.add(observatory(s, 58, 236, .55), windmill(s, 350, 250, .6));
  hills(s, season, 262, time);
  ground(s, season, 262, 540);
  s.add(pine(s, 20, 280, .8, season), pine(s, 384, 282, .75, season));
  if (lv >= 2) s.add(fence(s, -10, 410, 300, .9));
  if (lv >= 3) s.add(barn(s, 74, 316, .72, night));
  if (lv >= 2) s.add(cabin(s, 322, 314, .72, '#5B8DEF', night));
  s.add(tree(s, lv >= 3 ? 156 : 300, 300, .62, season, lv >= 3 ? 'fruit' : 'round'));
  if (lv >= 3) s.add(tree(s, 250, 296, .56, season));
  s.add(path(s, 'M200 560Q196 470 200 410', 70, season));
  if (lv >= 3) s.add(bunting(10, 268, 390, 268, 30, 13));
  s.add(stage(s, 200, 410, lv >= 2 ? .95 : 1.1, lv));
  const legend = o.storePet || ['g4', Math.min(3, lv)];
  s.add(pet(legend[0], legend[1], 200, lv === 1 ? 386 : 392, lv === 1 ? 110 : 150));
  if (lv >= 2) s.add(hay(s, 46, 400, .9), hay(s, 72, 420, .8), lamp(s, 104, 436, .9, night), lamp(s, 296, 436, .9, night));
  if (lv >= 2) s.add(flowers(330, 404, 1, undefined, 7, 3), flowers(150, 462, .8, undefined, 5, 4));
  if (lv >= 3) s.add(pond(s, 348, 478, 38, 16, season), bush(s, 26, 500, .9, season, '#FF8FB1'), flowers(258, 470, .9, ['#FFE27A', '#FFFFFF'], 5, 7));
  const pets = (o.pets || [['g1', 2], ['m1', 1], ['h2', 2], ['k1', 3], ['w1', 1], ['m3', 2]]).slice(0, lv === 1 ? 2 : 6);
  const pos = [[64, 486, 84], [334, 438, 70], [126, 530, 80], [270, 536, 92], [370, 530, 66], [32, 424, 60]];
  pets.forEach(([id, stg], i) => s.add(pet(id, stg, pos[i][0], pos[i][1], pos[i][2])));
  timeOverlay(s, time); particles(s, season, time, 260);
  return s.svg('plaza');
}
function cabinInterior(o = {}) {
  const time = o.time || 'day', night = time === 'night', s = new Scene(400, 420);
  s.add(R(0, 0, 400, 300, 0, s.ulin(0, 0, 0, 300, ['#F7D9AE', '#E8BC84']), { ns: 1 }));
  for (let x = 0; x < 400; x += 40) s.add(L(`M${x} 0V300`, '#C99560', 2, .45));
  s.add(R(-4, 10, 408, 16, 0, WOOD.c, { w: 3 }));
  const t = SKY[time];
  s.add(R(46, 72, 120, 104, 12, s.ulin(0, 72, 0, 176, t.sky), { w: 5 }), P('M46 150Q90 128 120 144Q146 130 166 140V176H46Z', SEASON[o.season || 'summer'].hill[1], { ns: 1 }));
  s.add(night ? `<circle cx="140" cy="100" r="10" fill="#FFF4C2"/>` : `<circle cx="140" cy="98" r="12" fill="${t.orb}"/>`, L('M106 72V176M46 124H166', '#fff', 5), R(46, 72, 120, 104, 12, 'none', { w: 5 }));
  s.add(P('M36 64Q60 120 40 184L30 184Q44 120 26 64Z', '#FF8FB1', { w: 2.6 }), P('M176 64Q152 120 172 184L182 184Q168 120 186 64Z', '#FF8FB1', { w: 2.6 }), R(24, 58, 166, 10, 5, WOOD.c, { w: 2.6 }));
  s.add(R(250, 92, 120, 10, 3, WOOD.c, { w: 2.6 }), R(250, 160, 120, 10, 3, WOOD.c, { w: 2.6 }));
  s.add(`<path d="${heartD(270, 72, 1.1)}" fill="#FF8FB1" stroke="${INK}" stroke-width="2"/>`, R(292, 62, 22, 30, 4, '#8CC4FF', { w: 2.4 }), R(320, 66, 18, 26, 4, '#FFD45C', { w: 2.4 }), bush(s, 352, 92, .5, 'summer', '#FF8FB1'));
  s.add(R(258, 128, 30, 32, 3, '#fff', { w: 2.4 }), pet('w1', 3, 273, 156, 30), R(300, 132, 22, 28, 4, '#B79CFF', { w: 2.2 }), E(344, 150, 16, 10, '#FFD45C', { w: 2.2 }));
  s.add(L('M210 26V56', INK, 2.4), P('M200 66L202 86H218L220 66Z', night ? '#FFE48A' : '#FFF4C8', { w: 2.4 }), P('M196 66L210 54L224 66Z', '#5B5470', { w: 2.2 }), R(202, 86, 16, 5, 2, '#5B5470', { w: 2 }));
  s.add(R(0, 296, 400, 124, 0, s.ulin(0, 296, 0, 420, ['#D9A06A', '#B97E4C']), { w: 3 }));
  for (let y = 318; y < 420; y += 26) s.add(L(`M0 ${y}H400`, '#9C6A44', 2, .45));
  s.add(E(200, 372, 130, 30, '#FFB59A', { w: 3 }), E(200, 372, 100, 22, '#FFD2C2', { ns: 1 }), E(200, 372, 70, 14, '#FFB59A', { ns: 1, op: .6 }));
  s.add(E(70, 352, 56, 22, s.ulin(0, 330, 0, 374, ['#E0A85E', '#B9803E']), { w: 3 }), E(70, 344, 46, 14, '#F7D27A', { w: 2.2 }), L('M36 340l10 -6M52 336l8 -8M80 336l10 -6M96 340l6 -6', '#D9A443', 2), P('M40 346Q70 330 100 346Q70 358 40 346Z', '#8CC4FF', { w: 2.2, op: .9 }));
  s.add(crate(s, 350, 340, 1, flowers(350, 312, .8, undefined, 3, 2)));
  s.add(pet(o.pet || 'k2', o.stage || 2, 200, 380, 150));
  if (night) s.add(R(-2, -2, 404, 424, 0, '#2A2060', { ns: 1, op: .32 }));
  s.light(`<circle cx="210" cy="70" r="70" fill="${s.glow('#FFE48A', night ? .55 : .25)}"/>`);
  return s.svg('cabin');
}
function market(o = {}) {
  const time = o.time || 'day', season = o.season || 'summer', night = time === 'night', s = new Scene(400, 420);
  sky(s, time, 220, { orbX: 70 });
  hills(s, season, 206, time);
  s.add(R(-2, 206, 404, 216, 0, s.ulin(0, 206, 0, 420, ['#F0DFC4', '#DCC5A2']), { ns: 1 }));
  const r = rng(5); for (let i = 0; i < 60; i++) s.add(E(r() * 400, 220 + r() * 200, 9 + r() * 6, 5 + r() * 2, '#E8D3B2', { ln: '#C9AF88', w: 1.2 }));
  s.add(pine(s, 24, 222, .7, season), tree(s, 380, 226, .55, season));
  s.add(bunting(-6, 120, 406, 120, 40, 15));
  s.add(stall(s, 124, 300, 1.05, '雜貨鋪', '#8CC4FF'));
  s.add(R(84, 238, 18, 18, 3, '#FFD45C', { w: 2 }), `<path d="${heartD(120, 248, .8)}" fill="#FF8FB1" stroke="${INK}" stroke-width="1.6"/>`, R(136, 240, 16, 16, 8, '#7FD68E', { w: 2 }), E(166, 248, 10, 7, '#B79CFF', { w: 2 }));
  s.add(stall(s, 300, 300, 1.05, '夾夾樂', '#FF8FB1'));
  s.add(clawMachine(s, 280, 296, .7, '#FF7AA2'), clawMachine(s, 322, 296, .7, '#8CC4FF'));
  s.add(crate(s, 210, 312, 1, R(198, 274, 24, 12, 6, '#FFD45C', { w: 1.8 })), crate(s, 380, 330, .9), balloons(210, 284, .9));
  s.add(lamp(s, 30, 330, .9, night), lamp(s, 372, 310, .8, night));
  s.add(pet('m1', 2, 300, 396, 96), pet('k1', 1, 120, 388, 82), pet('h3', 2, 208, 416, 76), pet('w2', 1, 48, 410, 64));
  timeOverlay(s, time); particles(s, season, time, 200);
  return s.svg('market');
}
const HAB = {
  guard: { title: '守護區・城牆瞭望塔', pets: [['g1', 2], ['g2', 1], ['g3', 3]] },
  mech: { title: '機械區・風車工坊', pets: [['m1', 1], ['m2', 2], ['m3', 3]] },
  harvest: { title: '豐收區・農田果園', pets: [['h1', 2], ['h2', 1], ['h3', 3]] },
  kind: { title: '親和區・花園雲朵草地', pets: [['k1', 2], ['k2', 3], ['k3', 1]] },
  wise: { title: '智慧區・觀星台水晶湖', pets: [['w1', 2], ['w2', 3], ['w3', 1]] },
};
function habitat(fam, o = {}) {
  const season = o.season || 'summer', time = fam === 'wise' ? 'dusk' : (o.time || 'day'), s = new Scene(360, 260);
  sky(s, time, 170, { orbX: 300 });
  hills(s, season, 150, time);
  ground(s, season, 150, 260);
  const h = HAB[fam];
  if (fam === 'guard') s.add(wall(s, -10, 370, 186, .9), tower(s, 70, 196, .8), banner(s, 250, 200, 1, '#5B8DEF'), banner(s, 300, 204, .9, '#FFD45C'), bush(s, 340, 230, .8, season));
  if (fam === 'mech') s.add(windmill(s, 300, 196, .8), workshop(s, 120, 190, .9), gearStatue(s, 220, 214, .7), crate(s, 40, 222, .9), crate(s, 58, 240, .8));
  if (fam === 'harvest') s.add(field(s, 150, 160, 190, 46, season, 'wheat'), tree(s, 50, 210, .7, season, 'fruit'), sunflower(s, 120, 214, .9), sunflower(s, 140, 222, .8), hay(s, 330, 238, .9));
  if (fam === 'kind') s.add(heartArch(s, 80, 210, .9), cloudBench(s, 260, 214, 1), balloons(316, 176, 1), flowers(160, 222, 1.1, ['#FF8FB1', '#FFFFFF', '#FFB7CF'], 7, 9), bush(s, 340, 236, .7, season, '#FFB7CF'));
  if (fam === 'wise') s.add(observatory(s, 280, 196, .9), pond(s, 110, 214, 70, 22, season, true), crystals(s, 70, 222, .8), crystals(s, 160, 226, .6), pine(s, 340, 214, .6, season));
  const pos = [[90, 262, 88], [196, 262, 96], [280, 264, 110]];
  h.pets.forEach(([id, stg], i) => s.add(pet(id, stg, pos[i][0], pos[i][1], pos[i][2])));
  timeOverlay(s, time); particles(s, season, time, 140);
  return s.svg('habitat');
}
function map(o = {}) {
  const season = o.season || 'summer', s = new Scene(1200, 780), S = SEASON[season];
  s.add(R(0, 0, 1200, 780, 0, s.ulin(0, 0, 0, 780, [S.hill[0], S.grass[0], S.grass[1]]), { ns: 1 }));
  const r = rng(3);
  for (let i = 0; i < 260; i++) { const x = r() * 1200, y = r() * 780; s.add(L(`M${f1(x)} ${f1(y)}l-3 -6M${f1(x)} ${f1(y)}l3 -7`, mix(S.grass[1], INK, .2), 1.6, .3)); }
  const P0 = [600, 430];
  [['M600 800Q600 600 600 450'], ['M600 430Q420 380 200 300'], ['M600 430Q520 280 400 200'], ['M600 430Q600 260 620 170'], ['M600 430Q720 300 860 220'], ['M600 430Q860 420 1050 360'], ['M600 430Q500 520 400 590'], ['M600 430Q720 520 840 610'], ['M600 430Q420 470 250 490'], ['M600 430Q820 470 1000 540']].forEach(([d]) => s.add(path(s, d, 30, season)));
  s.add(stage(s, 600, 456, 1.05, 3), pet('g4', 3, 600, 436, 150), bunting(470, 330, 730, 330, 44, 15));
  s.add(lamp(s, 500, 480, .8), lamp(s, 700, 480, .8), flowers(470, 500, 1.1, undefined, 7, 2), flowers(730, 500, 1.1, undefined, 7, 3));
  s.add(field(s, 70, 230, 210, 70, season, 'wheat'), barn(s, 110, 220, .8), tree(s, 300, 300, .6, season, 'fruit'), tree(s, 50, 360, .6, season, 'fruit'), hay(s, 240, 336, .8), sunflower(s, 280, 330, .8), pet('h1', 2, 180, 360, 60), pet('h3', 1, 330, 330, 50));
  s.add(heartArch(s, 360, 190, .75), cloudBench(s, 450, 200, .8), flowers(300, 200, 1, ['#FF8FB1', '#FFFFFF', '#FFB7CF'], 7, 5), balloons(480, 150, .8), pet('k1', 2, 410, 236, 58), pet('k3', 1, 300, 240, 48));
  s.add(observatory(s, 640, 150, .9), pond(s, 560, 180, 50, 16, season, true), crystals(s, 520, 186, .6), pet('w1', 2, 700, 200, 54), pet('w3', 1, 580, 230, 46));
  s.add(wall(s, 790, 960, 220, .7), tower(s, 900, 210, .75), banner(s, 820, 226, .8), banner(s, 960, 226, .8, '#FFD45C'), pet('g1', 2, 860, 262, 56), pet('g3', 1, 950, 266, 48));
  s.add(windmill(s, 1110, 330, .8), workshop(s, 1010, 330, .75), gearStatue(s, 1110, 400, .55), crate(s, 960, 350, .7), pet('m1', 2, 1050, 410, 58), pet('m2', 1, 980, 400, 46));
  s.add(stall(s, 360, 600, .8, '雜貨鋪', '#8CC4FF'), clawMachine(s, 450, 598, .7), pet('k2', 1, 410, 640, 48));
  [[790, 610, '#E0705C'], [870, 620, '#5B8DEF'], [830, 680, '#7FD68E'], [920, 690, '#B79CFF']].forEach(([x, y, c]) => s.add(cabin(s, x, y, .6, c)));
  s.add(fence(s, 740, 970, 712, .6), pet('h2', 1, 960, 640, 44));
  s.add(incubator(s, 230, 500, .9), pet('w2', 1, 290, 520, 44));
  s.add(honor(s, 1030, 560, .8, season));
  s.add(arch(s, 600, 778, .9), board(s, 712, 772, .8));
  [[30, 120], [80, 90], [140, 110], [1160, 120], [1120, 90], [1180, 500], [1160, 640], [30, 520], [60, 700], [180, 730], [1020, 760], [1120, 730], [260, 110], [960, 100], [1050, 140]].forEach(([x, y], i) => s.add(i % 2 ? pine(s, x, y, .8, season) : tree(s, x, y, .6, season)));
  s.add(label(170, 410, '豐收區', '農田果園'), label(370, 280, '親和區', '花園雲朵草地', '#F06A9B'), label(640, 250, '智慧區', '觀星台水晶湖', '#8C6CF0'), label(880, 300, '守護區', '城牆瞭望塔', '#5B8DEF'), label(1060, 450, '機械區', '風車工坊', '#F2963B'));
  s.add(label(600, 500, '中央廣場', '店寵・全店夥伴', '#FF7A59'), label(400, 676, '市集', '夾娃娃機・商店', '#FF7A59'), label(850, 740, '牧舍區', '每人的個人小屋', '#FF7A59'), label(230, 556, '孵蛋屋', '選蛋・孵化', '#FF7A59'), label(1030, 610, '名人堂花園', '畢業寵物', '#FF7A59'), label(712, 662, '佈告欄', '每日任務', '#FF7A59'));
  return s.svg('map');
}
function props(o = {}) {
  const season = o.season || 'summer', s = new Scene(1000, 560);
  s.add(R(0, 0, 1000, 560, 24, '#FFFDF8', { ns: 1 }));
  const items = [
    [100, 150, '牧舍', s2 => cabin(s2, 100, 150, 1.1, '#E0705C')], [260, 150, '紅穀倉', s2 => barn(s2, 260, 150, .9)], [420, 150, '風車', s2 => windmill(s2, 420, 150, .7)],
    [560, 150, '瞭望塔', s2 => tower(s2, 560, 150, .8)], [700, 150, '觀星台', s2 => observatory(s2, 700, 150, 1)], [860, 150, '工坊', s2 => workshop(s2, 860, 150, .9)],
    [100, 330, '佈告欄', s2 => board(s2, 100, 330, 1)], [240, 330, '孵蛋屋', s2 => incubator(s2, 240, 330, 1.1)], [390, 330, '雜貨攤', s2 => stall(s2, 390, 330, .9)],
    [530, 330, '夾娃娃機', s2 => clawMachine(s2, 530, 330, .9)], [680, 330, '守護台', s2 => stage(s2, 680, 330, .6, 3)], [850, 330, '入口拱門', s2 => arch(s2, 850, 330, .8)],
    [70, 500, '果樹', s2 => tree(s2, 70, 500, .7, season, 'fruit')], [170, 500, '松樹', s2 => pine(s2, 170, 500, 1, season)], [260, 500, '花叢', s2 => bush(s2, 260, 500, 1.1, season, '#FF8FB1')],
    [350, 500, '乾草捲', s2 => hay(s2, 350, 500, 1.2)], [440, 500, '路燈', s2 => lamp(s2, 440, 500, 1)], [530, 500, '向日葵', s2 => sunflower(s2, 530, 500, 1)],
    [620, 500, '水晶', s2 => crystals(s2, 620, 500, 1)], [710, 500, '雲朵長椅', s2 => cloudBench(s2, 710, 500, .9)], [810, 500, '齒輪像', s2 => gearStatue(s2, 810, 500, .8)], [920, 500, '名人堂樹', s2 => tree(s2, 920, 500, .7, season, 'gold')],
  ];
  items.forEach(([x, y, n, fn]) => { s.add(E(x, y + 2, 40, 7, INK, { ns: 1, op: .1 }), fn(s), T(x, y + 30, n, 15)); });
  return s.svg('props');
}

root.Ranch = { plaza, cabin: cabinInterior, market, habitat, map, props, HAB, SEASONS: Object.keys(SEASON), TIMES: Object.keys(SKY) };
})(typeof window !== 'undefined' ? window : globalThis);
