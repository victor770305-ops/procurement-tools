import * as THREE from 'three';
import { COUNTER, MACHINE_X, SHELF_X, THEMES } from './layout';
import { glowTexture, neonTexture, screenTexture, tileFloorTexture } from './textures';

export interface Store {
  group: THREE.Group;
  /** 依倉庫庫存顯示貨架上的紙箱數量 */
  setShelfStock(n: number): void;
}

const paint = (c: number) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15 });

/** 店內場景:地板、牆面、霓虹、櫃台、倉庫貨架、入口、背景機台 */
export function buildStore(): Store {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);

  // ---------- 地板 ----------
  const floorTex = tileFloorTexture();
  floorTex.repeat.set(7, 10);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 44),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.2, metalness: 0.15, envMapIntensity: 1.2 }),
  );
  floor.position.z = 7;
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // ---------- 牆 ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x151228, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 9), wallMat);
  back.position.set(0, 4.5, -4.4);
  g.add(back);
  for (let i = -8; i <= 8; i++) {
    box(0.9, 6, 0.1, new THREE.MeshStandardMaterial({ color: 0x1b1738, roughness: 0.5, metalness: 0.2 }), i * 1.4, 3.2, -4.3);
  }
  // 右牆(留出入口)與左牆
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x120f24, roughness: 0.8 });
  box(0.3, 4.2, 8.6, sideMat, 8.2, 2.1, 0.1);
  box(0.3, 4.2, 6.0, sideMat, 8.2, 2.1, 10.0);
  box(0.3, 1.4, 1.6, sideMat, 8.2, 3.5, 5.0);
  box(0.3, 4.2, 14, sideMat, -8.2, 2.1, 2.6);

  // 入口門框與 OPEN 招牌
  const frame = paint(0xff3d9a);
  box(0.4, 2.8, 0.14, frame, 8.2, 1.4, 4.1);
  box(0.4, 2.8, 0.14, frame, 8.2, 1.4, 5.9);
  const open = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.45),
    new THREE.MeshBasicMaterial({ map: neonTexture('OPEN', '#41e8ff', 512, 160, 'bold 110px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  open.position.set(8.03, 3.45, 5.0);
  open.rotation.y = -Math.PI / 2;
  g.add(open);
  const doorLight = new THREE.PointLight(0x9fe8ff, 6, 6, 2);
  doorLight.position.set(7.6, 2.4, 5.0);
  g.add(doorLight);

  // 後牆霓虹
  const addNeon = (text: string, color: string, x: number, y: number, w: number, h: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: neonTexture(text, color, 1024, 256, 'bold 160px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.set(x, y, -4.2);
    g.add(m);
  };
  addNeon('ARCADE', '#ff3da0', -4.2, 4.6, 5.2, 1.3);
  addNeon('PLAY', '#3de0ff', 4.6, 4.2, 3.2, 0.8);
  for (const [x, y, r, c] of [[0, 3.8, 0.9, 0xff3da0], [1.4, 4.3, 0.5, 0x3de0ff], [-1.4, 4.2, 0.4, 0xffd45e]] as const) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.03, 12, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), toneMapped: false }),
    );
    ring.position.set(x, y, -4.2);
    g.add(ring);
  }

  // ---------- 背景機台 ----------
  const cabMat = (c: number) => paint(c);
  const bgCab = (x: number, z: number, ry: number, color: number, hue: number) => {
    const c = new THREE.Group();
    box(1.2, 2.5, 1.0, cabMat(color), 0, 1.25, 0, c);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: screenTexture(hue), toneMapped: false }));
    screen.position.set(0, 1.55, 0.505);
    c.add(screen);
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.35),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 1, 0.5).multiplyScalar(2.2), toneMapped: false }),
    );
    top.position.set(0, 2.25, 0.505);
    c.add(top);
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    g.add(c);
  };
  [-7, -5.4, -3.8, 3.8, 5.4, 7].forEach((x, i) => bgCab(x, -3.4, (i % 2 ? 1 : -1) * 0.12, [0x2b0f4f, 0x0e2d52, 0x4a0f35, 0x0f4a44, 0x2b0f4f, 0x0e2d52][i], [300, 190, 330, 160, 280, 210][i]));

  // ---------- 換幣櫃台 ----------
  const counter = new THREE.Group();
  counter.position.set(COUNTER.x, 0, COUNTER.z);
  g.add(counter);
  box(2.2, 0.95, 0.7, paint(0x14173a), 0, 0.475, 0, counter);
  box(2.3, 0.06, 0.8, paint(0xff3d9a), 0, 0.98, 0, counter);
  box(2.24, 0.03, 0.72, new THREE.MeshStandardMaterial({ color: 0xf0e8f4, roughness: 0.3 }), 0, 0.95, 0, counter);
  // 收銀機
  box(0.5, 0.2, 0.4, new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5 }), 0.5, 1.1, -0.05, counter);
  const reg = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 1.1), toneMapped: false }));
  reg.position.set(0.5, 1.28, 0.1);
  reg.rotation.x = -0.5;
  counter.add(reg);
  // 零錢盤
  box(0.6, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: 0xffd45e, metalness: 0.8, roughness: 0.3 }), -0.5, 1.0, 0.12, counter);
  const coinSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 0.5),
    new THREE.MeshBasicMaterial({ map: neonTexture('COINS', '#ffd45e', 640, 160, 'bold 120px "Arial Black", sans-serif', undefined), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  coinSign.position.set(0, 2.5, 0.2);
  counter.add(coinSign);
  for (const s of [-1, 1]) box(0.05, 1.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x9aa0b5, metalness: 1, roughness: 0.2 }), s * 0.95, 1.75, 0.2, counter);

  // ---------- 倉庫貨架 ----------
  const shelf = new THREE.Group();
  shelf.position.set(SHELF_X, 0, 0.3);
  g.add(shelf);
  const metal = new THREE.MeshStandardMaterial({ color: 0x59607a, metalness: 0.9, roughness: 0.35 });
  for (const sx of [-1.2, 1.2]) for (const sz of [-0.35, 0.35]) box(0.06, 2.2, 0.06, metal, sx, 1.1, sz, shelf);
  for (const y of [0.15, 0.85, 1.55]) box(2.5, 0.05, 0.8, metal, 0, y, 0, shelf);
  const cardboard = new THREE.MeshStandardMaterial({ color: 0xc89a5b, roughness: 0.9 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.7 });
  const crates: THREE.Group[] = [];
  for (const y of [0.18, 0.88, 1.58]) {
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      box(0.5, 0.4, 0.5, cardboard, 0, 0.22, 0, c);
      box(0.52, 0.02, 0.1, tape, 0, 0.43, 0, c);
      c.position.set(-0.9 + i * 0.6, y, 0);
      c.rotation.y = (Math.random() - 0.5) * 0.2;
      shelf.add(c);
      crates.push(c);
    }
  }
  const shelfSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.45),
    new THREE.MeshBasicMaterial({ map: neonTexture('STOCK', '#41e8ff', 640, 160, 'bold 120px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shelfSign.position.set(0, 2.6, 0.2);
  shelf.add(shelfSign);

  // ---------- 地面燈光溢出 ----------
  const spill = (color: string, x: number, z: number, s: number, o = 0.35) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: glowTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: o }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    g.add(m);
  };
  const cols = ['rgba(255,60,160,1)', 'rgba(60,190,255,1)', 'rgba(70,230,140,1)'];
  MACHINE_X.forEach((x, i) => spill(cols[i % cols.length], x, 1.8, 4.2));
  spill('rgba(255,210,120,1)', COUNTER.x, 1.0, 3.4, 0.4);
  spill('rgba(120,200,255,1)', SHELF_X + 0.4, 1.0, 3.4, 0.25);
  void THEMES;

  // ---------- 環境光源 ----------
  g.add(new THREE.HemisphereLight(0x6a5cff, 0x180a2a, 0.35));
  for (const [x, z, c, i] of [[-4.5, 4.5, 0xff3da0, 8], [4.5, 4.5, 0x3de0ff, 8], [0, 5, 0xffe2c0, 10]] as const) {
    const l = new THREE.PointLight(c, i, 0, 2);
    l.position.set(x, 3.2, z);
    g.add(l);
  }
  const counterLight = new THREE.PointLight(0xffe2b0, 5, 5, 2);
  counterLight.position.set(COUNTER.x, 2.6, COUNTER.z + 0.6);
  g.add(counterLight);

  return {
    group: g,
    setShelfStock(n: number) {
      const show = Math.min(crates.length, Math.ceil(n / 3));
      crates.forEach((c, i) => (c.visible = i < show));
    },
  };
}
