// Mechanics chapters ו-י (statics, motion in a plane, momentum, energy, SHM):
// every problem recomputed from first principles and put through the app's
// own answer check, the physics the simulations and animations claim,
// measured from what they actually draw, plus every draggable canvas driven
// by real touch events, and the learning-experience standards of
// tests/mech_learning.js (misconception boxes, quiz keys, hints, units).
//
//   node tests/check_mech2.js
const { chromium } = require('playwright');
const path = require('path');
const { LR } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

let fail = 0;
const t = (name, ok, got) => {
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${got !== undefined ? ': ' + got : ''}`);
};

const D = Math.PI / 180;
const sf2 = x => { if (!x) return x; const q = Math.floor(Math.log10(Math.abs(x))) - 1; return Math.round(x / 10 ** q) * 10 ** q; };
// key -> v: the value of every step, W: classic wrong answers per step
const EXPECT = {
  'statics.torque': { v: [0.30 * Math.sin(30 * D), 50 * 0.15, 7.5 / 0.30], W: [[0.30, 0.26], [15], [50, 12.5]] },
  'statics.equilibrium': { v: [400 + 150, (400 * 3 + 150 * 6) / 4, 550 - 525, 400 * 1 / 2], W: [[400], [825, 300], [175], [400]] },
  'statics.center-mass': { v: [5 * 2.4 / 8, Math.atan(0.40 / 0.80) / D, Math.atan(0.30) / D], W: [[1.2, 0.9], [63.4], [73.3]] },
  'planar.projectile': { v: [25 * 0.8, 25 * 0.6, 15 * 15 / 20, (3 + Math.sqrt(9 + 16)) / 2, 20 * 4], W: [[15], [20], [31.25], [3], [60]] },
  'planar.circular': { v: [225 / 50, 1200 * 4.5, 225 / (10 * 50), Math.sqrt(0.8 * 10 * 50)], W: [[0.3], [360], [2.22], [400]] },
  'momentum.momentum-def': { v: [0.06 * (-50) - 0.06 * 40, (0.06 * (-50) - 0.06 * 40) / 0.005], W: [[-0.6, 5.4], [1080, -108]] },
  'momentum.momentum-cons': { v: [3 * 6 - 1 * 2, 16 / 4, 0.5 * 3 * 36 + 0.5 * 1 * 4 - 0.5 * 4 * 16], W: [[20], [5], [56, 32]] },
  'momentum.collision': { v: [4 * 6, 4 * 2 + 2 * 8, Math.abs(2 - 8) / Math.abs(6 - 0)], W: [[36], [16], [0]] },
  'energy.kinetic': { v: [0.5 * 2 * 9, 10 * 5, Math.sqrt(2 * (9 + 50) / 2)], W: [[18], [2], [Math.sqrt(50)]] },
  'energy.potential': { v: [3 * 10 * 8, Math.sqrt(2 * 10 * 8)], W: [[24], [160]] },
  'energy.energy-cons': { v: [5 * 10 * 4, -0.2 * 5 * 10 * 6, Math.sqrt(2 * 140 / 5), 4 / 0.2], W: [[20], [60, -12], [Math.sqrt(80)], [6]] },
  'shm.shm-def': { v: [1 / 0.2, 2 * Math.PI * 5, 0.05 * 2 * Math.PI * 5], W: [[0.2], [5], [0.25]] },
  'shm.shm-spring': { v: [2 * Math.PI * Math.sqrt(2 / 200), 0.5 * 200 * 0.01, Math.sqrt(2 * 1 / 2)], W: [[0.1], [2], [Math.SQRT2]] },
  'shm.pendulum': { v: [2 * Math.PI * Math.sqrt(2.5 / 10), 1 / (2 * Math.PI * Math.sqrt(0.25)), 10 * 4 / (4 * Math.PI ** 2)], W: [[0.5], [3.14], [0.51]] },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 1300 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // every canvas label, as drawn (after the app's own label hook)
  await p.addInitScript(() => {
    window.__T = [];
    const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) {
      if (typeof s === 'string') window.__T.push(s.replace(/[⁦-⁩]/g, ''));
      if (window.__T.length > 6000) window.__T.splice(0, 3000);
      return o.apply(this, arguments);
    };
  });
  await p.goto(F);
  await p.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(p);

  const open = async cs => {
    const [c, s] = cs.split('.');
    await p.evaluate(([c, s]) => {
      if (window.closeOnboarding) closeOnboarding();
      try { localStorage.setItem('simtip_' + c + '.' + s, '1'); } catch (e) {}
      state.subject = 'mechanics'; state.chapter = c; state.section = s; state.tab = 'sim'; render(); window.scrollTo(0, 0);
    }, [c, s]);
    await p.waitForTimeout(1400);
    await p.evaluate(() => { document.querySelectorAll('.sim-hint').forEach(e => e.remove()); document.querySelector('#app canvas').scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(250);
    await p.evaluate(() => { window.__T = []; });
  };
  const rect = () => p.evaluate(() => { const r = document.querySelector('#app canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
  const drag = async (r, pts) => {
    const P = q => ({ x: r.x + q[0], y: r.y + q[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
    for (let i = 1; i < pts.length; i++) { await p.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] }); }
    await p.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const all = re => p.evaluate(r => { const R = new RegExp(r); return window.__T.filter(s => R.test(s)); }, re);
  const last = async re => { const a = await all(re); return a.length ? a[a.length - 1] : null; };
  const set = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById('inp-' + id); e.value = v; e.dispatchEvent(new Event('input')); }, [id, v]);
  const num = s => parseFloat(String(s).replace('−', '-'));

  console.log('\n0) every problem in chapters ו-י, recomputed and put through the answer check');
  const secs2 = await p.evaluate(() => MECH_CHAPTERS.slice(5).map(c => c.sections.map(s => c.id + '.' + s.id)).flat());
  t('every section of chapters ו-י has an independent computation', secs2.length === 14 && secs2.every(k => EXPECT[k]), secs2.filter(k => !EXPECT[k]).join(' ') || secs2.length + ' sections');
  const tryAns = (k, si, inp) => p.evaluate(([k, si, inp]) => {
    const [c, s] = k.split('.');
    state.subject = 'mechanics'; state.chapter = c; state.section = s; state.tab = 'problem';
    state.problemState[k] = { idx: 0, inputs: [], solved: [], hints: [], feedback: [], done: false, attempts: [] };
    state.problemState[k].inputs[si] = String(inp);
    chkStep(si);
    return !!state.problemState[k].solved[si];
  }, [k, si, inp]);
  for (const k of secs2) {
    const E = EXPECT[k]; if (!E) continue;
    const steps = await p.evaluate(k => CONTENT[k].problem.steps.map(s => ({ a: parseFloat(s.answer), tol: s.tolerance || 0 })), k);
    const bad = [];
    if (steps.length !== E.v.length) bad.push('steps ' + steps.length + ' vs ' + E.v.length);
    for (let i = 0; i < Math.min(steps.length, E.v.length); i++) {
      const want = E.v[i], st = steps[i];
      if (Math.abs(st.a - want) > Math.max(st.tol, Math.abs(want) * 0.015) + 1e-9) bad.push(`#${i} answer ${st.a}, computed ${want.toPrecision(5)}`);
      if (!(await tryAns(k, i, +want.toPrecision(6)))) bad.push(`#${i} exact value refused`);
      if (!(await tryAns(k, i, +sf2(want).toPrecision(2)))) bad.push(`#${i} ${+sf2(want).toPrecision(2)} (2 s.f.) refused`);
      for (const w of E.W[i] || []) if (await tryAns(k, i, +w.toPrecision(4))) bad.push(`#${i} wrong ${+w.toPrecision(4)} accepted`);
    }
    const q = await p.evaluate(k => CONTENT[k].quiz.every(x => x.correct >= 0 && x.correct < x.opts.length && new Set(x.opts).size === x.opts.length), k);
    if (!q) bad.push('quiz key out of range or a repeated option');
    t(k + ': answers right, roundings accepted, classic errors refused', bad.length === 0, bad.join('; ') || steps.length + ' steps');
  }
  await p.evaluate(() => { state.tab = 'sim'; });

  console.log('\n1) energy in the simulations');
  await open('energy.potential');
  await p.waitForTimeout(8000);
  let E = (await all('^E = Eₚ \\+ Eₖ = ')).map(s => num(s.split('=')[2]));
  let spread = Math.max(...E) - Math.min(...E);
  t('falling ball: E_p + E_k unchanged through 8 s of bounces', E.length > 100 && spread < 0.011, `spread ${spread.toFixed(3)} J over ${E.length} frames`);
  await p.evaluate(() => document.getElementById('btn-ep-elastic').click());
  await p.evaluate(() => { window.__T = []; });
  await p.waitForTimeout(5000);
  E = (await all('\\|\\s+E = ')).map(s => num(s.split('E = ')[1]));
  spread = Math.max(...E) - Math.min(...E);
  t('... and through the elastic contact with the floor', E.length > 50 && spread < 0.011, `spread ${spread.toFixed(3)} J`);

  await open('energy.kinetic');
  await p.evaluate(() => document.getElementById('btn-ek-launch').click());
  await p.waitForTimeout(5000);
  const W1 = num((await last('^W = ')).split('=')[2]), K1 = num((await last('^ΔEₖ')).split('=').pop());
  t('work-energy sim: W = F·d equals ΔE_k after the push', Math.abs(W1 - K1) < 0.02 && W1 > 1, `W ${W1}, ΔE_k ${K1}`);

  await open('energy.energy-cons');
  await set('energy-mu', 0.03);
  await p.evaluate(() => document.getElementById('btn-energy-reset').click());
  await p.evaluate(() => { window.__T = []; });
  await p.waitForTimeout(6000);
  const rows = (await all('\\+ Q = ')).map(s => num(s.split('+ Q = ')[1]));
  spread = Math.max(...rows) - Math.min(...rows);
  t('energy track with friction: E_p + E_k + Q constant', rows.length > 50 && spread < 0.06, `spread ${spread.toFixed(2)} J over ${rows.length} frames`);
  const Q = await last('   Q = [\\d.]+ J$');
  t('... and heat is actually produced', !!Q && num(Q.split('Q = ')[1]) > 1, Q && Q.split('   ').pop());

  await open('momentum.momentum-cons');
  const mcRun = () => p.evaluate(async () => { const cv = document.querySelector('#app canvas'); window.__T = []; document.getElementById('btn-mc-run').click();
    for (let i = 0; i < 700 && cv._probe().st !== 'done'; i++) await new Promise(r => setTimeout(r, 25)); return cv._probe(); });
  let mq = await mcRun();
  let P = (await all('^Σp = ')).map(s => num(s.split('=')[1]));
  spread = Math.max(...P) - Math.min(...P);
  t('momentum conservation, explosion from rest: Σp = 0.00 kg·m/s on every frame of the push and the run', P.length > 30 && spread < 0.005 && Math.abs(P[0]) < 0.005, `${P.length} frames, spread ${spread.toFixed(3)}`);
  const vE = Math.sqrt(2 * 12 * 1.5 / (3 * 4.5));
  t('... and the spring\'s 12 J split exactly: v₁ = −√(2E·m₂/(m₁(m₁+m₂))), v₂ = −(m₁/m₂)v₁', Math.abs(mq.v1 + vE) < 1e-9 && Math.abs(mq.v2 - 2 * vE) < 1e-9, mq.v1.toFixed(4) + ', ' + mq.v2.toFixed(4));
  await p.evaluate(() => document.getElementById('btn-mc-mode').click());
  mq = await mcRun();
  P = (await all('^Σp = ')).map(s => num(s.split('=')[1]));
  spread = Math.max(...P) - Math.min(...P);
  t('sticking: Σp = m₁v₁ + m₂v₂ = 15.00 kg·m/s before, during and after; v = Σp/(m₁+m₂)', P.length > 30 && spread < 0.005 && Math.abs(P[0] - 15) < 0.005 && mq.stuck && Math.abs(mq.v1 - 15 / 4.5) < 1e-9 && mq.v1 === mq.v2, `${P.length} frames, v ${mq.v1.toFixed(3)}`);

  await open('shm.pendulum');
  await set('pend-L', 0.3); await set('pend-g', 25);
  await p.evaluate(() => { window.__T = []; });
  await p.waitForTimeout(4000);
  E = (await all('^Eₖ \\+ Eₚ = ')).map(s => num(s.split('=')[1]));
  spread = Math.max(...E) - Math.min(...E);
  t('pendulum at L = 0.3 m, g = 25: energy held to 2%', spread <= 0.02 * Math.max(...E) + 0.011, `spread ${spread.toFixed(3)} of ${Math.max(...E)} J`);

  console.log('\n2) formulas the simulations print');
  const r80 = await p.evaluate(() => { let a = 1, c = Math.cos(40 * Math.PI / 180); for (let i = 0; i < 30; i++) { const n = (a + c) / 2; c = Math.sqrt(a * c); a = n; } return 1 / a; });
  t('exact pendulum period at 80° is 13.7% longer (AGM)', Math.abs(r80 - 1.1375) < 0.001, r80.toFixed(4));
  const tr = await p.evaluate(() => { const o = {}; [false, true].forEach(f => { const s = _mechTrackTraj(f), E0 = s[0].Ek + s[0].Ep + s[0].Q; let m = 0; s.forEach(q => { m = Math.max(m, Math.abs(q.Ek + q.Ep + q.Q - E0)); }); o[f] = m; }); return o; });
  t('track animation: E_k + E_p (+ Q) closes to 1 mJ, with and without friction', tr.false < 1e-3 && tr.true < 1e-3, `${tr.false.toExponential(1)} / ${tr.true.toExponential(1)} J`);

  console.log('\n3) every draggable canvas, by touch');
  let r, W;
  await open('shm.pendulum'); r = await rect(); W = r.w;
  await p.evaluate(() => document.getElementById('btn-pend-reset').click());
  const pv = await p.evaluate(() => document.querySelector('#app canvas')._probe()), PX = pv.PX * pv.L;   // the pivot and the string, in px
  await drag(r, [[pv.px + Math.sin(0.4) * PX, pv.py + Math.cos(0.4) * PX], [pv.px, pv.py + PX], [pv.px - 0.7 * PX, pv.py + 0.7 * PX]]);
  await p.waitForTimeout(500);
  const amp = await last('θ₀ = ');
  t('pendulum: the bob is dragged to 45°', /θ₀ = 4[45]\.\d°/.test(amp), amp && amp.match(/θ₀ = [\d.]+°/)[0]);

  await open('energy.energy-cons'); r = await rect(); W = r.w;
  await drag(r, [[14 + 0.08 * (W - 28), 290 - 3.18 * 64], [14 + 0.3 * (W - 28), 200], [14 + 0.5 * (W - 28), 290 - 2.8 * 64]]);
  await p.waitForTimeout(120);
  const eh = await last('mgh = ');
  t('energy track: the cart is dragged to the 2.8 m hill', /×2\.[78]\d =/.test(eh), eh && eh.split('   ')[0]);

  await open('shm.shm-spring'); r = await rect(); W = r.w;
  await p.waitForTimeout(150);
  const xm = num((await last('^x = ')).replace('x = ', ''));
  await drag(r, [[0.62 * W + xm * 100, 520 * 0.28], [0.62 * W + 40, 520 * 0.28], [0.62 * W + 80, 520 * 0.28]]);
  await p.waitForTimeout(300);
  const A = await last('^A = ');
  t('spring: the mass is dragged to A = 0.80 m', /A = 0\.[78]\d\d m/.test(A), A);

  await open('energy.potential'); r = await rect(); W = r.w;
  await p.waitForTimeout(150);
  const h0 = num((await last('mgh = ')).split('×')[2]);
  await drag(r, [[W * 0.38, 436 - h0 * 62], [W * 0.38, 260], [W * 0.38, 150]]);
  await p.waitForTimeout(60);
  const hp = num((await last('mgh = ')).split('×')[2]);
  t('falling ball: lifted by touch to about 4.6 m', hp > 4.2, hp + ' m');

  await open('planar.projectile'); r = await rect();
  let pq = await p.evaluate(() => document.querySelector('#app canvas')._probe());
  await drag(r, [[pq.cx + 30, pq.cy - 10], [pq.cx + 70, pq.cy - 70], [pq.cx + 100, pq.cy - 100]]);
  await p.waitForTimeout(300);
  pq = await p.evaluate(() => document.querySelector('#app canvas')._probe());
  t('projectile: a pull from the cannon aims (45°, v₀ = |pull|/4.5) and fires on release', !!pq.shot && pq.shot.th === 45 && pq.shot.v0 === Math.round(Math.hypot(100, 100) / 4.5), pq.shot && pq.shot.th + '°, ' + pq.shot.v0 + ' m/s');

  await open('statics.torque'); r = await rect(); W = r.w;
  let PPM = W * 0.62 / 0.55;
  await drag(r, [[W * 0.20 + 0.30 * PPM, 470 * 0.56], [W * 0.20 + 0.20 * PPM, 470 * 0.56], [W * 0.20 + 0.10 * PPM, 470 * 0.56]]);
  t('torque: the application point slides along the bar', Math.abs(num(await p.evaluate(() => document.getElementById('inp-tq-r').value)) - 0.10) < 0.02);

  await open('statics.equilibrium'); r = await rect(); W = r.w;
  const X0 = W * 0.13, PP = W * 0.74 / 4, BY = 470 * 0.44;
  await drag(r, [[X0 + 3 * PP, BY - 30], [X0 + 2 * PP, BY - 30], [X0 + 1 * PP, BY - 30]]);
  t('beam: the load is dragged to x = 1 m', Math.abs(num(await p.evaluate(() => document.getElementById('inp-bm-xp').value)) - 1) < 0.15);

  await open('statics.center-mass'); r = await rect(); W = r.w;
  await drag(r, [[W * 0.6, 300], [W * 0.6, 250], [W * 0.6, 200]]);
  t('centre of mass: dragging tilts the ramp', num(await p.evaluate(() => document.getElementById('inp-cm-th').value)) > 25);

  console.log('\n3b) circular motion: the string is the net force; cut it and the puck leaves along the tangent');
  const probe = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const model = () => p.evaluate(() => { const e = document.querySelector('#app .sk-model'); return e ? e.textContent : ''; });
  const missionsDone = () => p.evaluate(() => [...document.querySelectorAll('#app .sk-m')].map(li => li.classList.contains('done')));
  await open('planar.circular');
  for (const [R, v, m] of [[2, 4, 0.5], [0.8, 6, 1.5], [3, 1.5, 0.2]]) {
    await set('circ-r', R); await set('circ-v', v); await set('circ-m', m); await p.waitForTimeout(350);
    const ml = await model(), Fm = ml.match(/= ([\d.]+) N\s*$/), q = await probe();
    t(`circular R = ${R} m, v = ${v} m/s, m = ${m} kg: the model line prints F = mv²/R`, !!Fm && Math.abs(num(Fm[1]) - m * v * v / R) < 0.006 && Math.abs(q.F - m * v * v / R) < 1e-9, ml.slice(-40));
    const r2 = Math.hypot(q.x, q.y), dot = q.x * q.vx + q.y * q.vy;
    t('... the puck is on the circle, its velocity tangent (v·r = 0) and of size v', Math.abs(r2 - R) < 1e-9 && Math.abs(dot) < 1e-9 && Math.abs(Math.hypot(q.vx, q.vy) - v) < 1e-9, `|r| ${r2.toFixed(3)}, v·r ${dot.toExponential(1)}`);
  }
  await set('circ-r', 2); await set('circ-v', 4); await set('circ-m', 0.5); await p.waitForTimeout(200);
  t('circular: a prediction is asked before the first cut', await p.evaluate(() => { const q = document.querySelector('#app .sk-predict'); return !!q && !q.hidden && q.querySelectorAll('.sk-opt').length === 3; }));
  await p.evaluate(() => document.getElementById('btn-circ-cut').click());
  await p.waitForTimeout(150);
  t('... and the string cannot be cut until it is answered', !(await probe()).cut);
  await p.evaluate(() => document.querySelectorAll('#app .sk-opt')[1].click());
  // two samples of the flight, timed inside the page
  const fl = await p.evaluate(async () => {
    const pr = () => document.querySelector('#app canvas')._probe();
    await new Promise(r => setTimeout(r, 60));
    const a = pr();
    await new Promise(r => setTimeout(r, 400));
    const b = pr();
    return { a, b, dt: b.clock - a.clock };          // the sim's own clock: a slow frame is capped, not skipped
  });
  const th = fl.a.thCut, P0 = [2 * Math.cos(th), 2 * Math.sin(th)], U = [-Math.sin(th), Math.cos(th)];
  const off = q => (q.x - P0[0]) * U[1] - (q.y - P0[1]) * U[0];         // distance from the tangent line
  const along = q => (q.x - P0[0]) * U[0] + (q.y - P0[1]) * U[1];
  const spd = (along(fl.b) - along(fl.a)) / fl.dt;
  t('after the cut the puck moves on the tangent line at the cut point (not outward)', fl.a.cut && Math.abs(off(fl.a)) < 1e-6 && Math.abs(off(fl.b)) < 1e-6 && along(fl.b) > along(fl.a), `off-line ${off(fl.b).toExponential(1)} m`);
  t('... at the speed it had (4 m/s), with the velocity unchanged', Math.abs(spd - 4) < 1e-6 && Math.abs(fl.b.vx - 4 * U[0]) < 1e-9 && Math.abs(fl.b.vy - 4 * U[1]) < 1e-9, spd.toFixed(4) + ' m/s');
  t('... and the model line says ΣF = 0', /ΣF = 0/.test(await model()));
  // the target mission: cut where the tangent passes through the target
  await p.evaluate(() => document.getElementById('btn-circ-cut').click());   // tie it again
  await p.waitForTimeout(200);
  const hit = await p.evaluate(async () => {
    const cv = document.querySelector('#app canvas'), q = cv._probe(), T = q.target, d = Math.hypot(T.x, T.y);
    const want = Math.atan2(T.y, T.x) - Math.acos(q.R / d);              // counter-clockwise: the tangent through T
    const wrap = a => { a %= 2 * Math.PI; return a < 0 ? a + 2 * Math.PI : a; };
    for (let i = 0; i < 400; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const th = cv._probe().th;
      if (Math.abs(wrap(th - want + Math.PI) - Math.PI) < 0.035) { document.getElementById('btn-circ-cut').click(); break; }
    }
    await new Promise(r => setTimeout(r, 2200));
    return cv._probe().hits;
  });
  t('mission: cutting where the tangent meets the target hits it', hit >= 1, hit + ' hit(s)');
  // each speed is held for half a second of the sim's own time before it counts
  const held = () => p.evaluate(async () => { const cv = document.querySelector('#app canvas'), c0 = cv._probe().clock; while (cv._probe().clock - c0 < 0.7) await new Promise(r => setTimeout(r, 30)); });
  await set('circ-v', 2); await held(); await set('circ-v', 4); await held();
  await set('circ-r', 1.6); await set('circ-v', 5); await p.waitForTimeout(500);
  const md = await missionsDone();
  t('missions: the target, v doubled (F ×4) and T = 2πR/v = 2 s are each reachable', md.length === 3 && md.every(Boolean), JSON.stringify(md));
  // dragging the puck outward sets the radius
  await set('circ-r', 2); await set('circ-v', 1); await p.waitForTimeout(300);
  r = await rect();
  const q0 = await probe();
  await drag(r, [[q0.px, q0.py], [q0.cx + (q0.px - q0.cx) * 1.15, q0.cy + (q0.py - q0.cy) * 1.15], [q0.cx + (q0.px - q0.cx) * 1.3, q0.cy + (q0.py - q0.cy) * 1.3]]);
  await p.waitForTimeout(150);
  const rr = num(await p.evaluate(() => document.getElementById('inp-circ-r').value));
  t('circular: dragging the puck outward sets R (2 m → 2.6 m)', !(await probe()).cut && Math.abs(rr - 2.6) < 0.15, rr + ' m');

  console.log('\n3c) projectile: two independent motions, the exact landing, the missions');
  await open('planar.projectile');
  const pjProbe = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const landed = () => p.evaluate(async () => { const cv = document.querySelector('#app canvas'); for (let i = 0; i < 400 && cv._probe().fly; i++) await new Promise(r => setTimeout(r, 25)); return cv._probe(); });
  // in flight: x = v₀cosθ·t exactly (vₓ never changes), y = h + v₀sinθ·t − ½gt²
  await set('proj-v0', 25); await set('proj-angle', 37); await set('proj-h', 20); await p.waitForTimeout(200);
  const ml0 = await model();
  t('projectile: before the shot the model line gives vₓ = v₀cosθ', ml0.includes('vₓ = v₀cosθ = 25 × cos37° = ' + (25 * Math.cos(37 * D)).toFixed(1) + ' m/s'), ml0.slice(0, 80));
  await p.evaluate(() => document.getElementById('btn-proj-launch').click());
  const fs = await p.evaluate(async () => { const cv = document.querySelector('#app canvas'), o = [];
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 120)); const q = cv._probe(); if (q.trail && q.fly) o.push(q.trail); } return o; });
  const sh = (await pjProbe()).shot, vx = 25 * Math.cos(37 * D), vy = 25 * Math.sin(37 * D);
  t('in flight vₓ stays v₀cosθ: x = v₀cosθ·t at every sample', fs.length > 5 && fs.every(q => Math.abs(q.x - vx * q.t) < 1e-9), fs.length + ' samples');
  t('... and y = h + v₀sinθ·t − ½gt² (vertical motion on its own)', fs.every(q => Math.abs(q.y - (20 + vy * q.t - 4.9 * q.t * q.t)) < 1e-9));
  let lq = await landed();
  const tfW = (vy + Math.sqrt(vy * vy + 2 * 9.8 * 20)) / 9.8;
  t('the landing is the root of y(t) = 0 from the 20 m tower: t and R = v₀cosθ·t exact', Math.abs(lq.shot.tf - tfW) < 1e-9 && Math.abs(lq.shot.R - vx * tfW) < 1e-9 && lq.shot.t === lq.shot.tf, `t ${lq.shot.tf.toFixed(3)} s, R ${lq.shot.R.toFixed(2)} m`);
  await p.waitForTimeout(250);                       // the model line is refreshed eight times a second
  const mlL = await model(), mR = mlL.match(/R = v₀cosθ·t = [\d.]+ × [\d.]+ = ([\d.]+) m/);
  t('... and the model line prints that R', !!mR && Math.abs(+mR[1] - vx * tfW) < 0.051, mR && mR[1]);
  // missions: the target at two angles from the ground, then the horizontal shot beside the dropped ball
  await set('proj-h', 0); await p.waitForTimeout(150);
  const T0 = (await pjProbe()).target, v0m = Math.ceil(Math.sqrt(9.8 * T0 / 0.8)), th1 = Math.asin(9.8 * T0 / v0m ** 2) / 2 / D;
  await set('proj-v0', v0m);
  for (const th of [Math.round(th1), Math.round(90 - th1)]) {
    await set('proj-angle', th); await p.waitForTimeout(80);
    await p.evaluate(() => document.getElementById('btn-proj-launch').click()); lq = await landed();
  }
  t(`target ${T0} m hit at ${Math.round(th1)}° and ${Math.round(90 - th1)}° (v₀ = ${v0m} m/s): complementary angles, one range`, lq.hits >= 2 && lq.target === T0, lq.hits + ' hits');
  await set('proj-h', 20); await set('proj-angle', 0); await p.waitForTimeout(150);
  await p.evaluate(() => { const b = document.getElementById('btn-proj-twin'); if (b.dataset.on !== '1') b.click(); document.getElementById('btn-proj-launch').click(); });
  lq = await landed();
  t('θ = 0° from 20 m: the fired ball and the dropped one land at the same instant, √(2h/g)', lq.twin && Math.abs(lq.twin.land - lq.shot.tf) < 1e-12 && Math.abs(lq.shot.tf - Math.sqrt(40 / 9.8)) < 1e-12, lq.shot.tf.toFixed(4) + ' s');
  const pjm = await missionsDone();
  t('projectile missions: hit, two angles, the same landing time — all reachable', pjm.length === 3 && pjm.every(Boolean), JSON.stringify(pjm));

  console.log('\n3d) collisions: Σp in every collision, Eₖ only in an elastic one; the lost part is heat');
  await open('momentum.collision');
  const colProbe = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const colRun = () => p.evaluate(async () => { const cv = document.querySelector('#app canvas'); document.getElementById('btn-col-run').click();
    for (let i = 0; i < 700 && cv._probe().st !== 'done'; i++) await new Promise(r => setTimeout(r, 25)); return cv._probe(); });
  const bad3 = [];
  for (const [m1, m2, u1, u2, e] of [[3, 2, 4, -2, 1], [3, 2, 4, -2, 0], [2, 6, 5, 0, 0.5], [1, 8, 6, -1, 0.8], [4, 4, 2, 2, 1]]) {
    await set('col-m1', m1); await set('col-m2', m2); await set('col-v1', u1); await set('col-v2', u2); await set('col-e', e); await p.waitForTimeout(60);
    const q = await colRun();
    const meet = u1 > u2, w1 = meet ? ((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / (m1 + m2) : u1, w2 = meet ? ((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / (m1 + m2) : u2;
    const p0 = m1 * u1 + m2 * u2, pf = m1 * q.v1 + m2 * q.v2, K0 = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2, Kf = 0.5 * m1 * q.v1 * q.v1 + 0.5 * m2 * q.v2 * q.v2;
    const dK = meet ? m1 * m2 / (2 * (m1 + m2)) * (1 - e * e) * (u1 - u2) ** 2 : 0;
    const ok = q.hit === meet && Math.abs(q.v1 - w1) < 1e-9 && Math.abs(q.v2 - w2) < 1e-9 && Math.abs(pf - p0) < 1e-9 && Math.abs(K0 - Kf - dK) < 1e-9 && (!meet || Math.abs((q.v2 - q.v1) - e * (u1 - u2)) < 1e-9);
    if (!ok) bad3.push(`${m1},${m2},${u1},${u2},e=${e}: v' ${q.v1.toFixed(3)},${q.v2.toFixed(3)} want ${w1.toFixed(3)},${w2.toFixed(3)}`);
  }
  t('five collisions: v₁′, v₂′ from e, Σp unchanged, ΔEₖ = m₁m₂(1−e²)(v₁−v₂)²/2(m₁+m₂), v_rel′ = e·v_rel', bad3.length === 0, bad3.join(' | ') || 'all exact');
  const mlc = await model();
  t('... (the last pair never meets: the model line still states Σp before)', /Σp = m₁v₁ \+ m₂v₂ = 4\.0 × 2\.0 \+ 4\.0 × 2\.0 = 16\.00 kg·m\/s/.test(mlc), mlc.slice(0, 70));
  // the prediction sets up the head-on sticking collision and runs it
  await p.evaluate(() => document.querySelectorAll('#app .sk-opt')[1].click());
  await p.waitForTimeout(400);
  let cq = await p.evaluate(async () => { const cv = document.querySelector('#app canvas'); for (let i = 0; i < 400 && cv._probe().st !== 'done'; i++) await new Promise(r => setTimeout(r, 25)); return cv._probe(); });
  t('the prediction\'s experiment: equal carts head-on, stuck — both stop, Σp = 0 before and after', cq.hit && cq.joined && cq.v1 === 0 && cq.v2 === 0 && cq.u1 === -cq.u2, `${cq.u1} / ${cq.u2} → ${cq.v1}, ${cq.v2}`);
  await set('col-e', 0); await set('col-m1', 2); await set('col-m2', 2); await set('col-v1', 5); await set('col-v2', 0); await colRun();
  await set('col-e', 1); await set('col-v1', 3); await set('col-v2', -1); cq = await colRun();
  t('equal masses, elastic: the carts swap velocities', Math.abs(cq.v1 - -1) < 1e-9 && Math.abs(cq.v2 - 3) < 1e-9, cq.v1 + ', ' + cq.v2);
  const cm = await missionsDone();
  t('collision missions: both stop, half the Eₖ to heat, the swap — all reachable', cm.length === 3 && cm.every(Boolean), JSON.stringify(cm));
  // drag the first cart's arrow before a run
  await p.evaluate(() => document.getElementById('btn-col-reset').click());
  await set('col-v1', 2); await p.waitForTimeout(200);
  r = await rect(); W = r.w;
  const cx1 = 26 + 2.6 * (W - 52) / 10;
  await drag(r, [[cx1 + 26, 150 - 52], [cx1 + 40, 150 - 52], [cx1 + 52, 150 - 52]]);
  const v1d = num(await p.evaluate(() => document.getElementById('inp-col-v1').value));
  t('collision: dragging the v₁ arrow sets v₁ (2 → 4 m/s)', Math.abs(v1d - 4) < 0.51, v1d + ' m/s');

  console.log('\n3e) momentum conservation: an isolated system, and what an external force does');
  await open('momentum.momentum-cons');
  await set('mc-m1', 3); await set('mc-m2', 1); await p.waitForTimeout(100);
  mq = await mcRun();
  t('explosion 3 kg | 1 kg: the light cart flies off exactly 3 times as fast (m₁|v₁| = m₂|v₂|)', Math.abs(Math.abs(mq.v2 / mq.v1) - 3) < 1e-9 && Math.abs(3 * mq.v1 + 1 * mq.v2) < 1e-12, (mq.v2 / mq.v1).toFixed(6));
  await p.evaluate(() => document.getElementById('btn-mc-mode').click());
  await set('mc-m1', 3); await set('mc-m2', 1); await set('mc-v1', 6); await set('mc-v2', -2); await p.waitForTimeout(100);
  mq = await mcRun();
  t('the section\'s problem: 3 kg at +6 m/s sticks to 1 kg at −2 m/s → 4 m/s', mq.stuck && Math.abs(mq.v1 - 4) < 1e-9, mq.v1 + ' m/s');
  await p.evaluate(() => document.getElementById('btn-mc-air').click());
  await set('mc-m2', 4); await set('mc-v2', 0); await p.waitForTimeout(100);
  mq = await mcRun();
  const pf = mq.m1 * mq.v1 + mq.m2 * mq.v2;
  t('with the air off, friction (external) changes Σp: 18 kg·m/s at the start, less at the end', mq.p0 === 18 && pf < 18 - 0.3, pf.toFixed(2) + ' kg·m/s');
  const mcm = await missionsDone();
  t('momentum missions: 3× the speed, the problem, Σp changed by friction — all reachable', mcm.length === 3 && mcm.every(Boolean), JSON.stringify(mcm));

  console.log('\n3f) SHM as the shadow of circular motion: x, v, a and their phases');
  await open('shm.shm-def');
  const shp = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const pauseWhen = f => p.evaluate(async src => { const cv = document.querySelector('#app canvas'), ok = new Function('q', 'return ' + src);
    for (let i = 0; i < 600; i++) { await new Promise(r => requestAnimationFrame(r)); if (ok(cv._probe())) { document.getElementById('btn-shm-pause').click(); break; } }
    await new Promise(r => setTimeout(r, 300)); return cv._probe(); }, f);
  let sq = await pauseWhen('Math.abs(q.x) < 0.03 * q.A');
  let mls = await model(), nm = (mls.match(/[−-]?\d+\.\d+/g) || []).map(num);
  // model: x = A·cos(...) = 8.0 cm × cos(θ) = x cm / v = … m/s, vmax = … / a = −ω²x = −w² × x = a
  const xs = nm[2] / 100, vs = nm[3], vmx = nm[4], as2 = nm[nm.length - 1], xa = nm[nm.length - 2], mw2 = nm[nm.length - 3];   // mw2 = −ω²
  t('paused at the centre: the model line gives x ≈ 0, |v| = vₘₐₓ = Aω, a = −ω²x', !sq.run && Math.abs(xs) < 0.003 && Math.abs(Math.abs(vs) - 0.08 * Math.PI) < 0.004 && Math.abs(vmx - 0.08 * Math.PI) < 0.0006 && Math.abs(mw2 + Math.PI ** 2) < 0.006 && Math.abs(as2 - mw2 * xa) < 0.002 && Math.abs(xa - xs) < 0.0001, mls.slice(0, 120));
  t('... and v² + ω²x² = (Aω)² at that moment (the shadow of a uniform circle)', Math.abs(sq.v ** 2 + sq.w ** 2 * sq.x ** 2 - (sq.A * sq.w) ** 2) < 1e-12 && Math.abs(sq.acc + sq.w ** 2 * sq.x) < 1e-12);
  await p.evaluate(() => document.getElementById('btn-shm-pause').click());
  sq = await pauseWhen('Math.abs(q.x) > 0.985 * q.A');
  t('paused at an end: v ≈ 0 and |a| = Aω², pointing to the centre (a·x < 0)', Math.abs(sq.v) < 0.18 * sq.A * sq.w && Math.abs(Math.abs(sq.acc) - sq.A * sq.w * sq.w) < 0.02 * sq.A * sq.w * sq.w && sq.acc * sq.x < 0, `v ${sq.v.toFixed(3)}, a ${sq.acc.toFixed(3)}`);
  const ph0 = (await shp()).th;
  await set('shm-T', 3.3); await p.waitForTimeout(200);
  const ph1 = (await shp()).th;
  t('changing T (paused) does not make the mass jump: θ = ωt + φ is continuous', Math.abs(ph1 - ph0) < 1e-9, ph0.toFixed(4) + ' → ' + ph1.toFixed(4));
  await set('shm-A', 8); await set('shm-T', 1); await p.waitForTimeout(200);
  const shm = await missionsDone();
  t('SHM missions: paused at the fastest point, at the greatest acceleration, vₘₐₓ = 0.50 m/s', shm.length === 3 && shm.every(Boolean), JSON.stringify(shm));
  // drag P outward: the amplitude follows
  r = await rect();
  const pp = await p.evaluate(() => { const cv = document.querySelector('#app canvas'), q = cv._probe(); return q; });
  const geo = await p.evaluate(() => { const W = document.querySelector('#app canvas').getBoundingClientRect().width, PH = W < 560, LW = PH ? W : Math.round(W * 0.46), RM = PH ? Math.min(78, W * 0.22) : Math.min(122, LW * 0.3), CX = PH ? W * 0.5 : LW * 0.52, CY = PH ? 24 + RM + 10 : 30 + RM + 14; return { RM, CX, CY }; });
  const PXM = geo.RM / 0.13, Px = geo.CX + pp.A * PXM * Math.cos(pp.th), Py = geo.CY - pp.A * PXM * Math.sin(pp.th);
  await drag(r, [[Px, Py], [geo.CX + 0.10 * PXM * Math.cos(pp.th), geo.CY - 0.10 * PXM * Math.sin(pp.th)], [geo.CX + 0.11 * PXM * Math.cos(pp.th), geo.CY - 0.11 * PXM * Math.sin(pp.th)]]);
  const Ad = num(await p.evaluate(() => document.getElementById('inp-shm-A').value));
  t('SHM: dragging P outward sets the amplitude (8 → 11 cm)', Math.abs(Ad - 11) < 0.6, Ad + ' cm');

  console.log('\n3g) pendulum: the stopwatch against T₀ and the exact period; mass does not matter');
  await open('shm.pendulum');
  const pdp = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  // the reset puts the bob at rest at 0.4 rad, where a finger can catch it, then the drag sets the angle
  const swingTo = async deg => { await p.evaluate(() => document.getElementById('btn-pend-reset').click()); const pv = await pdp(), R = pv.PX * pv.L, a = deg * D; r = await rect();
    await drag(r, [[pv.px + Math.sin(0.4) * R, pv.py + Math.cos(0.4) * R], [pv.px + Math.sin((a + 0.4) / 2) * R, pv.py + Math.cos((a + 0.4) / 2) * R], [pv.px + Math.sin(a) * R, pv.py + Math.cos(a) * R]]); };
  const measure = () => p.evaluate(async () => { const cv = document.querySelector('#app canvas'); for (let i = 0; i < 500; i++) { await new Promise(r => setTimeout(r, 25)); const q = cv._probe(); if (q.Tmeas !== null) { await new Promise(r => setTimeout(r, 2600)); return cv._probe().Tmeas; } } return null; });
  const agmT = deg => { let a = 1, c = Math.cos(deg * D / 2); for (let i = 0; i < 30; i++) { const n = (a + c) / 2; c = Math.sqrt(a * c); a = n; } return 1 / a; };
  const T0p = 2 * Math.PI * Math.sqrt(1 / 9.8);
  await p.evaluate(() => document.getElementById('btn-pend-reset').click()); await p.waitForTimeout(100);
  await swingTo(60); await p.waitForTimeout(100);
  const A60 = (await pdp()).amp0 / D;                // the angle it was released from
  const T60 = await measure();
  t(`stopwatch at θ₀ = ${A60.toFixed(1)}°: the measured period is the exact one (T₀ × ${agmT(A60).toFixed(4)}), not 2π√(L/g)`, !!T60 && Math.abs(T60 / (T0p * agmT(A60)) - 1) < 0.003 && T60 / T0p > 1.06, T60 && T60.toFixed(4) + ' s vs T₀ ' + T0p.toFixed(4));
  await set('pend-m', 4); await p.waitForTimeout(100); await swingTo(60); await p.waitForTimeout(100);
  const T60b = await measure();
  t('a bob 4 times heavier, same L, g and amplitude: the same period', !!T60b && Math.abs(T60b / T60 - 1) < 0.003, T60b && T60b.toFixed(4) + ' s');
  await swingTo(70); await p.waitForTimeout(300);
  await swingTo(7); await p.waitForTimeout(200);
  await set('pend-L', 1); await set('pend-g', 9.8); await p.waitForTimeout(300);
  const pdm = await missionsDone();
  t('pendulum missions: mass does not matter, 10 % longer at large amplitude, the seconds pendulum', pdm.length === 3 && pdm.every(Boolean), JSON.stringify(pdm));

  console.log('\n3h) energy track: a shape the learner draws, the same speed at the bottom, and where the energy goes');
  await open('energy.energy-cons');
  const ep = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const EX = (q, xf) => q.geo.x0 + xf * q.geo.xw, EY = (q, h) => q.geo.fy - h * q.geo.ppm;
  const epUntil = (cond, ms) => p.evaluate(async ([c, ms]) => { const f = new Function('q', 'return ' + c), cv = document.querySelector('#app canvas');
    for (let i = 0; i < ms / 25; i++) { const q = cv._probe(); if (f(q)) return q; await new Promise(r => setTimeout(r, 25)); } return cv._probe(); }, [cond, ms]);
  const KN0 = (await ep()).KN;
  t('energy track: a prediction is asked first (steep or winding slide?)', await p.evaluate(() => { const q = document.querySelector('#app .sk-predict'); return !!q && !q.hidden && q.querySelectorAll('.sk-opt').length === 3; }));
  let eq = await ep(); r = await rect();
  await drag(r, [[EX(eq, 0.5), EY(eq, 2.8)], [EX(eq, 0.5), EY(eq, 3.2)], [EX(eq, 0.5), EY(eq, 3.6)]]);
  eq = await ep();
  t('energy track: the middle handle is dragged by touch to a 3.6 m hill', Math.abs(eq.KN[4] - 3.6) < 0.04 && eq.KN.every((h, i) => i === 4 || h === KN0[i]), eq.KN[4].toFixed(3) + ' m');
  t('... and the track never overshoots its handles: it stays between 0.2 m and the 4 m ends', eq.hmin >= 0.2 - 1e-9 && eq.hmin < 0.201 && eq.hmax <= 4 + 1e-9, eq.hmin.toFixed(4) + '–' + eq.hmax.toFixed(4) + ' m');
  const toEnd = async () => { const q = await ep(); r = await rect(); await drag(r, [[q.cx, q.cy], [EX(q, 0.1), EY(q, 3.2)], [EX(q, 0) - 8, EY(q, 4)]]); };
  await toEnd(); eq = await ep();
  t('... the cart is dragged by touch to the end of the track, 4 m up', eq.run && eq.run.h0 === 4 && eq.run.xf0 === 0, eq.run && eq.run.h0.toFixed(3));
  await p.evaluate(() => { window.__T = []; });
  eq = await epUntil('q.crossed', 15000);
  t('released from 4 m, the cart crosses the 3.6 m hill (mission 1)', eq.crossed);
  eq = await epUntil('q.run.vmax > 8 && q.xf > 0.85', 15000);
  const vth = Math.sqrt(2 * 9.8 * (4 - eq.run.hb));
  t('... its top speed is √(2g(h₀ − h)) at the lowest point, to 0.2%', Math.abs(eq.run.vmax / vth - 1) < 0.002 && Math.abs(eq.run.hb - 0.2) < 0.02, `${eq.run.vmax.toFixed(3)} m/s at ${eq.run.hb.toFixed(3)} m, √(2g·Δh) = ${vth.toFixed(3)}`);
  E = (await all('^Eₚ \\+ Eₖ = [\\d.]+ J')).map(s => num(s.split('= ')[1]));
  spread = Math.max(...E) - Math.min(...E);
  t('... and Eₚ + Eₖ = 39.2 J on every frame (m = 1 kg, h₀ = 4 m)', E.length > 30 && spread === 0 && E[0] === 39.2, `${E.length} frames, spread ${spread}`);
  let eml = await model(), emm = eml.match(/\(([\d.]+) − ([\d.]+)\)\)\s*=\s*([\d.]+)\s*m\/s/);
  t('... the model line computes v = √(2g(h₀ − h)) from the numbers it prints', !!emm && Math.abs(Math.sqrt(2 * 9.8 * (num(emm[1]) - num(emm[2]))) - num(emm[3])) < 0.006, eml.slice(-46));
  eq = await ep(); r = await rect();
  await drag(r, [[EX(eq, 0.625), EY(eq, eq.KN[5])], [EX(eq, 0.625), EY(eq, 2.0)], [EX(eq, 0.625), EY(eq, 2.6)]]);
  await toEnd();
  eq = await epUntil('q.sameBottom', 15000);
  t('a different hill, released again from 4 m: the same top speed (mission 2)', eq.sameBottom && Math.abs(eq.KN[5] - 2.6) < 0.04 && Math.abs(eq.sameV[1] / eq.sameV[0] - 1) < 0.002 && Math.abs(eq.sameV[1] / Math.sqrt(2 * 9.8 * 3.8) - 1) < 0.002, eq.sameV && eq.sameV.map(x => x.toFixed(3)).join(' vs ') + ' m/s');
  await p.evaluate(() => document.getElementById('btn-energy-shape').click());
  eq = await ep();
  t('"Original track" puts every handle back', JSON.stringify(eq.KN) === JSON.stringify(KN0));
  await set('energy-mu', 0.1);
  await p.evaluate(() => document.getElementById('btn-energy-reset').click());
  const h0f = (await ep()).h;
  eq = await epUntil('q.atRest', 40000);
  const Ef = 9.8 * eq.m * h0f, Qf = 9.8 * eq.m * (h0f - eq.h);
  t('with μ = 0.1 the cart comes to rest where static friction can hold it: |tan θ| ≤ μ', eq.atRest && Math.abs(Math.tan(eq.th)) <= 0.1 + 1e-9, eq.atRest && `h ${eq.h.toFixed(3)} m, tan θ ${Math.tan(eq.th).toFixed(4)}`);
  t('... and the heat is exactly the lost Eₚ: Q = mg(h₀ − h) (mission 3)', eq.restQ && Math.abs(eq.Q - Qf) < 1e-9 && Math.abs(eq.E + eq.Q - Ef) < 1e-9, `Q ${eq.Q.toFixed(3)} J of ${Ef.toFixed(2)} J`);
  eml = await model(); emm = eml.match(/=\s*([\d.]+) \+ ([\d.]+) \+ ([\d.]+) = ([\d.]+)\s*J/);
  t('... the model line adds Eₚ + Eₖ + Q to the energy it started with', !!emm && Math.abs(num(emm[1]) + num(emm[2]) + num(emm[3]) - num(emm[4])) < 0.15 && Math.abs(num(emm[4]) - Ef) < 0.06, emm && emm[0]);
  const edm = await missionsDone();
  t('energy track missions: over a hill, the same speed on any shape, the heat', edm.length === 3 && edm.every(Boolean), JSON.stringify(edm));
  await set('energy-mu', 0);

  console.log('\n4) misconception boxes, quiz keys, hints, units');
  await require('./mech_learning')(p, ['statics', 'planar', 'momentum', 'energy', 'shm'], t);

  t('no page errors, touchend included', errs.length === 0, errs.length ? errs.join(' | ') : 'none');
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ MECHANICS ו-י: PHYSICS HOLDS AND EVERY DRAG WORKS BY TOUCH');
  process.exit(fail ? 1 : 0);
})();
