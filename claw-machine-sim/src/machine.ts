import * as THREE from 'three';
import { Cabinet } from './cabinet';
import { ClawRig } from './claw';
import { BASE_HEIGHT, CLAW, DROP_POINT, Rarity } from './config';
import type { Customer } from './customers';
import { PLUSH_COST, StockItem } from './economy';
import { Grid, MachineTheme, machineStation, serviceSpot } from './layout';
import { Physics, PlushEntity } from './physics';
import { PlushType, typeById } from './plush';

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

export type ServiceKind = 'restock' | 'clean' | 'assist' | 'fix' | 'retrieve';
export const SERVICE_LABEL: Record<ServiceKind, string> = {
  restock: '補貨中',
  clean: '清潔中',
  assist: '協助客人',
  fix: '維修中',
  retrieve: '取出卡住的獎品',
};

/** 獎品:近看時是 PlushEntity,遠景時是由庫存清單產生的簡化物件 */
export interface Prize {
  type: PlushType;
  rarity: Rarity;
  cost: number;
}

export interface MachineEvents {
  onGrab(): void;
  onSlip(): void;
  onWin(p: Prize, stuck: boolean): void;
  /** 客人的一局結束 */
  onEnd(): void;
  /** 爪子回到待機位,但不是客人的局(試玩) */
  onManualEnd(): void;
  onState(s: string): void;
}
const noop = () => {};
const NO_EVENTS: MachineEvents = { onGrab: noop, onSlip: noop, onWin: noop, onEnd: noop, onManualEnd: noop, onState: noop };

const LITE_PHASES = ['aim', 'down', 'close', 'lift', 'travel', 'release', 'back'] as const;
interface LiteRound {
  i: number;
  t: number;
  dur: number[];
  win: boolean;
  grabbed: boolean;
  slipped: boolean;
  slipFired: boolean;
  winFired: boolean;
}

const prizeOf = (it: StockItem): Prize => ({ type: typeById(it.typeId), rarity: it.rarity, cost: PLUSH_COST[it.rarity] });

/** 一台機台:近看時有完整 3D 與物理世界,遠景時只有庫存清單與機率模型 */
export class Machine {
  readonly g: Grid;
  readonly theme: MachineTheme;
  items: StockItem[];
  mode: 'lite' | 'full' = 'lite';
  cabinet?: Cabinet;
  physics?: Physics;
  claw?: ClawRig;
  readonly pilot = new Pilot();
  readonly line: Customer[] = [];
  roundActive = false;
  /** 員工正在作業:客人不能開始新局 */
  service: ServiceKind | null = null;
  /** 員工已在趕來,先不要開始新局 */
  blocking = false;
  fault = false;
  /** 想切換成近看層,等這一局結束後不再開新局 */
  pendingSwap = false;
  stuck: Prize | null = null;
  private stuckEntity: PlushEntity | null = null;
  stuckChance = 0.02;
  readonly reserved = new Set<string>();
  dirt = 0.15;
  plays = 0;
  wins = 0;
  strength = 0.4;
  events: MachineEvents = NO_EVENTS;
  /** 試玩中(近看層專用) */
  manual = false;
  private lr: LiteRound | null = null;
  private nudgeT = 0;
  readonly handL: THREE.Vector3;
  readonly handR: THREE.Vector3;

  constructor(readonly index: number, g: Grid, theme: MachineTheme, items: StockItem[], private scene: THREE.Object3D, private shadowSize: number) {
    this.g = g;
    this.theme = theme;
    this.items = items;
    // 操作台上搖桿與按鈕的世界座標
    this.handL = new THREE.Vector3(g.x + 0.3, 1.04, g.z + 0.97);
    this.handR = new THREE.Vector3(g.x + 0.62, 0.88, g.z + 0.92);
  }

  get x() {
    return this.g.x;
  }
  get z() {
    return this.g.z;
  }
  get name() {
    return `${this.index + 1}號機`;
  }
  get stock() {
    return this.mode === 'full' ? this.physics!.count : this.items.length;
  }
  /** 存檔用的庫存清單 */
  get snapshotItems(): StockItem[] {
    return this.mode === 'full' ? this.physics!.stockItems() : this.items;
  }
  get blocked() {
    return this.fault || !!this.stuck || !!this.service || this.blocking || this.pendingSwap;
  }
  station(i: number) {
    return machineStation(this.g, i);
  }
  servicePos() {
    return serviceSpot(this.g);
  }
  localToWorld(out: THREE.Vector3, x: number, y: number, z: number) {
    return out.set(this.g.x + x, BASE_HEIGHT + y, this.g.z + z);
  }

  /** 可以安全切換細節層 */
  get canSwap() {
    if (this.roundActive || this.service || this.blocking || this.manual) return false;
    if (this.mode === 'full') return this.claw!.state === 'idle' && !this.physics!.plushes.some((p) => p.won);
    return !this.lr;
  }

  // ---------- 細節層切換 ----------
  promote() {
    if (this.mode === 'full') return;
    this.pendingSwap = false;
    const cabinet = new Cabinet(this.shadowSize, this.theme);
    cabinet.group.position.set(this.g.x, BASE_HEIGHT, this.g.z);
    this.scene.add(cabinet.group);
    const physics = new Physics();
    physics.fillItems(this.items);
    for (const p of physics.plushes) cabinet.group.add(p.mesh);
    physics.syncMeshes();
    const claw = new ClawRig(physics);
    claw.strength = this.strength;
    cabinet.group.add(claw.group);
    claw.events.onGrab = () => this.events.onGrab();
    claw.events.onSlip = () => this.events.onSlip();
    claw.events.onState = (s) => {
      this.events.onState(s);
      if (s === 'idle') {
        if (this.roundActive) this.events.onEnd();
        else this.events.onManualEnd();
      }
    };
    this.cabinet = cabinet;
    this.physics = physics;
    this.claw = claw;
    this.mode = 'full';
    if (this.stuck) {
      const e = physics.spawnPlush(0, 0.3, 0, this.stuck.type, this.stuck.rarity);
      cabinet.group.add(e.mesh);
      physics.makeStuck(e);
      this.stuckEntity = e;
    }
    cabinet.setDisplay(this.fault ? 'ERROR' : 'CREDIT', this.fault ? 'OUT' : '---');
  }

  demote() {
    if (this.mode === 'lite') return;
    this.items = this.physics!.stockItems();
    for (const p of this.physics!.plushes) this.cabinet!.group.remove(p.mesh);
    this.scene.remove(this.cabinet!.group);
    this.cabinet!.dispose();
    this.physics!.dispose();
    this.cabinet = undefined;
    this.physics = undefined;
    this.claw = undefined;
    this.stuckEntity = null;
    this.mode = 'lite';
  }

  // ---------- 一局 ----------
  beginRound(skill: number, rare: number) {
    this.roundActive = true;
    this.plays++;
    if (this.mode === 'full') {
      this.claw!.strength = this.strength;
      this.claw!.begin();
      this.pilot.start(skill, rare, this.physics!);
      return;
    }
    // 與近看層實測的成功率曲線一致:30%→約 25%、50%→約 40%、80%→約 60%
    const pWin = Math.min(0.9, 0.75 * Math.pow(this.strength, 0.9) * (0.8 + 0.4 * skill));
    const win = this.items.length > 0 && Math.random() < pWin;
    const grabbed = win || Math.random() < 0.62;
    this.lr = {
      i: 0,
      t: 0,
      dur: [2.5 + (1 - skill) * 3, 2.0, 0.9, 1.3, 2.0, 1.6, 1.2],
      win,
      grabbed,
      slipped: grabbed && !win,
      slipFired: false,
      winFired: false,
    };
  }

  pilotInput(dt: number, skill: number) {
    return this.pilot.input(dt, this.claw!, skill);
  }

  /** 中止目前這局(故障時) */
  abortRound() {
    this.lr = null;
    this.roundActive = false;
    if (this.mode === 'full') this.claw!.reset();
  }

  step(dt: number, manualInput: { x: number; z: number }, pilotSkill: number) {
    if (this.mode === 'full') {
      const claw = this.claw!;
      if (this.fault) return;
      const inp = this.roundActive ? this.pilot.input(dt, claw, pilotSkill) : this.manual ? manualInput : { x: 0, z: 0 };
      claw.update(dt, inp);
      this.physics!.world.step();
      return;
    }
    if (this.nudgeT > 0) {
      this.nudgeT -= dt;
      if (this.nudgeT <= 0 && this.items.length) this.winLite();
    }
    const lr = this.lr;
    if (!lr || this.fault) return;
    lr.t += dt;
    const phase = LITE_PHASES[lr.i];
    if (phase === 'lift' && lr.slipped && !lr.slipFired && lr.t >= lr.dur[lr.i] * 0.6) {
      lr.slipFired = true;
      this.events.onSlip();
    }
    if (phase === 'release' && lr.win && !lr.winFired && lr.t >= 0.8) {
      lr.winFired = true;
      this.winLite();
    }
    if (lr.t >= lr.dur[lr.i]) {
      lr.i++;
      lr.t = 0;
      if (lr.i < LITE_PHASES.length && LITE_PHASES[lr.i] === 'lift' && lr.grabbed) this.events.onGrab();
      if (lr.i >= LITE_PHASES.length) {
        this.lr = null;
        this.events.onEnd();
      }
    }
  }

  private winLite() {
    const idx = Math.floor(Math.random() * this.items.length);
    const [it] = this.items.splice(idx, 1);
    if (!it) return;
    const prize = prizeOf(it);
    if (Math.random() < this.stuckChance) {
      this.stuck = prize;
      this.events.onWin(prize, true);
    } else this.events.onWin(prize, false);
  }

  /** 每個畫面幀:同步近看層的畫面並偵測得獎 */
  frameSync(simTime: number) {
    if (this.mode !== 'full') return;
    const physics = this.physics!;
    const cabinet = this.cabinet!;
    const claw = this.claw!;
    physics.syncMeshes();
    cabinet.setClawPos(claw.pos.x, claw.pos.y, claw.pos.z);
    for (const p of physics.detectWins(simTime)) {
      if (Math.random() < this.stuckChance) {
        physics.makeStuck(p);
        this.stuck = { type: p.type, rarity: p.rarity, cost: p.cost };
        this.stuckEntity = p;
        this.events.onWin(p, true);
      } else this.events.onWin(p, false);
    }
    for (const p of [...physics.plushes]) {
      if (p.won && simTime - p.wonAt > 1.2) {
        cabinet.group.remove(p.mesh);
        physics.remove(p);
      }
    }
  }

  // ---------- 員工與事件 ----------
  addItems(items: StockItem[]) {
    if (this.mode === 'full') {
      for (const p of this.physics!.dropIn(items)) this.cabinet!.group.add(p.mesh);
    } else this.items.push(...items);
  }

  breakDown() {
    this.fault = true;
    this.abortRound();
    if (this.mode === 'full') this.cabinet!.setDisplay('ERROR', 'OUT');
  }
  repair() {
    this.fault = false;
    if (this.mode === 'full') this.cabinet!.setDisplay('CREDIT', '---');
  }

  /** 取出卡住的獎品 */
  retrievePrize(): Prize | null {
    const p = this.stuck;
    this.stuck = null;
    if (this.stuckEntity && this.mode === 'full') {
      this.cabinet!.group.remove(this.stuckEntity.mesh);
      this.physics!.remove(this.stuckEntity);
    }
    this.stuckEntity = null;
    return p;
  }

  /** 店員協助:近看層把最靠近出口的娃娃推一把;遠景層有機會直接掉出 */
  assistNudge() {
    if (this.mode === 'full') return !!this.physics!.assistNudge();
    if (this.items.length && Math.random() < 0.4) {
      this.nudgeT = 1.2;
      return true;
    }
    return false;
  }
}
