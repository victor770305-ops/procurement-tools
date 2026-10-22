import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Sfx } from './audio';
import { Cabinet } from './cabinet';
import { ClawRig, ClawState } from './claw';
import { BASE_HEIGHT, RARITY } from './config';
import { buildStore } from './environment';
import { Input } from './input';
import { Physics } from './physics';
import { CamPreset, Renderer } from './render';
import { glowTexture } from './textures';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  await RAPIER.init();

  const gfx = new Renderer($('view') as HTMLCanvasElement);
  const sfx = new Sfx();
  const input = new Input($('joy'), $('knob'), $('dropbtn'));

  // --- 場景 ---
  gfx.scene.add(buildStore());
  const cabinet = new Cabinet(gfx.shadowSize);
  cabinet.group.position.y = BASE_HEIGHT;
  gfx.scene.add(cabinet.group);

  // --- 物理與娃娃 ---
  const physics = new Physics();
  physics.fillMachine(22);
  for (const p of physics.plushes) cabinet.group.add(p.mesh);
  physics.syncMeshes();

  const claw = new ClawRig(physics);
  cabinet.group.add(claw.group);

  // --- 遊戲狀態 ---
  let coins = 10;
  let prizeCount = 0;
  let msgTimer = 0;
  const msgEl = $('msg');
  const say = (text: string, ms = 1800) => {
    msgEl.textContent = text;
    msgEl.classList.add('show');
    msgTimer = ms / 1000;
  };
  const refreshHud = () => {
    $('coins').textContent = String(coins);
    $('prizeCount').textContent = String(prizeCount);
    $('stock').textContent = String(physics.plushes.filter((p) => !p.won).length);
    cabinet.setCredits(coins);
  };
  const startBtn = $<HTMLButtonElement>('start');
  const dropBtn = $<HTMLButtonElement>('dropbtn');

  const tryStart = () => {
    sfx.unlock();
    if (claw.state !== 'idle') return;
    if (coins <= 0) {
      say('代幣用完了!點擊 ⚙️ 補充');
      sfx.fail();
      return;
    }
    coins--;
    sfx.coin();
    claw.begin();
    say('移動爪子,對準娃娃後按「放爪」', 2200);
    refreshHud();
  };
  startBtn.addEventListener('click', tryStart);

  let grabbed = false;
  claw.events.onGrab = () => {
    grabbed = true;
  };
  claw.events.onSlip = () => {
    say('啊!掉了…', 1500);
    sfx.fail();
  };
  claw.events.onState = (s: ClawState) => {
    if (s === 'descend') {
      grabbed = false;
      sfx.drop();
    }
    if (s === 'close') sfx.clack();
    if (s === 'lift' && grabbed) say('夾到了!', 1200);
    if (s === 'lift' && !grabbed) say('什麼都沒夾到…', 1500);
    if (s === 'idle') {
      // 回合結束
      setTimeout(() => {
        if (claw.state === 'idle' && coins > 0) say('再來一次?', 1600);
      }, 400);
    }
  };

  // --- 設定面板 ---
  const cfg = $('settings');
  $('btnCfg').addEventListener('click', () => {
    sfx.unlock();
    cfg.hidden = !cfg.hidden;
    $('btnCfg').classList.toggle('on', !cfg.hidden);
  });
  const strengthEl = $<HTMLInputElement>('strength');
  const applyStrength = () => {
    const v = Number(strengthEl.value);
    claw.strength = v / 100;
    $('strVal').textContent = `${v}%`;
    $('winRate').textContent = `${Math.round(v * 0.9)}%`;
  };
  strengthEl.addEventListener('input', applyStrength);
  applyStrength();
  $('btnCoin').addEventListener('click', () => {
    coins += 10;
    sfx.coin();
    refreshHud();
  });
  $('btnRefill').addEventListener('click', () => {
    if (claw.state !== 'idle') return;
    const want = 22 - physics.plushes.filter((p) => !p.won).length;
    for (let i = 0; i < want; i++) {
      const x = (Math.random() * 2 - 1) * 0.5 + 0.2;
      const z = (Math.random() * 2 - 1) * 0.4 - 0.1;
      const p = physics.spawnPlush(x, 1.1 + i * 0.12, z);
      cabinet.group.add(p.mesh);
    }
    sfx.click();
    refreshHud();
  });

  // --- 視角切換 ---
  const presets: CamPreset[] = ['front', 'side', 'top'];
  let presetIdx = 0;
  $('btnCam').addEventListener('click', () => {
    presetIdx = (presetIdx + 1) % presets.length;
    gfx.setPreset(presets[presetIdx]);
    say(['正面視角', '側面視角(判斷前後距離)', '俯視視角'][presetIdx], 1200);
    sfx.click();
  });
  $('btnSnd').addEventListener('click', () => {
    sfx.unlock();
    sfx.setMuted(!sfx.muted);
    $('btnSnd').textContent = sfx.muted ? '🔇' : '🔊';
  });
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

  // --- 得獎特效 ---
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

  const onWin = (p: ReturnType<Physics['detectWins']>[number]) => {
    prizeCount++;
    const r = RARITY[p.rarity];
    sfx.win(p.rarity !== 'common');
    say(`🎉 獲得 ${p.type.name}!(${r.label})`, 2600);
    const el = document.createElement('div');
    el.className = 'prize panel';
    el.style.borderColor = r.color;
    el.innerHTML = `<span>🧸</span><span>${p.type.name}</span><span style="color:${r.color};font-size:11px">${r.label}</span>`;
    $('prizes').prepend(el);
    while ($('prizes').children.length > 5) $('prizes').lastElementChild!.remove();
    burst(-0.53, 0.15, 0.38, new THREE.Color(r.color).getHex());
    refreshHud();
  };

  // --- 主迴圈 ---
  $('loading').classList.add('done');
  refreshHud();
  say('歡迎光臨!點「投幣開始」', 2600);

  const clock = new THREE.Clock();
  let acc = 0;
  let time = 0;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    input.poll();

    // 輸入處理
    if (claw.state === 'idle' && input.consumeStart()) tryStart();
    if (input.consumeDrop() && claw.playing) {
      sfx.click();
      claw.drop();
    }
    input.consumeStart();

    // 固定步長物理
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 4) {
      claw.update(1 / 60, input.move);
      physics.world.step();
      acc -= 1 / 60;
      steps++;
    }
    if (steps === 4) acc = 0;

    physics.syncMeshes();
    cabinet.setClawPos(claw.pos.x, claw.pos.y, claw.pos.z);

    // 得獎判定與清除
    for (const p of physics.detectWins(time)) onWin(p);
    for (const p of [...physics.plushes]) {
      if (p.won && time - p.wonAt > 1.2) {
        cabinet.group.remove(p.mesh);
        physics.remove(p);
        refreshHud();
      }
    }

    // 粒子
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

    // HUD
    const playing = claw.state === 'play';
    startBtn.hidden = claw.state !== 'idle';
    dropBtn.disabled = !playing;
    const timeEl = $('time');
    timeEl.textContent = playing ? String(Math.ceil(claw.timeLeft)) : '--';
    $('timer').classList.toggle('low', playing && claw.timeLeft < 6);
    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) msgEl.classList.remove('show');
    }
    sfx.setMotor(Math.min(1, claw.speedMag / 0.6));

    cabinet.update(time, input.move, playing);
    gfx.update(dt, time);
    requestAnimationFrame(loop);
  };
  loop();

  // 供除錯與自動化測試使用
  (window as unknown as { __game: unknown }).__game = { claw, physics, gfx, cabinet, tryStart, input };
}

main().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div><div class="logo">載入失敗</div><p>${String(e)}</p></div>`;
});
