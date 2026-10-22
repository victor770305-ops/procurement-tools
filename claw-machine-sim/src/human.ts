import * as THREE from 'three';
import { isMobile } from './render';

export interface HumanOpts {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  scale: number;
  kid: boolean;
  accessory: 'none' | 'backpack' | 'cap' | 'bow' | 'staff';
  sleeve?: 'short' | 'long';
  hairStyle?: 'short' | 'long' | 'pony' | 'bun';
  glasses?: boolean;
  shoes?: number;
  skirt?: boolean;
}
export type Pose = 'idle' | 'walk' | 'play' | 'cheer' | 'sad' | 'wave' | 'fall';

const matCache = new Map<string, THREE.Material>();
const cloth = (c: number) => {
  const k = `c${c}`;
  let m = matCache.get(k);
  if (!m) matCache.set(k, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 })));
  return m;
};
const skinMat = (c: number) => {
  const k = `s${c}`;
  let m = matCache.get(k);
  if (!m) matCache.set(k, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.62 })));
  return m;
};
const hairMat = (c: number) => {
  const k = `h${c}`;
  let m = matCache.get(k);
  if (!m) matCache.set(k, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 })));
  return m;
};
const dark = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.4 });
const soleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.3, metalness: 0.6 });

const DOWN = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** 寫實比例的低多邊形人物(約 1.72 公尺),原點在腳底,臉朝 +z */
export class Human {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  private rig = new THREE.Group();
  private low: THREE.Group;
  private upper = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private carryBox!: THREE.Mesh;
  private carrying = false;
  private phase = Math.random() * 6;
  private bob = 0;
  private lowMode = false;
  private fallT = 0;
  private height = 1.72;

  constructor(o: HumanOpts) {
    const skin = skinMat(o.skin);
    const shirt = cloth(o.shirt);
    const pants = cloth(o.pants);
    const hair = hairMat(o.hair);
    const shoeMat = cloth(o.shoes ?? 0x1c1c22);
    const long = (o.sleeve ?? 'short') === 'long';
    this.group.add(this.rig);
    this.rig.scale.setScalar(o.scale);
    this.height = 1.72 * o.scale;

    const seg = isMobile ? 8 : 12;
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = !isMobile;
      mesh.receiveShadow = true;
      p.add(mesh);
      return mesh;
    };

    // ---- 腿與鞋 ----
    for (const [leg, s] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(s * 0.095, 0.92, 0);
      this.rig.add(leg);
      part(new THREE.CapsuleGeometry(0.08, 0.7, 5, seg), pants, leg, 0, -0.44, 0);
      part(new THREE.BoxGeometry(0.115, 0.075, 0.27), shoeMat, leg, 0, -0.9, 0.06);
      part(new THREE.BoxGeometry(0.118, 0.02, 0.275), soleMat, leg, 0, -0.945, 0.06);
    }
    if (o.skirt) part(new THREE.CylinderGeometry(0.17, 0.23, 0.28, seg * 2, 1, true), pants, this.rig, 0, 0.82, 0);

    // ---- 上半身 ----
    this.upper.position.set(0, 0.92, 0);
    this.rig.add(this.upper);
    part(new THREE.CapsuleGeometry(0.165, 0.34, 6, seg * 2), shirt, this.upper, 0, 0.3, 0).scale.set(1.08, 1, 0.74);
    part(new THREE.SphereGeometry(0.11, seg, seg), shirt, this.upper, -0.2, 0.58, 0).scale.set(1, 0.9, 1);
    part(new THREE.SphereGeometry(0.11, seg, seg), shirt, this.upper, 0.2, 0.58, 0).scale.set(1, 0.9, 1);

    // ---- 手臂(短袖:上臂衣色,前臂膚色) ----
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.235, 0.57, 0);
      this.upper.add(arm);
      part(new THREE.CapsuleGeometry(0.052, long ? 0.46 : 0.2, 5, seg), shirt, arm, 0, long ? -0.28 : -0.15, 0);
      if (!long) part(new THREE.CapsuleGeometry(0.044, 0.22, 5, seg), skin, arm, 0, -0.4, 0);
      part(new THREE.SphereGeometry(0.052, seg, 8), skin, arm, 0, -0.6, 0);
    }

    // ---- 頭、頸、臉 ----
    this.head.position.set(0, 0.84, 0);
    this.upper.add(this.head);
    const hs = o.kid ? 1.28 : 1;
    this.head.scale.setScalar(hs);
    part(new THREE.CylinderGeometry(0.048, 0.055, 0.12, seg), skin, this.upper, 0, 0.66, 0);
    part(new THREE.SphereGeometry(0.112, seg * 2, seg + 4), skin, this.head, 0, 0, 0).scale.set(0.92, 1.12, 1.02);
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.014, 8, 6), dark, this.head, s * 0.04, 0.012, 0.108);
      part(new THREE.SphereGeometry(0.026, 8, 6), skin, this.head, s * 0.108, -0.005, 0).scale.set(0.5, 1, 0.8);
    }
    part(new THREE.SphereGeometry(0.018, 8, 6), skin, this.head, 0, -0.02, 0.118);
    const style = o.hairStyle ?? 'short';
    const cap = part(new THREE.SphereGeometry(0.118, seg * 2, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, this.head, 0, 0.015, -0.012);
    cap.rotation.x = -0.25;
    if (style === 'long') part(new THREE.CapsuleGeometry(0.1, 0.22, 4, seg), hair, this.head, 0, -0.1, -0.075).scale.set(1.05, 1, 0.55);
    else if (style === 'pony') part(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), hair, this.head, 0, -0.06, -0.15);
    else if (style === 'bun') part(new THREE.SphereGeometry(0.055, 8, 8), hair, this.head, 0, 0.12, -0.07);
    if (o.glasses) {
      for (const s of [-1, 1]) {
        const r = part(new THREE.TorusGeometry(0.03, 0.005, 6, 14), frameMat, this.head, s * 0.042, 0.014, 0.112);
        r.castShadow = false;
      }
      part(new THREE.BoxGeometry(0.03, 0.005, 0.005), frameMat, this.head, 0, 0.02, 0.114).castShadow = false;
    }

    // ---- 配件 ----
    if (o.accessory === 'backpack') {
      part(new THREE.BoxGeometry(0.3, 0.38, 0.14), cloth(0xcf4a2f), this.upper, 0, 0.34, -0.19);
      for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.035, 0.34, 0.02), cloth(0x222226), this.upper, s * 0.1, 0.38, 0.12);
    } else if (o.accessory === 'cap') {
      const c = part(new THREE.SphereGeometry(0.128, seg * 2, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth(0x1b1f2a), this.head, 0, 0.035, 0);
      c.rotation.x = -0.1;
      part(new THREE.BoxGeometry(0.16, 0.012, 0.11), cloth(0x1b1f2a), this.head, 0, 0.04, 0.12);
    } else if (o.accessory === 'staff') {
      part(new THREE.BoxGeometry(0.31, 0.42, 0.02), cloth(0x2c3e5c), this.upper, 0, 0.26, 0.135);
      part(new THREE.BoxGeometry(0.09, 0.04, 0.012), cloth(0xe9eef7), this.upper, 0.08, 0.42, 0.15);
      const c = part(new THREE.SphereGeometry(0.128, seg * 2, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth(0xd9467f), this.head, 0, 0.035, 0);
      c.rotation.x = -0.1;
      part(new THREE.BoxGeometry(0.16, 0.012, 0.11), cloth(0xd9467f), this.head, 0, 0.04, 0.12);
    } else if (o.accessory === 'bow') {
      for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.045, 10, 8), cloth(0xff5fa2), this.head, s * 0.105, 0.075, -0.01);
    }

    // 搬運用的箱子(平常隱藏)
    this.carryBox = part(new THREE.BoxGeometry(0.34, 0.24, 0.3), cloth(0xc89a5b), this.upper, 0, 0.3, 0.36);
    this.carryBox.visible = false;

    // ---- 遠景用的簡化人形(3 個網格) ----
    this.low = new THREE.Group();
    this.group.add(this.low);
    const legsLow = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.62, 3, 8), pants);
    legsLow.position.y = 0.42 * o.scale;
    legsLow.scale.setScalar(o.scale);
    const torsoLow = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.4, 3, 8), shirt);
    torsoLow.position.y = 1.2 * o.scale;
    torsoLow.scale.set(o.scale * 1.08, o.scale, o.scale * 0.8);
    const headLow = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), skin);
    headLow.position.y = 1.62 * o.scale;
    headLow.scale.setScalar(o.scale * (o.kid ? 1.28 : 1));
    this.low.add(legsLow, torsoLow, headLow);
    this.low.visible = false;
  }

  /** 遠景時只畫簡化人形,近景才畫完整人物 */
  setLod(low: boolean) {
    if (low === this.lowMode) return;
    this.lowMode = low;
    this.rig.visible = !low;
    this.low.visible = low;
  }

  /** 腳下的光圈,讓遠景也分得出店員 */
  setBadge(color: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.56, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.group.add(ring);
  }

  setCarry(on: boolean) {
    this.carrying = on;
    this.carryBox.visible = on;
  }

  /** 世界座標的頭頂位置(給對話泡泡) */
  headWorld(out: THREE.Vector3) {
    this.group.getWorldPosition(out);
    out.y += this.height + 0.22;
    return out;
  }

  private pointArm(arm: THREE.Group, targetWorld: THREE.Vector3, k: number) {
    arm.parent!.updateWorldMatrix(true, false);
    const local = arm.parent!.worldToLocal(tmpV.copy(targetWorld)).sub(arm.position);
    if (local.lengthSq() < 1e-6) return;
    tmpQ.setFromUnitVectors(DOWN, local.normalize());
    arm.quaternion.slerp(tmpQ, k);
  }

  private armTo(arm: THREE.Group, dir: THREE.Vector3, k: number) {
    tmpQ.setFromUnitVectors(DOWN, dir.normalize());
    arm.quaternion.slerp(tmpQ, k);
  }

  update(dt: number, pose: Pose, reach?: { l: THREE.Vector3; r: THREE.Vector3 }) {
    if (this.lowMode) {
      // 遠景只做簡單的上下起伏與倒地
      if (pose === 'walk') this.phase += dt * 7;
      const bob = pose === 'walk' ? Math.abs(Math.sin(this.phase)) * 0.03 : pose === 'cheer' ? Math.abs(Math.sin((this.phase += dt * 9))) * 0.12 : 0;
      this.low.position.y += (bob - this.low.position.y) * Math.min(1, dt * 10);
      this.fallT += ((pose === 'fall' ? 1 : 0) - this.fallT) * Math.min(1, dt * 8);
      this.low.rotation.x = -this.fallT * 1.4;
      return;
    }
    const k = Math.min(1, dt * 10);
    let bob = 0;
    let lean = 0;
    let headX = 0;
    let legSwing = 0;

    if (pose === 'walk') {
      this.phase += dt * 7;
      legSwing = Math.sin(this.phase) * 0.62;
      bob = Math.abs(Math.sin(this.phase)) * 0.035;
      lean = 0.06;
      if (this.carrying) {
        this.armTo(this.armL, tmpV.set(0.25, -0.35, 1), k);
        this.armTo(this.armR, tmpV.set(-0.25, -0.35, 1), k);
      } else {
        this.armTo(this.armL, tmpV.set(0, -1, Math.sin(this.phase) * 0.55 + 0.05), k);
        this.armTo(this.armR, tmpV.set(0, -1, -Math.sin(this.phase) * 0.55 + 0.05), k);
      }
    } else if (pose === 'play' && reach) {
      this.phase += dt;
      lean = 0.2;
      this.pointArm(this.armL, reach.l, k);
      this.pointArm(this.armR, reach.r, k);
      headX = 0.08;
    } else if (pose === 'cheer') {
      this.phase += dt * 9;
      bob = Math.abs(Math.sin(this.phase)) * 0.14;
      this.armTo(this.armL, tmpV.set(-0.35, 1, 0.2), k);
      this.armTo(this.armR, tmpV.set(0.35, 1, 0.2), k);
    } else if (pose === 'wave') {
      this.phase += dt * 6;
      this.armTo(this.armR, tmpV.set(0.45 + Math.sin(this.phase * 2) * 0.35, 1, 0.1), k);
      this.armTo(this.armL, tmpV.set(-0.08, -1, 0.04), k);
    } else if (pose === 'sad') {
      lean = 0.16;
      headX = 0.4;
      this.armTo(this.armL, tmpV.set(-0.05, -1, 0.1), k);
      this.armTo(this.armR, tmpV.set(0.05, -1, 0.1), k);
    } else if (pose === 'fall') {
      this.armTo(this.armL, tmpV.set(-0.9, 0.2, 0.3), k);
      this.armTo(this.armR, tmpV.set(0.9, 0.2, 0.3), k);
    } else {
      this.phase += dt * 1.6;
      bob = Math.sin(this.phase) * 0.006;
      if (this.carrying) {
        this.armTo(this.armL, tmpV.set(0.25, -0.35, 1), k);
        this.armTo(this.armR, tmpV.set(-0.25, -0.35, 1), k);
      } else {
        this.armTo(this.armL, tmpV.set(-0.08, -1, 0.04), k);
        this.armTo(this.armR, tmpV.set(0.08, -1, 0.04), k);
      }
    }
    this.legL.rotation.x += (legSwing - this.legL.rotation.x) * k;
    this.legR.rotation.x += (-legSwing - this.legR.rotation.x) * k;
    this.bob += (bob - this.bob) * k;
    this.upper.position.y = 0.92 + this.bob;
    this.upper.rotation.x += (lean - this.upper.rotation.x) * k;
    this.head.rotation.x += (headX - this.head.rotation.x) * k;
    this.group.position.y = pose === 'cheer' ? this.bob : 0;
    this.fallT += ((pose === 'fall' ? 1 : 0) - this.fallT) * Math.min(1, dt * 8);
    this.rig.rotation.x = -this.fallT * 1.45;
    this.rig.position.y = this.fallT * 0.2;
  }
}
