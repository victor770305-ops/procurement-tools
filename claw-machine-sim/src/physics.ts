import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CHUTE, FIELD, Rarity } from './config';
import { PLUSH_COST, StockItem } from './economy';
import { buildPlush, pickRarity, PLUSH_BODY_R, PLUSH_HEAD_R, PLUSH_HEAD_Y, PLUSH_TYPES, PlushType, typeById } from './plush';

export interface PlushEntity {
  id: number;
  type: PlushType;
  rarity: Rarity;
  cost: number;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  won: boolean;
  wonAt: number;
}

export class Physics {
  readonly world: RAPIER.World;
  readonly plushes: PlushEntity[] = [];
  private nextId = 1;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.buildStatic();
  }

  private fixed(hx: number, hy: number, hz: number, x: number, y: number, z: number, friction = 0.8) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction).setRestitution(0.05), body);
  }

  private buildStatic() {
    const { halfX, halfZ } = FIELD;
    // 地板(挖掉出口)
    this.fixed(halfX, 0.05, (CHUTE.z0 + halfZ) / 2, 0, -0.05, (-halfZ + CHUTE.z0) / 2);
    const bw = (halfX - CHUTE.x1) / 2;
    this.fixed(bw, 0.05, (halfZ - CHUTE.z0) / 2, CHUTE.x1 + bw, -0.05, (CHUTE.z0 + halfZ) / 2);
    // 出口底部與內壁
    const cw = (CHUTE.x1 + halfX) / 2;
    const cd = (halfZ - CHUTE.z0) / 2;
    this.fixed(cw, 0.05, cd, -halfX + cw, -CHUTE.depth - 0.05, CHUTE.z0 + cd);
    this.fixed(0.02, CHUTE.depth / 2, cd, CHUTE.x1 + 0.02, -CHUTE.depth / 2, CHUTE.z0 + cd);
    this.fixed(cw, CHUTE.depth / 2, 0.02, -halfX + cw, -CHUTE.depth / 2, CHUTE.z0 - 0.02);
    // 出口矮擋板:娃娃要被夾到出口上方放開才算數,不能被推進去
    this.fixed(0.02, 0.07, cd, CHUTE.x1 + 0.02, 0.07, CHUTE.z0 + cd, 0.4);
    this.fixed(cw, 0.07, 0.02, -halfX + cw, 0.07, CHUTE.z0 - 0.02, 0.4);
    // 四周玻璃 / 背板
    const h = FIELD.height / 2 + CHUTE.depth / 2;
    const cy = FIELD.height / 2 - CHUTE.depth / 2;
    this.fixed(0.02, h, halfZ + 0.05, -halfX - 0.02, cy, 0, 0.1);
    this.fixed(0.02, h, halfZ + 0.05, halfX + 0.02, cy, 0, 0.1);
    this.fixed(halfX + 0.05, h, 0.02, 0, cy, -halfZ - 0.02, 0.1);
    this.fixed(halfX + 0.05, h, 0.02, 0, cy, halfZ + 0.02, 0.1);
    // 天花板
    this.fixed(halfX, 0.05, halfZ, 0, FIELD.height + 0.05, 0, 0.1);
  }

  /** 建立一隻娃娃並加入物理世界 */
  spawnPlush(x: number, y: number, z: number, type?: PlushType, rarity?: Rarity): PlushEntity {
    type = type ?? PLUSH_TYPES[Math.floor(Math.random() * PLUSH_TYPES.length)];
    rarity = rarity ?? pickRarity();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.35)
        .setAngularDamping(1.4),
    );
    const common = (d: RAPIER.ColliderDesc) => d.setDensity(28).setFriction(0.9).setRestitution(0.08);
    this.world.createCollider(common(RAPIER.ColliderDesc.ball(PLUSH_BODY_R)), body);
    this.world.createCollider(common(RAPIER.ColliderDesc.ball(PLUSH_HEAD_R)).setTranslation(0, PLUSH_HEAD_Y, 0.01), body);
    const mesh = buildPlush(type, rarity);
    const e: PlushEntity = { id: this.nextId++, type, rarity, cost: PLUSH_COST[rarity], mesh, body, won: false, wonAt: 0 };
    this.plushes.push(e);
    return e;
  }

  /** 開局時讓娃娃從上方陸續掉落、堆疊靜止 */
  fillItems(items: StockItem[]) {
    const spawned: PlushEntity[] = [];
    for (let i = 0; i < items.length; i++) {
      let x = 0;
      let z = 0;
      do {
        x = (Math.random() * 2 - 1) * (FIELD.halfX - 0.14);
        z = (Math.random() * 2 - 1) * (FIELD.halfZ - 0.14);
      } while (x < CHUTE.x1 + 0.3 && z > CHUTE.z0 - 0.3);
      spawned.push(this.spawnPlush(x, 0.6 + (i % 3) * 0.3, z, typeById(items[i].typeId), items[i].rarity));
      for (let s = 0; s < 8; s++) this.world.step();
    }
    for (let s = 0; s < 420; s++) this.world.step();
    // 掉進出口的娃娃不算開局庫存
    for (const p of [...this.plushes]) if (p.body.translation().y < -0.1) this.remove(p);
    for (const p of spawned) {
      if (!this.plushes.includes(p)) continue;
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    }
  }

  /** 補貨:從上方丟入新娃娃,回傳新實體(呼叫端負責加入場景) */
  dropIn(items: StockItem[]): PlushEntity[] {
    return items.map((it, i) => {
      let x = 0;
      let z = 0;
      do {
        x = (Math.random() * 2 - 1) * (FIELD.halfX - 0.14);
        z = (Math.random() * 2 - 1) * (FIELD.halfZ - 0.14);
      } while (x < CHUTE.x1 + 0.3 && z > CHUTE.z0 - 0.3);
      return this.spawnPlush(x, 0.95 + i * 0.12, z, typeById(it.typeId), it.rarity);
    });
  }

  stockItems(): StockItem[] {
    return this.plushes.filter((p) => !p.won).map((p) => ({ typeId: p.type.id, rarity: p.rarity }));
  }

  syncMeshes() {
    for (const p of this.plushes) {
      const t = p.body.translation();
      const r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  remove(p: PlushEntity) {
    this.world.removeRigidBody(p.body);
    const i = this.plushes.indexOf(p);
    if (i >= 0) this.plushes.splice(i, 1);
  }

  /** 偵測掉進出口的娃娃,回傳本幀新中獎者 */
  detectWins(now: number): PlushEntity[] {
    const won: PlushEntity[] = [];
    for (const p of this.plushes) {
      if (p.won) continue;
      const t = p.body.translation();
      if (t.y < -0.2 && t.x < CHUTE.x1 && t.z > CHUTE.z0) {
        p.won = true;
        p.wonAt = now;
        won.push(p);
      }
    }
    return won;
  }
}
