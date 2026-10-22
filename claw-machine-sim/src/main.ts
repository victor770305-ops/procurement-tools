import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Sfx } from './audio';
import { Cabinet } from './cabinet';
import { ClawRig } from './claw';
import { BASE_HEIGHT, RARITY } from './config';
import { buildStore } from './environment';
import { Game } from './game';
import { Input } from './input';
import { Physics } from './physics';
import { CamPreset, Renderer } from './render';
import { glowTexture } from './textures';
import { Hud } from './ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  await RAPIER.init();

  const gfx = new Renderer($('view') as HTMLCanvasElement);
  const sfx = new Sfx();
  const hud = new Hud();
  const input = new Input($('joy'), $('knob'), $('dropbtn'));

  gfx.scene.add(buildStore());
  const cabinet = new Cabinet(gfx.shadowSize);
  cabinet.group.position.y = BASE_HEIGHT;
  gfx.scene.add(cabinet.group);

  const physics = new Physics();
  const claw = new ClawRig(physics);
  cabinet.group.add(claw.group);

  // --- 得獎特效(粒子) ---
  const sparkles: { pts: THREE.Points; vel: Float32Array; life: number }[] = [];
  const sparkTex = glowTexture('rgba(255,255,255,1)');
  const burst = (x: number, y: number, z: number, color: number) => {
    const n = 70;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([x, y, z], i * 3);
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
    cabinet.group.add(pts);
    sparkles.push({ pts, vel, life: 1.4 });
  };

  const game = new Game({
    gfx,
    scene: gfx.scene,
    cabinet,
    physics,
    claw,
    input,
    sfx,
    hud,
    onWinFx: (p) => burst(-0.53, 0.15, 0.38, new THREE.Color(RARITY[p.rarity].color).getHex()),
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

  const toggle = (panel: 'settings' | 'shop') => {
    unlock();
    sfx.click();
    if (panel === 'settings') {
      hud.el.settings.hidden = !hud.el.settings.hidden;
      $('btnCfg').classList.toggle('on', !hud.el.settings.hidden);
    } else {
      hud.openShop(hud.el.shop.hidden);
    }
  };
  $('btnCfg').addEventListener('click', () => toggle('settings'));
  $('btnShop').addEventListener('click', () => toggle('shop'));
  $('btnShopClose').addEventListener('click', () => hud.openShop(false));
  $('btnShelve').addEventListener('click', () => game.shelve());

  const priceEl = $<HTMLInputElement>('price');
  const strEl = $<HTMLInputElement>('strength');
  priceEl.value = String(game.state.price);
  strEl.value = String(Math.round(game.state.strength * 100));
  priceEl.addEventListener('input', () => game.setPrice(Number(priceEl.value)));
  strEl.addEventListener('input', () => game.setStrength(Number(strEl.value) / 100));
  $('btnReset').addEventListener('click', () => {
    if (hud.armReset()) game.resetAll();
  });

  const presets: CamPreset[] = ['front', 'side', 'top'];
  let presetIdx = 0;
  $('btnCam').addEventListener('click', () => {
    presetIdx = (presetIdx + 1) % presets.length;
    gfx.setPreset(presets[presetIdx]);
    hud.say(['正面視角', '側面視角(判斷前後距離)', '俯視視角'][presetIdx], 1200);
    sfx.click();
  });
  $('btnSnd').addEventListener('click', () => {
    unlock();
    sfx.setMuted(!sfx.muted);
    $('btnSnd').textContent = sfx.muted ? '🔇' : '🔊';
  });

  // 空白鍵:準備階段 → 試玩;試玩中 → 放爪
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      unlock();
      if (game.phase === 'prep' && claw.state === 'idle' && hud.el.shop.hidden && hud.el.report.hidden) {
        game.testPlay();
        input.consumeDrop();
      }
    }
  });

  $('loading').classList.add('done');
  if (game.state.day === 1 && game.state.totalProfit === 0) hud.say('歡迎光臨!先試玩熟悉手感,再按「開店營業」', 3600);
  else hud.say(`歡迎回來,第 ${game.state.day} 天`, 2200);

  // --- 主迴圈 ---
  const clock = new THREE.Clock();
  let time = 0;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    input.poll();
    if (input.consumeDrop() && claw.playing && !game.manager.roundActive) {
      sfx.click();
      claw.drop();
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
        cabinet.group.remove(s.pts);
        s.pts.geometry.dispose();
        sparkles.splice(i, 1);
      }
    }

    sfx.setMotor(Math.min(1, claw.speedMag / 0.6));
    cabinet.update(time, game.manager.roundActive ? { x: 0, z: 0 } : input.move, claw.state === 'play');
    gfx.update(dt, time);
    requestAnimationFrame(loop);
  };
  loop();

  (window as unknown as { __game: unknown }).__game = { game, claw, physics, gfx, cabinet, hud };
}

main().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div><div class="logo">載入失敗</div><p>${String(e)}</p></div>`;
});
