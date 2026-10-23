import * as THREE from 'three';
import { COLS, EXCHANGES, HALL, ROOM_LIST, ROWS, SX, rowZ } from './layout';
import { buildBackOfHouse } from './rooms';
import { aisleTileTexture, carpetTexture, glowTexture, neonTexture, posterTexture } from './textures';
import { isMobile } from './render';

export interface Store {
  group: THREE.Group;
  /** 依倉庫庫存顯示貨架上的紙箱數量 */
  setShelfStock(n: number): void;
  /** 廁所髒污程度 0~1 */
  setWcDirt(id: 'wcF' | 'wcM', dirt: number): void;
}

const std = (c: number, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

/** 貼在地面上的裝飾(貼花):用深度偏移與固定的高度層次,避免與地板 z-fighting */
const decal = (map: THREE.Texture | null, opts: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, ...opts });

/** 店內大廳:一整片磁磚地板、機台列下的地毯帶、牆面(含通往後場房間的門洞)、前廳、室內照明;後場房間見 rooms.ts */
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

  // ---------- 地板:整片磁磚(y = 0)+ 機台列下的地毯帶(疊在上面,用深度偏移) ----------
  const tile = aisleTileTexture();
  tile.repeat.set(W / 2.4, D / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.3, metalness: 0.05, envMapIntensity: 1.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  g.add(floor);

  const bandW = (COLS - 1) * SX + 1.9;
  const carpet = carpetTexture();
  carpet.repeat.set(bandW / 2.6, 1.4 / 2.6);
  const carpetMat = new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (let r = 0; r < ROWS; r++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(bandW, 1.5), carpetMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.012, rowZ(r) + 0.05);
    band.receiveShadow = true;
    g.add(band);
  }

  // ---------- 牆 ----------
  const wallMat = std(0x34324a, 0.9);
  const trimMat = std(0xd8d3c8, 0.6);
  const wall = (x: number, z: number, w: number, d: number, h: number) => {
    box(w, h, d, wallMat, x, h / 2, z);
    box(w + 0.04, 0.16, d + 0.04, trimMat, x, 0.08, z);
  };
  wall(cx, HALL.minZ, W + 0.3, 0.3, 4.2);
  // 左右牆:在每個後場房間的門口留出門洞(寬 1.5 公尺)
  const sideWall = (x: number, doors: number[]) => {
    const sorted = [...doors].sort((a, b) => a - b);
    let z = HALL.minZ - 0.15;
    for (const dz of sorted) {
      const a = dz - 0.75;
      wallSeg(x, z, a, 1.5);
      z = dz + 0.75;
    }
    wallSeg(x, z, HALL.maxZ + 0.15, 1.5);
    for (const dz of sorted) {
      for (const s of [-1, 1]) box(0.34, 1.7, 0.12, frame, x, 0.85, dz + s * 0.78);
      box(0.34, 0.12, 1.68, frame, x, 1.74, dz);
    }
  };
  const wallSeg = (x: number, z0: number, z1: number, h: number) => {
    const len = z1 - z0;
    if (len < 0.05) return;
    box(0.3, h, len, wallMat, x, h / 2, (z0 + z1) / 2);
    box(0.34, 0.16, len + 0.04, trimMat, x, 0.08, (z0 + z1) / 2);
  };
  const frame = std(0x9aa0ad, 0.3, 0.9);
  sideWall(HALL.minX, ROOM_LIST.filter((r) => r.side === 'W').map((r) => r.doorZ));
  sideWall(HALL.maxX, ROOM_LIST.filter((r) => r.side === 'E').map((r) => r.doorZ));
  const frontW = (W - 3.4) / 2;
  wall(HALL.minX + frontW / 2, HALL.maxZ, frontW, 0.3, 1.1);
  wall(HALL.maxX - frontW / 2, HALL.maxZ, frontW, 0.3, 1.1);

  // 大門:玻璃雙開門
  box(0.16, 3.2, 0.2, frame, -1.7, 1.6, HALL.maxZ);
  box(0.16, 3.2, 0.2, frame, 1.7, 1.6, HALL.maxZ);
  box(3.56, 0.18, 0.2, frame, 0, 3.2, HALL.maxZ);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.6, 3.0, 0.03), glassMat, s * 0.82, 1.55, HALL.maxZ, g, false);
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), decal(neonTexture('ENTRANCE', '#9fe8ff', 768, 192, 'bold 100px "Arial Black", sans-serif'), { blending: THREE.AdditiveBlending }));
  entrance.position.set(0, 3.6, HALL.maxZ - 0.15);
  entrance.rotation.y = Math.PI;
  g.add(entrance);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a2e2a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, HALL.maxZ - 1.3);
  g.add(rug);

  // 後牆:海報與霓虹招牌
  const posters = [
    ['WIN!', '大獎等你', 330],
    ['LUCKY', '幸運夾夾', 200],
    ['PLAY', '開心玩', 28],
    ['WIN!', '天天特價', 150],
    ['LUCKY', '稀有款', 270],
  ] as const;
  posters.forEach(([t, s, h], i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), new THREE.MeshStandardMaterial({ map: posterTexture(t, s, h), roughness: 0.6 }));
    p.position.set(-7.4 + i * 3.7, 2.0, HALL.minZ + 0.2);
    g.add(p);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), decal(neonTexture('CLAW CLUB', '#ff5fa8', 1536, 300, 'bold 190px "Arial Black", sans-serif'), { blending: THREE.AdditiveBlending }));
  sign.position.set(0, 3.5, HALL.minZ + 0.2);
  g.add(sign);

  // ---------- 前廳:兌幣機區地面標線、長椅、盆栽、垃圾桶、販賣機 ----------
  const yellow = decal(null, { color: 0xe0b73a, transparent: false });
  for (const e of EXCHANGES) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.07), yellow);
    line.rotation.x = -Math.PI / 2;
    line.position.set(e.x, 0.03, e.z + 1.0);
    g.add(line);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), decal(glowTexture('rgba(255,225,150,1)'), { blending: THREE.AdditiveBlending, opacity: 0.22 }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(e.x, 0.04, e.z + 1.6);
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
  bench(-5.5, 20.3);
  bench(5.5, 20.3);
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
  plant(-8.7, 20.7);
  plant(8.7, 20.7);
  plant(0, 13.4);
  const bin = (x: number, z: number) => add(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 14), std(0x4a5160, 0.5, 0.4), x, 0.35, z);
  bin(-4.6, 13.6);
  bin(8.9, 20.0);
  const vend = new THREE.Group();
  box(1.0, 1.9, 0.8, std(0xc0392b, 0.35, 0.3), 0, 0.95, 0, vend);
  const vf = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.3, 1.4), toneMapped: false }));
  vf.position.set(0, 1.12, 0.41);
  vend.add(vf);
  for (let i = 0; i < 5; i++) box(0.62, 0.02, 0.02, std(0x9aa0ad, 0.4, 0.8), 0, 0.7 + i * 0.22, 0.43, vend);
  vend.position.set(HALL.minX + 0.6, 0, 10.6);
  vend.rotation.y = Math.PI / 2;
  g.add(vend);

  // ---------- 後場:倉庫、辦公室、休息室、廁所與服務櫃檯 ----------
  const back = buildBackOfHouse();
  g.add(back.group);

  // ---------- 室內照明 ----------
  g.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3b30, 0.5));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.45);
  sun.position.set(-8, 30, 26);
  sun.target.position.set(0, 0, 4);
  sun.castShadow = !isMobile;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  g.add(sun, sun.target);
  for (const [x, z, c, i] of [[0, 17, 0xffe6c4, 14], [-6, 16, 0xffe6c4, 8], [6, 16, 0xffe6c4, 8], [-14, 8, 0xe8f0ff, 10], [14, 12, 0xfff0d8, 10]] as const) {
    const l = new THREE.PointLight(c, i, 12, 2);
    l.position.set(x, 3.2, z);
    g.add(l);
  }

  return {
    group: g,
    setShelfStock: (n: number) => back.setStock(n),
    setWcDirt: (id, d) => back.setWcDirt(id, d),
  };
}
