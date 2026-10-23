import type { Character } from './characters';

export type Expression = 'neutral' | 'happy' | 'sad';

const cache = new Map<string, string>();
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
function shade(n: number, f: number) {
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/** 以程式繪製的插畫風肖像(依 Look 與表情),回傳 dataURL。結果有快取。 */
export function portrait(ch: Character, expr: Expression = 'neutral', size = 256): string {
  const key = `${ch.id}:${expr}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 320;
  const g = c.getContext('2d')!;
  const L = ch.look;
  const skin = css(L.skin);
  const skinDark = shade(L.skin, 0.88);
  const hair = css(L.hair);
  const hairDark = shade(L.hair, 0.7);
  const shirt = css(L.shirt);

  // 背景:角色代表色的放射光與圖案
  const bg = g.createLinearGradient(0, 0, 320, 320);
  bg.addColorStop(0, shade(ch.accent, 0.55));
  bg.addColorStop(1, shade(ch.accent, 1.05));
  g.fillStyle = bg;
  g.fillRect(0, 0, 320, 320);
  g.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(40 + i * 56, 40 + ((i * 53) % 90), 22 + (i % 3) * 10, 0, Math.PI * 2);
    g.fill();
  }
  const glow = g.createRadialGradient(160, 150, 10, 160, 150, 190);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 320, 320);

  // 長髮後層
  if (L.hairStyle === 'long') {
    g.fillStyle = hairDark;
    g.beginPath();
    g.moveTo(70, 150);
    g.quadraticCurveTo(60, 300, 100, 320);
    g.lineTo(220, 320);
    g.quadraticCurveTo(260, 300, 250, 150);
    g.closePath();
    g.fill();
  }
  if (L.hairStyle === 'pony') {
    g.fillStyle = hairDark;
    g.beginPath();
    g.ellipse(250, 170, 20, 62, -0.25, 0, Math.PI * 2);
    g.fill();
  }

  // 肩膀與服裝
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(20, 320);
  g.quadraticCurveTo(30, 238, 118, 226);
  g.lineTo(202, 226);
  g.quadraticCurveTo(290, 238, 300, 320);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.moveTo(20, 320);
  g.quadraticCurveTo(30, 260, 70, 244);
  g.lineTo(60, 320);
  g.closePath();
  g.fill();

  // 頸部
  g.fillStyle = skinDark;
  g.fillRect(138, 196, 44, 44);
  g.fillStyle = skin;

  // 服裝細節
  const outfit = L.outfit;
  if (outfit === 'uniform') {
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.moveTo(112, 320);
    g.lineTo(122, 252);
    g.lineTo(198, 252);
    g.lineTo(208, 320);
    g.closePath();
    g.fill();
    g.fillStyle = css(ch.accent);
    g.fillRect(168, 270, 26, 12);
    g.fillStyle = '#fff';
    g.fillRect(172, 274, 18, 4);
    g.fillStyle = shade(L.shirt, 1.25);
    g.beginPath();
    g.moveTo(138, 226);
    g.lineTo(160, 258);
    g.lineTo(182, 226);
    g.closePath();
    g.fill();
  } else if (outfit === 'suit') {
    g.fillStyle = '#f2f2f2';
    g.beginPath();
    g.moveTo(138, 226);
    g.lineTo(160, 300);
    g.lineTo(182, 226);
    g.closePath();
    g.fill();
    g.fillStyle = '#b3262d';
    g.beginPath();
    g.moveTo(154, 240);
    g.lineTo(166, 240);
    g.lineTo(170, 300);
    g.lineTo(160, 312);
    g.lineTo(150, 300);
    g.closePath();
    g.fill();
    g.fillStyle = shade(L.shirt, 0.8);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(160 + s * 22, 226);
      g.lineTo(160 + s * 58, 300);
      g.lineTo(160 + s * 10, 320);
      g.closePath();
      g.fill();
    }
  } else if (outfit === 'hoodie') {
    g.strokeStyle = shade(L.shirt, 0.82);
    g.lineWidth = 26;
    g.beginPath();
    g.arc(160, 232, 56, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.fillStyle = '#fff';
    g.fillRect(146, 262, 3, 50);
    g.fillRect(171, 262, 3, 50);
  } else if (outfit === 'jacket') {
    g.fillStyle = shade(L.shirt, 0.82);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(160 + s * 20, 226);
      g.lineTo(160 + s * 62, 296);
      g.lineTo(160 + s * 8, 320);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#eee';
    g.fillRect(146, 240, 28, 80);
  } else if (outfit === 'dress') {
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(160, 232, 36, 20, 0, 0, Math.PI);
    g.fill();
  } else {
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(160, 228, 28, 14, 0, 0, Math.PI);
    g.fill();
  }

  // 耳朵
  g.fillStyle = skinDark;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(160 + s * 88, 160, 12, 20, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 臉
  const faceGrad = g.createLinearGradient(100, 80, 220, 240);
  faceGrad.addColorStop(0, skin);
  faceGrad.addColorStop(1, skinDark);
  g.fillStyle = faceGrad;
  g.beginPath();
  if (L.face === 'round') g.ellipse(160, 150, 86, 88, 0, 0, Math.PI * 2);
  else if (L.face === 'oval') g.ellipse(160, 152, 78, 100, 0, 0, Math.PI * 2);
  else {
    const x = 78;
    const y = 62;
    const w = 164;
    const h = 186;
    const r = 52;
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r - 12);
    g.quadraticCurveTo(x + w, y + h, x + w - r - 6, y + h);
    g.lineTo(x + r + 6, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r - 12);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
  }
  g.fill();

  // 腮紅
  if (L.extra === 'blush' || expr === 'happy') {
    g.fillStyle = 'rgba(255,120,130,0.3)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(160 + s * 52, 188, 20, 11, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 頭髮(前層)
  g.fillStyle = hair;
  const hs = L.hairStyle;
  if (hs !== 'bald') {
    g.beginPath();
    g.moveTo(66, 150);
    g.bezierCurveTo(60, 60, 130, 40, 160, 40);
    g.bezierCurveTo(200, 40, 262, 62, 254, 150);
    g.bezierCurveTo(240, 118, 214, 100, 192, 96);
    g.bezierCurveTo(150, 120, 110, 112, 90, 100);
    g.bezierCurveTo(78, 118, 70, 136, 66, 150);
    g.closePath();
    g.fill();
    g.fillStyle = hairDark;
    g.beginPath();
    g.ellipse(190, 66, 36, 12, -0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hair;
    if (hs === 'curly') {
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(86 + i * 18.5, 66 + Math.abs(4 - i) * 5 + (i % 2) * 6, 22, 0, Math.PI * 2);
        g.fill();
      }
    } else if (hs === 'bun') {
      g.beginPath();
      g.arc(160, 36, 30, 0, Math.PI * 2);
      g.fill();
    } else if (hs === 'long') {
      g.beginPath();
      g.moveTo(66, 150);
      g.quadraticCurveTo(58, 250, 90, 270);
      g.lineTo(98, 160);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(254, 150);
      g.quadraticCurveTo(262, 250, 230, 270);
      g.lineTo(222, 160);
      g.closePath();
      g.fill();
    }
  } else {
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(160, 150, 90, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }

  // 眉毛
  g.strokeStyle = hairDark;
  g.lineCap = 'round';
  const bw = L.brows === 'thick' ? 9 : L.brows === 'thin' ? 4 : 6;
  g.lineWidth = bw;
  const tilt = expr === 'sad' ? -8 : expr === 'happy' ? 4 : 0;
  for (const s of [-1, 1]) {
    g.beginPath();
    const bx = 160 + s * 40;
    const by = L.eyes === 'big' ? 124 : 130;
    if (L.brows === 'flat') {
      g.moveTo(bx - 20, by + s * -tilt * 0.3);
      g.lineTo(bx + 20, by + s * tilt * 0.3);
    } else {
      g.moveTo(bx - 20, by + 4 + s * tilt * 0.5);
      g.quadraticCurveTo(bx, by - 8, bx + 20, by + 2 - s * tilt * 0.5);
    }
    g.stroke();
  }

  // 眼睛
  for (const s of [-1, 1]) {
    const ex = 160 + s * 40;
    const ey = 156;
    if (L.eyes === 'narrow') {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(ex, ey, 17, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2b1d1a';
      g.beginPath();
      g.ellipse(ex, ey, 8, 7.5, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      const rx = L.eyes === 'big' ? 20 : 16;
      const ry = L.eyes === 'big' ? 22 : 15;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3a2a22';
      g.beginPath();
      g.ellipse(ex, ey + 1, rx * 0.58, ry * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ex - rx * 0.2, ey - ry * 0.25, rx * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    if (expr === 'happy') {
      g.strokeStyle = skinDark;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(ex, ey + 10, 18, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  }

  // 鼻子
  g.strokeStyle = shade(L.skin, 0.72);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(160, 168);
  g.quadraticCurveTo(152, 190, 162, 194);
  g.stroke();

  // 嘴巴
  const mouth = expr === 'happy' ? 'grin' : expr === 'sad' ? 'sad' : L.mouth;
  g.strokeStyle = '#8a3b3b';
  g.fillStyle = '#7a2d34';
  g.lineWidth = 5;
  g.beginPath();
  if (mouth === 'grin') {
    g.moveTo(130, 212);
    g.quadraticCurveTo(160, 252, 190, 212);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(142, 214, 36, 8);
  } else if (mouth === 'smile') {
    g.arc(160, 204, 30, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
  } else if (mouth === 'sad') {
    g.arc(160, 238, 24, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
  } else {
    g.moveTo(140, 218);
    g.lineTo(180, 218);
    g.stroke();
  }

  // 鬍子
  if (L.extra === 'beard') {
    g.fillStyle = hairDark;
    g.beginPath();
    g.moveTo(100, 200);
    g.quadraticCurveTo(160, 290, 220, 200);
    g.quadraticCurveTo(160, 232, 100, 200);
    g.fill();
  }

  // 眼鏡
  if (L.glasses) {
    g.strokeStyle = '#1b1c22';
    g.lineWidth = 5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.roundRect(160 + s * 40 - 26, 156 - 21, 52, 42, 14);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(160 - 14, 154);
    g.lineTo(160 + 14, 154);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    for (const s of [-1, 1]) g.fillRect(160 + s * 40 - 22, 140, 18, 8);
  }

  // 帽子、蝴蝶結、髮帶
  if (L.extra === 'cap' || outfit === 'uniform') {
    const cap = L.extra === 'cap' ? shade(L.shirt, 0.9) : css(ch.accent);
    g.fillStyle = cap;
    g.beginPath();
    g.moveTo(70, 108);
    g.bezierCurveTo(70, 30, 250, 30, 250, 108);
    g.closePath();
    g.fill();
    g.fillStyle = shade(parseInt(cap.slice(1), 16) || L.shirt, 0.75);
    g.beginPath();
    g.ellipse(160, 108, 110, 12, 0, 0, Math.PI);
    g.fill();
    g.fillRect(110, 104, 100, 8);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(160, 66, 11, 0, Math.PI * 2);
    g.fill();
  } else if (L.extra === 'bow') {
    g.fillStyle = '#ff5fa2';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(160 + s * 74, 68, 22, 0, Math.PI * 2);
      g.fill();
    }
  } else if (L.extra === 'headband') {
    g.strokeStyle = css(ch.accent);
    g.lineWidth = 12;
    g.beginPath();
    g.arc(160, 150, 90, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
  }

  // 圓框(讓頭像在小尺寸時更清楚)
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 8;
  g.strokeRect(0, 0, 320, 320);

  const out = document.createElement('canvas');
  out.width = out.height = size;
  out.getContext('2d')!.drawImage(c, 0, 0, size, size);
  const url = out.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
