/* =====================================================================
   糰糰夥伴 角色美術庫
   20 種原創角色 × 3 進化階段（+ 5 顆系別蛋），全部以 SVG 向量繪製。
   用法：Creatures.draw(speciesId, stage[1|2|3], {shiny}) → SVG 字串
         Creatures.egg(familyId) → SVG 字串
   ===================================================================== */
(function (root) {
'use strict';

/* ---------- 色彩工具 ---------- */
const INK = '#2B1B3D';
const hex = c => { c = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const pal = c => ({ c, hi: mix(c, '#ffffff', .6), lt: mix(c, '#ffffff', .32), dk: mix(c, '#24123a', .2), ln: mix(c, INK, .74) });

const GOLD = pal('#FFC93C'), METAL = pal('#C5CEDA'), RED = pal('#FF6B6B'), WHITE = pal('#FFFFFF'),
      LEAF = pal('#5CC16E'), WOOD = pal('#B07A4C'), PINKC = pal('#FF8FB1'), CYAN = pal('#45D0FF');

/* ---------- SVG 組裝器 ---------- */
let SEQ = 0;
class Sprite {
  constructor() { this.id = 'cr' + (SEQ++).toString(36); this.defs = {}; this.back = []; this.l = []; }
  g(p) { const id = this.id + p.c.slice(1); if (!this.defs[id]) this.defs[id] = `<radialGradient id="${id}" cx=".36" cy=".28" r=".8"><stop offset="0" stop-color="${p.hi}"/><stop offset=".48" stop-color="${p.c}"/><stop offset="1" stop-color="${p.dk}"/></radialGradient>`; return `url(#${id})`; }
  lin(key, stops, v = true) { const id = this.id + 'l' + key; if (!this.defs[id]) this.defs[id] = `<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`; return `url(#${id})`; }
  glow(key, c, op = .55) { const id = this.id + 'w' + key; if (!this.defs[id]) this.defs[id] = `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${op}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; return `url(#${id})`; }
  add(...x) { this.l.push(...x); return this; }
  bg(...x) { this.back.push(...x); return this; }
  svg(o = {}) {
    const sh = o.shadow || 46, fl = o.float;
    return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" class="cr ${fl ? 'cr-float' : ''}"><defs>${Object.values(this.defs).join('')}</defs>${this.back.join('')}<ellipse cx="120" cy="${fl ? 222 : 214}" rx="${sh}" ry="${sh * .15}" fill="${INK}" opacity="${fl ? .08 : .15}"/><g class="cr-body">${this.l.join('')}</g></svg>`;
  }
}

/* ---------- 基本形狀 ---------- */
const sk = (p, o) => o.ns ? 'stroke="none"' : `stroke="${o.ln || p.ln}" stroke-width="${o.w || 4}" stroke-linejoin="round" stroke-linecap="round"`;
function E(s, p, cx, cy, rx, ry, o = {}) { return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${o.f || s.g(p)}" ${sk(p, o)}${o.r ? ` transform="rotate(${o.r} ${cx} ${cy})"` : ''}${o.op ? ` opacity="${o.op}"` : ''}/>`; }
function P(s, p, d, o = {}) { return `<path d="${d}" fill="${o.f === undefined ? s.g(p) : o.f}" ${sk(p, o)}${o.op ? ` opacity="${o.op}"` : ''}/>`; }
const line = (d, c = INK, w = 3, op = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const rot = (a, x, y, inner) => `<g transform="rotate(${a} ${x} ${y})">${inner}</g>`;
const mirror = inner => `<g transform="translate(240 0) scale(-1 1)">${inner}</g>`;
const both = inner => inner + mirror(inner);
function blob(cx, cy, rx, ry) {
  return `M${cx} ${cy - ry}C${cx + rx * .62} ${cy - ry} ${cx + rx} ${cy - ry * .42} ${cx + rx} ${cy + ry * .16}C${cx + rx} ${cy + ry * .78} ${cx + rx * .6} ${cy + ry} ${cx} ${cy + ry}C${cx - rx * .6} ${cy + ry} ${cx - rx} ${cy + ry * .78} ${cx - rx} ${cy + ry * .16}C${cx - rx} ${cy - ry * .42} ${cx - rx * .62} ${cy - ry} ${cx} ${cy - ry}Z`;
}
const star4 = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
function star5(x, y, R, r = R * .46) { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (x + q * Math.cos(a)).toFixed(1) + ' ' + (y + q * Math.sin(a)).toFixed(1); } return d + 'Z'; }
const heart = (x, y, k) => `M${x} ${y + 9 * k}C${x - 15 * k} ${y} ${x - 9 * k} ${y - 11 * k} ${x} ${y - 4 * k}C${x + 9 * k} ${y - 11 * k} ${x + 15 * k} ${y} ${x} ${y + 9 * k}Z`;
function gearD(cx, cy, r, n = 8) { let d = ''; const ri = r * .74; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n, q = i % 2 ? ri : r, w = Math.PI / n / 2.3; d += (i ? 'L' : 'M') + (cx + q * Math.cos(a - w)).toFixed(1) + ' ' + (cy + q * Math.sin(a - w)).toFixed(1) + 'L' + (cx + q * Math.cos(a + w)).toFixed(1) + ' ' + (cy + q * Math.sin(a + w)).toFixed(1); } return d + 'Z'; }
function cloudD(x, y, k) { return `M${x - 34 * k} ${y + 10 * k}Q${x - 46 * k} ${y + 10 * k} ${x - 44 * k} ${y - 2 * k}Q${x - 42 * k} ${y - 14 * k} ${x - 28 * k} ${y - 12 * k}Q${x - 26 * k} ${y - 28 * k} ${x - 8 * k} ${y - 26 * k}Q${x + 4 * k} ${y - 36 * k} ${x + 18 * k} ${y - 24 * k}Q${x + 34 * k} ${y - 26 * k} ${x + 34 * k} ${y - 10 * k}Q${x + 48 * k} ${y - 8 * k} ${x + 44 * k} ${y + 4 * k}Q${x + 42 * k} ${y + 12 * k} ${x + 32 * k} ${y + 10 * k}Z`; }

/* ---------- 臉 ---------- */
function face(s, cx, cy, k = 1, o = {}) {
  const eye = o.eye || '#6B4BC8', dx = (o.dx || 17) * k, rx = 7.8 * k, ry = (o.ry || 9.6) * k;
  const ig = s.lin('iris' + eye.slice(1), [INK, INK, eye]);
  let out = '';
  if (o.mask) out += o.mask;
  if (o.noEyes) { /* 只畫嘴 */ }
  else if (o.closed) {
    [-1, 1].forEach(g => { const x = cx + g * dx; out += line(`M${x - rx} ${cy}Q${x} ${cy + 7 * k} ${x + rx} ${cy}`, INK, 3.2 * k); });
  } else {
    [-1, 1].forEach(g => {
      const x = cx + g * dx;
      out += `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${ig}"/>`
        + `<circle cx="${x + 2.8 * k}" cy="${cy - 3.8 * k}" r="${3.4 * k}" fill="#fff"/><circle cx="${x - 2.6 * k}" cy="${cy + 3.8 * k}" r="${1.7 * k}" fill="#fff" opacity=".85"/>`;
      if (o.fierce) out += line(`M${x - g * (rx + 3 * k)} ${cy - ry - 1 * k}Q${x} ${cy - ry - 3 * k} ${x + g * (rx + 2 * k)} ${cy - ry + 4 * k}`, INK, 3.2 * k);
    });
  }
  if (!o.noBlush) [-1, 1].forEach(g => { out += `<ellipse cx="${cx + g * (dx + 9 * k)}" cy="${cy + 9 * k}" rx="${6.5 * k}" ry="${3.6 * k}" fill="#FF7FA0" opacity=".5"/>`; });
  const m = o.m || 'w', my = cy + (o.my || 10) * k;
  if (m === 'w') out += line(`M${cx - 7 * k} ${my - 1 * k}Q${cx - 3.5 * k} ${my + 5 * k} ${cx} ${my}Q${cx + 3.5 * k} ${my + 5 * k} ${cx + 7 * k} ${my - 1 * k}`, INK, 2.8 * k);
  else if (m === 'open' || m === 'fang') {
    out += `<path d="M${cx - 7 * k} ${my - 1 * k}Q${cx} ${my + 12 * k} ${cx + 7 * k} ${my - 1 * k}Z" fill="#7A2B47" stroke="${INK}" stroke-width="${2.4 * k}" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${my + 5 * k}" rx="${3.6 * k}" ry="${2.2 * k}" fill="#FF8FA3"/>`;
    if (m === 'fang') out += `<path d="M${cx - 4.5 * k} ${my}L${cx - 2.5 * k} ${my + 4 * k}L${cx - .5 * k} ${my}Z" fill="#fff"/><path d="M${cx + 4.5 * k} ${my}L${cx + 2.5 * k} ${my + 4 * k}L${cx + .5 * k} ${my}Z" fill="#fff"/>`;
  }
  else if (m === 'smile') out += line(`M${cx - 6 * k} ${my}Q${cx} ${my + 6 * k} ${cx + 6 * k} ${my}`, INK, 2.8 * k);
  else if (m === 'beak') out += `<path d="M${cx - 7 * k} ${my - 3 * k}Q${cx} ${my - 6 * k} ${cx + 7 * k} ${my - 3 * k}L${cx} ${my + 7 * k}Z" fill="${o.beak || '#FFB547'}" stroke="${INK}" stroke-width="${2.4 * k}" stroke-linejoin="round"/>`;
  else if (m === 'teeth') out += line(`M${cx - 7 * k} ${my - 1 * k}Q${cx - 3.5 * k} ${my + 5 * k} ${cx} ${my}Q${cx + 3.5 * k} ${my + 5 * k} ${cx + 7 * k} ${my - 1 * k}`, INK, 2.8 * k) + `<rect x="${cx - 3 * k}" y="${my + 1 * k}" width="${6 * k}" height="${5 * k}" rx="${1 * k}" fill="#fff" stroke="${INK}" stroke-width="${1.6 * k}"/>`;
  if (o.nose) out += `<ellipse cx="${cx}" cy="${cy + 5 * k}" rx="${3.4 * k}" ry="${2.4 * k}" fill="${INK}"/>`;
  return out;
}

/* ---------- 光環（完全體） ---------- */
function aura(s, c) {
  s.bg(`<circle cx="120" cy="124" r="112" fill="${s.glow('a', c, .5)}"/>`);
  [[30, 58, 9], [210, 48, 8], [218, 150, 6], [24, 158, 6], [184, 22, 5], [58, 22, 4]].forEach(([x, y, r]) => s.bg(`<path d="${star4(x, y, r)}" fill="${mix(c, '#ffffff', .35)}" class="cr-spark"/>`));
}

/* ---------- 身體模板 ---------- */
function baby(s, p, belly, o = {}) {
  const cy = o.cy || 166, rx = o.rx || 47, ry = o.ry || 42;
  if (!o.noFeet) s.add(E(s, p, 98, 205, 14, 8, { f: p.dk }), E(s, p, 142, 205, 14, 8, { f: p.dk }));
  if (o.arms) s.add(E(s, p, 76, cy + 12, 9, 13, { r: 35 }), E(s, p, 164, cy + 12, 9, 13, { r: -35 }));
  s.add(P(s, p, blob(120, cy, rx, ry)));
  if (belly) s.add(E(s, p, 120, cy + ry * .44, rx * .55, ry * .38, { f: belly, ns: 1, op: .92 }));
  return { x: 120, y: cy - 6 };
}
function kid(s, p, belly, o = {}) {
  s.add(E(s, p, 101, 203, 15, 9, { f: p.dk }), E(s, p, 139, 203, 15, 9, { f: p.dk }));
  if (!o.noArms) s.add(E(s, p, 86, 168, 9, 16, { r: 30 }), E(s, p, 154, 168, 9, 16, { r: -30 }));
  s.add(E(s, p, 120, 172, 33, 30));
  if (belly) s.add(E(s, p, 120, 179, 20, 18, { f: belly, ns: 1 }));
  if (o.before) s.add(o.before);
  s.add(P(s, p, blob(120, 116, o.hrx || 45, o.hry || 40)));
  return { x: 120, y: 118 };
}
function hero(s, p, belly, o = {}) {
  s.add(E(s, p, 93, 197, 20, 15, { f: p.dk }), E(s, p, 147, 197, 20, 15, { f: p.dk }));
  if (!o.noArms) s.add(E(s, p, 72, 148, 12, 25, { r: 24 }), E(s, p, 168, 148, 12, 25, { r: -24 }));
  s.add(E(s, p, 120, 154, 47, 46));
  if (belly) s.add(E(s, p, 120, 164, 29, 30, { f: belly, ns: 1 }));
  if (o.before) s.add(o.before);
  s.add(P(s, p, blob(120, 86, o.hrx || 43, o.hry || 37)));
  return { x: 120, y: 90 };
}
function sit2(s, p, belly, o = {}) {
  s.add(E(s, p, 86, 190, 23, 18), E(s, p, 154, 190, 23, 18));
  s.add(E(s, p, 120, 164, 34, 34));
  if (belly) s.add(E(s, p, 120, 172, 19, 22, { f: belly, ns: 1 }));
  s.add(E(s, p, 106, 192, 9, 17), E(s, p, 134, 192, 9, 17));
  s.add(E(s, p, 106, 206, 11, 6, { f: p.lt, w: 3 }), E(s, p, 134, 206, 11, 6, { f: p.lt, w: 3 }));
  if (o.before) s.add(o.before);
  s.add(P(s, p, blob(120, 112, o.hrx || 44, o.hry || 38)));
  return { x: 120, y: 116 };
}
function sit3(s, p, belly, o = {}) {
  s.add(E(s, p, 76, 184, 30, 26), E(s, p, 164, 184, 30, 26));
  s.add(E(s, p, 120, 150, 42, 48));
  if (belly) s.add(E(s, p, 120, 160, 24, 32, { f: belly, ns: 1 }));
  s.add(E(s, p, 102, 188, 11, 23), E(s, p, 138, 188, 11, 23));
  s.add(E(s, p, 102, 207, 13, 7, { f: p.lt, w: 3 }), E(s, p, 138, 207, 13, 7, { f: p.lt, w: 3 }));
  if (o.before) s.add(o.before);
  s.add(P(s, p, blob(120, 84, o.hrx || 42, o.hry || 36)));
  return { x: 120, y: 88 };
}

/* ---------- 道具零件 ---------- */
function lock(s, x, y, k = 1) {
  return line(`M${x - 5.5 * k} ${y - 4 * k}V${y - 9 * k}A${5.5 * k} ${5.5 * k} 0 0 1 ${x + 5.5 * k} ${y - 9 * k}V${y - 4 * k}`, METAL.ln, 3.4 * k)
    + P(s, GOLD, `M${x - 11 * k} ${y - 2 * k}Q${x - 11 * k} ${y - 5 * k} ${x - 8 * k} ${y - 5 * k}H${x + 8 * k}Q${x + 11 * k} ${y - 5 * k} ${x + 11 * k} ${y - 2 * k}V${y + 8 * k}Q${x + 11 * k} ${y + 11 * k} ${x + 8 * k} ${y + 11 * k}H${x - 8 * k}Q${x - 11 * k} ${y + 11 * k} ${x - 11 * k} ${y + 8 * k}Z`, { w: 2.6 * k })
    + `<circle cx="${x}" cy="${y + 2 * k}" r="${2.4 * k}" fill="${GOLD.ln}"/>` + line(`M${x} ${y + 3 * k}V${y + 7 * k}`, GOLD.ln, 2 * k);
}
function keyTail(s, x, y, k = 1) {
  return `<circle cx="${x}" cy="${y}" r="${11 * k}" fill="${s.g(GOLD)}" stroke="${GOLD.ln}" stroke-width="${3 * k}"/><circle cx="${x}" cy="${y}" r="${4.5 * k}" fill="#fff" stroke="${GOLD.ln}" stroke-width="${2 * k}"/>`;
}
function crystal(s, p, x, y, w, h, a = 0) {
  return rot(a, x, y, P(s, p, `M${x} ${y - h}L${x + w} ${y - h * .3}L${x + w * .55} ${y}L${x - w * .55} ${y}L${x - w} ${y - h * .3}Z`, { w: 3 })
    + line(`M${x} ${y - h}L${x - w * .2} ${y - h * .3}L${x - w * .55} ${y}`, '#fff', 2, .75) + line(`M${x - w} ${y - h * .3}H${x + w}`, p.ln, 1.6, .35));
}
function leafS(s, p, x, y, len, w, a) {
  return rot(a, x, y, P(s, p, `M${x} ${y}Q${x - w} ${y - len * .5} ${x} ${y - len}Q${x + w} ${y - len * .5} ${x} ${y}Z`, { w: 3 }) + line(`M${x} ${y - 3}L${x} ${y - len * .8}`, p.ln, 1.8, .55));
}
function note(x, y, k, c) {
  return `<g transform="rotate(-12 ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${6.5 * k}" ry="${5 * k}" fill="${c}" stroke="${INK}" stroke-width="${2.2 * k}"/>${line(`M${x + 6 * k} ${y}V${y - 22 * k}Q${x + 14 * k} ${y - 18 * k} ${x + 15 * k} ${y - 9 * k}`, INK, 2.6 * k)}</g>`;
}
function capsule(s, x, y, r, c) {
  const cp = pal(c);
  return `<g><path d="M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}Z" fill="${s.g(cp)}" stroke="${cp.ln}" stroke-width="2.6"/><path d="M${x - r} ${y}A${r} ${r} 0 0 0 ${x + r} ${y}Z" fill="#fff" stroke="${cp.ln}" stroke-width="2.6"/><ellipse cx="${x - r * .35}" cy="${y - r * .45}" rx="${r * .25}" ry="${r * .15}" fill="#fff" opacity=".7"/></g>`;
}
function bolt(x, y, k, c, a = 0) {
  return rot(a, x, y, `<path d="M${x + 2 * k} ${y - 14 * k}L${x - 7 * k} ${y + 2 * k}H${x}L${x - 3 * k} ${y + 14 * k}L${x + 8 * k} ${y - 3 * k}H${x + 1 * k}Z" fill="${c}" stroke="${INK}" stroke-width="${2.2 * k}" stroke-linejoin="round"/>`);
}
function claw(s, x, y, k = 1, a = 0) {
  const pr = d => line(d, METAL.ln, 6.5 * k) + line(d, METAL.c, 3 * k);
  return rot(a, x, y,
    pr(`M${x - 3 * k} ${y + 3 * k}Q${x - 15 * k} ${y + 12 * k} ${x - 10 * k} ${y + 26 * k}`) +
    pr(`M${x + 3 * k} ${y + 3 * k}Q${x + 15 * k} ${y + 12 * k} ${x + 10 * k} ${y + 26 * k}`) +
    pr(`M${x} ${y + 4 * k}L${x} ${y + 22 * k}`) +
    E(s, METAL, x, y, 8 * k, 6.5 * k, { w: 2.8 * k }) + `<circle cx="${x}" cy="${y}" r="${2.4 * k}" fill="${RED.c}"/>`);
}
function flower(x, y, r, c, center = '#FFE27A') {
  let out = ''; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; out += `<circle cx="${(x + r * Math.cos(a)).toFixed(1)}" cy="${(y + r * Math.sin(a)).toFixed(1)}" r="${r * .82}" fill="${c}" stroke="${mix(c, INK, .6)}" stroke-width="1.8"/>`; }
  return out + `<circle cx="${x}" cy="${y}" r="${r * .7}" fill="${center}" stroke="${mix(center, INK, .6)}" stroke-width="1.6"/>`;
}
function acorn(s, x, y, k = 1) {
  return E(s, pal('#D9A066'), x, y + 4 * k, 9 * k, 10 * k, { w: 2.6 * k }) + P(s, WOOD, `M${x - 11 * k} ${y + 1 * k}Q${x} ${y - 12 * k} ${x + 11 * k} ${y + 1 * k}Q${x} ${y + 4 * k} ${x - 11 * k} ${y + 1 * k}Z`, { w: 2.6 * k }) + line(`M${x} ${y - 6 * k}L${x + 2 * k} ${y - 11 * k}`, WOOD.ln, 2.6 * k);
}
function wheat(s, x1, y1, x2, y2, k = 1) {
  let out = line(`M${x1} ${y1}L${x2} ${y2}`, '#B88A2E', 3 * k);
  for (let i = 0; i < 4; i++) { const t = .35 + i * .18, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; out += E(s, GOLD, x - 5 * k, y, 4 * k, 7 * k, { w: 1.8 * k, r: -30 }) + E(s, GOLD, x + 5 * k, y, 4 * k, 7 * k, { w: 1.8 * k, r: 30 }); }
  return out + E(s, GOLD, x2, y2 - 3 * k, 4 * k, 7 * k, { w: 1.8 * k });
}
function mono(s, x, y, k, c) { return `<circle cx="${x}" cy="${y}" r="${12 * k}" fill="${s.glow('m' + c.slice(1), c, .9)}"/>`; }

function fWing(s, p, x, y, k, angs, tip) {
  const L = [52, 47, 41, 34, 28];
  return angs.map((a, i) => { const l = L[i] * k, r = a * Math.PI / 180, cx = x + l / 2 * Math.cos(r), cy = y + l / 2 * Math.sin(r);
    return E(s, p, cx.toFixed(1), cy.toFixed(1), l / 2, 9.5 * k, { r: a, w: 3 }) + (tip ? `<ellipse cx="${(x + l * .86 * Math.cos(r)).toFixed(1)}" cy="${(y + l * .86 * Math.sin(r)).toFixed(1)}" rx="${5 * k}" ry="${4 * k}" fill="${tip}" opacity=".9"/>` : ''); }).join('');
}

/* ---------- 系別 ---------- */
const FAMILIES = {
  guard:   { name: '守護系', icon: '🛡️', color: '#5B8DEF', desc: '開店、閉店、兌幣等安全類任務', motif: '鎖、盾、城堡、捲門' },
  mech:    { name: '機械系', icon: '⚙️', color: '#F2963B', desc: '機台清潔、夾力測試、故障回報', motif: '夾爪、齒輪、發條、電池' },
  harvest: { name: '豐收系', icon: '📦', color: '#36B368', desc: '補貨、陳列、庫存點檢', motif: '葉子、扭蛋、橡實、麥穗' },
  kind:    { name: '親和系', icon: '💖', color: '#F06A9B', desc: '協助顧客、會員推廣、環境巡視', motif: '棉花糖、緞帶、音符、愛心' },
  wise:    { name: '智慧系', icon: '📘', color: '#8C6CF0', desc: '每日一題、閱讀公告', motif: '書本、水晶、燈泡、星空' },
};
const RARITY = { starter: { name: '初始', color: '#36B368' }, common: { name: '普通', color: '#5B8DEF' }, rare: { name: '稀有', color: '#B05CF0' }, legend: { name: '傳說・店寵', color: '#F2A23B' } };

/* ---------- 20 種角色 ---------- */
const SPECIES = [];
function def(o) { SPECIES.push(o); }

/* ===== 守護系 ===== */
def({ id: 'g1', fam: 'guard', rare: 'starter', color: '#8EC5FF', names: ['鎖喵', '鎖衛喵', '金庫獅'],
  concept: '守著門市大門的小貓，從脖子上的鎖頭吊飾開始，最後長成鬃毛像金庫大門的獅子。', motif: '鎖頭 → 鎖頭尾巴 → 金庫門鬃毛',
  stages: ['脖子掛著小鎖頭的圓滾小貓，尾巴尖是一把小鑰匙。', '站起來巡邏，肩膀有金色護甲，胸前掛著大鎖頭。', '鬃毛變成金庫轉盤大門，尾巴是金鑰匙，守護整間店。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#EEF6FF';
    const ear = (x, y, h, a) => rot(a, x, y, P(s, p, `M${x - 13} ${y}Q${x - 6} ${y - h} ${x} ${y - h}Q${x + 6} ${y - h} ${x + 13} ${y}Z`) + P(s, PINKC, `M${x - 6} ${y - 4}Q${x - 2} ${y - h * .65} ${x} ${y - h * .65}Q${x + 2} ${y - h * .65} ${x + 6} ${y - 4}Z`, { ns: 1, f: '#FFC2D4' }));
    if (st === 1) {
      s.add(line('M150 192Q186 196 182 160Q180 146 170 148', p.ln, 13), line('M150 192Q186 196 182 160Q180 146 170 148', p.c, 7), keyTail(s, 170, 144, .7));
      s.add(ear(92, 136, 34, -14), ear(148, 136, 34, 14));
      const f = baby(s, p, belly, { arms: true });
      s.add(P(s, RED, 'M80 186Q120 204 160 186L158 196Q120 214 82 196Z', { w: 3 }), lock(s, 120, 206, .75));
      s.add(face(s, f.x, f.y - 6, 1, { eye: '#3C7BD9', m: 'w' }));
    } else if (st === 2) {
      s.add(line('M150 196Q196 192 190 140Q188 120 174 118', p.ln, 15), line('M150 196Q196 192 190 140Q188 120 174 118', p.c, 8), lock(s, 172, 112, .9));
      s.add(ear(88, 94, 40, -16), ear(152, 94, 40, 16));
      const f = kid(s, p, belly);
      s.add(both(P(s, GOLD, 'M72 154Q80 140 96 146Q98 160 86 168Q74 166 72 154Z', { w: 3 })));
      s.add(P(s, RED, 'M90 150Q120 162 150 150L148 158Q120 170 92 158Z', { w: 3 }), lock(s, 120, 172, 1));
      s.add(face(s, f.x, f.y, .95, { eye: '#3C7BD9', m: 'smile' }));
    } else {
      aura(s, '#FFD45C');
      s.add(line('M170 200Q222 196 214 150Q210 128 196 122', p.ln, 17), line('M170 200Q222 196 214 150Q210 128 196 122', p.c, 9));
      s.add(line('M196 122L196 96', GOLD.ln, 7), line('M196 122L196 96', GOLD.c, 3.5), line('M196 104h8M196 112h6', GOLD.ln, 3.5), keyTail(s, 196, 130, 1));
      s.add(`<circle cx="120" cy="86" r="66" fill="${s.g(GOLD)}" stroke="${GOLD.ln}" stroke-width="4"/>`);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.add(`<circle cx="${(120 + 58 * Math.cos(a)).toFixed(1)}" cy="${(86 + 58 * Math.sin(a)).toFixed(1)}" r="4" fill="${GOLD.hi}" stroke="${GOLD.ln}" stroke-width="2"/>`); }
      s.add(`<circle cx="120" cy="86" r="50" fill="none" stroke="${GOLD.ln}" stroke-width="3" opacity=".5"/>`);
      const f = sit3(s, p, belly, { hrx: 40, hry: 35 });
      s.add(both(E(s, p, 88, 56, 10, 10)));
      s.add(P(s, GOLD, 'M98 126H142L138 150Q120 162 102 150Z', { w: 3 }), lock(s, 120, 138, .9));
      s.add(face(s, f.x, f.y + 2, .9, { eye: '#2E63C2', m: 'fang', fierce: true, nose: true }));
    }
  } });

def({ id: 'g2', fam: 'guard', rare: 'common', color: '#9DB2DD', names: ['圓盾鼠', '鎧盾鼠', '城壘獸'],
  concept: '背著圓盾的倉鼠，越長越大後，背上的盾變成一座小城堡。', motif: '圓盾背殼 → 鎧甲 → 城牆',
  stages: ['背上頂著小圓盾，雙頰鼓鼓的倉鼠。', '盾殼長出三層鎧甲，手上拿著星星小盾牌。', '背殼化為城牆與塔樓，城頭插著門市旗。'],
  draw(s, st) {
    const p = pal(this.color), sh = pal('#5D80CC'), belly = '#F7F1E6';
    const ears = (y, r) => both(E(s, p, 120 - 34, y, r, r) + E(s, PINKC, 120 - 34, y, r * .55, r * .55, { ns: 1, f: '#FFC2D4' }));
    if (st === 1) {
      s.add(P(s, sh, 'M66 170Q66 112 120 112Q174 112 174 170Z'), line('M74 150Q120 130 166 150', sh.ln, 3, .5));
      s.add(ears(130, 13));
      const f = baby(s, p, belly, { arms: true });
      s.add(face(s, f.x, f.y - 2, 1, { eye: '#4C66A8', m: 'teeth' }));
    } else if (st === 2) {
      s.add(P(s, sh, 'M60 182Q56 98 120 96Q184 98 180 182Z'), line('M66 156Q120 132 174 156', sh.ln, 3, .5), line('M64 130Q120 106 176 130', sh.ln, 3, .5));
      s.add(ears(84, 14));
      const f = kid(s, p, belly, { hrx: 44, hry: 38 });
      s.add(`<circle cx="164" cy="176" r="17" fill="${s.g(GOLD)}" stroke="${GOLD.ln}" stroke-width="3.5"/><path d="${star5(164, 176, 9)}" fill="#fff" stroke="${GOLD.ln}" stroke-width="2"/>`);
      s.add(face(s, f.x, f.y, .95, { eye: '#4C66A8', m: 'teeth' }));
    } else {
      aura(s, '#8FB4FF');
      const wall = pal('#7E98D4');
      s.add(P(s, wall, 'M30 196V96H44V82H58V96H74V82H88V96H104V82H136V96H152V82H166V96H182V82H196V96H210V196Z'));
      s.add(line('M30 120H210M30 146H210M30 172H210', wall.ln, 2.4, .35), line('M60 96V120M100 120V146M140 96V120M180 120V146M80 146V172M160 146V172', wall.ln, 2.4, .35));
      s.add(P(s, wall, 'M96 82V40H144V82Z'), P(s, RED, 'M90 42L120 14L150 42Z', { w: 3.5 }), `<rect x="113" y="54" width="14" height="18" rx="7" fill="${INK}" opacity=".7"/>`);
      s.add(line('M120 14V-2', INK, 3), P(s, RED, 'M120 -2L140 4L120 10Z', { w: 2 }));
      s.add(both(E(s, p, 82, 72, 13, 13)));
      const f = hero(s, p, belly);
      s.add(face(s, f.x, f.y + 2, .9, { eye: '#3F5BA3', m: 'teeth', fierce: true }));
    }
  } });

def({ id: 'g3', fam: 'guard', rare: 'rare', color: '#3F5DAA', names: ['巡巡', '巡警企鵝', '極光衛士'],
  concept: '每晚在店內巡邏的企鵝，戴著巡邏帽，手電筒照亮每個角落；最強型態披著極光斗篷。', motif: '巡邏帽 → 手電筒 → 極光斗篷',
  stages: ['戴著小小巡邏帽的企鵝寶寶，走路搖搖擺擺。', '拿著手電筒巡店，帽子上有金星徽章。', '披著流動的極光斗篷，頭上有三根金色冠羽。'],
  draw(s, st) {
    const p = pal(this.color), white = '#FFFFFF', feet = pal('#FFB547');
    const cap = (x, y, k) => P(s, pal('#2B3E7A'), `M${x - 30 * k} ${y}Q${x - 28 * k} ${y - 26 * k} ${x} ${y - 28 * k}Q${x + 28 * k} ${y - 26 * k} ${x + 30 * k} ${y}Z`, { w: 3.5 * k }) + P(s, pal('#2B3E7A'), `M${x - 34 * k} ${y}H${x + 38 * k}Q${x + 40 * k} ${y + 6 * k} ${x + 30 * k} ${y + 7 * k}H${x - 32 * k}Q${x - 38 * k} ${y + 5 * k} ${x - 34 * k} ${y}Z`, { w: 3 * k }) + `<path d="${star5(x, y - 13 * k, 7 * k)}" fill="${GOLD.c}" stroke="${GOLD.ln}" stroke-width="${2 * k}"/>`;
    if (st === 1) {
      s.add(E(s, feet, 100, 206, 14, 7, { w: 3 }), E(s, feet, 140, 206, 14, 7, { w: 3 }));
      s.add(E(s, p, 74, 176, 9, 18, { r: 30 }), E(s, p, 166, 176, 9, 18, { r: -30 }));
      s.add(P(s, p, blob(120, 164, 46, 44)), P(s, WHITE, 'M120 140Q90 130 86 158Q84 194 120 200Q156 194 154 158Q150 130 120 140Z', { ns: 1, f: white }));
      s.add(cap(120, 132, .85), face(s, 120, 158, 1, { eye: '#3B5EB0', m: 'beak' }));
    } else if (st === 2) {
      s.add(E(s, feet, 100, 207, 16, 7, { w: 3 }), E(s, feet, 140, 207, 16, 7, { w: 3 }));
      s.add(`<path d="M168 162L226 128L232 176Z" fill="${s.glow('b', '#FFF3A0', .8)}"/>`);
      s.add(E(s, p, 70, 160, 10, 26, { r: 22 }), E(s, p, 168, 160, 10, 24, { r: -60 }));
      s.add(P(s, p, blob(120, 146, 50, 62)), P(s, WHITE, 'M120 112Q84 104 82 140Q80 196 120 202Q160 196 158 140Q156 104 120 112Z', { ns: 1, f: white }));
      s.add(`<rect x="166" y="150" width="22" height="12" rx="4" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3" transform="rotate(-30 177 156)"/>`);
      s.add(cap(120, 98, 1), face(s, 120, 128, .95, { eye: '#3B5EB0', m: 'beak' }));
    } else {
      aura(s, '#7FE3D4');
      s.add(P(s, pal('#7FE3D4'), 'M70 70Q20 120 34 204Q80 190 120 206Q160 190 206 204Q220 120 170 70Z', { f: s.lin('aur', ['#8FF0D8', '#8CB8FF', '#D49CFF', '#FF9EC9']), ln: '#5A5A9A', w: 3.5 }));
      s.add(E(s, feet, 98, 208, 18, 7, { w: 3 }), E(s, feet, 142, 208, 18, 7, { w: 3 }));
      s.add(P(s, p, blob(120, 132, 58, 78)), P(s, WHITE, 'M120 98Q78 90 76 130Q74 196 120 204Q166 196 164 130Q162 90 120 98Z', { ns: 1, f: white }));
      s.add(both(P(s, GOLD, 'M60 116Q54 160 72 182Q86 160 82 120Z', { w: 3 })));
      s.add(P(s, GOLD, 'M104 60Q100 30 110 22Q112 44 116 56Z', { w: 3 }), P(s, GOLD, 'M120 58Q118 22 126 12Q130 36 126 58Z', { w: 3 }), P(s, GOLD, 'M136 60Q140 32 150 26Q146 46 140 62Z', { w: 3 }));
      s.add(face(s, 120, 112, .92, { eye: '#2E4EA0', m: 'beak', fierce: true }));
    }
  } });

def({ id: 'g4', fam: 'guard', rare: 'legend', color: '#B6C6E6', names: ['捲捲', '鐵捲蛟', '門神龍'],
  concept: '傳說中守護門市的神龍，身上的鱗片像鐵捲門一片片捲起。只會出現在全店一起養育的「店寵」。', motif: '捲門鱗片 → 長身蛟龍 → 金鬃門神',
  stages: ['捲成一團的小龍，身上有一條條捲門紋路。', '舒展成 S 形的蛟龍，頭上長出金色小角。', '盤踞守門的神龍，金色鬍鬚與龍角，手握守護寶珠。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF5DD';
    const seg = (x, y, r) => E(s, p, x, y, r, r * .86) + line(`M${x - r * .7} ${y - r * .2}H${x + r * .7}M${x - r * .75} ${y + r * .2}H${x + r * .75}`, p.ln, 2, .35);
    const horn = (x, y, h, a) => rot(a, x, y, P(s, GOLD, `M${x - 5} ${y}Q${x - 2} ${y - h} ${x + 4} ${y - h - 4}Q${x + 2} ${y - h * .4} ${x + 6} ${y}Z`, { w: 3 }));
    if (st === 1) {
      s.add(seg(160, 196, 18), seg(170, 176, 14), E(s, p, 178, 160, 9, 8));
      const f = baby(s, p, belly, { noFeet: false });
      s.add(line('M78 150H162M76 170H164', p.ln, 2.2, .3), horn(96, 128, 14, -18), horn(144, 128, 14, 18));
      s.add(line('M74 166Q58 160 52 168', GOLD.ln, 3), line('M166 166Q182 160 188 168', GOLD.ln, 3));
      s.add(face(s, f.x, f.y - 2, 1, { eye: '#C9A227', m: 'w' }));
    } else if (st === 2) {
      [[176, 204, 13], [190, 186, 15], [190, 162, 17], [172, 146, 18], [148, 150, 20], [128, 166, 22], [110, 178, 22]].forEach(a => s.add(seg(...a)));
      s.add(P(s, p, 'M196 212Q214 214 220 200Q206 202 196 212Z'));
      s.add(E(s, p, 96, 162, 10, 7), E(s, p, 124, 188, 10, 7));
      s.add(horn(98, 76, 26, -22), horn(142, 76, 26, 22));
      s.add(P(s, p, blob(120, 112, 42, 38)), E(s, p, 120, 128, 22, 13, { f: belly, ns: 1 }));
      s.add(line('M80 120Q58 112 46 124', GOLD.ln, 3.5), line('M160 120Q182 112 194 124', GOLD.ln, 3.5));
      s.add(face(s, 120, 110, .95, { eye: '#C9A227', m: 'smile' }));
    } else {
      aura(s, '#FFE08A');
      [[60, 196, 26], [92, 206, 24], [128, 206, 26], [164, 198, 28], [192, 180, 26], [200, 152, 24], [186, 128, 22], [166, 116, 22], [146, 122, 24], [130, 140, 28]].forEach(a => s.add(seg(...a)));
      s.add(P(s, p, 'M40 200Q16 196 14 176Q30 186 40 184Z'));
      s.add(horn(92, 46, 34, -26), horn(148, 46, 34, 26), horn(84, 54, 22, -60), horn(156, 54, 22, 60));
      s.add(P(s, GOLD, 'M78 92Q60 120 74 146Q84 126 96 120Q108 140 120 146Q132 140 144 120Q156 126 166 146Q180 120 162 92Z', { w: 3.5 }));
      s.add(P(s, p, blob(120, 82, 46, 40)), E(s, p, 120, 100, 24, 14, { f: belly, ns: 1 }));
      s.add(line('M76 92Q46 82 30 98Q22 106 30 114', GOLD.ln, 4), line('M164 92Q194 82 210 98Q218 106 210 114', GOLD.ln, 4));
      s.add(mono(s, 120, 168, 1.6, '#FFF3B0'), `<circle cx="120" cy="168" r="13" fill="${s.g(pal('#9FE6FF'))}" stroke="${pal('#9FE6FF').ln}" stroke-width="3"/>`, E(s, p, 104, 170, 10, 8), E(s, p, 136, 170, 10, 8));
      s.add(face(s, 120, 80, .92, { eye: '#B38A12', m: 'fang', fierce: true }));
    }
  } });

/* ===== 機械系 ===== */
def({ id: 'm1', fam: 'mech', rare: 'starter', color: '#FF8C4F', names: ['小夾蟹', '夾爪蟹', '天爪機甲蟹'],
  concept: '雙鉗是娃娃機夾爪的螃蟹，最愛幫大家把獎品夾出來。最終型態背上扛著一整座天車。', motif: '夾爪鉗子 → 大夾爪 → 天車機甲',
  stages: ['兩隻小夾爪舉高高，橫著走的螃蟹寶寶。', '夾爪變大可以夾起娃娃，眼睛長在可愛的眼柄上。', '全身機甲，背上有天車軌道與吊掛夾爪，殼邊是跑馬燈。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFE6CF';
    const legs = (y, n, sp) => { let o = ''; for (let i = 0; i < n; i++) o += E(s, p, 120 - sp - i * 12, y + i * 3, 6, 11, { r: 40 + i * 10 }); return both(o); };
    if (st === 1) {
      s.add(legs(196, 2, 30));
      s.add(both(line('M78 168Q60 160 58 140', p.ln, 11) + line('M78 168Q60 160 58 140', p.c, 5)), claw(s, 58, 124, .8), claw(s, 182, 124, .8));
      const f = baby(s, p, belly, { rx: 52, ry: 38, cy: 172, noFeet: true });
      s.add(both(line('M104 136L98 120', p.ln, 4) + `<circle cx="98" cy="118" r="5" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="3"/>`));
      s.add(face(s, f.x, f.y, 1, { eye: '#D9541E', m: 'w' }));
    } else if (st === 2) {
      s.add(legs(198, 3, 36));
      s.add(both(line('M76 164Q50 150 44 116', p.ln, 14) + line('M76 164Q50 150 44 116', p.c, 7)), claw(s, 44, 96, 1.15), claw(s, 196, 96, 1.15));
      s.add(both(line('M100 140L94 104', p.ln, 10) + line('M100 140L94 104', p.c, 4)));
      s.add(P(s, p, blob(120, 166, 64, 40)), E(s, p, 120, 182, 36, 16, { f: belly, ns: 1 }));
      s.add(both(`<circle cx="94" cy="98" r="15" fill="#fff" stroke="${p.ln}" stroke-width="3.5"/>`));
      s.add(face(s, 120, 102, 1.1, { dx: 23, eye: '#D9541E', noBlush: true, m: 'none' }), face(s, 120, 160, 1, { m: 'open', noEyes: true }));
    } else {
      aura(s, '#FFB36B');
      s.add(line('M48 40H192', METAL.ln, 9), line('M48 40H192', METAL.c, 5), `<rect x="108" y="32" width="24" height="16" rx="4" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/>`, line('M120 48V62', METAL.ln, 3));
      s.add(both(line('M48 40V120', METAL.ln, 7) + line('M48 40V120', METAL.c, 3)));
      s.add(claw(s, 120, 62, .8));
      s.add(legs(200, 3, 44));
      s.add(both(line('M66 160Q34 146 30 108', p.ln, 16) + line('M66 160Q34 146 30 108', p.c, 8)), claw(s, 30, 86, 1.35), claw(s, 210, 86, 1.35));
      s.add(P(s, p, blob(120, 158, 74, 50)), E(s, p, 120, 178, 42, 18, { f: belly, ns: 1 }));
      s.add(P(s, METAL, 'M62 136Q120 92 178 136Q120 120 62 136Z', { w: 3 }), P(s, pal('#7FD8FF'), 'M84 126Q120 106 156 126Q120 120 84 126Z', { w: 2.4 }));
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * .1); s.add(`<circle cx="${(120 + 70 * Math.cos(a)).toFixed(1)}" cy="${(160 + 44 * Math.sin(a)).toFixed(1)}" r="3.6" fill="${['#FFF27A', '#FF6B9A', '#7FE3FF'][i % 3]}" stroke="${INK}" stroke-width="1.4" class="cr-blink"/>`); }
      s.add(face(s, 120, 152, 1, { eye: '#C2410C', m: 'fang', fierce: true }));
    }
  } });

def({ id: 'm2', fam: 'mech', rare: 'common', color: '#F3C24F', names: ['發條鼠', '齒輪鼬', '蒸汽貂'],
  concept: '背上有發條的小老鼠，轉一轉就充滿幹勁；長大後全身齒輪運轉、冒出蒸汽。', motif: '發條鑰匙 → 齒輪耳朵 → 蒸汽管',
  stages: ['背上插著發條鑰匙，尾巴尖有一顆小齒輪。', '耳朵變成齒輪，身形修長的鼬，胸口齒輪轉不停。', '戴著護目鏡、背著蒸汽管的工程師貂，尾巴蓬鬆捲起。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF6DC', br = pal('#A8743F');
    const wind = (x, y, k) => line(`M${x} ${y}L${x + 18 * k} ${y - 18 * k}`, METAL.ln, 6 * k) + line(`M${x} ${y}L${x + 18 * k} ${y - 18 * k}`, METAL.c, 3 * k) + E(s, METAL, x + 18 * k, y - 30 * k, 6 * k, 10 * k, { w: 3 * k, r: 45 }) + E(s, METAL, x + 30 * k, y - 18 * k, 6 * k, 10 * k, { w: 3 * k, r: 45 });
    if (st === 1) {
      s.add(line('M156 196Q196 200 194 172Q192 156 178 160', br.ln, 6), `<path d="${gearD(178, 156, 10, 7)}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="2.6"/>`);
      s.add(wind(150, 138, 1));
      s.add(both(E(s, p, 84, 128, 16, 16) + E(s, PINKC, 84, 128, 9, 9, { ns: 1, f: '#FFC9A8' })));
      const f = baby(s, p, belly, { arms: true });
      s.add(face(s, f.x, f.y - 2, 1, { eye: '#9A5B12', m: 'w', nose: true }));
    } else if (st === 2) {
      s.add(line('M150 196Q214 196 206 140Q202 118 184 120', br.ln, 12), line('M150 196Q214 196 206 140Q202 118 184 120', br.c, 6), `<path d="${gearD(184, 116, 13, 8)}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="2.6"/>`);
      s.add(wind(150, 134, 1.2));
      s.add(both(`<path d="${gearD(84, 80, 17, 8)}" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="3"/><circle cx="84" cy="80" r="6" fill="${p.hi}" stroke="${p.ln}" stroke-width="2.4"/>`));
      const f = kid(s, p, belly, { hrx: 42, hry: 38 });
      s.add(`<path d="${gearD(120, 178, 13, 8)}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="2.6" class="cr-spin"/><circle cx="120" cy="178" r="4" fill="${METAL.ln}"/>`);
      s.add(face(s, f.x, f.y, .95, { eye: '#9A5B12', m: 'smile', nose: true }));
    } else {
      aura(s, '#FFD27A');
      s.add(line('M160 196Q236 196 224 128Q218 96 192 104', br.ln, 22), line('M160 196Q236 196 224 128Q218 96 192 104', br.c, 14), line('M206 120Q220 140 214 170', br.hi, 4, .6));
      s.add(both(`<rect x="62" y="70" width="14" height="70" rx="6" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/>` + `<path d="${cloudD(70, 52, .45)}" fill="#fff" stroke="#C9C9D9" stroke-width="2.4" class="cr-steam"/>`));
      s.add(both(`<path d="${gearD(84, 58, 16, 8)}" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="3"/>`));
      const f = hero(s, p, belly);
      s.add(both(`<path d="${gearD(72, 130, 14, 8)}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="2.6"/>`));
      s.add(line('M78 72Q120 56 162 72', br.ln, 7), both(`<circle cx="100" cy="66" r="12" fill="${s.g(pal('#8FDCFF'))}" stroke="${br.ln}" stroke-width="4"/>`));
      s.add(face(s, f.x, f.y + 4, .9, { eye: '#8A4E0E', m: 'open', fierce: true, nose: true }));
    }
  } });

def({ id: 'm3', fam: 'mech', rare: 'rare', color: '#FFAF45', names: ['電電', '充電犬', '雷霆犬'],
  concept: '尾巴是插頭的小狗，身上的電量格會隨心情亮起。充飽電時全身會冒出閃電鬃毛。', motif: '插頭尾巴 → 電量格 → 閃電鬃毛',
  stages: ['額頭有電池圖案的小狗，尾巴是一個插頭。', '坐姿精神抖擻，身側電量格亮起三格，項圈有閃電吊牌。', '脖子長出藍色閃電鬃毛，尾巴插頭發光，渾身帶電。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF3DE';
    const plug = (x, y, k, a) => rot(a, x, y, `<rect x="${x - 9 * k}" y="${y - 7 * k}" width="${18 * k}" height="${14 * k}" rx="${4 * k}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="${2.8 * k}"/>` + line(`M${x - 4 * k} ${y - 7 * k}V${y - 15 * k}M${x + 4 * k} ${y - 7 * k}V${y - 15 * k}`, METAL.ln, 3.4 * k));
    const ears = (y, h, a) => both(rot(a, 90, y, P(s, p, `M80 ${y}Q78 ${y - h} 92 ${y - h}Q104 ${y - h * .6} 104 ${y}Z`)));
    const batt = (x, y, k, n) => `<rect x="${x - 12 * k}" y="${y - 6 * k}" width="${24 * k}" height="${12 * k}" rx="${3 * k}" fill="#fff" stroke="${INK}" stroke-width="${2 * k}"/><rect x="${x + 12 * k}" y="${y - 3 * k}" width="${3 * k}" height="${6 * k}" fill="${INK}"/>` + [0, 1, 2].map(i => i < n ? `<rect x="${x - 9.5 * k + i * 7 * k}" y="${y - 3.5 * k}" width="${5.5 * k}" height="${7 * k}" rx="${1 * k}" fill="${CYAN.c}"/>` : '').join('');
    if (st === 1) {
      s.add(line('M158 192Q184 192 186 170', p.ln, 9), line('M158 192Q184 192 186 170', p.c, 4), plug(186, 160, .9, 0));
      s.add(both(E(s, p, 80, 150, 12, 24, { r: 20 })));
      const f = baby(s, p, belly, { arms: true });
      s.add(batt(120, 136, .9, 2), face(s, f.x, f.y + 2, 1, { eye: '#B8650E', m: 'open', nose: true }));
    } else if (st === 2) {
      s.add(line('M150 196Q200 200 200 160Q200 138 184 136', p.ln, 10), line('M150 196Q200 200 200 160Q200 138 184 136', p.c, 4), plug(184, 128, 1.1, -30));
      s.add(ears(90, 40, -10));
      const f = sit2(s, p, belly);
      s.add(P(s, RED, 'M88 144Q120 158 152 144L150 152Q120 166 90 152Z', { w: 3 }), bolt(120, 166, .7, '#FFE45C'));
      s.add(batt(86, 172, .8, 3));
      s.add(face(s, f.x, f.y, .95, { eye: '#B8650E', m: 'open', nose: true }));
    } else {
      aura(s, '#7FE0FF');
      s.add(line('M164 196Q226 196 222 140Q220 112 200 108', p.ln, 12), line('M164 196Q226 196 222 140Q220 112 200 108', p.c, 5), mono(s, 200, 96, 1.5, '#9FF0FF'), plug(200, 98, 1.3, -20));
      for (let i = 0; i < 7; i++) { const a = Math.PI * (.95 + i * .185); s.add(bolt(120 + 60 * Math.cos(a), 104 + 50 * Math.sin(a), 1.4, '#7FE6FF', a * 180 / Math.PI + 90)); }
      s.add(ears(62, 44, -16));
      const f = sit3(s, p, belly);
      s.add(batt(120, 140, 1, 3), bolt(60, 150, .9, '#FFE45C', -20), bolt(184, 52, .8, '#FFE45C', 20));
      s.add(face(s, f.x, f.y + 2, .9, { eye: '#A55508', m: 'fang', fierce: true, nose: true }));
    }
  } });

def({ id: 'm4', fam: 'mech', rare: 'legend', color: '#FF7A5C', names: ['機寶', '機台衛', '大夾神'],
  concept: '傳說中的娃娃機之神，頭頂玻璃罩裡裝著夾爪和獎品。只會出現在全店共養的「店寵」。', motif: '玻璃罩頭 → 跑馬燈機身 → 巨大機台神',
  stages: ['頭是小玻璃罩、裡面有迷你夾爪的機器人寶寶。', '機身有跑馬燈，雙手是夾爪，玻璃罩裡的獎品越來越多。', '胸口是一整台娃娃機，皇冠燈閃爍，雙臂天車夾爪。'],
  draw(s, st) {
    const p = pal(this.color);
    const dome = (x, y, r, n) => {
      let o = `<path d="M${x - r} ${y}A${r} ${r * .95} 0 0 1 ${x + r} ${y}Z" fill="${s.lin('gl', ['#F2FBFF', '#C6E8FF'])}" stroke="${METAL.ln}" stroke-width="3.5" opacity=".95"/>`;
      const cols = ['#FF8FB1', '#FFD45C', '#7FD68E', '#8CC4FF', '#B79CFF'];
      for (let i = 0; i < n; i++) o += `<circle cx="${x - r * .55 + i * (r * 1.1 / Math.max(1, n - 1))}" cy="${y - 6}" r="${r * .17}" fill="${cols[i % 5]}" stroke="${INK}" stroke-width="1.6"/>`;
      o += line(`M${x} ${y - r * .95}V${y - r * .5}`, METAL.ln, 2) + claw(s, x, y - r * .5, r / 70);
      return o + `<path d="M${x - r * .7} ${y - r * .5}Q${x - r * .5} ${y - r * .85} ${x - r * .1} ${y - r * .9}" stroke="#fff" stroke-width="4" fill="none" opacity=".8" stroke-linecap="round"/>`;
    };
    const lights = (x1, x2, y) => { let o = ''; for (let x = x1, i = 0; x <= x2; x += 11, i++) o += `<circle cx="${x}" cy="${y}" r="3.4" fill="${['#FFF27A', '#7FE3FF', '#FF9EC4'][i % 3]}" stroke="${INK}" stroke-width="1.3" class="cr-blink" style="animation-delay:${i * .15}s"/>`; return o; };
    if (st === 1) {
      s.add(E(s, METAL, 100, 206, 13, 7), E(s, METAL, 140, 206, 13, 7), both(E(s, METAL, 74, 170, 8, 14, { r: 30 })));
      s.add(`<rect x="76" y="140" width="88" height="66" rx="20" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="4"/>`, `<rect x="88" y="150" width="64" height="36" rx="12" fill="#2E2445" stroke="${p.ln}" stroke-width="3"/>`);
      s.add(face(s, 120, 166, .8, { eye: '#7FE3FF', m: 'w', noBlush: true }).replace(/stroke="#2B1B3D"/g, 'stroke="#7FE3FF"'), `<rect x="112" y="192" width="16" height="5" rx="2.5" fill="${INK}"/>`);
      s.add(dome(120, 142, 36, 3), line('M120 105V94', METAL.ln, 3), `<circle cx="120" cy="91" r="5" fill="#FFF27A" stroke="${INK}" stroke-width="2" class="cr-blink"/>`);
    } else if (st === 2) {
      s.add(`<rect x="92" y="186" width="18" height="22" rx="5" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/><rect x="130" y="186" width="18" height="22" rx="5" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/>`);
      s.add(both(line('M72 148Q50 150 46 172', METAL.ln, 9) + line('M72 148Q50 150 46 172', METAL.c, 4)), claw(s, 46, 172, .85), claw(s, 194, 172, .85));
      s.add(`<rect x="70" y="122" width="100" height="70" rx="18" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="4"/>`, lights(80, 160, 132));
      s.add(`<rect x="86" y="142" width="68" height="36" rx="12" fill="#2E2445" stroke="${p.ln}" stroke-width="3"/>`);
      s.add(face(s, 120, 158, .85, { eye: '#7FE3FF', m: 'smile', noBlush: true }).replace(/stroke="#2B1B3D"/g, 'stroke="#7FE3FF"'));
      s.add(dome(120, 122, 46, 4), line('M120 76V64', METAL.ln, 3), `<circle cx="120" cy="60" r="6" fill="#FFF27A" stroke="${INK}" stroke-width="2" class="cr-blink"/>`);
    } else {
      aura(s, '#FF9E7A');
      s.add(`<rect x="82" y="186" width="26" height="24" rx="6" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/><rect x="132" y="186" width="26" height="24" rx="6" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/>`);
      s.add(both(line('M58 110Q24 104 22 150', METAL.ln, 11) + line('M58 110Q24 104 22 150', METAL.c, 5)), claw(s, 22, 150, 1.1), claw(s, 218, 150, 1.1));
      s.add(both(E(s, METAL, 62, 108, 16, 16)));
      s.add(`<rect x="56" y="86" width="128" height="108" rx="24" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="4"/>`, lights(66, 176, 96), lights(66, 176, 184));
      s.add(`<rect x="76" y="108" width="88" height="66" rx="12" fill="${s.lin('gl2', ['#F2FBFF', '#C6E8FF'])}" stroke="${METAL.ln}" stroke-width="3"/>`);
      ['#FF8FB1', '#FFD45C', '#7FD68E', '#8CC4FF', '#B79CFF'].forEach((c, i) => s.add(`<circle cx="${88 + i * 16}" cy="164" r="7" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`));
      s.add(line('M120 110V124', METAL.ln, 2), claw(s, 120, 124, .7));
      s.add(`<rect x="70" y="20" width="100" height="58" rx="20" fill="${s.g(p)}" stroke="${p.ln}" stroke-width="4"/>`, `<rect x="80" y="30" width="80" height="38" rx="12" fill="#2E2445" stroke="${p.ln}" stroke-width="3"/>`);
      s.add(face(s, 120, 46, .85, { eye: '#7FE3FF', m: 'open', fierce: true, noBlush: true }).replace(/stroke="#2B1B3D"/g, 'stroke="#7FE3FF"'));
      s.add(P(s, GOLD, 'M84 22L90 4L104 16L120 0L136 16L150 4L156 22Z', { w: 3 }));
    }
  } });

/* ===== 豐收系 ===== */
def({ id: 'h1', fam: 'harvest', rare: 'starter', color: '#5CC16E', names: ['芽芽蝟', '葉刺蝟', '森林刺蝟王'],
  concept: '背上的刺是嫩綠葉子的刺蝟，越用心照顧商品，葉子就長得越茂盛。', motif: '葉子刺 → 花朵 → 森林斗篷',
  stages: ['背上一圈嫩葉刺，頭頂冒出一根小芽。', '葉刺長成兩層，頭上開出一朵小花。', '葉刺化為層層森林斗篷，頭戴花冠、斜背藤蔓。'],
  draw(s, st) {
    const lf = pal(this.color), lf2 = pal('#86D67A'), skin = pal('#E9C291'), belly = '#FFF4E2';
    const spines = (cx, cy, r, n, len, w, from, to, pp) => { let o = ''; for (let i = 0; i < n; i++) { const a = from + (to - from) * i / (n - 1); o += leafS(s, pp, cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180), len, w, a + 90); } return o; };
    if (st === 1) {
      s.add(spines(120, 166, 34, 9, 30, 11, -180, 0, lf));
      const f = baby(s, skin, belly, { arms: true });
      s.add(leafS(s, lf2, 120, 126, 18, 7, 20), face(s, f.x, f.y, 1, { eye: '#3E8E4E', m: 'w', nose: true }));
    } else if (st === 2) {
      s.add(spines(120, 120, 40, 11, 40, 13, -200, 20, lf), spines(120, 120, 30, 9, 30, 11, -190, 10, lf2));
      const f = kid(s, skin, belly);
      s.add(flower(140, 80, 7, '#FF9EC4'), face(s, f.x, f.y, .95, { eye: '#3E8E4E', m: 'smile', nose: true }));
    } else {
      aura(s, '#8EE39A');
      s.add(spines(120, 120, 56, 13, 64, 18, -205, 25, pal('#3FA857')), spines(120, 100, 44, 11, 48, 15, -200, 20, lf), spines(120, 86, 34, 9, 34, 12, -195, 15, lf2));
      const f = hero(s, skin, belly);
      s.add(line('M80 126Q120 180 162 196', '#3E9B4F', 5), leafS(s, lf2, 100, 152, 14, 6, -60), leafS(s, lf2, 132, 176, 14, 6, -70));
      [[88, 58, '#FF9EC4'], [104, 50, '#FFE27A'], [120, 47, '#FF8F70'], [136, 50, '#B79CFF'], [152, 58, '#FF9EC4']].forEach(([x, y, c]) => s.add(flower(x, y, 6, c)));
      s.add(face(s, f.x, f.y + 4, .9, { eye: '#2F7A3E', m: 'open', fierce: true, nose: true }));
    }
  } });

def({ id: 'h2', fam: 'harvest', rare: 'common', color: '#7FDDB4', names: ['扭扭蛋', '扭蛋獸', '扭蛋王'],
  concept: '住在扭蛋殼裡的小傢伙。長大後把扭蛋殼當頭盔，最後戴上用扭蛋做的皇冠。', motif: '扭蛋殼 → 扭蛋頭盔 → 扭蛋王冠',
  stages: ['整個身體就是一顆扭蛋，透明上蓋裡有一顆種子。', '鑽出扭蛋，把上蓋當頭盔、下殼當腰帶。', '胸口是扭蛋機轉盤，頭戴扭蛋王冠，身旁漂浮彩色扭蛋。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#ECFFF6';
    const glassTop = (cx, cy, r) => `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z" fill="${s.lin('cap', ['#FFFFFF', '#E3F6FF'])}" stroke="${p.ln}" stroke-width="4" opacity=".92"/><path d="M${cx - r * .7} ${cy - r * .35}Q${cx - r * .55} ${cy - r * .8} ${cx - r * .1} ${cy - r * .88}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    if (st === 1) {
      s.add(E(s, p, 100, 206, 12, 7, { f: p.dk }), E(s, p, 140, 206, 12, 7, { f: p.dk }));
      s.add(P(s, p, 'M72 158H168Q168 206 120 206Q72 206 72 158Z'), glassTop(120, 158, 48), line('M70 158H170', p.ln, 5));
      s.add(E(s, LEAF, 120, 134, 9, 12, { w: 3 }), leafS(s, LEAF, 120, 124, 12, 6, 25));
      s.add(face(s, 120, 176, .95, { eye: '#249163', m: 'w' }));
    } else if (st === 2) {
      const f = kid(s, p, belly, { hry: 36 });
      s.add(P(s, pal('#FF9EC4'), 'M84 178H156Q160 202 120 204Q80 202 84 178Z', { w: 3.5 }), line('M82 178H158', pal('#FF9EC4').ln, 4));
      s.add(glassTop(120, 100, 50), line('M68 100H172', p.ln, 4));
      s.add(capsule(s, 164, 172, 12, '#FFD45C'), face(s, f.x, f.y + 6, .95, { eye: '#249163', m: 'open' }));
    } else {
      aura(s, '#9FF0C8');
      [[30, 70, '#FF9EC4'], [210, 74, '#FFD45C'], [26, 140, '#8CC4FF'], [214, 142, '#B79CFF']].forEach(([x, y, c]) => s.add(capsule(s, x, y, 13, c)));
      s.add(P(s, pal('#FF9EC4'), 'M66 120Q40 170 50 206Q90 196 120 204Q150 196 190 206Q200 170 174 120Z', { w: 3.5 }));
      [[64, 180], [80, 160], [176, 180], [160, 160], [70, 198], [170, 198]].forEach(([x, y], i) => s.add(`<circle cx="${x}" cy="${y}" r="5" fill="${['#FFD45C', '#8CC4FF', '#7FD68E'][i % 3]}" stroke="${INK}" stroke-width="1.5"/>`));
      const f = hero(s, p, belly);
      s.add(`<circle cx="120" cy="160" r="20" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3.5"/>`, line('M106 160H134', METAL.ln, 7), line('M106 160H134', '#fff', 3));
      s.add(P(s, GOLD, 'M80 56L86 34L100 46L120 28L140 46L154 34L160 56Z', { w: 3.5 }));
      [[86, 36, '#FF9EC4'], [120, 28, '#7FD68E'], [154, 36, '#8CC4FF']].forEach(([x, y, c]) => s.add(capsule(s, x, y - 6, 8, c)));
      s.add(face(s, f.x, f.y + 4, .9, { eye: '#1F7D55', m: 'open', fierce: true }));
    }
  } });

def({ id: 'h3', fam: 'harvest', rare: 'rare', color: '#DE9A5B', names: ['橡實鼠', '囤囤鼠', '豐收松王'],
  concept: '最會囤貨的松鼠，臉頰塞滿橡實。成為松王後，大尾巴上結滿了水果。', motif: '橡實帽 → 鼓鼓臉頰 → 結果大尾巴',
  stages: ['戴著橡實帽、尾巴捲成一大團的小松鼠。', '臉頰塞滿存貨鼓起來，懷裡抱著橡實。', '巨大尾巴上結滿蘋果與葡萄，頭戴橡實王冠，手提豐收籃。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF1DD', tl = pal('#E8AD6E');
    if (st === 1) {
      s.add(P(s, tl, 'M150 200Q206 200 200 140Q196 104 160 108Q178 124 172 146Q166 168 146 170Z'));
      s.add(both(E(s, p, 88, 128, 11, 15, { r: -20 })));
      const f = baby(s, p, belly, { arms: true });
      s.add(rot(-12, 120, 126, P(s, WOOD, 'M90 130Q92 104 120 102Q148 104 150 130Q120 122 90 130Z', { w: 3.5 }) + line('M120 102L124 92', WOOD.ln, 3.5) + line('M96 120L144 120M100 112H140', WOOD.ln, 1.8, .4)));
      s.add(face(s, f.x, f.y + 2, 1, { eye: '#8A4F1C', m: 'teeth', nose: true }));
    } else if (st === 2) {
      s.add(P(s, tl, 'M146 200Q222 200 214 120Q208 62 160 70Q186 92 180 128Q174 160 144 166Z'), line('M176 92Q196 110 196 140', tl.hi, 4, .7));
      s.add(both(E(s, p, 86, 82, 12, 17, { r: -20 })));
      const f = kid(s, p, belly);
      s.add(both(E(s, p, 88, 132, 16, 13)), acorn(s, 120, 170, 1.4));
      s.add(face(s, f.x, f.y - 2, .95, { eye: '#8A4F1C', m: 'teeth', nose: true }));
    } else {
      aura(s, '#FFD08A');
      s.add(P(s, tl, 'M150 204Q238 204 230 110Q222 30 150 40Q192 70 186 116Q180 160 146 170Z'), line('M180 64Q206 92 208 136', tl.hi, 5, .7));
      [[196, 80, '#FF6B6B'], [214, 120, '#B07AE0'], [204, 160, '#FF6B6B'], [180, 56, '#FFB547']].forEach(([x, y, c]) => s.add(`<circle cx="${x}" cy="${y}" r="10" fill="${s.g(pal(c))}" stroke="${pal(c).ln}" stroke-width="2.6"/>`, leafS(s, LEAF, x + 2, y - 9, 10, 5, 30)));
      s.add(both(E(s, p, 86, 50, 12, 17, { r: -20 })));
      const f = hero(s, p, belly);
      s.add(P(s, WOOD, 'M44 172H84L80 196Q64 202 48 196Z', { w: 3 }), line('M46 172Q64 148 82 172', WOOD.ln, 3.5), `<circle cx="56" cy="168" r="6" fill="#FF6B6B" stroke="${INK}" stroke-width="1.6"/><circle cx="70" cy="166" r="6" fill="#FFB547" stroke="${INK}" stroke-width="1.6"/>`);
      [88, 104, 120, 136, 152].forEach((x, i) => s.add(acorn(s, x, 54 - (i === 2 ? 8 : i % 2 ? 4 : 0), .75)));
      s.add(face(s, f.x, f.y + 4, .9, { eye: '#7A400E', m: 'open', fierce: true, nose: true }));
    }
  } });

def({ id: 'h4', fam: 'harvest', rare: 'legend', color: '#EBC58F', names: ['小穗鹿', '麥穗鹿', '豐年神鹿'],
  concept: '帶來豐收的神鹿，鹿角是不斷生長的麥穗。只會出現在全店共養的「店寵」。', motif: '嫩芽角 → 麥穗角 → 金色豐年角',
  stages: ['頭上冒出兩片嫩葉的小鹿，身上有白色斑點。', '鹿角長成麥穗，優雅地坐著。', '金色麥穗巨角上開花結果，脖子圍著葉環，全身散發金光。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF8EA';
    const spots = (pts, r) => pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .8}" fill="#fff" opacity=".85"/>`).join('');
    const ears = (y, a) => both(rot(a, 80, y, E(s, p, 80, y, 20, 10) + E(s, PINKC, 82, y, 11, 5, { ns: 1, f: '#FFD0C4' })));
    if (st === 1) {
      s.add(leafS(s, LEAF, 104, 130, 18, 8, -20), leafS(s, LEAF, 136, 130, 18, 8, 20));
      s.add(ears(140, -20));
      const f = baby(s, p, belly, { arms: true });
      s.add(spots([[90, 180], [150, 176], [140, 194]], 4), face(s, f.x, f.y + 2, 1, { eye: '#7A5222', m: 'w', nose: true }));
    } else if (st === 2) {
      s.add(wheat(s, 100, 80, 76, 30, .9), wheat(s, 140, 80, 164, 30, .9), wheat(s, 90, 74, 60, 60, .7), wheat(s, 150, 74, 180, 60, .7));
      s.add(ears(98, -22));
      const f = sit2(s, p, belly, { hrx: 40, hry: 36 });
      s.add(spots([[78, 186], [162, 186], [92, 178]], 4.5), face(s, f.x, f.y + 2, .95, { eye: '#7A5222', m: 'smile', nose: true }));
    } else {
      aura(s, '#FFE27A');
      s.add(wheat(s, 98, 56, 60, 6, 1.1), wheat(s, 142, 56, 180, 6, 1.1), wheat(s, 86, 50, 34, 34, .9), wheat(s, 154, 50, 206, 34, .9), wheat(s, 92, 40, 82, 0, .8), wheat(s, 148, 40, 158, 0, .8));
      [[48, 40, '#FF9EC4'], [192, 40, '#FFFFFF'], [70, 22, '#FFD45C'], [170, 22, '#FF9EC4']].forEach(([x, y, c]) => s.add(flower(x, y, 6, c)));
      s.add(`<circle cx="40" cy="22" r="7" fill="${s.g(pal('#FF6B6B'))}" stroke="${INK}" stroke-width="2"/><circle cx="200" cy="22" r="7" fill="${s.g(pal('#FFB547'))}" stroke="${INK}" stroke-width="2"/>`);
      s.add(ears(70, -24));
      const f = sit3(s, p, belly, { hrx: 38, hry: 34 });
      for (let i = 0; i < 9; i++) s.add(leafS(s, i % 2 ? LEAF : pal('#86D67A'), 82 + i * 9.5, 120 + Math.sin(i / 8 * Math.PI) * 10, 18, 7, 180 + (i - 4) * 12));
      s.add(spots([[66, 182], [176, 180], [86, 196], [156, 196]], 5), face(s, f.x, f.y + 2, .9, { eye: '#6A4512', m: 'smile', fierce: true, nose: true }));
    }
  } });

/* ===== 親和系 ===== */
def({ id: 'k1', fam: 'kind', rare: 'starter', color: '#FFB6D0', names: ['棉棉兔', '糖霜兔', '雲朵兔'],
  concept: '頭頂長著棉花糖的兔子，笑起來會讓顧客心情變好。最後輕飄飄地坐在雲朵上。', motif: '棉花糖頭毛 → 糖霜耳朵 → 雲朵座',
  stages: ['頭頂一團粉紅棉花糖，一隻耳朵垂下來。', '耳朵尖端沾著糖霜，手裡拿著棉花糖棒。', '坐在蓬鬆雲朵上飄浮，耳朵末端變成小雲朵。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFFFFF', cot = pal('#FFD9EA');
    const fluff = (x, y, k) => [[-14, 4, 12], [0, -6, 14], [14, 4, 12], [-6, 8, 10], [8, 9, 10]].map(([dx, dy, r]) => `<circle cx="${x + dx * k}" cy="${y + dy * k}" r="${r * k}" fill="${s.g(cot)}" stroke="${cot.ln}" stroke-width="${2.6 * k}"/>`).join('');
    const earL = (x, y, h, a, tip) => rot(a, x, y, E(s, p, x, y - h / 2, 12, h / 2) + E(s, PINKC, x, y - h / 2, 5, h / 2 - 8, { ns: 1, f: '#FFD0DE' }) + (tip ? `<path d="${cloudD(x, y - h + 4, .32)}" fill="#fff" stroke="${p.ln}" stroke-width="2.6"/>` : ''));
    if (st === 1) {
      s.add(earL(100, 136, 50, -10), earL(140, 138, 44, 60));
      const f = baby(s, p, belly, { arms: true });
      s.add(fluff(120, 124, .9), face(s, f.x, f.y + 4, 1, { eye: '#D94C86', m: 'w' }));
    } else if (st === 2) {
      s.add(earL(98, 90, 66, -12) + `<path d="M88 34Q98 24 108 34Q110 44 104 40Q98 46 94 40Q86 44 88 34Z" fill="#fff" stroke="${p.ln}" stroke-width="2.4"/>`, earL(142, 90, 66, 12) + `<path d="M132 34Q142 24 152 34Q154 44 148 40Q142 46 138 40Q130 44 132 34Z" fill="#fff" stroke="${p.ln}" stroke-width="2.4" transform="rotate(12 142 90)"/>`);
      const f = kid(s, p, belly);
      s.add(fluff(120, 80, .95), line('M166 196L176 150', WOOD.ln, 4), fluff(178, 138, .8));
      s.add(face(s, f.x, f.y + 4, .95, { eye: '#D94C86', m: 'open' }));
    } else {
      aura(s, '#FFC2DD');
      s.add(earL(98, 76, 60, -16, 1), earL(142, 76, 60, 16, 1));
      s.add(`<path d="${cloudD(120, 196, 1.9)}" fill="${s.lin('cl', ['#FFFFFF', '#FFE4F0'])}" stroke="${p.ln}" stroke-width="4"/>`);
      s.add(both(E(s, p, 74, 140, 11, 22, { r: 30 })), E(s, p, 120, 142, 44, 40), E(s, p, 120, 150, 26, 26, { f: belly, ns: 1 }));
      s.add(P(s, p, blob(120, 82, 43, 37)), fluff(120, 50, 1.05));
      s.add(P(s, pal('#FF6FA0'), 'M100 112L84 104L86 124Z', { w: 2.6 }), P(s, pal('#FF6FA0'), 'M140 112L156 104L154 124Z', { w: 2.6 }), `<circle cx="120" cy="114" r="5" fill="#FF6FA0" stroke="${INK}" stroke-width="2"/>`);
      s.add(face(s, 120, 84, .9, { eye: '#C93B78', m: 'open', fierce: true }));
      return { float: true };
    }
  } });

def({ id: 'k2', fam: 'kind', rare: 'common', color: '#FF9DAE', names: ['結結狐', '緞帶狐', '禮盒狐'],
  concept: '尾巴綁著蝴蝶結的小狐狸，喜歡幫顧客把獎品包得漂漂亮亮。最後長出三條緞帶尾巴。', motif: '蝴蝶結 → 緞帶尾 → 三尾禮盒',
  stages: ['大尾巴上綁著一個蝴蝶結的小狐狸。', '坐得端正的狐狸，頭上也繫著緞帶，尾巴纏繞彩帶。', '三條蓬鬆尾巴各繫緞帶，懷抱金色禮盒。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF4EC', rib = pal('#FF5C8A');
    const bow = (x, y, k) => P(s, rib, `M${x} ${y}Q${x - 18 * k} ${y - 14 * k} ${x - 20 * k} ${y}Q${x - 18 * k} ${y + 14 * k} ${x} ${y}Z`, { w: 2.6 * k }) + P(s, rib, `M${x} ${y}Q${x + 18 * k} ${y - 14 * k} ${x + 20 * k} ${y}Q${x + 18 * k} ${y + 14 * k} ${x} ${y}Z`, { w: 2.6 * k }) + `<circle cx="${x}" cy="${y}" r="${4.5 * k}" fill="${rib.c}" stroke="${rib.ln}" stroke-width="${2.4 * k}"/>`;
    const tail = (d) => P(s, p, d) ;
    const ear = (x, y, h, a) => rot(a, x, y, P(s, p, `M${x - 16} ${y}L${x - 2} ${y - h}Q${x} ${y - h - 3} ${x + 2} ${y - h}L${x + 16} ${y}Z`) + P(s, WHITE, `M${x - 8} ${y - 3}L${x} ${y - h * .7}L${x + 8} ${y - 3}Z`, { ns: 1, f: '#FFF0E6' }));
    if (st === 1) {
      s.add(tail('M150 196Q204 196 196 148Q192 128 176 124Q186 148 170 160Q160 168 148 170Z'), P(s, WHITE, 'M176 124Q186 136 184 150Q178 132 170 128Z', { ns: 1, f: '#fff' }), bow(184, 166, .7));
      s.add(ear(94, 136, 40, -14), ear(146, 136, 40, 14));
      const f = baby(s, p, belly, { arms: true });
      s.add(face(s, f.x, f.y, 1, { eye: '#D2456A', m: 'w', nose: true }));
    } else if (st === 2) {
      s.add(tail('M148 200Q214 200 210 140Q206 106 182 100Q196 134 178 156Q166 170 146 172Z'), line('M178 110Q206 130 196 170Q186 186 160 190', rib.c, 5), bow(198, 120, .7));
      s.add(ear(90, 94, 46, -16), ear(150, 94, 46, 16));
      const f = sit2(s, p, belly);
      s.add(bow(144, 80, .65), face(s, f.x, f.y + 2, .95, { eye: '#D2456A', m: 'smile', nose: true }));
    } else {
      aura(s, '#FFB2C8');
      [['M150 190Q232 190 224 120Q220 84 196 74Q206 116 186 140Q172 158 148 164Z', 210, 96], ['M90 190Q8 190 16 120Q20 84 44 74Q34 116 54 140Q68 158 92 164Z', 30, 96], ['M120 160Q116 70 150 30Q152 70 140 100Q132 130 128 160Z', 148, 46]].forEach(([d, x, y]) => s.add(tail(d), bow(x, y, .65)));
      s.add(ear(92, 64, 50, -18), ear(148, 64, 50, 18));
      const f = sit3(s, p, belly, { hrx: 40, hry: 34 });
      s.add(`<rect x="96" y="150" width="48" height="40" rx="6" fill="${s.g(GOLD)}" stroke="${GOLD.ln}" stroke-width="3.5"/>`, line('M120 150V190', rib.c, 7), line('M96 168H144', rib.c, 7), bow(120, 150, .7));
      s.add(face(s, f.x, f.y + 2, .9, { eye: '#C2345C', m: 'smile', fierce: true, nose: true }));
    }
  } });

def({ id: 'k3', fam: 'kind', rare: 'rare', color: '#FF8FB6', names: ['啾啾', '歌歌鳥', '迎賓鳳'],
  concept: '一開口就是好聽歌聲的小鳥，頭上的羽冠是音符形狀。最終成為迎接每位顧客的華麗鳳鳥。', motif: '音符羽冠 → 雙音符 → 華麗長尾',
  stages: ['圓滾滾的小雛鳥，頭上一根音符羽毛。', '張開翅膀唱歌，羽冠變成雙音符，周圍飄著音符。', '展翅迎賓的鳳鳥，三條長尾羽與金色羽冠，歌聲化為光芒。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF1F6', wing = pal('#FF6FA0');
    const crest = (x, y, k) => `<g transform="rotate(10 ${x} ${y})">` + line(`M${x} ${y}V${y - 24 * k}Q${x + 10 * k} ${y - 20 * k} ${x + 12 * k} ${y - 10 * k}`, wing.ln, 5 * k) + line(`M${x} ${y}V${y - 24 * k}Q${x + 10 * k} ${y - 20 * k} ${x + 12 * k} ${y - 10 * k}`, wing.c, 2.6 * k) + `</g>`;
    if (st === 1) {
      s.add(E(s, pal('#FFB547'), 104, 206, 8, 5, { f: '#FFB547' }), E(s, pal('#FFB547'), 136, 206, 8, 5, { f: '#FFB547' }));
      s.add(both(P(s, wing, 'M76 160Q60 172 68 188Q80 186 86 172Z', { w: 3 })));
      s.add(crest(118, 128, 1));
      const f = baby(s, p, belly, { noFeet: true });
      s.add(face(s, f.x, f.y, 1, { eye: '#C93B78', m: 'beak' }));
    } else if (st === 2) {
      s.add(P(s, wing, 'M120 196Q100 214 86 210Q100 200 108 190Z', { w: 3 }), P(s, wing, 'M120 196Q140 214 154 210Q140 200 132 190Z', { w: 3 }));
      s.add(both(fWing(s, wing, 86, 162, .95, [212, 194, 176, 158])));
      s.add(E(s, pal('#FFB547'), 106, 206, 9, 5, { f: '#FFB547' }), E(s, pal('#FFB547'), 134, 206, 9, 5, { f: '#FFB547' }));
      s.add(P(s, p, blob(120, 152, 42, 52)), E(s, p, 120, 168, 26, 30, { f: belly, ns: 1 }));
      s.add(crest(110, 104, 1), crest(128, 104, .8), note(34, 100, 1, '#FFD45C'), note(196, 84, .9, '#8CC4FF'));
      s.add(face(s, 120, 132, .95, { eye: '#C93B78', m: 'beak' }));
    } else {
      aura(s, '#FFB0CE');
      ['M120 170Q70 210 20 214Q60 196 100 168', 'M120 172Q120 214 104 236Q130 214 132 172', 'M120 170Q170 210 220 214Q180 196 140 168'].forEach((d, i) => s.add(line(d, wing.ln, 12), line(d, ['#FFD45C', '#FF6FA0', '#B79CFF'][i], 7), `<circle cx="${[24, 106, 216][i]}" cy="${[212, 232, 212][i]}" r="7" fill="${['#FF6FA0', '#FFD45C', '#FF6FA0'][i]}" stroke="${INK}" stroke-width="2"/>`));
      s.add(both(fWing(s, wing, 84, 130, 1.4, [222, 204, 186, 168, 150], '#FFD45C')));
      s.add(P(s, p, blob(120, 132, 44, 60)), E(s, p, 120, 150, 26, 34, { f: belly, ns: 1 }));
      s.add(P(s, GOLD, 'M100 76Q94 46 104 30Q110 52 114 72Z', { w: 3 }), P(s, GOLD, 'M116 72Q114 36 124 18Q130 46 126 72Z', { w: 3 }), P(s, GOLD, 'M132 74Q140 48 152 40Q146 62 140 80Z', { w: 3 }));
      s.add(note(26, 46, .9, '#FFD45C'), note(206, 60, .9, '#8CC4FF'), note(196, 150, .7, '#FFD45C'));
      s.add(face(s, 120, 106, .92, { eye: '#B32D66', m: 'beak', fierce: true }));
    }
  } });

def({ id: 'k4', fam: 'kind', rare: 'legend', color: '#FFB1C4', names: ['泡泡鯨', '心海鯨', '天空暖鯨'],
  concept: '在店裡上空悠游的溫柔鯨魚，噴出的水柱是愛心形狀。只會出現在全店共養的「店寵」。', motif: '愛心水柱 → 泡泡 → 天空雲海',
  stages: ['飄在空中的小鯨魚，頭頂噴出小小愛心。', '更大更圓的鯨魚，噴出大愛心水柱，身邊冒泡泡。', '巨大的天空鯨，身披雲朵、鰭像翅膀，愛心噴泉閃閃發亮。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#FFF4EE', sp = pal('#FF6F9A');
    const fluke = (x, y, k) => P(s, p, `M${x} ${y + 20 * k}Q${x + 4 * k} ${y} ${x - 14 * k} ${y - 12 * k}Q${x + 6 * k} ${y - 6 * k} ${x + 10 * k} ${y + 2 * k}Q${x + 16 * k} ${y - 8 * k} ${x + 36 * k} ${y - 10 * k}Q${x + 22 * k} ${y + 4 * k} ${x + 14 * k} ${y + 20 * k}Z`);
    const bub = pts => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.55)" stroke="${p.ln}" stroke-width="2"/><circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .25}" fill="#fff"/>`).join('');
    if (st === 1) {
      s.add(fluke(160, 150, .8));
      s.add(both(P(s, p, 'M80 176Q60 186 62 198Q78 196 88 184Z', { w: 3 })));
      s.add(P(s, p, blob(120, 162, 50, 40)), E(s, p, 120, 180, 30, 16, { f: belly, ns: 1 }));
      s.add(`<path d="${heart(120, 108, 1)}" fill="${s.g(sp)}" stroke="${sp.ln}" stroke-width="2.6"/>`, line('M120 120V114', '#8FD3FF', 4));
      s.add(face(s, 120, 158, 1, { eye: '#D04A78', m: 'w' }));
      return { float: true };
    } else if (st === 2) {
      s.add(fluke(166, 124, 1.1), bub([[36, 110, 8], [52, 86, 5], [202, 176, 7]]));
      s.add(both(P(s, p, 'M72 170Q40 184 40 206Q62 204 80 186Z', { w: 3.5 })));
      s.add(P(s, p, blob(120, 154, 62, 50)), E(s, p, 120, 178, 40, 20, { f: belly, ns: 1 }), line('M86 178H154M92 186H148', p.ln, 1.8, .3));
      s.add(`<path d="${heart(120, 74, 1.6)}" fill="${s.g(sp)}" stroke="${sp.ln}" stroke-width="3"/>`, line('M120 102V94', '#8FD3FF', 5), `<path d="${heart(96, 82, .6)}" fill="${sp.lt}" stroke="${sp.ln}" stroke-width="2"/><path d="${heart(146, 80, .6)}" fill="${sp.lt}" stroke="${sp.ln}" stroke-width="2"/>`);
      s.add(face(s, 120, 146, 1, { eye: '#D04A78', m: 'open' }));
      return { float: true };
    } else {
      aura(s, '#FFC6D8');
      s.add(fluke(174, 108, 1.4));
      s.add(both(E(s, p, 44, 168, 36, 14, { r: -24 }) + line('M22 176Q44 166 64 164', p.ln, 2, .35)));
      s.add(P(s, p, blob(120, 150, 76, 58)), E(s, p, 120, 178, 50, 22, { f: belly, ns: 1 }), line('M78 176H162M84 186H156M92 196H148', p.ln, 1.8, .3));
      [[70, 120], [164, 116], [84, 104], [150, 100]].forEach(([x, y]) => s.add(`<path d="${star5(x, y, 4)}" fill="#FFF3B0"/>`));
      s.add(`<path d="${cloudD(56, 204, .7)}" fill="#fff" stroke="${p.ln}" stroke-width="3"/><path d="${cloudD(186, 206, .8)}" fill="#fff" stroke="${p.ln}" stroke-width="3"/>`);
      s.add(line('M120 92V70', '#8FD3FF', 6), `<path d="${heart(120, 44, 2.2)}" fill="${s.g(sp)}" stroke="${sp.ln}" stroke-width="3.5"/>`, `<path d="${heart(84, 50, .8)}" fill="${sp.lt}" stroke="${sp.ln}" stroke-width="2"/><path d="${heart(158, 46, .8)}" fill="${sp.lt}" stroke="${sp.ln}" stroke-width="2"/>`, `<path d="${star4(150, 26, 6)}" fill="#fff"/>`);
      s.add(face(s, 120, 142, 1.05, { eye: '#C23C6C', m: 'open', fierce: true }));
      return { float: true };
    }
  } });

/* ===== 智慧系 ===== */
def({ id: 'w1', fam: 'wise', rare: 'starter', color: '#A38AEC', names: ['眼眼鴞', '書卷鴞', '星典賢鴞'],
  concept: '每天讀完公告的貓頭鷹，什麼 SOP 都記得。最終頭戴學士帽、披著星座斗篷。', motif: '大眼 → 書本翅膀 → 星座斗篷與學士帽',
  stages: ['眼睛圓又大的貓頭鷹寶寶，有兩撮耳羽。', '翅膀像打開的書頁，戴著圓框眼鏡。', '披著星座斗篷、戴學士帽，手捧發光的星之書。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#F4EEFF', mask = '#EFE7FF';
    const tufts = (y, h) => both(P(s, p, `M86 ${y}L80 ${y - h}L102 ${y - 6}Z`));
    const bookWing = (k) => both(`<g transform="rotate(${-14} 80 ${150})"><path d="M52 ${132}Q66 ${126} 80 ${134}V${178}Q66 ${170} 52 ${176}Z" fill="#fff" stroke="${p.ln}" stroke-width="3"/>` + line(`M57 ${142}Q66 ${138} 75 ${144}M57 ${152}Q66 ${148} 75 ${154}M57 ${162}Q66 ${158} 75 ${164}`, '#B9A9E0', 1.8) + `</g>`);
    if (st === 1) {
      s.add(tufts(132, 26));
      s.add(both(P(s, p, 'M78 160Q64 176 72 192Q84 186 88 172Z', { w: 3 })));
      const f = baby(s, p, belly, { noFeet: false });
      s.add(both(`<circle cx="103" cy="${f.y - 2}" r="17" fill="${mask}" stroke="${p.ln}" stroke-width="2.4" opacity=".95"/>`));
      s.add(face(s, f.x, f.y - 2, 1.1, { eye: '#6A4BD0', m: 'beak', noBlush: true }));
    } else if (st === 2) {
      s.add(tufts(86, 30), bookWing());
      const f = kid(s, p, belly, { noArms: true });
      s.add(both(`<circle cx="102" cy="${f.y - 2}" r="18" fill="${mask}" stroke="${p.ln}" stroke-width="2.4"/>`));
      s.add(face(s, f.x, f.y - 2, 1.05, { eye: '#6A4BD0', m: 'beak', noBlush: true }));
      s.add(both(`<circle cx="102" cy="${f.y - 2}" r="15" fill="none" stroke="#C99A2E" stroke-width="3.4"/>`), line(`M114 ${f.y - 4}Q120 ${f.y - 8} 126 ${f.y - 4}`, '#C99A2E', 3));
    } else {
      aura(s, '#B9A2FF');
      s.add(P(s, pal('#2E2A6B'), 'M64 90Q20 150 30 210Q80 196 120 206Q160 196 210 210Q220 150 176 90Z', { ln: '#1B1747', w: 3.5 }));
      [[48, 170], [64, 130], [44, 196], [196, 172], [178, 130], [200, 196], [80, 186], [162, 186]].forEach(([x, y], i) => s.add(`<path d="${star4(x, y, i % 3 ? 3.5 : 5)}" fill="#FFF3B0"/>`));
      s.add(line('M48 170L64 130L80 186M196 172L178 130L162 186', '#FFF3B0', 1.2, .5));
      s.add(tufts(56, 26));
      const f = hero(s, p, belly, { noArms: true });
      s.add(both(`<circle cx="103" cy="${f.y}" r="17" fill="${mask}" stroke="${p.ln}" stroke-width="2.4"/>`));
      s.add(face(s, f.x, f.y, 1, { eye: '#5A3BC0', m: 'beak', noBlush: true, fierce: true }));
      s.add(P(s, pal('#2E2A6B'), 'M70 52L120 30L170 52L120 72Z', { ln: '#1B1747', w: 3 }), `<rect x="100" y="56" width="40" height="12" rx="3" fill="#2E2A6B" stroke="#1B1747" stroke-width="3"/>`, line('M120 50L160 60V82', GOLD.c, 3), `<circle cx="160" cy="84" r="4" fill="${GOLD.c}"/>`);
      s.add(mono(s, 120, 170, 2, '#FFF6B8'), `<path d="M92 164Q106 156 120 166Q134 156 148 164V188Q134 180 120 188Q106 180 92 188Z" fill="#fff" stroke="${p.ln}" stroke-width="3"/>`, `<path d="${star5(120, 152, 7)}" fill="#FFE27A" stroke="#C99A2E" stroke-width="1.6"/>`, both(E(s, p, 88, 176, 10, 9)));
    }
  } });

def({ id: 'w2', fam: 'wise', rare: 'common', color: '#B49DF2', names: ['晶晶蜥', '晶甲蜥', '晶石龍'],
  concept: '吸收知識就會長出水晶的蜥蜴，答對越多題，水晶就越閃亮。', motif: '小水晶 → 水晶背脊 → 水晶翅膀',
  stages: ['頭上冒出三顆小水晶的圓蜥蜴。', '背脊與尾巴長出整排水晶，額頭有一顆寶石。', '長出水晶翅膀的晶石龍，頭頂水晶王冠閃閃發光。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#F7F1FF', cr = pal('#8FE3F2'), cr2 = pal('#E8D9FF');
    if (st === 1) {
      s.add(P(s, p, 'M150 194Q190 200 194 176Q178 186 156 180Z'), crystal(s, cr, 190, 178, 6, 14, 40));
      s.add(crystal(s, cr, 104, 128, 8, 18, -22), crystal(s, cr2, 120, 124, 9, 22, 0), crystal(s, cr, 136, 128, 8, 18, 22));
      const f = baby(s, p, belly, { arms: true });
      s.add(face(s, f.x, f.y + 2, 1, { eye: '#2FA7C2', m: 'w' }));
    } else if (st === 2) {
      s.add(P(s, p, 'M146 196Q206 204 214 160Q196 182 160 178Z'), crystal(s, cr, 206, 166, 7, 18, 30), crystal(s, cr2, 190, 178, 6, 14, 50));
      [[84, 92, -40, cr], [96, 80, -20, cr2], [144, 80, 20, cr2], [156, 92, 40, cr]].forEach(([x, y, a, c]) => s.add(crystal(s, c, x, y, 8, 22, a)));
      const f = kid(s, p, belly);
      s.add(`<path d="M120 86L127 94L120 102L113 94Z" fill="${s.g(pal('#FF8FB1'))}" stroke="${INK}" stroke-width="2"/>`);
      s.add(face(s, f.x, f.y + 4, .95, { eye: '#2FA7C2', m: 'smile' }));
    } else {
      aura(s, '#A8E8FF');
      s.add(both(P(s, cr, 'M84 130L20 70L34 120L10 132L44 150L30 176L82 160Z', { w: 3.5 }) + line('M20 70L60 140M10 132L70 150M30 176L76 158', '#fff', 2, .7)));
      s.add(P(s, p, 'M158 198Q228 206 230 150Q208 182 168 180Z'), crystal(s, cr, 226, 156, 8, 22, 30));
      const f = hero(s, p, belly);
      [[90, 58, -40, cr, 24], [104, 48, -18, cr2, 28], [120, 44, 0, cr, 34], [136, 48, 18, cr2, 28], [150, 58, 40, cr, 24]].forEach(([x, y, a, c, h]) => s.add(crystal(s, c, x, y, 8, h, a)));
      s.add(`<path d="M120 62L128 70L120 78L112 70Z" fill="${s.g(pal('#FF8FB1'))}" stroke="${INK}" stroke-width="2"/>`);
      s.add(face(s, f.x, f.y + 6, .9, { eye: '#1F8FAD', m: 'fang', fierce: true }));
    }
  } });

def({ id: 'w3', fam: 'wise', rare: 'rare', color: '#C8B6FF', names: ['點點母', '靈感水母', '智光水母'],
  concept: '頭是一顆燈泡的水母，想到好點子時就會發亮。最強型態能照亮整間店。', motif: '燈絲 → 燈泡螺紋 → 智慧光環',
  stages: ['透明的燈泡頭裡有一條小燈絲，四隻短觸手。', '燈泡底下長出螺紋燈座，觸手尖端會發光。', '巨大的發光燈泡，頭頂光環，長長觸手末端是星星。'],
  draw(s, st) {
    const p = pal(this.color), glow = '#FFF2A0', base = pal('#C9CED8');
    const dome = (cx, cy, rx, ry, k) => `<path d="M${cx - rx} ${cy}C${cx - rx} ${cy - ry * 1.3} ${cx + rx} ${cy - ry * 1.3} ${cx + rx} ${cy}Q${cx} ${cy + ry * .25} ${cx - rx} ${cy}Z" fill="${s.lin('dm', ['#F4EEFF', p.c])}" stroke="${p.ln}" stroke-width="4" opacity=".96"/>` + `<circle cx="${cx}" cy="${cy - ry * .66}" r="${ry * .5}" fill="${s.glow('in', glow, .95)}"/>` + line(`M${cx - 7 * k} ${cy - ry * .58}L${cx - 2 * k} ${cy - ry * .74}M${cx + 7 * k} ${cy - ry * .58}L${cx + 2 * k} ${cy - ry * .74}`, '#C9A227', 2.2 * k) + `<path d="${star4(cx, cy - ry * .8, 9 * k)}" fill="#FFE45C" stroke="#E0A400" stroke-width="${2 * k}" class="cr-spark"/>` + `<path d="M${cx - rx * .65} ${cy - ry * .5}Q${cx - rx * .5} ${cy - ry * .95} ${cx - rx * .1} ${cy - ry}" stroke="#fff" stroke-width="${5 * k}" fill="none" stroke-linecap="round" opacity=".85"/>`;
    const tent = (x, y, len, w, c, tip) => line(`M${x} ${y}q${w} ${len * .25} 0 ${len * .5}t0 ${len * .5}`, p.ln, 8) + line(`M${x} ${y}q${w} ${len * .25} 0 ${len * .5}t0 ${len * .5}`, c, 4) + (tip ? tip(x, y + len) : '');
    if (st === 1) {
      [96, 112, 128, 144].forEach((x, i) => s.add(tent(x, 170, 34, i % 2 ? 6 : -6, p.c)));
      s.add(dome(120, 170, 46, 50, 1));
      s.add(face(s, 120, 157, .9, { eye: '#7B5AD9', m: 'w' }));
      return { float: true, shadow: 34 };
    } else if (st === 2) {
      [90, 106, 134, 150].forEach((x, i) => s.add(tent(x, 160, 50, i % 2 ? 8 : -8, p.c, (x2, y2) => mono(s, x2, y2, .8, glow) + `<circle cx="${x2}" cy="${y2}" r="5" fill="${glow}" stroke="#E0A400" stroke-width="2"/>`)));
      s.add(`<rect x="94" y="150" width="52" height="22" rx="8" fill="${s.g(base)}" stroke="${base.ln}" stroke-width="3"/>`, line('M96 158H144M96 165H144', base.ln, 2, .6));
      s.add(dome(120, 152, 54, 58, 1.1));
      s.add(face(s, 120, 134, .95, { eye: '#7B5AD9', m: 'open' }), `<path d="${star4(52, 80, 8)}" fill="${glow}"/><path d="${star4(190, 100, 6)}" fill="${glow}"/>`);
      return { float: true, shadow: 40 };
    } else {
      aura(s, '#FFF2A0');
      s.add(`<ellipse cx="120" cy="22" rx="40" ry="9" fill="none" stroke="#FFD45C" stroke-width="5"/>`);
      [70, 92, 110, 130, 148, 170].forEach((x, i) => s.add(tent(x, 146, 74, i % 2 ? 10 : -10, i % 2 ? p.c : '#E8DBFF', (x2, y2) => `<path d="${star5(x2, y2, 7)}" fill="${glow}" stroke="#E0A400" stroke-width="2"/>`)));
      s.add(`<rect x="86" y="132" width="68" height="26" rx="10" fill="${s.g(base)}" stroke="${base.ln}" stroke-width="3"/>`, line('M88 141H152M88 149H152', base.ln, 2, .6));
      s.add(dome(120, 134, 70, 74, 1.3));
      s.add(face(s, 120, 110, 1, { eye: '#6343CC', m: 'open', fierce: true }));
      return { float: true, shadow: 50 };
    }
  } });

def({ id: 'w4', fam: 'wise', rare: 'legend', color: '#9A86F2', names: ['小星駒', '星辰駒', '天文獨角獸'],
  concept: '從星空降臨的小馬，鬃毛裡藏著整片銀河。只會出現在全店共養的「店寵」。', motif: '星星鬃毛 → 星辰尾巴 → 銀河鬃毛與金角',
  stages: ['額頭有星星胎記，鬃毛裡夾著小星星的小馬。', '坐姿優雅，鬃毛與尾巴像星河一樣流動。', '頭頂金色螺旋角，銀河鬃毛閃耀，帶來好運的星辰。'],
  draw(s, st) {
    const p = pal(this.color), belly = '#F6F2FF';
    const gal = s.lin('gal', ['#3A2F86', '#7B5AD9', '#FF8FC8']);
    const stars = pts => pts.map(([x, y, r]) => `<path d="${star4(x, y, r)}" fill="#FFF6C2"/>`).join('');
    const ears = (y) => both(rot(-14, 92, y, P(s, p, `M84 ${y}Q86 ${y - 26} 96 ${y - 28}Q104 ${y - 14} 104 ${y}Z`)));
    if (st === 1) {
      s.add(ears(136));
      s.add(P(s, p, 'M154 196Q186 200 188 176Q170 186 156 180Z', { f: gal }));
      const f = baby(s, p, belly, { arms: true });
      s.add(P(s, p, 'M92 132Q100 112 124 116Q146 118 150 136Q130 128 120 140Q110 128 92 132Z', { f: gal }), stars([[110, 124, 3], [136, 126, 3.5]]));
      s.add(`<path d="${star5(120, 148, 5)}" fill="#FFE27A" stroke="#C99A2E" stroke-width="1.4"/>`, face(s, f.x, f.y + 6, 1, { eye: '#5B3FCF', m: 'w' }));
    } else if (st === 2) {
      s.add(P(s, p, 'M148 198Q214 206 214 150Q212 120 194 116Q200 160 168 170Z', { f: gal }), stars([[200, 140, 4], [204, 170, 3], [184, 184, 3.5]]));
      s.add(ears(92));
      const f = sit2(s, p, belly, { hrx: 40, hry: 36 });
      s.add(P(s, p, 'M84 98Q86 66 120 64Q156 66 160 100Q164 130 150 150Q148 118 136 104Q118 92 84 98Z', { f: gal }), stars([[108, 76, 3.5], [144, 80, 4], [152, 120, 3]]));
      s.add(`<path d="${star5(120, 92, 5)}" fill="#FFE27A" stroke="#C99A2E" stroke-width="1.4"/>`, face(s, f.x, f.y + 6, .95, { eye: '#5B3FCF', m: 'smile' }));
    } else {
      aura(s, '#A890FF');
      s.add(P(s, p, 'M164 198Q240 206 236 136Q232 96 204 90Q214 148 176 168Z', { f: gal }), stars([[220, 120, 5], [226, 160, 4], [204, 186, 4], [210, 100, 3]]));
      s.add(ears(64));
      const f = sit3(s, p, belly, { hrx: 38, hry: 34 });
      s.add(P(s, p, 'M78 76Q76 34 120 32Q164 34 166 78Q172 130 154 164Q150 116 136 96Q116 84 78 76Z', { f: gal }), P(s, p, 'M76 78Q56 110 66 146Q78 120 92 108Z', { f: gal }), stars([[100, 46, 4], [146, 50, 5], [158, 100, 4], [154, 140, 3], [72, 120, 3.5]]));
      s.add(P(s, GOLD, 'M112 52L120 6L128 52Z', { w: 3 }), line('M114 42L126 36M115 30L125 24M117 18L123 14', GOLD.ln, 2));
      s.add(face(s, f.x, f.y + 6, .9, { eye: '#4A2FB8', m: 'smile', fierce: true }));
    }
  } });

/* ---------- 對外 API ---------- */
const BY_ID = Object.fromEntries(SPECIES.map(x => [x.id, x]));
function draw(id, stage = 1, o = {}) {
  const sp = BY_ID[id]; if (!sp) return '';
  const s = new Sprite();
  const ret = sp.draw(s, stage) || {};
  let svg = s.svg({ shadow: ret.shadow || [0, 38, 46, 58][stage], float: ret.float });
  if (o.shiny) svg = svg.replace('<svg ', '<svg style="filter:hue-rotate(150deg) saturate(1.15)" ');
  return svg;
}
const EGG_MARK = {
  guard: s => lock(s, 120, 140, 1.4),
  mech: s => `<path d="${gearD(120, 142, 17, 8)}" fill="${s.g(METAL)}" stroke="${METAL.ln}" stroke-width="3"/><circle cx="120" cy="142" r="6" fill="${METAL.ln}"/>`,
  harvest: s => leafS(s, LEAF, 120, 158, 34, 14, 0),
  kind: s => `<path d="${heart(120, 140, 1.6)}" fill="${s.g(PINKC)}" stroke="${PINKC.ln}" stroke-width="3"/>`,
  wise: s => `<path d="${star5(120, 142, 18)}" fill="${s.g(GOLD)}" stroke="${GOLD.ln}" stroke-width="3"/>`,
};
function egg(fam, o = {}) {
  const f = FAMILIES[fam], s = new Sprite(), p = pal(mix(f.color, '#ffffff', .55));
  s.add(P(s, p, 'M120 46C162 46 184 116 184 152C184 190 156 208 120 208C84 208 56 190 56 152C56 116 78 46 120 46Z'));
  s.add(`<path d="M58 150Q74 138 90 150T120 150T150 150T182 150" fill="none" stroke="${p.ln}" stroke-width="3" opacity=".5"/>`);
  s.add(`<ellipse cx="96" cy="84" rx="13" ry="8" fill="#fff" opacity=".7" transform="rotate(-30 96 84)"/>`, EGG_MARK[fam](s));
  if (o.crack >= 1) s.add(line('M84 118l12 10l10-12l12 10', INK, 3));
  if (o.crack >= 2) s.add(line('M130 100l10 12l12-8l8 12', INK, 3));
  return s.svg({ shadow: 44 });
}

root.Creatures = { SPECIES, FAMILIES, RARITY, draw, egg, byId: id => BY_ID[id] };
})(typeof window !== 'undefined' ? window : globalThis);
