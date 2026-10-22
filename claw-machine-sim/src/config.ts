// 座標系:機台局部座標,y=0 為夾物區地板表面,+z 朝向玩家,+x 朝右。單位:公尺。
export const FIELD = { halfX: 0.75, halfZ: 0.6, height: 1.6 } as const;

// 出口(左前角):地板在此區域挖空,娃娃掉入後算中獎
export const CHUTE = { x1: -0.32, z0: 0.16, depth: 0.55 } as const;

export const CLAW = {
  minX: -0.53,
  maxX: 0.53,
  minZ: -0.4,
  maxZ: 0.4,
  topY: 1.22, // 爪頭待機高度
  floorY: 0.42, // 爪頭下降極限
  gantryY: 1.52,
  speed: 0.6,
  descendSpeed: 0.55,
  liftSpeed: 0.5,
  travelSpeed: 0.5,
  closeTime: 0.9,
  openTime: 0.5,
  playTime: 25,
} as const;

export const HOME = { x: 0.5, z: -0.38 } as const;
export const DROP_POINT = { x: -0.53, z: 0.38 } as const;

export const BASE_HEIGHT = 0.95; // 機台地板距店內地面高度

export type Rarity = 'common' | 'rare' | 'ssr';
export const RARITY: Record<Rarity, { label: string; color: string; weight: number }> = {
  common: { label: '普通', color: '#9fb3c8', weight: 0.7 },
  rare: { label: '稀有', color: '#5ec8ff', weight: 0.25 },
  ssr: { label: '超稀有', color: '#ffd45e', weight: 0.05 },
};
