import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Human, HumanOpts } from './human';
import { isMobile } from './render';

/** 店外的街景:人行道、馬路與車流、兩側與對面的商店建築、路燈行道樹、行人。
 *  純環境層,不影響遊戲邏輯;靜態物件不每幀更新,鏡頭拉近時整組被視錐剔除。 */

// ---------- 座標 ----------
export const STREET = {
  /** 店面牆所在的 z */
  storeFront: 21.6,
  walkA: { z0: 21.65, z1: 25.8 },
  road: { z0: 25.8, z1: 38.2 },
  walkB: { z0: 38.2, z1: 42.2 },
  /** 兩個行車方向的車道中心線 */
  laneA: 29.9, // 往 +x
  laneB: 34.1, // 往 -x
  cross: { x: 11, w: 3.2 },
  alley: { z0: -19.6, z1: -13.4 },
  extent: 105,
};

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a: number, b: number) => a + rand() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}
function tex(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 建築外牆:窗格,一部分亮燈(貼圖 + 自發光遮罩) */
function facadeTextures() {
  const W = 512;
  const H = 384;
  const a = canvas(W, H);
  const b = canvas(W, H);
  a.g.fillStyle = '#c9c4ba';
  a.g.fillRect(0, 0, W, H);
  b.g.fillStyle = '#000';
  b.g.fillRect(0, 0, W, H);
  const cols = 4;
  const rows = 3;
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.18;
      const y = r * ch + ch * 0.2;
      const w = cw * 0.64;
      const h = ch * 0.6;
      const lit = rand() < 0.42;
      a.g.fillStyle = 'rgba(70,64,56,0.55)';
      a.g.fillRect(x - 4, y - 4, w + 8, h + 8);
      a.g.fillStyle = lit ? '#ffd9a0' : '#28344a';
      a.g.fillRect(x, y, w, h);
      if (lit) {
        b.g.fillStyle = `rgb(${200 + Math.floor(rand() * 55)},${150 + Math.floor(rand() * 50)},${80})`;
        b.g.fillRect(x, y, w, h);
      }
      a.g.fillStyle = 'rgba(40,40,46,0.8)';
      a.g.fillRect(x + w / 2 - 1.5, y, 3, h);
      a.g.fillRect(x, y + h / 2 - 1.5, w, 3);
    }
    a.g.fillStyle = 'rgba(0,0,0,0.12)';
    a.g.fillRect(0, r * ch + ch - 6, W, 6);
  }
  return { map: tex(a.c, true), emissive: tex(b.c, true) };
}

/** 一樓店面:招牌、雨遮、亮燈的玻璃櫥窗 */
function shopTexture(title: string, sub: string, hue: number) {
  const W = 512;
  const H = 224;
  const { c, g } = canvas(W, H);
  g.fillStyle = '#20232b';
  g.fillRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 70, 0, H);
  bg.addColorStop(0, `hsl(${hue} 70% 62%)`);
  bg.addColorStop(1, `hsl(${(hue + 30) % 360} 60% 38%)`);
  g.fillStyle = bg;
  g.fillRect(14, 74, W - 28, H - 84);
  // 櫥窗裡的貨架剪影
  g.fillStyle = 'rgba(30,24,20,0.55)';
  for (let i = 0; i < 6; i++) {
    const x = 34 + i * 76;
    g.fillRect(x, 108, 54, 6);
    for (let k = 0; k < 3; k++) g.fillRect(x + 4 + k * 17, 86 + (k % 2) * 8, 12, 22);
    g.fillRect(x, 160, 54, 6);
    for (let k = 0; k < 3; k++) g.fillRect(x + 6 + k * 16, 140, 11, 20);
  }
  // 門
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(W / 2 - 34, 84, 68, H - 94);
  // 雨遮
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? `hsl(${hue} 80% 55%)` : '#f4f1ea';
    g.fillRect(i * (W / 16), 56, W / 16, 16);
  }
  // 招牌
  g.fillStyle = `hsl(${hue} 60% 16%)`;
  g.fillRect(0, 0, W, 54);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.shadowColor = `hsl(${hue} 100% 60%)`;
  g.shadowBlur = 12;
  g.font = 'bold 34px "Arial Black", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  g.fillText(`${title}  ${sub}`, W / 2, 28);
  return tex(c);
}

const SHOPS: [string, string, number][] = [
  ['7-24', '便利商店', 20], ['NOODLE', '牛肉麵', 12], ['CAFE', '咖啡館', 28], ['PHARMACY', '藥局', 140],
  ['BOOKS', '書店', 220], ['BREAKFAST', '早餐店', 45], ['TEA', '手搖飲', 160], ['LAUNDRY', '洗衣店', 195],
  ['HAIR', '美髮沙龍', 320], ['NET CAFE', '網咖', 265], ['BAKERY', '麵包坊', 35], ['FLOWER', '花店', 335],
];

// ---------- 車輛模型(合併成兩個網格:車身與燈) ----------
function part(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation | THREE.Color) {
  geo.translate(x, y, z);
  const n = geo.attributes.position.count;
  const col = color instanceof THREE.Color ? color : new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const wheel = (r: number, w: number) => {
  const g = new THREE.CylinderGeometry(r, r, w, 12);
  g.rotateX(Math.PI / 2);
  return g;
};

const carCache = new Map<string, { body: THREE.BufferGeometry; lights: THREE.BufferGeometry }>();
function carGeo(kind: 'car' | 'bus' | 'van', color: number) {
  const key = `${kind}:${color}`;
  let c = carCache.get(key);
  if (c) return c;
  const L = kind === 'bus' ? 10.5 : kind === 'van' ? 4.8 : 4.2;
  const H = kind === 'bus' ? 2.5 : kind === 'van' ? 1.5 : 0.62;
  const parts: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const body = new THREE.Color(color);
  const glass = new THREE.Color(0x1a2433);
  const dark = new THREE.Color(0x15161a);
  parts.push(part(box(L, H, 1.85), 0, 0.28 + H / 2, 0, body));
  if (kind === 'bus') {
    parts.push(part(box(L - 0.4, 0.8, 1.88), 0, 0.28 + H * 0.62, 0, glass));
    parts.push(part(box(L - 0.3, 0.08, 1.8), 0, 0.28 + H + 0.04, 0, new THREE.Color(0xe8e8e8)));
  } else if (kind === 'van') {
    parts.push(part(box(1.3, 0.55, 1.88), L / 2 - 0.9, 0.28 + H * 0.78, 0, glass));
  } else {
    parts.push(part(box(2.2, 0.5, 1.6), -0.25, 0.28 + H + 0.25, 0, body));
    parts.push(part(box(2.24, 0.34, 1.64), -0.25, 0.28 + H + 0.26, 0, glass));
    parts.push(part(box(1.9, 0.06, 1.5), -0.25, 0.28 + H + 0.53, 0, body));
  }
  const wx = kind === 'bus' ? [-3.4, 3.4] : [-L * 0.3, L * 0.3];
  for (const x of wx) for (const z of [-0.9, 0.9]) parts.push(part(wheel(0.34, 0.26), x, 0.34, z, dark));
  parts.push(part(box(0.12, 0.14, 1.7), L / 2, 0.38, 0, dark));
  parts.push(part(box(0.12, 0.14, 1.7), -L / 2, 0.38, 0, dark));
  const hl = new THREE.Color(2.6, 2.4, 1.8);
  const tl = new THREE.Color(2.4, 0.2, 0.2);
  for (const z of [-0.65, 0.65]) {
    lights.push(part(box(0.06, 0.16, 0.34), L / 2 + 0.02, 0.62, z, hl));
    lights.push(part(box(0.06, 0.14, 0.3), -L / 2 - 0.02, 0.62, z, tl));
  }
  c = { body: mergeGeometries(parts)!, lights: mergeGeometries(lights)! };
  carCache.set(key, c);
  return c;
}
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 });
const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
function makeCar(kind: 'car' | 'bus' | 'van', color: number) {
  const g = new THREE.Group();
  const geo = carGeo(kind, color);
  const m = new THREE.Mesh(geo.body, bodyMat);
  m.castShadow = false;
  g.add(m, new THREE.Mesh(geo.lights, lightMat));
  return g;
}

interface Vehicle {
  g: THREE.Group;
  dir: 1 | -1;
  len: number;
  x: number;
  v: number;
  vMax: number;
}
interface Walker {
  h: Human;
  state: 'walk' | 'toCurb' | 'wait' | 'cross';
  side: 'A' | 'B';
  dir: 1 | -1;
  x: number;
  z: number;
  speed: number;
  wantCross: boolean;
}

const CAR_COLORS = [0xd9d9d6, 0x1f2430, 0xc0392b, 0x2f6fbf, 0xe0b73a, 0x3e8f5a, 0x8a8f99, 0xf0f0f0, 0x6b3fa0];

export class Street {
  readonly group = new THREE.Group();
  private vehicles: Vehicle[] = [];
  private walkers: Walker[] = [];
  private t = 0;
  /** 為 true 時才更新車流與行人(鏡頭拉近到店內時暫停,省效能) */
  active = true;

  constructor(scene: THREE.Object3D) {
    this.build();
    scene.add(this.group);
  }

  /** 號誌:行人綠燈(車輛紅燈)的時段 */
  get pedGreen() {
    return this.t % 36 > 27;
  }

  // ---------- 靜態場景 ----------
  private build() {
    const g = this.group;
    const E = STREET.extent;
    const flat = (w: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      g.add(m);
      return m;
    };
    const paint = (c: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
      new THREE.MeshBasicMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, ...extra });

    // 地面(整片深色)
    flat(E * 3, E * 2.4, 0, -0.03, 20, new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 1 }));
    // 馬路
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x2b2e37, roughness: 0.92 });
    const rd = STREET.road;
    flat(E * 2, rd.z1 - rd.z0, 0, 0.006, (rd.z0 + rd.z1) / 2, asphalt);
    // 人行道
    const sw = new THREE.MeshStandardMaterial({ color: 0x9c9a94, roughness: 0.85 });
    for (const w of [STREET.walkA, STREET.walkB]) flat(E * 2, w.z1 - w.z0, 0, 0.012, (w.z0 + w.z1) / 2, sw);
    // 路緣
    const curb = new THREE.MeshStandardMaterial({ color: 0xb4b2ab, roughness: 0.8 });
    for (const z of [rd.z0 - 0.08, rd.z1 + 0.08]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(E * 2, 0.16, 0.16), curb);
      m.position.set(0, 0.06, z);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      g.add(m);
    }
    // 車道標線:雙黃線、停車格線、虛線
    flat(E * 2, 0.1, 0, 0.014, (STREET.laneA + STREET.laneB) / 2 - 0.1, paint(0xe0b73a));
    flat(E * 2, 0.1, 0, 0.014, (STREET.laneA + STREET.laneB) / 2 + 0.1, paint(0xe0b73a));
    flat(E * 2, 0.08, 0, 0.014, rd.z0 + 2.0, paint(0xdcdcd4));
    flat(E * 2, 0.08, 0, 0.014, rd.z1 - 2.0, paint(0xdcdcd4));
    // 斑馬線
    const cr = STREET.cross;
    for (let z = rd.z0 + 0.6; z < rd.z1 - 0.3; z += 1.0) flat(cr.w, 0.5, cr.x, 0.014, z, paint(0xf0f0ea));
    // 停止線
    flat(0.35, 4.1, cr.x - cr.w / 2 - 1.2, 0.014, STREET.laneA, paint(0xf0f0ea));
    flat(0.35, 4.1, cr.x + cr.w / 2 + 1.2, 0.014, STREET.laneB, paint(0xf0f0ea));
    // 後巷
    const al = STREET.alley;
    flat(E * 2, al.z1 - al.z0, 0, 0.006, (al.z0 + al.z1) / 2, asphalt);
    // 西側卸貨小巷(貨車從這裡進來)
    flat(70, 6.6, -70, 0.006, 9.8, asphalt);

    // ---------- 建築 ----------
    const fac = facadeTextures();
    const shops = SHOPS.map(([a, b, h]) => new THREE.MeshBasicMaterial({ map: shopTexture(a, b, h), toneMapped: false }));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.9 });
    const wallColors = [0xd8d0c0, 0xc9c4ba, 0xb8b2a6, 0xe0c9a8, 0xcbd3d8, 0xd9b8a0, 0xa9b3a0, 0xe6dccd];
    const sideMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    // 店面招牌依材質合併,大幅減少繪製次數
    const shopGeo: THREE.BufferGeometry[][] = SHOPS.map(() => []);
    const building = (x0: number, x1: number, zFront: number, depth: number, height: number, facing: 1 | -1, withShop: boolean) => {
      const w = x1 - x0;
      const color = pick(wallColors);
      const map = fac.map.clone();
      map.needsUpdate = true;
      map.repeat.set(w / 16, height / 9);
      const em = fac.emissive.clone();
      em.needsUpdate = true;
      em.repeat.copy(map.repeat);
      em.offset.set(rand(), rand());
      map.offset.copy(em.offset);
      const front = new THREE.MeshStandardMaterial({ map, color, emissiveMap: em, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.1, roughness: 0.85 });
      const side = sideMat(color);
      const mats = [side, side, roofMat, side, facing > 0 ? front : side, facing > 0 ? side : front];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, height, depth), mats);
      const zc = facing > 0 ? zFront - depth / 2 : zFront + depth / 2;
      m.position.set((x0 + x1) / 2, height / 2, zc);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      g.add(m);
      if (withShop) {
        const n = Math.max(1, Math.round(w / 8));
        const sw2 = w / n;
        for (let i = 0; i < n; i++) {
          const gi = Math.floor(rand() * shops.length);
          const pg = new THREE.PlaneGeometry(sw2 - 0.4, 3.6);
          if (facing < 0) pg.rotateY(Math.PI);
          pg.translate(x0 + sw2 * (i + 0.5), 1.9, zFront + facing * 0.06);
          shopGeo[gi].push(pg);
        }
      }
    };
    const row = (xa: number, xb: number, zFront: number, depth: number, facing: 1 | -1, shop: boolean, hLo = 6, hHi = 12, gap = 0.5) => {
      let x = xa;
      while (x < xb - 6) {
        const w = Math.min(rr(9, 17), xb - x);
        building(x, x + w, zFront, depth, rr(hLo, hHi), facing, shop);
        x += w + gap;
      }
    };
    row(17.2, E, STREET.storeFront, 34, 1, true);
    row(-E, -39, STREET.storeFront, 8.4, 1, true);
    row(-E, -39, 5.2, 16, 1, false);
    row(-E, E, STREET.walkB.z1, 14, -1, true);
    row(-E, E, STREET.alley.z0, 14, 1, false, 8, 16);
    shopGeo.forEach((list, i) => {
      if (list.length) g.add(new THREE.Mesh(mergeGeometries(list)!, shops[i]));
    });
    // 店後方到後巷之間的空地:一排低矮的圍牆與貨櫃
    const fence = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x575c6b, roughness: 0.8 }));
    fence.position.set(0, 0.8, STREET.alley.z1 + 0.2);
    g.add(fence);

    // ---------- 路燈與行道樹(實例化) ----------
    const lampXs: number[] = [];
    for (let x = -90; x <= 90; x += 14) lampXs.push(x);
    const poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 5.2, 0.14), new THREE.MeshStandardMaterial({ color: 0x3b414f, metalness: 0.6, roughness: 0.5 }), lampXs.length * 2);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.5, 1.6), toneMapped: false }), lampXs.length * 2);
    const m4 = new THREE.Matrix4();
    let li = 0;
    for (const [z, lean] of [[STREET.walkA.z1 - 0.4, -1], [STREET.walkB.z0 + 0.4, 1]] as const) {
      for (const x of lampXs) {
        m4.makeTranslation(x, 2.6, z);
        poles.setMatrixAt(li, m4);
        m4.makeTranslation(x, 5.2, z + lean * -0.4);
        heads.setMatrixAt(li, m4);
        li++;
      }
    }
    g.add(poles, heads);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 }), 64);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 64);
    let ti = 0;
    for (const z of [STREET.walkA.z1 - 0.5, STREET.walkB.z0 + 0.5]) {
      for (let x = -84; x <= 90; x += 14) {
        if (ti >= 64) break;
        if (z < 30 && x > 4 && x < 20) continue; // 斑馬線旁留空
        m4.makeTranslation(x, 1.1, z);
        trunk.setMatrixAt(ti, m4);
        m4.makeScale(1, 1.15, 1).setPosition(x, 3.0, z);
        crown.setMatrixAt(ti, m4);
        crown.setColorAt(ti, new THREE.Color().setHSL(0.3 + rand() * 0.06, 0.45, 0.22 + rand() * 0.08));
        ti++;
      }
    }
    trunk.count = ti;
    crown.count = ti;
    g.add(trunk, crown);

    // 公車亭
    const stop = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
    const frame = new THREE.MeshStandardMaterial({ color: 0x3b414f, metalness: 0.6, roughness: 0.4 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.5), frame);
    roof.position.set(0, 2.5, 0);
    stop.add(roof);
    for (const sx of [-1.7, 1.7]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.08), frame);
      p.position.set(sx, 1.25, 0.6);
      stop.add(p);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), glass);
    back.position.set(0, 1.3, -0.65);
    stop.add(back);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6 }));
    bench.position.set(0, 0.5, -0.4);
    stop.add(bench);
    stop.position.set(-26, 0, STREET.walkA.z1 - 1.5);
    g.add(stop);

    // 路邊停車:全部合併成一個車身網格與一個車燈網格
    const parkBody: THREE.BufferGeometry[] = [];
    const parkLight: THREE.BufferGeometry[] = [];
    const park = (x: number, z: number, rotY: number, kind: 'car' | 'van') => {
      const geo = carGeo(kind, pick(CAR_COLORS));
      const mtx = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, 0, z);
      parkBody.push(geo.body.clone().applyMatrix4(mtx));
      parkLight.push(geo.lights.clone().applyMatrix4(mtx));
    };
    for (let x = -80; x < 80; x += 6.6) {
      if (rand() < 0.45 || (x > 3 && x < 21)) continue;
      park(x + rr(-0.4, 0.4), STREET.road.z0 + 1.05, 0, rand() < 0.15 ? 'van' : 'car');
    }
    for (let x = -80; x < 80; x += 6.6) {
      if (rand() < 0.5) continue;
      park(x + rr(-0.4, 0.4), STREET.road.z1 - 1.05, Math.PI, 'car');
    }
    g.add(new THREE.Mesh(mergeGeometries(parkBody)!, bodyMat), new THREE.Mesh(mergeGeometries(parkLight)!, lightMat));

    // ---------- 車流 ----------
    const nPer = isMobile ? 6 : 10;
    for (const dir of [1, -1] as const) {
      for (let i = 0; i < nPer; i++) {
        const kind = rand() < 0.1 ? 'bus' : rand() < 0.18 ? 'van' : 'car';
        const grp = makeCar(kind, kind === 'bus' ? 0xd9532e : pick(CAR_COLORS));
        const len = kind === 'bus' ? 10.5 : kind === 'van' ? 4.8 : 4.2;
        const v: Vehicle = { g: grp, dir, len, x: -E + (i / nPer) * E * 2 + rr(-4, 4), v: 0, vMax: kind === 'bus' ? rr(5, 7) : rr(6, 10) };
        v.v = v.vMax;
        grp.rotation.y = dir > 0 ? 0 : Math.PI;
        g.add(grp);
        this.vehicles.push(v);
      }
    }

    // ---------- 行人 ----------
    const nWalk = isMobile ? 6 : 12;
    for (let i = 0; i < nWalk; i++) {
      const side: 'A' | 'B' = i % 2 ? 'A' : 'B';
      const opts: HumanOpts = {
        skin: pick([0xf2c9a5, 0xe0ac86, 0xc68863, 0x8d5a3c]),
        shirt: pick([0x3b6fd1, 0xc24b47, 0x2f8f6a, 0xdf9a3e, 0x56606e, 0xd9759d, 0xe8e2d4]),
        pants: pick([0x1f2433, 0x3b4252, 0x5c4a3a]),
        hair: pick([0x1a1410, 0x3a2a1c, 0x6b4a2a, 0x222222]),
        scale: rr(0.92, 1.06),
        kid: false,
        accessory: pick(['none', 'backpack', 'cap']),
        sleeve: 'short',
        hairStyle: pick(['short', 'long', 'pony', 'bun', 'curly']),
        shoes: 0x2a2a2e,
      };
      const h = new Human(opts);
      h.setLod(true);
      const z = side === 'A' ? rr(22.6, 24.6) : rr(39.3, 41.2);
      const w: Walker = { h, state: 'walk', side, dir: rand() < 0.5 ? 1 : -1, x: rr(-55, 55), z, speed: rr(1.0, 1.5), wantCross: rand() < 0.5 };
      h.group.position.set(w.x, side === 'A' ? 0.012 : 0.012, z);
      this.group.add(h.group);
      this.walkers.push(w);
    }
  }

  // ---------- 每幀 ----------
  update(dt: number, nearCam = false) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.updateTraffic(dt);
    this.updateWalkers(dt, nearCam);
  }

  private updateTraffic(dt: number) {
    const E = STREET.extent;
    const red = !this.pedGreen ? false : true; // 行人綠燈時車輛紅燈
    const cr = STREET.cross;
    const stopA = cr.x - cr.w / 2 - 1.6;
    const stopB = cr.x + cr.w / 2 + 1.6;
    for (const dir of [1, -1] as const) {
      const lane = this.vehicles.filter((v) => v.dir === dir).sort((a, b) => (b.x - a.x) * dir);
      for (let i = 0; i < lane.length; i++) {
        const v = lane[i];
        let want = v.vMax;
        const lead = i > 0 ? lane[i - 1] : null;
        if (lead) {
          const gap = (lead.x - v.x) * dir - (lead.len + v.len) / 2;
          if (gap < 14) want = Math.min(want, Math.max(0, lead.v * Math.min(1, (gap - 1.5) / 8)));
        }
        if (red) {
          const line = dir > 0 ? stopA : stopB;
          const front = v.x + (dir * v.len) / 2;
          const d = (line - front) * dir;
          if (d > -0.3 && d < 16) want = Math.min(want, Math.max(0, d - 0.5) * 0.9);
        }
        const dv = want - v.v;
        v.v += Math.max(-9 * dt, Math.min(3 * dt, dv));
        v.x += dir * v.v * dt;
        if (v.x * dir > E) {
          // 繞回另一端(前方有車就先等一下)
          const tail = lane[lane.length - 1];
          if (tail && Math.abs(tail.x + dir * E) < 22) {
            v.x = tail.x - dir * (tail.len + 12);
          } else v.x = -dir * E;
          v.vMax = v.len > 8 ? rr(5, 7) : rr(6, 10);
        }
        v.g.position.set(v.x, 0, dir > 0 ? STREET.laneA : STREET.laneB);
      }
    }
  }

  private updateWalkers(dt: number, near: boolean) {
    const cr = STREET.cross;
    for (const w of this.walkers) {
      const pos = w.h.group.position;
      let moving = true;
      if (w.state === 'walk') {
        w.x += w.dir * w.speed * dt;
        if (w.x > 60 || w.x < -60) w.dir = (w.dir * -1) as 1 | -1;
        // 走到斑馬線附近、想過馬路就轉成過街
        if (w.wantCross && Math.abs(w.x - cr.x) < 0.35) {
          w.state = 'toCurb';
          w.x = cr.x + (w.side === 'A' ? -0.9 : -0.9) + 0.9;
        }
        pos.set(w.x, 0.012, w.z);
        w.h.group.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (w.state === 'toCurb') {
        const curbZ = w.side === 'A' ? STREET.walkA.z1 - 0.3 : STREET.walkB.z0 + 0.3;
        const dz = curbZ - w.z;
        w.z += Math.sign(dz) * Math.min(Math.abs(dz), w.speed * dt);
        pos.set(w.x, 0.012, w.z);
        w.h.group.rotation.y = dz > 0 ? 0 : Math.PI;
        if (Math.abs(dz) < 0.05) w.state = 'wait';
      } else if (w.state === 'wait') {
        moving = false;
        if (this.pedGreen) w.state = 'cross';
      } else {
        const targetZ = w.side === 'A' ? STREET.walkB.z0 + 0.4 : STREET.walkA.z1 - 0.4;
        const dz = targetZ - w.z;
        w.z += Math.sign(dz) * Math.min(Math.abs(dz), w.speed * 1.15 * dt);
        pos.set(w.x, 0.012, w.z);
        w.h.group.rotation.y = dz > 0 ? 0 : Math.PI;
        if (Math.abs(dz) < 0.05) {
          w.side = w.side === 'A' ? 'B' : 'A';
          w.state = 'walk';
          w.wantCross = rand() < 0.4;
          w.dir = rand() < 0.5 ? 1 : -1;
          w.x += w.dir * 1.2;
          w.z = w.side === 'A' ? rr(22.6, 24.4) : rr(39.4, 41.0);
        }
      }
      w.h.setLod(!near);
      w.h.update(dt, moving ? 'walk' : 'idle');
    }
  }
}
