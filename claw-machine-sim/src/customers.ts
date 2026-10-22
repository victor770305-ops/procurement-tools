import * as THREE from 'three';
import { BASE_PRICE } from './economy';
import { Human, HumanOpts, Pose } from './human';
import { COUNTER, ENTRANCE, counterSlot } from './layout';
import type { Machine } from './machine';
import type { PlushEntity } from './physics';

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

export const MAX_COUNTER_LINE = 5;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export type LeaveReason = 'done' | 'angry' | 'impatient' | 'closed' | 'nostock';
export type CustState = 'enter' | 'counter' | 'buying' | 'machine' | 'playing' | 'leaving';

export class Customer {
  readonly human: Human;
  readonly cfg: KindCfg;
  state: CustState = 'enter';
  mood = 0.25 + Math.random() * 0.2;
  coins = 0;
  machine: Machine | null = null;
  wait = 0;
  cool = 0;
  cheer = 0;
  sad = 0;
  bubble = '';
  bubbleT = 0;
  needsHelp = false;
  helpWait = 0;
  askedHelp = false;
  wins = 0;
  readonly target = new THREE.Vector3();
  removed = false;

  constructor(readonly kind: Kind, readonly price: number) {
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
    this.human.group.position.copy(ENTRANCE);
  }

  /** 這次想玩幾次(受售價影響) */
  rollPlays(price: number) {
    const [lo, hi] = this.cfg.plays;
    return Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * Math.pow(BASE_PRICE / price, this.cfg.sens * 1.0)));
  }

  say(text: string, sec = 2) {
    this.bubble = text;
    this.bubbleT = sec;
  }
  get pos() {
    return this.human.group.position;
  }
  get label() {
    return this.cfg.label;
  }
}

export interface ManagerHooks {
  price(): number;
  isOpen(): boolean;
  totalStock(): number;
  /** 櫃台收銀員已就位且空閒 */
  cashierReady(): boolean;
  serveStart(c: Customer): void;
  serveEnd(): void;
  coinsSold(c: Customer, coins: number, amount: number): void;
  onCustomerEnter(c: Customer): void;
  onFull(): void;
  onPlay(m: Machine, c: Customer): void;
  onResult(m: Machine, c: Customer, won: PlushEntity[]): void;
  onLeave(c: Customer, satisfaction: number, reason: LeaveReason): void;
  requestHelp(m: Machine, c: Customer): void;
  cancelHelp(c: Customer): void;
  cleanliness(): number;
  hands(m: Machine): { l: THREE.Vector3; r: THREE.Vector3 };
  log(text: string, kind: 'customer' | 'sale' | 'win' | 'alert'): void;
}

interface RoundInfo {
  grabbed: boolean;
  slipped: boolean;
  won: PlushEntity[];
}

export class CustomerManager {
  readonly counterLine: Customer[] = [];
  readonly all: Customer[] = [];
  private serving: Customer | null = null;
  private serveT = 0;
  private spawnT = 3;
  private rounds = new Map<Machine, RoundInfo>();
  private readonly zero = { x: 0, z: 0 };

  constructor(private scene: THREE.Object3D, private machines: Machine[], private hooks: ManagerHooks) {
    for (const m of machines) this.rounds.set(m, { grabbed: false, slipped: false, won: [] });
  }

  get isEmpty() {
    return this.all.length === 0;
  }
  get queueLength() {
    return this.counterLine.length + this.machines.reduce((s, m) => s + m.line.length, 0);
  }
  currentAt(m: Machine) {
    return m.roundActive ? m.line[0] : undefined;
  }

  /** 到店間隔(遊戲秒):售價越高越久、聲望越高越短 */
  arrivalInterval(rep: number) {
    const price = this.hooks.price();
    return (15.5 * Math.pow(price / BASE_PRICE, 1.1)) / (0.55 + 0.22 * rep);
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
    const enterProb = THREE.MathUtils.clamp(1.1 - 0.7 * cfg.sens * (price / BASE_PRICE - 1), 0.1, 1);
    if (Math.random() > enterProb) return;
    if (this.counterLine.length >= MAX_COUNTER_LINE) {
      this.hooks.onFull();
      return;
    }
    const c = new Customer(kind, price);
    c.mood += (this.hooks.cleanliness() - 0.5) * 0.3;
    c.state = 'counter';
    this.scene.add(c.human.group);
    this.all.push(c);
    this.counterLine.push(c);
    this.hooks.onCustomerEnter(c);
  }

  // ---------- 爪子事件(由 Game 轉送) ----------
  noteGrab(m: Machine) {
    this.rounds.get(m)!.grabbed = true;
  }
  noteSlip(m: Machine) {
    this.rounds.get(m)!.slipped = true;
  }
  noteWin(m: Machine, p: PlushEntity) {
    if (m.roundActive) this.rounds.get(m)!.won.push(p);
  }

  // ---------- 櫃台 ----------
  private finishServe(c: Customer) {
    const price = this.hooks.price();
    c.coins = c.rollPlays(price);
    this.hooks.coinsSold(c, c.coins, c.coins * price);
    this.serving = null;
    this.hooks.serveEnd();
    const i = this.counterLine.indexOf(c);
    if (i >= 0) this.counterLine.splice(i, 1);
    const m = this.chooseMachine(c);
    if (!m) {
      c.say('沒位子了…', 2);
      return this.leave(c, 'nostock');
    }
    c.say(`換了 ${c.coins} 枚幣!`, 1.8);
    this.joinMachine(c, m);
  }

  private chooseMachine(c: Customer): Machine | null {
    let best: Machine | null = null;
    let bs = Infinity;
    for (const m of this.machines) {
      if (m.stock < 3) continue;
      const rareFrac = m.physics.plushes.filter((p) => !p.won && p.rarity !== 'common').length / Math.max(1, m.stock);
      const s = m.line.length + (m.service ? 0.8 : 0) - c.cfg.rare * rareFrac * 1.5 + Math.random() * 0.9;
      if (s < bs) {
        bs = s;
        best = m;
      }
    }
    return best;
  }

  private joinMachine(c: Customer, m: Machine) {
    c.machine = m;
    c.state = 'machine';
    c.wait = 0;
    c.cool = 0.5;
    m.line.push(c);
  }

  // ---------- 機台回合 ----------
  private startRound(m: Machine, c: Customer) {
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    if (m.stock < 3) {
      c.say('這台沒娃娃了…', 2.5);
      // 換一台
      const other = this.machines.find((x) => x !== m && x.stock >= 3);
      if (other && c.coins > 0) {
        m.line.splice(m.line.indexOf(c), 1);
        this.joinMachine(c, other);
        return;
      }
      return this.leave(c, 'nostock');
    }
    c.coins--;
    m.plays++;
    this.hooks.onPlay(m, c);
    c.state = 'playing';
    m.roundActive = true;
    const r = this.rounds.get(m)!;
    r.grabbed = false;
    r.slipped = false;
    r.won = [];
    m.claw.begin();
    m.pilot.start(c.cfg.skill, c.cfg.rare, m.physics);
  }

  /** 爪子回到待機位,結算這一局 */
  roundEnded(m: Machine) {
    if (!m.roundActive) return;
    m.roundActive = false;
    const c = m.line[0];
    const r = this.rounds.get(m)!;
    if (!c) return;
    const sens = this.hooks.price() / BASE_PRICE;
    if (r.won.length) {
      const bonus = r.won.reduce((s, p) => s + (p.rarity === 'ssr' ? 0.3 : p.rarity === 'rare' ? 0.15 : 0), 0);
      c.mood = Math.min(1, c.mood + 0.5 + bonus);
      c.cheer = 2;
      c.wins += r.won.length;
      c.say(r.won.some((p) => p.rarity !== 'common') ? '太棒了!🧸✨' : '中了!🧸', 2.4);
    } else {
      c.mood -= (r.grabbed ? 0.1 : 0.14) * sens;
      c.sad = 1.4;
      c.say(r.grabbed ? '差一點…😣' : '沒夾到😕', 1.8);
    }
    this.hooks.onResult(m, c, r.won);
    if (c.mood < -0.45) {
      c.say('太難了!😤', 2.5);
      return this.leave(c, 'angry');
    }
    if (c.coins <= 0) return this.finishPlaying(m, c);
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    c.state = 'machine';
    c.cool = 1.4;
    // 連輸幾次,請店員幫忙
    if (!r.won.length && c.mood < 0.2 && !c.askedHelp && Math.random() < 0.75) {
      c.needsHelp = true;
      c.helpWait = 0;
      c.say('店員~可以幫我看一下嗎?🙋', 6);
      this.hooks.requestHelp(m, c);
      return;
    }
    // 隊伍太長且別台比較空,換一台
    const alt = this.machines.filter((x) => x !== m && x.stock >= 3).sort((a, b) => a.line.length - b.line.length)[0];
    if (alt && m.line.length >= 3 && alt.line.length + 2 <= m.line.length && Math.random() < 0.5) {
      m.line.splice(m.line.indexOf(c), 1);
      c.say('換一台玩玩', 1.6);
      this.joinMachine(c, alt);
    }
  }

  /** 幣用完:心情好的客人可能再回櫃台加買 */
  private finishPlaying(m: Machine, c: Customer) {
    if (this.hooks.isOpen() && c.mood > 0.45 && this.counterLine.length < MAX_COUNTER_LINE && Math.random() < 0.4) {
      m.line.splice(m.line.indexOf(c), 1);
      c.machine = null;
      c.state = 'counter';
      c.say('再買幾枚幣!', 2);
      this.counterLine.push(c);
      return;
    }
    c.say(c.mood > 0.3 ? '玩得開心!👋' : '回家囉…', 2);
    this.leave(c, 'done');
  }

  /** 店員協助完成 */
  helped(c: Customer, ok: boolean) {
    c.needsHelp = false;
    c.askedHelp = true;
    if (ok) {
      c.mood = Math.min(1, c.mood + 0.35);
      c.cheer = 1.4;
      c.say('謝謝店員!😊', 2.2);
    }
  }

  private leave(c: Customer, reason: LeaveReason) {
    if (c.machine) {
      const i = c.machine.line.indexOf(c);
      if (i >= 0) c.machine.line.splice(i, 1);
    }
    const j = this.counterLine.indexOf(c);
    if (j >= 0) this.counterLine.splice(j, 1);
    if (this.serving === c) {
      this.serving = null;
      this.hooks.serveEnd();
    }
    if (c.needsHelp) this.hooks.cancelHelp(c);
    c.needsHelp = false;
    c.machine = null;
    c.state = 'leaving';
    c.target.copy(ENTRANCE);
    const sat = THREE.MathUtils.clamp(c.mood - (reason === 'impatient' ? 0.5 : 0), -1, 1);
    this.hooks.onLeave(c, sat, reason);
  }

  /** 打烊:還沒輪到的人離開 */
  closeShop() {
    for (const c of [...this.all]) {
      if (c.state === 'leaving' || c.state === 'playing') continue;
      if (c.state === 'buying' && this.serving === c) continue;
      this.leave(c, 'closed');
    }
  }

  pilotInput(m: Machine, dt: number) {
    const c = m.line[0];
    if (!m.roundActive || !c) return this.zero;
    return m.pilot.input(dt, m.claw, c.cfg.skill);
  }

  update(dt: number, rep: number) {
    if (this.hooks.isOpen()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        this.spawnT = this.arrivalInterval(rep) * rnd(0.6, 1.4);
      }
    }

    // 目標位置與排隊耐心
    this.counterLine.forEach((c, i) => {
      if (c.state === 'leaving') return;
      c.target.copy(counterSlot(i));
    });
    for (const m of this.machines) {
      m.line.forEach((c, i) => {
        c.target.copy(m.station(i));
        if (i > 0 && c.state !== 'leaving') {
          c.wait += dt;
          if (c.wait > c.cfg.patience) {
            c.say('等太久了😒', 2.5);
            this.leave(c, 'impatient');
          }
        }
      });
    }

    // 櫃台服務
    const head = this.counterLine[0];
    if (head && head.state === 'counter' && !this.serving && head.pos.distanceTo(counterSlot(0)) < 0.08 && this.hooks.cashierReady()) {
      if (!this.hooks.isOpen()) this.leave(head, 'closed');
      else if (this.hooks.totalStock() < 3) {
        head.say('沒娃娃了…', 2.5);
        this.leave(head, 'nostock');
      } else {
        this.serving = head;
        this.serveT = 2.4;
        head.state = 'buying';
        this.hooks.serveStart(head);
      }
    }
    if (this.serving) {
      this.serveT -= dt;
      if (this.serveT <= 0) this.finishServe(this.serving);
    }

    // 移動與動作
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
        if (c.state === 'leaving') c.removed = true;
        else if (c.state === 'counter' || c.state === 'buying') this.face(c, 0, -1, dt);
        else this.face(c, -0.25, -0.4, dt);
        if (c.state === 'machine' || c.state === 'playing') {
          const m = c.machine;
          if (m && m.line[0] === c) pose = 'play';
        }
      }
      if (c.cheer > 0) {
        c.cheer -= dt;
        pose = 'cheer';
      } else if (c.sad > 0) {
        c.sad -= dt;
        pose = 'sad';
      }
      const reach = c.machine ? this.hooks.hands(c.machine) : undefined;
      c.human.update(dt, pose, reach);
      if (c.bubbleT > 0) c.bubbleT -= dt;
      if (c.needsHelp) {
        c.helpWait += dt;
        if (c.helpWait > 30) {
          this.hooks.cancelHelp(c);
          c.needsHelp = false;
          c.askedHelp = true;
          c.mood -= 0.15;
        }
      }
      if (c.removed) {
        this.scene.remove(c.human.group);
        this.all.splice(k, 1);
      }
    }

    // 各機台的操作位:開始下一局
    for (const m of this.machines) {
      const h = m.line[0];
      if (!h || h.state !== 'machine' || m.roundActive || m.claw.state !== 'idle') continue;
      if (m.service || m.blocking || h.needsHelp) continue;
      const arrived = h.pos.distanceTo(m.station(0)) < 0.08;
      h.cool -= dt;
      if (arrived && h.cool <= 0 && h.cheer <= 0) this.startRound(m, h);
    }
  }

  private face(c: Customer, dx: number, dz: number, dt: number) {
    const want = Math.atan2(dx, dz);
    let diff = want - c.human.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.human.group.rotation.y += diff * Math.min(1, dt * 8);
  }
}

void COUNTER;
