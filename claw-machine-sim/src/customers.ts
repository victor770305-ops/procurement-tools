import * as THREE from 'three';
import { BASE_PRICE } from './economy';
import type { Exchange } from './exchange';
import { ArchKind, Character, REGULARS, genCustomer } from './characters';
import { Human, HumanOpts, Pose, humanOptsFromCharacter } from './human';
import { DOOR_IN, DOOR_OUT, MAX_LINE, route } from './layout';
import type { Machine, Prize } from './machine';
import type { Spill } from './events';
import { Restroom } from './facilities';

export type Kind = ArchKind;

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
  student: { label: '學生', weight: 0.38, plays: [2, 5], skill: 0.4, sens: 1.3, rare: 0.2, patience: 80, shirts: [0x3b6fd1, 0x2f8f6a, 0xc24b47, 0x56606e], accessory: 'backpack', scale: 1, kid: false },
  couple: { label: '情侶', weight: 0.22, plays: [3, 6], skill: 0.5, sens: 0.8, rare: 0.6, patience: 95, shirts: [0xd9759d, 0x8f74c8, 0xdf9a3e, 0xe8e2d4], accessory: 'none', scale: 0.98, kid: false },
  pro: { label: '老手', weight: 0.2, plays: [4, 9], skill: 0.9, sens: 1.0, rare: 0.8, patience: 60, shirts: [0x2a313c, 0x3d4757, 0x5c3d2e, 0x394f3a], accessory: 'cap', scale: 1.03, kid: false },
  kid: { label: '小朋友', weight: 0.2, plays: [2, 4], skill: 0.2, sens: 0.6, rare: 0.1, patience: 100, shirts: [0xf2b93a, 0x5cb6e8, 0xf07a7a, 0x7bc88a], accessory: 'bow', scale: 0.72, kid: true },
};

export const MAX_COUNT = 150;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export type LeaveReason = 'done' | 'angry' | 'impatient' | 'closed' | 'nostock';
export type CustState = 'exchange' | 'buying' | 'machine' | 'playing' | 'wc' | 'leaving';
export type HelpKind = 'assist' | 'retrieve' | 'exchange';

export class Customer {
  readonly human: Human;
  readonly cfg: KindCfg;
  state: CustState = 'exchange';
  mood = 0.25 + Math.random() * 0.2;
  coins = 0;
  machine: Machine | null = null;
  ex: Exchange | null = null;
  wait = 0;
  cool = 0;
  cheer = 0;
  sad = 0;
  slipT = 0;
  bubble = '';
  bubbleT = 0;
  needsHelp: HelpKind | null = null;
  helpWait = 0;
  askedHelp = false;
  wins = 0;
  /** 玩了幾局(玩到第 2 局後,可能想上廁所) */
  rounds = 0;
  wantWc = false;
  wcDone = false;
  wcRoom: Restroom | null = null;
  wcSteps: { pos: THREE.Vector3; dwell: number }[] = [];
  wcStep = 0;
  wcT = -1;
  readonly dest = new THREE.Vector3(1e9, 0, 1e9);
  path: THREE.Vector3[] = [];
  readonly slippedOn = new Set<Spill>();
  removed = false;

  /** 個別能力(來自人物設定,真的會影響行為) */
  readonly ch: Character;
  readonly skill: number;
  readonly patience: number;
  readonly rare: number;
  readonly luck: number;
  readonly playsMul: number;
  readonly kind: Kind;

  constructor(kind: Kind, ch?: Character) {
    this.kind = kind;
    this.cfg = KINDS[kind];
    this.ch = ch ?? genCustomer(kind);
    const st = this.ch.stats;
    this.skill = THREE.MathUtils.clamp(st[0] / 100, 0.1, 0.98);
    this.playsMul = 0.55 + (0.9 * st[1]) / 100;
    this.patience = 40 + st[2] * 0.85;
    this.luck = st[3] / 100;
    this.rare = st[4] / 100;
    this.human = new Human(humanOptsFromCharacter(this.ch, this.cfg.scale * rnd(0.97, 1.03), this.cfg.kid));
    this.human.group.position.copy(DOOR_OUT);
    this.wantWc = Math.random() < (this.cfg.kid ? 0.3 : 0.22);
  }

  rollPlays(price: number) {
    const [lo, hi] = this.cfg.plays;
    return Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * this.playsMul * Math.pow(BASE_PRICE / price, this.cfg.sens * 1.0)));
  }

  say(text: string, sec = 2) {
    this.bubble = text;
    this.bubbleT = sec;
  }
  get pos() {
    return this.human.group.position;
  }
  get label() {
    return this.ch.regular ? this.ch.name : this.cfg.label;
  }
}

export interface ManagerHooks {
  price(): number;
  isOpen(): boolean;
  totalStock(): number;
  coinsSold(c: Customer, coins: number, amount: number): void;
  onCustomerEnter(c: Customer): void;
  onFull(): void;
  onPlay(m: Machine, c: Customer): void;
  onResult(m: Machine, c: Customer, won: Prize[]): void;
  onLeave(c: Customer, satisfaction: number, reason: LeaveReason): void;
  requestHelp(kind: HelpKind, target: Machine | Exchange, c: Customer): void;
  cancelHelp(c: Customer): void;
  cleanliness(): number;
  spills(): Spill[];
  onSlip(c: Customer, s: Spill): void;
  jamChance(): number;
  moodBonus(): number;
  onExchangeJam(ex: Exchange, c: Customer): void;
  onExchangeEmpty(ex: Exchange): void;
  onExchangeLow(ex: Exchange): void;
  onCounterServed(): void;
  onWcUse(room: Restroom): void;
  onWcGross(c: Customer, room: Restroom): void;
  log(text: string, kind: 'customer' | 'sale' | 'win' | 'alert'): void;
}

interface RoundInfo {
  grabbed: boolean;
  slipped: boolean;
  won: Prize[];
  stuck: boolean;
}

export class CustomerManager {
  readonly all: Customer[] = [];
  /** 劇情帶來的客流倍率 */
  arrivalMul = 1;
  private spawnT = 3;
  private rounds = new Map<Machine, RoundInfo>();
  private readonly zero = { x: 0, z: 0 };

  constructor(private scene: THREE.Object3D, private machines: Machine[], private exchanges: Exchange[], private restrooms: Restroom[], private hooks: ManagerHooks) {
    for (const m of machines) this.rounds.set(m, { grabbed: false, slipped: false, won: [], stuck: false });
  }

  get isEmpty() {
    return this.all.length === 0;
  }
  get inLine() {
    return this.exchanges.reduce((s, e) => s + e.queue.length, 0) + this.machines.reduce((s, m) => s + m.line.length, 0);
  }

  /** 到店間隔(遊戲秒):機台越多越密;售價越高越久、聲望越高越短 */
  arrivalInterval(rep: number) {
    const price = this.hooks.price();
    return (2.0 * Math.pow(price / BASE_PRICE, 1.1)) / (0.55 + 0.22 * rep) / this.arrivalMul;
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
    // 一成機率是有名字的常客(當天還沒在店裡的才會來)
    let regular: Character | undefined;
    if (Math.random() < 0.12) {
      const free = REGULARS.filter((r) => !this.all.some((c) => c.ch.id === r.id));
      if (free.length) regular = free[Math.floor(Math.random() * free.length)];
    }
    const kind = regular?.kind ?? this.chooseKind();
    const cfg = KINDS[kind];
    const enterProb = regular ? 1 : THREE.MathUtils.clamp(1.1 - 0.7 * cfg.sens * (price / BASE_PRICE - 1), 0.1, 1);
    if (Math.random() > enterProb) return;
    if (this.all.length >= MAX_COUNT || this.exchanges.every((e) => e.queue.length >= 6)) {
      this.hooks.onFull();
      return;
    }
    const c = new Customer(kind, regular);
    c.mood += (this.hooks.cleanliness() - 0.5) * 0.3 + this.hooks.moodBonus();
    this.scene.add(c.human.group);
    this.all.push(c);
    this.joinExchange(c, this.pickExchange());
    this.hooks.onCustomerEnter(c);
  }

  // ---------- 移動 ----------
  private goTo(c: Customer, dest: THREE.Vector3) {
    if (c.dest.distanceToSquared(dest) > 0.0025) {
      c.dest.copy(dest);
      c.path = route(c.pos, dest);
    }
  }
  private atDest(c: Customer) {
    return c.path.length === 0 && c.pos.distanceTo(c.dest) < 0.09;
  }

  // ---------- 兌幣機 ----------
  private pickExchange(from?: Exchange) {
    let best = this.exchanges[0];
    let bs = Infinity;
    for (const e of this.exchanges) {
      if (e === from) continue;
      if (e.counter && !e.usable) continue;
      const s = (e.queue.length + 1) * (e.counter ? 1.8 : 1) + (e.usable ? 0 : 6) + Math.random() * 0.5;
      if (s < bs) {
        bs = s;
        best = e;
      }
    }
    return best;
  }
  private joinExchange(c: Customer, ex: Exchange) {
    c.ex = ex;
    c.state = 'exchange';
    c.wait = 0;
    ex.queue.push(c);
  }

  private serveExchange(ex: Exchange, dt: number) {
    const head = ex.queue[0];
    if (!ex.using && head && head.state === 'exchange' && this.atDest(head) && ex.usable) {
      if (!this.hooks.isOpen()) return this.leave(head, 'closed');
      if (this.hooks.totalStock() < 3) {
        head.say('沒娃娃了…', 2.5);
        return this.leave(head, 'nostock');
      }
      if (!ex.counter && Math.random() < this.hooks.jamChance()) {
        ex.setState('jam');
        head.say('卡鈔了!?', 3);
        this.hooks.onExchangeJam(ex, head);
        return;
      }
      ex.using = head;
      head.state = 'buying';
      ex.useT = ex.serveTime;
      ex.uses++;
    }
    if (ex.using) {
      ex.useT -= dt;
      if (ex.useT <= 0) this.finishExchange(ex, ex.using);
    }
  }

  private finishExchange(ex: Exchange, c: Customer) {
    ex.using = null;
    const price = this.hooks.price();
    const want = c.rollPlays(price);
    const coins = Math.min(want, Math.floor(ex.coins));
    if (coins <= 0) {
      c.state = 'exchange';
      ex.setState('empty');
      c.say('沒有代幣了…', 2.5);
      this.hooks.onExchangeEmpty(ex);
      return;
    }
    ex.coins -= coins;
    ex.refresh();
    this.hooks.coinsSold(c, coins, coins * price);
    if (ex.counter) this.hooks.onCounterServed();
    else if (ex.coins <= 70) this.hooks.onExchangeLow(ex);
    c.coins = coins;
    ex.queue.splice(ex.queue.indexOf(c), 1);
    c.ex = null;
    const m = this.chooseMachine(c);
    if (!m) {
      c.say('沒位子了…', 2);
      return this.leave(c, 'nostock');
    }
    c.say(`換了 ${coins} 枚幣!`, 1.6);
    this.joinMachine(c, m);
  }

  // ---------- 選機台 ----------
  private chooseMachine(c: Customer): Machine | null {
    let best: Machine | null = null;
    let bs = Infinity;
    for (const m of this.machines) {
      if (m.fault || m.stock < 3 || m.line.length >= MAX_LINE) continue;
      let rare = 0;
      if (c.rare > 0.3) {
        const n = m.mode === 'lite' ? m.items.length : m.stock;
        if (m.mode === 'lite' && n) rare = m.items.filter((i) => i.rarity !== 'common').length / n;
      }
      const dist = Math.hypot(m.x - c.pos.x, m.z - c.pos.z);
      const s = m.line.length * 1.4 + dist * 0.07 + (m.blocked ? 2.5 : 0) - c.rare * rare * 1.5 + Math.random() * 1.2;
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

  /** 機台故障:疏散排隊的客人 */
  evacuate(m: Machine) {
    const head = m.line[0];
    if (head && head.state === 'playing') {
      head.coins++;
      head.mood -= 0.1;
      head.state = 'machine';
      head.say('機台壞掉了!😮', 3);
    }
    const waiting = [...m.line];
    m.line.length = 0;
    for (const c of waiting) {
      if (c.needsHelp) {
        this.hooks.cancelHelp(c);
        c.needsHelp = null;
      }
      const alt = this.chooseMachine(c);
      if (alt && c.coins > 0) {
        c.say('換一台玩吧', 1.8);
        this.joinMachine(c, alt);
      } else this.leave(c, c.coins > 0 ? 'nostock' : 'done');
    }
  }

  // ---------- 機台事件(由機台轉送) ----------
  noteGrab(m: Machine) {
    this.rounds.get(m)!.grabbed = true;
  }
  noteSlip(m: Machine) {
    this.rounds.get(m)!.slipped = true;
  }
  noteWin(m: Machine, p: Prize, stuck: boolean) {
    const r = this.rounds.get(m)!;
    if (!m.roundActive) return;
    if (stuck) r.stuck = true;
    else r.won.push(p);
  }

  private startRound(m: Machine, c: Customer) {
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    if (m.stock < 3) {
      c.say('這台沒娃娃了…', 2.5);
      m.line.splice(m.line.indexOf(c), 1);
      const alt = this.chooseMachine(c);
      if (alt && c.coins > 0) return this.joinMachine(c, alt);
      return this.leave(c, 'nostock');
    }
    c.coins--;
    c.rounds++;
    this.hooks.onPlay(m, c);
    c.state = 'playing';
    const r = this.rounds.get(m)!;
    r.grabbed = false;
    r.slipped = false;
    r.won = [];
    r.stuck = false;
    m.beginRound(c.skill, c.rare, c.luck);
  }

  /** 一局結束,結算客人的反應 */
  roundEnded(m: Machine) {
    if (!m.roundActive) return;
    m.roundActive = false;
    const c = m.line[0];
    const r = this.rounds.get(m)!;
    if (!c) return;
    if (r.stuck) {
      c.state = 'machine';
      c.cool = 99;
      c.needsHelp = 'retrieve';
      c.helpWait = 0;
      c.say('娃娃卡在洞口了!🙋', 8);
      this.hooks.requestHelp('retrieve', m, c);
      return;
    }
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
    this.afterRound(m, c, !r.won.length);
  }

  private afterRound(m: Machine, c: Customer, lost: boolean) {
    if (c.mood < -0.45) {
      c.say('太難了!😤', 2.5);
      return this.leave(c, 'angry');
    }
    if (c.coins <= 0) return this.finishPlaying(m, c);
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    if (c.wantWc && !c.wcDone && c.rounds >= 2 && this.startWc(c)) return;
    c.state = 'machine';
    c.cool = 1.4;
    if (lost && c.mood < 0.15 && !c.askedHelp && Math.random() < 0.4) {
      c.needsHelp = 'assist';
      c.helpWait = 0;
      c.say('店員~可以幫我看一下嗎?🙋', 6);
      this.hooks.requestHelp('assist', m, c);
      return;
    }
    const alt = this.machines.filter((x) => x !== m && !x.fault && x.stock >= 3 && x.line.length + 2 <= m.line.length)[0];
    if (alt && m.line.length >= 3 && Math.random() < 0.5) {
      m.line.splice(m.line.indexOf(c), 1);
      c.say('換一台玩玩', 1.6);
      this.joinMachine(c, alt);
    }
  }

  /** 幣用完:心情好的客人可能再去兌幣機加買 */
  private finishPlaying(m: Machine, c: Customer) {
    if (this.hooks.isOpen() && c.mood > 0.45 && Math.random() < 0.4 && !this.exchanges.every((e) => e.queue.length >= 5)) {
      m.line.splice(m.line.indexOf(c), 1);
      c.machine = null;
      c.say('再去換幾枚幣!', 2);
      this.joinExchange(c, this.pickExchange());
      return;
    }
    c.say(c.mood > 0.3 ? '玩得開心!👋' : '回家囉…', 2);
    this.leave(c, 'done');
  }

  /** 店員協助 / 取出獎品完成 */
  helped(c: Customer, ok: boolean, bonus = 0.35) {
    c.needsHelp = null;
    c.askedHelp = true;
    c.cool = 0.6;
    if (ok) {
      c.mood = Math.min(1, c.mood + bonus);
      c.cheer = 1.4;
      c.say('謝謝店員!😊', 2.2);
    }
  }

  /** 取出卡住的獎品交給客人 */
  prizeDelivered(m: Machine, c: Customer, prize: Prize) {
    c.needsHelp = null;
    c.askedHelp = true;
    c.mood = Math.min(1, c.mood + 0.5 + (prize.rarity === 'ssr' ? 0.3 : prize.rarity === 'rare' ? 0.15 : 0));
    c.cheer = 2;
    c.wins++;
    c.say('拿到了!謝謝🧸', 2.4);
    this.afterRound(m, c, false);
  }

  // ---------- 上廁所 ----------
  private startWc(c: Customer): boolean {
    const room = this.restrooms.find((r) => r.id === (c.ch.gender === 'f' ? 'wcF' : 'wcM'));
    if (!room) return false;
    const slot = room.claim(c);
    if (!slot) return false;
    if (c.machine) {
      const i = c.machine.line.indexOf(c);
      if (i >= 0) c.machine.line.splice(i, 1);
    }
    if (c.needsHelp) {
      this.hooks.cancelHelp(c);
      c.needsHelp = null;
    }
    c.machine = null;
    c.state = 'wc';
    c.wcRoom = room;
    c.wcStep = 0;
    c.wcT = -1;
    const sink = room.sinks[Math.floor(Math.random() * room.sinks.length)];
    c.wcSteps = [
      { pos: slot.front.clone(), dwell: 0 },
      { pos: slot.pos.clone(), dwell: rnd(7, 13) },
      { pos: slot.front.clone(), dwell: 0 },
      { pos: sink.clone(), dwell: rnd(2.5, 4.5) },
    ];
    c.say('去一下洗手間', 2);
    return true;
  }

  private updateWc(c: Customer, dt: number) {
    const room = c.wcRoom!;
    if (c.wcStep >= c.wcSteps.length) return this.finishWc(c);
    const st = c.wcSteps[c.wcStep];
    this.goTo(c, st.pos);
    if (!this.atDest(c)) return;
    if (c.wcT < 0) {
      c.wcT = st.dwell;
      if (c.wcStep === 1) {
        room.uses++;
        this.hooks.onWcUse(room);
        room.dirt = Math.min(1, room.dirt + 0.11);
        if (room.dirt >= Restroom.GROSS) {
          c.mood -= 0.22;
          c.say('廁所好髒…😖', 2.6);
          this.hooks.onWcGross(c, room);
        }
      }
    }
    c.wcT -= dt;
    if (c.wcT <= 0) {
      c.wcStep++;
      c.wcT = -1;
    }
  }

  private finishWc(c: Customer) {
    const room = c.wcRoom!;
    room.release(c);
    c.wcRoom = null;
    c.wcDone = true;
    if (!this.hooks.isOpen()) return this.leave(c, 'closed');
    if (room.dirt < 0.35) c.mood = Math.min(1, c.mood + 0.05);
    const m = this.chooseMachine(c);
    if (!m || c.coins <= 0) return this.leave(c, c.coins > 0 ? 'nostock' : 'done');
    c.say('回來繼續夾!', 1.6);
    this.joinMachine(c, m);
  }

  private leave(c: Customer, reason: LeaveReason) {
    if (c.machine) {
      const i = c.machine.line.indexOf(c);
      if (i >= 0) c.machine.line.splice(i, 1);
    }
    if (c.ex) {
      const i = c.ex.queue.indexOf(c);
      if (i >= 0) c.ex.queue.splice(i, 1);
      if (c.ex.using === c) c.ex.using = null;
    }
    if (c.needsHelp) this.hooks.cancelHelp(c);
    if (c.wcRoom) {
      c.wcRoom.release(c);
      c.wcRoom = null;
    }
    c.needsHelp = null;
    c.machine = null;
    c.ex = null;
    c.state = 'leaving';
    const sat = THREE.MathUtils.clamp(c.mood - (reason === 'impatient' ? 0.5 : 0), -1, 1);
    this.hooks.onLeave(c, sat, reason);
  }

  /** 打烊:還沒輪到的人離開 */
  closeShop() {
    for (const c of [...this.all]) {
      if (c.state === 'leaving' || c.state === 'playing' || c.state === 'buying' || c.state === 'wc') continue;
      this.leave(c, 'closed');
    }
  }

  pilotInput(m: Machine, dt: number) {
    const c = m.line[0];
    if (!m.roundActive || !c || m.mode !== 'full') return this.zero;
    return m.pilotInput(dt, c.skill);
  }

  update(dt: number, rep: number) {
    if (this.hooks.isOpen()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        this.spawnT = this.arrivalInterval(rep) * rnd(0.6, 1.4);
      }
    }

    // 兌幣機佇列與使用
    for (const ex of this.exchanges) {
      ex.queue.forEach((c, i) => {
        if (c.state !== 'leaving') this.goTo(c, ex.slot(i));
        if (i > 0 || ex.state !== 'ok') c.wait += dt;
      });
      this.serveExchange(ex, dt);
      // 壞掉的兌幣機:排隊的人改去另一台
      if (!ex.usable && ex.queue.length && !ex.using) {
        const other = this.exchanges.find((e) => e !== ex && e.usable);
        if (other) {
          const c = ex.queue.find((q) => q.wait > 4 && q.state === 'exchange');
          if (c) {
            ex.queue.splice(ex.queue.indexOf(c), 1);
            c.say('換另一台!', 1.6);
            this.joinExchange(c, other);
          }
        }
      }
      for (const c of [...ex.queue]) {
        if (c.state === 'exchange' && c.wait > c.patience * 0.7) {
          c.say('等太久了😒', 2.5);
          this.leave(c, 'impatient');
        }
      }
    }

    // 機台排隊
    for (const m of this.machines) {
      if (!m.line.length) continue;
      m.line.forEach((c, i) => {
        if (c.state === 'leaving') return;
        this.goTo(c, m.station(i));
        if (i > 0) {
          c.wait += dt;
          if (c.wait > c.patience) {
            c.say('等太久了😒', 2.5);
            this.leave(c, 'impatient');
          }
        }
      });
    }

    // 移動與動作
    const spills = this.hooks.spills();
    for (let k = this.all.length - 1; k >= 0; k--) {
      const c = this.all[k];
      if (c.state === 'leaving') this.goTo(c, DOOR_OUT);
      else if (c.state === 'wc') this.updateWc(c, dt);
      let pose: Pose = 'idle';
      if (c.slipT > 0) {
        c.slipT -= dt;
        pose = 'fall';
      } else if (c.path.length) {
        const wp = c.path[0];
        const dx = wp.x - c.pos.x;
        const dz = wp.z - c.pos.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, (c.cfg.kid ? 1.0 : 1.3) * dt);
        if (d > 1e-4) {
          c.pos.x += (dx / d) * step;
          c.pos.z += (dz / d) * step;
          this.face(c, dx, dz, dt);
        }
        if (d - step < 0.04) c.path.shift();
        pose = 'walk';
        for (const s of spills) {
          if (s.cleaned || c.slippedOn.has(s)) continue;
          if (Math.hypot(c.pos.x - s.pos.x, c.pos.z - s.pos.z) < s.radius) {
            c.slippedOn.add(s);
            if (Math.random() < 0.35) {
              c.slipT = 1.8;
              c.mood -= 0.35;
              c.say('哇!滑倒了😵', 2.5);
              this.hooks.onSlip(c, s);
            }
          }
        }
      } else {
        if (c.state === 'leaving') c.removed = true;
        else if (c.state === 'exchange' || c.state === 'buying') this.face(c, 0, -1, dt);
        else this.face(c, -0.25, -0.4, dt);
        if ((c.state === 'machine' || c.state === 'playing') && c.machine?.line[0] === c) pose = 'play';
        if (c.state === 'buying') pose = 'play';
      }
      if (c.cheer > 0) {
        c.cheer -= dt;
        if (pose !== 'fall') pose = 'cheer';
      } else if (c.sad > 0) {
        c.sad -= dt;
        if (pose === 'idle' || pose === 'play') pose = 'sad';
      }
      let reach: { l: THREE.Vector3; r: THREE.Vector3 } | undefined;
      if (pose === 'play') {
        if (c.state === 'buying' && c.ex) reach = this.exchangeReach(c.ex);
        else if (c.machine) reach = { l: c.machine.handL, r: c.machine.handR };
      }
      c.human.update(dt, pose, reach);
      if (c.bubbleT > 0) c.bubbleT -= dt;
      if (c.needsHelp) {
        c.helpWait += dt;
        if (c.helpWait > 35) {
          this.hooks.cancelHelp(c);
          c.needsHelp = null;
          c.askedHelp = true;
          c.mood -= 0.15;
          c.cool = 0;
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
      if (!h || h.state !== 'machine' || m.roundActive || m.blocked || h.needsHelp) continue;
      if (m.mode === 'full' && m.claw!.state !== 'idle') continue;
      h.cool -= dt;
      if (this.atDest(h) && h.cool <= 0 && h.cheer <= 0 && h.slipT <= 0) this.startRound(m, h);
    }
  }

  private exchangeReach(ex: Exchange) {
    const l = this.tmpL.set(ex.x - 0.15, 1.15, ex.z + 0.4);
    const r = this.tmpR.set(ex.x + 0.15, 1.05, ex.z + 0.42);
    return { l, r };
  }
  private tmpL = new THREE.Vector3();
  private tmpR = new THREE.Vector3();

  private face(c: Customer, dx: number, dz: number, dt: number) {
    const want = Math.atan2(dx, dz);
    let diff = want - c.human.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.human.group.rotation.y += diff * Math.min(1, dt * 8);
  }
}

void DOOR_IN;
