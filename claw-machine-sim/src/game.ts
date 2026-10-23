import * as THREE from 'three';
import type { Sfx } from './audio';
import { RARITY } from './config';
import { Customer, CustomerManager, KINDS, LeaveReason } from './customers';
import {
  CAPACITY, DayStats, GameState, HOURS, OPEN_HOUR, OPEN_SECONDS, PACKS, Pack, RENT, SHIFT_NAMES, StockItem, WAGE_SHIFT,
  clearSave, initialState, loadGame, newStats, rollRarity, saveGame, settle,
} from './economy';
import type { Store } from './environment';
import { EventDirector, Spill } from './events';
import { Exchange } from './exchange';
import type { Input } from './input';
import { EXCHANGES, N_MACHINES, THEMES, gridOf, themeOf } from './layout';
import type { LiteLayer } from './lite';
import { Machine, Prize, SERVICE_LABEL } from './machine';
import { PLUSH_TYPES } from './plush';
import type { Renderer } from './render';
import { StaffManager, TASK_LABEL } from './staff';
import { BossNpc } from './boss';
import { BOSS, REGULARS, STAFF_DEFS } from './characters';
import { Branch, Ctx, Eff, ModSpec, STORIES, Story, storyById } from './stories';
import type { Character } from './characters';
import type { Expression } from './portrait';
import type { Hud, ProfileView } from './ui';

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
  lite: LiteLayer;
  input: Input;
  sfx: Sfx;
  hud: Hud;
  onWinFx: (m: Machine, p: Prize) => void;
}

export interface Marker {
  id: string;
  x: number;
  y: number;
  z: number;
  icon: string;
  urgent: boolean;
  machine?: number;
}

const DT = 1 / 60;
const ZERO = { x: 0, z: 0 };
const randomItem = (w = PACKS[1].weights): StockItem => ({ typeId: PLUSH_TYPES[Math.floor(Math.random() * PLUSH_TYPES.length)].id, rarity: rollRarity(w) });
const money = (n: number) => `${n < 0 ? '-' : ''}NT$ ${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export class Game {
  state: GameState;
  stats: DayStats = newStats();
  phase: Phase = 'prep';
  dayTime = 0;
  simTime = 0;
  readonly machines: Machine[] = [];
  readonly exchanges: Exchange[] = [];
  readonly spills: Spill[] = [];
  readonly manager: CustomerManager;
  readonly staff: StaffManager;
  readonly events: EventDirector;
  readonly boss: BossNpc;
  selected = 0;
  private profile: { type: 'staff' | 'customer' | 'boss'; ref: unknown } | null = null;
  private profileT = 0;
  private selRing: THREE.Mesh;
  private storyOpen = false;
  private pendingSlot: 'morning' | 'midday' | 'evening' | null = null;
  private middayDone = false;
  private eveningDone = false;
  autoRestock = true;
  feed: FeedItem[] = [];
  feedVersion = 0;
  private acc = 0;
  private wantFill = false;
  private manual: Machine | null = null;
  private manualWon = 0;
  private manualGrab = false;
  private shift = 0;
  private detailT = 0;
  private lastLed: number[] = [];
  private lastStock: number[] = [];
  private logGate = new Map<string, number>();
  private v = new THREE.Vector3();
  private head = new THREE.Vector3();

  constructor(private d: Deps) {
    const saved = loadGame();
    const fresh = !saved;
    this.state = saved?.state ?? initialState();
    if (fresh) for (let i = 0; i < 240; i++) this.state.warehouse.push(randomItem());

    for (let i = 0; i < N_MACHINES; i++) {
      const items = saved?.machines?.[i]?.length ? saved.machines[i] : Array.from({ length: 22 }, () => randomItem());
      const m = new Machine(i, gridOf(i), themeOf(i), items, d.scene, d.gfx.shadowSize);
      m.strength = this.state.strength;
      this.machines.push(m);
      d.lite.setPile(i, m.stock, m.items);
    }
    for (let k = 0; k < EXCHANGES.length; k++) this.exchanges.push(new Exchange(k, d.scene));

    this.events = new EventDirector({
      isOpen: () => this.phase === 'open',
      customers: () => this.manager.all,
      machines: () => this.machines,
      exchanges: () => this.exchanges,
      spill: (c) => this.spawnSpill(c),
      fault: (m) => this.machineFault(m),
    });
    for (const m of this.machines) m.stuckChance = this.events.stuckChance;

    this.manager = new CustomerManager(d.scene, this.machines, this.exchanges, {
      price: () => this.state.price,
      isOpen: () => this.phase === 'open',
      totalStock: () => this.machines.reduce((s, m) => s + (m.fault ? 0 : m.stock), 0),
      coinsSold: (_c, coins, amount) => {
        this.state.cash += amount;
        this.stats.revenue += amount;
        this.stats.coinsSold += coins;
        d.sfx.coin();
      },
      onCustomerEnter: (c) => {
        this.stats.customers++;
        if (c.ch.regular) {
          const r = (this.state.regulars[c.ch.id] ??= { visits: 0 });
          r.visits++;
          this.log(`⭐ 常客「${c.ch.name}」來了(第 ${r.visits} 次)`, 'customer');
        }
      },
      onFull: () => {
        this.stats.walkouts++;
        this.stats.satSum -= 0.15;
        this.stats.satCount++;
        this.logGated('full', 8, '前廳排太長,有客人看了一眼就走了', 'alert');
      },
      onPlay: (m) => {
        this.stats.plays++;
        m.dirt = Math.min(1, m.dirt + 0.008);
        if (m.mode === 'full') m.cabinet!.setDisplay('PLAYS', String(m.plays).padStart(3, '0'));
      },
      onResult: () => {},
      onLeave: (c, sat, reason) => this.onLeave(c, sat, reason),
      requestHelp: (kind, target, c) => {
        this.staff.requestHelp(kind, target, c);
        if (kind === 'retrieve') this.log(`🧸 ${(target as Machine).name}的獎品卡在洞口,${c.label}在等店員`, 'alert');
      },
      cancelHelp: (c) => this.staff.cancelHelp(c),
      cleanliness: () => {
        let s = 0;
        for (const m of this.machines) s += m.dirt;
        return THREE.MathUtils.clamp(1 - s / this.machines.length, 0, 1);
      },
      spills: () => this.spills,
      onSlip: (c) => {
        this.stats.slips++;
        this.stats.satSum -= 0.3;
        this.stats.satCount++;
        this.log(`😵 ${c.label}踩到水漬滑倒了`, 'alert');
      },
      jamChance: () => this.events.jam,
      moodBonus: () => this.state.mods.reduce((s, m) => s + (m.mood ?? 0), 0),
      onExchangeJam: (ex) => {
        this.stats.jams++;
        this.log(`💴 兌幣機${ex.index + 1}卡鈔了`, 'alert');
      },
      onExchangeEmpty: (ex) => this.log(`🪙 兌幣機${ex.index + 1}沒有零錢了`, 'alert'),
      onExchangeLow: () => {},
      log: (t, k) => this.log(t, k),
    });

    this.staff = new StaffManager(d.scene, this.machines, this.exchanges, () => this.spills, {
      isOpen: () => this.phase === 'open' || this.phase === 'closing',
      warehouse: () => this.state.warehouse.length,
      take: (n) => {
        const items = this.state.warehouse.splice(0, n);
        this.refresh();
        return items;
      },
      autoRestock: () => this.autoRestock,
      wantFill: () => this.wantFill,
      nearbyCustomer: (pos, r) => this.manager.all.find((c) => c.state !== 'leaving' && c.pos.distanceTo(pos) < r) ?? null,
      assistDone: (c, who) => {
        this.stats.assists++;
        this.manager.helped(c, true, 0.18 + (0.3 * who.stat(3)) / 100);
      },
      prizeRetrieved: (m, c, prize) => this.prizeRetrieved(m, c, prize),
      onRestock: () => {
        this.stats.restocks++;
        this.refresh();
      },
      onRefill: () => {
        this.stats.refills++;
      },
      onRepair: () => {
        this.stats.repairs++;
      },
      onMop: () => {
        this.stats.mops++;
      },
      onClean: () => {
        this.stats.cleans++;
      },
      onFixEx: () => {},
      log: (t, k) => this.log(t, k),
    });
    this.staff.restore(this.state.staff);
    this.staff.setShift(0, this.state.shiftSize[0], true, this.state.day);
    this.boss = new BossNpc(d.scene);
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.3), toneMapped: false, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.renderOrder = 3;
    this.selRing.visible = false;
    d.scene.add(this.selRing);
    d.hud.onSelectStaff = (i) => this.selectStaff(i);

    for (const m of this.machines) {
      m.events = {
        onGrab: () => {
          this.manager.noteGrab(m);
          if (this.manual === m) this.manualGrab = true;
        },
        onSlip: () => {
          this.manager.noteSlip(m);
          if (this.manual === m) {
            d.hud.say('啊!掉了…', 1400);
            d.sfx.fail();
          }
        },
        onWin: (p, stuck) => this.handleWin(m, p, stuck),
        onEnd: () => this.manager.roundEnded(m),
        onManualEnd: () => this.onManualEnd(m),
        onState: (s) => this.onClawState(m, s),
      };
    }

    this.applyMods();
    this.select(0);
    this.syncUi();
    this.log('店裡開始準備今天的營業', 'system');
    this.pendingSlot = 'morning';
  }

  // ---------- 小工具 ----------
  get totalStock() {
    return this.machines.reduce((s, m) => s + m.stock, 0);
  }
  get sel() {
    return this.machines[this.selected];
  }
  get manualMachine() {
    return this.manual;
  }
  get shiftName() {
    return SHIFT_NAMES[this.shift];
  }

  private clockString() {
    const frac = Math.min(1, this.dayTime / OPEN_SECONDS);
    const mins = Math.floor(OPEN_HOUR * 60 + HOURS * 60 * frac);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  log(text: string, kind: FeedKind) {
    this.feed.push({ time: this.phase === 'prep' || this.phase === 'report' ? '--:--' : this.clockString(), text, kind });
    if (this.feed.length > 80) this.feed.shift();
    this.feedVersion++;
  }
  /** 同一類事件在 gap 遊戲秒內只記一筆,避免洗版 */
  private logGated(key: string, gap: number, text: string, kind: FeedKind) {
    const last = this.logGate.get(key) ?? -1e9;
    if (this.simTime - last < gap) return;
    this.logGate.set(key, this.simTime);
    this.log(text, kind);
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
      shift: this.state.shiftSize,
      locked: this.phase !== 'prep',
    });
    hud.renderShop(
      {
        cash: this.state.cash,
        machine: this.totalStock,
        capacity: CAPACITY * this.machines.length,
        warehouse: this.state.warehouse.length,
        canShelve: this.state.warehouse.length > 0,
        auto: this.autoRestock,
      },
      (p) => this.buyPack(p),
    );
    store.setShelfStock(this.state.warehouse.length);
  }

  private syncUi() {
    this.d.hud.setPhase(this.phase);
    this.d.hud.setSpeed(this.state.speed);
    this.refresh();
    this.clockUi();
  }

  private clockUi() {
    const frac = Math.min(1, this.dayTime / OPEN_SECONDS);
    let label = `第 ${this.state.day} 天 · ${this.shiftName}`;
    if (this.phase === 'prep') label = this.manual?.claw?.playing ? `第 ${this.state.day} 天 · 試玩 ${Math.ceil(this.manual.claw.timeLeft)}s` : `第 ${this.state.day} 天 · 準備中`;
    else if (this.phase === 'closing') label = `第 ${this.state.day} 天 · 打烊`;
    this.d.hud.setClock(label, this.clockString(), frac);
  }

  save() {
    this.state.staff = this.staff.snapshot();
    saveGame(this.state, this.machines.map((m) => m.snapshotItems));
  }

  // ---------- 玩家操作 ----------
  select(i: number) {
    this.selected = THREE.MathUtils.clamp(i, 0, this.machines.length - 1);
    const m = this.machines[this.selected];
    this.d.gfx.setFocus(m.x, m.z);
    this.d.hud.setSelected(this.selected, this.machines.length);
    this.d.lite.setSelected(this.selected);
    this.manageDetail(true);
  }
  setPrice(v: number) {
    this.state.price = v;
    this.refresh();
    this.save();
  }
  setStrength(v: number) {
    this.state.strength = v;
    this.applyMods();
    this.refresh();
    this.save();
  }
  setShiftSize(shift: 0 | 1, n: number) {
    if (this.phase !== 'prep') return;
    this.state.shiftSize[shift] = n;
    if (shift === 0) this.staff.setShift(0, n, true, this.state.day);
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
    if (m.mode !== 'full' && m.canSwap) {
      m.promote();
      this.d.lite.hide(m.index, true);
    }
    if (m.mode !== 'full' || m.claw!.state !== 'idle' || m.blocked || m.line.length) {
      hud.say(`${m.name}現在不能試玩`, 1400);
      return;
    }
    this.manual = m;
    m.manual = true;
    this.manualWon = 0;
    this.manualGrab = false;
    m.claw!.strength = this.state.strength;
    m.claw!.begin();
    hud.showControls(true);
    hud.say(`試玩 ${m.name}:移動爪子,對準後按「放爪」`, 2200);
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
    this.log(`📦 進貨 ${p.name}(${money(p.price)})`, 'system');
    this.refresh();
    this.save();
  }

  /** 請店員優先把倉庫的貨補進各機台 */
  shelve() {
    if (!this.state.warehouse.length) return;
    this.wantFill = true;
    this.d.hud.say('已請店員補貨', 1400);
    this.log('📋 老闆要求補貨,店員會依序處理', 'system');
  }

  openShop() {
    const { hud } = this.d;
    if (this.phase !== 'prep' || this.manual || this.storyOpen) return;
    if (this.totalStock < 100) {
      hud.say('機台裡的娃娃太少,先到 🛒 進貨並請店員補貨', 2600);
      return;
    }
    this.phase = 'open';
    this.dayTime = 0;
    this.stats = newStats();
    this.middayDone = false;
    this.eveningDone = false;
    this.shift = 0;
    this.staff.setShift(0, this.state.shiftSize[0], true, this.state.day);
    for (const m of this.machines) {
      m.plays = 0;
      m.wins = 0;
    }
    hud.showControls(false);
    hud.openShop(false);
    hud.say('開始營業!', 1800);
    this.log(`🔔 開店營業(${this.shiftName} ${this.state.shiftSize[0]} 人)`, 'system');
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
    const wages = (this.state.shiftSize[0] + this.state.shiftSize[1]) * WAGE_SHIFT;
    const extraRent = this.state.mods.reduce((s, m) => s + (m.rent ?? 0), 0);
    const fixed = RENT + extraRent + wages;
    const r = settle(this.stats, fixed);
    this.state.cash -= fixed;
    this.state.last = { revenue: this.stats.revenue, profit: r.profit, faults: this.stats.faults };
    this.state.rep = Math.max(0.5, Math.min(5, this.state.rep + r.repDelta));
    this.state.totalProfit += r.profit;
    const s = this.stats;
    const stars = Math.round(this.state.rep);
    const best = [...this.machines].sort((a, b) => b.plays - a.plays)[0];
    const idle = this.machines.filter((m) => m.plays === 0).length;
    const rows: [string, string, 'pos' | 'neg' | ''][] = [
      ['來店顧客', `${s.customers} 人`, ''],
      ['遊玩次數', `${s.plays} 次(平均每台 ${(s.plays / this.machines.length).toFixed(1)} 次)`, ''],
      ['送出獎品', `${s.wins} 隻(稀有 ${s.rareWins})· 成功率 ${Math.round(r.winRate * 100)}%`, ''],
      ['最熱門機台', `${best.name}(${best.plays} 次)· 沒人玩的有 ${idle} 台`, ''],
      ['營收', money(s.revenue), 'pos'],
      ['獎品成本', money(-s.cogs), 'neg'],
      ['房租與水電', money(-(RENT + extraRent)), 'neg'],
      [`店員薪資(${this.state.shiftSize[0]}+${this.state.shiftSize[1]} 人次)`, money(-wages), 'neg'],
      ['員工工作', `補貨 ${s.restocks} · 維修 ${s.repairs} · 協助 ${s.assists} · 取獎品 ${s.retrievals} · 拖地 ${s.mops} · 清潔 ${s.cleans} · 補零錢 ${s.refills}`, ''],
      ['意外事件', `機台故障 ${s.faults} · 獎品卡洞 ${s.stuck} · 打翻飲料 ${s.spills}(滑倒 ${s.slips})· 兌幣機卡鈔 ${s.jams}`, s.slips ? 'neg' : ''],
      ['顧客滿意度', `${r.avgSat >= 0 ? '+' : ''}${Math.round(r.avgSat * 100)}`, r.avgSat >= 0 ? 'pos' : 'neg'],
      ['聲望變化', `${r.repDelta >= 0 ? '+' : ''}${r.repDelta.toFixed(2)}(現在 ${this.state.rep.toFixed(1)})`, r.repDelta >= 0 ? 'pos' : 'neg'],
      ['今日店況效應', this.state.mods.length ? this.state.mods.map((m) => m.label).join('、') : '無', ''],
      ['今日進貨支出', money(-s.purchases), ''],
      ['目前現金', money(this.state.cash), this.state.cash >= 0 ? '' : 'neg'],
    ];
    let tip = '';
    if (s.noStock > 5) tip = `有 ${s.noStock} 位客人因為缺貨離開。倉庫的貨要夠,營業前記得進貨。`;
    else if (s.slips > 1) tip = `有 ${s.slips} 位客人滑倒。地上的水漬要盡快清掉,人手不夠時可以把班表調成 4 人。`;
    else if (s.faults > 3 && s.repairs < s.faults) tip = '機台壞得比修得快,營運受影響。考慮增加店員人數。';
    else if (s.angry > 15 && r.winRate < 0.18) tip = '成功率偏低,不少客人生氣離開。可以調高爪力,或降低售價。';
    else if (r.profit < 0 && r.winRate > 0.35) tip = '成功率很高但虧本。可以調低爪力,或提高售價。';
    else if (r.profit < 0) tip = `今天虧損。固定支出每天 ${money(fixed)},客人不夠多或售價太低都會吃掉利潤。`;
    else tip = '營運穩定。可以試著微調售價與爪力,或比較 3 人與 4 人班表的成本與服務品質。';
    hud.showReport({ day: this.state.day, stars: '★'.repeat(stars) + '☆'.repeat(5 - stars), rows, total: [money(r.profit), r.profit >= 0 ? 'pos' : 'neg'], tip }, () => this.nextDay());
    this.d.sfx.win(r.profit > 0);
    this.log(`📊 第 ${this.state.day} 天結算:淨利 ${money(r.profit)}`, 'system');
    this.refresh();
    this.save();
  }

  private nextDay() {
    this.state.day++;
    this.state.mods = this.state.mods.map((m) => ({ ...m, days: m.days - 1 })).filter((m) => m.days > 0);
    this.applyMods();
    this.middayDone = false;
    this.eveningDone = false;
    this.pendingSlot = 'morning';
    this.phase = 'prep';
    this.dayTime = 0;
    this.shift = 0;
    this.staff.setShift(0, this.state.shiftSize[0], false, this.state.day);
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
  private spawnSpill(c: Customer) {
    const sp = new Spill(c.pos, this.d.scene);
    this.spills.push(sp);
    this.stats.spills++;
    c.say('哎呀!打翻飲料了😱', 3);
    c.mood -= 0.05;
    this.log(`💦 ${c.label}在走道打翻了飲料`, 'alert');
  }

  private machineFault(m: Machine) {
    m.breakDown();
    this.manager.evacuate(m);
    this.stats.faults++;
    this.log(`🔧 ${m.name}故障停機`, 'alert');
  }

  private prizeRetrieved(m: Machine, c: Customer | undefined, prize: Prize | null) {
    if (!prize) return;
    this.stats.retrievals++;
    if (c && c.state !== 'leaving' && c.machine === m && this.phase !== 'prep') {
      this.stats.wins++;
      m.wins++;
      if (prize.rarity !== 'common') this.stats.rareWins++;
      this.stats.cogs += prize.cost;
      this.manager.prizeDelivered(m, c, prize);
    } else {
      // 客人已離開:獎品回到倉庫
      this.state.warehouse.push({ typeId: prize.type.id, rarity: prize.rarity });
      this.refresh();
    }
  }

  private onClawState(m: Machine, s: string) {
    const { sfx, hud } = this.d;
    const audible = m === this.sel;
    if (audible && s === 'descend') sfx.drop();
    if (audible && s === 'close') sfx.clack();
    if (this.manual === m) {
      if (s === 'lift') hud.say(this.manualGrab ? '夾到了!' : '什麼都沒夾到…', 1300);
      if (s === 'descend') this.manualGrab = false;
    }
  }

  private onManualEnd(m: Machine) {
    if (this.manual !== m) return;
    this.manual = null;
    m.manual = false;
    this.d.hud.showControls(false);
    if (this.manualWon === 0) this.d.hud.say('再試一次?', 1400);
  }

  private onLeave(c: Customer, sat: number, reason: LeaveReason) {
    // 沒用完的代幣退還給客人
    if (c.coins > 0) {
      const back = c.coins * this.state.price;
      this.state.cash -= back;
      this.stats.revenue -= back;
      this.stats.coinsSold -= c.coins;
      c.coins = 0;
    }
    if (reason !== 'closed') {
      this.stats.satSum += sat;
      this.stats.satCount++;
    }
    if (reason === 'nostock') {
      this.stats.noStock++;
      this.logGated('nostock', 6, `${c.label}因為沒有可玩的機台空手離開`, 'alert');
    } else if (reason === 'angry') {
      this.stats.angry++;
      this.logGated('angry', 6, `😤 ${c.label}覺得太難,生氣離開`, 'alert');
    } else if (reason === 'impatient') {
      this.stats.angry++;
    }
  }

  private handleWin(m: Machine, p: Prize, stuck: boolean) {
    const r = RARITY[p.rarity];
    if (stuck) {
      this.stats.stuck++;
      this.manager.noteWin(m, p, true);
      this.log(`🧸 ${m.name}的獎品卡在洞口了`, 'alert');
      return;
    }
    if (m === this.sel && m.mode === 'full') this.d.sfx.win(p.rarity !== 'common');
    if (m.mode === 'full') this.d.onWinFx(m, p);
    if (this.manual === m || this.phase === 'prep') {
      this.manualWon++;
      this.state.warehouse.push({ typeId: p.type.id, rarity: p.rarity });
      this.d.hud.say(`🎉 試玩獲得 ${p.type.name}(${r.label}),已放回倉庫`, 2400);
      this.refresh();
      return;
    }
    this.stats.wins++;
    m.wins++;
    if (p.rarity !== 'common') {
      this.stats.rareWins++;
      const who = m.line[0] ? KINDS[m.line[0].kind].label : '客人';
      this.log(`🧸 ${who}在${m.name}夾到 ${p.type.name}(${r.label})`, 'win');
    }
    this.stats.cogs += p.cost;
    this.manager.noteWin(m, p, false);
  }

  // ---------- 細節層切換 ----------
  /** 近看的機台跑真實物理,其他機台用機率模型。每次最多切換一台以免卡頓。 */
  private manageDetail(force = false) {
    // 只有近看選取的機台、試玩中的機台,或視角拉近時附近的機台才需要完整物理
    const want = new Set<number>();
    if (this.d.gfx.currentPreset === 'front' || this.manual) want.add(this.selected);
    for (const i of this.d.gfx.nearbyMachineIndices(this.machines, 3)) want.add(i);
    if (this.manual) want.add(this.manual.index);
    let swapped = 0;
    for (const m of this.machines) {
      if (swapped >= (force ? 2 : 1)) break;
      if (want.has(m.index) && m.mode === 'lite') {
        if (m.canSwap) {
          m.promote();
          this.d.lite.hide(m.index, true);
          swapped++;
        } else m.pendingSwap = true;
      } else if (!want.has(m.index) && m.pendingSwap) m.pendingSwap = false;
      else if (!want.has(m.index) && m.mode === 'full' && m.canSwap) {
        m.demote();
        this.d.lite.hide(m.index, false);
        this.d.lite.setPile(m.index, m.stock, m.items);
        this.lastStock[m.index] = m.stock;
        swapped++;
      }
    }
  }

  // ---------- 主迴圈 ----------
  private step() {
    for (const m of this.machines) {
      if (m.mode === 'lite' && !m.roundActive && !m.stuck && !m.fault && m.line.length === 0 && !m.service) continue;
      const skill = m.line[0]?.cfg.skill ?? 0.5;
      m.step(DT, m.manual ? this.d.input.move : ZERO, skill);
    }
    this.simTime += DT;
    if (this.phase === 'open') {
      this.dayTime += DT;
      if (this.dayTime >= OPEN_SECONDS) this.closeShop();
      else if (!this.middayDone && this.dayTime >= OPEN_SECONDS * 0.33) {
        this.middayDone = true;
        if (Math.random() < 0.75) this.pendingSlot = 'midday';
      } else if (!this.eveningDone && this.dayTime >= OPEN_SECONDS * 0.72) {
        this.eveningDone = true;
        if (Math.random() < 0.5) this.pendingSlot = 'evening';
      }
      if (this.dayTime < OPEN_SECONDS && this.shift === 0 && this.dayTime >= OPEN_SECONDS / 2) {
        this.shift = 1;
        this.staff.setShift(1, this.state.shiftSize[1], false, this.state.day);
        this.log(`🔄 換班:${this.shiftName} ${this.state.shiftSize[1]} 人`, 'staff');
      }
    }
    this.manager.update(DT, this.state.rep);
    this.staff.update(DT);
    this.boss.update(DT, this.phase === 'open' || this.phase === 'closing');
    this.events.update(DT);
    for (const m of this.machines) m.dirt = Math.min(1, m.dirt + (this.phase === 'open' ? 0.00001 : 0.000002));
    for (let i = this.spills.length - 1; i >= 0; i--) {
      const sp = this.spills[i];
      sp.age += DT;
      if (sp.cleaned) {
        // 清乾淨後稍等一下再移除水漬與告示牌
        sp.goneT += DT;
        if (sp.goneT > 1.2) {
          sp.dispose();
          this.spills.splice(i, 1);
        }
      }
    }
    if (this.phase === 'closing' && this.manager.isEmpty && this.machines.every((m) => !m.roundActive && !m.service)) this.finishDay();
  }

  /** 每個畫面幀呼叫;dt 為真實秒數 */
  frame(dt: number) {
    const speed = this.storyOpen ? 0 : this.phase === 'open' || this.phase === 'closing' ? this.state.speed : 1;
    this.acc += dt * speed;
    let n = 0;
    const t0 = performance.now();
    while (this.acc >= DT && n < 16) {
      this.step();
      this.acc -= DT;
      n++;
      if (performance.now() - t0 > 14) break;
    }
    if (this.acc > 0.5) this.acc = 0;

    if (this.pendingSlot && !this.storyOpen && this.d.hud.el.report.hidden && this.d.hud.el.shop.hidden) {
      const slot = this.pendingSlot;
      this.pendingSlot = null;
      this.startStory(slot);
    }
    for (const m of this.machines) m.frameSync(this.simTime);
    this.detailT -= dt;
    if (this.detailT <= 0) {
      this.detailT = 0.4;
      this.manageDetail();
    }
    this.updateLite();
    this.updateLod();

    this.clockUi();
    this.d.hud.setQueue(this.manager.all.length);
    this.d.hud.showControls(this.manual !== null && this.manual.claw?.state === 'play');
    this.d.hud.tick(dt);
    this.updateBubbles();
    this.d.hud.renderOps(dt, () => this.opsSnapshot(), this.feedVersion, this.selected);
    this.d.hud.renderMarkers(this.markers(), this.d.gfx.camera, (mk: Marker) => (mk.machine !== undefined ? this.focusMachine(mk.machine) : this.d.gfx.flyTo(mk.x, mk.z)));
    if (this.wantFill && !this.state.warehouse.length) this.wantFill = false;
    // 拉近時顯示機台編號
    const near = this.d.gfx.currentPreset === 'god' && this.d.gfx.godDistance < 18;
    this.updateProfile(dt);
    this.d.hud.renderLabels(
      near ? this.machines.map((m) => ({ i: m.index, x: m.x, y: 2.4, z: m.z + 0.2, selected: m.index === this.selected })) : [],
      this.d.gfx.camera,
    );
  }

  // ---------- 日常營運劇情 ----------
  private ctx(): Ctx {
    return {
      rep: this.state.rep,
      dirt: this.machines.reduce((s, m) => s + m.dirt, 0) / this.machines.length,
      faults: this.machines.filter((m) => m.fault).length,
      cash: this.state.cash,
      day: this.state.day,
      crew: this.staff.onDuty.length || this.state.shiftSize[0],
    };
  }

  /** 店況加成:客流、事件機率、爪力、客人心情 */
  private applyMods() {
    const mods = this.state.mods;
    const prod = (k: 'arrival' | 'spill' | 'fault' | 'jam') => mods.reduce((p, m) => p * (m[k] ?? 1), 1);
    this.manager.arrivalMul = prod('arrival');
    this.events.mul.spill = prod('spill');
    this.events.mul.fault = prod('fault');
    this.events.mul.jam = prod('jam');
    const s = THREE.MathUtils.clamp(this.state.strength + mods.reduce((a, m) => a + (m.strength ?? 0), 0), 0.15, 0.95);
    for (const m of this.machines) {
      m.strength = s;
      if (m.claw) m.claw.strength = s;
    }
  }

  private charOf(id: string): Character {
    if (id === 'boss') return BOSS;
    return STAFF_DEFS.find((d) => d.id === id) ?? REGULARS.find((r) => r.id === id) ?? BOSS;
  }

  private pickStory(slot: 'morning' | 'midday' | 'evening'): Story | null {
    const st = this.state;
    if (slot === 'morning') {
      if (st.day === 1 && !st.flags.includes('intro-done')) return storyById('intro') ?? null;
      const due = st.chains.findIndex((c) => c.day <= st.day);
      if (due >= 0) {
        const [c] = st.chains.splice(due, 1);
        const s = storyById(c.id);
        if (s) return s;
      }
    }
    const ctx = this.ctx();
    const pool = STORIES.filter((s) => !s.chainOnly && s.slot === slot && (s.when?.(ctx, st.flags) ?? true) && (st.storyDay[s.id] ?? -99) < st.day - 7);
    if (!pool.length) return null;
    const total = pool.reduce((a, s) => a + (s.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const s of pool) {
      r -= s.weight ?? 1;
      if (r <= 0) return s;
    }
    return pool[0];
  }

  private startStory(slot: 'morning' | 'midday' | 'evening') {
    const story = this.pickStory(slot);
    if (!story) return;
    this.storyOpen = true;
    this.d.sfx.click();
    this.d.hud.showStory(
      { icon: story.icon, tag: story.tag, title: story.title, paragraphs: story.body, cast: story.cast.map((id) => this.charOf(id)), choices: story.choices.map((c) => ({ label: c.label, hint: c.hint })) },
      (i) => this.chooseStory(story, i),
    );
  }

  private chooseStory(story: Story, i: number) {
    const choice = story.choices[i];
    const ctx = this.ctx();
    let branch: Branch = choice.branches[choice.branches.length - 1];
    for (const b of choice.branches) {
      const p = typeof b.p === 'function' ? b.p(ctx) : b.p;
      if (Math.random() < p) {
        branch = b;
        break;
      }
    }
    const chips: { text: string; kind: 'good' | 'bad' | '' }[] = [];
    this.applyEffects(branch.effects, chips);
    if (story.id === 'intro') this.state.flags.push('intro-done');
    this.state.storyDay[story.id] = this.state.day;
    this.state.storyLog.push({ day: this.state.day, id: story.id, title: story.title, icon: story.icon, choice: choice.label, outcome: branch.outcome });
    if (this.state.storyLog.length > 60) this.state.storyLog.shift();
    this.log(`${story.icon} 「${story.title}」→ ${choice.label}`, 'system');
    this.d.hud.showOutcome(branch.outcome, chips, () => {
      this.storyOpen = false;
      this.refresh();
      this.save();
    });
  }

  private describeMod(m: ModSpec) {
    const pct = (v: number) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
    const parts: string[] = [];
    if (m.arrival) parts.push(`客流 ${pct(m.arrival)}`);
    if (m.spill) parts.push(`水漬 ${pct(m.spill)}`);
    if (m.fault) parts.push(`故障 ${pct(m.fault)}`);
    if (m.jam) parts.push(`卡鈔 ${pct(m.jam)}`);
    if (m.strength) parts.push(`爪力 ${m.strength > 0 ? '+' : ''}${Math.round(m.strength * 100)}%`);
    if (m.mood) parts.push(`客人心情 ${m.mood > 0 ? '+' : ''}${Math.round(m.mood * 100)}%`);
    if (m.rent) parts.push(`租金 +NT$${m.rent}/天`);
    return `${m.label}:${parts.join('、')}(${m.days} 天)`;
  }

  private applyEffects(effs: Eff[], chips: { text: string; kind: 'good' | 'bad' | '' }[]) {
    const st = this.state;
    const nameOf = (who: string) => (who === 'all' ? '全員' : (this.staff.staff.find((s) => s.ch.id === who)?.name ?? who));
    for (const e of effs) {
      if ('cash' in e) {
        st.cash += e.cash;
        chips.push({ text: `現金 ${e.cash >= 0 ? '+' : '-'}NT$ ${Math.abs(e.cash).toLocaleString('en-US')}`, kind: e.cash >= 0 ? 'good' : 'bad' });
      } else if ('rep' in e) {
        st.rep = THREE.MathUtils.clamp(st.rep + e.rep, 0.5, 5);
        chips.push({ text: `聲望 ${e.rep >= 0 ? '+' : ''}${e.rep.toFixed(2)}`, kind: e.rep >= 0 ? 'good' : 'bad' });
      } else if ('mod' in e) {
        st.mods.push({ ...e.mod, id: `${e.mod.label}-${st.day}` });
        const good = (e.mod.arrival ?? 1) >= 1 && (e.mod.spill ?? 1) <= 1 && (e.mod.fault ?? 1) <= 1 && (e.mod.jam ?? 1) <= 1 && (e.mod.rent ?? 0) <= 0;
        chips.push({ text: this.describeMod(e.mod), kind: good ? 'good' : 'bad' });
        this.applyMods();
      } else if ('flag' in e) {
        if (!st.flags.includes(e.flag)) st.flags.push(e.flag);
      } else if ('morale' in e) {
        const list = e.morale.who === 'all' ? this.staff.staff : this.staff.staff.filter((s) => s.ch.id === e.morale.who);
        for (const s of list) s.morale = THREE.MathUtils.clamp(s.morale + e.morale.delta, 0.05, 1);
        chips.push({ text: `${nameOf(e.morale.who)}士氣 ${e.morale.delta >= 0 ? '+' : ''}${Math.round(e.morale.delta * 100)}%`, kind: e.morale.delta >= 0 ? 'good' : 'bad' });
      } else if ('leave' in e) {
        const s = this.staff.staff.find((x) => x.ch.id === e.leave.who);
        if (s) {
          s.leaveUntil = st.day + e.leave.days - 1;
          this.staff.setShift(this.shift, st.shiftSize[this.shift], false, st.day);
        }
        chips.push({ text: `${nameOf(e.leave.who)}請假 ${e.leave.days} 天`, kind: 'bad' });
      } else if ('trait' in e) {
        const s = this.staff.staff.find((x) => x.ch.id === e.trait.who);
        if (s) s.bonus[e.trait.stat] += e.trait.delta;
        chips.push({ text: `${nameOf(e.trait.who)}${STAFF_DEFS[0].statNames[e.trait.stat]} ${e.trait.delta >= 0 ? '+' : ''}${e.trait.delta}`, kind: e.trait.delta >= 0 ? 'good' : 'bad' });
      } else if ('stock' in e) {
        const w = (e.rare ? PACKS[2] : PACKS[1]).weights;
        for (let i = 0; i < e.stock; i++) st.warehouse.push(randomItem(w));
        chips.push({ text: `倉庫 +${e.stock} 隻${e.rare ? '(稀有款為主)' : ''}`, kind: 'good' });
      } else if ('chain' in e) {
        st.chains.push({ id: e.chain.id, day: st.day + e.chain.after });
      }
    }
  }

  openJournal() {
    this.d.hud.showJournal(this.state.storyLog, this.state.mods.map((m) => ({ label: m.label, days: m.days })));
  }

  // ---------- 人物卡 ----------
  /** 螢幕上點到的人(用頭頂位置的螢幕距離判斷,遠景時也點得到) */
  pickPerson(clientX: number, clientY: number): boolean {
    const cam = this.d.gfx.camera;
    const px = this.d.gfx.camera.position;
    const thresh = 26;
    let best: { type: 'staff' | 'customer' | 'boss'; ref: unknown; d: number } | null = null;
    const test = (type: 'staff' | 'customer' | 'boss', ref: unknown, group: THREE.Object3D) => {
      group.getWorldPosition(this.v);
      this.v.y += 0.9;
      if (this.v.distanceTo(px) > 60) return;
      this.v.project(cam);
      if (this.v.z > 1) return;
      const sx = (this.v.x * 0.5 + 0.5) * innerWidth;
      const sy = (-this.v.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < thresh && (!best || d < best.d)) best = { type, ref, d };
    };
    for (const c of this.manager.all) test('customer', c, c.human.group);
    for (const s of this.staff.staff) if (s.active) test('staff', s, s.human.group);
    test('boss', this.boss, this.boss.human.group);
    if (!best) return false;
    const b = best as { type: 'staff' | 'customer' | 'boss'; ref: unknown };
    this.openProfile(b.type, b.ref);
    return true;
  }

  selectStaff(i: number) {
    const s = this.staff.onDuty[i];
    if (s) {
      this.openProfile('staff', s);
      this.d.gfx.flyTo(s.pos.x, s.pos.z, 8);
    }
  }

  openBoss() {
    this.openProfile('boss', this.boss);
  }

  openProfile(type: 'staff' | 'customer' | 'boss', ref: unknown) {
    this.profile = { type, ref };
    this.profileT = 0;
    this.d.gfx.setFollow(null);
    this.d.hud.setFollowing(false);
    this.d.sfx.click();
    this.d.hud.showProfile(this.profileView()!, {
      onClose: () => this.closeProfile(),
      onFollow: () => {
        const g = this.profileGroup();
        if (!g) return;
        const on = !this.d.gfx.isFollowing;
        this.d.gfx.setFollow(on ? g : null);
        this.d.hud.setFollowing(on);
      },
    });
  }

  closeProfile() {
    this.profile = null;
    this.d.gfx.setFollow(null);
    this.d.hud.hideProfile();
    this.selRing.visible = false;
  }

  private profileGroup(): THREE.Object3D | null {
    const p = this.profile;
    if (!p) return null;
    if (p.type === 'customer') return (p.ref as Customer).human.group;
    if (p.type === 'staff') return (p.ref as import('./staff').Staff).human.group;
    return this.boss.human.group;
  }

  /** 老闆的六項能力由實際經營數據算出 */
  bossStats(): number[] {
    const last = this.phase === 'open' || this.phase === 'closing' ? { revenue: this.stats.revenue, faults: this.stats.faults } : this.state.last ?? { revenue: 0, faults: 0 };
    const morale = this.staff.staff.reduce((s, x) => s + x.morale, 0) / this.staff.staff.length;
    const dirt = this.machines.reduce((s, m) => s + m.dirt, 0) / this.machines.length;
    const broken = this.machines.filter((m) => m.fault).length;
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    return [
      clamp((last.revenue / 16000) * 100),
      clamp((this.state.rep / 5) * 100),
      clamp((this.state.cash / 60000) * 100),
      clamp(morale * 100),
      clamp(100 - (broken / this.machines.length) * 400 - dirt * 40 - last.faults * 2),
      clamp(((this.totalStock + this.state.warehouse.length) / (this.machines.length * 22)) * 100),
    ];
  }

  private profileView(): ProfileView | null {
    const p = this.profile;
    if (!p) return null;
    if (p.type === 'customer') {
      const c = p.ref as Customer;
      const state: Record<string, string> = { exchange: '在兌幣機排隊', buying: '正在兌幣', machine: c.machine ? `在${c.machine.name}排隊` : '找機台中', playing: c.machine ? `正在玩${c.machine.name}` : '遊玩中', leaving: '準備離開' };
      const mood = Math.max(0, Math.min(1, (c.mood + 0.45) / 1.45));
      const expr: Expression = c.mood > 0.45 ? 'happy' : c.mood < -0.05 ? 'sad' : 'neutral';
      const lines: [string, string][] = [['剩餘代幣', `${c.coins} 枚`], ['這次夾到', `${c.wins} 隻`]];
      if (c.ch.regular) lines.push(['來店次數', `${this.state.regulars[c.ch.id]?.visits ?? 1} 次`]);
      if (c.needsHelp) lines.push(['需求', c.needsHelp === 'retrieve' ? '等店員取出獎品' : '想請店員協助']);
      return { ch: c.ch, stats: c.ch.stats, expr, roleLabel: c.ch.regular ? '常客' : '顧客', meta: `${c.ch.age} 歲 · ${c.ch.occupation ?? ''}`, status: c.needsHelp ? '正在求助' : (state[c.state] ?? '逛逛'), lines, mood, moodLabel: '心情' };
    }
    if (p.type === 'staff') {
      const s = p.ref as import('./staff').Staff;
      const stats = s.ch.stats.map((v, i) => Math.max(0, Math.min(100, v + s.bonus[i])));
      const expr: Expression = s.morale > 0.8 ? 'happy' : s.morale < 0.4 ? 'sad' : 'neutral';
      return {
        ch: s.ch,
        stats,
        expr,
        roleLabel: s.shift === 0 ? '早班店員' : '晚班店員',
        meta: `${s.ch.age} 歲 · 日薪 NT$${WAGE_SHIFT}/班`,
        status: s.action,
        lines: [['今日完成', `${s.done} 件`], ['班別', s.shift === 0 ? '早班 10:00–16:00' : '晚班 16:00–22:00'], ...(s.leaveUntil >= this.state.day ? ([['狀態', `請假至第 ${s.leaveUntil} 天`]] as [string, string][]) : [])],
        mood: s.morale,
        moodLabel: '士氣',
      };
    }
    const bs = this.bossStats();
    const profit = this.phase === 'open' || this.phase === 'closing' ? this.stats.revenue - this.stats.cogs : this.state.last?.profit ?? 0;
    return {
      ch: this.boss.ch,
      stats: bs,
      expr: this.state.rep >= 3.5 ? 'happy' : this.state.cash < 0 ? 'sad' : 'neutral',
      roleLabel: '老闆',
      meta: `${this.boss.ch.age} 歲 · 創業第 ${this.state.day} 天`,
      status: this.boss.action,
      lines: [['現金', money(this.state.cash)], ['聲望', `${this.state.rep.toFixed(1)} / 5`], [this.phase === 'open' ? '今日毛利' : '昨日淨利', money(profit)], ['累計淨利', money(this.state.totalProfit)]],
    };
  }

  private updateProfile(dt: number) {
    const g = this.profileGroup();
    if (!g || !this.profile) {
      this.selRing.visible = false;
      return;
    }
    // 人離開店裡了就關掉
    if (this.profile.type === 'customer' && (this.profile.ref as Customer).removed) return this.closeProfile();
    if (this.profile.type === 'staff' && !(this.profile.ref as import('./staff').Staff).active) return this.closeProfile();
    this.selRing.visible = true;
    g.getWorldPosition(this.selRing.position);
    this.selRing.position.y = 0.07;
    this.profileT -= dt;
    if (this.profileT <= 0) {
      this.profileT = 0.4;
      const v = this.profileView();
      if (v) this.d.hud.updateProfile(v);
      if (!this.d.gfx.isFollowing) this.d.hud.setFollowing(false);
    }
  }

  focusMachine(i: number) {
    this.select(i);
    this.d.gfx.flyTo(this.machines[i].x, this.machines[i].z + 1.2, 7);
  }

  /** 遠景機台的狀態燈與庫存堆 */
  private updateLite() {
    const t = performance.now() / 1000;
    for (const m of this.machines) {
      if (m.mode === 'full') continue;
      let code = 0;
      let r = 0.35;
      let g = 0.35;
      let b = 0.4;
      if (m.fault) {
        code = 1;
        const on = Math.sin(t * 6 + m.index) > 0;
        [r, g, b] = on ? [3, 0.15, 0.1] : [0.4, 0.05, 0.05];
        code += on ? 10 : 0;
      } else if (m.stuck) [code, r, g, b] = [2, 2.6, 0.2, 2.4];
      else if (m.service) [code, r, g, b] = [3, 2.6, 2, 0.2];
      else if (m.roundActive) [code, r, g, b] = [4, 0.2, 2, 2.6];
      else if (m.stock < 3) [code, r, g, b] = [5, 2.6, 1.1, 0.1];
      else if (m.line.length) [code, r, g, b] = [6, 0.1, 0.8, 1.1];
      if (code !== this.lastLed[m.index]) {
        this.lastLed[m.index] = code;
        this.d.lite.setLed(m.index, r, g, b);
      }
      const s = m.stock;
      if (s !== this.lastStock[m.index]) {
        this.lastStock[m.index] = s;
        this.d.lite.setPile(m.index, s);
      }
    }
  }

  /** 離鏡頭遠的人只畫簡化人形 */
  private updateLod() {
    const cam = this.d.gfx.camera.position;
    const lowDist = this.d.gfx.lodDistance;
    const apply = (h: { setLod(low: boolean): void; group: THREE.Group }) => {
      h.group.getWorldPosition(this.v);
      h.setLod(this.v.distanceTo(cam) > lowDist);
    };
    for (const c of this.manager.all) apply(c.human);
    for (const s of this.staff.staff) if (s.active) apply(s.human);
    apply(this.boss.human);
  }

  private opsSnapshot() {
    const ms = this.machines;
    let running = 0;
    let waiting = 0;
    let fault = 0;
    let empty = 0;
    let stuck = 0;
    let service = 0;
    for (const m of ms) {
      if (m.fault) fault++;
      else if (m.stuck) stuck++;
      else if (m.service || m.blocking) service++;
      else if (m.roundActive) running++;
      else if (m.stock < 3) empty++;
      else if (m.line.length) waiting++;
    }
    const m = this.sel;
    let status = '空閒';
    if (m.fault) status = '故障';
    else if (m.stuck) status = '獎品卡洞';
    else if (m.service) status = SERVICE_LABEL[m.service];
    else if (m.roundActive) status = '遊玩中';
    else if (m.stock < 3) status = '缺貨';
    return {
      summary: { running, waiting, fault, empty, stuck, service, idle: ms.length - running - waiting - fault - empty - stuck - service, customers: this.manager.all.length },
      selected: { name: m.name, status, stock: m.stock, queue: m.line.length, plays: m.plays, wins: m.wins, dirt: m.dirt, detail: m.mode === 'full' ? '近看(真實物理)' : '遠景(機率模型)' },
      problems: this.staff.openReqs.slice(0, 7).map((r) => ({
        text: `${TASK_LABEL[r.kind]} · ${r.machine ? r.machine.name : r.ex ? `兌幣機${r.ex.index + 1}` : '走道'}`,
        who: r.claimed?.name ?? '',
        pri: r.pri,
        machine: r.machine?.index,
      })),
      staff: this.staff.onDuty.map((s) => ({ name: s.name, title: s.ch.title, action: s.action, done: s.done })),
      shift: `${this.shiftName} ${this.staff.onDuty.length} 人`,
      exchanges: this.exchanges.map((e) => ({ name: `兌幣機${e.index + 1}`, state: e.state, coins: Math.floor(e.coins), queue: e.queue.length })),
      warehouse: this.state.warehouse.length,
      mods: this.state.mods.map((m) => ({ label: m.label, days: m.days })),
      feed: this.feed.slice(-10).reverse(),
    };
  }

  private markers(): Marker[] {
    const out: Marker[] = [];
    for (const m of this.machines) {
      let icon = '';
      let urgent = false;
      if (m.fault) [icon, urgent] = ['🔧', true];
      else if (m.stuck) [icon, urgent] = ['🧸', true];
      else if (m.stock < 3) icon = '📦';
      else if (m.line[0]?.needsHelp) [icon, urgent] = ['🙋', true];
      if (icon) out.push({ id: `m${m.index}`, x: m.x, y: 2.55, z: m.z + 0.2, icon, urgent, machine: m.index });
    }
    for (const sp of this.spills) if (!sp.cleaned) out.push({ id: `s${sp.pos.x.toFixed(1)}${sp.pos.z.toFixed(1)}`, x: sp.pos.x, y: 0.5, z: sp.pos.z, icon: '💦', urgent: true });
    for (const e of this.exchanges) {
      if (e.state === 'jam') out.push({ id: `e${e.index}`, x: e.x, y: 2.7, z: e.z, icon: '💴', urgent: true });
      else if (e.state === 'empty' || e.coins <= 70) out.push({ id: `e${e.index}`, x: e.x, y: 2.7, z: e.z, icon: '🪙', urgent: e.state === 'empty' });
    }
    return out;
  }

  private updateBubbles() {
    const { gfx } = this.d;
    const items: { id: number; x: number; y: number; text: string; who: string }[] = [];
    const camPos = gfx.camera.position;
    const push = (id: number, head: THREE.Vector3, text: string, who: string) => {
      // 太遠的泡泡不顯示,避免上帝視角時滿版文字
      if (head.distanceTo(camPos) > gfx.bubbleDistance) return;
      this.v.copy(head).project(gfx.camera);
      if (this.v.z > 1) return;
      items.push({ id, x: (this.v.x * 0.5 + 0.5) * innerWidth, y: (-this.v.y * 0.5 + 0.5) * innerHeight, text, who });
    };
    for (const c of this.manager.all) {
      if (c.bubbleT <= 0 || !c.bubble) continue;
      push(c.human.group.id, c.human.headWorld(this.head), c.bubble, KINDS[c.kind].label);
    }
    for (const s of this.staff.staff) {
      if (!s.active || s.bubbleT <= 0 || !s.bubble) continue;
      push(s.human.group.id, s.human.headWorld(this.head), s.bubble, `店員 ${s.name}`);
    }
    if (this.boss.bubbleT > 0 && this.boss.bubble) push(this.boss.human.group.id, this.boss.human.headWorld(this.head), this.boss.bubble, '老闆');
    this.d.hud.renderBubbles(items);
  }
}

void THEMES;
