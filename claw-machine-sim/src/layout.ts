import * as THREE from 'three';

/** 店面佈局(世界座標,+z 朝向鏡頭/入口,+x 朝右)。
 *  60 台機台排成 6 排 × 10 台,排與排之間是走道;前廳在最前面,放兌幣機、倉庫與員工休息室。 */
export interface MachineTheme {
  name: string;
  title: string;
  sub: string;
  /** 外框與櫃身的主色 */
  accent: number;
  hue: number;
  /** 櫃身印花的吉祥物:0 熊、1 蜜蜂、2 兔子、3 貓 */
  mascot: number;
}

const THEME_DEFS: [string, string, number, number][] = [
  ['TOY TOWN', '玩具樂園', 0xf2c21b, 48],
  ['FUN LAND', '歡樂世界', 0x2f9be0, 205],
  ['HAPPY ZOO', '快樂動物園', 0x3fbf6a, 140],
  ['SWEET POP', '甜心派對', 0xee6aa7, 330],
  ['MAGIC STAR', '魔法之星', 0x8d6be0, 262],
  ['CANDY TOWN', '糖果小鎮', 0xf08a2c, 28],
  ['PANDA PARK', '熊貓樂園', 0xe2504a, 5],
  ['SKY BALLOON', '天空氣球', 0x30c2c8, 182],
];

export const COLS = 10;
export const ROWS = 6;
/** 機台寬 0.89 公尺 + 0.41 公尺間隙 */
export const SX = 1.3;
export const SZ = 3.9;
export const N_MACHINES = COLS * ROWS;

export const THEMES: MachineTheme[] = THEME_DEFS.map(([title, sub, accent, hue], i) => ({ name: `主題${i + 1}`, title, sub, accent, hue, mascot: i }));

export const rowZ = (r: number) => -10.2 + r * SZ;
export const themeOf = (i: number) => THEMES[((i % COLS) + Math.floor(i / COLS) * 3) % THEMES.length];

export interface Grid {
  x: number;
  z: number;
  row: number;
  col: number;
}
export const gridOf = (i: number): Grid => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { x: (col - (COLS - 1) / 2) * SX, z: rowZ(row), row, col };
};

// ---------- 區域座標 ----------
export const CORR_X = 7.6;
export const FOYER_Z = 12.8;
export const LANE_Z = 18.2;
export const DOOR_OUT = new THREE.Vector3(0, 0, 24.5);
export const DOOR_IN = new THREE.Vector3(0, 0, 20.8);
export const HALL = { minX: -9.6, maxX: 9.6, minZ: -12.6, maxZ: 21.6 };

/** 兩台兌幣機,加上櫃檯人工兌幣(第 3 個,需要櫃檯店員在崗才能使用) */
export const EXCHANGES = [
  { x: -2.6, z: 14.3 },
  { x: 2.6, z: 14.3 },
  { x: 6.7, z: 15.3 },
];
export const COUNTER = { x: 6.7, z: 15.3, w: 3.2, d: 0.8 };
/** 櫃檯店員站位(櫃檯後方) */
export const cashierSpot = () => new THREE.Vector3(COUNTER.x, 0, COUNTER.z - 1.15);
/** 使用者站位:第 0 格貼著兌幣機,後面往入口方向排隊 */
export const exchangeSlot = (k: number, i: number) => new THREE.Vector3(EXCHANGES[k].x, 0, EXCHANGES[k].z + 1.45 + 0.85 * i);
/** 店員補幣/排除故障的站位(兌幣機側邊) */
export const exchangeService = (k: number) => new THREE.Vector3(EXCHANGES[k].x + 1.3, 0, EXCHANGES[k].z + 1.1);

// ---------- 後場房間(大廳左右兩側的加蓋區) ----------
export type RoomId = 'warehouse' | 'office' | 'lounge' | 'wcF' | 'wcM';
export interface Room {
  id: RoomId;
  name: string;
  side: 'E' | 'W';
  /** 室內範圍(x 由大廳牆往外) */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  doorZ: number;
  /** 門內側與門外側(大廳側通道)的路徑點 */
  inside: THREE.Vector3;
  outside: THREE.Vector3;
}
const mkRoom = (id: RoomId, name: string, side: 'E' | 'W', depthX: number, z0: number, z1: number, doorZ: number): Room => {
  const wall = side === 'E' ? HALL.maxX : HALL.minX;
  const sg = side === 'E' ? 1 : -1;
  return {
    id, name, side,
    x0: Math.min(wall, wall + sg * depthX),
    x1: Math.max(wall, wall + sg * depthX),
    z0, z1, doorZ,
    inside: new THREE.Vector3(wall + sg * 0.95, 0, doorZ),
    outside: new THREE.Vector3(wall - sg * 1.3, 0, doorZ),
  };
};
export const ROOMS: Record<RoomId, Room> = {
  warehouse: mkRoom('warehouse', '倉庫', 'W', 6.4, 8.4, 14.6, 11.5),
  wcF: mkRoom('wcF', '女廁', 'W', 4.2, 14.6, 18.0, 16.3),
  wcM: mkRoom('wcM', '男廁', 'W', 4.2, 18.0, 21.4, 19.7),
  office: mkRoom('office', '辦公室', 'E', 4.8, 10.4, 15.6, 12.8),
  lounge: mkRoom('lounge', '員工休息室', 'E', 5.2, 15.6, 21.4, 18.0),
};
export const ROOM_LIST = Object.values(ROOMS);
/** 鏡頭與平移的範圍(含兩側房間與倉庫外的卸貨區) */
export const WORLD = { minX: -80, maxX: 70, minZ: -34, maxZ: 70 };
/** 倉庫內:貨架取貨/上架站位、卸貨口站位(貨車停在倉庫西牆外) */
export const shelfSpot = () => new THREE.Vector3(-12.8, 0, 10.3);
export const dockSpot = () => new THREE.Vector3(-15.1, 0, ROOMS.warehouse.doorZ);
export const TRUCK_DOCK = { x: -19.6, z: ROOMS.warehouse.doorZ, rearX: -16.5 };
/** 廁所:每個隔間/小便斗是一個使用位,sinks 是洗手台站位 */
export interface WcSlot {
  front: THREE.Vector3;
  pos: THREE.Vector3;
}
export const WC_LAYOUT: Record<'wcF' | 'wcM', { slots: WcSlot[]; sinks: THREE.Vector3[]; clean: THREE.Vector3 }> = {
  wcF: {
    slots: [
      { front: new THREE.Vector3(-13.15, 0, 16.6), pos: new THREE.Vector3(-13.15, 0, 15.45) },
      { front: new THREE.Vector3(-12.05, 0, 16.6), pos: new THREE.Vector3(-12.05, 0, 15.45) },
    ],
    sinks: [new THREE.Vector3(-12.4, 0, 17.1), new THREE.Vector3(-11.2, 0, 17.1)],
    clean: new THREE.Vector3(-11.6, 0, 16.4),
  },
  wcM: {
    slots: [
      { front: new THREE.Vector3(-13.15, 0, 20.0), pos: new THREE.Vector3(-13.15, 0, 18.8) },
      { front: new THREE.Vector3(-11.9, 0, 19.5), pos: new THREE.Vector3(-11.9, 0, 18.85) },
      { front: new THREE.Vector3(-11.0, 0, 19.5), pos: new THREE.Vector3(-11.0, 0, 18.85) },
    ],
    sinks: [new THREE.Vector3(-12.4, 0, 20.6), new THREE.Vector3(-11.2, 0, 20.6)],
    clean: new THREE.Vector3(-11.6, 0, 19.9),
  },
};
/** 前廳靠西牆的零售設備:冰箱與展示架,spot 是客人購物站位 */
export const RETAIL_SPOTS = {
  drink: { x: -8.95, z: 18.0, spot: new THREE.Vector3(-7.6, 0, 18.0) },
  snack: { x: -8.95, z: 13.9, spot: new THREE.Vector3(-7.6, 0, 13.9) },
};
/** 員工休息室入口(店員上下班經過) */
export const STAFF_DOOR = ROOMS.lounge.outside.clone();
export const lockerSpot = () => new THREE.Vector3(12.0, 0, 16.7);
/** 休息室裡可以坐/站的休息位置 */
export const REST_SPOTS = [new THREE.Vector3(13.6, 0, 19.0), new THREE.Vector3(13.6, 0, 20.2), new THREE.Vector3(13.5, 0, 17.4), new THREE.Vector3(12.0, 0, 20.4)];
/** 辦公室:辦公桌後的位置、保險箱旁 */
export const officeDesk = () => new THREE.Vector3(12.8, 0, 12.6);
export const officeSafe = () => new THREE.Vector3(13.0, 0, 11.5);

/** 玩家站位:機台正前方;後面的人往走道方向排隊 */
export const machineStation = (g: Grid, i: number) => (i === 0 ? new THREE.Vector3(g.x, 0, g.z + 0.98) : new THREE.Vector3(g.x + 0.45, 0, g.z + 0.98 + 0.72 * i));
/** 員工作業位:機台左前方 */
export const serviceSpot = (g: Grid) => new THREE.Vector3(g.x - 0.5, 0, g.z + 0.88);
export const MAX_LINE = 4;

export const IDLE_SPOTS = [
  new THREE.Vector3(-3.5, 0, rowZ(1) + 2.3),
  new THREE.Vector3(3.5, 0, rowZ(1) + 2.3),
  new THREE.Vector3(0, 0, rowZ(3) + 2.3),
  new THREE.Vector3(-4, 0, rowZ(4) + 2.3),
  new THREE.Vector3(4, 0, rowZ(2) + 2.3),
  new THREE.Vector3(0, 0, rowZ(5) + 2.3),
  new THREE.Vector3(-4.5, 0, 16),
  new THREE.Vector3(3.2, 0, 19),
];

/** 走道區域編號:0~5 為各排前方走道,6 為前廳,-1 為左右側通道,-2 為機台帶(不可行走) */
export function stripOf(p: THREE.Vector3): number {
  if (Math.abs(p.x) > CORR_X - 0.9) return -1;
  if (p.z >= FOYER_Z) return ROWS;
  for (let r = 0; r < ROWS; r++) if (p.z >= rowZ(r) + 0.62 && p.z <= rowZ(r) + 3.3) return r;
  return -2;
}

const COUNTER_GAP_OUT = new THREE.Vector3(4.4, 0, 16.2);
const COUNTER_GAP_IN = new THREE.Vector3(4.4, 0, 14.2);
const inCounterBack = (p: THREE.Vector3) => p.x > 4.95 && p.x < 8.6 && p.z > 13.0 && p.z < COUNTER.z - 0.4;

/** 點在哪個區域:大廳或某個後場房間(卸貨區算倉庫) */
export function zoneOf(p: THREE.Vector3): RoomId | 'hall' {
  if (p.x > HALL.maxX + 0.12) {
    for (const r of [ROOMS.office, ROOMS.lounge]) if (p.z >= r.z0 && p.z < r.z1) return r.id;
  } else if (p.x < HALL.minX - 0.12) {
    for (const r of [ROOMS.warehouse, ROOMS.wcF, ROOMS.wcM]) if (p.z >= r.z0 && p.z < r.z1) return r.id;
  }
  return 'hall';
}

/** 大廳內:只走走道與側通道,不穿過機台與櫃檯 */
function hallRoute(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const fb = inCounterBack(from);
  const tb = inCounterBack(to);
  if (fb && tb) return [to.clone()];
  if (tb) return [...stripRoute(from, COUNTER_GAP_OUT), COUNTER_GAP_IN.clone(), to.clone()];
  if (fb) return [COUNTER_GAP_IN.clone(), ...stripRoute(COUNTER_GAP_OUT, to)];
  return stripRoute(from, to);
}

function stripRoute(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const sf = stripOf(from);
  const st = stripOf(to);
  if (sf === st && sf >= 0) return [to.clone()];
  const dl = Math.abs(from.x + CORR_X) + Math.abs(to.x + CORR_X);
  const dr = Math.abs(from.x - CORR_X) + Math.abs(to.x - CORR_X);
  const cx = dl < dr ? -CORR_X : CORR_X;
  const pts: THREE.Vector3[] = [];
  if (sf !== -1) pts.push(new THREE.Vector3(cx, 0, from.z));
  if (st !== -1) pts.push(new THREE.Vector3(cx, 0, st === ROWS ? LANE_Z : to.z));
  pts.push(to.clone());
  return pts;
}

/** 從 from 走到 to 的折線路徑:大廳只走走道;進出後場房間一律經過房門 */
export function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const zf = zoneOf(from);
  const zt = zoneOf(to);
  if (zf === 'hall' && zt === 'hall') return hallRoute(from, to);
  if (zf === zt) return [to.clone()];
  const pts: THREE.Vector3[] = [];
  let cur = from;
  if (zf !== 'hall') {
    const r = ROOMS[zf];
    pts.push(r.inside.clone(), r.outside.clone());
    cur = r.outside;
  }
  if (zt === 'hall') pts.push(...hallRoute(cur, to));
  else {
    const r = ROOMS[zt];
    pts.push(...hallRoute(cur, r.outside), r.inside.clone(), to.clone());
  }
  return pts;
}
