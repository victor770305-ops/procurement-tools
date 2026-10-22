import * as THREE from 'three';
import type { Sfx } from './audio';
import type { Cabinet } from './cabinet';
import type { ClawRig, ClawState } from './claw';
import { RARITY } from './config';
import { Customer, CustomerManager, KINDS } from './customers';
import {
  CAPACITY, DayStats, GameState, HOURS, OPEN_HOUR, OPEN_SECONDS, PACKS, Pack, RENT, StockItem,
  clearSave, initialState, loadGame, newStats, rollRarity, saveGame, settle,
} from './economy';
import type { Input } from './input';
import type { Physics, PlushEntity } from './physics';
import { PLUSH_TYPES } from './plush';
import type { Renderer } from './render';
import type { Hud } from './ui';

export type Phase = 'prep' | 'open' | 'closing' | 'report';

export interface Deps {
  gfx: Renderer;
  scene: THREE.Object3D;
  cabinet: Cabinet;
  physics: Physics;
  claw: ClawRig;
  input: Input;
  sfx: Sfx;
  hud: Hud;
  onWinFx: (p: PlushEntity) => void;
}

const DT = 1 / 60;
const randomItem = (w = PACKS[0].weights): StockItem => ({ typeId: PLUSH_TYPES[Math.floor(Math.random() * PLUSH_TYPES.length)].id, rarity: rollRarity(w) });

export class Game {
  state: GameState;
  stats: DayStats = newStats();
  phase: Phase = 'prep';
  dayTime = 0;
  simTime = 0;
  readonly manager: CustomerManager;
  private acc = 0;
  private pendingShelve = false;
  private manualTest = false;
  private manualWon = 0;
  private manualGrab = false;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private hands = { l: new THREE.Vector3(), r: new THREE.Vector3() };
  private v = new THREE.Vector3();

  constructor(private d: Deps) {
    const saved = loadGame();
    this.state = saved?.state ?? initialState();
    d.physics.fillItems(saved?.machine?.length ? saved.machine : Array.from({ length: 22 }, () => randomItem()));
    for (const p of d.physics.plushes) d.cabinet.group.add(p.mesh);
    d.physics.syncMeshes();
    d.claw.strength = this.state.strength;

    this.manager = new CustomerManager(d.scene, d.claw, d.physics, {
      price: () => this.state.price,
      isOpen: () => this.phase === 'open',
      stock: () => this.machineStock,
      pay: (n) => {
        this.state.cash += n;
        this.stats.revenue += n;
        this.d.sfx.coin();
        this.refresh();
      },
      onCustomerEnter: () => {
        this.stats.customers++;
      },
      onFull: () => {
        this.stats.walkouts++;
        this.stats.satSum -= 0.15;
        this.stats.satCount++;
      },
      onPlay: () => {
        this.stats.plays++;
        this.d.cabinet.setDisplay('PLAYS', String(this.stats.plays).padStart(3, '0'));
      },
      onResult: () => this.refresh(),
      onLeave: (c, sat, reason) => this.onLeave(c, sat, reason),
      hands: () => {
        d.cabinet.joystickWorld(this.hands.l);
        d.cabinet.buttonWorld(this.hands.r);
        return this.hands;
      },
    });

    d.claw.events.onGrab = () => {
      this.manager.noteGrab();
      this.manualGrab = true;
    };
    d.claw.events.onSlip = () => {
      if (this.manualTest) {
        d.hud.say('啊!掉了…', 1400);
        d.sfx.fail();
      }
      this.manager.noteSlip();
    };
    d.claw.events.onState = (s: ClawState) => this.onClawState(s);

    this.syncUi();
  }

  get machineStock() {
    return this.d.physics.plushes.filter((p) => !p.won).length;
  }

  // ---------- 狀態同步 ----------
  private refresh() {
    const { hud } = this.d;
    hud.setCash(this.state.cash);
    hud.setRep(this.state.rep);
    hud.setDay(this.state.day);
    hud.updateSettings({
      price: this.state.price,
      strength: this.state.strength,
      machine: this.machineStock,
      warehouse: this.state.warehouse.length,
      custs: this.stats.customers,
      plays: this.stats.plays,
      wins: this.stats.wins,
      revenue: this.stats.revenue,
    });
    this.refreshShop();
  }

  private refreshShop() {
    this.d.hud.renderShop(
      {
        cash: this.state.cash,
        machine: this.machineStock,
        warehouse: this.state.warehouse.length,
        capacity: CAPACITY,
        canShelve: this.state.warehouse.length > 0 && this.machineStock < CAPACITY,
      },
      (p) => this.buyPack(p),
    );
  }

  private syncUi() {
    this.d.hud.setPhase(this.phase);
    this.d.hud.setSpeed(this.state.speed);
    this.d.cabinet.setDisplay('CREDIT', '---');
    this.refresh();
    this.clockUi();
  }

  private clockUi() {
    const frac = Math.min(1, this.dayTime / OPEN_SECONDS);
    const mins = Math.floor(OPEN_HOUR * 60 + HOURS * 60 * frac);
    const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    let label = `第 ${this.state.day} 天`;
    if (this.phase === 'prep') label += this.d.claw.playing ? ` · 試玩 ${Math.ceil(this.d.claw.timeLeft)}s` : ' · 準備中';
    else if (this.phase === 'closing') label += ' · 打烊';
    this.d.hud.setClock(label, clock, frac);
  }

  save() {
    saveGame(this.state, this.d.physics.stockItems());
  }

  // ---------- 玩家操作 ----------
  setPrice(v: number) {
    this.state.price = v;
    this.refresh();
    this.save();
  }
  setStrength(v: number) {
    this.state.strength = v;
    this.d.claw.strength = v;
    this.refresh();
    this.save();
  }
  setSpeed(s: number) {
    this.state.speed = s;
    this.d.hud.setSpeed(s);
  }

  testPlay() {
    const { claw, hud } = this.d;
    if (this.phase !== 'prep' || claw.state !== 'idle') return;
    this.manualTest = true;
    this.manualWon = 0;
    this.manualGrab = false;
    claw.begin();
    hud.showControls(true);
    hud.say('移動爪子,對準娃娃後按「放爪」', 2200);
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
    this.d.hud.say(`已進貨 ${p.count} 隻,記得上架`, 1800);
    this.refresh();
    this.save();
  }

  /** 上架:在爪子閒置時把倉庫的娃娃丟進機台 */
  shelve() {
    if (!this.state.warehouse.length) return;
    this.pendingShelve = true;
    this.d.hud.say('補貨中…', 1200);
  }

  private doShelve() {
    this.pendingShelve = false;
    const n = Math.min(CAPACITY - this.machineStock, this.state.warehouse.length);
    if (n <= 0) return;
    const items = this.state.warehouse.splice(0, n);
    for (const p of this.d.physics.dropIn(items)) this.d.cabinet.group.add(p.mesh);
    this.d.sfx.click();
    this.refresh();
    this.save();
  }

  openShop() {
    const { hud, claw } = this.d;
    if (this.phase !== 'prep' || claw.state !== 'idle') return;
    if (this.machineStock < 3) {
      hud.say('機台裡幾乎沒娃娃了,先到 🛒 進貨並上架', 2600);
      return;
    }
    this.phase = 'open';
    this.dayTime = 0;
    this.stats = newStats();
    this.manualTest = false;
    hud.showControls(false);
    hud.openShop(false);
    this.d.cabinet.setDisplay('PLAYS', '000');
    hud.say('開始營業!', 1800);
    this.syncUi();
  }

  private closeShop() {
    this.phase = 'closing';
    this.manager.closeShop();
    this.d.hud.say('打烊囉,等最後一位客人玩完', 2400);
    this.syncUi();
  }

  private finishDay() {
    const { hud } = this.d;
    this.phase = 'report';
    const r = settle(this.stats);
    this.state.cash -= RENT;
    this.state.rep = Math.max(0.5, Math.min(5, this.state.rep + r.repDelta));
    this.state.totalProfit += r.profit;
    const s = this.stats;
    const money = (n: number) => `${n < 0 ? '-' : ''}NT$ ${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
    const stars = Math.round(this.state.rep);
    const rows: [string, string, 'pos' | 'neg' | ''][] = [
      ['來店顧客', `${s.customers} 人`, ''],
      ['遊玩次數', `${s.plays} 次`, ''],
      ['送出獎品', `${s.wins} 隻(稀有 ${s.rareWins})· 成功率 ${Math.round(r.winRate * 100)}%`, ''],
      ['營收', money(s.revenue), 'pos'],
      ['獎品成本', money(-s.cogs), 'neg'],
      ['房租與水電', money(-RENT), 'neg'],
      ['顧客滿意度', `${r.avgSat >= 0 ? '+' : ''}${Math.round(r.avgSat * 100)}`, r.avgSat >= 0 ? 'pos' : 'neg'],
      ['聲望變化', `${r.repDelta >= 0 ? '+' : ''}${r.repDelta.toFixed(2)}(現在 ${this.state.rep.toFixed(1)})`, r.repDelta >= 0 ? 'pos' : 'neg'],
      ['今日進貨支出', money(-s.purchases), ''],
      ['目前現金', money(this.state.cash), this.state.cash >= 0 ? '' : 'neg'],
    ];
    let tip = '';
    if (s.noStock > 0) tip = `有 ${s.noStock} 位客人因為缺貨離開,營業前記得補滿貨。`;
    else if (s.walkouts + s.angry > 2 && r.winRate < 0.18) tip = '成功率偏低,不少客人生氣離開。可以調高爪力,或降低售價。';
    else if (r.profit < 0 && r.winRate > 0.35) tip = '成功率很高但虧本。可以調低爪力,或提高售價。';
    else if (r.profit < 0) tip = '今天虧損。檢查售價是否太低,或進貨成本太高。';
    else if (s.walkouts > 2) tip = '有客人看到隊伍太長就走了。機台一次只能服務一人,可以考慮提高售價增加單客收益。';
    else tip = '營運穩定。可以試著微調售價與爪力,找到客流與利潤的平衡。';
    hud.showReport({ day: this.state.day, stars: '★'.repeat(stars) + '☆'.repeat(5 - stars), rows, total: [money(r.profit), r.profit >= 0 ? 'pos' : 'neg'], tip }, () => this.nextDay());
    this.d.sfx.win(r.profit > 0);
    this.refresh();
    this.save();
  }

  private nextDay() {
    this.state.day++;
    this.phase = 'prep';
    this.dayTime = 0;
    this.d.cabinet.setDisplay('CREDIT', '---');
    this.d.hud.say(this.state.cash < 0 ? '現金為負,小心周轉' : `第 ${this.state.day} 天,準備開店`, 2200);
    this.syncUi();
    this.save();
  }

  resetAll() {
    clearSave();
    location.reload();
  }

  // ---------- 事件 ----------
  private onClawState(s: ClawState) {
    const { claw, sfx, hud } = this.d;
    if (s === 'descend') sfx.drop();
    if (s === 'close') sfx.clack();
    if (this.manualTest) {
      if (s === 'lift') hud.say(this.manualGrab ? '夾到了!' : '什麼都沒夾到…', 1300);
      if (s === 'descend') this.manualGrab = false;
    }
    if (s === 'idle') {
      if (this.manager.roundActive) this.manager.roundEnded();
      else if (this.manualTest) {
        this.manualTest = false;
        hud.showControls(false);
        if (this.manualWon === 0) hud.say('再試一次?', 1400);
      }
    }
    void claw;
  }

  private onLeave(c: Customer, sat: number, reason: string) {
    if (reason !== 'closed') {
      this.stats.satSum += sat;
      this.stats.satCount++;
    }
    if (reason === 'nostock') this.stats.noStock++;
    if (reason === 'angry' || reason === 'impatient') this.stats.angry++;
  }

  private handleWin(p: PlushEntity) {
    const r = RARITY[p.rarity];
    this.d.sfx.win(p.rarity !== 'common');
    this.d.onWinFx(p);
    if (this.manualTest || this.phase === 'prep') {
      // 試玩得到的娃娃回到倉庫,不算損失
      this.manualWon++;
      this.state.warehouse.push({ typeId: p.type.id, rarity: p.rarity });
      this.d.hud.say(`🎉 試玩獲得 ${p.type.name}(${r.label}),已放回倉庫`, 2400);
      this.d.hud.addPrize(p.type.name, r.label, r.color, '試玩');
    } else {
      this.stats.wins++;
      if (p.rarity !== 'common') this.stats.rareWins++;
      this.stats.cogs += p.cost;
      this.manager.noteWin(p);
      const who = this.manager.current ? KINDS[this.manager.current.kind].label : '';
      this.d.hud.addPrize(p.type.name, r.label, r.color, who);
    }
    this.refresh();
  }

  // ---------- 主迴圈 ----------
  private step() {
    const { claw, physics, input } = this.d;
    const inp = this.manager.roundActive ? this.manager.pilotInput(DT) : input.move;
    claw.update(DT, inp);
    physics.world.step();
    this.simTime += DT;
    if (this.phase === 'open') {
      this.dayTime += DT;
      if (this.dayTime >= OPEN_SECONDS) this.closeShop();
    }
    this.manager.update(DT, this.state.rep);
    if (this.phase === 'closing' && this.manager.isEmpty && claw.state === 'idle') this.finishDay();
  }

  /** 每個畫面幀呼叫;dt 為真實秒數 */
  frame(dt: number) {
    const speed = this.phase === 'open' || this.phase === 'closing' ? this.state.speed : 1;
    this.acc += dt * speed;
    let n = 0;
    while (this.acc >= DT && n < 10) {
      this.step();
      this.acc -= DT;
      n++;
    }
    if (n === 10) this.acc = 0;

    const { physics, claw, cabinet } = this.d;
    physics.syncMeshes();
    cabinet.setClawPos(claw.pos.x, claw.pos.y, claw.pos.z);

    for (const p of physics.detectWins(this.simTime)) this.handleWin(p);
    for (const p of [...physics.plushes]) {
      if (p.won && this.simTime - p.wonAt > 1.2) {
        cabinet.group.remove(p.mesh);
        physics.remove(p);
        this.refresh();
      }
    }
    if (this.pendingShelve && claw.state === 'idle' && !this.manager.roundActive) this.doShelve();

    this.clockUi();
    this.d.hud.setQueue(this.manager.queueLength);
    this.d.hud.showControls(this.manualTest && claw.state === 'play');
    this.d.hud.tick(dt);
    this.updateBubbles();
  }

  private updateBubbles() {
    const { gfx } = this.d;
    const items = [];
    for (const c of this.manager.all) {
      if (c.bubbleT <= 0 || !c.bubble) continue;
      c.human.headWorld(this.v);
      this.v.project(gfx.camera);
      if (this.v.z > 1) continue;
      items.push({
        id: c.human.group.id,
        x: (this.v.x * 0.5 + 0.5) * innerWidth,
        y: (-this.v.y * 0.5 + 0.5) * innerHeight,
        text: c.bubble,
        who: KINDS[c.kind].label,
      });
    }
    this.d.hud.renderBubbles(items);
  }
}
