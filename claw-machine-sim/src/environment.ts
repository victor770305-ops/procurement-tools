import * as THREE from 'three';
import { EXCHANGES, FOYER_Z, HALL, N_MACHINES, ROWS, SHELF, STAFF_DOOR, gridOf, rowZ } from './layout';
import { aisleTileTexture, carpetTexture, glowTexture, neonTexture, posterTexture } from './textures';
import { isMobile } from './render';

export interface Store {
  group: THREE.Group;
  /** 依倉庫庫存顯示貨架上的紙箱數量 */
  setShelfStock(n: number): void;
}

const std = (c: number, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

/** 店內大廳:地毯與磁磚走道、牆面、前廳、倉庫貨架、員工休息室入口、室內照明 */
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

  const W = HALL.maxX - HALL.minX;
  const D = HALL.maxZ - HALL.minZ;
  const cx = (HALL.minX + HALL.maxX) / 2;
  const cz = (HALL.minZ + HALL.maxZ) / 2;

  // ---------- 地板:地毯 + 走道磁磚 ----------
  const carpet = carpetTexture();
  carpet.repeat.set(W / 3.5, D / 3.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  g.add(floor);

  const tile = aisleTileTexture();
  tile.repeat.set(1, 1);
  const tileMat = (w: number, d: number) => {
    const t = tile.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 2.4, d / 2.4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0.05, envMapIntensity: 1.1 });
  };
  const strip = (x: number, z: number, w: number, d: number, y = 0.004) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tileMat(w, d));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    g.add(m);
  };
  for (let r = 0; r < ROWS; r++) strip(0, rowZ(r) + 3.05, 30, 3.9);
  strip(-14.3, cz - 2, 2.8, D - 8);
  strip(14.3, cz - 2, 2.8, D - 8);
  strip(0, (FOYER_Z + HALL.maxZ) / 2 + 0.2, W - 0.5, HALL.maxZ - FOYER_Z);

  // ---------- 牆 ----------
  const wallMat = std(0x2b2a3a, 0.9);
  const trimMat = std(0xd8d3c8, 0.6);
  const wallH = 4.6;
  const wall = (x: number, z: number, w: number, d: number, h = wallH) => {
    box(w, h, d, wallMat, x, h / 2, z);
    box(w + 0.02, 0.18, d + 0.02, trimMat, x, 0.09, z);
  };
  wall(cx, HALL.minZ, W, 0.3);
  wall(HALL.minX, cz, 0.3, D, 2.2);
  wall(HALL.maxX, cz, 0.3, D, 2.2);
  // 前牆(矮牆,留出入口,避免擋住上帝視角)
  wall(-9.2, HALL.maxZ, 15.2, 0.3, 1.1);
  wall(9.2, HALL.maxZ, 15.2, 0.3, 1.1);
  // 大門:玻璃雙開門
  const frame = std(0x9aa0ad, 0.3, 0.9);
  box(0.16, 3.4, 0.2, frame, -1.7, 1.7, HALL.maxZ);
  box(0.16, 3.4, 0.2, frame, 1.7, 1.7, HALL.maxZ);
  box(3.56, 0.18, 0.2, frame, 0, 3.4, HALL.maxZ);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.6, 3.2, 0.03), glassMat, s * 0.82, 1.65, HALL.maxZ, g, false);
  const entrance = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.55),
    new THREE.MeshBasicMaterial({ map: neonTexture('ENTRANCE', '#9fe8ff', 768, 192, 'bold 100px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  entrance.position.set(0, 3.85, HALL.maxZ - 0.05);
  entrance.rotation.y = Math.PI;
  g.add(entrance);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), std(0x3a2e2a, 1));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.012, HALL.maxZ - 1.2);
  g.add(mat);

  // 後牆:海報與霓虹招牌
  const posters = [
    ['WIN!', '大獎等你', 330],
    ['LUCKY', '幸運夾夾', 200],
    ['PLAY', '開心玩', 28],
    ['WIN!', '天天特價', 150],
    ['LUCKY', '稀有款', 270],
  ] as const;
  posters.forEach(([t, s, h], i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshStandardMaterial({ map: posterTexture(t, s, h), roughness: 0.6 }));
    p.position.set(-13 + i * 6.5, 2.3, HALL.minZ + 0.2);
    g.add(p);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.8),
    new THREE.MeshBasicMaterial({ map: neonTexture('CLAW CLUB', '#ff5fa8', 1536, 300, 'bold 190px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sign.position.set(0, 4.0, HALL.minZ + 0.25);
  g.add(sign);

  // ---------- 前廳:兌幣機區地面標線、長椅、盆栽、販賣機 ----------
  const yellow = new THREE.MeshBasicMaterial({ color: 0xe0b73a });
  for (const e of EXCHANGES) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.07), yellow);
    line.rotation.x = -Math.PI / 2;
    line.position.set(e.x, 0.009, e.z + 1.0);
    g.add(line);
    const spill = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,225,150,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.25 }),
    );
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(e.x, 0.01, e.z + 1.6);
    g.add(spill);
  }
  const wood = std(0x7a5a3c, 0.6);
  const bench = (x: number, z: number) => {
    const b = new THREE.Group();
    box(2.0, 0.08, 0.5, wood, 0, 0.46, 0, b);
    box(2.0, 0.5, 0.08, wood, 0, 0.75, -0.22, b);
    for (const sx of [-0.9, 0.9]) box(0.06, 0.45, 0.45, std(0x20232b, 0.4, 0.7), sx, 0.22, 0, b);
    b.position.set(x, 0, z);
    g.add(b);
  };
  bench(-9, 27.6);
  bench(8, 27.6);
  const plant = (x: number, z: number) => {
    const p = new THREE.Group();
    add(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 16), std(0xcfc8bc, 0.8), 0, 0.28, 0, p);
    const leaf = std(0x2f7d46, 0.8);
    for (let i = 0; i < 7; i++) {
      const s = add(new THREE.SphereGeometry(0.28, 10, 8), leaf, Math.cos(i * 1.1) * 0.18, 0.85 + (i % 3) * 0.18, Math.sin(i * 1.1) * 0.18, p);
      s.scale.set(1, 1.3, 1);
    }
    p.position.set(x, 0, z);
    g.add(p);
  };
  plant(-15.2, 28.6);
  plant(15.2, 28.6);
  plant(-2.6, 21.2);
  plant(2.6, 21.2);
  const bin = (x: number, z: number) => add(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 14), std(0x4a5160, 0.5, 0.4), x, 0.35, z);
  bin(-6.6, 21.4);
  bin(6.6, 21.4);
  // 販賣機
  const vend = new THREE.Group();
  box(1.0, 1.9, 0.8, std(0xc0392b, 0.35, 0.3), 0, 0.95, 0, vend);
  const vf = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.3, 1.4), toneMapped: false }));
  vf.position.set(0, 1.12, 0.41);
  vend.add(vf);
  for (let i = 0; i < 5; i++) box(0.62, 0.02, 0.02, std(0x9aa0ad, 0.4, 0.8), 0, 0.7 + i * 0.22, 0.43, vend);
  vend.position.set(-14.4, 0, 22.4);
  g.add(vend);

  // ---------- 員工休息室入口 ----------
  box(0.2, 2.6, 0.1, frame, STAFF_DOOR.x + 1.0, 1.3, STAFF_DOOR.z + 1.4);
  box(0.2, 2.6, 0.1, frame, STAFF_DOOR.x - 0.0, 1.3, STAFF_DOOR.z + 1.4);
  box(1.2, 2.5, 0.06, std(0x39465a, 0.5), STAFF_DOOR.x + 0.5, 1.25, STAFF_DOOR.z + 1.42);
  const staffSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    new THREE.MeshBasicMaterial({ map: neonTexture('STAFF', '#ffd45e', 512, 128, 'bold 80px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  staffSign.position.set(STAFF_DOOR.x + 0.5, 2.9, STAFF_DOOR.z + 1.36);
  g.add(staffSign);

  // ---------- 倉庫貨架 ----------
  const shelf = new THREE.Group();
  shelf.position.set(SHELF.x, 0, SHELF.z);
  g.add(shelf);
  const metal = std(0x59607a, 0.35, 0.9);
  const cardboard = std(0xc89a5b, 0.9);
  const tape = std(0xe8d9b0, 0.7);
  const crates: THREE.Group[] = [];
  for (const ox of [-1.5, 1.5]) {
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.35, 0.35]) box(0.06, 2.4, 0.06, metal, ox + sx, 1.2, sz, shelf);
    for (const y of [0.15, 0.85, 1.55, 2.25]) box(2.5, 0.05, 0.8, metal, ox, y, 0, shelf);
    for (const y of [0.18, 0.88, 1.58]) {
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Group();
        box(0.5, 0.4, 0.5, cardboard, 0, 0.22, 0, c);
        box(0.52, 0.02, 0.1, tape, 0, 0.43, 0, c);
        c.position.set(ox - 0.9 + i * 0.6, y, 0);
        c.rotation.y = (Math.random() - 0.5) * 0.2;
        shelf.add(c);
        crates.push(c);
      }
    }
  }
  const shelfSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.55),
    new THREE.MeshBasicMaterial({ map: neonTexture('STOCK', '#8fe8ff', 640, 160, 'bold 120px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shelfSign.position.set(0, 3.0, 0.45);
  shelf.add(shelfSign);

  // ---------- 室內照明 ----------
  g.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3b30, 0.7));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
  sun.position.set(-10, 34, 26);
  sun.target.position.set(0, 0, 4);
  sun.castShadow = !isMobile;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  g.add(sun, sun.target);
  for (const [x, z, c, i] of [[0, 25, 0xffe6c4, 18], [-9, 24, 0xffe6c4, 10], [9, 24, 0xffe6c4, 10]] as const) {
    const l = new THREE.PointLight(c, i, 14, 2);
    l.position.set(x, 3.4, z);
    g.add(l);
  }

  void N_MACHINES;
  void gridOf;
  return {
    group: g,
    setShelfStock(n: number) {
      const show = Math.min(crates.length, Math.ceil(n / 12));
      crates.forEach((c, i) => (c.visible = i < show));
    },
  };
}
