import * as THREE from 'three';
import { CAGE_SCALE, CHUTE, CLAW, FIELD, PLAY_Y, SHELL } from './config';
import type { MachineTheme } from './layout';
import { backdropTexture, feltTexture, glareTexture, makeDisplay, marqueeTexture, neonTexture, panelTexture } from './textures';

const W = SHELL.w;
const D = SHELL.d;
const FRAME = 0.07;

function makeMats(accent: number) {
  const base = new THREE.Color(accent);
  return {
    body: new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.38, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    trim: new THREE.MeshPhysicalMaterial({ color: base.clone().multiplyScalar(0.78), roughness: 0.4, metalness: 0.08, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    light: new THREE.MeshPhysicalMaterial({ color: base.clone().lerp(new THREE.Color(0xffffff), 0.35), roughness: 0.35, clearcoat: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.7, metalness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3ee, roughness: 0.16, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.9 }),
  };
}

/** 台灣標準機型:黃色外框、上半玻璃櫃、下半印花櫃身、側邊投幣箱、底下輪子。
 *  夾物區(物理、爪子、娃娃)放在縮放過的 cage 裡,外殼用真實公尺尺寸。 */
export class Cabinet {
  /** 世界座標,y = 0 為地面 */
  readonly group = new THREE.Group();
  /** 夾物區:縮放 CAGE_SCALE,原點在夾物區地板中心(玩家看到的娃娃與爪子都掛在這裡) */
  readonly cage = new THREE.Group();
  readonly spot: THREE.SpotLight;
  private mat: ReturnType<typeof makeMats>;
  private beam!: THREE.Mesh;
  private trolley!: THREE.Mesh;
  private rope!: THREE.Mesh;
  private joyStick = new THREE.Group();
  private dropMat!: THREE.MeshStandardMaterial;
  private display = makeDisplay();

  constructor(shadowSize: number, private theme: MachineTheme) {
    this.mat = makeMats(theme.accent);
    this.cage.position.y = PLAY_Y;
    this.cage.scale.setScalar(CAGE_SCALE);
    this.group.add(this.cage);
    this.buildShell();
    this.buildCoinBox();
    this.buildCage();

    // 夾物區內主光源:從頂部往下打,產生柔和陰影(位置在 cage 座標)
    this.spot = new THREE.SpotLight(0xfff1dc, 1.7, 3, 0.95, 0.75, 1.6);
    this.spot.position.set(0.05, 1.56, 0.15);
    this.spot.target.position.set(0, 0, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(shadowSize, shadowSize);
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.02;
    this.spot.shadow.radius = 4;
    this.cage.add(this.spot, this.spot.target);
    const tint = new THREE.PointLight(0xffe1ee, 0.45, 1.6, 2);
    tint.position.set(0, 0.9, 0.5);
    this.cage.add(tint);
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

  // ---------- 外殼(公尺) ----------
  private buildShell() {
    const m = this.mat;
    // 輪子與底座
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = this.add(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16), m.rubber, sx * (W / 2 - 0.08), 0.05, sz * (D / 2 - 0.08));
      wheel.rotation.z = Math.PI / 2;
      this.add(new THREE.CylinderGeometry(0.018, 0.018, 0.045, 10), m.chrome, sx * (W / 2 - 0.08), 0.09, sz * (D / 2 - 0.08));
    }
    this.box(W - 0.05, 0.06, D - 0.05, m.dark, 0, 0.1, 0);

    // 下半櫃身 + 頂面
    this.box(W, 0.8, D, m.body, 0, 0.53, 0);
    this.box(W + 0.02, 0.06, D + 0.02, m.trim, 0, PLAY_Y - 0.03, 0);

    // 印花面板(前、左、右)
    const panel = new THREE.MeshStandardMaterial({ map: panelTexture(this.theme.hue, this.theme.mascot), roughness: 0.45, metalness: 0 });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, 0.64), panel);
    front.position.set(0, 0.53, D / 2 + 0.002);
    this.group.add(front);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.08, 0.64), panel);
      side.rotation.y = s * Math.PI / 2;
      side.position.set(s * (W / 2 + 0.002), 0.53, 0);
      this.group.add(side);
    }

    // 取物口(左前)
    this.box(0.22, 0.17, 0.02, m.dark, -0.24, 0.8, D / 2 + 0.006);
    const flap = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.15),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.3, roughness: 0.1, clearcoat: 1 }),
    );
    flap.position.set(-0.24, 0.8, D / 2 + 0.018);
    this.group.add(flap);
    const prize = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.05),
      new THREE.MeshBasicMaterial({ map: neonTexture('PRIZE', '#ffffff', 256, 64, 'bold 46px "Arial Black", sans-serif'), transparent: true, toneMapped: false, depthWrite: false }),
    );
    prize.position.set(-0.24, 0.9, D / 2 + 0.012);
    this.group.add(prize);

    // 玻璃櫃外框:四根立柱 + 上方橫樑
    const top = PLAY_Y + FIELD.height * CAGE_SCALE;
    const postH = top - PLAY_Y;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(FRAME, postH, FRAME, m.body, sx * (W / 2 - FRAME / 2), PLAY_Y + postH / 2, sz * (D / 2 - FRAME / 2));
    this.box(W, 0.06, FRAME, m.body, 0, top - 0.03, D / 2 - FRAME / 2);
    this.box(W, 0.06, FRAME, m.body, 0, top - 0.03, -D / 2 + FRAME / 2);
    for (const sx of [-1, 1]) this.box(FRAME, 0.06, D, m.body, sx * (W / 2 - FRAME / 2), top - 0.03, 0);

    // 頂部招牌
    this.box(W + 0.02, 0.28, D + 0.02, m.trim, 0, top + 0.14, 0);
    const sign = new THREE.MeshBasicMaterial({ map: marqueeTexture(this.theme.title, this.theme.sub, this.theme.hue), toneMapped: false });
    const front2 = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.23), sign);
    front2.position.set(0, top + 0.14, D / 2 + 0.014);
    this.group.add(front2);
    for (const s of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.04, 0.23), sign);
      sp.rotation.y = s * Math.PI / 2;
      sp.position.set(s * (W / 2 + 0.014), top + 0.14, 0);
      this.group.add(sp);
    }
    this.box(W + 0.05, 0.03, D + 0.05, m.body, 0, top + 0.295, 0);

    // 頂上的氣球
    const colors = [0xff4f6d, 0x4fa8ff, 0xffd23f, 0x58d68d];
    colors.forEach((c, i) => {
      const x = -W / 2 + 0.1 + i * 0.075;
      const z = -0.05 + (i % 2) * 0.1;
      const b = this.add(
        new THREE.SphereGeometry(0.065, 16, 12),
        new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
        x,
        top + 0.45 + (i % 2) * 0.05,
        z,
      );
      b.scale.set(0.86, 1, 0.86);
      this.add(new THREE.CylinderGeometry(0.002, 0.002, 0.14, 4), m.rubber, x, top + 0.34, z, this.group, false);
    });
  }

  /** 投幣箱:兩個投幣孔、搖桿與按鈕 */
  private buildCoinBox() {
    const m = this.mat;
    const cx = 0.14;
    const cz = D / 2 + 0.085;
    const g = new THREE.Group();
    g.position.set(cx, 0.6, cz);
    this.group.add(g);
    this.box(0.34, 0.42, 0.17, m.light, 0, 0, 0, g);
    const slope = this.box(0.34, 0.03, 0.2, m.trim, 0, 0.215, 0.0, g);
    slope.rotation.x = -0.12;
    // 投幣孔
    for (const sx of [-0.075, 0.075]) {
      this.box(0.07, 0.1, 0.012, m.chrome, sx, 0.05, 0.088, g);
      this.box(0.012, 0.055, 0.014, m.dark, sx, 0.06, 0.093, g);
      this.box(0.05, 0.012, 0.012, m.dark, sx, 0.0, 0.092, g);
    }
    // 退幣盤
    this.box(0.16, 0.06, 0.04, m.dark, 0, -0.12, 0.09, g);
    // 螢幕
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.056), new THREE.MeshBasicMaterial({ map: this.display.texture, toneMapped: false }));
    scr.position.set(0, 0.155, 0.0885);
    g.add(scr);
    this.setDisplay('CREDIT', '---');

    // 搖桿
    const jx = -0.07;
    this.joyStick.position.set(jx, 0.235, 0.02);
    g.add(this.joyStick);
    this.add(new THREE.CylinderGeometry(0.026, 0.03, 0.012, 20), m.chrome, jx, 0.226, 0.02, g);
    this.add(new THREE.CylinderGeometry(0.004, 0.004, 0.055, 8), m.chrome, 0, 0.03, 0, this.joyStick);
    this.add(
      new THREE.SphereGeometry(0.02, 18, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xe5173f, roughness: 0.2, clearcoat: 1 }),
      0,
      0.065,
      0,
      this.joyStick,
    );
    // 抓取按鈕
    this.add(new THREE.CylinderGeometry(0.037, 0.04, 0.016, 24), m.chrome, 0.08, 0.228, 0.02, g);
    this.dropMat = new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff1010, emissiveIntensity: 0.25, roughness: 0.25 });
    this.add(new THREE.CylinderGeometry(0.03, 0.032, 0.02, 24), this.dropMat, 0.08, 0.238, 0.02, g);
  }

  // ---------- 夾物區(cage 座標,與物理世界一致) ----------
  private buildCage() {
    const cage = this.cage;
    const m = this.mat;
    // 粉紅絨布地板(與物理地板相同的 L 形,挖掉出口)
    const felt = new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95, metalness: 0 });
    this.box(1.5, 0.1, 0.76, felt, 0, -0.05, -0.22, cage);
    this.box(1.07, 0.1, 0.44, felt, 0.215, -0.05, 0.38, cage);

    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x2a1b3a, roughness: 0.9 });
    const cx = (-FIELD.halfX + CHUTE.x1) / 2;
    const cw = CHUTE.x1 + FIELD.halfX;
    const cz = (CHUTE.z0 + FIELD.halfZ) / 2;
    const cd = FIELD.halfZ - CHUTE.z0;
    this.box(cw, 0.05, cd, new THREE.MeshStandardMaterial({ color: 0x3b2552, roughness: 0.7 }), cx, -CHUTE.depth - 0.025, cz, cage);
    this.box(0.03, CHUTE.depth, cd, chuteMat, CHUTE.x1 + 0.015, -CHUTE.depth / 2, cz, cage);
    this.box(cw, CHUTE.depth, 0.03, chuteMat, cx, -CHUTE.depth / 2, CHUTE.z0 + 0.015, cage);
    // 出口擋板
    this.box(0.04, 0.14, cd, m.chrome, CHUTE.x1 + 0.02, 0.07, cz, cage);
    this.box(cw, 0.14, 0.04, m.chrome, cx, 0.07, CHUTE.z0 - 0.02, cage);

    // 玻璃(前、左、右)與後面的星空背板
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdde9ff, transparent: true, opacity: 0.09, roughness: 0.02, metalness: 0, clearcoat: 1, envMapIntensity: 2, side: THREE.DoubleSide, depthWrite: false });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), glass);
    front.position.set(0, 0.8, 0.62);
    cage.add(front);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), glass);
      side.rotation.y = Math.PI / 2;
      side.position.set(s * 0.77, 0.8, 0);
      cage.add(side);
    }
    const glare = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.6),
      new THREE.MeshBasicMaterial({ map: glareTexture(), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    glare.position.set(0, 0.8, 0.625);
    glare.renderOrder = 5;
    cage.add(glare);
    const back = this.box(1.5, 1.6, 0.04, new THREE.MeshStandardMaterial({ map: backdropTexture(), roughness: 0.5, emissive: 0xffffff, emissiveMap: backdropTexture(), emissiveIntensity: 0.5 }), 0, 0.8, -0.62, cage);
    back.castShadow = false;

    // 天花燈板
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.25, 1.15), toneMapped: false }));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 1.595, 0);
    cage.add(lamp);

    // 龍門架
    for (const s of [-1, 1]) {
      this.add(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 12), m.chrome, s * 0.7, CLAW.gantryY, 0, cage, false).rotation.x = Math.PI / 2;
    }
    this.beam = this.box(1.5, 0.06, 0.08, m.chrome, 0, CLAW.gantryY, 0, cage);
    this.trolley = this.box(0.16, 0.11, 0.14, m.trim, 0, CLAW.gantryY - 0.02, 0, cage);
    this.rope = this.add(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), m.rubber, 0, 1, 0, cage, true);
  }

  setDisplay(label: string, value: string) {
    this.display.draw(label, value);
  }

  /** 釋放這台機台獨有的資源(貼圖共用快取,不在這裡釋放) */
  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) mt.dispose();
      }
    });
    this.display.texture.dispose();
  }

  /** 設定爪頭位置(cage 座標),同步橫樑、台車與吊繩 */
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
    this.joyStick.rotation.z += (-joy.x * 0.35 - this.joyStick.rotation.z) * 0.25;
    this.joyStick.rotation.x += (joy.z * 0.35 - this.joyStick.rotation.x) * 0.25;
    this.dropMat.emissiveIntensity = armed ? 0.6 + 0.5 * Math.sin(t * 7) : 0.15;
  }
}
