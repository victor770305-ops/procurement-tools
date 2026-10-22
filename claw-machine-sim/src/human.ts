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
}
export type Pose = 'idle' | 'walk' | 'play' | 'cheer' | 'sad' | 'wave';

const cloth = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
const skinMat = (c: number) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffd5c0) });
const dark = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.4 });
const sole = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });

const DOWN = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** 低多邊形寫實比例的人物,原點在腳底,臉朝 +z */
export class Human {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  private upper = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private carryBox!: THREE.Mesh;
  private carrying = false;
  private phase = Math.random() * 6;
  private bob = 0;

  constructor(o: HumanOpts) {
    const skin = skinMat(o.skin);
    const shirt = cloth(o.shirt);
    const pants = cloth(o.pants);
    const hair = cloth(o.hair);
    const body = new THREE.Group();
    this.group.add(body);
    body.scale.setScalar(o.scale);

    const part = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = !isMobile;
      mesh.receiveShadow = true;
      p.add(mesh);
      return mesh;
    };

    // 腿
    for (const [leg, s] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(s * 0.09, 0.88, 0);
      body.add(leg);
      part(new THREE.CapsuleGeometry(0.075, 0.68, 6, 12), pants, leg, 0, -0.42, 0);
      part(new THREE.BoxGeometry(0.11, 0.07, 0.24), sole, leg, 0, -0.84, 0.05);
    }

    // 上半身(可前傾)
    this.upper.position.set(0, 0.88, 0);
    body.add(this.upper);
    part(new THREE.CapsuleGeometry(0.17, 0.34, 6, 14), shirt, this.upper, 0, 0.3, 0).scale.set(1, 1, 0.72);

    // 手臂
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.22, 0.56, 0);
      this.upper.add(arm);
      part(new THREE.CapsuleGeometry(0.052, 0.46, 6, 10), shirt, arm, 0, -0.29, 0);
      part(new THREE.SphereGeometry(0.058, 14, 10), skin, arm, 0, -0.6, 0);
    }

    // 頭
    this.head.position.set(0, 0.8, 0);
    this.upper.add(this.head);
    const hs = o.kid ? 1.3 : 1;
    this.head.scale.setScalar(hs);
    part(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, this.upper, 0, 0.62, 0);
    part(new THREE.SphereGeometry(0.115, 24, 18), skin, this.head, 0, 0, 0).scale.set(0.95, 1.08, 1);
    const hairCap = part(new THREE.SphereGeometry(0.12, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, this.head, 0, 0.01, -0.01);
    hairCap.rotation.x = -0.25;
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.012, 8, 6), dark, this.head, s * 0.045, 0.015, 0.108);

    if (o.accessory === 'backpack') {
      part(new THREE.BoxGeometry(0.3, 0.36, 0.14), cloth(0xe0553a), this.upper, 0, 0.34, -0.17);
    } else if (o.accessory === 'cap') {
      const cap = part(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth(0x1b1f2a), this.head, 0, 0.035, 0);
      cap.rotation.x = -0.1;
      part(new THREE.BoxGeometry(0.16, 0.012, 0.11), cloth(0x1b1f2a), this.head, 0, 0.04, 0.12);
    } else if (o.accessory === 'staff') {
      // 圍裙與鴨舌帽
      part(new THREE.BoxGeometry(0.31, 0.44, 0.02), cloth(0xf4f1ea), this.upper, 0, 0.27, 0.135);
      part(new THREE.BoxGeometry(0.1, 0.05, 0.015), cloth(0xff3d9a), this.upper, 0.08, 0.42, 0.15);
      const cap = part(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), cloth(0xff3d9a), this.head, 0, 0.035, 0);
      cap.rotation.x = -0.1;
      part(new THREE.BoxGeometry(0.16, 0.012, 0.11), cloth(0xff3d9a), this.head, 0, 0.04, 0.12);
    } else if (o.accessory === 'bow') {
      for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.045, 12, 10), cloth(0xff5fa2), this.head, s * 0.105, 0.07, -0.01);
    }

    // 搬運用的箱子(平常隱藏)
    this.carryBox = part(new THREE.BoxGeometry(0.34, 0.24, 0.3), cloth(0xc89a5b), this.upper, 0, 0.3, 0.36);
    this.carryBox.visible = false;
  }

  setCarry(on: boolean) {
    this.carrying = on;
    this.carryBox.visible = on;
  }

  /** 世界座標的視線/頭頂位置(給對話泡泡) */
  headWorld(out: THREE.Vector3) {
    return this.head.getWorldPosition(out).add(tmpV.set(0, 0.28, 0));
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
    this.upper.position.y = 0.88 + this.bob;
    this.upper.rotation.x += (lean - this.upper.rotation.x) * k;
    this.head.rotation.x += (headX - this.head.rotation.x) * k;
    this.group.position.y = pose === 'cheer' ? this.bob : 0;
  }
}
