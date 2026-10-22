import * as THREE from 'three';
import type { Sfx } from './audio';
import { RARITY } from './config';
import { Customer, CustomerManager, KINDS, LeaveReason } from './customers';
import {
  CAPACITY, DayStats, GameState, HOURS, OPEN_HOUR, OPEN_SECONDS, PACKS, Pack, RENT, StockItem, WAGES,
  clearSave, initialState, loadGame, newStats, rollRarity, saveGame, settle,
} from './economy';
import type { Input } from './input';
import { MACHINE_X, THEMES } from './layout';
import { Machine, SERVICE_LABEL } from './machine';
import type { Store } from './environment';
import type { PlushEntity } from './physics';
import { PLUSH_TYPES } from './plush';
import type { Renderer } from './render';
import { StaffManager } from './staff';
import type { Hud } from './ui';

export type Phase = 'prep' | 'open' | 'closing' | 'report';
export type FeedKind = 'customer' | 'sale' | 'win' | 'staff' | 'alert' | 'system';
export interface FeedItem {
  time: string;
  text: string;
  kind: FeedKind;
}

export interface Deps {
  gfx: Renderer;
  scene: THREE.Object3D;
  store: Store;
  input: Input;
  sfx: Sfx;
  hud: Hud;
  onWinFx: (m: Machine, p: PlushEntity) => void;
}

const DT = 1 / 60;
const ZERO = { x: 0, z: 0 };
const randomItem = (w = PACKS[0].weights): StockItem => ({ typeId: PLUSH_TYPES[Math.floor(Math.random() * PLUSH_TYPES.length)].id, rarity: rollRarity(w) });
const money = (n: number) => `${n < 0 ? '-' : ''}NT$ ${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export class Game {
  state: GameState;
  stats: DayStats = newStats();
  phase: Phase = 'prep';
  dayTime = 0;
  simTime = 0;
  readonly machines: Machine[] = [];
  readonly manager: CustomerManager;
  readonly staff: StaffManager;
  selected = 0;
  autoRestock = true;
  feed: FeedItem[] = [];
  feedVersion = 0;
  private acc = 0;
  private wantFill = false;
  private manual: Machine | null = null;
  private manualWon = 0;
  private manualGrab = false;
  private v = new THREE.Vector3();
  private handsCache = new Map<Machine, { l: THREE.Vector3; r: THREE.Vector3 }>();

  constructor(private d: Deps) {
    const saved = loadGame();
    const fresh = !saved;
    this.state = saved?.state ?? initialState();
    if (fresh) for (let i = 0; i < 12; i++) this.state.warehouse.push(randomItem());

    MACHINE_X.forEach((x, i) => {
      const items = saved?.machines?.[i]?.length ? saved.machines[i] : Array.from({ length: 22 }, () => randomItem());
      const m = new Machine(i, x, THEMES[i], d.scene, items, d.gfx.shadowSize);
      m.claw.strength = this.state.strength;
      this.machines.push(m);
    });

    this.manager = new CustomerManager(d.scene, this.machines, {
      price: () => this.state.price,
      isOpen: () => this.phase === 'open',
      totalStock: () => this.machines.reduce((s, m) => s + m.stock, 0),
      cashierReady: () => this.staff.cashierReady,
      serveStart: (c) => this.staff.serveStart(c),
      serveEnd: () => this.staff.serveEnd(),
      coinsSold: (c, coins, amount) => {
        this.state.cash += amount;
        this.stats.revenue += amount;
        this.stats.coinsSold += coins;
        this.d.sfx.coin();
        this.log(`💰 ${c.label}在櫃台換了 ${coins} 枚幣(${money(amount)})`, 'sale');
        this.refresh();
      },
      onCustomerEnter: (c) => {
        this.stats.customers++;
        this.log(`🚶 ${c.label}進店了`, 'customer');
      },
      onFull: () => {
        this.stats.walkouts++;
        this.stats.satSum -= 0.15;
        this.stats.satCount++;
        this.log('櫃台排太長,有客人看了一眼就走了', 'alert');
      },
      onPlay: (m) => {
        this.stats.plays++;
        m.dirt = Math.min(1, m.dirt + 0.008);
        m.cabinet.setDisplay('PLAYS', String(m.plays).padStart(3, '0'));
      },
      onResult: () => this.refresh(),
      onLeave: (c, sat, reason) => this.onLeave(c, sat, reason),
      requestHelp: (m, c) => {
        this.staff.requestHelp(m, c);
        this.log(`🙋 ${c.label}在${m.name}請求協助`, 'alert');
      },
      cancelHelp: (c) => this.staff.cancelHelp(c),
      cleanliness: () => THREE.MathUtils.clamp(1 - this.machines.reduce((s, m) => s + m.dirt, 0) / this.machines.length, 0, 1),
      hands: (m) => this.hands(m),
      log: (t, k) => this.log(t, k),
    });

    this.staff = new StaffManager(d.scene, this.machines, {
      isOpen: () => this.phase === 'open',
      warehouse: () => this.state.warehouse.length,
      take: (n) => {
        const items = this.state.warehouse.splice(0, n);
        this.refresh();
        return items;
      },
      autoRestock: () => this.autoRestock,
      wantFill: () => this.wantFill,
      nearbyCustomer: (pos, r) => this.manager.all.find((c) => c.state !== 'leaving' && c.pos.distanceTo(pos) < r) ?? null,
      assistDone: (c, ok) => this.manager.helped(c, ok),
      onRestock: (m, n) => {
        this.stats.restocks++;
        if (this.d.gfx.currentPreset !== 'store' && m.index !== this.selected) return;
        this.d.sfx.click();
        void n;
        this.refresh();
      },
      onClean: () => {
        this.stats.cleans++;
      },
      onAssist: () => {
        this.stats.assists++;
      },
      log: (t, k) => this.log(t, k),
    });

    for (const m of this.machines) {
      m.claw.events.onGrab = () => {
        this.manager.noteGrab(m);
        if (this.manual === m) this.manualGrab = true;
      };
      m.claw.events.onSlip = () => {
        this.manager.noteSlip(m);
        if (this.manual === m) {
          this.d.hud.say('啊!掉了…', 1400);
          this.d.sfx.fail();
        }
      };
      m.claw.events.onState = (s) => this.onClawState(m, s);
    }

    this.select(0);
    this.syncUi();
    this.log('店裡開始準備今天的營業', 'system');
  }

  get totalStock() {
    return this.machines.reduce((s, m) => s + m.stock, 0);
  }
  get sel() {
    return this.machines[this.selected];
  }

  private hands(m: Machine) {
    let h = this.handsCache.get(m);
    if (!h) {
      m.cabinet.group.updateMatrixWorld(true);
      h = { l: new THREE.Vector3(), r: new THREE.Vector3() };
      m.cabinet.joystickWorld(h.l);
      m.cabinet.buttonWorld(h.r);
      this.handsCache.set(m, h);
    }
    return h;
  }

  private clockString() {
    const frac = Math.min(1, this.dayTime / OPEN_SECONDS);
    const mins = Math.floor(OPEN_HOUR * 60 + HOURS * 60 * frac);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  log(text: string, kind: FeedKind) {
    this.feed.push({ time: this.phase === 'prep' || this.phase === 'report' ? '--:--' : this.clockString(), text, kind });
    if (this.feed.length > 60) this.feed.shift();
    this.feedVersion++;
  }

  // ---------- 狀態同步 ----------
  refresh() {
    const { hud, store } = this.d;
    hud.setCash(this.state.cash);
    hud.setRep(this.state.rep);
    hud.setDay(this.state.day);
    hud.updateSettings({
      price: this.state.price,
      strength: this.state.strength,
      machine: this.totalStock,
      warehouse: this.state.warehouse.length,
      custs: this.stats.customers,
      plays: this.stats.plays,
      wins: this.stats.wins,
      revenue: this.stats.revenue,
    });
    hud.renderShop(
      {
        cash: this.state.cash,
        machine: this.totalStock,
        capacity: CAPACITY * this.machines.length,
        warehouse: this.state.warehouse.length,
        canShelve: this.state.warehouse.length > 0 && this.machines.some((m) => m.stock < CAPACITY),
        auto: this.autoRestock,
      },
      (p) => this.buyPack(p),
    );
    store.setShelfStock(this.state.warehouse.length);
  }

  private syncUi() {
    this.d.hud.setPhase(this.phase);
    this.d.hud.setSpeed(this.state.speed);
    for (const m of this.machines) m.cabinet.setDisplay('CREDIT', '---');
    this.refresh();
    this.clockUi();
  }

  private clockUi() {
    const frac = Math.min(1, this.dayTime / OPEN_SECONDS);
    let label = `第 ${this.state.day} 天`;
    if (this.phase === 'prep') label += this.manual?.claw.playing ? ` · 試玩 ${Math.ceil(this.manual.claw.timeLeft)}s` : ' · 準備中';
    else if (this.phase === 'closing') label += ' · 打烊';
    this.d.hud.setClock(label, this.clockString(), frac);
  }

  save() {
    saveGame(this.state, this.machines.map((m) => m.physics.stockItems()));
  }

  // ---------- 玩家操作 ----------
  select(i: number) {
    this.selected = i;
    this.d.gfx.setFocusX(this.machines[i].x);
    this.d.hud.setSelected(i, this.machines.map((m) => m.name));
  }
  setPrice(v: number) {
    this.state.price = v;
    this.refresh();
    this.save();
  }
  setStrength(v: number) {
    this.state.strength = v;
    for (const m of this.machines) m.claw.strength = v;
    this.refresh();
    this.save();
  }
  setSpeed(s: number) {
    this.state.speed = s;
    this.d.hud.setSpeed(s);
  }
  setAuto(on: boolean) {
    this.autoRestock = on;
    this.refresh();
  }

  testPlay() {
    const m = this.sel;
    const { hud } = this.d;
    if (this.phase !== 'prep' || this.manual) return;
    if (m.claw.state !== 'idle' || m.service || m.blocking || m.line.length) {
      hud.say(`${m.name}現在有人在用`, 1400);
      return;
    }
    this.manual = m;
    this.manualWon = 0;
    this.manualGrab = false;
    m.claw.begin();
    hud.showControls(true);
    hud.say(`試玩 ${m.name}:移動爪子,對準後按「放爪」`, 2200);
  }

  get manualMachine() {
    return this.manual;
  }

  buyPack(p: Pack) {
    if (this.state.cash < p.price) {
      this.d.hud.say('現金不足', 1400);
      return;
    }
    this.state.cash -= p.price;
    this.stats.purchases += p.price;
    for (let i = 0; i < p.count; i++) this.state.warehouse.push(randomItem(p.weights));
    this.d.sfx.coin();
    this.d.hud.say(`已進貨 ${p.count} 隻,存放在倉庫`, 1800);
    this.log(`📦 進貨 ${p.name} ×${p.count}(${money(p.price)})`, 'system');
    this.refresh();
    this.save();
  }

  /** 請員工把倉庫的貨補滿所有機台 */
  shelve() {
    if (!this.state.warehouse.length) return;
    this.wantFill = true;
    this.d.hud.say('已請店員補貨', 1400);
    this.log('📋 老闆要求補貨,店員會依序處理', 'system');
  }

  openShop() {
    const { hud } = this.d;
    if (this.phase !== 'prep' || this.manual) return;
    if (this.totalStock < 9) {
      hud.say('機台裡的娃娃太少,先到 🛒 進貨並請店員補貨', 2600);
      return;
    }
    this.phase = 'open';
    this.dayTime = 0;
    this.stats = newStats();
    for (const m of this.machines) {
      m.plays = 0;
      m.wins = 0;
      m.cabinet.setDisplay('PLAYS', '000');
    }
    hud.showControls(false);
    hud.openShop(false);
    hud.say('開始營業!', 1800);
    this.log('🔔 開店營業', 'system');
    this.syncUi();
  }

  private closeShop() {
    this.phase = 'closing';
    this.manager.closeShop();
    this.d.hud.say('打烊囉,等最後一位客人玩完', 2400);
    this.log('🔕 打烊,正在送走客人', 'system');
    this.syncUi();
  }

  private finishDay() {
    const { hud } = this.d;
    this.phase = 'report';
    const r = settle(this.stats);
    this.state.cash -= RENT + WAGES;
    this.state.rep = Math.max(0.5, Math.min(5, this.state.rep + r.repDelta));
    this.state.totalProfit += r.profit;
    const s = this.stats;
    const stars = Math.round(this.state.rep);
    const rows: [string, string, 'pos' | 'neg' | ''][] = [
      ['來店顧客', `${s.customers} 人`, ''],
      ['換出代幣 / 遊玩次數', `${s.coinsSold} 枚 / ${s.plays} 次`, ''],
      ['送出獎品', `${s.wins} 隻(稀有 ${s.rareWins})· 成功率 ${Math.round(r.winRate * 100)}%`, ''],
      ...this.machines.map((m): [string, string, ''] => [m.name, `遊玩 ${m.plays} 次 · 送出 ${m.wins} 隻`, '']),
      ['營收', money(s.revenue), 'pos'],
      ['獎品成本', money(-s.cogs), 'neg'],
      ['房租與水電', money(-RENT), 'neg'],
      ['員工薪資(3 人)', money(-WAGES), 'neg'],
      ['員工工作', `補貨 ${s.restocks} 次 · 清潔 ${s.cleans} 次 · 協助客人 ${s.assists} 次`, ''],
      ['顧客滿意度', `${r.avgSat >= 0 ? '+' : ''}${Math.round(r.avgSat * 100)}`, r.avgSat >= 0 ? 'pos' : 'neg'],
      ['聲望變化', `${r.repDelta >= 0 ? '+' : ''}${r.repDelta.toFixed(2)}(現在 ${this.state.rep.toFixed(1)})`, r.repDelta >= 0 ? 'pos' : 'neg'],
      ['今日進貨支出', money(-s.purchases), ''],
      ['目前現金', money(this.state.cash), this.state.cash >= 0 ? '' : 'neg'],
    ];
    let tip = '';
    if (s.noStock > 0) tip = `有 ${s.noStock} 位客人因為缺貨離開。倉庫的貨要夠,營業前記得進貨。`;
    else if (s.walkouts > 2) tip = '櫃台排隊太長,有客人直接走了。可以提高售價增加單客收益。';
    else if (s.angry > 3 && r.winRate < 0.18) tip = '成功率偏低,不少客人生氣離開。可以調高爪力,或降低售價。';
    else if (r.profit < 0 && r.winRate > 0.35) tip = '成功率很高但虧本。可以調低爪力,或提高售價。';
    else if (r.profit < 0) tip = '今天虧損。固定支出(房租加 3 位員工薪資)每天 ' + money(RENT + WAGES) + ',客人不夠多時要小心。';
    else tip = '營運穩定。可以試著微調售價與爪力,找到客流與利潤的平衡。';
    hud.showReport({ day: this.state.day, stars: '★'.repeat(stars) + '☆'.repeat(5 - stars), rows, total: [money(r.profit), r.profit >= 0 ? 'pos' : 'neg'], tip }, () => this.nextDay());
    this.d.sfx.win(r.profit > 0);
    this.log(`📊 第 ${this.state.day} 天結算:淨利 ${money(r.profit)}`, 'system');
    this.refresh();
    this.save();
  }

  private nextDay() {
    this.state.day++;
    this.phase = 'prep';
    this.dayTime = 0;
    for (const m of this.machines) m.cabinet.setDisplay('CREDIT', '---');
    this.d.hud.say(this.state.cash < 0 ? '現金為負,小心周轉' : `第 ${this.state.day} 天,準備開店`, 2200);
    this.log(`🌅 第 ${this.state.day} 天,準備開店`, 'system');
    this.syncUi();
    this.save();
  }

  resetAll() {
    clearSave();
    location.reload();
  }

  // ---------- 事件 ----------
  private onClawState(m: Machine, s: string) {
    const { sfx, hud } = this.d;
    const audible = m === this.sel;
    if (audible && s === 'descend') sfx.drop();
    if (audible && s === 'close') sfx.clack();
    if (this.manual === m) {
      if (s === 'lift') hud.say(this.manualGrab ? '夾到了!' : '什麼都沒夾到…', 1300);
      if (s === 'descend') this.manualGrab = false;
    }
    if (s === 'idle') {
      if (m.roundActive) this.manager.roundEnded(m);
      else if (this.manual === m) {
        this.manual = null;
        hud.showControls(false);
        if (this.manualWon === 0) hud.say('再試一次?', 1400);
      }
    }
  }

  private onLeave(c: Customer, sat: number, reason: LeaveReason) {
    // 沒用完的代幣退還給客人
    if (c.coins > 0) {
      const back = c.coins * this.state.price;
      this.state.cash -= back;
      this.stats.revenue -= back;
      this.stats.coinsSold -= c.coins;
      this.log(`↩ ${c.label}退回 ${c.coins} 枚沒用完的幣(${money(back)})`, 'sale');
      c.coins = 0;
      this.refresh();
    }
    if (reason !== 'closed') {
      this.stats.satSum += sat;
      this.stats.satCount++;
    }
    if (reason === 'nostock') {
      this.stats.noStock++;
      this.log(`${c.label}因為缺貨空手離開`, 'alert');
    } else if (reason === 'angry') {
      this.stats.angry++;
      this.log(`😤 ${c.label}覺得太難,生氣離開`, 'alert');
    } else if (reason === 'impatient') {
      this.stats.angry++;
      this.log(`😒 ${c.label}等太久,不玩了`, 'alert');
    } else if (reason === 'done') {
      this.log(`👋 ${c.label}玩完離開${c.wins ? `(帶走 ${c.wins} 隻)` : ''}`, 'customer');
    }
  }

  private handleWin(m: Machine, p: PlushEntity) {
    const r = RARITY[p.rarity];
    const audible = m === this.sel;
    if (audible) this.d.sfx.win(p.rarity !== 'common');
    this.d.onWinFx(m, p);
    if (this.manual === m || this.phase === 'prep') {
      this.manualWon++;
      this.state.warehouse.push({ typeId: p.type.id, rarity: p.rarity });
      this.d.hud.say(`🎉 試玩獲得 ${p.type.name}(${r.label}),已放回倉庫`, 2400);
      this.log(`🧸 試玩${m.name}夾到 ${p.type.name}(${r.label}),放回倉庫`, 'win');
    } else {
      this.stats.wins++;
      m.wins++;
      if (p.rarity !== 'common') this.stats.rareWins++;
      this.stats.cogs += p.cost;
      this.manager.noteWin(m, p);
      const who = m.line[0] ? KINDS[m.line[0].kind].label : '客人';
      this.log(`🧸 ${who}在${m.name}夾到 ${p.type.name}(${r.label})`, 'win');
    }
    this.refresh();
  }

  // ---------- 主迴圈 ----------
  private step() {
    for (const m of this.machines) {
      const inp = m.roundActive ? this.manager.pilotInput(m, DT) : this.manual === m ? this.d.input.move : ZERO;
      m.claw.update(DT, inp);
      m.physics.world.step();
    }
    this.simTime += DT;
    if (this.phase === 'open') {
      this.dayTime += DT;
      if (this.dayTime >= OPEN_SECONDS) this.closeShop();
    }
    this.manager.update(DT, this.state.rep);
    this.staff.update(DT);
    // 清潔度會隨時間下降
    for (const m of this.machines) m.dirt = Math.min(1, m.dirt + (this.phase === 'open' ? 0.00001 : 0.000002));
    if (this.phase === 'closing' && this.manager.isEmpty && this.machines.every((m) => m.claw.state === 'idle' && !m.service && !m.roundActive)) this.finishDay();
  }

  /** 每個畫面幀呼叫;dt 為真實秒數 */
  frame(dt: number) {
    const speed = this.phase === 'open' || this.phase === 'closing' ? this.state.speed : 1;
    this.acc += dt * speed;
    let n = 0;
    const maxSteps = 6;
    while (this.acc >= DT && n < maxSteps) {
      this.step();
      this.acc -= DT;
      n++;
    }
    if (n === maxSteps) this.acc = 0;

    for (const m of this.machines) {
      m.physics.syncMeshes();
      m.cabinet.setClawPos(m.claw.pos.x, m.claw.pos.y, m.claw.pos.z);
      for (const p of m.physics.detectWins(this.simTime)) this.handleWin(m, p);
      for (const p of [...m.physics.plushes]) {
        if (p.won && this.simTime - p.wonAt > 1.2) {
          m.cabinet.group.remove(p.mesh);
          m.physics.remove(p);
          this.refresh();
        }
      }
    }
    if (this.wantFill && (!this.state.warehouse.length || this.machines.every((m) => m.stock >= CAPACITY - 2))) this.wantFill = false;

    this.clockUi();
    this.d.hud.setQueue(this.manager.queueLength);
    this.d.hud.showControls(this.manual !== null && this.manual.claw.state === 'play');
    this.d.hud.tick(dt);
    this.updateBubbles();
    this.d.hud.renderOps(dt, () => this.opsSnapshot(), this.feedVersion, this.selected);
  }

  private opsSnapshot() {
    return {
      machines: this.machines.map((m) => {
        let status = '空閒';
        let kind: 'busy' | 'service' | 'warn' | 'idle' = 'idle';
        if (m.service) {
          status = SERVICE_LABEL[m.service];
          kind = 'service';
        } else if (m.roundActive) {
          status = '遊玩中';
          kind = 'busy';
        } else if (m.blocking) {
          status = '等待維護';
          kind = 'service';
        } else if (m.stock < 3) {
          status = '缺貨';
          kind = 'warn';
        } else if (m.line.length) {
          status = '準備中';
          kind = 'busy';
        }
        return { name: m.name, status, kind, stock: m.stock, queue: m.line.length, plays: m.plays, wins: m.wins, dirt: m.dirt, color: '#' + THEMES[m.index].accent.toString(16).padStart(6, '0') };
      }),
      staff: this.staff.staff.map((s) => ({ name: s.name, role: s.role === 'cashier' ? '收銀' : '理貨', action: s.action })),
      counter: this.manager.counterLine.length,
      warehouse: this.state.warehouse.length,
      feed: this.feed.slice(-9).reverse(),
    };
  }

  private updateBubbles() {
    const { gfx } = this.d;
    const items: { id: number; x: number; y: number; text: string; who: string }[] = [];
    const push = (id: number, head: THREE.Vector3, text: string, who: string) => {
      this.v.copy(head).project(gfx.camera);
      if (this.v.z > 1) return;
      items.push({ id, x: (this.v.x * 0.5 + 0.5) * innerWidth, y: (-this.v.y * 0.5 + 0.5) * innerHeight, text, who });
    };
    const head = new THREE.Vector3();
    for (const c of this.manager.all) {
      if (c.bubbleT <= 0 || !c.bubble) continue;
      push(c.human.group.id, c.human.headWorld(head), c.bubble, KINDS[c.kind].label);
    }
    for (const s of this.staff.staff) {
      if (s.bubbleT <= 0 || !s.bubble) continue;
      push(s.human.group.id, s.human.headWorld(head), s.bubble, `店員 ${s.name}`);
    }
    this.d.hud.renderBubbles(items);
  }
}
