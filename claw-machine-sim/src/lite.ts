import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASE_HEIGHT } from './config';
import type { StockItem } from './economy';
import type { Grid, MachineTheme } from './layout';
import { typeById } from './plush';
import { glowTexture, marqueeTexture } from './textures';

const PILES = 8;

function colored(w: number, h: number, d: number, x: number, y: number, z: number, shade: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3).fill(shade);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** 簡化版機台外殼:深色機身與彩色飾條分開,飾條依主題上色 */
function bodyGeometry() {
  const parts = [
    colored(1.7, 0.95, 1.4, 0, -0.475, 0, 1),
    colored(1.7, 0.78, 0.42, 0, -0.56, 0.91, 1),
    colored(0.1, 1.6, 0.1, -0.8, 0.8, -0.65, 1),
    colored(0.1, 1.6, 0.1, 0.8, 0.8, -0.65, 1),
    colored(0.1, 1.6, 0.1, -0.8, 0.8, 0.65, 1),
    colored(0.1, 1.6, 0.1, 0.8, 0.8, 0.65, 1),
    colored(1.5, 1.6, 0.04, 0, 0.8, -0.62, 0.55),
    colored(1.5, 0.05, 1.2, 0, -0.025, 0, 0.7),
    colored(1.7, 0.66, 1.4, 0, 1.93, 0, 1),
  ];
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}
function trimGeometry() {
  const parts = [
    colored(1.72, 0.04, 1.42, 0, -0.93, 0, 1),
    colored(1.7, 0.05, 0.44, 0, -0.14, 0.9, 1),
    ...frame(1.62),
    ...frame(2.26),
  ];
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** 招牌箱上下緣的邊框(四根細條,不是整片頂板) */
function frame(y: number) {
  return [
    colored(1.72, 0.05, 0.06, 0, y, 0.68, 1),
    colored(1.72, 0.05, 0.06, 0, y, -0.68, 1),
    colored(0.06, 0.05, 1.42, 0.83, y, 0, 1),
    colored(0.06, 0.05, 1.42, -0.83, y, 0, 1),
  ];
}

/** 遠景層:60 台機台以實例化方式一次畫完。近看的機台會暫時隱藏對應實例,改畫完整版。 */
export class LiteLayer {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private trim: THREE.InstancedMesh;
  private glass: THREE.InstancedMesh;
  private led: THREE.InstancedMesh;
  private pile: THREE.InstancedMesh;
  private shadow: THREE.InstancedMesh;
  private marquees: { mesh: THREE.InstancedMesh; ids: number[] }[] = [];
  private marqueeOf: { m: number; k: number }[] = [];
  private mats = new Map<THREE.InstancedMesh, THREE.Matrix4[]>();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private pileLocal: THREE.Vector3[][] = [];
  private pileColor: THREE.Color[][] = [];
  private visiblePiles: number[] = [];
  private tmp = new THREE.Matrix4();
  private tmpC = new THREE.Color();

  constructor(private grids: Grid[], themes: MachineTheme[]) {
    const n = grids.length;
    const bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0x1c1e28, roughness: 0.34, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    this.body = new THREE.InstancedMesh(bodyGeometry(), bodyMat, n);
    this.trim = new THREE.InstancedMesh(trimGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1 }), n);
    this.glass = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.52, 1.6, 1.24),
      new THREE.MeshPhysicalMaterial({ color: 0xdde9ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }),
      n,
    );
    this.led = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    this.pile = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.95 }), n * PILES);
    this.shadow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(3.2, 2.9),
      new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,1)'), transparent: true, opacity: 0.55, depthWrite: false }),
      n,
    );
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.glass.renderOrder = 3;
    this.group.add(this.shadow, this.body, this.trim, this.pile, this.glass, this.led);

    // 招牌:依主題分組,每個主題一個實例化網格
    const byTheme = new Map<string, number[]>();
    themes.forEach((t, i) => byTheme.set(t.title, [...(byTheme.get(t.title) ?? []), i]));
    this.marqueeOf = new Array(n);
    for (const [title, ids] of byTheme) {
      const t = themes[ids[0]];
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.56, 0.58),
        new THREE.MeshBasicMaterial({ map: marqueeTexture(t.title, t.sub, t.hue), toneMapped: false }),
        ids.length,
      );
      this.group.add(mesh);
      this.marquees.push({ mesh, ids });
      ids.forEach((m, k) => (this.marqueeOf[m] = { m: k, k: this.marquees.length - 1 }));
      void title;
    }

    const rnd = (seed: number) => {
      let s = seed * 9301 + 49297;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    };
    for (let i = 0; i < n; i++) {
      const g = grids[i];
      const base = new THREE.Matrix4().makeTranslation(g.x, BASE_HEIGHT, g.z);
      this.set(this.body, i, base);
      this.set(this.trim, i, base);
      this.set(this.glass, i, new THREE.Matrix4().makeTranslation(g.x, BASE_HEIGHT + 0.8, g.z));
      this.set(this.led, i, new THREE.Matrix4().makeTranslation(g.x, BASE_HEIGHT + 2.36, g.z + 0.55));
      this.set(this.shadow, i, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(g.x, 0.012, g.z + 0.3));
      const mq = this.marqueeOf[i];
      this.set(this.marquees[mq.k].mesh, mq.m, new THREE.Matrix4().makeTranslation(g.x, BASE_HEIGHT + 1.94, g.z + 0.705));
      this.trim.setColorAt(i, this.tmpC.set(themes[i].accent));
      this.led.setColorAt(i, this.tmpC.setRGB(0.4, 0.4, 0.4));
      const r = rnd(i + 1);
      this.pileLocal[i] = Array.from({ length: PILES }, () => new THREE.Vector3((r() - 0.5) * 1.1, 0.14 + r() * 0.1, (r() - 0.5) * 0.85));
      this.pileColor[i] = Array.from({ length: PILES }, () => new THREE.Color(0xddc8b0));
      this.visiblePiles[i] = -1;
    }
    this.trim.instanceColor!.needsUpdate = true;
    this.led.instanceColor!.needsUpdate = true;
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
    for (const m of [this.body, this.trim, this.glass, this.led, this.shadow]) this.show(m, i, !hidden);
    const mq = this.marqueeOf[i];
    this.show(this.marquees[mq.k].mesh, mq.m, !hidden);
    if (hidden) for (let j = 0; j < PILES; j++) this.pile.setMatrixAt(i * PILES + j, this.zero);
    else this.visiblePiles[i] = -1;
    this.pile.instanceMatrix.needsUpdate = true;
  }

  /** 選取光圈 */
  private ring?: THREE.Mesh;
  setSelected(i: number) {
    if (!this.ring) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 1.5, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.4), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.scale.set(1.15, 1, 1);
      this.group.add(this.ring);
    }
    const g = this.grids[i];
    this.ring.position.set(g.x, 0.03, g.z + 0.45);
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
        const body = it ? typeById(it.typeId).body : 0xddc8b0;
        this.pileColor[i][j].set(body);
        this.pile.setColorAt(i * PILES + j, this.pileColor[i][j]);
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
        const s = 0.15 + Math.min(1, count / 24) * 0.04;
        this.tmp.makeScale(s, s * 0.9, s).setPosition(g.x + p.x, BASE_HEIGHT + p.y + (j >= 4 ? 0.12 : 0), g.z + p.z);
        this.pile.setMatrixAt(i * PILES + j, this.tmp);
      } else this.pile.setMatrixAt(i * PILES + j, this.zero);
    }
    this.pile.instanceMatrix.needsUpdate = true;
  }
}
