import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HALL } from './layout';
import type { Machine } from './machine';

export const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

export type CamPreset = 'god' | 'front';

const GOD_FOV = 40;
const FRONT_FOV = 40;
const D_MIN = 5;
const D_MAX = 72;

/** 鏡頭:上帝視角(可拖曳平移、滾輪/雙指縮放、點選機台)與近看選取的機台 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(GOD_FOV, 1, 0.1, 160);
  /** 點選地面時呼叫(世界座標) */
  onPick?: (p: THREE.Vector3) => void;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private preset: CamPreset = 'god';
  private focus = new THREE.Vector3();
  private inset = 0;
  private godTarget = new THREE.Vector3(0, 0, 7);
  private godDist = 52;
  private curTarget = new THREE.Vector3(0, 0, 7);
  private curDist = 52;
  private curPos = new THREE.Vector3();
  private curFov = GOD_FOV;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private first = true;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.renderer = r;

    this.scene.background = new THREE.Color(0x0b0a12);
    this.scene.fog = new THREE.FogExp2(0x0b0a12, 0.006);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.18 : 0.28, 0.6, 1.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));
    this.bindControls();
    this.resize();
  }

  get shadowSize() {
    return isMobile ? 512 : 1024;
  }
  get currentPreset() {
    return this.preset;
  }
  /** 離鏡頭超過這個距離的人只畫簡化人形 */
  get lodDistance() {
    return this.preset === 'god' ? 15 : 10;
  }
  get bubbleDistance() {
    return this.preset === 'god' ? 30 : 40;
  }
  get godDistance() {
    return this.godDist;
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

  /** 左側被面板蓋住的寬度(px):畫面內容會平移到剩餘空間置中 */
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

  /** 目前選取的機台位置(近看模式的目標) */
  setFocus(x: number, z: number) {
    this.focus.set(x, 0, z);
  }

  /** 上帝視角飛到某處並拉近 */
  flyTo(x: number, z: number, dist = 13) {
    this.preset = 'god';
    this.godTarget.set(x, 0, z);
    this.godDist = Math.min(this.godDist, dist);
  }

  /** 上帝視角下,離視角中心最近的幾台機台(拉近時才回傳,供切換成近看細節) */
  nearbyMachineIndices(machines: Machine[], k: number): number[] {
    if (this.preset !== 'god' || this.godDist > 14) return [];
    return machines
      .map((m) => ({ i: m.index, d: Math.hypot(m.x - this.curTarget.x, m.z - this.curTarget.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .filter((o) => o.d < 6.5)
      .map((o) => o.i);
  }

  /** 螢幕座標對應的地面位置 */
  pick(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.ground, out) ? out : null;
  }

  // ---------- 操作:拖曳平移、滾輪/雙指縮放、點選 ----------
  private panBy(dx: number, dy: number) {
    const D = this.preset === 'god' ? this.godDist : 8;
    const pitch = this.pitchFor(D);
    const perPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(GOD_FOV) / 2)) / innerHeight;
    this.godTarget.x -= dx * perPx;
    this.godTarget.z -= (dy * perPx) / Math.max(0.35, Math.sin(pitch));
    this.clampTarget();
  }
  private clampTarget() {
    this.godTarget.x = THREE.MathUtils.clamp(this.godTarget.x, HALL.minX, HALL.maxX);
    this.godTarget.z = THREE.MathUtils.clamp(this.godTarget.z, HALL.minZ, HALL.maxZ);
  }
  private zoomBy(factor: number) {
    this.godDist = THREE.MathUtils.clamp(this.godDist * factor, D_MIN, D_MAX);
  }
  /** 離得越遠越接近俯視,拉近後越接近平視 */
  private pitchFor(D: number) {
    return THREE.MathUtils.degToRad(THREE.MathUtils.lerp(26, 66, THREE.MathUtils.smoothstep(D, 5, 70)));
  }

  private bindControls() {
    const c = this.canvas;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (this.preset === 'front') return;
      if (pts.size === 1) this.panBy(dx, dy);
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomBy(pinch / d);
        pinch = d;
      }
    });
    const end = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId);
      if (had && pts.size === 0 && moved < 6) {
        const g = this.pick(e.clientX, e.clientY);
        if (g) this.onPick?.(g);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.preset === 'front') return;
        this.zoomBy(Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  /** 鍵盤平移(方向鍵/WASD,上帝視角) */
  keyPan(dx: number, dz: number, dt: number) {
    if (this.preset !== 'god' || (!dx && !dz)) return;
    const s = this.godDist * 0.9 * dt;
    this.godTarget.x += dx * s;
    this.godTarget.z += dz * s;
    this.clampTarget();
  }

  update(dt: number, t: number) {
    const k = 1 - Math.exp(-dt * 4);
    let wantTarget: THREE.Vector3;
    let wantDist: number;
    let wantFov: number;
    let pitch: number;
    if (this.preset === 'god') {
      wantTarget = this.godTarget;
      wantDist = this.godDist;
      wantFov = GOD_FOV;
      pitch = this.pitchFor(this.curDist);
    } else {
      // 近看:站在走道上方斜看選取的機台(後面一排機台比走道高,不能退太遠);直向螢幕自動拉遠
      const aspect = (innerWidth - this.inset) / innerHeight;
      const tanH = Math.tan(THREE.MathUtils.degToRad(FRONT_FOV) / 2);
      const f = Math.max(1, 1.45 / (3.7 * tanH * aspect));
      wantTarget = this.tmpB.set(this.focus.x + 0.1, 1.45, this.focus.z + 0.6);
      wantDist = 3.7 * Math.min(f, 1.7);
      wantFov = FRONT_FOV;
      pitch = THREE.MathUtils.degToRad(38);
    }
    if (this.first) {
      this.curTarget.copy(wantTarget);
      this.curDist = wantDist;
      this.first = false;
    }
    this.curTarget.lerp(wantTarget, k);
    this.curDist += (wantDist - this.curDist) * k;
    this.curFov += (wantFov - this.curFov) * k;
    if (Math.abs(this.camera.fov - this.curFov) > 0.01) {
      this.camera.fov = this.curFov;
      this.camera.updateProjectionMatrix();
    }
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const px = this.preset === 'front' ? this.pointerSmooth.x * 0.22 + Math.sin(t * 0.3) * 0.02 : 0;
    this.camera.position.set(this.curTarget.x + px, this.curTarget.y + this.curDist * Math.sin(pitch), this.curTarget.z + this.curDist * Math.cos(pitch));
    this.camera.lookAt(this.curTarget);
    this.composer.render();
  }
}
