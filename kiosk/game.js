/* IDF 런 — 터치 한 번으로 하는 러너 게임 (로봇이 부품과 드론을 피해 달립니다) */
(function () {
  'use strict';
  const LS_BEST = 'idf-game-best';

  function mount(card, scoreEl, bestEl) {
    const canvas = card.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
    let colors = {};
    let best = Number(localStorage.getItem(LS_BEST) || 0);
    bestEl.textContent = best;

    const g = {
      mode: 'ready', t: 0, speed: 0, dist: 0, score: 0, overAt: 0,
      y: 0, vy: 0, holding: false, holdT: 0, onGround: true,
      obs: [], nextGap: 0, sparks: [], ticks: 0,
    };

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      colors = { ink: v('--ink'), ink3: v('--ink-3'), line: v('--line'), accent: v('--accent'), stop: v('--stop'), busy: v('--busy'), surface: v('--surface'), surface2: v('--surface-2') };
    }

    function resize() {
      const r = card.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    // 크기 단위: 화면 높이에 비례 (세로·가로 키오스크 모두 대응)
    const U = () => Math.min(H, W * 0.75);
    const groundY = () => H * 0.78;
    const size = () => U() * 0.13;
    const robotX = () => Math.max(W * 0.14, size());

    function reset() {
      g.mode = 'run'; g.t = 0; g.dist = 0; g.score = 0;
      g.speed = U() * 0.8; g.y = 0; g.vy = 0; g.onGround = true;
      g.obs = []; g.nextGap = W * 0.6; g.sparks = [];
      scoreEl.textContent = 0;
    }

    function jump() {
      if (g.mode === 'ready') { reset(); }
      else if (g.mode === 'over') { if (performance.now() - g.overAt > 600) reset(); return; }
      if (g.onGround) { g.vy = -U() * 2.25; g.onGround = false; g.holdT = 0; puff(); }
    }

    function puff() {
      for (let i = 0; i < 6; i++) g.sparks.push({ x: robotX() + size() * 0.3, y: groundY(), vx: -Math.random() * U() * 0.6, vy: -Math.random() * U() * 0.4, life: 0.4 });
    }

    function spawn() {
      const s = size();
      const r = Math.random();
      const lvl = Math.min(1, g.t / 40);
      if (r < 0.38) g.obs.push({ kind: 'gear', w: s * 0.78, h: s * 0.78, x: W + s, y: 0, rot: 0 });
      else if (r < 0.66) g.obs.push({ kind: 'cone', w: s * 0.6, h: s * (0.75 + Math.random() * 0.35), x: W + s, y: 0 });
      else if (r < 0.82 && lvl > 0.15) g.obs.push({ kind: 'cone2', w: s * 1.2, h: s * 0.7, x: W + s, y: 0 });
      else {
        // 드론: 낮게 오면 점프, 높게 오면 그냥 지나가기
        const high = Math.random() < 0.5;
        g.obs.push({ kind: 'drone', w: s * 1.1, h: s * 0.45, x: W + s, y: high ? s * 1.25 : s * 0.15, phase: Math.random() * 6 });
      }
      const minGap = g.speed * 0.75, extra = g.speed * (1.1 - lvl * 0.4);
      g.nextGap = minGap + Math.random() * extra;
    }

    function update(dt) {
      if (g.mode !== 'run') return;
      const s = size();
      g.t += dt;
      g.speed = U() * Math.min(1.9, 0.8 + g.t * 0.022);
      const dx = g.speed * dt;
      g.dist += dx;
      g.score = Math.floor(g.dist / (U() * 0.12));
      scoreEl.textContent = g.score;

      // 점프 물리 (길게 누르면 조금 더 높이)
      let grav = U() * 7.5;
      if (g.holding && g.vy < 0 && g.holdT < 0.2) { grav *= 0.45; g.holdT += dt; }
      if (!g.onGround) {
        g.vy += grav * dt; g.y -= g.vy * dt;
        if (g.y <= 0) { g.y = 0; g.vy = 0; g.onGround = true; }
      }

      g.nextGap -= dx;
      if (g.nextGap <= 0) spawn();
      for (const o of g.obs) { o.x -= dx; if (o.kind === 'gear') o.rot -= dx / (o.w / 2); if (o.phase !== undefined) o.phase += dt * 8; }
      g.obs = g.obs.filter((o) => o.x + o.w > -10);
      g.ticks = (g.ticks + dx) % (s * 0.9);

      for (const p of g.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      g.sparks = g.sparks.filter((p) => p.life > 0);

      // 충돌 (조금 여유 있게)
      const rx = robotX(), rw = s * 0.72, rh = s * 0.9;
      const rTop = groundY() - g.y - rh;
      for (const o of g.obs) {
        const oTop = groundY() - o.y - o.h, inset = o.w * 0.14;
        if (rx + rw - inset > o.x + inset && rx + inset < o.x + o.w - inset &&
            rTop + rh - inset > oTop + inset * 0.6 && rTop + inset < oTop + o.h) {
          g.mode = 'over'; g.overAt = performance.now();
          if (g.score > best) { best = g.score; localStorage.setItem(LS_BEST, best); bestEl.textContent = best; g.newBest = true; }
          else g.newBest = false;
          break;
        }
      }
    }

    /* ───── 그리기 ───── */
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

    function drawRobot() {
      const s = size(), x = robotX(), gy = groundY() - g.y;
      const w = s * 0.72, h = s * 0.9;
      const run = g.mode === 'run' && g.onGround;
      const bob = run ? Math.sin(g.t * 22) * s * 0.03 : 0;
      const top = gy - h + bob;
      // 다리
      ctx.fillStyle = colors.ink;
      const legA = run ? Math.sin(g.t * 22) * s * 0.06 : 0;
      rrect(x + w * 0.18, gy - s * 0.2 + legA, w * 0.18, s * 0.2 - legA, 3); ctx.fill();
      rrect(x + w * 0.62, gy - s * 0.2 - legA, w * 0.18, s * 0.2 + legA, 3); ctx.fill();
      // 몸통
      rrect(x, top, w, h * 0.78, s * 0.16); ctx.fill();
      // 안테나
      ctx.strokeStyle = colors.ink; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + w * 0.5, top); ctx.lineTo(x + w * 0.5, top - s * 0.16); ctx.stroke();
      ctx.fillStyle = colors.accent; ctx.beginPath(); ctx.arc(x + w * 0.5, top - s * 0.2, s * 0.07, 0, Math.PI * 2); ctx.fill();
      // 얼굴 화면
      ctx.fillStyle = colors.surface;
      rrect(x + w * 0.14, top + h * 0.14, w * 0.72, h * 0.32, s * 0.08); ctx.fill();
      ctx.fillStyle = g.mode === 'over' ? colors.stop : colors.accent;
      if (g.mode === 'over') {
        ctx.font = `800 ${s * 0.22}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('× ×', x + w * 0.5, top + h * 0.31);
      } else {
        const blink = (g.t % 3) < 0.12 ? 0.25 : 1;
        rrect(x + w * 0.3, top + h * 0.22, w * 0.12, h * 0.16 * blink, 3); ctx.fill();
        rrect(x + w * 0.58, top + h * 0.22, w * 0.12, h * 0.16 * blink, 3); ctx.fill();
      }
    }

    function drawGear(o) {
      const gy = groundY() - o.y, r = o.w / 2, cx = o.x + r, cy = gy - r;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot);
      ctx.fillStyle = colors.ink3;
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r;
        const a2 = a + Math.PI / (teeth * 2);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = colors.surface; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawCone(x, w, h) {
      const gy = groundY();
      ctx.fillStyle = colors.busy;
      ctx.beginPath(); ctx.moveTo(x + w * 0.38, gy - h); ctx.lineTo(x + w * 0.62, gy - h); ctx.lineTo(x + w * 0.92, gy - h * 0.12); ctx.lineTo(x + w * 0.08, gy - h * 0.12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = colors.surface; ctx.globalAlpha = 0.85;
      ctx.fillRect(x + w * 0.25, gy - h * 0.62, w * 0.5, h * 0.12); ctx.globalAlpha = 1;
      ctx.fillStyle = colors.ink; rrect(x, gy - h * 0.14, w, h * 0.14, 3); ctx.fill();
    }

    function drawDrone(o) {
      const gy = groundY() - o.y, x = o.x, w = o.w, h = o.h, top = gy - h;
      ctx.fillStyle = colors.ink;
      rrect(x + w * 0.28, top + h * 0.35, w * 0.44, h * 0.5, h * 0.2); ctx.fill();
      ctx.fillRect(x + w * 0.05, top + h * 0.45, w * 0.9, h * 0.12);
      ctx.fillStyle = colors.stop; ctx.beginPath(); ctx.arc(x + w * 0.5, top + h * 0.6, h * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.ink3; ctx.lineWidth = Math.max(2, h * 0.1); ctx.lineCap = 'round';
      const sp = Math.abs(Math.sin(o.phase)) * w * 0.17 + w * 0.04;
      for (const cx of [x + w * 0.12, x + w * 0.88]) { ctx.beginPath(); ctx.moveTo(cx - sp, top + h * 0.2); ctx.lineTo(cx + sp, top + h * 0.2); ctx.stroke(); }
      ctx.fillStyle = colors.ink; ctx.fillRect(x + w * 0.1, top + h * 0.2, w * 0.04, h * 0.3); ctx.fillRect(x + w * 0.86, top + h * 0.2, w * 0.04, h * 0.3);
    }

    function draw() {
      if (!W) return;
      const s = size(), gy = groundY();
      ctx.clearRect(0, 0, W, H);
      // 바닥
      ctx.fillStyle = colors.surface2; ctx.fillRect(0, gy, W, H - gy);
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      ctx.fillStyle = colors.line;
      for (let x = -g.ticks; x < W; x += s * 0.9) ctx.fillRect(x, gy + s * 0.22, s * 0.35, 3);

      for (const o of g.obs) {
        if (o.kind === 'gear') drawGear(o);
        else if (o.kind === 'cone') drawCone(o.x, o.w, o.h);
        else if (o.kind === 'cone2') { drawCone(o.x, o.w * 0.5, o.h); drawCone(o.x + o.w * 0.5, o.w * 0.5, o.h); }
        else drawDrone(o);
      }
      ctx.fillStyle = colors.ink3;
      for (const p of g.sparks) { ctx.globalAlpha = Math.max(0, p.life / 0.4); ctx.fillRect(p.x, p.y - 3, 4, 4); }
      ctx.globalAlpha = 1;
      drawRobot();

      // 안내 문구
      if (g.mode !== 'run') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const fs = Math.max(18, U() * 0.075);
        ctx.fillStyle = colors.ink;
        ctx.font = `800 ${fs}px "Pretendard Variable", Pretendard, sans-serif`;
        ctx.fillText(g.mode === 'ready' ? 'IDF 런' : (g.newBest ? '최고 기록 달성!' : '게임 오버'), W / 2, H * 0.3);
        ctx.font = `600 ${fs * 0.5}px "Pretendard Variable", Pretendard, sans-serif`;
        ctx.fillStyle = colors.ink3;
        ctx.fillText(g.mode === 'ready' ? '화면을 터치해서 시작' : `${g.score}점 · 터치해서 다시 하기`, W / 2, H * 0.3 + fs * 1.1);
      }
    }

    function loop(now) {
      const dt = Math.min(0.033, (now - (last || now)) / 1000);
      last = now;
      update(dt); draw();
      raf = requestAnimationFrame(loop);
    }

    const down = (e) => { e.preventDefault(); g.holding = true; jump(); };
    const up = () => { g.holding = false; };
    const key = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) down(e); } };
    const keyUp = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') up(); };
    const vis = () => { last = 0; };
    const onTheme = () => { readColors(); draw(); };

    card.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('themechange', onTheme);
    document.addEventListener('visibilitychange', vis);
    const ro = new ResizeObserver(resize);
    ro.observe(card);

    readColors(); resize();
    raf = requestAnimationFrame(loop);

    return function stop() {
      cancelAnimationFrame(raf); ro.disconnect();
      card.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('themechange', onTheme);
      document.removeEventListener('visibilitychange', vis);
    };
  }

  window.IDFGame = { mount };
})();
