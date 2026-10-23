import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 毛絨表面的凹凸貼圖:大量短髮絲 */
export function furBumpTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const x = rnd(0, 256);
    const y = rnd(0, 256);
    const a = rnd(0, Math.PI * 2);
    const l = rnd(4, 11);
    const v = Math.floor(rnd(60, 220));
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = rnd(1, 2);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 2.5);
  return t;
}

/** 夾物區地板:菱形防滑鋼板 */
function make_diamondPlateTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#2b3150';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const cx = x * 32 + (y % 2 ? 16 : 0) + 8;
      const cy = y * 32 + 16;
      g.save();
      g.translate(cx, cy);
      g.rotate(y % 2 ? Math.PI / 4 : -Math.PI / 4);
      const grad = g.createLinearGradient(-10, 0, 10, 0);
      grad.addColorStop(0, '#69739e');
      grad.addColorStop(0.5, '#a3add4');
      grad.addColorStop(1, '#4a5378');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, 11, 3.2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 4);
  return t;
}

/** 店內地板:深色拋光磁磚 */
export function tileFloorTexture() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#12101f';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const v = (x + y) % 2 ? 22 : 30;
      g.fillStyle = `rgb(${v},${v - 2},${v + 12})`;
      g.fillRect(x * 256 + 3, y * 256 + 3, 250, 250);
    }
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.01, 0.04)})`;
    g.fillRect(rnd(0, 512), rnd(0, 512), rnd(1, 3), rnd(1, 3));
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  return t;
}

/** 霓虹字:透明底,發光字 */
export function neonTexture(text: string, color: string, w = 1024, h = 256, font = 'bold 150px "Arial Black", sans-serif', sub?: string) {
  const { c, g } = canvas(w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const yMain = sub ? h * 0.42 : h / 2;
  g.font = font;
  for (const [blur, alpha] of [[40, 0.9], [20, 0.9], [8, 1]] as const) {
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.fillText(text, w / 2, yMain);
  }
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(text, w / 2, yMain);
  if (sub) {
    g.font = `bold ${Math.floor(h * 0.17)}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = '#ffffff';
    g.fillText(sub, w / 2, h * 0.85);
  }
  return tex(c);
}

/** 機台頂部招牌 */
function make_marqueeTexture(title: string, sub: string, hue: number) {
  const { c, g } = canvas(1024, 384);
  const bg = g.createLinearGradient(0, 0, 1024, 384);
  bg.addColorStop(0, `hsl(${(hue + 250) % 360} 70% 14%)`);
  bg.addColorStop(0.5, `hsl(${hue} 60% 26%)`);
  bg.addColorStop(1, `hsl(${(hue + 40) % 360} 65% 18%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 384);
  const rg = g.createRadialGradient(512, 190, 10, 512, 190, 520);
  rg.addColorStop(0, `hsla(${hue},100%,62%,0.55)`);
  rg.addColorStop(1, `hsla(${hue},100%,62%,0)`);
  g.fillStyle = rg;
  g.fillRect(0, 0, 1024, 384);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.9)})`;
    g.beginPath();
    g.arc(rnd(0, 1024), rnd(0, 384), rnd(1, 3.5), 0, Math.PI * 2);
    g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = title.length > 7 ? 150 : 190;
  g.font = `bold ${size}px "Arial Black", sans-serif`;
  g.shadowColor = `hsl(${hue} 100% 60%)`;
  g.shadowBlur = 36;
  g.fillStyle = '#fff';
  g.fillText(title, 512, 150);
  g.shadowBlur = 0;
  g.lineWidth = 6;
  g.strokeStyle = `hsl(${(hue + 150) % 360} 100% 70%)`;
  g.strokeText(title, 512, 150);
  g.font = 'bold 70px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  g.shadowColor = '#41e8ff';
  g.shadowBlur = 20;
  g.fillStyle = '#fff6b8';
  g.fillText(sub, 512, 296);
  return tex(c);
}

/** 機台後方的星空背板 */
function make_backdropTexture() {
  const { c, g } = canvas(512, 512);
  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#1d1450');
  bg.addColorStop(1, '#7a2a8c');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.9)})`;
    g.beginPath();
    g.arc(rnd(0, 512), rnd(0, 512), rnd(0.8, 3), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(120,230,255,0.35)';
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(256, 560, 120 + i * 60, Math.PI, Math.PI * 2);
    g.stroke();
  }
  return tex(c);
}

/** 玻璃反光條 */
function make_glareTexture() {
  const { c, g } = canvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  g.save();
  g.translate(256, 256);
  g.rotate(-0.55);
  for (const [off, wd, a] of [[-120, 70, 0.55], [10, 26, 0.4], [70, 14, 0.3]] as const) {
    const grad = g.createLinearGradient(off - wd, 0, off + wd, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(off - wd, -500, wd * 2, 1000);
  }
  g.restore();
  return tex(c);
}

/** 圓形光暈(用於地面燈光溢出、閃光) */
export function glowTexture(color: string) {
  const { c, g } = canvas(256, 256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.25)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

/** 旁邊機台的螢幕畫面 */
export function screenTexture(hue: number) {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#05030c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `hsl(${(hue + i * 14) % 360} 90% ${40 + (i % 3) * 12}%)`;
    g.fillRect(rnd(0, 200), i * 18 + 4, rnd(30, 150), 10);
  }
  return tex(c);
}

/** 顯示用的小螢幕(餘額)。回傳畫布以便重繪 */
export function makeDisplay() {
  const { c, g } = canvas(256, 96);
  const t = tex(c);
  const draw = (label: string, value: string) => {
    g.fillStyle = '#04120d';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#40ffb0';
    g.shadowColor = '#40ffb0';
    g.shadowBlur = 10;
    g.font = 'bold 26px "Courier New", monospace';
    g.textAlign = 'left';
    g.fillText(label, 14, 34);
    g.font = 'bold 44px "Courier New", monospace';
    g.textAlign = 'right';
    g.fillText(value, 242, 80);
    g.shadowBlur = 0;
    t.needsUpdate = true;
  };
  return { texture: t, draw };
}

// 這些貼圖整店共用,切換機台細節層時不需要重畫
const memo = new Map<string, THREE.CanvasTexture>();
const cached = (key: string, make: () => THREE.CanvasTexture) => {
  let t = memo.get(key);
  if (!t) {
    t = make();
    memo.set(key, t);
  }
  return t;
};
export const diamondPlateTexture = () => cached('diamond', make_diamondPlateTexture);
export const backdropTexture = () => cached('backdrop', make_backdropTexture);
export const glareTexture = () => cached('glare', make_glareTexture);
export const marqueeTexture = (title = 'CLAW CLUB', sub = '夾 娃 娃 樂 園', hue = 320) => cached(`marquee:${title}:${hue}`, () => make_marqueeTexture(title, sub, hue));

/** 遊樂場常見的圖案地毯:深色底、低對比的幾何圖形 */
export function carpetTexture() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#2a2a42';
  g.fillRect(0, 0, 512, 512);
  const cols = ['#c64e7c', '#2f9fb8', '#d6a93c', '#6c58c8', '#37a778'];
  for (let i = 0; i < 90; i++) {
    const x = rnd(0, 512);
    const y = rnd(0, 512);
    const s = rnd(8, 22);
    g.save();
    g.translate(x, y);
    g.rotate(rnd(0, Math.PI));
    g.globalAlpha = rnd(0.2, 0.42);
    g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) g.fillRect(-s / 2, -s / 2, s, s);
    else if (kind === 1) {
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(s, s);
      g.lineTo(-s, s);
      g.closePath();
      g.fill();
    } else {
      g.beginPath();
      g.arc(0, 0, s / 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // 織紋雜訊
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.01, 0.045)})`;
    g.fillRect(rnd(0, 512), rnd(0, 512), 1.5, 1.5);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 走道與前廳的拋光磁磚:淺暖灰、細縫 */
export function aisleTileTexture() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#b9b4ac';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 176 + Math.floor(rnd(-8, 8));
      g.fillStyle = `rgb(${v + 6},${v},${v - 8})`;
      g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      // 大理石紋
      g.strokeStyle = `rgba(120,115,108,${rnd(0.05, 0.12)})`;
      g.lineWidth = rnd(0.5, 1.5);
      g.beginPath();
      g.moveTo(x * 128 + rnd(0, 128), y * 128);
      g.bezierCurveTo(x * 128 + rnd(0, 128), y * 128 + 40, x * 128 + rnd(0, 128), y * 128 + 90, x * 128 + rnd(0, 128), y * 128 + 128);
      g.stroke();
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 牆上的海報 */
export function posterTexture(title: string, sub: string, hue: number) {
  const { c, g } = canvas(256, 384);
  const bg = g.createLinearGradient(0, 0, 0, 384);
  bg.addColorStop(0, `hsl(${hue} 55% 38%)`);
  bg.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 18%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.arc(128, 170, 90, 0, Math.PI * 2);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.font = 'bold 58px "Arial Black", sans-serif';
  g.fillText(title, 128, 180);
  g.font = 'bold 26px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  g.fillStyle = '#ffe9a8';
  g.fillText(sub, 128, 240);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 240, 368);
  return tex(c);
}

// ---------- 台灣標準機型的卡通印花櫃身 ----------
function drawBear(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, fur: string, belly: string) {
  g.fillStyle = fur;
  for (const dx of [-0.62, 0.62]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.7 * s, 0.32 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = belly;
  g.beginPath();
  g.ellipse(cx, cy + 0.3 * s, 0.5 * s, 0.38 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1d1a';
  for (const dx of [-0.36, 0.36]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.15 * s, 0.1 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.ellipse(cx, cy + 0.12 * s, 0.14 * s, 0.1 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2b1d1a';
  g.lineWidth = 0.05 * s;
  g.beginPath();
  g.arc(cx, cy + 0.22 * s, 0.2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
}

function drawBee(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (const dx of [-0.7, 0.7]) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy - 0.7 * s, 0.5 * s, 0.32 * s, dx * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.ellipse(cx, cy, 0.85 * s, 0.75 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1d1a';
  for (const y of [-0.05, 0.4]) g.fillRect(cx - 0.8 * s, cy + y * s, 1.6 * s, 0.17 * s);
  g.fillStyle = '#fff';
  for (const dx of [-0.3, 0.3]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.35 * s, 0.17 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#2b1d1a';
  for (const dx of [-0.3, 0.3]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.33 * s, 0.07 * s, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBunny(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.fillStyle = '#fdf6f8';
  for (const dx of [-0.38, 0.38]) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy - 1.15 * s, 0.22 * s, 0.7 * s, dx * 0.25, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f7b9cc';
  for (const dx of [-0.38, 0.38]) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy - 1.12 * s, 0.1 * s, 0.5 * s, dx * 0.25, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#fdf6f8';
  g.beginPath();
  g.arc(cx, cy, 0.9 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1d1a';
  for (const dx of [-0.33, 0.33]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.1 * s, 0.09 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f48fb1';
  g.beginPath();
  g.arc(cx, cy + 0.12 * s, 0.09 * s, 0, Math.PI * 2);
  g.fill();
}

function drawCat(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.fillStyle = '#9db4d8';
  for (const dx of [-0.6, 0.6]) {
    g.beginPath();
    g.moveTo(cx + dx * s, cy - 0.95 * s);
    g.lineTo(cx + dx * 1.3 * s, cy - 0.2 * s);
    g.lineTo(cx + dx * 0.2 * s, cy - 0.5 * s);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, 0.95 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b1d1a';
  for (const dx of [-0.35, 0.35]) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy - 0.1 * s, 0.09 * s, 0.14 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#2b1d1a';
  g.lineWidth = 0.035 * s;
  for (const dx of [-1, 1]) for (const dy of [0, 0.12]) {
    g.beginPath();
    g.moveTo(cx + dx * 0.4 * s, cy + (0.2 + dy) * s);
    g.lineTo(cx + dx * 1.1 * s, cy + (0.15 + dy * 2) * s);
    g.stroke();
  }
}

/** 櫃身印花:氣球、星星、彩帶與吉祥物 */
function make_panelTexture(hue: number, mascot: number) {
  const { c, g } = canvas(512, 512);
  const bg = g.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, `hsl(${hue} 85% 62%)`);
  bg.addColorStop(1, `hsl(${(hue + 35) % 360} 90% 76%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);
  // 放射線條
  g.save();
  g.translate(256, 300);
  for (let i = 0; i < 18; i++) {
    g.rotate((Math.PI * 2) / 18);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(520, -26);
    g.lineTo(520, 26);
    g.closePath();
    g.fill();
  }
  g.restore();
  // 氣球
  const balloon = ['#ff4f6d', '#4fa8ff', '#ffd23f', '#58d68d', '#b57bff', '#ff9a3c'];
  for (let i = 0; i < 9; i++) {
    const x = rnd(30, 482);
    const y = rnd(30, 250);
    const r = rnd(24, 44);
    g.strokeStyle = 'rgba(60,40,40,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y + r);
    g.quadraticCurveTo(x + rnd(-14, 14), y + r + 40, x + rnd(-10, 10), y + r + 78);
    g.stroke();
    g.fillStyle = balloon[i % balloon.length];
    g.beginPath();
    g.ellipse(x, y, r * 0.86, r, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2);
    g.fill();
  }
  // 星星與彩點
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.5, 0.95)})`;
    const x = rnd(0, 512);
    const y = rnd(0, 512);
    const s = rnd(3, 9);
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const rr = k % 2 ? s * 0.45 : s;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  // 吉祥物
  const m = mascot % 4;
  if (m === 0) drawBear(g, 256, 330, 110, '#b9794a', '#e8c9a0');
  else if (m === 1) drawBee(g, 256, 330, 118);
  else if (m === 2) drawBunny(g, 256, 340, 112);
  else drawCat(g, 256, 335, 112);
  return tex(c);
}

/** 夾物區地板的粉紅絨布 */
function make_feltTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#f4a9c4';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = Math.floor(rnd(205, 255));
    g.fillStyle = `rgba(${v},${Math.floor(v * 0.66)},${Math.floor(v * 0.78)},${rnd(0.15, 0.5)})`;
    g.fillRect(rnd(0, 256), rnd(0, 256), 2, 2);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

export const panelTexture = (hue: number, mascot: number) => cached(`panel:${hue}:${mascot}`, () => make_panelTexture(hue, mascot));
export const feltTexture = () => cached('felt', make_feltTexture);
