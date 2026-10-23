import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAGE_SCALE, FIELD, PLAY_Y, SHELL } from './config';
import type { StockItem } from './economy';
import type { Grid, MachineTheme } from './layout';
import { typeById } from './plush';
import { glowTexture, marqueeTexture, panelTexture } from './textures';

const PILES = 8;
const W = SHELL.w;
const D = SHELL.d;
const TOP = PLAY_Y + FIELD.height * CAGE_SCALE;
const BALLOONS = [0xff4f6d, 0x4fa8ff, 0xffd23f, 0x58d68d];

function colored(w: number, h: number, d: number, x: number, y: number, z: number, shade: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new Float32Array(g.attributes.position.count * 3).fill(shade);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** 簡化版機台外殼:黃色(依主題上色)的外框、櫃身、招牌箱、投幣箱 */
function bodyGeometry() {
  const F = 0.07;
  const postH = TOP - PLAY_Y;
  const parts = [
    colored(W, 0.8, D, 0, 0.53, 0, 1),
    colored(W + 0.02, 0.06, D + 0.02, 0, PLAY_Y - 0.03, 0, 0.8),
    colored(W + 0.02, 0.28, D + 0.02, 0, TOP + 0.14, 0, 0.8),
    colored(W + 0.05, 0.03, D + 0.05, 0, TOP + 0.295, 0, 1),
    colored(0.34, 0.42, 0.17, 0.14, 0.6, D / 2 + 0.085, 1),
    colored(W - 0.05, 0.06, D - 0.05, 0, 0.1, 0, 0.12),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(colored(F, postH, F, sx * (W / 2 - F / 2), PLAY_Y + postH / 2, sz * (D / 2 - F / 2), 1));
  parts.push(colored(W, 0.06, F, 0, TOP - 0.03, D / 2 - F / 2, 1), colored(W, 0.06, F, 0, TOP - 0.03, -D / 2 + F / 2, 1));
  for (const sx of [-1, 1]) parts.push(colored(F, 0.06, D, sx * (W / 2 - F / 2), TOP - 0.03, 0, 1));
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** 遠景層:60 台機台以實例化方式一次畫完。近看的機台會暫時隱藏對應實例,改畫完整版。 */
export class LiteLayer {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private felt: THREE.InstancedMesh;
  private back: THREE.InstancedMesh;
  private glass: THREE.InstancedMesh;
  private led: THREE.InstancedMesh;
  private balloons: THREE.InstancedMesh;
  private pile: THREE.InstancedMesh;
  private shadow: THREE.InstancedMesh;
  /** 依主題分組的招牌與印花面板(每個主題各一組實例化網格) */
  private decals: { sign: THREE.InstancedMesh; front: THREE.InstancedMesh; left: THREE.InstancedMesh; right: THREE.InstancedMesh; ids: number[] }[] = [];
  private decalOf: { g: number; k: number }[] = [];
  private mats = new Map<THREE.InstancedMesh, THREE.Matrix4[]>();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private pileLocal: THREE.Vector3[][] = [];
  private visiblePiles: number[] = [];
  private tmp = new THREE.Matrix4();
  private tmpC = new THREE.Color();
  private ring?: THREE.Mesh;

  constructor(private grids: Grid[], themes: MachineTheme[]) {
    const n = grids.length;
    this.body = new THREE.InstancedMesh(bodyGeometry(), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2 }), n);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    const inner = new THREE.PlaneGeometry(W - 2 * 0.07, 0.6 - 0.0);
    inner.rotateX(-Math.PI / 2);
    this.felt = new THREE.InstancedMesh(new THREE.PlaneGeometry(W - 0.14, D - 0.14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4a9c4, roughness: 0.95 }), n);
    this.back = new THREE.InstancedMesh(new THREE.PlaneGeometry(W - 0.14, TOP - PLAY_Y), new THREE.MeshStandardMaterial({ color: 0x4b3c86, roughness: 0.6, emissive: 0x241a52, emissiveIntensity: 0.6 }), n);
    this.glass = new THREE.InstancedMesh(
      new THREE.BoxGeometry(W - 0.14, TOP - PLAY_Y, D - 0.14),
      new THREE.MeshPhysicalMaterial({ color: 0xdde9ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }),
      n,
    );
    this.glass.renderOrder = 3;
    this.led = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    this.balloons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1 }), n * 3);
    this.pile = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.95 }), n * PILES);
    this.shadow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.7, 1.45).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,1)'), transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      n,
    );
    this.shadow.renderOrder = 1;
    this.group.add(this.shadow, this.body, this.felt, this.back, this.pile, this.glass, this.led, this.balloons);

    // 招牌與印花面板,依主題分組
    const byTheme = new Map<string, number[]>();
    themes.forEach((t, i) => byTheme.set(t.title, [...(byTheme.get(t.title) ?? []), i]));
    this.decalOf = new Array(n);
    for (const ids of byTheme.values()) {
      const t = themes[ids[0]];
      const signMat = new THREE.MeshBasicMaterial({ map: marqueeTexture(t.title, t.sub, t.hue), toneMapped: false });
      const panelMat = new THREE.MeshStandardMaterial({ map: panelTexture(t.hue, t.mascot), roughness: 0.45 });
      const mk = (geo: THREE.PlaneGeometry, mt: THREE.Material) => {
        const m = new THREE.InstancedMesh(geo, mt, ids.length);
        this.group.add(m);
        return m;
      };
      this.decals.push({
        sign: mk(new THREE.PlaneGeometry(W - 0.04, 0.23), signMat),
        front: mk(new THREE.PlaneGeometry(W - 0.08, 0.64), panelMat),
        left: mk(new THREE.PlaneGeometry(D - 0.08, 0.64), panelMat),
        right: mk(new THREE.PlaneGeometry(D - 0.08, 0.64), panelMat),
        ids,
      });
      ids.forEach((m, k) => (this.decalOf[m] = { g: this.decals.length - 1, k }));
    }

    const rnd = (seed: number) => {
      let s = seed * 9301 + 49297;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    };
    const M = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    for (let i = 0; i < n; i++) {
      const g = grids[i];
      this.set(this.body, i, M(g.x, 0, g.z));
      this.set(this.felt, i, M(g.x, PLAY_Y + 0.004, g.z));
      this.set(this.back, i, M(g.x, PLAY_Y + (TOP - PLAY_Y) / 2, g.z - (D / 2 - 0.1)));
      this.set(this.glass, i, M(g.x, PLAY_Y + (TOP - PLAY_Y) / 2, g.z));
      this.set(this.led, i, M(g.x, TOP + 0.34, g.z + D / 2 - 0.1));
      this.set(this.shadow, i, M(g.x, 0.03, g.z + 0.08));
      const dk = this.decalOf[i];
      const dd = this.decals[dk.g];
      this.set(dd.sign, dk.k, M(g.x, TOP + 0.14, g.z + D / 2 + 0.014));
      this.set(dd.front, dk.k, M(g.x, 0.53, g.z + D / 2 + 0.002));
      this.set(dd.left, dk.k, M(g.x - W / 2 - 0.002, 0.53, g.z, -Math.PI / 2));
      this.set(dd.right, dk.k, M(g.x + W / 2 + 0.002, 0.53, g.z, Math.PI / 2));
      this.body.setColorAt(i, this.tmpC.set(themes[i].accent));
      this.led.setColorAt(i, this.tmpC.setRGB(0.4, 0.4, 0.4));
      for (let b = 0; b < 3; b++) {
        this.balloons.setColorAt(i * 3 + b, this.tmpC.set(BALLOONS[(i + b) % BALLOONS.length]));
        this.set(this.balloons, i * 3 + b, M(g.x - W / 2 + 0.1 + b * 0.075, TOP + 0.45 + (b % 2) * 0.05, g.z - 0.05 + (b % 2) * 0.1));
      }
      const r = rnd(i + 1);
      this.pileLocal[i] = Array.from({ length: PILES }, () => new THREE.Vector3((r() - 0.5) * 0.62, 0.065 + r() * 0.04, (r() - 0.5) * 0.46));
      this.visiblePiles[i] = -1;
    }
    this.body.instanceColor!.needsUpdate = true;
    this.led.instanceColor!.needsUpdate = true;
    this.balloons.instanceColor!.needsUpdate = true;
  }

  private set(mesh: THREE.InstancedMesh, k: number, m: THREE.Matrix4) {
    let arr = this.mats.get(mesh);
    if (!arr) {
      arr = [];
      this.mats.set(mesh, arr);
    }
    arr[k] = m.clone();
    mesh.setMatrixAt(k, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private show(mesh: THREE.InstancedMesh, k: number, visible: boolean) {
    mesh.setMatrixAt(k, visible ? this.mats.get(mesh)![k] : this.zero);
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** 該台改畫完整版時隱藏遠景實例 */
  hide(i: number, hidden: boolean) {
    for (const m of [this.body, this.felt, this.back, this.glass, this.led, this.shadow]) this.show(m, i, !hidden);
    for (let b = 0; b < 3; b++) this.show(this.balloons, i * 3 + b, !hidden);
    const dk = this.decalOf[i];
    const dd = this.decals[dk.g];
    for (const m of [dd.sign, dd.front, dd.left, dd.right]) this.show(m, dk.k, !hidden);
    if (hidden) for (let j = 0; j < PILES; j++) this.pile.setMatrixAt(i * PILES + j, this.zero);
    else this.visiblePiles[i] = -1;
    this.pile.instanceMatrix.needsUpdate = true;
  }

  /** 選取光圈 */
  setSelected(i: number) {
    if (!this.ring) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78, 0.88, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.4), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.renderOrder = 2;
      this.group.add(this.ring);
    }
    const g = this.grids[i];
    this.ring.position.set(g.x, 0.05, g.z + 0.25);
  }

  setLed(i: number, r: number, g: number, b: number) {
    this.led.setColorAt(i, this.tmpC.setRGB(r, g, b));
    this.led.instanceColor!.needsUpdate = true;
  }

  /** 依庫存更新娃娃堆(數量與顏色) */
  setPile(i: number, count: number, items?: StockItem[]) {
    if (items) {
      for (let j = 0; j < PILES; j++) {
        const it = items.length ? items[Math.floor((j / PILES) * items.length)] : null;
        this.pile.setColorAt(i * PILES + j, this.tmpC.set(it ? typeById(it.typeId).body : 0xddc8b0));
      }
      if (this.pile.instanceColor) this.pile.instanceColor.needsUpdate = true;
      this.visiblePiles[i] = -1;
    }
    const vis = count <= 0 ? 0 : Math.min(PILES, Math.ceil(count / 3));
    if (vis === this.visiblePiles[i]) return;
    this.visiblePiles[i] = vis;
    const g = this.grids[i];
    for (let j = 0; j < PILES; j++) {
      if (j < vis) {
        const p = this.pileLocal[i][j];
        const s = 0.07 + Math.min(1, count / 24) * 0.02;
        this.tmp.makeScale(s, s * 0.9, s).setPosition(g.x + p.x, PLAY_Y + p.y + (j >= 4 ? 0.07 : 0), g.z + p.z);
        this.pile.setMatrixAt(i * PILES + j, this.tmp);
      } else this.pile.setMatrixAt(i * PILES + j, this.zero);
    }
    this.pile.instanceMatrix.needsUpdate = true;
  }
}
