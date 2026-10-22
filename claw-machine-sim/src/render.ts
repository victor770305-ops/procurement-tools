import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BASE_HEIGHT } from './config';

export const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

export type CamPreset = 'front' | 'side' | 'top';

const PRESETS: Record<CamPreset, { dir: THREE.Vector3; dist: number; target: THREE.Vector3; halfW: number }> = {
  front: { dir: new THREE.Vector3(0, 0.12, 1).normalize(), dist: 6.5, target: new THREE.Vector3(0, 1.5, 0.3), halfW: 1.3 },
  side: { dir: new THREE.Vector3(1, 0.2, 0.18).normalize(), dist: 4.6, target: new THREE.Vector3(0, BASE_HEIGHT + 0.8, 0.1), halfW: 1.0 },
  top: { dir: new THREE.Vector3(0, 0.62, 1).normalize(), dist: 3.7, target: new THREE.Vector3(0, BASE_HEIGHT + 0.55, 0.25), halfW: 1.0 },
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private preset: CamPreset = 'front';
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
    this.scene.fog = new THREE.FogExp2(0x0a0716, 0.045);
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
    return isMobile ? 1024 : 2048;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setPreset(p: CamPreset) {
    this.preset = p;
  }

  private compute(p: CamPreset, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
    const cfg = PRESETS[p];
    // 直向螢幕時拉遠,確保機台完整入鏡
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const visibleHalfW = cfg.dist * tanH * this.camera.aspect;
    const f = Math.max(1, cfg.halfW / visibleHalfW);
    outTarget.copy(cfg.target);
    outPos.copy(cfg.target).addScaledVector(cfg.dir, cfg.dist * f);
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
    // 滑鼠視差 + 微呼吸感
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const px = this.pointerSmooth.x * 0.22 + Math.sin(t * 0.3) * 0.02;
    const py = -this.pointerSmooth.y * 0.1;
    this.camera.position.set(this.curPos.x + px, this.curPos.y + py, this.curPos.z);
    this.camera.lookAt(this.curTarget);
    this.composer.render();
  }
}
