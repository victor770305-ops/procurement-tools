import * as THREE from 'three';
import { CHUTE, CLAW, FIELD } from './config';
import type { MachineTheme } from './layout';
import {
  backdropTexture,
  diamondPlateTexture,
  glareTexture,
  makeDisplay,
  marqueeTexture,
  neonTexture,
} from './textures';

function makeMats(accent: number) {
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x14173a, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12 }),
    accent: new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x07070d, roughness: 0.8, metalness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3ee, roughness: 0.16, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.9 }),
  };
}

export class Cabinet {
  readonly group = new THREE.Group();
  readonly spot: THREE.SpotLight;
  private beam!: THREE.Mesh;
  private trolley!: THREE.Mesh;
  private rope!: THREE.Mesh;
  private joyStick = new THREE.Group();
  private joyBall!: THREE.Mesh;
  private dropBtn!: THREE.Mesh;
  private dropMat!: THREE.MeshStandardMaterial;
  private leds!: THREE.InstancedMesh;
  private ledCount = 0;
  private display = makeDisplay();
  private tmpColor = new THREE.Color();

  private mat: ReturnType<typeof makeMats>;

  constructor(shadowSize: number, private theme: MachineTheme) {
    this.mat = makeMats(theme.accent);
    this.buildShell();
    this.buildFloorAndChute();
    this.buildGlass();
    this.buildGantry();
    this.buildDeck();
    this.buildLeds();

    // 機台內部主光源(從頂部往下打,產生柔和陰影)
    this.spot = new THREE.SpotLight(0xfff1dc, 6, 6, 0.95, 0.75, 1.6);
    this.spot.position.set(0.05, 1.56, 0.15);
    this.spot.target.position.set(0, 0, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(shadowSize, shadowSize);
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.02;
    this.spot.shadow.radius = 4;
    this.group.add(this.spot, this.spot.target);

    // 內部補光:一盞主題色點光源
    const tint = new THREE.PointLight(theme.accent, 1.6, 3.2, 2);
    tint.position.set(0, 1.0, 0.5);
    this.group.add(tint);
  }

  private add(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group, shadow = true) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    parent.add(mesh);
    return mesh;
  }

  private box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) {
    return this.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  }

  private buildShell() {
    // 底座外殼(四面牆,中空以便挖出出口)
    this.box(0.1, 0.95, 1.4, this.mat.paint, -0.8, -0.475, 0);
    this.box(0.1, 0.95, 1.4, this.mat.paint, 0.8, -0.475, 0);
    this.box(1.5, 0.95, 0.1, this.mat.paint, 0, -0.475, -0.65);
    this.box(1.5, 0.95, 0.1, this.mat.paint, 0, -0.475, 0.65);
    this.box(1.7, 0.05, 1.4, this.mat.dark, 0, -0.925, 0);
    // 底座粉色飾條
    this.box(1.72, 0.04, 1.42, this.mat.accent, 0, -0.93, 0);

    // 四根角柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box(0.1, 1.6, 0.1, this.mat.paint, sx * 0.8, 0.8, sz * 0.65);
    }
    // 招牌箱
    this.box(1.7, 0.66, 1.4, this.mat.paint, 0, 1.93, 0);
    this.box(1.72, 0.05, 1.42, this.mat.accent, 0, 1.62, 0);
    this.box(1.72, 0.05, 1.42, this.mat.accent, 0, 2.26, 0);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.56, 0.58),
      new THREE.MeshBasicMaterial({ map: marqueeTexture(this.theme.title, this.theme.sub, this.theme.hue), toneMapped: false }),
    );
    sign.position.set(0, 1.94, 0.705);
    this.group.add(sign);
    // 頂部霓虹小字
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.3),
      new THREE.MeshBasicMaterial({ map: neonTexture('PRIZE', '#41e8ff', 1024, 256, 'bold 170px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    neon.position.set(0, 2.45, 0.1);
    neon.rotation.x = -0.25;
    this.group.add(neon);

    // 天花燈板
    const lamp = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.1), toneMapped: false }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 1.595, 0);
    this.group.add(lamp);

    // 後背板
    const back = this.box(1.5, 1.6, 0.04, new THREE.MeshStandardMaterial({ map: backdropTexture(), roughness: 0.5, emissive: 0xffffff, emissiveMap: backdropTexture(), emissiveIntensity: 0.55 }), 0, 0.8, -0.62);
    back.castShadow = false;
  }

  private buildFloorAndChute() {
    const plate = diamondPlateTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: plate, roughness: 0.38, metalness: 0.55 });
    // 與物理地板相同的 L 形(挖掉出口)
    this.box(1.5, 0.1, 0.76, floorMat, 0, -0.05, -0.22);
    this.box(1.07, 0.1, 0.44, floorMat, 0.215, -0.05, 0.38);

    // 出口內部
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x0c0e1c, roughness: 0.9 });
    const cx = (-FIELD.halfX + CHUTE.x1) / 2;
    const cw = CHUTE.x1 + FIELD.halfX;
    const cz = (CHUTE.z0 + FIELD.halfZ) / 2;
    const cd = FIELD.halfZ - CHUTE.z0;
    this.box(cw, 0.05, cd, new THREE.MeshStandardMaterial({ color: 0x2a1740, roughness: 0.7 }), cx, -CHUTE.depth - 0.025, cz);
    this.box(0.03, CHUTE.depth, cd, chuteMat, CHUTE.x1 + 0.015, -CHUTE.depth / 2, cz);
    this.box(cw, CHUTE.depth, 0.03, chuteMat, cx, -CHUTE.depth / 2, CHUTE.z0 + 0.015);
    // 出口擋板
    this.box(0.04, 0.14, cd, this.mat.chrome, CHUTE.x1 + 0.02, 0.07, cz);
    this.box(cw, 0.14, 0.04, this.mat.chrome, cx, 0.07, CHUTE.z0 - 0.02);
    // 出口邊框的發光環
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(cw, cd),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0, 0.5, 0.6), toneMapped: false, transparent: true, opacity: 0.0 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, -0.2, cz);
    this.group.add(ring);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(cw + 0.04, 0.012, 0.012),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.6), toneMapped: false }),
    );
    rim.position.set(cx, 0.146, CHUTE.z0 - 0.02);
    this.group.add(rim);
    const rim2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, cd),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.6), toneMapped: false }),
    );
    rim2.position.set(CHUTE.x1 + 0.02, 0.146, cz);
    this.group.add(rim2);
    
  }

  private buildGlass() {
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xdde9ff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      envMapIntensity: 2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), glass);
    front.position.set(0, 0.8, 0.62);
    this.group.add(front);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), glass);
      side.rotation.y = Math.PI / 2;
      side.position.set(s * 0.77, 0.8, 0);
      this.group.add(side);
    }
    // 假反光條
    const glareMat = new THREE.MeshBasicMaterial({
      map: glareTexture(),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), glareMat);
    glare.position.set(0, 0.8, 0.625);
    glare.renderOrder = 5;
    this.group.add(glare);
  }

  private buildGantry() {
    // 兩側軌道
    for (const s of [-1, 1]) {
      this.add(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 12), this.mat.chrome, s * 0.7, CLAW.gantryY, 0, this.group, false).rotation.x = Math.PI / 2;
    }
    this.beam = this.box(1.5, 0.06, 0.08, this.mat.chrome, 0, CLAW.gantryY, 0);
    this.trolley = this.box(0.16, 0.11, 0.14, this.mat.accent, 0, CLAW.gantryY - 0.02, 0);
    this.rope = this.add(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), this.mat.rubber, 0, 1, 0, this.group, true);
  }

  private buildDeck() {
    // 底座前方的操作台
    this.box(1.7, 0.78, 0.42, this.mat.paint, 0, -0.56, 0.91);
    const plate = new THREE.Group();
    plate.position.set(0, -0.14, 0.9);
    plate.rotation.x = 0.3;
    this.group.add(plate);
    this.box(1.7, 0.06, 0.46, this.mat.accent, 0, 0, 0, plate);
    this.box(1.5, 0.062, 0.36, new THREE.MeshPhysicalMaterial({ color: 0x0f1230, roughness: 0.4, metalness: 0.3, clearcoat: 1 }), 0, 0.001, 0, plate);

    // 搖桿
    const jx = 0.3;
    this.add(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 32), this.mat.chrome, jx, 0.04, 0, plate);
    this.joyStick.position.set(jx, 0.05, 0);
    plate.add(this.joyStick);
    const shaft = this.add(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 12), this.mat.chrome, 0, 0.085, 0, this.joyStick);
    const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xe5173f, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.joyBall = this.add(new THREE.SphereGeometry(0.048, 32, 24), ballMat, 0, 0.19, 0, this.joyStick);
    shaft.castShadow = true;

    // 抓取按鈕
    const bx = 0.62;
    this.add(new THREE.CylinderGeometry(0.095, 0.1, 0.04, 40), this.mat.chrome, bx, 0.04, 0, plate);
    this.dropMat = new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff1010, emissiveIntensity: 0.25, roughness: 0.25 });
    this.dropBtn = this.add(new THREE.CylinderGeometry(0.075, 0.08, 0.045, 40), this.dropMat, bx, 0.075, 0, plate);

    // 投幣孔 + 螢幕
    this.box(0.09, 0.012, 0.14, this.mat.dark, -0.4, 0.034, 0.1, plate);
    this.box(0.012, 0.014, 0.1, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.2), toneMapped: false }), -0.4, 0.04, 0.1, plate);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.128), new THREE.MeshBasicMaterial({ map: this.display.texture, toneMapped: false }));
    scr.rotation.x = -Math.PI / 2;
    scr.position.set(-0.4, 0.0345, -0.1);
    plate.add(scr);
    this.setDisplay('CREDIT', '000');

    // 前方取物口
    this.box(0.5, 0.36, 0.02, this.mat.dark, -0.55, -0.62, 1.12);
    const flap = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.3),
      new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.25, roughness: 0.1, clearcoat: 1 }),
    );
    flap.position.set(-0.55, -0.62, 1.125);
    this.group.add(flap);
    this.box(0.54, 0.02, 0.03, this.mat.accent, -0.55, -0.43, 1.12);
    this.box(0.54, 0.02, 0.03, this.mat.accent, -0.55, -0.81, 1.12);
  }

  private buildLeds() {
    const pts: THREE.Vector3[] = [];
    // 前方兩根角柱內緣
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 16; i++) pts.push(new THREE.Vector3(sx * 0.747, 0.05 + i * 0.1, 0.598));
    }
    // 招牌下緣
    for (let i = 0; i < 16; i++) pts.push(new THREE.Vector3(-0.72 + i * 0.096, 1.575, 0.598));
    // 底座上緣
    for (let i = 0; i < 16; i++) pts.push(new THREE.Vector3(-0.72 + i * 0.096, 0.01, 0.598));
    // 側邊
    for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) pts.push(new THREE.Vector3(sx * 0.747, 1.575, -0.5 + i * 0.1));
    this.ledCount = pts.length;
    this.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.05, 0.022), new THREE.MeshBasicMaterial({ toneMapped: false }), this.ledCount);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      this.leds.setMatrixAt(i, m);
      this.leds.setColorAt(i, this.tmpColor.setRGB(1, 1, 1));
    });
    this.group.add(this.leds);
  }

  setDisplay(label: string, value: string) {
    this.display.draw(label, value);
  }

  /** 搖桿頂端 / 按鈕的世界座標(給顧客的手伸向) */
  joystickWorld(out: THREE.Vector3) {
    return this.joyBall.getWorldPosition(out);
  }
  buttonWorld(out: THREE.Vector3) {
    return this.dropBtn.getWorldPosition(out);
  }

  /** 設定爪頭位置,同步橫樑、台車與吊繩 */
  setClawPos(x: number, y: number, z: number) {
    this.beam.position.z = z;
    this.trolley.position.set(x, CLAW.gantryY - 0.02, z);
    const top = CLAW.gantryY - 0.07;
    const bottom = y + 0.06;
    const len = Math.max(0.01, top - bottom);
    this.rope.scale.set(1, len, 1);
    this.rope.position.set(x, bottom + len / 2, z);
  }

  /** @param joy 搖桿輸入 (-1..1) @param armed 是否可操作(按鈕閃爍) */
  update(t: number, joy: { x: number; z: number }, armed: boolean) {
    // 搖桿傾斜
    this.joyStick.rotation.z += (-joy.x * 0.35 - this.joyStick.rotation.z) * 0.25;
    this.joyStick.rotation.x += (joy.z * 0.35 - this.joyStick.rotation.x) * 0.25;
    // 按鈕脈動
    const pulse = armed ? 0.6 + 0.5 * Math.sin(t * 7) : 0.15;
    this.dropMat.emissiveIntensity = pulse;
    // LED 流水燈(彩虹)
    for (let i = 0; i < this.ledCount; i++) {
      const h = (t * 0.12 + i * 0.022) % 1;
      this.tmpColor.setHSL(h, 1, 0.5).multiplyScalar(2.4);
      this.leds.setColorAt(i, this.tmpColor);
    }
    this.leds.instanceColor!.needsUpdate = true;
  }
}
