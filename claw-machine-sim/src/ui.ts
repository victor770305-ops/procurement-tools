import { PACKS, Pack } from './economy';

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

/** 所有 DOM 操作集中在這裡,遊戲邏輯只呼叫方法 */
export class Hud {
  private msgTimer = 0;
  private bubbles = new Map<number, HTMLElement>();
  private resetArmed = 0;

  readonly el = {
    hud: $('hud'),
    msg: $('msg'),
    controls: $('controls'),
    settings: $('settings'),
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
    $('queueInfo').textContent = `排隊 ${n} 人`;
  }
  showControls(show: boolean) {
    this.el.controls.hidden = !show;
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

  addPrize(name: string, label: string, color: string, who: string) {
    const el = document.createElement('div');
    el.className = 'prize panel';
    el.style.borderColor = color;
    el.innerHTML = `<span>🧸</span><span>${name}</span><span style="color:${color};font-size:11px">${label}</span><span style="color:var(--muted);font-size:11px">${who}</span>`;
    const box = $('prizes');
    box.prepend(el);
    while (box.children.length > 4) box.lastElementChild!.remove();
  }

  setSpeed(s: number) {
    document.querySelectorAll<HTMLElement>('#speed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.s) === s));
  }

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

  /** 營運設定面板顯示用 */
  updateSettings(o: { price: number; strength: number; machine: number; warehouse: number; custs: number; plays: number; wins: number; revenue: number }) {
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
  }

  renderShop(o: { cash: number; machine: number; warehouse: number; capacity: number; canShelve: boolean }, onBuy: (p: Pack) => void) {
    $('shopInfo').textContent = `現金 NT$ ${fmt(o.cash)} · 機台 ${o.machine}/${o.capacity} · 倉庫 ${o.warehouse}`;
    const list = $('packList');
    list.innerHTML = '';
    for (const p of PACKS) {
      const d = document.createElement('div');
      d.className = 'pack';
      d.innerHTML = `<div><b>${p.name}</b><span>${p.desc}</span></div>`;
      const b = document.createElement('button');
      b.textContent = `NT$ ${p.price}`;
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
    const btn = $('btnNext') as HTMLButtonElement;
    btn.onclick = () => {
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
