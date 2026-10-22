import * as THREE from 'three';
import { glowTexture, neonTexture, screenTexture, tileFloorTexture } from './textures';

/** 店內場景:地板、牆面、霓虹招牌、旁邊的其他機台 */
export function buildStore(): THREE.Group {
  const g = new THREE.Group();

  // 地板
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ map: tileFloorTexture(), roughness: 0.2, metalness: 0.15, envMapIntensity: 1.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // 後牆
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x151228, roughness: 0.85 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), wallMat);
  wall.position.set(0, 4.5, -4.2);
  g.add(wall);
  // 牆面直條飾板
  for (let i = -5; i <= 5; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1b1738, roughness: 0.5, metalness: 0.2 }),
    );
    p.position.set(i * 1.4, 3.2, -4.1);
    g.add(p);
  }
  // 牆面霓虹招牌
  const addNeon = (text: string, color: string, x: number, y: number, w: number, h: number, ry = 0, z = -4.0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: neonTexture(text, color, 1024, 256, 'bold 160px "Arial Black", sans-serif'), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  };
  addNeon('ARCADE', '#ff3da0', -3.2, 4.4, 4.6, 1.15);
  addNeon('PLAY', '#3de0ff', 3.4, 3.6, 2.8, 0.7);
  // 霓虹圓環
  for (const [x, y, r, c] of [[0, 3.2, 0.9, 0xff3da0], [1.2, 3.6, 0.5, 0x3de0ff]] as const) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.03, 12, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), toneMapped: false }),
    );
    ring.position.set(x, y, -4.0);
    g.add(ring);
  }

  // 旁邊的機台(簡化版)
  const cabMat = (c: number) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, metalness: 0.2, clearcoat: 1 });
  const makeCab = (x: number, z: number, ry: number, color: number, hue: number) => {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 1.0), cabMat(color));
    body.position.y = 1.25;
    body.castShadow = true;
    c.add(body);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: screenTexture(hue), toneMapped: false }),
    );
    screen.position.set(0, 1.55, 0.505);
    c.add(screen);
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.35),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 1, 0.5).multiplyScalar(2.2), toneMapped: false }),
    );
    top.position.set(0, 2.25, 0.505);
    c.add(top);
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    g.add(c);
  };
  makeCab(-2.9, -1.4, 0.45, 0x2b0f4f, 300);
  makeCab(2.9, -1.4, -0.45, 0x0e2d52, 190);
  makeCab(-5.3, -2.2, 0.6, 0x4a0f35, 330);
  makeCab(5.3, -2.2, -0.6, 0x0f4a44, 160);

  // 地面燈光溢出
  const spill = (color: string, x: number, z: number, s: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: glowTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.35 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    g.add(m);
  };
  spill('rgba(255,60,160,1)', -1.2, 1.6, 4.5);
  spill('rgba(60,210,255,1)', 1.3, 1.6, 4.5);
  spill('rgba(255,200,140,1)', 0, 1.2, 3.2);

  // 環境光源
  g.add(new THREE.HemisphereLight(0x6a5cff, 0x180a2a, 0.25));
  const rimPink = new THREE.PointLight(0xff3da0, 5, 0, 2);
  rimPink.position.set(-2.2, 2.6, 1.8);
  const rimCyan = new THREE.PointLight(0x3de0ff, 5, 0, 2);
  rimCyan.position.set(2.2, 2.6, 1.8);
  g.add(rimPink, rimCyan);
  return g;
}
