import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rarity } from './config';
import { furBumpTexture } from './textures';

export interface PlushType {
  id: string;
  name: string;
  body: number;
  belly: number;
  ear: 'round' | 'long' | 'point';
  earColor: number;
  muzzle?: number;
  beak?: number;
  eyePatch?: number;
  cheek?: number;
}

export const PLUSH_TYPES: PlushType[] = [
  { id: 'bear', name: '小熊', body: 0xb9794a, belly: 0xe8c9a0, ear: 'round', earColor: 0xa56a3f, muzzle: 0xe8c9a0 },
  { id: 'bunny', name: '兔兔', body: 0xf3e7ee, belly: 0xffffff, ear: 'long', earColor: 0xf6b8cf, muzzle: 0xffffff, cheek: 0xffa6c4 },
  { id: 'chick', name: '小雞', body: 0xffd84a, belly: 0xffeea0, ear: 'point', earColor: 0xffd84a, beak: 0xff8a2a, cheek: 0xff9d7a },
  { id: 'panda', name: '熊貓', body: 0xf5f5f5, belly: 0xffffff, ear: 'round', earColor: 0x1d1d22, muzzle: 0xffffff, eyePatch: 0x1d1d22 },
  { id: 'cat', name: '貓咪', body: 0x8fa4c4, belly: 0xdfe8f5, ear: 'point', earColor: 0x7589aa, muzzle: 0xdfe8f5, cheek: 0xffb3c6 },
  { id: 'shiba', name: '柴犬', body: 0xe0a05a, belly: 0xfff0d8, ear: 'point', earColor: 0xc98640, muzzle: 0xfff0d8 },
];

export const PLUSH_BODY_R = 0.13;
export const PLUSH_HEAD_R = 0.1;
export const PLUSH_HEAD_Y = 0.165;

const furBump = furBumpTexture();
const furCache = new Map<number, THREE.MeshPhysicalMaterial>();
function fur(color: number) {
  let m = furCache.get(color);
  if (!m) {
    const c = new THREE.Color(color);
    m = new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.95,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.6),
      bumpMap: furBump,
      bumpScale: 2.2,
    });
    furCache.set(color, m);
  }
  return m;
}

const glossy = (color: number) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
const eyeMat = glossy(0x0c0c10);
const noseMat = glossy(0x2a1a18);
const beakMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });

const sphereGeo = new THREE.SphereGeometry(1, 18, 12);
const coneGeo = new THREE.ConeGeometry(1, 1, 14);

function ellipsoid(mat: THREE.Material, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const typeById = (id: string) => PLUSH_TYPES.find((t) => t.id === id) ?? PLUSH_TYPES[0];

export function pickRarity(): Rarity {
  const r = Math.random();
  if (r < 0.05) return 'ssr';
  if (r < 0.3) return 'rare';
  return 'common';
}

/** 程序化生成毛絨玩偶。本地座標:原點在身體中心,臉朝 +z。 */
function buildParts(type: PlushType, rarity: Rarity): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = fur(type.body);
  const bellyMat = fur(type.belly);
  const earMat = fur(type.earColor);

  g.add(ellipsoid(bodyMat, PLUSH_BODY_R, PLUSH_BODY_R * 1.03, PLUSH_BODY_R * 0.95));
  g.add(ellipsoid(bellyMat, 0.085, 0.09, 0.05, 0, -0.01, 0.1));

  // 頭
  const head = new THREE.Group();
  head.position.set(0, PLUSH_HEAD_Y, 0.01);
  head.add(ellipsoid(bodyMat, PLUSH_HEAD_R * 1.08, PLUSH_HEAD_R * 0.96, PLUSH_HEAD_R));
  g.add(head);

  // 耳朵
  for (const s of [-1, 1]) {
    if (type.ear === 'round') {
      head.add(ellipsoid(earMat, 0.038, 0.038, 0.025, s * 0.072, 0.082, -0.01));
    } else if (type.ear === 'long') {
      const e = ellipsoid(earMat, 0.032, 0.11, 0.022, s * 0.045, 0.17, -0.01);
      e.rotation.z = -s * 0.18;
      head.add(e);
    } else {
      const e = new THREE.Mesh(coneGeo, earMat);
      e.scale.set(0.045, 0.075, 0.03);
      e.position.set(s * 0.065, 0.095, -0.005);
      e.rotation.z = -s * 0.35;
      e.castShadow = true;
      head.add(e);
    }
  }

  // 眼睛(熊貓有黑眼圈)
  for (const s of [-1, 1]) {
    if (type.eyePatch) head.add(ellipsoid(fur(type.eyePatch), 0.024, 0.03, 0.012, s * 0.04, 0.012, 0.089));
    head.add(ellipsoid(eyeMat, 0.0135, 0.0165, 0.01, s * 0.04, 0.012, 0.096));
    const hl = ellipsoid(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.004, 0.004, 0.003, s * 0.04 + 0.004, 0.02, 0.105);
    hl.castShadow = false;
    head.add(hl);
    if (type.cheek) {
      const ch = ellipsoid(new THREE.MeshStandardMaterial({ color: type.cheek, roughness: 1, transparent: true, opacity: 0.55 }), 0.02, 0.013, 0.006, s * 0.065, -0.022, 0.088);
      ch.castShadow = false;
      head.add(ch);
    }
  }

  // 口鼻
  if (type.beak) {
    const b = new THREE.Mesh(coneGeo, beakMat(type.beak));
    b.scale.set(0.022, 0.03, 0.022);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, -0.012, 0.11);
    b.castShadow = true;
    head.add(b);
  } else {
    if (type.muzzle) head.add(ellipsoid(fur(type.muzzle), 0.04, 0.032, 0.03, 0, -0.025, 0.083));
    head.add(ellipsoid(noseMat, 0.014, 0.01, 0.01, 0, -0.008, 0.108));
  }

  // 四肢
  for (const s of [-1, 1]) {
    const arm = ellipsoid(bodyMat, 0.04, 0.065, 0.04, s * 0.128, 0.0, 0.03);
    arm.rotation.z = s * 0.35;
    g.add(arm);
    g.add(ellipsoid(bodyMat, 0.05, 0.045, 0.065, s * 0.07, -0.115, 0.075));
  }
  // 尾巴
  g.add(ellipsoid(type.id === 'bunny' ? fur(0xffffff) : bodyMat, 0.04, 0.04, 0.04, 0, -0.08, -0.125));

  // 稀有度:緞帶蝴蝶結
  if (rarity !== 'common') {
    const col = rarity === 'ssr' ? 0xffc83a : 0xff3d6e;
    const ribbon = new THREE.MeshPhysicalMaterial({
      color: col,
      roughness: 0.3,
      metalness: rarity === 'ssr' ? 0.8 : 0,
      clearcoat: 1,
      emissive: rarity === 'ssr' ? 0x6b4a00 : 0x000000,
    });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(coneGeo, ribbon);
      w.scale.set(0.035, 0.05, 0.015);
      w.rotation.z = s * Math.PI / 2;
      w.position.set(s * 0.035, 0.07, 0.1);
      w.castShadow = true;
      g.add(w);
    }
    g.add(ellipsoid(ribbon, 0.014, 0.014, 0.012, 0, 0.07, 0.1));
  }
  return g;
}

/** 把同材質的零件合併成單一網格,大幅減少繪製次數(多台機台時很重要) */
export function buildPlush(type: PlushType, rarity: Rarity): THREE.Group {
  const parts = buildParts(type, rarity);
  parts.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  parts.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const list = buckets.get(m.material as THREE.Material) ?? [];
    list.push(geo);
    buckets.set(m.material as THREE.Material, list);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    const basic = (material as THREE.Material).type === 'MeshBasicMaterial';
    mesh.castShadow = !basic;
    mesh.receiveShadow = !basic;
    out.add(mesh);
    for (const g of geos) g.dispose();
  }
  return out;
}
