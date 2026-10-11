// Mechanics chapters ו-י (statics, motion in a plane, momentum, energy, SHM):
// every problem recomputed from first principles and put through the app's
// own answer check, the physics the simulations and animations claim,
// measured from what they actually draw, plus every draggable canvas driven
// by real touch events.
//
//   node tests/check_mech2.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

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
  await p.waitForTimeout(6000);
  const P = (await all('^Σp עכשיו')).map(s => num(s.split('=')[1]));
  spread = Math.max(...P) - Math.min(...P);
  t('momentum conservation sim: Σp unchanged through the collision and the run', P.length > 100 && spread < 0.005, `spread ${spread.toFixed(3)} kg·m/s`);

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
  let RM = Math.min(490 - 116 - 78 - 30, W / 2 - 34), PX = Math.min(200, RM);
  await p.evaluate(() => document.getElementById('btn-pend-reset').click());
  await drag(r, [[W / 2 + Math.sin(0.4) * PX, 78 + Math.cos(0.4) * PX], [W / 2, 78 + PX], [W / 2 - 0.7 * PX, 78 + 0.7 * PX]]);
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
  await drag(r, [[50, 438], [90, 400], [130, 360]]);
  await p.waitForTimeout(700);
  t('projectile: a pull from the cannon fires a shot', !!(await last('tₜₒₜ')));

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

  t('no page errors, touchend included', errs.length === 0, errs.length ? errs.join(' | ') : 'none');
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ MECHANICS ו-י: PHYSICS HOLDS AND EVERY DRAG WORKS BY TOUCH');
  process.exit(fail ? 1 : 0);
})();
