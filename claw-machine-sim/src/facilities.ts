import * as THREE from 'three';
import { REST_SPOTS, ROOMS, WC_LAYOUT, WcSlot } from './layout';

/** 廁所:有限的隔間與小便斗、會越用越髒,髒了要店員清理 */
export class Restroom {
  readonly slots: (WcSlot & { user: object | null })[];
  readonly sinks: THREE.Vector3[];
  dirt = 0;
  uses = 0;
  /** 髒到這個程度客人會抱怨 */
  static readonly GROSS = 0.7;

  constructor(readonly id: 'wcF' | 'wcM') {
    const l = WC_LAYOUT[id];
    this.slots = l.slots.map((s) => ({ ...s, user: null }));
    this.sinks = l.sinks;
  }
  get name() {
    return ROOMS[this.id].name;
  }
  get cleanSpot() {
    return WC_LAYOUT[this.id].clean;
  }
  get free() {
    return this.slots.filter((s) => !s.user).length;
  }
  get busy() {
    return this.slots.length - this.free;
  }
  claim(user: object) {
    const s = this.slots.find((x) => !x.user);
    if (!s) return null;
    s.user = user;
    return s;
  }
  release(user: object) {
    for (const s of this.slots) if (s.user === user) s.user = null;
  }
}

/** 員工休息室:幾個可以坐或站的位置 */
export class Lounge {
  readonly spots = REST_SPOTS.map((pos) => ({ pos, user: null as object | null }));
  claim(user: object) {
    const s = this.spots.find((x) => !x.user);
    if (!s) return null;
    s.user = user;
    return s.pos;
  }
  release(user: object) {
    for (const s of this.spots) if (s.user === user) s.user = null;
  }
  get occupied() {
    return this.spots.filter((s) => s.user).length;
  }
}
