import * as THREE from 'three';
import type { Customer } from './customers';
import { CAPACITY, StockItem } from './economy';
import { Human, Pose } from './human';
import { COUNTER, cashierSpot, idleSpots, shelfSpot } from './layout';
import { Machine, SERVICE_LABEL, ServiceKind } from './machine';

export type StaffRole = 'cashier' | 'floor';
type Step = 'toShelf' | 'pickup' | 'toMachine' | 'wait' | 'work';

interface Task {
  kind: ServiceKind;
  machine: Machine;
  step: Step;
  t: number;
  items: StockItem[];
  customer?: Customer;
}

const WORK_TIME: Record<ServiceKind, number> = { restock: 4.5, clean: 3.2, assist: 3.5 };
const SPEED = 1.5;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Staff {
  readonly human: Human;
  task: Task | null = null;
  action = '待命';
  bubble = '';
  bubbleT = 0;
  serving = false;
  carrying = false;
  idleT = rnd(1, 4);
  waveT = 0;
  wavedAt = 0;
  readonly target = new THREE.Vector3();
  readonly reach = { l: new THREE.Vector3(), r: new THREE.Vector3() };

  constructor(readonly name: string, readonly role: StaffRole, skin: number, hair: number, shirt: number, start: THREE.Vector3) {
    this.human = new Human({ skin, shirt, pants: 0x1f2433, hair, scale: 1, kid: false, accessory: 'staff' });
    this.human.group.position.copy(start);
    this.target.copy(start);
  }
  get pos() {
    return this.human.group.position;
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
  assistDone(c: Customer, ok: boolean): void;
  onRestock(m: Machine, n: number): void;
  onClean(m: Machine): void;
  onAssist(m: Machine, c: Customer, won: boolean): void;
  log(text: string, kind: 'staff' | 'alert'): void;
}

export class StaffManager {
  readonly staff: Staff[];
  readonly cashier: Staff;
  private help: { machine: Machine; customer: Customer }[] = [];
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Object3D, private machines: Machine[], private hooks: StaffHooks) {
    this.cashier = new Staff('小美', 'cashier', 0xf1c9a5, 0x3a2418, 0x2a3b6b, cashierSpot());
    const a = new Staff('阿凱', 'floor', 0xe0ac86, 0x1a1512, 0x1f5f7a, new THREE.Vector3(-4.2, 0, 3.0));
    const b = new Staff('小雯', 'floor', 0xf1c9a5, 0x6b4426, 0x1f5f7a, new THREE.Vector3(1.4, 0, 3.4));
    this.staff = [this.cashier, a, b];
    for (const s of this.staff) scene.add(s.human.group);
    this.cashier.human.group.rotation.y = 0;
  }

  // ---------- 櫃台 ----------
  get cashierReady() {
    return !this.cashier.serving && this.cashier.pos.distanceTo(cashierSpot()) < 0.1;
  }
  serveStart(c: Customer) {
    this.cashier.serving = true;
    this.cashier.action = `為${c.label}換幣`;
    this.cashier.say('歡迎光臨!要換幾枚幣呢?', 2.2);
  }
  serveEnd() {
    this.cashier.serving = false;
    this.cashier.action = '收銀待命';
    this.cashier.say('祝你玩得開心!', 1.6);
  }

  // ---------- 協助請求 ----------
  requestHelp(m: Machine, c: Customer) {
    this.help.push({ machine: m, customer: c });
  }
  cancelHelp(c: Customer) {
    this.help = this.help.filter((h) => h.customer !== c);
    for (const s of this.staff) {
      if (s.task?.customer === c) this.abort(s);
    }
  }

  // ---------- 任務挑選 ----------
  private pickTask(s: Staff): Task | null {
    // 1. 協助客人
    for (const h of this.help) {
      if (h.machine.reserved.has('assist') || h.customer.state === 'leaving') continue;
      this.help.splice(this.help.indexOf(h), 1);
      return this.begin(s, 'assist', h.machine, 'toMachine', h.customer);
    }
    // 2. 補貨
    if (this.hooks.warehouse() > 0) {
      const fill = this.hooks.wantFill();
      const cand = this.machines
        .filter((m) => !m.reserved.has('restock'))
        .filter((m) => m.stock <= 5 || (this.hooks.autoRestock() && m.stock <= 12) || (fill && CAPACITY - m.stock >= 3))
        .sort((a, b) => a.stock - b.stock)[0];
      if (cand) return this.begin(s, 'restock', cand, 'toShelf');
    }
    // 3. 清潔
    const dirty = this.machines.filter((m) => !m.reserved.has('clean') && m.dirt > 0.45).sort((a, b) => b.dirt - a.dirt)[0];
    if (dirty) return this.begin(s, 'clean', dirty, 'toMachine');
    return null;
  }

  private begin(s: Staff, kind: ServiceKind, machine: Machine, step: Step, customer?: Customer): Task {
    machine.reserved.add(kind);
    s.task = { kind, machine, step, t: 0, items: [], customer };
    return s.task;
  }

  private abort(s: Staff) {
    const t = s.task;
    if (!t) return;
    t.machine.reserved.delete(t.kind);
    if (t.machine.service === t.kind) t.machine.service = null;
    t.machine.blocking = false;
    if (t.items.length) {
      // 帶不進去就放回(丟回倉庫由呼叫端處理;這裡直接放進機台)
      t.machine.addItems(t.items);
    }
    s.human.setCarry(false);
    s.carrying = false;
    s.task = null;
  }

  private walk(s: Staff, dest: THREE.Vector3, dt: number) {
    const dx = dest.x - s.pos.x;
    const dz = dest.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, SPEED * dt);
    s.pos.x += (dx / d) * step;
    s.pos.z += (dz / d) * step;
    this.face(s, dx, dz, dt);
    return false;
  }

  private face(s: Staff, dx: number, dz: number, dt: number) {
    const want = Math.atan2(dx, dz);
    let diff = want - s.human.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    s.human.group.rotation.y += diff * Math.min(1, dt * 8);
  }

  // ---------- 每步更新 ----------
  update(dt: number) {
    for (const s of this.staff) {
      if (s.bubbleT > 0) s.bubbleT -= dt;
      if (s.role === 'cashier') this.updateCashier(s, dt);
      else this.updateFloor(s, dt);
    }
  }

  private updateCashier(s: Staff, dt: number) {
    const spot = cashierSpot();
    let pose: Pose = 'idle';
    if (!this.walk(s, spot, dt)) pose = 'walk';
    else {
      this.face(s, 0, 1, dt);
      if (s.serving) {
        pose = 'play';
        const t = performance.now() / 1000;
        s.reach.l.set(COUNTER.x - 0.3, 1.1, COUNTER.z + 0.2);
        s.reach.r.set(COUNTER.x + 0.25 + Math.sin(t * 3) * 0.08, 1.12, COUNTER.z + 0.3);
      } else if (s.waveT > 0) {
        s.waveT -= dt;
        pose = 'wave';
      } else {
        s.action = '收銀待命';
        // 有新客人靠近櫃台時打招呼
        s.wavedAt -= dt;
        if (s.wavedAt <= 0 && this.hooks.isOpen()) {
          const c = this.hooks.nearbyCustomer(s.pos, 3.2);
          if (c) {
            s.waveT = 1.6;
            s.wavedAt = 6;
            s.say('歡迎光臨~', 1.8);
          }
        }
      }
    }
    s.human.update(dt, pose, s.reach);
  }

  private updateFloor(s: Staff, dt: number) {
    let pose: Pose = 'idle';
    if (!s.task) {
      s.human.setCarry(false);
      const next = this.pickTask(s);
      if (!next) {
        // 巡場:偶爾換個位置站,看到客人會打招呼
        s.action = '巡場';
        s.idleT -= dt;
        if (s.idleT <= 0) {
          s.target.copy(idleSpots[Math.floor(Math.random() * idleSpots.length)]);
          s.idleT = rnd(5, 10);
        }
        if (!this.walk(s, s.target, dt)) pose = 'walk';
        else {
          this.face(s, 0, 1, dt);
          s.wavedAt -= dt;
          if (s.waveT > 0) {
            s.waveT -= dt;
            pose = 'wave';
          } else if (s.wavedAt <= 0 && this.hooks.isOpen() && this.hooks.nearbyCustomer(s.pos, 2.5)) {
            s.waveT = 1.4;
            s.wavedAt = 9;
            s.say(['需要幫忙隨時叫我!', '加油喔~', '歡迎光臨!'][Math.floor(Math.random() * 3)], 2);
          }
        }
        s.human.update(dt, pose, s.reach);
        return;
      }
    }

    const t = s.task!;
    const m = t.machine;
    const name = m.name;
    switch (t.step) {
      case 'toShelf': {
        s.action = '前往倉庫';
        if (this.walk(s, shelfSpot(), dt)) {
          t.step = 'pickup';
          t.t = 0;
          const n = Math.min(CAPACITY - m.stock, this.hooks.warehouse(), 12);
          t.items = n > 0 ? this.hooks.take(n) : [];
          if (!t.items.length) return this.abort(s);
        } else pose = 'walk';
        break;
      }
      case 'pickup': {
        s.action = '整理貨品';
        t.t += dt;
        this.face(s, -1, 0, dt);
        if (t.t > 1.2) {
          s.human.setCarry(true);
          s.carrying = true;
          t.step = 'toMachine';
          this.hooks.log(`${s.name} 拿了 ${t.items.length} 隻娃娃,送去${name}`, 'staff');
        }
        break;
      }
      case 'toMachine': {
        s.action = t.kind === 'restock' ? `搬貨前往${name}` : t.kind === 'clean' ? `前往${name}清潔` : `趕去${name}協助`;
        if (this.walk(s, m.servicePos(), dt)) {
          if (t.kind === 'clean') {
            t.step = 'work';
            t.t = 0;
          } else {
            m.blocking = true;
            t.step = 'wait';
            t.t = 0;
          }
        } else pose = 'walk';
        break;
      }
      case 'wait': {
        s.action = `等${name}空檔`;
        m.blocking = true;
        t.t += dt;
        this.face(s, 0.3, -1, dt);
        if (!m.roundActive && m.claw.state === 'idle') {
          m.service = t.kind;
          m.blocking = false;
          t.step = 'work';
          t.t = 0;
        } else if (t.t > 40) {
          m.blocking = false;
          return this.abort(s);
        }
        break;
      }
      case 'work': {
        s.action = `${SERVICE_LABEL[t.kind]} ${name}`;
        t.t += dt;
        this.face(s, 0.35, -1, dt);
        pose = 'play';
        const k = t.t;
        if (t.kind === 'clean') {
          m.cabinet.group.localToWorld(s.reach.l.set(-0.5 + Math.sin(k * 3.2) * 0.35, 0.9 + Math.sin(k * 1.7) * 0.25, 0.7));
          m.cabinet.group.localToWorld(s.reach.r.set(-0.3 + Math.sin(k * 3.2 + 1) * 0.35, 1.0 + Math.sin(k * 1.7) * 0.25, 0.7));
        } else {
          m.cabinet.group.localToWorld(s.reach.l.set(-0.6, 1.0 + Math.sin(k * 2.5) * 0.1, 0.55));
          m.cabinet.group.localToWorld(s.reach.r.set(-0.4, 0.95 + Math.sin(k * 2.5 + 1) * 0.1, 0.55));
        }
        if (t.t >= WORK_TIME[t.kind]) this.finish(s, t);
        break;
      }
    }
    s.human.update(dt, pose, s.reach);
  }

  private finish(s: Staff, t: Task) {
    const m = t.machine;
    if (t.kind === 'restock') {
      m.addItems(t.items);
      s.human.setCarry(false);
      s.carrying = false;
      this.hooks.onRestock(m, t.items.length);
      this.hooks.log(`${s.name} 為${m.name}補了 ${t.items.length} 隻娃娃`, 'staff');
      s.say('補好貨了!', 1.8);
    } else if (t.kind === 'clean') {
      m.dirt = Math.max(0, m.dirt - 0.7);
      this.hooks.onClean(m);
      this.hooks.log(`${s.name} 擦亮了${m.name}的玻璃`, 'staff');
    } else if (t.kind === 'assist' && t.customer) {
      const p = m.physics.assistNudge();
      this.hooks.assistDone(t.customer, true);
      this.hooks.onAssist(m, t.customer, !!p);
      this.hooks.log(`${s.name} 幫${t.customer.label}調整了${m.name}的娃娃位置`, 'staff');
      s.say('這樣應該比較好夾囉!', 2);
    }
    m.service = null;
    m.reserved.delete(t.kind);
    s.task = null;
    s.idleT = rnd(1, 3);
  }
}

void (null as unknown as StaffRole);
