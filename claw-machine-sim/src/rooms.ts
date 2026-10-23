import * as THREE from 'three';
import { RETAIL } from './economy';
import { COUNTER, HALL, RETAIL_SPOTS, ROOMS, RoomId, TRUCK_DOCK, WC_LAYOUT } from './layout';
import { glowTexture, neonTexture, roomFloorTexture } from './textures';

export interface BackOfHouse {
  group: THREE.Group;
  /** 依倉庫庫存顯示貨架上的紙箱數量 */
  setStock(n: number): void;
  /** 廁所髒污程度 0~1 */
  setWcDirt(id: 'wcF' | 'wcM', dirt: number): void;
  /** 冰箱與展示架上的商品數 */
  setRetail(drink: number, snack: number): void;
}

const std = (c: number, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const decalMat = (map: THREE.Texture | null, opts: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, ...opts });

const WALL_H = 1.5;

/** 大廳兩側的後場:倉庫(含卸貨區)、辦公室、員工休息室、男女廁所,以及前廳的服務櫃檯 */
export function buildBackOfHouse(): BackOfHouse {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, shadow = true) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, shadow);
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => add(new THREE.CylinderGeometry(rt, rb, h, 16), m, x, y, z, parent, false);
  const flat = (w: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    parent.add(p);
    return p;
  };

  const trim = std(0xd8d3c8, 0.6);
  const metal = std(0x59607a, 0.35, 0.9);
  const chrome = std(0xdfe3ee, 0.16, 1);
  const cardboard = std(0xc89a5b, 0.9);
  const tape = std(0xe8d9b0, 0.7);
  const yellow = std(0xe0b73a, 0.5);
  const dark = std(0x1c1f27, 0.5, 0.3);
  const white = std(0xf1f0ec, 0.45);

  /** 帶頂蓋的矮牆(剖面屋風格,從上帝視角看得到室內) */
  const wall = (ax: number, az: number, bx: number, bz: number, color: number, h = WALL_H) => {
    const horizontal = Math.abs(bz - az) < 1e-6;
    const len = Math.hypot(bx - ax, bz - az);
    const w = horizontal ? len : 0.2;
    const d = horizontal ? 0.2 : len;
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    box(w, h, d, std(color, 0.9), cx, h / 2, cz);
    box(w + 0.05, 0.07, d + 0.05, trim, cx, h + 0.035, cz, g, false);
    box(w + 0.03, 0.12, d + 0.03, trim, cx, 0.06, cz, g, false);
  };
  const floor = (id: RoomId, kind: 'concrete' | 'wood' | 'tile', rx: number, rz: number, tint = 0xffffff) => {
    const r = ROOMS[id];
    const t = roomFloorTexture(kind).clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    t.repeat.set(w / rx, d / rz);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: kind === 'tile' ? 0.25 : kind === 'wood' ? 0.5 : 0.85 }));
    f.rotation.x = -Math.PI / 2;
    f.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    f.receiveShadow = true;
    g.add(f);
  };
  const sign = (en: string, zh: string, color: string, w: number, x: number, y: number, z: number, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.34), decalMat(neonTexture(en, color, 768, 260, 'bold 100px "Arial Black", sans-serif', zh), { blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    g.add(m);
    return m;
  };

  const W = ROOMS.warehouse;
  const O = ROOMS.office;
  const L = ROOMS.lounge;
  const F = ROOMS.wcF;
  const M = ROOMS.wcM;

  // ================= 倉庫 =================
  floor('warehouse', 'concrete', 3, 3);
  const wallW = 0xaeb2bb;
  wall(W.x0, W.z0, W.x1, W.z0, wallW);
  wall(W.x0, W.z1, W.x1, W.z1, wallW);
  // 西牆:卸貨口開口(寬 2.8)
  wall(W.x0, W.z0, W.x0, W.doorZ - 1.4, wallW);
  wall(W.x0, W.doorZ + 1.4, W.x0, W.z1, wallW);
  // 捲門(升起的狀態)與門框
  box(0.3, 0.12, 3.1, metal, W.x0, WALL_H + 0.45, W.doorZ);
  box(0.16, 0.08, 2.9, std(0xb9bec9, 0.4, 0.8), W.x0 - 0.02, WALL_H + 0.28, W.doorZ, g, false);
  for (const s of [-1, 1]) box(0.26, WALL_H + 0.5, 0.14, yellow, W.x0, (WALL_H + 0.5) / 2, W.doorZ + s * 1.45);
  sign('DOCK', '卸貨口', '#ffd45e', 2.2, W.x0 - 1.6, 2.3, W.doorZ - 2.4);
  // 貨架
  const crates: THREE.Group[] = [];
  const rack = (x: number, z: number, rotY: number) => {
    const rk = new THREE.Group();
    rk.position.set(x, 0, z);
    rk.rotation.y = rotY;
    g.add(rk);
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.35, 0.35]) box(0.06, 2.4, 0.06, metal, sx, 1.2, sz, rk, false);
    for (const y of [0.15, 0.85, 1.55, 2.25]) box(2.5, 0.05, 0.8, metal, 0, y, 0, rk, false);
    for (const y of [0.18, 0.88, 1.58]) {
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Group();
        box(0.5, 0.4, 0.5, cardboard, 0, 0.22, 0, c, false);
        box(0.52, 0.02, 0.1, tape, 0, 0.43, 0, c, false);
        c.position.set(-0.9 + i * 0.6, y, 0);
        c.rotation.y = (Math.random() - 0.5) * 0.2;
        rk.add(c);
        crates.push(c);
      }
    }
    return rk;
  };
  for (const x of [-16.6, -13.7, -10.8]) rack(x, 3.5, 0);
  for (const x of [-16.2, -12.6]) rack(x, 11.0, Math.PI);
  // 進貨暫放區(黃線)與棧板
  const line = decalMat(null, { color: 0xe0b73a, transparent: false });
  for (const [w, d, x, z] of [[2.6, 0.08, -17.3, 6.5], [2.6, 0.08, -17.3, 9.5], [0.08, 3.0, -18.55, 8.0], [0.08, 3.0, -16.0, 8.0]] as const) flat(w, d, line, x, 0.02, z);
  const pallet = (x: number, z: number, n: number) => {
    box(1.1, 0.12, 1.1, std(0xa77b4a, 0.9), x, 0.06, z, g, false);
    for (let i = 0; i < n; i++) {
      box(0.5, 0.4, 0.5, cardboard, x - 0.27, 0.32 + i * 0.4, z - 0.27, g, false);
      box(0.5, 0.4, 0.5, cardboard, x + 0.27, 0.32 + i * 0.4, z + 0.27, g, false);
    }
  };
  pallet(-11.3, 10.0, 2);
  pallet(-10.5, 6.2, 1);
  // 手推板車
  box(0.5, 0.06, 1.1, std(0xd9531e, 0.5, 0.4), -15.2, 0.18, 6.4, g, false);
  box(0.06, 0.9, 0.06, std(0xd9531e, 0.5, 0.4), -15.2, 0.6, 5.85, g, false);
  // 驗貨桌
  box(1.4, 0.06, 0.7, std(0x6b5a45, 0.7), -10.6, 0.82, 4.9, g, false);
  for (const sx of [-0.6, 0.6]) box(0.06, 0.8, 0.06, metal, -10.6 + sx, 0.4, 4.9, g, false);
  box(0.28, 0.02, 0.2, white, -10.7, 0.86, 4.9, g, false);
  sign('WAREHOUSE', '倉庫', '#8fe8ff', 2.6, -14.1, 2.5, 2.75);

  // ================= 辦公室 =================
  floor('office', 'wood', 3, 3, 0xe9ddd0);
  const wallO = 0xcfc6b7;
  wall(O.x0, O.z0, O.x1, O.z0, wallO);
  wall(O.x1, O.z0, O.x1, O.z1, wallO);
  wall(O.x0, O.z1, O.x1, O.z1, wallO);
  // 辦公桌(靠東牆)+ 椅子 + 電腦
  const wood = std(0x7a5a3c, 0.55);
  box(0.9, 0.08, 2.2, wood, 16.8, 0.76, 6.2);
  box(0.8, 0.7, 0.05, wood, 16.8, 0.38, 5.15, g, false);
  box(0.8, 0.7, 0.05, wood, 16.8, 0.38, 7.25, g, false);
  const pc = new THREE.Group();
  box(0.55, 0.34, 0.04, dark, 0, 0.3, 0, pc, false);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.29), glow(0.3, 1.3, 1.8));
  screen.position.set(0, 0.3, 0.025);
  pc.add(screen);
  box(0.06, 0.14, 0.06, dark, 0, 0.1, 0, pc, false);
  box(0.4, 0.02, 0.14, dark, 0, 0.02, 0.32, pc, false);
  pc.position.set(16.95, 0.8, 6.55);
  pc.rotation.y = -Math.PI / 2;
  g.add(pc);
  box(0.34, 0.03, 0.24, white, 16.5, 0.82, 5.6, g, false);
  const chair = new THREE.Group();
  cyl(0.28, 0.28, 0.08, dark, 0, 0.5, 0, chair);
  cyl(0.04, 0.04, 0.45, metal, 0, 0.25, 0, chair);
  box(0.5, 0.55, 0.08, dark, 0.28, 0.82, 0, chair);
  chair.position.set(15.7, 0, 6.2);
  g.add(chair);
  // 檔案櫃、保險箱、白板
  for (let i = 0; i < 3; i++) {
    box(0.7, 1.35, 0.5, std(0x8c95a3, 0.4, 0.7), 11.2 + i * 0.75, 0.68, 3.0);
    for (const y of [0.35, 0.8, 1.15]) box(0.4, 0.04, 0.02, chrome, 11.2 + i * 0.75, y, 3.27, g, false);
  }
  box(0.8, 0.9, 0.7, std(0x2f3340, 0.35, 0.8), 16.9, 0.45, 3.4);
  box(0.4, 0.4, 0.02, std(0x9aa0ad, 0.3, 0.9), 16.55, 0.5, 3.4, g, false);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4 }));
  board.position.set(14.0, 1.0, 2.72);
  g.add(board);
  const bl = std(0x3a7bd5, 0.6);
  const rd = std(0xd94a3d, 0.6);
  for (let i = 0; i < 4; i++) box(1.5 - i * 0.2, 0.04, 0.01, i % 2 ? rd : bl, 13.8, 1.28 - i * 0.18, 2.72, g, false);
  // 訪客沙發與茶几
  box(2.0, 0.4, 0.8, std(0x5a4a3e, 0.85), 12.3, 0.2, 11.0);
  box(2.0, 0.45, 0.18, std(0x5a4a3e, 0.85), 12.3, 0.55, 11.4);
  box(0.9, 0.35, 0.55, wood, 12.3, 0.18, 9.9, g, false);
  // 植栽
  const plant = (x: number, z: number, parent: THREE.Object3D = g) => {
    cyl(0.28, 0.22, 0.5, std(0xcfc8bc, 0.8), x, 0.25, z, parent);
    const leaf = std(0x2f7d46, 0.8);
    for (let i = 0; i < 6; i++) {
      const s = add(new THREE.SphereGeometry(0.25, 10, 8), leaf, x + Math.cos(i * 1.2) * 0.14, 0.78 + (i % 3) * 0.16, z + Math.sin(i * 1.2) * 0.14, parent, false);
      s.scale.set(1, 1.3, 1);
    }
  };
  plant(16.9, 11.2);
  sign('OFFICE', '辦公室', '#ffd9a0', 2.4, 12.2, 1.9, 2.75);

  // ================= 員工休息室 =================
  floor('lounge', 'wood', 3, 3, 0xd8e6d5);
  const wallL = 0xb9d3bd;
  wall(L.x1, L.z0, L.x1, L.z1, wallL);
  wall(L.x0, L.z1, L.x1, L.z1, wallL);
  // 置物櫃(靠北牆)
  const lockerCols = [0x4a90d9, 0x4a90d9, 0x4a90d9, 0x4a90d9, 0xe3a43a, 0xe3a43a, 0xe3a43a, 0xe3a43a];
  lockerCols.forEach((c, i) => {
    box(0.5, 1.4, 0.45, std(c, 0.45, 0.4), 10.9 + i * 0.52, 0.7, 12.55);
    box(0.06, 0.04, 0.02, chrome, 10.9 + i * 0.52 + 0.14, 0.85, 12.8, g, false);
  });
  // 沙發 + 茶几(東牆)
  const sofa = std(0xc96a5a, 0.85);
  box(0.85, 0.4, 3.9, sofa, 17.05, 0.2, 19.2);
  box(0.2, 0.55, 3.9, sofa, 17.45, 0.65, 19.2);
  for (const z of [17.4, 21.0]) box(0.85, 0.55, 0.22, sofa, 17.05, 0.5, z, g, false);
  box(0.7, 0.04, 1.1, wood, 14.9, 0.38, 19.2, g, false);
  for (const sz of [-0.45, 0.45]) box(0.05, 0.36, 0.05, metal, 14.9, 0.18, 19.2 + sz, g, false);
  // 小圓桌 + 兩張椅子
  cyl(0.55, 0.55, 0.05, std(0xf0ece4, 0.5), 13.3, 0.74, 20.0);
  cyl(0.05, 0.05, 0.72, metal, 13.3, 0.36, 20.0);
  for (const sx of [-0.85, 0.85]) {
    cyl(0.22, 0.22, 0.05, dark, 13.3 + sx, 0.45, 20.0);
    cyl(0.03, 0.03, 0.43, metal, 13.3 + sx, 0.22, 20.0);
  }
  // 簡易廚房:冰箱、流理台、微波爐(東牆北側)
  box(0.75, 1.5, 0.7, std(0xd8dbe2, 0.3, 0.6), 17.15, 0.75, 13.2);
  box(0.02, 0.5, 0.04, chrome, 16.77, 1.0, 13.0, g, false);
  box(0.65, 0.9, 2.0, std(0xcfc8bc, 0.6), 17.1, 0.45, 15.2);
  box(0.7, 0.05, 2.05, std(0x3a3d46, 0.4, 0.3), 17.1, 0.92, 15.2, g, false);
  box(0.4, 0.26, 0.5, white, 17.05, 1.08, 14.7, g, false);
  box(0.02, 0.2, 0.36, glow(0.3, 1.2, 0.5), 16.84, 1.08, 14.7, g, false);
  // 休息室地毯與電視
  flat(3.2, 2.2, decalMat(null, { color: 0x5b7a64, transparent: true, opacity: 0.55 }), 14.9, 0.02, 19.2);
  box(0.08, 0.7, 1.2, dark, 17.5, 1.25, 17.6, g, false);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), glow(0.5, 0.9, 1.6));
  tv.rotation.y = -Math.PI / 2;
  tv.position.set(17.45, 1.25, 17.6);
  g.add(tv);
  plant(10.9, 21.0);
  sign('STAFF ONLY', '員工休息室', '#ffd45e', 2.6, 13.6, 1.85, 12.35);

  // ================= 廁所 =================
  const stallMat = std(0x7fb3d5, 0.5);
  const porcelain = std(0xf6f6f6, 0.2);
  const toilet = (x: number, z: number, faceSouth: boolean) => {
    const t = new THREE.Group();
    const bowl = add(new THREE.CylinderGeometry(0.2, 0.17, 0.4, 14), porcelain, 0, 0.2, 0.08, t, false);
    bowl.scale.set(1, 1, 1.25);
    box(0.34, 0.45, 0.16, porcelain, 0, 0.55, -0.17, t, false);
    t.position.set(x, 0, z);
    t.rotation.y = faceSouth ? 0 : Math.PI;
    g.add(t);
  };
  const sinkRow = (xs: number[], z: number, rotY: number) => {
    for (const x of xs) {
      const s = new THREE.Group();
      box(0.62, 0.08, 0.5, white, 0, 0.86, 0, s, false);
      box(0.56, 0.78, 0.4, std(0xdfe3ea, 0.5), 0, 0.4, 0, s, false);
      cyl(0.17, 0.12, 0.05, porcelain, 0, 0.91, 0, s);
      cyl(0.02, 0.02, 0.2, chrome, 0, 1.0, -0.16, s);
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.55), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, metalness: 0.95 }));
      mirror.position.set(0, 1.28, -0.24);
      s.add(mirror);
      s.position.set(x, 0, z);
      s.rotation.y = rotY;
      g.add(s);
    }
  };
  const dirtDecals: Partial<Record<'wcF' | 'wcM', THREE.Mesh>> = {};
  const wcCommon = (r: typeof F, id: 'wcF' | 'wcM') => {
    floor(id, 'tile', 2.4, 2.4);
    wall(r.x0, r.z0, r.x0, r.z1, 0xdbe6ef);
    const dirt = flat(r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2, decalMat(glowTexture('rgba(70,48,24,1)'), { opacity: 0 }), (r.x0 + r.x1) / 2, 0.025, (r.z0 + r.z1) / 2);
    dirtDecals[id] = dirt;
  };
  // 女廁:兩間隔間
  wcCommon(F, 'wcF');
  wall(F.x0, F.z1, F.x1, F.z1, 0xdbe6ef);
  for (const sx of [-17.4, -16.2, -15.0]) box(0.05, 1.45, 1.75, stallMat, sx, 0.73, 13.2);
  for (const cx of [-16.8, -15.6]) {
    box(1.15, 1.3, 0.04, std(0xe8935a, 0.5), cx, 0.72, 14.05, g, false);
    toilet(cx, 12.55, true);
  }
  sinkRow(WC_LAYOUT.wcF.sinks.map((p) => p.x), 16.55, Math.PI);
  sign('WC', '女廁', '#ff9ad0', 1.8, -13.6, 2.1, 12.35);
  // 男廁:一間隔間 + 兩個小便斗
  wcCommon(M, 'wcM');
  wall(M.x0, M.z1, M.x1, M.z1, 0xdbe6ef);
  box(0.05, 1.45, 1.75, stallMat, -17.4, 0.73, 17.9);
  box(0.05, 1.45, 1.75, stallMat, -16.2, 0.73, 17.9);
  box(1.15, 1.3, 0.04, std(0x6aa6e8, 0.5), -16.8, 0.72, 18.75, g, false);
  toilet(-16.8, 17.25, true);
  for (const ux of [-15.4, -14.3]) {
    box(0.04, 1.1, 0.5, std(0xdbe6ef, 0.6), ux + 0.3, 0.75, 17.3, g, false);
    const u = add(new THREE.CylinderGeometry(0.14, 0.1, 0.5, 12), porcelain, ux, 0.72, 17.12, g, false);
    u.scale.set(1, 1, 0.7);
  }
  sinkRow(WC_LAYOUT.wcM.sinks.map((p) => p.x), 21.25, Math.PI);
  sign('WC', '男廁', '#7fc4ff', 1.8, -13.6, 2.1, 17.05);

  // ================= 卸貨區(倉庫西牆外) =================
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.95 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(W.x0 - 10.1, -0.002, 8.0);
  yard.receiveShadow = true;
  g.add(yard);
  for (const dz of [-3.2, 3.2]) flat(8, 0.1, decalMat(null, { color: 0xe8e8e0, transparent: false }), TRUCK_DOCK.x - 0.5, 0.01, TRUCK_DOCK.z + dz);
  flat(0.1, 6.4, decalMat(null, { color: 0xe8e8e0, transparent: false }), TRUCK_DOCK.x + 3.4, 0.01, TRUCK_DOCK.z);
  for (const dz of [-1.9, 1.9]) box(0.25, 0.14, 0.5, std(0x222222, 0.8), TRUCK_DOCK.rearX + 0.35, 0.07, TRUCK_DOCK.z + dz, g, false);
  for (const [x, z] of [[-20.2, 4.6], [-20.2, 11.4]]) {
    const cone = add(new THREE.ConeGeometry(0.17, 0.55, 12), std(0xff6a2b, 0.6), x, 0.28, z, g, false);
    cone.castShadow = true;
  }

  // ================= 前廳服務櫃檯 =================
  const cx = COUNTER.x;
  const cz = COUNTER.z;
  box(COUNTER.w, 1.0, COUNTER.d, std(0x2e7d9a, 0.35, 0.25), cx, 0.5, cz);
  box(COUNTER.w + 0.14, 0.06, COUNTER.d + 0.16, std(0x1b1e26, 0.25, 0.4), cx, 1.03, cz);
  // 櫃檯側邊延伸(讓出缺口給店員進出)
  box(0.8, 1.0, COUNTER.d, std(0x2e7d9a, 0.35, 0.25), cx - COUNTER.w / 2 + 0.4, 0.5, cz - 0.9, g);
  const reg = new THREE.Group();
  box(0.46, 0.14, 0.4, dark, 0, 0.07, 0, reg, false);
  const rs = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), glow(0.4, 1.5, 0.9));
  rs.position.set(0, 0.28, 0.05);
  rs.rotation.x = -0.4;
  reg.add(rs);
  box(0.4, 0.2, 0.04, dark, 0, 0.22, -0.02, reg, false).rotation.x = -0.4;
  reg.position.set(cx - 0.6, 1.06, cz - 0.05);
  reg.rotation.y = Math.PI;
  g.add(reg);
  // 呼叫鈴、立牌、零錢盤
  cyl(0.07, 0.08, 0.04, chrome, cx + 0.5, 1.08, cz + 0.12);
  box(0.4, 0.26, 0.03, white, cx + 0.95, 1.2, cz + 0.12, g, false).rotation.x = -0.25;
  box(0.34, 0.03, 0.24, std(0xe8e0c8, 0.5), cx + 0.1, 1.07, cz + 0.15, g, false);
  // 後方展示櫃(獎品展示)
  box(COUNTER.w - 0.4, 1.7, 0.4, std(0x39404f, 0.5, 0.3), cx + 0.2, 0.85, cz - 2.0);
  const showcase = new THREE.Mesh(new THREE.PlaneGeometry(COUNTER.w - 0.7, 1.35), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }));
  showcase.position.set(cx + 0.2, 0.95, cz - 1.78);
  g.add(showcase);
  const plushCols = [0xf29bb8, 0x8fd0ff, 0xffd86b, 0xb4e08a, 0xd6a4ff];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) {
    const p = add(new THREE.SphereGeometry(0.17, 12, 10), std(plushCols[(i + r) % 5], 0.95), cx - 1.0 + i * 0.5, 0.45 + r * 0.42, cz - 1.85, g, false);
    p.scale.set(1, 0.9, 0.9);
  }
  sign('SERVICE', '服務櫃檯 · 兌幣 · 客服', '#7fe0ff', 3.0, cx, 2.55, cz + 0.2);
  box(0.05, 2.4, 0.05, metal, cx - 1.4, 1.2, cz + 0.2, g, false);
  box(0.05, 2.4, 0.05, metal, cx + 1.4, 1.2, cz + 0.2, g, false);

  // ================= 零售:冰箱與產品展示架(前廳西牆) =================
  const drinks: THREE.Mesh[] = [];
  const snacks: THREE.Mesh[] = [];
  {
    const fx = RETAIL_SPOTS.drink.x;
    const fz = RETAIL_SPOTS.drink.z;
    const fr = new THREE.Group();
    fr.position.set(fx, 0, fz);
    fr.rotation.y = Math.PI / 2;
    g.add(fr);
    box(1.5, 2.0, 0.75, std(0xe9eef5, 0.3, 0.5), 0, 1.0, 0, fr);
    box(1.52, 0.12, 0.78, std(0x2b72c9, 0.4, 0.3), 0, 2.06, 0, fr);
    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.62), new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }));
    doorGlass.position.set(0, 1.08, 0.385);
    fr.add(doorGlass);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.6), glow(0.55, 0.8, 1.0));
    inner.position.set(0, 1.08, 0.37);
    fr.add(inner);
    const bc = [0xe2503a, 0x3aa0e2, 0x4fc46a, 0xf2c21b, 0xb06ae0, 0xf08a2c];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
      const b = add(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 10), std(bc[(i + r) % 6], 0.35), -0.55 + i * 0.22, 0.42 + r * 0.38, 0.28, fr, false);
      drinks.push(b);
      box(1.3, 0.02, 0.5, chrome, 0, 0.3 + r * 0.38, 0.12, fr, false);
    }
    box(1.3, 0.3, 0.04, std(0x2b72c9, 0.4), 0, 1.92, 0.385, fr, false);
    sign('COLD', '冷飲', '#9fe0ff', 1.6, fx + 0.6, 2.6, fz + 0.1, 0).rotation.y = Math.PI / 2;
  }
  {
    const rx = RETAIL_SPOTS.snack.x;
    const rz = RETAIL_SPOTS.snack.z;
    const rk = new THREE.Group();
    rk.position.set(rx, 0, rz);
    rk.rotation.y = Math.PI / 2;
    g.add(rk);
    box(1.5, 1.7, 0.5, std(0xf1f0ec, 0.5), 0, 0.85, -0.05, rk);
    for (const y of [0.15, 0.62, 1.09, 1.56]) box(1.5, 0.04, 0.55, std(0xe2503a, 0.5), 0, y, 0.0, rk, false);
    const pc = [0xf29bb8, 0x8fd0ff, 0xffd86b, 0xb4e08a, 0xd6a4ff, 0xff9a5c];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const k = r === 1 ? 'b' : 'p';
      const m = k === 'b'
        ? add(new THREE.BoxGeometry(0.17, 0.26, 0.1), std(pc[(i + r) % 6], 0.55), -0.58 + i * 0.23, 0.36 + r * 0.47, 0.17, rk, false)
        : add(new THREE.SphereGeometry(0.1, 10, 8), std(pc[(i + r) % 6], 0.95), -0.58 + i * 0.23, 0.38 + r * 0.47, 0.17, rk, false);
      snacks.push(m);
    }
    sign('SHOP', '零食周邊', '#ffb36b', 1.6, rx + 0.6, 2.2, rz + 0.1, 0).rotation.y = Math.PI / 2;
  }

  return {
    group: g,
    setRetail(drink: number, snack: number) {
      const sd = Math.ceil((drink / RETAIL.drink.cap) * drinks.length);
      const ss = Math.ceil((snack / RETAIL.snack.cap) * snacks.length);
      drinks.forEach((m, i) => (m.visible = i < sd));
      snacks.forEach((m, i) => (m.visible = i < ss));
    },
    setStock(n: number) {
      const show = Math.min(crates.length, Math.ceil(n / 10));
      crates.forEach((c, i) => (c.visible = i < show));
    },
    setWcDirt(id, dirt) {
      const m = dirtDecals[id];
      if (m) (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, Math.min(1, dirt)) * 0.6;
    },
  };
}

void HALL;
