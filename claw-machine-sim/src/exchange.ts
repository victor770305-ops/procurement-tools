import * as THREE from 'three';
import type { Customer } from './customers';
import { EXCHANGES, exchangeService, exchangeSlot } from './layout';
import { makeDisplay, neonTexture } from './textures';

export type ExState = 'ok' | 'jam' | 'empty';
export const EX_CAP = 400;
export const EX_LOW = 70;

/** 兌幣機:客人投鈔換代幣;會卡鈔、缺零錢,需要店員處理 */
export class Exchange {
  readonly group = new THREE.Group();
  readonly x: number;
  readonly z: number;
  coins = 320;
  state: ExState = 'ok';
  readonly queue: Customer[] = [];
  using: Customer | null = null;
  useT = 0;
  service: 'fix' | 'refill' | null = null;
  readonly reserved = new Set<string>();
  uses = 0;
  private display = makeDisplay();
  private light: THREE.Mesh;
  private lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2, 0.6), toneMapped: false });

  constructor(readonly index: number, scene: THREE.Object3D) {
    this.x = EXCHANGES[index].x;
    this.z = EXCHANGES[index].z;
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);

    const paint = new THREE.MeshPhysicalMaterial({ color: 0x17606b, roughness: 0.35, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.6, metalness: 0.3 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3ee, roughness: 0.16, metalness: 1 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(1.05, 1.9, 0.75), paint, 0, 0.95, 0);
    add(new THREE.BoxGeometry(1.1, 0.06, 0.8), chrome, 0, 1.92, 0);
    add(new THREE.BoxGeometry(0.9, 0.5, 0.04), dark, 0, 1.42, 0.38);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: this.display.texture, toneMapped: false }));
    scr.position.set(0, 1.43, 0.405);
    this.group.add(scr);
    add(new THREE.BoxGeometry(0.4, 0.06, 0.06), dark, 0, 1.0, 0.39);
    add(new THREE.BoxGeometry(0.36, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 2.2), toneMapped: false }), 0, 1.03, 0.425);
    add(new THREE.BoxGeometry(0.56, 0.24, 0.12), chrome, 0, 0.58, 0.4);
    add(new THREE.BoxGeometry(0.46, 0.14, 0.1), dark, 0, 0.58, 0.43);
    this.light = add(new THREE.SphereGeometry(0.05, 12, 8), this.lightMat, 0.38, 1.78, 0.39);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.36),
      new THREE.MeshBasicMaterial({ map: neonTexture('COINS', '#ffd45e', 640, 200, 'bold 130px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sign.position.set(0, 2.3, 0.1);
    this.group.add(sign);
    this.refresh();
  }

  slot(i: number) {
    return exchangeSlot(this.index, i);
  }
  servicePos() {
    return exchangeService(this.index);
  }
  get usable() {
    return this.state === 'ok' && !this.service;
  }

  setState(s: ExState) {
    this.state = s;
    this.refresh();
  }

  refresh() {
    const label = this.state === 'ok' ? 'COINS' : this.state === 'jam' ? 'JAM' : 'EMPTY';
    this.display.draw(label, String(Math.max(0, Math.floor(this.coins))).padStart(3, '0'));
    if (this.state === 'ok') this.lightMat.color.setRGB(0.2, 2, 0.6);
    else if (this.state === 'jam') this.lightMat.color.setRGB(2.4, 0.2, 0.2);
    else this.lightMat.color.setRGB(2.4, 1.4, 0.1);
  }
}
