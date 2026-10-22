import type { Rarity } from './config';

/** 單隻娃娃的進貨成本(也是顧客拿走時計入的獎品成本) */
export const PLUSH_COST: Record<Rarity, number> = { common: 15, rare: 40, ssr: 120 };
export const RENT = 150;
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

export const PACKS: Pack[] = [
  { id: 'std', name: '標準進貨包', desc: '10 隻,多為普通款', count: 10, price: 280, weights: { common: 0.7, rare: 0.25, ssr: 0.05 } },
  { id: 'pick', name: '精選進貨包', desc: '10 隻,稀有款機率高', count: 10, price: 480, weights: { common: 0.35, rare: 0.5, ssr: 0.15 } },
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
  cogs: number;
  purchases: number;
  satSum: number;
  satCount: number;
  walkouts: number; // 排隊人數滿了,直接離開
  noStock: number; // 缺貨離開
  angry: number; // 生氣離開(含等太久)
}

export const newStats = (): DayStats => ({
  customers: 0,
  plays: 0,
  wins: 0,
  rareWins: 0,
  revenue: 0,
  cogs: 0,
  purchases: 0,
  satSum: 0,
  satCount: 0,
  walkouts: 0,
  noStock: 0,
  angry: 0,
});

export interface GameState {
  day: number;
  cash: number;
  rep: number; // 1 ~ 5
  price: number;
  strength: number; // 0.15 ~ 0.95
  speed: number;
  warehouse: StockItem[];
  totalProfit: number;
}

export const initialState = (): GameState => ({
  day: 1,
  cash: 1000,
  rep: 2.5,
  price: BASE_PRICE,
  strength: 0.4,
  speed: 2,
  warehouse: [],
  totalProfit: 0,
});

const KEY = 'claw-club-save-v1';

export function saveGame(state: GameState, machine: StockItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, machine }));
  } catch {
    /* 無痕模式等情況下無法儲存,忽略 */
  }
}

export function loadGame(): { state: GameState; machine: StockItem[] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.state || !Array.isArray(d.machine)) return null;
    return { state: { ...initialState(), ...d.state }, machine: d.machine };
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

/** 營業日結算 */
export function settle(stats: DayStats) {
  const profit = stats.revenue - stats.cogs - RENT;
  const avgSat = stats.satCount ? stats.satSum / stats.satCount : 0;
  const repDelta = stats.satCount ? Math.max(-0.5, Math.min(0.5, avgSat * 0.45)) : -0.1;
  const winRate = stats.plays ? stats.wins / stats.plays : 0;
  return { profit, avgSat, repDelta, winRate };
}
