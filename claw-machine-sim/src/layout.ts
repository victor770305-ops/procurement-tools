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

export const EXCHANGES = [
  { x: -2.6, z: 14.3 },
  { x: 2.6, z: 14.3 },
];
/** 使用者站位:第 0 格貼著兌幣機,後面往入口方向排隊 */
export const exchangeSlot = (k: number, i: number) => new THREE.Vector3(EXCHANGES[k].x, 0, EXCHANGES[k].z + 1.45 + 0.85 * i);
/** 店員補幣/排除故障的站位(兌幣機側邊) */
export const exchangeService = (k: number) => new THREE.Vector3(EXCHANGES[k].x + 1.3, 0, EXCHANGES[k].z + 1.1);

export const SHELF = { x: -8.7, z: 16.2 };
export const shelfSpot = () => new THREE.Vector3(-7.3, 0, 16.2);
export const STAFF_DOOR = new THREE.Vector3(8.2, 0, 16.8);

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
  new THREE.Vector3(4.5, 0, 16),
];

/** 走道區域編號:0~5 為各排前方走道,6 為前廳,-1 為左右側通道,-2 為機台帶(不可行走) */
export function stripOf(p: THREE.Vector3): number {
  if (Math.abs(p.x) > CORR_X - 0.9) return -1;
  if (p.z >= FOYER_Z) return ROWS;
  for (let r = 0; r < ROWS; r++) if (p.z >= rowZ(r) + 0.62 && p.z <= rowZ(r) + 3.3) return r;
  return -2;
}

/** 從 from 走到 to 的折線路徑(只走走道與側通道,不穿過機台) */
export function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
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
