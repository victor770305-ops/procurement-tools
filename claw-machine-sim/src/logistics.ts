import * as THREE from 'three';
import { BOX_SIZE, PLUSH_COST, RETURN_RATE, RUSH_ETA, ShipSave, StockItem } from './economy';
import { Human } from './human';
import { TRUCK_DOCK } from './layout';
import { neonTexture } from './textures';

export type ShipDir = 'in' | 'out';

/** 一張貨運單:進貨(供應商 → 倉庫)或退貨(倉庫 → 供應商),以紙箱為單位由店員搬運 */
export class Shipment {
  /** 進貨:每個紙箱裡的娃娃;退貨:店員從倉庫搬上車時才填入 */
  readonly slices: StockItem[][] = [];
  readonly shipped: StockItem[] = [];
  readonly done = new Set<number>();
  docked = false;

  constructor(
    readonly id: number,
    readonly dir: ShipDir,
    readonly label: string,
    public eta: number,
    readonly boxes: number,
    /** 退貨還要搬出的隻數(僅退貨使用) */
    public want = 0,
  ) {}

  get left() {
    return this.boxes - this.done.size;
  }
  get isDone() {
    return this.done.size >= this.boxes;
  }
  /** 進貨:還沒卸進倉庫的娃娃 */
  get pendingItems() {
    return this.slices.flatMap((s, i) => (this.done.has(i) ? [] : s));
  }
}

export interface LogiHooks {
  /** 時間是否在流動(準備、營業、打烊;結算畫面不算) */
  active(): boolean;
  addWarehouse(items: StockItem[]): void;
  takeWarehouse(n: number): StockItem[];
  warehouseCount(): number;
  refund(amount: number): void;
  log(text: string, kind: 'staff' | 'alert' | 'system'): void;
  onInbound(n: number): void;
  onReturned(n: number): void;
  ding(): void;
}

export interface BoxJob {
  key: string;
  ship: Shipment;
  box: number;
}

const FAR_X = -52;
const MOVE_SEC = 5.5;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** 貨車 + 卸貨區:貨運單排隊進場、倒車停靠、等店員搬完紙箱後離開 */
export class Logistics {
  readonly list: Shipment[] = [];
  readonly truck = new THREE.Group();
  readonly driver: Human;
  private cargo: THREE.Mesh[] = [];
  private cur: Shipment | null = null;
  private phase: 'idle' | 'in' | 'docked' | 'out' = 'idle';
  private t = 0;
  private hold = 0;
  private waveT = 0;
  seq = 1;

  constructor(scene: THREE.Object3D, private hooks: LogiHooks, saved: ShipSave[] = [], seq = 1) {
    this.seq = seq;
    this.buildTruck();
    this.truck.visible = false;
    scene.add(this.truck);
    this.driver = new Human({ skin: 0xe0b090, shirt: 0xe8662b, pants: 0x2b3040, hair: 0x2a211c, scale: 1.0, kid: false, accessory: 'cap', sleeve: 'short', shoes: 0x3a2a20 });
    this.driver.group.visible = false;
    this.driver.group.position.set(TRUCK_DOCK.rearX - 1.0, 0, TRUCK_DOCK.z + 1.95);
    this.driver.group.rotation.y = Math.PI / 2;
    scene.add(this.driver.group);
    for (const s of saved) this.restoreOne(s);
  }

  // ---------- 下單 ----------
  /** 進貨單 */
  orderIn(label: string, items: StockItem[], rush: boolean) {
    const ship = new Shipment(this.seq++, 'in', label, rush ? RUSH_ETA : -1, Math.ceil(items.length / BOX_SIZE));
    for (let i = 0; i < ship.boxes; i++) ship.slices.push(items.slice(i * BOX_SIZE, (i + 1) * BOX_SIZE));
    this.list.push(ship);
    return ship;
  }
  /** 退貨單:要從倉庫搬出 n 隻 */
  orderReturn(n: number) {
    const ship = new Shipment(this.seq++, 'out', `退貨 ${n} 隻`, 30, Math.ceil(n / BOX_SIZE), n);
    this.list.push(ship);
    return ship;
  }
  /** 已經預約要退回的隻數(還在倉庫、尚未搬走) */
  get reservedOut() {
    return this.list.filter((s) => s.dir === 'out').reduce((sum, s) => sum + Math.max(0, s.want - s.shipped.length), 0);
  }
  /** 隔天早上到貨的單子,在新的一天開始時送出 */
  dayStart() {
    for (const s of this.list) if (s.eta < 0) s.eta = 6;
  }

  // ---------- 存檔 ----------
  snapshot(): ShipSave[] {
    return this.list.map((s) => ({
      id: s.id,
      dir: s.dir,
      label: s.label,
      items: s.dir === 'in' ? s.pendingItems : [],
      want: s.dir === 'out' ? s.want - s.shipped.length : 0,
      eta: s.docked ? 0 : s.eta,
    }));
  }
  private restoreOne(d: ShipSave) {
    const boxes = d.dir === 'in' ? Math.ceil(d.items.length / BOX_SIZE) : Math.ceil(d.want / BOX_SIZE);
    if (boxes <= 0) return;
    const ship = new Shipment(d.id, d.dir, d.label, d.eta, boxes, d.want);
    if (d.dir === 'in') for (let i = 0; i < boxes; i++) ship.slices.push(d.items.slice(i * BOX_SIZE, (i + 1) * BOX_SIZE));
    this.list.push(ship);
    this.seq = Math.max(this.seq, d.id + 1);
  }

  // ---------- 給店員的工作 ----------
  /** 已經停好的貨車上,還沒搬的紙箱 */
  jobs(): BoxJob[] {
    const s = this.cur;
    if (!s || this.phase !== 'docked') return [];
    const out: BoxJob[] = [];
    for (let i = 0; i < s.boxes; i++) if (!s.done.has(i)) out.push({ key: `box:${s.id}:${i}`, ship: s, box: i });
    return out;
  }
  /** 退貨搬運:從倉庫拿 n 隻(受預約數限制),回傳實際拿到的 */
  loadBox(ship: Shipment): StockItem[] {
    const need = Math.min(BOX_SIZE, ship.want - ship.shipped.length);
    return need > 0 ? this.hooks.takeWarehouse(need) : [];
  }
  /** 店員完成一個紙箱 */
  completeBox(ship: Shipment, box: number, items: StockItem[] = []) {
    if (ship.done.has(box)) return;
    ship.done.add(box);
    if (ship.dir === 'in') {
      const slice = ship.slices[box];
      this.hooks.addWarehouse(slice);
      this.hooks.onInbound(slice.length);
    } else {
      ship.shipped.push(...items);
    }
    if (ship.dir === 'out' && ship.shipped.length >= ship.want) for (let i = 0; i < ship.boxes; i++) ship.done.add(i);
  }

  get current() {
    return this.cur;
  }
  get docked() {
    return this.phase === 'docked';
  }
  get busy() {
    return this.phase !== 'idle';
  }
  /** 停靠位置(給提示圖示用) */
  get dockPos() {
    return new THREE.Vector3(TRUCK_DOCK.rearX - 3, 2.8, TRUCK_DOCK.z);
  }

  // ---------- 每步更新 ----------
  update(dt: number) {
    if (this.hooks.active()) {
      for (const s of this.list) if (s !== this.cur && s.eta > 0) s.eta = Math.max(0, s.eta - dt);
      if (this.phase === 'idle') {
        const next = this.list.find((s) => s.eta === 0);
        if (next) this.arrive(next);
      }
    }
    switch (this.phase) {
      case 'in':
        this.t += dt / MOVE_SEC;
        this.truck.position.x = THREE.MathUtils.lerp(FAR_X, TRUCK_DOCK.rearX, ease(this.t));
        if (this.t >= 1) this.dock();
        break;
      case 'docked': {
        const s = this.cur!;
        this.syncCargo();
        this.waveT -= dt;
        if (s.isDone) {
          this.hold += dt;
          if (this.hold > 1.6) this.depart();
        }
        break;
      }
      case 'out':
        this.t += dt / MOVE_SEC;
        this.truck.position.x = THREE.MathUtils.lerp(TRUCK_DOCK.rearX, FAR_X, ease(this.t));
        if (this.t >= 1) this.leaveDone();
        break;
    }
    if (this.driver.group.visible) this.driver.update(dt, this.waveT > 0 ? 'wave' : 'idle');
  }

  private arrive(s: Shipment) {
    this.cur = s;
    this.phase = 'in';
    this.t = 0;
    this.hold = 0;
    s.eta = 0;
    this.truck.position.set(FAR_X, 0, TRUCK_DOCK.z);
    this.truck.visible = true;
    this.syncCargo();
    this.hooks.log(`🚚 ${s.dir === 'in' ? '供應商貨車' : '退貨回收車'}來了(${s.label}),正在倒車入庫`, 'system');
  }
  private dock() {
    const s = this.cur!;
    this.phase = 'docked';
    s.docked = true;
    this.driver.group.visible = true;
    this.waveT = 2.2;
    this.hooks.ding();
    if (s.dir === 'in') this.hooks.log(`📦 貨車停妥,共 ${s.boxes} 箱 ${s.pendingItems.length} 隻,等店員卸貨`, 'alert');
    else this.hooks.log(`📦 回收車停妥,請店員把 ${s.want} 隻退貨搬上車`, 'alert');
  }
  private depart() {
    const s = this.cur!;
    this.phase = 'out';
    this.t = 0;
    this.driver.group.visible = false;
    if (s.dir === 'out') {
      const n = s.shipped.length;
      const refund = Math.round(s.shipped.reduce((sum, it) => sum + PLUSH_COST[it.rarity] * RETURN_RATE, 0));
      this.hooks.onReturned(n);
      this.hooks.refund(refund);
      this.hooks.log(`↩️ 退貨 ${n} 隻已由供應商取走,退款 NT$ ${refund.toLocaleString('en-US')}`, 'system');
    } else {
      this.hooks.log(`✅ ${s.label} 全數入庫,貨車離開`, 'system');
    }
  }
  private leaveDone() {
    const s = this.cur!;
    const i = this.list.indexOf(s);
    if (i >= 0) this.list.splice(i, 1);
    this.cur = null;
    this.phase = 'idle';
    this.truck.visible = false;
  }

  /** 車上顯示的紙箱數:進貨 = 還沒搬走的;退貨 = 已經搬上車的 */
  private syncCargo() {
    const s = this.cur;
    const n = !s ? 0 : s.dir === 'in' ? s.left : s.done.size;
    this.cargo.forEach((c, i) => (c.visible = i < n));
  }

  // ---------- 貨車模型(車尾朝 +x,對準倉庫卸貨口) ----------
  private buildTruck() {
    const g = this.truck;
    const std = (c: number, rough = 0.6, metal = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    const body = std(0xf1f0ec, 0.45);
    const accent = std(0xe8662b, 0.5);
    const dark = std(0x20232b, 0.7);
    box(6.2, 0.22, 2.1, dark, -3.1, 0.5, 0);
    // 貨箱:地板、兩側、前壁、車頂;後面開口
    box(4.4, 0.1, 2.3, std(0x8a6f4d, 0.8), -2.2, 0.72, 0);
    for (const s of [-1, 1]) box(4.4, 2.2, 0.08, body, -2.2, 1.85, s * 1.1);
    box(0.08, 2.2, 2.3, body, -4.4, 1.85, 0);
    box(4.5, 0.1, 2.4, body, -2.2, 3.0, 0);
    for (const s of [-1, 1]) box(4.4, 0.14, 0.1, accent, -2.2, 1.0, s * 1.13);
    // 車頭
    box(1.7, 1.5, 2.2, accent, -5.45, 1.3, 0);
    box(1.0, 0.8, 2.22, std(0x7fb3d5, 0.1, 0.4), -5.9, 1.65, 0);
    box(1.9, 0.12, 2.3, dark, -5.45, 0.62, 0);
    for (const s of [-1, 1]) box(0.2, 0.2, 0.4, glowMat(2.4, 2.0, 1.2), -6.32, 0.95, s * 0.8);
    // 輪子
    const tyre = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 18);
    const tyreMat = std(0x15161a, 0.9);
    for (const x of [-5.5, -3.4, -0.9]) {
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(tyre, tyreMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.5, s * 1.0);
        w.castShadow = true;
        g.add(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 12), std(0xb9bec9, 0.3, 0.9));
        hub.rotation.x = Math.PI / 2;
        hub.position.set(x, 0.5, s * 1.0);
        g.add(hub);
      }
    }
    // 車身字樣
    const tex = neonTexture('TOY EXPRESS', '#ff7a3d', 1024, 300, 'bold 150px "Arial Black", sans-serif', '玩具快遞');
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 1.0),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9 }),
      );
      p.position.set(-2.2, 1.9, s * 1.145);
      p.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(p);
    }
    // 車上的紙箱
    const card = std(0xc89a5b, 0.9);
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.62), card);
      c.position.set(-0.8 - Math.floor(i / 3) * 0.95, 1.05, ((i % 3) - 1) * 0.72);
      c.castShadow = true;
      g.add(c);
      this.cargo.push(c);
    }
    g.position.set(FAR_X, 0, TRUCK_DOCK.z);
  }
}

const glowMat = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
