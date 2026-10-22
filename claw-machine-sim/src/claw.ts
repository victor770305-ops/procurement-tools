import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CLAW, DROP_POINT, HOME } from './config';
import type { Physics, PlushEntity } from './physics';

const HUB_R = 0.05;
const PRONG_LEN = 0.3;
const HOOK_LEN = 0.12;
const HOOK_ANGLE = 1.0;
const CAP_R = 0.016;
const PHI_OPEN = 0.62;
const PHI_CLOSED = 0.16;
const PRONGS = 3;

export type ClawState = 'idle' | 'play' | 'descend' | 'close' | 'lift' | 'travel' | 'release' | 'return';

const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe6e9f2, roughness: 0.14, metalness: 1 });
const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xff2f8e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

interface Prong {
  group: THREE.Group;
  body: RAPIER.RigidBody;
  azimuth: number;
}

export interface ClawEvents {
  onState?: (s: ClawState) => void;
  onGrab?: (held: number) => void;
  onSlip?: () => void;
}

export class ClawRig {
  readonly group = new THREE.Group();
  state: ClawState = 'idle';
  pos = new THREE.Vector3(HOME.x, CLAW.topY, HOME.z);
  vel = new THREE.Vector2();
  phi = PHI_OPEN;
  timeLeft: number = CLAW.playTime;
  /** 爪力 0~1:決定抓起後保持不掉的機率 */
  strength = 0.55;
  events: ClawEvents = {};

  private hubBody: RAPIER.RigidBody;
  private prongs: Prong[] = [];
  private t = 0;
  private held: PlushEntity[] = [];
  private slipAt = Infinity;
  private slipped = false;
  private liftT = 0;
  private tmpQa = new THREE.Quaternion();
  private tmpQb = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();

  constructor(private physics: Physics) {
    const world = physics.world;
    this.hubBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, this.pos.y, this.pos.z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.035, HUB_R + 0.01), this.hubBody);

    // 爪頭外殼
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 32), bodyMat);
    hub.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 24), chromeMat);
    cap.position.y = 0.055;
    cap.castShadow = true;
    this.group.add(hub, cap);

    const capsuleGeo = (len: number) => new THREE.CapsuleGeometry(CAP_R, len, 8, 14);
    for (let i = 0; i < PRONGS; i++) {
      const az = (i / PRONGS) * Math.PI * 2;
      const g = new THREE.Group();
      const main = new THREE.Mesh(capsuleGeo(PRONG_LEN - CAP_R * 2), chromeMat);
      main.position.y = -PRONG_LEN / 2;
      main.castShadow = true;
      g.add(main);
      const hook = new THREE.Mesh(capsuleGeo(HOOK_LEN - CAP_R * 2), chromeMat);
      const ha = -HOOK_ANGLE;
      hook.position.set((HOOK_LEN / 2) * Math.sin(ha), -PRONG_LEN - (HOOK_LEN / 2) * Math.cos(ha), 0);
      hook.rotation.z = ha;
      hook.castShadow = true;
      g.add(hook);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), chromeMat);
      g.add(joint);
      this.group.add(g);

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      world.createCollider(
        RAPIER.ColliderDesc.capsule((PRONG_LEN - CAP_R * 2) / 2, CAP_R).setTranslation(0, -PRONG_LEN / 2, 0).setFriction(1),
        body,
      );
      const hq = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, ha);
      world.createCollider(
        RAPIER.ColliderDesc.capsule((HOOK_LEN - CAP_R * 2) / 2, CAP_R)
          .setTranslation(hook.position.x, hook.position.y, 0)
          .setRotation({ x: hq.x, y: hq.y, z: hq.z, w: hq.w })
          .setFriction(1),
        body,
      );
      this.prongs.push({ group: g, body, azimuth: az });
    }
    this.applyPose();
  }

  private setState(s: ClawState) {
    this.state = s;
    this.t = 0;
    this.events.onState?.(s);
  }

  /** 投幣後開始操作 */
  begin() {
    if (this.state !== 'idle') return;
    this.timeLeft = CLAW.playTime;
    this.setState('play');
  }

  get playing() {
    return this.state === 'play';
  }

  drop() {
    if (this.state === 'play') this.setState('descend');
  }

  private moveToward(tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      this.pos.x = tx;
      this.pos.z = tz;
      return true;
    }
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    return false;
  }

  update(dt: number, input: { x: number; z: number }) {
    this.t += dt;
    const prevX = this.pos.x;
    const prevY = this.pos.y;
    const prevZ = this.pos.z;

    switch (this.state) {
      case 'play': {
        // 加減速平滑,模擬馬達慣性
        const k = Math.min(1, dt * 7);
        this.vel.x += (input.x * CLAW.speed - this.vel.x) * k;
        this.vel.y += (input.z * CLAW.speed - this.vel.y) * k;
        this.pos.x = THREE.MathUtils.clamp(this.pos.x + this.vel.x * dt, CLAW.minX, CLAW.maxX);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z + this.vel.y * dt, CLAW.minZ, CLAW.maxZ);
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.drop();
        }
        break;
      }
      case 'descend': {
        this.vel.set(0, 0);
        this.pos.y -= CLAW.descendSpeed * dt;
        // 爪頭碰到娃娃頂部就停止下降
        let touch = false;
        for (const p of this.physics.plushes) {
          const t = p.body.translation();
          if (Math.hypot(t.x - this.pos.x, t.z - this.pos.z) < 0.14 && t.y + 0.2 > this.pos.y - 0.09) {
            touch = true;
            break;
          }
        }
        if (touch || this.pos.y <= CLAW.floorY) {
          this.pos.y = Math.max(this.pos.y, CLAW.floorY);
          this.setState('close');
        }
        break;
      }
      case 'close': {
        const k = Math.min(1, this.t / CLAW.closeTime);
        this.phi = THREE.MathUtils.lerp(PHI_OPEN, PHI_CLOSED, 1 - (1 - k) * (1 - k));
        if (k >= 1) this.beginLift();
        break;
      }
      case 'lift': {
        this.liftT += dt;
        this.pos.y = Math.min(CLAW.topY, this.pos.y + CLAW.liftSpeed * dt);
        this.updateHold(dt);
        if (this.pos.y >= CLAW.topY) this.setState('travel');
        break;
      }
      case 'travel': {
        this.liftT += dt;
        this.updateHold(dt);
        if (this.moveToward(DROP_POINT.x, DROP_POINT.z, CLAW.travelSpeed, dt)) this.setState('release');
        break;
      }
      case 'release': {
        const k = Math.min(1, this.t / CLAW.openTime);
        this.phi = THREE.MathUtils.lerp(this.phi, PHI_OPEN, Math.min(1, dt * 8));
        this.held = [];
        if (this.t > 1.6 && k >= 1) this.setState('return');
        break;
      }
      case 'return': {
        this.phi = PHI_OPEN;
        if (this.moveToward(HOME.x, HOME.z, CLAW.travelSpeed * 1.4, dt)) this.setState('idle');
        break;
      }
      default:
        this.vel.set(0, 0);
    }

    // 實際速度(供馬達音效使用)
    this.speedMag = Math.hypot(this.pos.x - prevX, this.pos.y - prevY, this.pos.z - prevZ) / Math.max(dt, 1e-4);
    this.applyPose();
  }

  speedMag = 0;

  private beginLift() {
    // 判定被夾住的娃娃:位於爪內且在爪高範圍內
    this.held = this.physics.plushes.filter((p) => {
      const t = p.body.translation();
      const dy = this.pos.y - t.y;
      return Math.hypot(t.x - this.pos.x, t.z - this.pos.z) < 0.17 && dy > 0.05 && dy < 0.55;
    });
    this.held.sort((a, b) => b.body.translation().y - a.body.translation().y);
    this.held = this.held.slice(0, 1);
    this.liftT = 0;
    this.slipped = false;
    // 爪力決定「半途掉落」發生的機率與時機
    const hold = Math.pow(this.strength, 1.4) * 0.75;
    this.slipAt = Math.random() < hold ? Infinity : 0.2 + Math.random() * 1.6;
    if (this.held.length) this.events.onGrab?.(this.held.length);
    this.setState('lift');
  }

  /** 以彈簧阻尼把被夾的娃娃拉向爪心;爪力衰減時鬆開 */
  private updateHold(dt: number) {
    if (!this.held.length) return;
    if (!this.slipped && this.liftT >= this.slipAt) {
      this.slipped = true;
      this.events.onSlip?.();
    }
    if (this.slipped) {
      this.phi = Math.min(PHI_OPEN, this.phi + 3 * dt);
      return;
    }
    const gripFactor = 0.55 + 0.45 * this.strength;
    for (const p of this.held) {
      const t = p.body.translation();
      const v = p.body.linvel();
      const m = p.body.mass();
      const ax = this.pos.x;
      const ay = this.pos.y - 0.3;
      const az = this.pos.z;
      const fx = (60 * (ax - t.x) - 14 * (v.x - this.hubVel.x)) * gripFactor;
      const fy = (70 * (ay - t.y) - 14 * (v.y - this.hubVel.y) + 9.81) * gripFactor;
      const fz = (60 * (az - t.z) - 14 * (v.z - this.hubVel.z)) * gripFactor;
      p.body.applyImpulse({ x: fx * m * dt, y: fy * m * dt, z: fz * m * dt }, true);
    }
  }

  private hubVel = new THREE.Vector3();
  private lastHub = new THREE.Vector3(HOME.x, CLAW.topY, HOME.z);

  /** 把當前狀態寫入剛體與模型 */
  private applyPose() {
    this.hubVel.copy(this.pos).sub(this.lastHub).multiplyScalar(1 / 0.0167);
    this.lastHub.copy(this.pos);
    this.group.position.copy(this.pos);
    this.hubBody.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    for (const p of this.prongs) {
      this.tmpQa.setFromAxisAngle(Y_AXIS, p.azimuth);
      this.tmpQb.setFromAxisAngle(Z_AXIS, this.phi);
      const q = this.tmpQa.clone().multiply(this.tmpQb);
      // 轉軸位置:以爪頭中心為準,向外偏移 HUB_R
      this.tmpV.set(HUB_R, -0.01, 0).applyQuaternion(this.tmpQa);
      p.group.position.copy(this.tmpV);
      p.group.quaternion.copy(q);
      p.body.setNextKinematicTranslation({ x: this.pos.x + this.tmpV.x, y: this.pos.y + this.tmpV.y, z: this.pos.z + this.tmpV.z });
      p.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
  }
}
