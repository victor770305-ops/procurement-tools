import * as THREE from 'three';
import type { Character } from './characters';
import { PACKS, Pack, RETAIL, RUSH_FEE, RetailKind } from './economy';
import { Expression, portrait } from './portrait';
import type { Marker } from './game';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export interface ProfileView {
  ch: Character;
  /** 目前顯示的六項能力(含加成) */
  stats: number[];
  expr: Expression;
  roleLabel: string;
  meta: string;
  status: string;
  lines: [string, string][];
  /** 心情或士氣 0~1 */
  mood?: number;
  moodLabel?: string;
}

export interface StoryView {
  icon: string;
  tag: string;
  title: string;
  paragraphs: string[];
  cast: Character[];
  choices: { label: string; hint: string }[];
}

export type UiPhase = 'prep' | 'open' | 'closing' | 'report';

export interface BubbleItem {
  id: number;
  x: number;
  y: number;
  text: string;
  who: string;
}

export interface ShipRow {
  dir: 'in' | 'out';
  label: string;
  state: string;
  boxes: number;
  left: number;
}

export interface OpsSnapshot {
  summary: { running: number; waiting: number; fault: number; empty: number; stuck: number; service: number; idle: number; customers: number };
  selected: { name: string; status: string; stock: number; queue: number; plays: number; wins: number; dirt: number; detail: string };
  problems: { text: string; who: string; pri: number; machine?: number }[];
  staff: { name: string; title: string; action: string; done: number; fatigue: number; cashier: boolean }[];
  shift: string;
  exchanges: { name: string; state: string; coins: number; queue: number }[];
  warehouse: number;
  ships: ShipRow[];
  facilities: {
    wc: { name: string; dirt: number; busy: number; cap: number }[];
    lounge: { n: number; cap: number };
    counter: { on: boolean; ready: boolean; who: string };
  };
  mods?: { label: string; days: number }[];
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
  onSelectStaff?: (i: number) => void;
  private profKey = '';
  private profHandlers?: { onClose: () => void; onFollow: () => void };

  readonly el = {
    hud: $('hud'),
    msg: $('msg'),
    controls: $('controls'),
    settings: $('settings'),
    ops: $('ops'),
    profile: $('profile'),
    story: $('story'),
    journal: $('journal'),
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
    $('opsMods').innerHTML = (s.mods ?? []).map((x) => `<span>${x.label}(剩 ${x.days} 天)</span>`).join('');
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
    $('opsStaff').innerHTML =
      s.staff
        .map(
          (t, i) =>
            `<div class="srow" data-i="${i}"><span><b>${t.name}</b> · ${t.cashier ? '櫃檯' : t.title}<i class="fat ${t.fatigue > 0.62 ? 'hi' : ''}" title="疲勞"><u style="width:${Math.round(t.fatigue * 100)}%"></u></i></span><span>${t.action}</span></div>`,
        )
        .join('') || '<div class="empty">目前沒有店員在班</div>';
    $('opsStaff').querySelectorAll<HTMLElement>('.srow').forEach((el) => {
      el.onclick = () => this.onSelectStaff?.(Number(el.dataset.i));
    });
    $('opsEx').innerHTML = s.exchanges
      .map((e) => `<div class="srow"><span><b>${e.name}</b> · 排隊 ${e.queue}</span><span class="${e.state !== 'ok' ? 'bad' : ''}">${e.state === 'ok' ? '正常' : e.state === 'jam' ? '卡鈔' : e.state === 'closed' ? '無人值班' : '缺零錢'}${e.coins >= 0 ? ` · 零錢 ${e.coins}` : ''}</span></div>`)
      .join('');
    $('opsShips').innerHTML = s.ships.length
      ? s.ships.map((x) => `<div class="srow"><span>${x.dir === 'in' ? '📥' : '📤'} <b>${x.label}</b></span><span>${x.state}${x.state === '卸貨中' || x.state === '裝車中' ? ` · 剩 ${x.left}/${x.boxes} 箱` : ''}</span></div>`).join('')
      : '<div class="empty">沒有運送中的貨</div>';
    const f = s.facilities;
    $('opsFac').innerHTML =
      f.wc.map((w) => `<div class="srow"><span><b>${w.name}</b> · 使用中 ${w.busy}/${w.cap}</span><span class="${w.dirt >= 0.7 ? 'bad' : ''}">髒污 ${Math.round(w.dirt * 100)}%</span></div>`).join('') +
      `<div class="srow"><span><b>員工休息室</b></span><span>${f.lounge.n} 人休息中</span></div>` +
      `<div class="srow"><span><b>服務櫃檯</b></span><span class="${f.counter.on && !f.counter.ready ? 'bad' : ''}">${!f.counter.on ? '暫停' : f.counter.ready ? `${f.counter.who} 值班中` : '無人值班'}</span></div>`;
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

  renderShop(
    o: { cash: number; machine: number; warehouse: number; capacity: number; canShelve: boolean; auto: boolean; ships: ShipRow[]; returnable: number },
    onBuy: (p: Pack, rush: boolean) => void,
    onReturn: (n: number) => void,
  ) {
    $('shopInfo').textContent = `現金 NT$ ${fmt(o.cash)} · 機台共 ${fmt(o.machine)}/${fmt(o.capacity)} · 倉庫 ${fmt(o.warehouse)}`;
    ($('autoRestock') as HTMLInputElement).checked = o.auto;
    const list = $('packList');
    list.innerHTML = '';
    for (const p of PACKS) {
      const d = document.createElement('div');
      d.className = 'pack';
      d.innerHTML = `<div><b>${p.name}</b><span>${p.desc}</span></div>`;
      const wrap = document.createElement('div');
      wrap.className = 'btns';
      const rush = Math.round(p.price * (1 + RUSH_FEE));
      for (const [label, price, isRush] of [['隔日到貨', p.price, false], ['急件', rush, true]] as const) {
        const b = document.createElement('button');
        b.innerHTML = `${label}<small>NT$ ${fmt(price)}</small>`;
        b.disabled = o.cash < price;
        b.addEventListener('click', () => onBuy(p, isRush));
        wrap.appendChild(b);
      }
      d.appendChild(wrap);
      list.appendChild(d);
    }
    const ret = $('returnList');
    ret.innerHTML = '';
    for (const n of [20, 60]) {
      const b = document.createElement('button');
      b.className = 'retbtn';
      const k = Math.min(n, o.returnable);
      b.textContent = `退回 ${k || n} 隻`;
      b.disabled = o.returnable <= 0;
      b.addEventListener('click', () => onReturn(n));
      ret.appendChild(b);
    }
    $('shipList').innerHTML = o.ships.length
      ? o.ships.map((x) => `<div class="srow"><span>${x.dir === 'in' ? '📥' : '📤'} ${x.label}</span><span>${x.state}${x.state === '卸貨中' || x.state === '裝車中' ? ` · 剩 ${x.left}/${x.boxes} 箱` : ''}</span></div>`).join('')
      : '<div class="empty">目前沒有運送中的貨</div>';
    ($('btnShelve') as HTMLButtonElement).disabled = !o.canShelve;
  }

  renderRetail(shown: Record<RetailKind, number>, back: Record<RetailKind, number>, cash: number, onBuy: (k: RetailKind) => void) {
    const el = $('retailList');
    el.innerHTML = '';
    for (const k of ['drink', 'snack'] as RetailKind[]) {
      const r = RETAIL[k];
      const d = document.createElement('div');
      d.className = 'pack';
      d.innerHTML = `<div><b>${r.icon} ${r.name}補給箱 ${r.box} 件</b><span>展示 ${shown[k]}/${r.cap} · 備貨 ${back[k]} · 售價 NT$ ${r.price}、成本 ${r.cost}</span></div>`;
      const b = document.createElement('button');
      b.textContent = `NT$ ${fmt(r.boxPrice)}`;
      b.disabled = cash < r.boxPrice;
      b.addEventListener('click', () => onBuy(k));
      d.appendChild(b);
      el.appendChild(d);
    }
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

  // ---------- 人物卡 ----------
  private radar(labels: string[], values: number[], color: string) {
    const cx = 135;
    const cy = 112;
    const R = 78;
    const pt = (i: number, r: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const ring = (f: number) => labels.map((_, i) => pt(i, R * f).join(',')).join(' ');
    const poly = values.map((v, i) => pt(i, (R * Math.max(4, Math.min(100, v))) / 100).join(',')).join(' ');
    const axes = labels.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="rgba(255,255,255,0.18)"/>`).join('');
    const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}" fill="none" stroke="rgba(255,255,255,${f === 1 ? 0.35 : 0.14})"/>`).join('');
    const dots = values.map((v, i) => `<circle cx="${pt(i, (R * Math.max(4, Math.min(100, v))) / 100)[0]}" cy="${pt(i, (R * Math.max(4, Math.min(100, v))) / 100)[1]}" r="3.5" fill="${color}"/>`).join('');
    const text = labels
      .map((l, i) => {
        const [x, y] = pt(i, R + 20);
        return `<text x="${x}" y="${y - 2}" text-anchor="middle" font-size="12" font-weight="700" fill="#f4f1ff">${l}</text><text x="${x}" y="${y + 12}" text-anchor="middle" font-size="12" fill="${color}" font-weight="800">${Math.round(values[i])}</text>`;
      })
      .join('');
    return `<svg viewBox="0 0 270 230">${rings}${axes}<polygon points="${poly}" fill="${color}" fill-opacity="0.32" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}${text}</svg>`;
  }

  showProfile(v: ProfileView, handlers: { onClose: () => void; onFollow: () => void }) {
    this.profHandlers = handlers;
    this.profKey = '';
    this.el.profile.hidden = false;
    const color = `#${v.ch.accent.toString(16).padStart(6, '0')}`;
    ($('profImg') as HTMLImageElement).src = portrait(v.ch, v.expr, 192);
    ($('profImg') as HTMLElement).style.borderColor = color;
    $('profName').textContent = v.ch.name;
    const role = $('profRole');
    role.textContent = v.roleLabel;
    role.style.background = color;
    $('profTitle').textContent = v.ch.title;
    $('profMeta').textContent = v.meta;
    $('profBio').textContent = v.ch.bio;
    $('profQuirks').innerHTML = v.ch.quirks.map((q) => `<span>${q}</span>`).join('');
    ($('profClose') as HTMLElement).onclick = () => handlers.onClose();
    ($('profFollow') as HTMLElement).onclick = () => handlers.onFollow();
    this.updateProfile(v);
  }

  updateProfile(v: ProfileView) {
    if (this.el.profile.hidden) return;
    const color = `#${v.ch.accent.toString(16).padStart(6, '0')}`;
    const key = `${v.expr}|${v.stats.join(',')}`;
    if (key !== this.profKey) {
      this.profKey = key;
      ($('profImg') as HTMLImageElement).src = portrait(v.ch, v.expr, 192);
      $('profRadar').innerHTML = this.radar(v.ch.statNames, v.stats, color);
    }
    const mood =
      v.mood === undefined
        ? ''
        : `<div class="row2"><span>${v.moodLabel ?? '心情'}</span><b>${Math.round(v.mood * 100)}%</b></div><div class="moodbar"><i style="width:${Math.round(Math.max(0, Math.min(1, v.mood)) * 100)}%"></i></div>`;
    $('profLive').innerHTML =
      `<div class="row2"><span>目前狀態</span><b>${v.status}</b></div>` + mood + v.lines.map(([k, val]) => `<div class="row2"><span>${k}</span><b>${val}</b></div>`).join('');
  }

  hideProfile() {
    this.el.profile.hidden = true;
  }
  setFollowing(on: boolean) {
    ($('profFollow') as HTMLElement).textContent = on ? '✓ 追蹤中(再按取消)' : '👁 追蹤這個人';
  }

  // ---------- 劇情卡 ----------
  showStory(v: StoryView, onChoose: (i: number) => void) {
    this.el.story.hidden = false;
    $('storyCast').innerHTML = v.cast.map((c) => `<figure><img src="${portrait(c, 'neutral', 148)}" alt=""/>${c.name}</figure>`).join('');
    $('storyTag').textContent = `${v.icon} ${v.tag}`;
    $('storyTitle').textContent = v.title;
    $('storyBody').innerHTML = v.paragraphs.map((p) => `<p class="para">${p}</p>`).join('');
    $('storyEffects').innerHTML = '';
    ($('storyFoot') as HTMLElement).hidden = true;
    const box = $('storyChoices');
    box.innerHTML = '';
    v.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<b>${c.label}</b><span>${c.hint}</span>`;
      b.onclick = () => onChoose(i);
      box.appendChild(b);
    });
  }

  showOutcome(text: string, effects: { text: string; kind: 'good' | 'bad' | '' }[], onDone: () => void) {
    $('storyChoices').innerHTML = '';
    $('storyBody').insertAdjacentHTML('beforeend', `<p class="para" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px">${text}</p>`);
    $('storyEffects').innerHTML = effects.map((e) => `<span class="${e.kind}">${e.text}</span>`).join('');
    ($('storyFoot') as HTMLElement).hidden = false;
    ($('storyDone') as HTMLElement).onclick = () => {
      this.el.story.hidden = true;
      onDone();
    };
  }

  showJournal(entries: { day: number; icon: string; title: string; choice: string; outcome: string }[], mods: { label: string; days: number }[]) {
    this.el.journal.hidden = false;
    $('journalMods').innerHTML = mods.length ? `<div class="modsbar">${mods.map((m) => `<span>${m.label}(剩 ${m.days} 天)</span>`).join('')}</div>` : '';
    $('journalBody').innerHTML = entries.length
      ? [...entries].reverse().map((e) => `<div class="item"><small>第 ${e.day} 天</small><br><b>${e.icon} ${e.title}</b><br>你的決定:${e.choice}<br><small>${e.outcome}</small></div>`).join('')
      : '<div class="empty">還沒有發生過任何事件。營運幾天之後,這裡會記錄你做過的決定。</div>';
    ($('journalClose') as HTMLElement).onclick = () => (this.el.journal.hidden = true);
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
