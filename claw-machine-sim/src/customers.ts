import * as THREE from 'three';
import type { ClawRig } from './claw';
import { CLAW, DROP_POINT } from './config';
import { BASE_PRICE } from './economy';
import { Human, HumanOpts, Pose } from './human';
import type { Physics, PlushEntity } from './physics';

export type Kind = 'student' | 'couple' | 'pro' | 'kid';

interface KindCfg {
  label: string;
  weight: number;
  plays: [number, number];
  skill: number; // 0~1,影響瞄準精度
  sens: number; // 價格敏感度
  rare: number; // 偏好稀有款的程度
  patience: number; // 排隊耐心(遊戲秒)
  shirts: number[];
  accessory: HumanOpts['accessory'];
  scale: number;
  kid: boolean;
}

export const KINDS: Record<Kind, KindCfg> = {
  student: { label: '學生', weight: 0.38, plays: [2, 5], skill: 0.4, sens: 1.3, rare: 0.2, patience: 80, shirts: [0x3b6fd1, 0x2fa37a, 0xd9534f], accessory: 'backpack', scale: 1, kid: false },
  couple: { label: '情侶', weight: 0.22, plays: [3, 6], skill: 0.5, sens: 0.8, rare: 0.6, patience: 95, shirts: [0xe56b9a, 0x9b6bd3, 0xf0a43a], accessory: 'none', scale: 0.97, kid: false },
  pro: { label: '老手', weight: 0.2, plays: [4, 9], skill: 0.9, sens: 1.0, rare: 0.8, patience: 60, shirts: [0x2a313c, 0x3d4757, 0x5c3d2e], accessory: 'cap', scale: 1.03, kid: false },
  kid: { label: '小朋友', weight: 0.2, plays: [2, 4], skill: 0.2, sens: 0.6, rare: 0.1, patience: 100, shirts: [0xffc23d, 0x5ec8ff, 0xff7a7a], accessory: 'bow', scale: 0.72, kid: true },
};

const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68863, 0x8d5a3b];
const HAIRS = [0x1a1512, 0x3a2418, 0x6b4426, 0x2a2a30, 0xb9873a];
const PANTS = [0x2b3445, 0x3b3b44, 0x4a5568, 0x1f2a3a];

// 站位:第 0 格是操作位(機台右前方),後面往右後方排隊
export const station = (i: number) => (i === 0 ? new THREE.Vector3(0.8, 0, 1.38) : new THREE.Vector3(0.95 + 0.8 * i, 0, 1.55 - 0.42 * i));
const ENTRANCE = new THREE.Vector3(6.2, 0, 4.4);
export const MAX_LINE = 5;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export type LeaveReason = 'done' | 'angry' | 'impatient' | 'closed' | 'nostock';

export class Customer {
  readonly human: Human;
  readonly cfg: KindCfg;
  state: 'enter' | 'waiting' | 'playing' | 'leaving' = 'enter';
  mood = 0.25 + Math.random() * 0.2;
  budget: number;
  wait = 0;
  cool = 0;
  cheer = 0;
  sad = 0;
  bubble = '';
  bubbleT = 0;
  readonly target = new THREE.Vector3();
  removed = false;

  constructor(readonly kind: Kind, price: number) {
    this.cfg = KINDS[kind];
    this.human = new Human({
      skin: pick(SKINS),
      shirt: pick(this.cfg.shirts),
      pants: pick(PANTS),
      hair: pick(HAIRS),
      scale: this.cfg.scale,
      kid: this.cfg.kid,
      accessory: this.cfg.accessory,
    });
    const [lo, hi] = this.cfg.plays;
    const base = lo + Math.random() * (hi - lo);
    this.budget = Math.max(1, Math.round(base * Math.pow(BASE_PRICE / price, this.cfg.sens * 0.7)));
    this.human.group.position.copy(ENTRANCE);
  }

  say(text: string, sec = 2) {
    this.bubble = text;
    this.bubbleT = sec;
  }
  get pos() {
    return this.human.group.position;
  }
}

export interface ManagerHooks {
  price(): number;
  isOpen(): boolean;
  stock(): number;
  pay(amount: number): void;
  onCustomerEnter(c: Customer): void;
  onFull(): void;
  onPlay(): void;
  onResult(c: Customer, win: PlushEntity[]): void;
  onLeave(c: Customer, satisfaction: number, reason: LeaveReason): void;
  hands(): { l: THREE.Vector3; r: THREE.Vector3 };
}

/** 電腦操作爪子的簡易駕駛員:挑目標 → 帶誤差瞄準 → 定住 → 放爪 */
class Pilot {
  private t = 0;
  private think = 0;
  private settle = 0;
  private aim = new THREE.Vector2();
  private out = { x: 0, z: 0 };

  start(c: Customer, physics: Physics, claw: ClawRig) {
    this.t = 0;
    this.settle = 0;
    this.think = 0.4 + (1 - c.cfg.skill) * rnd(0.6, 1.8);
    let best: { x: number; z: number } | null = null;
    let bestScore = -Infinity;
    for (const p of physics.plushes) {
      if (p.won) continue;
      const t = p.body.translation();
      if (t.y < 0.1 || t.x < CLAW.minX - 0.1 || t.x > CLAW.maxX + 0.1 || t.z < CLAW.minZ - 0.1 || t.z > CLAW.maxZ + 0.1) continue;
      const toChute = Math.hypot(t.x - DROP_POINT.x, t.z - DROP_POINT.z);
      const rare = p.rarity === 'common' ? 0 : p.rarity === 'rare' ? 0.5 : 1;
      const score = -toChute * 0.25 + t.y * 0.9 + rare * c.cfg.rare * 0.7 + gauss() * (1 - c.cfg.skill) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = { x: t.x, z: t.z };
      }
    }
    if (!best || Math.random() < (1 - c.cfg.skill) * 0.15) best = { x: rnd(CLAW.minX, CLAW.maxX), z: rnd(CLAW.minZ, CLAW.maxZ) };
    const err = (1 - c.cfg.skill) * 0.09;
    this.aim.set(
      THREE.MathUtils.clamp(best.x + gauss() * err, CLAW.minX, CLAW.maxX),
      THREE.MathUtils.clamp(best.z + gauss() * err, CLAW.minZ, CLAW.maxZ),
    );
    void claw;
  }

  input(dt: number, claw: ClawRig, c: Customer) {
    this.t += dt;
    if (this.t < this.think) return this.stop();
    const dx = this.aim.x - claw.pos.x;
    const dz = this.aim.y - claw.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.025) {
      this.settle += dt;
      if (this.settle > 0.3 + (1 - c.cfg.skill) * 0.4) claw.drop();
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

export class CustomerManager {
  readonly line: Customer[] = [];
  readonly all: Customer[] = [];
  roundActive = false;
  private pilot = new Pilot();
  private spawnT = 4;
  private grabbed = false;
  private slipped = false;
  private won: PlushEntity[] = [];
  private readonly zero = { x: 0, z: 0 };

  constructor(private scene: THREE.Object3D, private claw: ClawRig, private physics: Physics, private hooks: ManagerHooks) {}

  get current() {
    return this.roundActive ? this.line[0] : undefined;
  }
  get queueLength() {
    return this.line.length;
  }
  get isEmpty() {
    return this.all.length === 0;
  }

  /** 到店間隔(遊戲秒):售價越高越久、聲望越高越短 */
  arrivalInterval(rep: number) {
    const price = this.hooks.price();
    return (34 * Math.pow(price / BASE_PRICE, 0.9)) / (0.55 + 0.22 * rep);
  }

  private chooseKind(): Kind {
    const r = Math.random();
    let a = 0;
    for (const k of Object.keys(KINDS) as Kind[]) {
      a += KINDS[k].weight;
      if (r < a) return k;
    }
    return 'student';
  }

  private spawn() {
    const price = this.hooks.price();
    const kind = this.chooseKind();
    const cfg = KINDS[kind];
    // 太貴就不進來
    const enterProb = THREE.MathUtils.clamp(1.1 - 0.5 * cfg.sens * (price / BASE_PRICE - 1), 0.1, 1);
    if (Math.random() > enterProb) return;
    if (this.line.length >= MAX_LINE) {
      this.hooks.onFull();
      return;
    }
    const c = new Customer(kind, price);
    this.scene.add(c.human.group);
    this.all.push(c);
    this.line.push(c);
    this.hooks.onCustomerEnter(c);
  }

  /** 事件:爪子夾到 / 中途掉落 / 掉進出口 / 回合結束 */
  noteGrab() {
    this.grabbed = true;
  }
  noteSlip() {
    this.slipped = true;
  }
  noteWin(p: PlushEntity) {
    if (this.roundActive) this.won.push(p);
  }

  private startRound(c: Customer) {
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    if (this.hooks.stock() < 3) {
      c.say('沒娃娃了…', 2.5);
      return this.leave(c, 'nostock');
    }
    const price = this.hooks.price();
    this.hooks.pay(price);
    this.hooks.onPlay();
    c.budget--;
    c.state = 'playing';
    this.roundActive = true;
    this.grabbed = false;
    this.slipped = false;
    this.won = [];
    this.claw.begin();
    this.pilot.start(c, this.physics, this.claw);
  }

  /** 爪子回到待機位,結算這一局 */
  roundEnded() {
    if (!this.roundActive) return;
    this.roundActive = false;
    const c = this.line[0];
    if (!c) return;
    const sens = this.hooks.price() / BASE_PRICE;
    if (this.won.length) {
      const bonus = this.won.reduce((s, p) => s + (p.rarity === 'ssr' ? 0.3 : p.rarity === 'rare' ? 0.15 : 0), 0);
      c.mood = Math.min(1, c.mood + 0.5 + bonus);
      c.cheer = 2;
      c.say(this.won.some((p) => p.rarity !== 'common') ? '太棒了!🧸✨' : '中了!🧸', 2.4);
    } else {
      c.mood -= (this.grabbed ? 0.1 : 0.14) * sens;
      c.sad = 1.4;
      c.say(this.grabbed ? '差一點…😣' : '沒夾到😕', 1.8);
    }
    this.hooks.onResult(c, this.won);
    if (c.mood < -0.45) {
      c.say('太難了!😤', 2.5);
      return this.leave(c, 'angry');
    }
    if (c.budget <= 0) {
      c.say(c.mood > 0.3 ? '玩得開心!👋' : '回家囉…', 2);
      return this.leave(c, 'done');
    }
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    c.state = 'waiting';
    c.cool = 1.4;
  }

  private leave(c: Customer, reason: LeaveReason) {
    const i = this.line.indexOf(c);
    if (i >= 0) this.line.splice(i, 1);
    c.state = 'leaving';
    c.target.copy(ENTRANCE);
    const sat = THREE.MathUtils.clamp(c.mood - (reason === 'impatient' ? 0.5 : 0), -1, 1);
    this.hooks.onLeave(c, sat, reason);
  }

  /** 打烊:還沒輪到的人離開 */
  closeShop() {
    for (const c of [...this.line]) {
      if (c === this.line[0] && this.roundActive) continue;
      if (c.state === 'playing') continue;
      this.leave(c, 'closed');
    }
  }

  pilotInput(dt: number) {
    const c = this.line[0];
    if (!this.roundActive || !c) return this.zero;
    return this.pilot.input(dt, this.claw, c);
  }

  update(dt: number, rep: number) {
    if (this.hooks.isOpen()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        this.spawnT = this.arrivalInterval(rep) * rnd(0.6, 1.4);
      }
    }

    // 位置、排隊耐心
    this.line.forEach((c, i) => {
      c.target.copy(station(i));
      if (i > 0 && c.state !== 'leaving') {
        c.wait += dt;
        if (c.wait > c.cfg.patience) {
          c.say('等太久了😒', 2.5);
          this.leave(c, 'impatient');
        }
      }
    });

    const reach = this.hooks.hands();
    for (let k = this.all.length - 1; k >= 0; k--) {
      const c = this.all[k];
      const to = c.target;
      const dx = to.x - c.pos.x;
      const dz = to.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      let pose: Pose = 'idle';
      if (d > 0.04) {
        const step = Math.min(d, (c.cfg.kid ? 1.0 : 1.25) * dt);
        c.pos.x += (dx / d) * step;
        c.pos.z += (dz / d) * step;
        this.face(c, dx, dz, dt);
        pose = 'walk';
      } else {
        if (c.state === 'enter') c.state = 'waiting';
        if (c.state !== 'leaving') this.face(c, -0.25, -0.4, dt);
        if (c.state === 'leaving') c.removed = true;
      }
      if (c.state === 'playing' || (this.line[0] === c && d <= 0.04 && c.state === 'waiting' && c.cheer <= 0 && c.sad <= 0)) {
        if (d <= 0.04 && this.line[0] === c) pose = 'play';
      }
      if (c.cheer > 0) {
        c.cheer -= dt;
        pose = 'cheer';
      } else if (c.sad > 0) {
        c.sad -= dt;
        pose = 'sad';
      }
      c.human.update(dt, pose, reach);
      if (c.bubbleT > 0) c.bubbleT -= dt;

      if (c.removed) {
        this.scene.remove(c.human.group);
        this.all.splice(k, 1);
      }
    }

    // 操作位的人開始下一局
    const head = this.line[0];
    if (head && head.state === 'waiting' && !this.roundActive && this.claw.state === 'idle') {
      const arrived = head.pos.distanceTo(station(0)) < 0.08;
      head.cool -= dt;
      if (arrived && head.cool <= 0 && head.cheer <= 0) this.startRound(head);
    }
  }

  private face(c: Customer, dx: number, dz: number, dt: number) {
    const want = Math.atan2(dx, dz);
    let diff = want - c.human.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.human.group.rotation.y += diff * Math.min(1, dt * 8);
  }
}
