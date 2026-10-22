import * as THREE from 'three';
import { PACKS, Pack } from './economy';
import type { Marker } from './game';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export type UiPhase = 'prep' | 'open' | 'closing' | 'report';

export interface BubbleItem {
  id: number;
  x: number;
  y: number;
  text: string;
  who: string;
}

export interface OpsSnapshot {
  summary: { running: number; waiting: number; fault: number; empty: number; stuck: number; service: number; idle: number; customers: number };
  selected: { name: string; status: string; stock: number; queue: number; plays: number; wins: number; dirt: number; detail: string };
  problems: { text: string; who: string; pri: number; machine?: number }[];
  staff: { name: string; action: string; done: number }[];
  shift: string;
  exchanges: { name: string; state: string; coins: number; queue: number }[];
  warehouse: number;
  feed: { time: string; text: string; kind: string }[];
}

/** 所有 DOM 操作集中在這裡,遊戲邏輯只呼叫方法 */
export class Hud {
  private msgTimer = 0;
  private bubbles = new Map<number, HTMLElement>();
  private marks = new Map<string, HTMLElement>();
  private resetArmed = 0;
  private opsT = 0;
  private feedSeen = -1;
  onSelectMachine?: (i: number) => void;

  readonly el = {
    hud: $('hud'),
    msg: $('msg'),
    controls: $('controls'),
    settings: $('settings'),
    ops: $('ops'),
    shop: $('shop'),
    report: $('report'),
  };

  setPhase(p: UiPhase) {
    this.el.hud.dataset.phase = p;
  }
  setCash(n: number) {
    $('cash').textContent = (n < 0 ? '-' : '') + 'NT$ ' + fmt(Math.abs(n));
    $('cashChip').classList.toggle('neg', n < 0);
  }
  setRep(r: number) {
    $('rep').textContent = r.toFixed(1);
  }
  setClock(label: string, clock: string, progress: number) {
    $('dayLabel').textContent = label;
    $('clock').textContent = clock;
    ($('dayBar') as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
  }
  setDay(day: number) {
    $('dockDay').textContent = String(day);
  }
  setQueue(n: number) {
    $('queueInfo').textContent = `場內客人 ${n}`;
  }
  setSelected(i: number, total: number) {
    $('machLabel').textContent = `機台 ${i + 1} / ${total}`;
  }
  showControls(show: boolean) {
    this.el.controls.hidden = !show;
  }
  setSpeed(s: number) {
    document.querySelectorAll<HTMLElement>('#speed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.s) === s));
  }

  say(text: string, ms = 1800) {
    this.el.msg.textContent = text;
    this.el.msg.classList.add('show');
    this.msgTimer = ms / 1000;
  }
  tick(dt: number) {
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.el.msg.classList.remove('show');
    }
  }

  // ---------- 對話泡泡 ----------
  renderBubbles(items: BubbleItem[]) {
    const seen = new Set<number>();
    for (const it of items) {
      seen.add(it.id);
      let el = this.bubbles.get(it.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bubble';
        $('bubbles').appendChild(el);
        this.bubbles.set(it.id, el);
      }
      const html = `<span class="who">${it.who}</span>${it.text}`;
      if (el.dataset.h !== html) {
        el.innerHTML = html;
        el.dataset.h = html;
      }
      el.style.left = `${it.x}px`;
      el.style.top = `${it.y}px`;
    }
    for (const [id, el] of this.bubbles) {
      if (!seen.has(id)) {
        el.remove();
        this.bubbles.delete(id);
      }
    }
  }

  // ---------- 異常標記圖示(可點選) ----------
  private v = new THREE.Vector3();
  renderMarkers(items: Marker[], camera: THREE.Camera, onClick: (m: Marker) => void) {
    const seen = new Set<string>();
    for (const it of items) {
      this.v.set(it.x, it.y, it.z).project(camera);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.05 && Math.abs(this.v.y) < 1.05;
      if (!visible) continue;
      seen.add(it.id);
      let el = this.marks.get(it.id);
      if (!el) {
        el = document.createElement('button');
        el.className = 'mk';
        $('markers').appendChild(el);
        this.marks.set(it.id, el);
      }
      if (el.textContent !== it.icon) el.textContent = it.icon;
      el.classList.toggle('urgent', it.urgent);
      el.onclick = () => onClick(it);
      el.style.left = `${(this.v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-this.v.y * 0.5 + 0.5) * innerHeight}px`;
    }
    for (const [id, el] of this.marks) {
      if (!seen.has(id)) {
        el.remove();
        this.marks.delete(id);
      }
    }
  }

  // ---------- 機台編號標籤(拉近時才顯示) ----------
  private labels = new Map<number, HTMLElement>();
  renderLabels(items: { i: number; x: number; y: number; z: number; selected: boolean }[], camera: THREE.Camera) {
    const seen = new Set<number>();
    for (const it of items) {
      this.v.set(it.x, it.y, it.z).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
      seen.add(it.i);
      let el = this.labels.get(it.i);
      if (!el) {
        el = document.createElement('div');
        el.className = 'mlabel';
        el.textContent = `#${it.i + 1}`;
        $('markers').appendChild(el);
        this.labels.set(it.i, el);
      }
      el.classList.toggle('sel', it.selected);
      el.style.left = `${(this.v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-this.v.y * 0.5 + 0.5) * innerHeight}px`;
    }
    for (const [i, el] of this.labels) {
      if (!seen.has(i)) {
        el.remove();
        this.labels.delete(i);
      }
    }
  }

  // ---------- 營運總覽 ----------
  renderOps(dt: number, snap: () => OpsSnapshot, feedVersion: number, selected = 0) {
    if (this.el.ops.hidden) return;
    this.opsT -= dt;
    if (this.opsT > 0 && feedVersion === this.feedSeen) return;
    this.opsT = 0.3;
    const s = snap();
    $('opsShift').textContent = `${s.shift} · 倉庫 ${s.warehouse} 隻`;
    const tiles: [string, number, string][] = [
      ['遊玩中', s.summary.running, 'busy'],
      ['排隊待機', s.summary.waiting, ''],
      ['空閒', s.summary.idle, ''],
      ['維護中', s.summary.service, 'service'],
      ['故障', s.summary.fault, s.summary.fault ? 'warn' : ''],
      ['卡洞', s.summary.stuck, s.summary.stuck ? 'warn' : ''],
      ['缺貨', s.summary.empty, s.summary.empty ? 'warn' : ''],
      ['場內客人', s.summary.customers, ''],
    ];
    $('opsSummary').innerHTML = tiles.map(([k, v, c]) => `<div class="tile ${c}"><b>${v}</b><span>${k}</span></div>`).join('');
    const m = s.selected;
    $('opsSel').innerHTML = `<div class="selrow"><b>${m.name}</b><span class="pill">${m.status}</span></div>
      <div class="meta"><span>庫存 ${m.stock}/24</span><div class="bar2 ${m.stock <= 5 ? 'low' : ''}"><i style="width:${Math.min(100, (m.stock / 24) * 100)}%"></i></div><span>排隊 ${m.queue}</span></div>
      <div class="meta"><span>今日 ${m.plays} 玩 / ${m.wins} 中</span><span>髒污 ${Math.round(m.dirt * 100)}%</span><span>${m.detail}</span></div>`;
    $('opsProblems').innerHTML = s.problems.length
      ? s.problems
          .map((p) => `<div class="prow ${p.pri >= 70 ? 'hot' : ''}" data-m="${p.machine ?? ''}"><span>${p.text}</span><span>${p.who ? '👤 ' + p.who : '待派工'}</span></div>`)
          .join('')
      : '<div class="empty">目前沒有待處理的事</div>';
    $('opsProblems').querySelectorAll<HTMLElement>('.prow').forEach((el) => {
      el.onclick = () => el.dataset.m && this.onSelectMachine?.(Number(el.dataset.m));
    });
    $('opsStaff').innerHTML = s.staff.map((t) => `<div class="srow"><span><b>${t.name}</b></span><span>${t.action}</span></div>`).join('') || '<div class="empty">目前沒有店員在班</div>';
    $('opsEx').innerHTML = s.exchanges
      .map((e) => `<div class="srow"><span><b>${e.name}</b> · 排隊 ${e.queue}</span><span class="${e.state !== 'ok' ? 'bad' : ''}">${e.state === 'ok' ? '正常' : e.state === 'jam' ? '卡鈔' : '缺零錢'} · 零錢 ${e.coins}</span></div>`)
      .join('');
    if (feedVersion !== this.feedSeen) {
      this.feedSeen = feedVersion;
      $('opsFeed').innerHTML = s.feed.map((f) => `<div class="frow ${f.kind}"><time>${f.time}</time><span>${f.text}</span></div>`).join('');
    }
    void selected;
  }

  // ---------- 設定與進貨 ----------
  updateSettings(o: { price: number; strength: number; machine: number; warehouse: number; custs: number; plays: number; wins: number; revenue: number; shift: [number, number]; locked: boolean }) {
    $('priceVal').textContent = `NT$ ${o.price}`;
    const ratio = o.price / 20;
    $('priceHint').textContent = ratio <= 0.75 ? '價格便宜,客人多,但每次賺得少。' : ratio <= 1.25 ? '價格適中。' : ratio <= 2 ? '價格偏高,客人變少,也更在意能不能夾到。' : '價格很高,只有少數客人願意玩。';
    $('strVal').textContent = `${Math.round(o.strength * 100)}%`;
    $('strHint').textContent =
      o.strength >= 0.7 ? '爪力強,客人常夾到,容易虧本但口碑好。' : o.strength >= 0.4 ? '爪力適中。' : '爪力弱,賺得多,但客人容易生氣離開。';
    $('mStock').textContent = `${o.machine} 隻`;
    $('wStock').textContent = `${o.warehouse} 隻`;
    $('sCust').textContent = String(o.custs);
    $('sPlays').textContent = String(o.plays);
    $('sWins').textContent = `${o.wins} / ${o.plays ? Math.round((o.wins / o.plays) * 100) : 0}%`;
    $('sRev').textContent = `NT$ ${fmt(o.revenue)}`;
    document.querySelectorAll<HTMLButtonElement>('#shiftSeg button').forEach((b) => {
      b.classList.toggle('on', o.shift[Number(b.dataset.shift)] === Number(b.dataset.n));
      b.disabled = o.locked;
    });
  }

  renderShop(o: { cash: number; machine: number; warehouse: number; capacity: number; canShelve: boolean; auto: boolean }, onBuy: (p: Pack) => void) {
    $('shopInfo').textContent = `現金 NT$ ${fmt(o.cash)} · 機台共 ${fmt(o.machine)}/${fmt(o.capacity)} · 倉庫 ${fmt(o.warehouse)}`;
    ($('autoRestock') as HTMLInputElement).checked = o.auto;
    const list = $('packList');
    list.innerHTML = '';
    for (const p of PACKS) {
      const d = document.createElement('div');
      d.className = 'pack';
      d.innerHTML = `<div><b>${p.name}</b><span>${p.desc}</span></div>`;
      const b = document.createElement('button');
      b.textContent = `NT$ ${fmt(p.price)}`;
      b.disabled = o.cash < p.price;
      b.addEventListener('click', () => onBuy(p));
      d.appendChild(b);
      list.appendChild(d);
    }
    ($('btnShelve') as HTMLButtonElement).disabled = !o.canShelve;
  }

  openShop(open: boolean) {
    this.el.shop.hidden = !open;
  }

  showReport(o: { day: number; stars: string; rows: [string, string, 'pos' | 'neg' | ''][]; total: [string, 'pos' | 'neg']; tip: string }, onNext: () => void) {
    $('reportTitle').textContent = `第 ${o.day} 天 營業報告`;
    $('reportStars').textContent = o.stars;
    $('reportBody').innerHTML =
      o.rows.map(([k, v, c]) => `<div class="row2"><span>${k}</span><b class="${c}">${v}</b></div>`).join('') +
      `<div class="row2 total"><span>今日淨利</span><b class="${o.total[1]}">${o.total[0]}</b></div>`;
    $('reportTip').textContent = o.tip;
    this.el.report.hidden = false;
    ($('btnNext') as HTMLButtonElement).onclick = () => {
      this.el.report.hidden = true;
      onNext();
    };
  }

  /** 重新開始需點兩次,避免誤觸 */
  armReset(): boolean {
    const b = $('btnReset');
    if (this.resetArmed > 0) {
      this.resetArmed = 0;
      b.textContent = '重新開始';
      return true;
    }
    this.resetArmed = 1;
    b.textContent = '再按一次確認清除存檔';
    setTimeout(() => {
      this.resetArmed = 0;
      b.textContent = '重新開始';
    }, 3000);
    return false;
  }
}
