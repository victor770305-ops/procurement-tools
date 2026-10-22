import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BASE_HEIGHT } from './config';

export const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

export type CamPreset = 'store' | 'front' | 'top';

interface PresetCfg {
  dir: THREE.Vector3;
  dist: number;
  target: THREE.Vector3;
  halfW: number;
  fov: number;
  /** 是否跟著選取的機台左右移動 */
  follow: boolean;
}

const PRESETS: Record<CamPreset, PresetCfg> = {
  store: { dir: new THREE.Vector3(0.04, 0.3, 1).normalize(), dist: 10.2, target: new THREE.Vector3(1.0, 1.0, 1.6), halfW: 7.0, fov: 42, follow: false },
  front: { dir: new THREE.Vector3(0, 0.27, 1).normalize(), dist: 6.2, target: new THREE.Vector3(0.1, 1.5, 0.3), halfW: 1.5, fov: 36, follow: true },
  top: { dir: new THREE.Vector3(0, 0.62, 1).normalize(), dist: 3.9, target: new THREE.Vector3(0.1, BASE_HEIGHT + 0.55, 0.25), halfW: 1.2, fov: 36, follow: true },
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private preset: CamPreset = 'store';
  private focusX = 0;
  private inset = 0;
  private curFov = 42;
  private curPos = new THREE.Vector3();
  private curTarget = new THREE.Vector3();
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private tmpPos = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();
  private first = true;

  constructor(canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;

    this.scene.background = new THREE.Color(0x07050f);
    this.scene.fog = new THREE.FogExp2(0x0a0716, 0.026);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.35 : 0.45, 0.6, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    this.resize();
  }

  get shadowSize() {
    return isMobile ? 512 : 1024;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyView();
  }

  setPreset(p: CamPreset) {
    this.preset = p;
  }

  get currentPreset() {
    return this.preset;
  }

  /** 左側被面板蓋住的寬度(px):店面會平移到剩餘空間置中 */
  setLeftInset(px: number) {
    if (px === this.inset) return;
    this.inset = px;
    this.applyView();
  }

  private applyView() {
    const w = innerWidth;
    const h = innerHeight;
    if (this.inset > 0) this.camera.setViewOffset(w, h, -this.inset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** 聚焦的機台 X 座標 */
  setFocusX(x: number) {
    this.focusX = x;
  }

  private compute(p: CamPreset, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
    const cfg = PRESETS[p];
    // 直向螢幕時拉遠,確保想看的範圍完整入鏡
    const tanH = Math.tan(THREE.MathUtils.degToRad(cfg.fov) / 2);
    const aspect = (innerWidth - this.inset) / innerHeight;
    // 直向螢幕的全店視角只顯示機台列與櫃台
    const portraitStore = p === 'store' && aspect < 1;
    const halfW = portraitStore ? 5.0 : cfg.halfW;
    const visibleHalfW = cfg.dist * tanH * aspect;
    const f = Math.max(1, halfW / visibleHalfW);
    outTarget.copy(cfg.target);
    if (portraitStore) outTarget.x = 1.3;
    if (cfg.follow) outTarget.x += this.focusX;
    outPos.copy(outTarget).addScaledVector(cfg.dir, cfg.dist * f);
  }

  update(dt: number, t: number) {
    this.compute(this.preset, this.tmpPos, this.tmpTarget);
    if (this.first) {
      this.curPos.copy(this.tmpPos);
      this.curTarget.copy(this.tmpTarget);
      this.first = false;
    }
    const k = 1 - Math.exp(-dt * 3.5);
    this.curPos.lerp(this.tmpPos, k);
    this.curTarget.lerp(this.tmpTarget, k);
    const wantFov = PRESETS[this.preset].fov;
    if (Math.abs(wantFov - this.curFov) > 0.01) {
      this.curFov += (wantFov - this.curFov) * k;
      this.camera.fov = this.curFov;
      this.camera.updateProjectionMatrix();
    }
    // 滑鼠視差 + 微呼吸感
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const px = this.pointerSmooth.x * 0.22 + Math.sin(t * 0.3) * 0.02;
    const py = -this.pointerSmooth.y * 0.1;
    this.camera.position.set(this.curPos.x + px, this.curPos.y + py, this.curPos.z);
    this.camera.lookAt(this.curTarget);
    this.composer.render();
  }
}
