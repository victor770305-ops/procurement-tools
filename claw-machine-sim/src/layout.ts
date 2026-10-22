import * as THREE from 'three';

/** 店面佈局(世界座標,+z 朝向鏡頭,+x 朝右)。機台排成一列,右側是櫃台與入口,左側是倉庫貨架。 */
export interface MachineTheme {
  name: string;
  title: string;
  sub: string;
  accent: number;
  hue: number;
}

export const THEMES: MachineTheme[] = [
  { name: '1號機', title: 'CLAW CLUB', sub: '夾 娃 娃 樂 園', accent: 0xff2f8e, hue: 320 },
  { name: '2號機', title: 'OCEAN', sub: '海 洋 夾 夾 樂', accent: 0x1fa9d6, hue: 195 },
  { name: '3號機', title: 'FOREST', sub: '森 林 夾 夾 樂', accent: 0x3bc27b, hue: 150 },
];

export const MACHINE_X = [-2.9, 0, 2.9];
export const ENTRANCE = new THREE.Vector3(8.7, 0, 5.0);
export const DOOR_IN = new THREE.Vector3(7.2, 0, 5.0);
export const COUNTER = { x: 5.4, z: 0.4 };
export const SHELF_X = -5.7;

export const cashierSpot = () => new THREE.Vector3(COUNTER.x, 0, COUNTER.z - 0.6);
export const counterSlot = (i: number) => new THREE.Vector3(COUNTER.x, 0, COUNTER.z + 1.0 + 0.8 * i);
/** 員工在貨架前取貨的位置 */
export const shelfSpot = () => new THREE.Vector3(SHELF_X + 0.9, 0, 1.3);
/** 玩家站位:機台右前方;後面的人往鏡頭方向排隊 */
export const machineStation = (mx: number, i: number) => (i === 0 ? new THREE.Vector3(mx + 0.8, 0, 1.38) : new THREE.Vector3(mx + 1.1, 0, 1.38 + 0.78 * i));
/** 員工作業位:機台左前方(取物口旁) */
export const serviceSpot = (mx: number) => new THREE.Vector3(mx - 0.95, 0, 1.2);
export const idleSpots = [new THREE.Vector3(-1.4, 0, 3.2), new THREE.Vector3(1.4, 0, 3.4), new THREE.Vector3(-4.2, 0, 3.0), new THREE.Vector3(3.8, 0, 3.6)];
