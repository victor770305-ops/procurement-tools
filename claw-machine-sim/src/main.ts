import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Sfx } from './audio';
import { RARITY } from './config';
import { buildStore } from './environment';
import { Game } from './game';
import { Input } from './input';
import { N_MACHINES, gridOf, themeOf } from './layout';
import { LiteLayer } from './lite';
import type { Machine } from './machine';
import { Renderer } from './render';
import { glowTexture } from './textures';
import { Hud } from './ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  await RAPIER.init();

  const gfx = new Renderer($('view') as HTMLCanvasElement);
  const sfx = new Sfx();
  const hud = new Hud();
  const input = new Input($('joy'), $('knob'), $('dropbtn'));

  const store = buildStore();
  gfx.scene.add(store.group);

  // 遠景層:60 台機台一次畫完
  const grids = Array.from({ length: N_MACHINES }, (_, i) => gridOf(i));
  const lite = new LiteLayer(grids, grids.map((_, i) => themeOf(i)));
  gfx.scene.add(lite.group);

  // --- 得獎特效(粒子),掛在各機台自己的座標系 ---
  const sparkles: { host: THREE.Object3D; pts: THREE.Points; vel: Float32Array; life: number }[] = [];
  const sparkTex = glowTexture('rgba(255,255,255,1)');
  const burst = (m: Machine, color: number) => {
    if (!m.cabinet) return;
    const n = 70;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([-0.53, 0.15, 0.38], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 1.6;
      const sp = 0.3 + Math.random() * 0.9;
      vel.set([Math.cos(a) * sp, up, Math.sin(a) * sp], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.07, map: sparkTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    pts.frustumCulled = false;
    m.cabinet.group.add(pts);
    sparkles.push({ host: m.cabinet.group, pts, vel, life: 1.4 });
  };

  const game = new Game({
    gfx,
    scene: gfx.scene,
    store,
    lite,
    input,
    sfx,
    hud,
    onWinFx: (m, p) => burst(m, new THREE.Color(RARITY[p.rarity].color).getHex()),
  });

  // --- 選取機台 ---
  hud.onSelectMachine = (i) => game.focusMachine(i);
  gfx.onPick = (p) => {
    // 點地面:找最近的機台
    let best = -1;
    let bd = 1.9;
    for (const m of game.machines) {
      const d = Math.hypot(m.x - p.x, m.z + 0.2 - p.z);
      if (d < bd) {
        bd = d;
        best = m.index;
      }
    }
    if (best >= 0) {
      sfx.click();
      game.select(best);
    }
  };
  $('btnPrev').addEventListener('click', () => {
    sfx.click();
    game.focusMachine((game.selected + N_MACHINES - 1) % N_MACHINES);
  });
  $('btnNextM').addEventListener('click', () => {
    sfx.click();
    game.focusMachine((game.selected + 1) % N_MACHINES);
  });

  // --- 介面事件 ---
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  $('btnTest').addEventListener('click', () => {
    unlock();
    game.testPlay();
  });
  $('btnOpen').addEventListener('click', () => {
    unlock();
    game.openShop();
  });
  document.querySelectorAll<HTMLElement>('#speed button').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      game.setSpeed(Number(b.dataset.s));
    }),
  );
  document.querySelectorAll<HTMLButtonElement>('#shiftSeg button').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      game.setShiftSize(Number(b.dataset.shift) as 0 | 1, Number(b.dataset.n));
    }),
  );

  const toggle = (panel: 'settings' | 'shop' | 'ops') => {
    unlock();
    sfx.click();
    if (panel === 'settings') {
      hud.el.settings.hidden = !hud.el.settings.hidden;
      $('btnCfg').classList.toggle('on', !hud.el.settings.hidden);
    } else if (panel === 'ops') {
      hud.el.ops.hidden = !hud.el.ops.hidden;
      $('btnOps').classList.toggle('on', !hud.el.ops.hidden);
    } else {
      hud.openShop(hud.el.shop.hidden);
    }
  };
  $('btnCfg').addEventListener('click', () => toggle('settings'));
  $('btnOps').addEventListener('click', () => toggle('ops'));
  $('btnShop').addEventListener('click', () => toggle('shop'));
  $('btnShopClose').addEventListener('click', () => hud.openShop(false));
  $('btnShelve').addEventListener('click', () => game.shelve());
  $<HTMLInputElement>('autoRestock').addEventListener('change', (e) => game.setAuto((e.target as HTMLInputElement).checked));

  const priceEl = $<HTMLInputElement>('price');
  const strEl = $<HTMLInputElement>('strength');
  priceEl.value = String(game.state.price);
  strEl.value = String(Math.round(game.state.strength * 100));
  priceEl.addEventListener('input', () => game.setPrice(Number(priceEl.value)));
  strEl.addEventListener('input', () => game.setStrength(Number(strEl.value) / 100));
  $('btnReset').addEventListener('click', () => {
    if (hud.armReset()) game.resetAll();
  });

  $('btnCam').addEventListener('click', () => {
    sfx.click();
    if (gfx.currentPreset === 'god') {
      gfx.setPreset('front');
      hud.say(`近看 ${game.sel.name}`, 1200);
    } else {
      gfx.setPreset('god');
      gfx.flyTo(game.sel.x, game.sel.z + 2, 30);
      hud.say('上帝視角(拖曳平移、滾輪縮放)', 1600);
    }
  });
  $('btnSnd').addEventListener('click', () => {
    unlock();
    sfx.setMuted(!sfx.muted);
    $('btnSnd').textContent = sfx.muted ? '🔇' : '🔊';
  });

  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') {
      unlock();
      if (game.phase === 'prep' && !game.manualMachine && hud.el.shop.hidden && hud.el.report.hidden) {
        game.testPlay();
        input.consumeDrop();
      }
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  // 大螢幕預設展開營運總覽
  if (innerWidth >= 900) {
    hud.el.ops.hidden = false;
    $('btnOps').classList.add('on');
  }

  $('loading').classList.add('done');
  if (game.state.day === 1 && game.state.totalProfit === 0) hud.say('歡迎光臨!拖曳畫面平移、滾輪縮放,準備好就按「開店營業」', 4000);
  else hud.say(`歡迎回來,第 ${game.state.day} 天`, 2200);

  // --- 主迴圈 ---
  const clock = new THREE.Clock();
  let time = 0;
  let prevManual: Machine | null = null;
  let savedPreset: 'god' | 'front' = 'god';
  const zero = { x: 0, z: 0 };
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    input.poll();

    // 試玩時自動近看該機台,結束後回到原本視角
    const man = game.manualMachine;
    if (man && !prevManual) {
      savedPreset = gfx.currentPreset;
      game.select(man.index);
      gfx.setPreset('front');
    } else if (!man && prevManual) {
      gfx.setPreset(savedPreset);
    }
    prevManual = man;

    // 鍵盤平移(試玩時方向鍵是操控爪子)
    if (!man) {
      const dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const dz = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      gfx.keyPan(dx, dz, dt);
    }

    if (input.consumeDrop() && man && man.claw?.playing && !man.roundActive) {
      sfx.click();
      man.claw.drop();
    }
    input.consumeStart();

    game.frame(dt);

    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.life -= dt;
      const attr = s.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let j = 0; j < attr.count; j++) {
        s.vel[j * 3 + 1] -= 4 * dt;
        attr.setXYZ(j, attr.getX(j) + s.vel[j * 3] * dt, attr.getY(j) + s.vel[j * 3 + 1] * dt, attr.getZ(j) + s.vel[j * 3 + 2] * dt);
      }
      attr.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = Math.max(0, s.life / 1.4);
      if (s.life <= 0) {
        s.host.remove(s.pts);
        s.pts.geometry.dispose();
        sparkles.splice(i, 1);
      }
    }

    for (const m of game.machines) if (m.mode === 'full') m.cabinet!.update(time, m.manual ? input.move : zero, m.claw!.state === 'play');
    const sc = game.sel.claw;
    sfx.setMotor(sc ? Math.min(1, sc.speedMag / 0.6) : 0);
    gfx.setLeftInset(!hud.el.ops.hidden && innerWidth >= 900 ? 360 : 0);
    gfx.update(dt, time);
    requestAnimationFrame(loop);
  };
  loop();

  (window as unknown as { __game: unknown }).__game = { game, gfx, hud, lite };
}

main().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div><div class="logo">載入失敗</div><p>${String(e)}</p></div>`;
});
