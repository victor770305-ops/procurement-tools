import * as THREE from 'three';
import { Cabinet } from './cabinet';
import { ClawRig } from './claw';
import { BASE_HEIGHT, CHUTE_CENTER, CLAW, DROP_POINT } from './config';
import type { Customer } from './customers';
import type { StockItem } from './economy';
import { MachineTheme, machineStation, serviceSpot } from './layout';
import { Physics } from './physics';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

/** 電腦操作爪子的簡易駕駛員:挑目標 → 帶誤差瞄準 → 定住 → 放爪 */
export class Pilot {
  private t = 0;
  private think = 0;
  private settle = 0;
  private aim = new THREE.Vector2();
  private out = { x: 0, z: 0 };

  start(skill: number, rareLover: number, physics: Physics) {
    this.t = 0;
    this.settle = 0;
    this.think = 0.4 + (1 - skill) * rnd(0.6, 1.8);
    let best: { x: number; z: number } | null = null;
    let bestScore = -Infinity;
    for (const p of physics.plushes) {
      if (p.won) continue;
      const t = p.body.translation();
      if (t.y < 0.1 || t.x < CLAW.minX - 0.1 || t.x > CLAW.maxX + 0.1 || t.z < CLAW.minZ - 0.1 || t.z > CLAW.maxZ + 0.1) continue;
      const toChute = Math.hypot(t.x - DROP_POINT.x, t.z - DROP_POINT.z);
      const rare = p.rarity === 'common' ? 0 : p.rarity === 'rare' ? 0.5 : 1;
      const score = -toChute * 0.25 + t.y * 0.9 + rare * rareLover * 0.7 + gauss() * (1 - skill) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = { x: t.x, z: t.z };
      }
    }
    if (!best || Math.random() < (1 - skill) * 0.15) best = { x: rnd(CLAW.minX, CLAW.maxX), z: rnd(CLAW.minZ, CLAW.maxZ) };
    const err = (1 - skill) * 0.09;
    this.aim.set(
      THREE.MathUtils.clamp(best.x + gauss() * err, CLAW.minX, CLAW.maxX),
      THREE.MathUtils.clamp(best.z + gauss() * err, CLAW.minZ, CLAW.maxZ),
    );
  }

  input(dt: number, claw: ClawRig, skill: number) {
    this.t += dt;
    if (this.t < this.think) return this.stop();
    const dx = this.aim.x - claw.pos.x;
    const dz = this.aim.y - claw.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.025) {
      this.settle += dt;
      if (this.settle > 0.3 + (1 - skill) * 0.4) claw.drop();
      return this.stop();
    }
    this.settle = 0;
    if (this.t > 14) claw.drop();
    const k = Math.min(1, d / 0.14);
    this.out.x = (dx / d) * k;
    this.out.z = (dz / d) * k;
    return this.out;
  }

  private stop() {
    this.out.x = 0;
    this.out.z = 0;
    return this.out;
  }
}

export type ServiceKind = 'restock' | 'clean' | 'assist';
export const SERVICE_LABEL: Record<ServiceKind, string> = { restock: '補貨中', clean: '清潔中', assist: '協助客人' };

/** 一台機台 = 3D 外觀 + 獨立物理世界 + 爪子 + 排隊與維護狀態 */
export class Machine {
  readonly cabinet: Cabinet;
  readonly physics = new Physics();
  readonly claw: ClawRig;
  readonly pilot = new Pilot();
  readonly line: Customer[] = [];
  roundActive = false;
  /** 員工正在作業(補貨/協助):客人不能開始新局 */
  service: ServiceKind | null = null;
  /** 員工已在趕來,先不要開始新局 */
  blocking = false;
  readonly reserved = new Set<ServiceKind>();
  dirt = 0.15;
  plays = 0;
  wins = 0;

  constructor(readonly index: number, readonly x: number, readonly theme: MachineTheme, scene: THREE.Object3D, items: StockItem[], shadowSize: number) {
    this.cabinet = new Cabinet(shadowSize, theme);
    this.cabinet.group.position.set(x, BASE_HEIGHT, 0);
    scene.add(this.cabinet.group);
    this.physics.fillItems(items);
    for (const p of this.physics.plushes) this.cabinet.group.add(p.mesh);
    this.physics.syncMeshes();
    this.claw = new ClawRig(this.physics);
    this.cabinet.group.add(this.claw.group);
  }

  get name() {
    return this.theme.name;
  }
  get stock() {
    return this.physics.plushes.filter((p) => !p.won).length;
  }
  get busy() {
    return this.roundActive || this.claw.state !== 'idle';
  }
  station(i: number) {
    return machineStation(this.x, i);
  }
  servicePos() {
    return serviceSpot(this.x);
  }
  /** 取物口(出口)的世界座標,供店員協助時使用 */
  chuteWorld(out: THREE.Vector3) {
    return this.cabinet.group.localToWorld(out.set(CHUTE_CENTER.x, 0.2, CHUTE_CENTER.z));
  }
  addItems(items: StockItem[]) {
    for (const p of this.physics.dropIn(items)) this.cabinet.group.add(p.mesh);
  }
}
