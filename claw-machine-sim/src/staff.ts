import * as THREE from 'three';
import type { Customer } from './customers';
import { CAPACITY, StockItem } from './economy';
import { EX_CAP, EX_LOW, Exchange } from './exchange';
import type { Spill } from './events';
import { Character, STAFF_DEFS } from './characters';
import { Human, Pose, humanOptsFromCharacter } from './human';
import { IDLE_SPOTS, cashierSpot, dockSpot, lockerSpot, route, shelfSpot } from './layout';
import { Machine, Prize, SERVICE_LABEL, ServiceKind } from './machine';
import type { Logistics, Shipment } from './logistics';
import type { Lounge, Restroom } from './facilities';

export type TaskKind = 'restock' | 'assist' | 'retrieve' | 'fix' | 'mop' | 'clean' | 'refill' | 'fixEx' | 'unload' | 'load' | 'cleanWc';
type Step = 'toShelf' | 'toDock' | 'pickup' | 'go' | 'wait' | 'work';

const PLAN: Record<TaskKind, Step[]> = {
  restock: ['toShelf', 'pickup', 'go', 'wait', 'work'],
  refill: ['toShelf', 'pickup', 'go', 'work'],
  assist: ['go', 'wait', 'work'],
  retrieve: ['go', 'wait', 'work'],
  fix: ['go', 'work'],
  mop: ['go', 'work'],
  clean: ['go', 'work'],
  fixEx: ['go', 'work'],
  unload: ['toDock', 'pickup', 'toShelf', 'work'],
  load: ['toShelf', 'pickup', 'toDock', 'work'],
  cleanWc: ['go', 'work'],
};
const WORK_TIME: Record<TaskKind, number> = { restock: 4.5, refill: 4, assist: 3.5, retrieve: 3.5, fix: 9, mop: 4, clean: 3.2, fixEx: 6, unload: 1.8, load: 1.8, cleanWc: 6 };
export const TASK_LABEL: Record<TaskKind, string> = {
  restock: '補貨',
  assist: '協助客人',
  retrieve: '取出卡住的獎品',
  fix: '維修機台',
  mop: '清理水漬',
  clean: '擦拭玻璃',
  refill: '補充兌幣機零錢',
  fixEx: '排除兌幣機故障',
  unload: '卸貨入庫',
  load: '退貨裝車',
  cleanWc: '打掃廁所',
};

export interface Req {
  id: number;
  kind: TaskKind;
  key: string;
  pri: number;
  machine?: Machine;
  ex?: Exchange;
  spill?: Spill;
  customer?: Customer;
  ship?: Shipment;
  box?: number;
  wc?: Restroom;
  claimed: Staff | null;
}

interface Task {
  req: Req;
  plan: Step[];
  i: number;
  t: number;
  items: StockItem[];
}

const SPEED = 1.75;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 各種工作主要看哪幾項能力(0 速度 1 細心 2 技術 3 親和 4 體力 5 抗壓) */
const KIND_STAT: Record<TaskKind, number[]> = { restock: [0, 4], refill: [0, 4], assist: [3], retrieve: [1], fix: [2], mop: [1], clean: [1], fixEx: [2], unload: [4, 0], load: [4, 0], cleanWc: [1, 4] };

export class Staff {
  readonly human: Human;
  readonly ch: Character;
  readonly shift: number;
  task: Task | null = null;
  action = '待命';
  bubble = '';
  bubbleT = 0;
  active = false;
  leaving = false;
  idleT = rnd(1, 4);
  waveT = 0;
  wavedAt = rnd(0, 6);
  done = 0;
  /** 士氣 0~1:影響速度與工作耗時 */
  morale = 0.7;
  /** 訓練或事件帶來的能力加成 */
  bonus = [0, 0, 0, 0, 0, 0];
  /** 請假到第幾天(含) */
  leaveUntil = 0;
  /** 疲勞 0~1:越累越慢,累了會去休息室休息 */
  fatigue = rnd(0, 0.2);
  /** 目前的職務:一般場務,或坐櫃檯 */
  role: 'floor' | 'cashier' = 'floor';
  rest: { spot: THREE.Vector3; phase: 'go' | 'sit'; t: number } | null = null;
  dest = new THREE.Vector3(1e9, 0, 1e9);
  path: THREE.Vector3[] = [];
  readonly reach = { l: new THREE.Vector3(), r: new THREE.Vector3() };

  constructor(def: Character & { shift: 0 | 1 }) {
    this.ch = def;
    this.shift = def.shift;
    this.human = new Human(humanOptsFromCharacter(def, 1, false));
    this.human.setBadge(def.shift === 0 ? 0x38d0ff : 0xff7ad0);
    this.human.group.visible = false;
  }
  get name() {
    return this.ch.name;
  }
  get pos() {
    return this.human.group.position;
  }
  stat(i: number) {
    return Math.max(0, Math.min(100, this.ch.stats[i] + this.bonus[i]));
  }
  /** 走路速度倍率 */
  get speedMul() {
    return (0.8 + (0.4 * this.stat(0)) / 100) * (0.85 + 0.3 * this.morale) * (1 - 0.18 * this.fatigue);
  }
  /** 這類工作的耗時倍率(能力越高越快,士氣低會變慢) */
  timeMul(kind: TaskKind) {
    const ids = KIND_STAT[kind];
    const avg = ids.reduce((sum, i) => sum + this.stat(i), 0) / ids.length;
    return ((1.35 - (0.7 * avg) / 100) / (0.85 + 0.3 * this.morale)) * (1 + 0.3 * this.fatigue);
  }
  say(text: string, sec = 2) {
    this.bubble = text;
    this.bubbleT = sec;
  }
}

export interface StaffHooks {
  isOpen(): boolean;
  warehouse(): number;
  take(n: number): StockItem[];
  autoRestock(): boolean;
  wantFill(): boolean;
  nearbyCustomer(pos: THREE.Vector3, r: number): Customer | null;
  assistDone(c: Customer, who: Staff): void;
  prizeRetrieved(m: Machine, c: Customer | undefined, prize: Prize | null): void;
  onRestock(m: Machine, n: number): void;
  onRefill(ex: Exchange): void;
  onRepair(m: Machine): void;
  onMop(s: Spill): void;
  onClean(m: Machine): void;
  onFixEx(ex: Exchange): void;
  putBack(items: StockItem[]): void;
  counterOn(): boolean;
  onUnload(): void;
  onLoad(): void;
  onWcClean(room: Restroom): void;
  onRest(): void;
  log(text: string, kind: 'staff' | 'alert'): void;
}

export class StaffManager {
  readonly staff: Staff[];
  readonly reqs = new Map<string, Req>();
  private nextId = 1;
  private scanT = 0;
  private tmp = new THREE.Vector3();

  constructor(
    private scene: THREE.Object3D,
    private machines: Machine[],
    private exchanges: Exchange[],
    private spills: () => Spill[],
    private logi: Logistics,
    private restrooms: Restroom[],
    readonly lounge: Lounge,
    private hooks: StaffHooks,
  ) {
    this.staff = STAFF_DEFS.map((d) => new Staff(d));
    for (const s of this.staff) scene.add(s.human.group);
  }

  /** 存檔用:各店員的士氣、能力加成與請假 */
  snapshot() {
    const out: Record<string, { morale: number; bonus: number[]; leaveUntil: number }> = {};
    for (const s of this.staff) out[s.ch.id] = { morale: s.morale, bonus: s.bonus, leaveUntil: s.leaveUntil };
    return out;
  }
  restore(map: Record<string, { morale: number; bonus: number[]; leaveUntil: number }> | undefined) {
    if (!map) return;
    for (const s of this.staff) {
      const m = map[s.ch.id];
      if (m) {
        s.morale = m.morale;
        s.bonus = m.bonus;
        s.leaveUntil = m.leaveUntil;
      }
    }
  }

  /** 櫃檯有店員站好了 */
  get cashierReady() {
    const c = this.staff.find((s) => s.active && !s.leaving && s.role === 'cashier');
    return !!c && c.pos.distanceTo(cashierSpot()) < 0.9;
  }
  get cashier() {
    return this.staff.find((s) => s.active && !s.leaving && s.role === 'cashier') ?? null;
  }
  private assignCashier() {
    const crew = this.staff.filter((s) => s.active && !s.leaving);
    const cur = crew.find((s) => s.role === 'cashier');
    const on = this.hooks.counterOn() && this.hooks.isOpen() && crew.length >= 3;
    if (!on) {
      if (cur) cur.role = 'floor';
      return;
    }
    if (cur) return;
    const cand = crew.filter((s) => !s.task && !s.rest).sort((a, b) => b.stat(3) - a.stat(3))[0];
    if (!cand) return;
    cand.role = 'cashier';
    cand.path = [];
    cand.dest.set(1e9, 0, 1e9);
    cand.say('我去顧櫃檯!', 2);
    this.hooks.log(`${cand.name} 到櫃檯值班(人工兌幣、客服)`, 'staff');
  }
  private hasUrgent() {
    for (const r of this.reqs.values()) if (!r.claimed && r.pri >= 70) return true;
    return false;
  }

  get onDuty() {
    return this.staff.filter((s) => s.active);
  }
  get openReqs() {
    return [...this.reqs.values()].sort((a, b) => b.pri - a.pri);
  }

  // ---------- 輪班 ----------
  /** 設定目前的班別與人數。instant 為 true 時直接就位(開局用)。 */
  setShift(shift: number, size: number, instant = false, day = 0) {
    const want = this.staff.filter((s) => s.shift === shift && s.leaveUntil < day).slice(0, size);
    for (const s of this.staff) {
      const should = want.includes(s);
      if (should && !s.active) {
        s.active = true;
        s.leaving = false;
        s.human.group.visible = true;
        s.human.group.position.copy(instant ? IDLE_SPOTS[this.staff.indexOf(s) % IDLE_SPOTS.length] : lockerSpot());
        s.role = 'floor';
        s.rest = null;
        s.dest.set(1e9, 0, 1e9);
        s.path = [];
        s.action = '上班中';
        if (!instant) this.hooks.log(`${s.name} 到班`, 'staff');
      } else if (!should && s.active && !s.leaving) {
        this.abort(s);
        this.lounge.release(s);
        s.rest = null;
        s.role = 'floor';
        s.leaving = true;
        s.action = '下班';
        this.hooks.log(`${s.name} 下班`, 'staff');
      }
    }
  }

  // ---------- 任務看板 ----------
  private add(kind: TaskKind, key: string, pri: number, extra: Partial<Req>) {
    const ex = this.reqs.get(key);
    if (ex) {
      ex.pri = Math.max(ex.pri, pri);
      Object.assign(ex, extra);
      return ex;
    }
    const r: Req = { id: this.nextId++, kind, key, pri, claimed: null, ...extra };
    this.reqs.set(key, r);
    return r;
  }

  /** 客人要求協助或取出獎品 */
  requestHelp(kind: 'assist' | 'retrieve' | 'exchange', target: Machine | Exchange, c: Customer) {
    if (kind === 'retrieve') this.add('retrieve', `retrieve:${(target as Machine).index}`, 75, { machine: target as Machine, customer: c });
    else if (kind === 'assist') this.add('assist', `assist:${c.human.group.id}`, 65, { machine: target as Machine, customer: c });
  }
  cancelHelp(c: Customer) {
    for (const [k, r] of this.reqs) {
      if (r.customer !== c) continue;
      if (r.kind === 'assist') {
        if (r.claimed) this.abort(r.claimed);
        this.reqs.delete(k);
      } else r.customer = undefined;
    }
  }

  /** 定期掃描全店,把需要處理的事情放上看板 */
  private scan() {
    const want = new Set<string>();
    const wh = this.hooks.warehouse();
    const fill = this.hooks.wantFill();
    const auto = this.hooks.autoRestock();
    for (const m of this.machines) {
      const stock = m.stock;
      if (wh > 0) {
        let pri = 0;
        if (stock <= 3) pri = 60;
        else if (stock <= 8 && auto) pri = 40;
        else if (stock <= 12 && auto) pri = 22;
        else if (fill && CAPACITY - stock >= 4) pri = 12;
        if (pri) {
          this.add('restock', `restock:${m.index}`, pri + (m.line.length ? 8 : 0), { machine: m });
          want.add(`restock:${m.index}`);
        }
      }
      if (m.fault) {
        this.add('fix', `fix:${m.index}`, 80 + (m.line.length ? 8 : 0), { machine: m });
        want.add(`fix:${m.index}`);
      }
      if (m.stuck) {
        this.add('retrieve', `retrieve:${m.index}`, 75, { machine: m });
        want.add(`retrieve:${m.index}`);
      }
      if (m.dirt > 0.6) {
        this.add('clean', `clean:${m.index}`, 12, { machine: m });
        want.add(`clean:${m.index}`);
      }
    }
    for (const ex of this.exchanges) {
      if (ex.state === 'jam') {
        this.add('fixEx', `fixEx:${ex.index}`, 90, { ex });
        want.add(`fixEx:${ex.index}`);
      }
      if (ex.state === 'empty' || ex.coins <= EX_LOW) {
        this.add('refill', `refill:${ex.index}`, ex.state === 'empty' ? 85 : 55, { ex });
        want.add(`refill:${ex.index}`);
      }
    }
    for (const j of this.logi.jobs()) {
      this.add(j.ship.dir === 'in' ? 'unload' : 'load', j.key, j.ship.dir === 'in' ? 66 : 52, { ship: j.ship, box: j.box });
      want.add(j.key);
    }
    for (const room of this.restrooms) {
      if (room.dirt < 0.55) continue;
      this.add('cleanWc', `wc:${room.id}`, room.dirt > 0.85 ? 62 : 38, { wc: room });
      want.add(`wc:${room.id}`);
    }
    for (const sp of this.spills()) {
      if (sp.cleaned) continue;
      const key = `mop:${sp.pos.x.toFixed(1)}:${sp.pos.z.toFixed(1)}`;
      this.add('mop', key, 68, { spill: sp });
      want.add(key);
    }
    for (const [k, r] of this.reqs) {
      const customerBound = r.kind === 'assist' || (r.kind === 'retrieve' && !!r.customer);
      if (r.claimed || customerBound || want.has(k)) continue;
      this.reqs.delete(k);
    }
  }

  private targetPos(r: Req): THREE.Vector3 {
    if (r.machine) return r.machine.servicePos();
    if (r.ex) return r.ex.servicePos();
    if (r.spill) return this.tmp.set(r.spill.pos.x + 0.9, 0, r.spill.pos.z + 0.4);
    if (r.wc) return r.wc.cleanSpot;
    if (r.kind === 'unload') return dockSpot();
    if (r.kind === 'load') return shelfSpot();
    return IDLE_SPOTS[0];
  }

  private claim(s: Staff): Task | null {
    let best: Req | null = null;
    let bs = -Infinity;
    for (const r of this.reqs.values()) {
      if (r.claimed) continue;
      if ((r.kind === 'restock' || r.kind === 'load') && this.hooks.warehouse() <= 0) continue;
      const t = this.targetPos(r);
      const score = r.pri - Math.hypot(t.x - s.pos.x, t.z - s.pos.z) * 0.6;
      if (score > bs) {
        bs = score;
        best = r;
      }
    }
    if (!best) return null;
    best.claimed = s;
    s.task = { req: best, plan: PLAN[best.kind], i: 0, t: 0, items: [] };
    return s.task;
  }

  private abort(s: Staff) {
    const t = s.task;
    if (!t) return;
    const r = t.req;
    r.claimed = null;
    if (r.machine) {
      r.machine.blocking = false;
      if (r.machine.service === (r.kind as ServiceKind)) r.machine.service = null;
    }
    if (r.kind === 'assist' && !r.customer) this.reqs.delete(r.key);
    if (t.items.length && r.machine) r.machine.addItems(t.items);
    else if (t.items.length && r.kind === 'load') this.hooks.putBack(t.items);
    s.human.setCarry(false);
    s.task = null;
  }

  // ---------- 移動 ----------
  private walk(s: Staff, dest: THREE.Vector3, dt: number) {
    if (s.dest.distanceToSquared(dest) > 0.0025) {
      s.dest.copy(dest);
      s.path = route(s.pos, dest);
    }
    while (s.path.length) {
      const wp = s.path[0];
      const dx = wp.x - s.pos.x;
      const dz = wp.z - s.pos.z;
      const d = Math.hypot(dx, dz);
      const step = SPEED * s.speedMul * dt;
      if (d <= step) {
        s.pos.x = wp.x;
        s.pos.z = wp.z;
        s.path.shift();
        if (!s.path.length) return true;
        continue;
      }
      s.pos.x += (dx / d) * step;
      s.pos.z += (dz / d) * step;
      this.face(s, dx, dz, dt);
      return false;
    }
    return true;
  }

  private face(s: Staff, dx: number, dz: number, dt: number) {
    const want = Math.atan2(dx, dz);
    let diff = want - s.human.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    s.human.group.rotation.y += diff * Math.min(1, dt * 8);
  }

  // ---------- 每步更新 ----------
  update(dt: number) {
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 1.5;
      this.scan();
      this.assignCashier();
    }
    for (const s of this.staff) {
      if (!s.active) continue;
      if (s.bubbleT > 0) s.bubbleT -= dt;
      if (s.leaving) {
        s.human.update(dt, 'walk');
        if (this.walk(s, lockerSpot(), dt)) {
          s.active = false;
          s.leaving = false;
          s.human.group.visible = false;
        }
        continue;
      }
      this.updateStaff(s, dt);
    }
  }

  private updateCashier(s: Staff, dt: number) {
    let pose: Pose = 'idle';
    s.human.setCarry(false);
    if (s.task) this.abort(s);
    const spot = cashierSpot();
    if (!this.walk(s, spot, dt)) {
      s.action = '前往櫃檯';
      pose = 'walk';
    } else {
      s.action = '櫃檯服務';
      this.face(s, 0, 1, dt);
      s.wavedAt -= dt;
      if (s.waveT > 0) {
        s.waveT -= dt;
        pose = 'wave';
      } else if (s.wavedAt <= 0 && this.hooks.isOpen() && this.hooks.nearbyCustomer(s.pos, 3.2)) {
        s.waveT = 1.2;
        s.wavedAt = 10;
        s.say(pick(['歡迎光臨!', '需要換零錢嗎?', '有問題可以問我~']), 2);
      }
    }
    s.human.update(dt, pose, s.reach);
  }

  private updateRest(s: Staff, dt: number) {
    const r = s.rest!;
    let pose: Pose = 'idle';
    if (r.phase === 'go') {
      s.action = '去休息室休息';
      if (this.walk(s, r.spot, dt)) {
        r.phase = 'sit';
        r.t = 0;
        this.face(s, -1, 0, dt);
        this.hooks.onRest();
      } else pose = 'walk';
    } else {
      s.action = '在休息室休息';
      r.t += dt;
      s.fatigue = Math.max(0, s.fatigue - 0.075 * dt);
      s.morale = Math.min(1, s.morale + 0.004 * dt);
      this.face(s, -1, 0, dt);
      if (r.t > 24 || s.fatigue <= 0.04 || (r.t > 5 && this.hasUrgent())) {
        this.lounge.release(s);
        s.rest = null;
        s.idleT = 0.4;
      }
    }
    s.human.update(dt, pose, s.reach);
  }

  private updateStaff(s: Staff, dt: number) {
    if (s.role === 'cashier') return this.updateCashier(s, dt);
    if (s.rest) return this.updateRest(s, dt);
    let pose: Pose = 'idle';
    if (!s.task) {
      s.human.setCarry(false);
      if (!this.claim(s)) {
        if (s.fatigue > 0.5) {
          const spot = this.lounge.claim(s);
          if (spot) {
            s.rest = { spot, phase: 'go', t: 0 };
            s.dest.set(1e9, 0, 1e9);
            s.path = [];
            s.say('有點累,去休息一下', 2);
            return;
          }
        }
        s.action = '巡場';
        s.idleT -= dt;
        if (s.idleT <= 0) {
          this.tmp.copy(pick(IDLE_SPOTS));
          s.dest.set(1e9, 0, 1e9);
          s.path = route(s.pos, this.tmp);
          s.dest.copy(this.tmp);
          s.idleT = rnd(6, 12);
        }
        if (s.path.length && !this.walk(s, s.dest, dt)) pose = 'walk';
        else {
          s.wavedAt -= dt;
          if (s.waveT > 0) {
            s.waveT -= dt;
            pose = 'wave';
          } else if (s.wavedAt <= 0 && this.hooks.isOpen() && this.hooks.nearbyCustomer(s.pos, 2.5)) {
            s.waveT = 1.4;
            s.wavedAt = 9;
            s.say(pick(['需要幫忙隨時叫我!', '歡迎光臨~', '玩得開心喔!']), 2);
          }
        }
        s.human.update(dt, pose, s.reach);
        return;
      }
    }

    const t = s.task!;
    const r = t.req;
    const step = t.plan[t.i];
    const next = () => {
      t.i++;
      t.t = 0;
    };
    const label = TASK_LABEL[r.kind];
    const where = r.machine ? r.machine.name : r.ex ? `兌幣機${r.ex.index + 1}` : r.wc ? r.wc.name : r.ship ? (r.kind === 'unload' ? '倉庫' : '貨車') : '地板';
    switch (step) {
      case 'toShelf': {
        s.action = `前往倉庫(${label})`;
        if (this.walk(s, shelfSpot(), dt)) next();
        else pose = 'walk';
        break;
      }
      case 'toDock': {
        s.action = `前往卸貨口(${label})`;
        if (this.walk(s, dockSpot(), dt)) next();
        else pose = 'walk';
        break;
      }
      case 'pickup': {
        s.action = r.kind === 'unload' ? '從貨車搬下紙箱' : r.kind === 'load' ? '從貨架搬出退貨' : '整理貨品';
        t.t += dt;
        if (t.t > 1.2) {
          if (r.kind === 'restock') {
            const n = Math.min(CAPACITY - (r.machine?.stock ?? 0), this.hooks.warehouse(), 24);
            t.items = n > 0 ? this.hooks.take(n) : [];
            if (!t.items.length) {
              this.abort(s);
              break;
            }
            this.hooks.log(`${s.name} 拿了 ${t.items.length} 隻娃娃,送去${where}`, 'staff');
          } else if (r.kind === 'load') {
            t.items = this.logi.loadBox(r.ship!);
          }
          s.human.setCarry(true);
          next();
        }
        break;
      }
      case 'go': {
        s.action = `${label} → ${where}`;
        if (this.walk(s, this.targetPos(r), dt)) {
          if (r.kind === 'mop') r.spill?.placeSign();
          next();
        } else pose = 'walk';
        break;
      }
      case 'wait': {
        s.action = `等${where}空檔`;
        const m = r.machine!;
        if (r.kind === 'restock') m.blocking = true;
        t.t += dt;
        if (!m.roundActive) {
          m.blocking = false;
          next();
        } else if (t.t > 45) {
          this.abort(s);
        }
        break;
      }
      case 'work': {
        s.action = `${label} ${where}`;
        t.t += dt;
        pose = 'play';
        if (r.machine) {
          const m = r.machine;
          if (r.kind === 'restock' || r.kind === 'assist' || r.kind === 'retrieve' || r.kind === 'fix') m.service = r.kind as ServiceKind;
          const k = t.t;
          if (r.kind === 'clean') {
            m.localToWorld(s.reach.l, -0.2 + Math.sin(k * 3.2) * 0.25, 1.25 + Math.sin(k * 1.7) * 0.18, 0.38);
            m.localToWorld(s.reach.r, 0.0 + Math.sin(k * 3.2 + 1) * 0.25, 1.35 + Math.sin(k * 1.7) * 0.18, 0.38);
          } else {
            m.localToWorld(s.reach.l, -0.22, 0.85 + Math.sin(k * 2.5) * 0.05, 0.4);
            m.localToWorld(s.reach.r, -0.05, 0.8 + Math.sin(k * 2.5 + 1) * 0.05, 0.4);
          }
          this.face(s, 0.5, -1, dt);
        } else if (r.ex) {
          s.reach.l.set(r.ex.x + 0.5, 1.1 + Math.sin(t.t * 3) * 0.05, r.ex.z + 0.3);
          s.reach.r.set(r.ex.x + 0.3, 1.0, r.ex.z + 0.35);
          this.face(s, -1, -0.3, dt);
        } else if (r.spill) {
          const k = t.t;
          s.reach.l.set(r.spill.pos.x + Math.sin(k * 4) * 0.35, 0.1, r.spill.pos.z + 0.05);
          s.reach.r.set(r.spill.pos.x + Math.sin(k * 4 + 0.5) * 0.35, 0.1, r.spill.pos.z + 0.15);
          this.face(s, -0.8, -0.5, dt);
        } else if (r.wc) {
          const p = r.wc.cleanSpot;
          s.reach.l.set(p.x + Math.sin(t.t * 4) * 0.35, 0.1, p.z + 0.35);
          s.reach.r.set(p.x + Math.sin(t.t * 4 + 0.5) * 0.35, 0.1, p.z + 0.45);
          this.face(s, 0, 1, dt);
        } else if (r.ship) {
          pose = 'idle';
          if (r.kind === 'unload') this.face(s, 0, -1, dt);
          else this.face(s, -1, 0, dt);
        }
        if (t.t >= WORK_TIME[r.kind] * s.timeMul(r.kind)) this.finish(s, t);
        break;
      }
    }
    s.human.update(dt, pose, s.reach);
  }

  private finish(s: Staff, t: Task) {
    const r = t.req;
    const m = r.machine;
    switch (r.kind) {
      case 'restock':
        m!.addItems(t.items);
        this.hooks.onRestock(m!, t.items.length);
        this.hooks.log(`${s.name} 為${m!.name}補了 ${t.items.length} 隻娃娃`, 'staff');
        s.say('補好貨了!', 1.8);
        break;
      case 'refill':
        r.ex!.coins = EX_CAP;
        if (r.ex!.state === 'empty') r.ex!.setState('ok');
        else r.ex!.refresh();
        this.hooks.onRefill(r.ex!);
        this.hooks.log(`${s.name} 為兌幣機${r.ex!.index + 1}補充了零錢`, 'staff');
        break;
      case 'assist':
        m!.assistNudge();
        if (r.customer) this.hooks.assistDone(r.customer, s);
        this.hooks.log(`${s.name} 幫${r.customer?.label ?? '客人'}調整了${m!.name}的娃娃位置`, 'staff');
        s.say('這樣應該比較好夾囉!', 2);
        break;
      case 'retrieve': {
        const prize = m!.retrievePrize();
        this.hooks.prizeRetrieved(m!, r.customer, prize);
        this.hooks.log(`${s.name} 從${m!.name}取出了卡住的獎品`, 'staff');
        s.say('拿出來了!', 1.8);
        break;
      }
      case 'fix':
        m!.repair();
        this.hooks.onRepair(m!);
        this.hooks.log(`${s.name} 修好了${m!.name}`, 'staff');
        s.say('修好了!', 1.8);
        break;
      case 'mop':
        r.spill!.cleaned = true;
        this.hooks.onMop(r.spill!);
        this.hooks.log(`${s.name} 清乾淨了地上的水漬`, 'staff');
        break;
      case 'clean':
        m!.dirt = Math.max(0, m!.dirt - 0.7);
        this.hooks.onClean(m!);
        break;
      case 'unload':
        this.logi.completeBox(r.ship!, r.box!);
        this.hooks.onUnload();
        break;
      case 'load':
        this.logi.completeBox(r.ship!, r.box!, t.items);
        this.hooks.onLoad();
        break;
      case 'cleanWc':
        r.wc!.dirt = 0;
        this.hooks.onWcClean(r.wc!);
        this.hooks.log(`${s.name} 打掃了${r.wc!.name}`, 'staff');
        break;
      case 'fixEx':
        r.ex!.setState(r.ex!.coins > 0 ? 'ok' : 'empty');
        this.hooks.onFixEx(r.ex!);
        this.hooks.log(`${s.name} 排除了兌幣機${r.ex!.index + 1}的卡鈔`, 'staff');
        break;
    }
    if (m) {
      m.service = null;
      m.blocking = false;
    }
    this.reqs.delete(r.key);
    s.human.setCarry(false);
    s.task = null;
    s.done++;
    const heavy = r.kind === 'unload' || r.kind === 'load' || r.kind === 'restock' ? 0.035 : 0;
    s.fatigue = Math.min(1, s.fatigue + (0.04 + heavy) * (1.3 - (0.6 * s.stat(4)) / 100));
    s.idleT = rnd(1, 3);
  }
}

void SERVICE_LABEL;
