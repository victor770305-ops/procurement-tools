import * as THREE from 'three';
import type { Customer } from './customers';
import type { Exchange } from './exchange';
import type { Machine } from './machine';

/** 地上的水漬(客人打翻飲料)。沒清掉之前,經過的客人可能滑倒。 */
export class Spill {
  readonly pos: THREE.Vector3;
  readonly radius: number;
  readonly mesh = new THREE.Group();
  cleaned = false;
  cleaning = false;
  reserved = false;
  age = 0;
  goneT = 0;
  private sign?: THREE.Group;

  constructor(pos: THREE.Vector3, private scene: THREE.Object3D) {
    this.pos = pos.clone();
    this.pos.y = 0;
    this.radius = 0.5 + Math.random() * 0.2;
    const color = pick([0x3a1c10, 0xd88a2a, 0x7fb0e8, 0xc23b52]);
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(this.radius, 28),
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.05;
    puddle.renderOrder = 2;
    puddle.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    puddle.rotation.z = Math.random() * 6;
    this.mesh.add(puddle);
    // 倒在旁邊的杯子
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
    );
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = Math.random() * 6;
    cup.position.set(this.radius * 0.5, 0.055, 0.1);
    cup.castShadow = true;
    this.mesh.add(cup);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  /** 店員到場:放上黃色告示牌 */
  placeSign() {
    if (this.sign) return;
    const g = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.025), yellow);
      p.position.set(0, 0.25, s * 0.07);
      p.rotation.x = s * 0.22;
      p.castShadow = true;
      g.add(p);
    }
    g.position.set(this.radius + 0.25, 0, -0.1);
    this.mesh.add(g);
    this.sign = g;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mt = m.material as THREE.Material;
        if (mt.type === 'MeshPhysicalMaterial') mt.dispose();
      }
    });
  }
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export interface EventHooks {
  isOpen(): boolean;
  customers(): Customer[];
  machines(): Machine[];
  exchanges(): Exchange[];
  spill(c: Customer): void;
  fault(m: Machine): void;
}

/** 隨機事件導演:依店內人數與機台數量擲骰。卡洞與兌幣機卡鈔在對應的動作中擲骰。 */
export class EventDirector {
  /** 每位在場客人每遊戲秒打翻飲料的機率 */
  spillRate = 0.00022;
  /** 全店每遊戲秒發生機台故障的機率 */
  faultRate = 0.011;
  /** 兌幣機每次使用卡鈔的機率 */
  jamChance = 0.008;
  /** 每次得獎卡在洞口的機率 */
  stuckChance = 0.02;
  /** 劇情帶來的倍率 */
  readonly mul = { spill: 1, fault: 1, jam: 1 };
  private acc = 0;

  constructor(private hooks: EventHooks) {}

  get jam() {
    return this.jamChance * this.mul.jam;
  }

  update(dt: number) {
    if (!this.hooks.isOpen()) return;
    this.acc += dt;
    if (this.acc < 1) return;
    const step = this.acc;
    this.acc = 0;
    const custs = this.hooks.customers().filter((c) => c.state !== 'leaving' && c.slipT <= 0 && c.cheer <= 0);
    if (custs.length && Math.random() < this.spillRate * this.mul.spill * custs.length * step) this.hooks.spill(custs[Math.floor(Math.random() * custs.length)]);
    if (Math.random() < this.faultRate * this.mul.fault * step) {
      const ms = this.hooks.machines().filter((m) => !m.fault && !m.service);
      // 正在玩的機台比較容易壞
      const busy = ms.filter((m) => m.roundActive || m.line.length);
      const pool = busy.length && Math.random() < 0.6 ? busy : ms;
      if (pool.length) this.hooks.fault(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
}
