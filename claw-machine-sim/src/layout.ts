import * as THREE from 'three';

/** 店面佈局(世界座標,+z 朝向鏡頭/入口,+x 朝右)。
 *  60 台機台排成 6 排 × 10 台,排與排之間是走道;前廳在最前面,放兌幣機、倉庫與員工休息室。 */
export interface MachineTheme {
  name: string;
  title: string;
  sub: string;
  accent: number;
  hue: number;
}

const THEME_DEFS: [string, string, number, number][] = [
  ['CLAW CLUB', '夾 娃 娃 樂 園', 0xe0457f, 335],
  ['OCEAN', '海 洋 夾 夾 樂', 0x1f9fcb, 195],
  ['FOREST', '森 林 夾 夾 樂', 0x35b072, 150],
  ['SUNSET', '日 落 夾 夾 樂', 0xe58a35, 28],
  ['GALAXY', '銀 河 夾 夾 樂', 0x7a62d9, 262],
  ['CANDY', '糖 果 夾 夾 樂', 0xe85fa8, 318],
  ['LEMON', '檸 檬 夾 夾 樂', 0xd7b72f, 52],
  ['MINT', '薄 荷 夾 夾 樂', 0x39b8a6, 172],
];

export const COLS = 10;
export const ROWS = 6;
export const SX = 2.6;
export const SZ = 6.0;
export const N_MACHINES = COLS * ROWS;

export const THEMES: MachineTheme[] = THEME_DEFS.map(([title, sub, accent, hue], i) => ({ name: `主題${i + 1}`, title, sub, accent, hue }));

export const rowZ = (r: number) => -15 + r * SZ;
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
export const CORR_X = 14.2;
export const FOYER_Z = 20.2;
export const LANE_Z = 26.4;
export const DOOR_OUT = new THREE.Vector3(0, 0, 32.5);
export const DOOR_IN = new THREE.Vector3(0, 0, 29.0);
export const HALL = { minX: -17, maxX: 17, minZ: -19.5, maxZ: 30 };

export const EXCHANGES = [
  { x: -4.5, z: 21.6 },
  { x: 4.5, z: 21.6 },
];
/** 使用者站位:第 0 格貼著兌幣機,後面往入口方向排隊 */
export const exchangeSlot = (k: number, i: number) => new THREE.Vector3(EXCHANGES[k].x, 0, EXCHANGES[k].z + 1.45 + 0.85 * i);
/** 店員補幣/排除故障的站位(兌幣機側邊) */
export const exchangeService = (k: number) => new THREE.Vector3(EXCHANGES[k].x + 1.3, 0, EXCHANGES[k].z + 1.1);

export const SHELF = { x: -12.0, z: 23.8 };
export const shelfSpot = () => new THREE.Vector3(-10.2, 0, 24.9);
export const STAFF_DOOR = new THREE.Vector3(12.6, 0, 24.6);

/** 玩家站位:機台右前方;後面的人往鏡頭方向排隊 */
export const machineStation = (g: Grid, i: number) => (i === 0 ? new THREE.Vector3(g.x + 0.8, 0, g.z + 1.38) : new THREE.Vector3(g.x + 1.2, 0, g.z + 1.38 + 0.8 * i));
/** 員工作業位:機台左前方(取物口旁) */
export const serviceSpot = (g: Grid) => new THREE.Vector3(g.x - 0.95, 0, g.z + 1.2);

export const IDLE_SPOTS = [
  new THREE.Vector3(-6, 0, 18.2),
  new THREE.Vector3(6, 0, 18.2),
  new THREE.Vector3(0, 0, 12.4),
  new THREE.Vector3(-7, 0, 6.4),
  new THREE.Vector3(7, 0, 0.4),
  new THREE.Vector3(-3, 0, -5.6),
  new THREE.Vector3(3, 0, -11.6),
  new THREE.Vector3(0, 0, 24.5),
];

/** 走道區域編號:0~5 為各排前方走道,6 為前廳,-1 為左右側通道,-2 為機台帶(不可行走) */
export function stripOf(p: THREE.Vector3): number {
  if (Math.abs(p.x) > 13.4) return -1;
  if (p.z >= FOYER_Z) return ROWS;
  for (let r = 0; r < ROWS; r++) if (p.z >= rowZ(r) + 1.0 && p.z <= rowZ(r) + 5.3) return r;
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
