import * as THREE from 'three';
import { BOSS, Character } from './characters';
import { Human, humanOptsFromCharacter } from './human';
import { IDLE_SPOTS, officeDesk, route } from './layout';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 老闆:營業中在店裡巡視,準備階段站在前廳 */
export class BossNpc {
  readonly ch: Character = BOSS;
  readonly human = new Human(humanOptsFromCharacter(BOSS, 1.02, false));
  bubble = '';
  bubbleT = 0;
  action = '在前廳整理帳本';
  private path: THREE.Vector3[] = [];
  private dwell = rnd(2, 5);
  private wave = 0;
  private home = new THREE.Vector3(1.6, 0, 17.4);

  constructor(scene: THREE.Object3D) {
    this.human.group.position.copy(this.home);
    this.human.setBadge(0xf0c04a);
    scene.add(this.human.group);
  }
  get pos() {
    return this.human.group.position;
  }
  say(t: string, sec = 2.2) {
    this.bubble = t;
    this.bubbleT = sec;
  }

  update(dt: number, open: boolean) {
    if (this.bubbleT > 0) this.bubbleT -= dt;
    const p = this.pos;
    let pose: 'idle' | 'walk' | 'wave' = 'idle';
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - p.x;
      const dz = wp.z - p.z;
      const d = Math.hypot(dx, dz);
      const step = 1.25 * dt;
      if (d <= step) {
        p.x = wp.x;
        p.z = wp.z;
        this.path.shift();
      } else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        const want = Math.atan2(dx, dz);
        let diff = want - this.human.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.human.group.rotation.y += diff * Math.min(1, dt * 8);
      }
      pose = 'walk';
    } else {
      this.dwell -= dt;
      if (this.wave > 0) {
        this.wave -= dt;
        pose = 'wave';
      }
      if (this.dwell <= 0) {
        const toOffice = Math.random() < (open ? 0.28 : 0.6);
        const target = toOffice ? officeDesk() : open ? IDLE_SPOTS[Math.floor(Math.random() * IDLE_SPOTS.length)] : this.home;
        this.path = route(p, target);
        this.dwell = toOffice ? rnd(14, 26) : open ? rnd(7, 14) : rnd(8, 16);
        this.action = toOffice ? '在辦公室對帳、下訂單' : open ? '巡店中' : '在前廳整理帳本';
        if (open && !toOffice && Math.random() < 0.5) {
          this.wave = 1.6;
          this.say(['大家辛苦了!', '今天人好多啊', '有問題隨時叫我'][Math.floor(Math.random() * 3)]);
        }
      }
    }
    this.human.update(dt, pose);
  }
}
