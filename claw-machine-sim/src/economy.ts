import type { Rarity } from './config';

/** 單隻娃娃的進貨成本(也是顧客拿走時計入的獎品成本) */
export const PLUSH_COST: Record<Rarity, number> = { common: 15, rare: 40, ssr: 120 };
export const RENT = 2500;
/** 每位店員每班的薪水 */
export const WAGE_SHIFT = 400;
export const SHIFT_NAMES = ['早班', '晚班'] as const;
export const CAPACITY = 24;
/** 一個營業日的長度(遊戲秒),對應 10:00 ~ 22:00 */
export const OPEN_SECONDS = 480;
export const OPEN_HOUR = 10;
export const HOURS = 12;
export const BASE_PRICE = 20;

export interface Pack {
  id: string;
  name: string;
  desc: string;
  count: number;
  price: number;
  weights: Record<Rarity, number>;
}

export type RetailKind = 'drink' | 'snack';
/** 零售商品:售價、進貨成本、展示容量、補貨箱的件數 */
export const RETAIL: Record<RetailKind, { name: string; icon: string; price: number; cost: number; cap: number; box: number; boxPrice: number }> = {
  drink: { name: '飲料', icon: '🥤', price: 30, cost: 12, cap: 24, box: 24, boxPrice: 288 },
  snack: { name: '零食周邊', icon: '🍿', price: 45, cost: 20, cap: 20, box: 20, boxPrice: 400 },
};
/** 每個紙箱裝幾隻 */
export const BOX_SIZE = 20;
/** 急件加價與到貨時間(遊戲秒) */
export const RUSH_FEE = 0.2;
export const RUSH_ETA = 24;
/** 退貨可退回成本的比例 */
export const RETURN_RATE = 0.6;

export const PACKS: Pack[] = [
  { id: 'small', name: '小批進貨', desc: '20 隻,多為普通款', count: 20, price: 560, weights: { common: 0.7, rare: 0.25, ssr: 0.05 } },
  { id: 'std', name: '標準進貨箱', desc: '100 隻,多為普通款', count: 100, price: 2600, weights: { common: 0.7, rare: 0.25, ssr: 0.05 } },
  { id: 'pick', name: '精選進貨箱', desc: '100 隻,稀有款機率高', count: 100, price: 4600, weights: { common: 0.35, rare: 0.5, ssr: 0.15 } },
];

export interface StockItem {
  typeId: string;
  rarity: Rarity;
}

export function rollRarity(w: Record<Rarity, number>): Rarity {
  const r = Math.random();
  if (r < w.ssr) return 'ssr';
  if (r < w.ssr + w.rare) return 'rare';
  return 'common';
}

export interface DayStats {
  customers: number;
  plays: number;
  wins: number;
  rareWins: number;
  revenue: number;
  coinsSold: number;
  restocks: number;
  cleans: number;
  assists: number;
  repairs: number;
  mops: number;
  retrievals: number;
  refills: number;
  cogs: number;
  purchases: number;
  satSum: number;
  satCount: number;
  walkouts: number;
  noStock: number;
  angry: number;
  // 隨機事件
  spills: number;
  slips: number;
  faults: number;
  stuck: number;
  jams: number;
  // 進出貨與後場
  /** 貨車送到倉庫的娃娃隻數 */
  inbound: number;
  /** 退回供應商的隻數 */
  returned: number;
  /** 從倉庫補到機台的隻數 */
  shelved: number;
  unloads: number;
  loads: number;
  wcVisits: number;
  wcCleans: number;
  rests: number;
  /** 櫃檯人工兌幣的次數 */
  counterServed: number;
  /** 冰箱與展示架賣出的件數與營收 */
  retailSold: number;
  retailRev: number;
}

export const newStats = (): DayStats => ({
  customers: 0, plays: 0, wins: 0, rareWins: 0, revenue: 0, coinsSold: 0,
  restocks: 0, cleans: 0, assists: 0, repairs: 0, mops: 0, retrievals: 0, refills: 0,
  cogs: 0, purchases: 0, satSum: 0, satCount: 0, walkouts: 0, noStock: 0, angry: 0,
  spills: 0, slips: 0, faults: 0, stuck: 0, jams: 0,
  inbound: 0, returned: 0, shelved: 0, unloads: 0, loads: 0, wcVisits: 0, wcCleans: 0, rests: 0, counterServed: 0, retailSold: 0, retailRev: 0,
});

/** 劇情選擇帶來的暫時店況加成(持續幾天) */
export interface Modifier {
  id: string;
  label: string;
  days: number;
  /** 以下皆為倍率或加減值,未填表示不影響 */
  arrival?: number;
  spill?: number;
  fault?: number;
  jam?: number;
  /** 全店爪力的加減(例如 +0.1) */
  strength?: number;
  /** 客人進門時的心情加成 */
  mood?: number;
  wage?: number;
  rent?: number;
}

export interface StoryLogEntry {
  day: number;
  id: string;
  title: string;
  icon: string;
  choice: string;
  outcome: string;
}

export interface StaffSave {
  morale: number;
  bonus: number[];
  leaveUntil: number;
}

/** 在途或已到倉庫卸貨區的貨運單(存檔用) */
export interface ShipSave {
  id: number;
  dir: 'in' | 'out';
  label: string;
  /** 進貨:還沒卸進倉庫的娃娃 */
  items: StockItem[];
  /** 退貨:還要從倉庫搬出幾隻 */
  want: number;
  /** 還要幾遊戲秒到達;-1 表示明天早上到 */
  eta: number;
}

export interface GameState {
  day: number;
  cash: number;
  rep: number; // 1 ~ 5
  price: number;
  strength: number; // 0.15 ~ 0.95
  speed: number;
  warehouse: StockItem[];
  totalProfit: number;
  /** 早班、晚班各幾位店員(3 或 4) */
  shiftSize: [number, number];
  staff?: Record<string, StaffSave>;
  regulars: Record<string, { visits: number }>;
  flags: string[];
  mods: Modifier[];
  storyLog: StoryLogEntry[];
  storyDay: Record<string, number>;
  chains: { id: string; day: number }[];
  last?: { revenue: number; profit: number; faults: number };
  /** 運送中的進貨與退貨 */
  shipments: ShipSave[];
  shipSeq: number;
  /** 是否派一位店員坐櫃檯(開放人工兌幣與客服) */
  counterOpen: boolean;
  /** 零售:展示中的庫存與倉庫備貨 */
  retail: Record<RetailKind, number>;
  retailBack: Record<RetailKind, number>;
}

export const initialState = (): GameState => ({
  day: 1,
  cash: 30000,
  rep: 2.5,
  price: BASE_PRICE,
  strength: 0.4,
  speed: 4,
  warehouse: [],
  totalProfit: 0,
  shiftSize: [4, 3],
  regulars: {},
  flags: [],
  mods: [],
  storyLog: [],
  storyDay: {},
  chains: [],
  shipments: [],
  shipSeq: 1,
  counterOpen: true,
  retail: { drink: 18, snack: 14 },
  retailBack: { drink: 24, snack: 20 },
});

const KEY = 'claw-club-save-v3';

export function saveGame(state: GameState, machines: StockItem[][]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, machines }));
  } catch {
    /* 無痕模式等情況下無法儲存,忽略 */
  }
}

export function loadGame(): { state: GameState; machines: StockItem[][] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.state || !Array.isArray(d.machines)) return null;
    return { state: { ...initialState(), ...d.state }, machines: d.machines };
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}

/** 營業日結算(固定成本由呼叫端提供) */
export function settle(stats: DayStats, fixedCost: number) {
  const profit = stats.revenue - stats.cogs - fixedCost;
  const avgSat = stats.satCount ? stats.satSum / stats.satCount : 0;
  const repDelta = stats.satCount ? Math.max(-0.5, Math.min(0.5, avgSat * 0.45)) : -0.1;
  const winRate = stats.plays ? stats.wins / stats.plays : 0;
  return { profit, avgSat, repDelta, winRate };
}
