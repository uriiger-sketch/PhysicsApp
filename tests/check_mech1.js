// Mechanics chapters א-ה (kinematics, vectors, forces, Newton's laws,
// friction and springs): every guided problem recomputed from first
// principles and put through the app's own answer check, the numbers the
// simulations print held to the formulas beside them, and the draggable
// canvases driven by real touch events.
//
//   node tests/check_mech1.js
//
// 1) Each step's stated answer must agree with an independent computation
//    (to its own tolerance, or 1.5 %, whichever is looser). Then, through
//    chkStep() itself: the exact value and its two-significant-figure
//    rounding are accepted, and the classic wrong answers are rejected.
// 2) Simulation readouts, read from what is drawn: x = x0 + vt, v = at,
//    h = v0²/2g, v̄ - v(t0) = kΔt, vector sums and components, ΣF = ma,
//    the incline (sliding and holding), Atwood, W = mg, μN, the stopping
//    distance actually travelled, F = mg cosθ, T = 2π√(m/k), and every
//    slider's default on its own step grid.
// 3) Touch drags that must move the quantity they claim to.
// 4) The learning-experience standards of tests/mech_learning.js.
const { chromium } = require('playwright');
const path = require('path');
const { L, LR } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

let fail = 0, n = 0;
const t = (name, ok, info) => { n++; if (!ok) { fail++; console.log(`   FAIL ${name}${info !== undefined ? ': ' + info : ''}`); } else if (process.env.VERBOSE) console.log(`   PASS ${name}${info !== undefined ? ': ' + info : ''}`); };

const D = Math.PI / 180;
// two significant figures, as a student who rounds would type it
const sf2 = x => { if (!x) return x; const p = Math.floor(Math.log10(Math.abs(x))) - 1; return Math.round(x / 10 ** p) * 10 ** p; };
// key -> [value of every step]; a string is a word answer. W: classic wrong answers per step
const EXPECT = {
  'kinematics.distance-time': { v: [4 - 0, 4 + 1 + 5, 0 - 0], W: [[-4], [5, 0], [10]] },
  'kinematics.const-velocity': (() => { const b = 290 + 100 * 0.5; return { v: [70, b, b / (70 + 100)], W: [[100], [290, 240], [290 / 170, 1.5]] }; })(),
  'kinematics.avg-instant-vel': { v: [(2 * 2 - 1) / 1, (1.5 ** 2 - 1) / 0.5, 2 * 1], W: [[4, 2], [3], [1, 2.5]] },
  'kinematics.acceleration': (() => { const v0 = 90 / 3.6, a = (0 - v0) / 4; return { v: [v0, a, -v0 * v0 / (2 * a)], W: [[90, 324], [-a, -22.5], [100, 25]] }; })(),
  'kinematics.freefall': { v: [80 + 20 ** 2 / 20, 20 / 10, Math.sqrt(20 ** 2 + 2 * 10 * 80)], W: [[20, 80], [4], [40, 20]] },
  'vectors.vec-intro': { v: ['V', 'V', 'S'], W: [['S'], ['S'], ['V']] },
  'vectors.vec-ops': { v: [Math.hypot(5, 12), Math.atan2(12, 5) / D], W: [[17, 7], [22.6]] },
  'vectors.vec-components': { v: [50 * 0.8, 50 * 0.6, 50 * 0.8 + 50], W: [[30], [40], [100]] },
  'forces.force-intro': { v: [5 * 10, 5 * 10, 20], W: [[5], [70], [0]] },
  'forces.inertia': { v: [0.5 * 9.8, 0.5 * 9.8 + 6], W: [[0.5], [4.9, 1.1]] },
  'forces.n3-law': { v: [120, 120 / 60, 120 / 40 * 0.5], W: [[0], [1.2, 3], [1, 0.6]] },
  'forces.force-types': { v: [4 * 10, 0.25 * 40, (20 - 0.25 * 40) / 4], W: [[20], [5], [5]] },
  'forces.tension': { v: [4 * 10, 4 * (10 + 5), 4 * (10 - 4)], W: [[4], [20, 40], [56, 16]] },
  'forces.normal-force': { v: [60 * Math.cos(30 * D), 60 * Math.sin(30 * D)], W: [[60, 30], [52]] },
  'newton2.n2-law': { v: [60 - 24, (60 - 24) / 15, (60 - 24) / 15 * 5], W: [[84], [4, 5.6], [20]] },
  'newton2.n2-apps': { v: [2 * 10 * 0.8, 10 * (0.6 + 0.2 * 0.8), 7.6 ** 2 / (2 * 10 * (0.6 + 0.2 * 0.8))], W: [[20, 12], [4.4, 6], [7.6 ** 2 / 8.8]] },
  'newton2.n2-atwood': { v: [(6 - 4) * 10 / 10, 2 * 4 * 6 * 10 / 10, Math.sqrt(2 * 2 * 2)], W: [[10, 3.33], [60, 40], [8, 4]] },
  'forces2.gravity-force': { v: [55 * 9.8, 55 * 3.72, L('לא')], W: [[55], [89.1, 539], [L('כן')]] },
  'forces2.static-friction': { v: [8 * 10, 0.45 * 80, 0.45 * (8 + 4) * 10], W: [[8], [80, 3.6], [36, 18]] },
  'forces2.kinetic-friction': { v: [0.4 * 5 * 10, -0.4 * 10, 12 ** 2 / (2 * 0.4 * 10)], W: [[2], [4, -20], [36]] },
  'forces2.friction-combined': { v: [0.5 * 60, 28, (40 - 0.3 * 60) / 6], W: [[18], [30], [(40 - 30) / 6, 40 / 6]] },
  'forces2.spring-force': { v: [2 * 10 / 500, 0.5 * 500 * (2 * 10 / 500) ** 2], W: [[4], [0.8, 0]] },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 1300 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__T = [];
    const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) {
      if (typeof s === 'string') window.__T.push(s.replace(/[⁦-⁩‎‏]/g, ''));
      if (window.__T.length > 8000) window.__T.splice(0, 4000);
      return o.apply(this, arguments);
    };
  });
  await p.goto(F);
  await p.waitForTimeout(700);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  // ── 1. problems ─────────────────────────────────────────────────────
  console.log('\n1) every problem in chapters א-ה, recomputed and put through the answer check');
  const secs = await p.evaluate(() => MECH_CHAPTERS.slice(0, 5).map(c => c.sections.map(s => c.id + '.' + s.id)).flat());
  t('every section of chapters א-ה has an independent computation', secs.every(k => EXPECT[k]) && secs.length === 22, secs.filter(k => !EXPECT[k]).join(' ') || secs.length);
  const tryAns = (k, si, inp) => p.evaluate(([k, si, inp]) => {
    const [c, s] = k.split('.');
    state.subject = 'mechanics'; state.chapter = c; state.section = s; state.tab = 'problem';
    state.problemState[k] = { idx: 0, inputs: [], solved: [], hints: [], feedback: [], done: false, attempts: [] };
    state.problemState[k].inputs[si] = String(inp);
    chkStep(si);
    return !!state.problemState[k].solved[si];
  }, [k, si, inp]);
  for (const k of secs) {
    const E = EXPECT[k]; if (!E) continue;
    const steps = await p.evaluate(k => CONTENT[k].problem.steps.map(s => ({ a: s.answer, tol: s.tolerance || 0 })), k);
    t(k + ': step count', steps.length === E.v.length, steps.length + ' vs ' + E.v.length);
    for (let i = 0; i < steps.length && i < E.v.length; i++) {
      const want = E.v[i], s = steps[i];
      if (typeof want === 'string') {
        t(k + '#' + i + ' word answer', s.a === want && s.tol === -1, s.a);
        t(k + '#' + i + ' accepts "' + want + '"', await tryAns(k, i, want));
        for (const w of E.W[i] || []) t(k + '#' + i + ' rejects "' + w + '"', !(await tryAns(k, i, w)));
        continue;
      }
      const a = parseFloat(s.a), lim = Math.max(s.tol, Math.abs(want) * 0.015);
      t(k + '#' + i + ' stated answer', Math.abs(a - want) <= lim + 1e-9, 'answer ' + s.a + ', computed ' + want.toPrecision(5));
      t(k + '#' + i + ' accepts the exact value', await tryAns(k, i, +want.toPrecision(6)));
      t(k + '#' + i + ' accepts the 2-s.f. rounding ' + sf2(want), await tryAns(k, i, +sf2(want).toPrecision(2)));
      for (const w of E.W[i] || []) t(k + '#' + i + ' rejects the classic wrong ' + (+w.toPrecision(4)), !(await tryAns(k, i, +w.toPrecision(4))));
    }
    const q = await p.evaluate(k => (CONTENT[k].quiz || []).map(x => x.correct >= 0 && x.correct < x.opts.length && new Set(x.opts).size === x.opts.length), k);
    t(k + ': quiz keys in range, no repeated option', q.length >= 5 && q.every(Boolean), q.join(','));
  }

  // ── 2. simulation readouts ──────────────────────────────────────────
  console.log('\n2) the numbers the simulations print agree with the formulas they show');
  const cdp = await ctx.newCDPSession(p);
  const open = async cs => {
    const [c, s] = cs.split('.');
    await p.evaluate(([c, s]) => {
      try { localStorage.setItem('simtip_' + c + '.' + s, '1'); } catch (e) {}
      state.subject = 'mechanics'; state.chapter = c; state.section = s; state.tab = 'sim'; render(); window.scrollTo(0, 0);
    }, [c, s]);
    await p.waitForTimeout(1300);
    await p.evaluate(() => { document.querySelectorAll('.sim-hint').forEach(e => e.remove()); document.querySelector('#app canvas').scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { window.__T = []; });
  };
  const all = re => p.evaluate(r => { const R = new RegExp(r); return window.__T.filter(s => R.test(s)); }, re);
  const last = async re => { const a = await all(re); return a.length ? a[a.length - 1] : null; };
  const nums = s => (String(s).replace(/−/g, '-').match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number);
  const set = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById('inp-' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  const click = id => p.evaluate(id => document.getElementById(id).click(), id);
  const fresh = () => p.evaluate(() => { window.__T = []; });
  const close = (a, b2, tol) => Math.abs(a - b2) <= tol;

  // every slider's default must sit on its own step grid, or the browser
  // silently moves it (g = 9.8 on a 1.6 + 0.5k grid became 9.6)
  const grid = [];
  for (const k of await p.evaluate(() => MECH_CHAPTERS.map(c => c.sections.map(s => c.id + '.' + s.id)).flat())) {
    const [c, s] = k.split('.');
    const bad = await p.evaluate(([c, s]) => {
      state.subject = 'mechanics'; state.chapter = c; state.section = s; state.tab = 'sim'; render();
      return [...document.querySelectorAll('#app input[type=range]')]
        .filter(e => Math.abs(parseFloat(e.getAttribute('value')) - parseFloat(e.value)) > 1e-9)
        .map(e => e.id + ' ' + e.getAttribute('value') + '→' + e.value);
    }, [c, s]);
    bad.forEach(x => grid.push(k + ': ' + x));
  }
  t('every mechanics slider starts at the value its label promises', grid.length === 0, grid.join(' | ') || 'all on grid');

  await open('kinematics.const-velocity');
  await p.waitForTimeout(1500);
  let rows = (await all('^x = .* · {3}t = ')).map(nums);
  t('constant velocity: the printed x is x0 + v·t (v = 2.5 m/s)', rows.length > 30 && rows.every(r => close(r[0], 2.5 * r[1], 2.5 * 0.05 + 0.011)), rows.length + ' frames');

  await open('kinematics.acceleration');
  await p.waitForTimeout(1500);
  rows = (await all('^t = .* · {3}x = ')).map(nums);   // t, x, v, a
  t('constant acceleration: v = a·t and x = ½at² from rest', rows.length > 20 && rows.every(r => close(r[2], r[3] * r[0], r[3] * 0.05 + 0.06) && close(r[1], 0.5 * r[3] * r[0] ** 2, r[3] * r[0] * 0.05 + 0.06)), rows.length + ' frames');

  await open('kinematics.freefall');
  t('free fall: g starts at 9.8', await p.evaluate(() => document.getElementById('inp-ff-g').value) === '9.8');
  for (const [v0, g] of [[18, 9.8], [12, 1.6]]) {
    await set('v0', v0); await set('ff-g', g); await fresh(); await p.waitForTimeout(250);
    const hm = nums(await last('^hₘₐₓ = '))[0], tu = nums(await last('^' + LR('זמן עלייה = זמן ירידה = ')))[0];
    t(`free fall v0 = ${v0}, g = ${g}: hmax = v0²/2g and t_up = v0/g`, close(hm, v0 * v0 / 2 / g, 0.06) && close(tu, v0 / g, 0.006), hm + ' m, ' + tu + ' s');
  }

  await open('kinematics.avg-instant-vel');
  await p.waitForTimeout(1500);
  const dts = (await all('^Δt = ')).map(s => nums(s)[0]);
  const gaps = (await all('^\\|v̄ − v\\(t₀\\)\\| = ')).map(s => nums(s)[1] !== undefined ? nums(s).pop() : nums(s)[0]);
  const vi = nums(await last('^' + LR('משיק:  v(t₀) = '))).pop();
  const pairs = Math.min(dts.length, gaps.length);
  t('average velocity on x = 1.5t²: v(t0) = 2k·t0 = 3.6 m/s', close(vi, 3.6, 0.0005), vi);
  t('... and the chord exceeds the tangent by exactly kΔt', pairs > 10 && [...Array(pairs).keys()].every(i => close(gaps[i], 1.5 * dts[i], 0.0025)), pairs + ' frames');

  await open('vectors.vec-ops');
  await click('btn-vo-add'); await p.waitForTimeout(300);   // it draws on change only
  let r = nums(await last('^A = \\('));          // Ax Ay Bx By (A+B)x (A+B)y
  let m2 = nums(await last('^\\|A\\+B\\| = '));    // ... |A+B| θ
  const ab = Math.hypot(r[4], r[5]), Am = Math.hypot(r[0], r[1]), Bm = Math.hypot(r[2], r[3]);
  const th = Math.acos((r[0] * r[2] + r[1] * r[3]) / Am / Bm) / D;
  t('vector sum: components add, and |A+B| = √(A²+B²+2AB cosθ)', close(r[4], r[0] + r[2], 0.011) && close(r[5], r[1] + r[3], 0.011) && close(m2[m2.length - 2], ab, 0.011) && close(m2[m2.length - 1], th, 1), JSON.stringify(r) + ' ' + m2.slice(-2));

  await open('vectors.vec-components');
  await set('vc-mag', 3.5); await set('vc-ang', 135); await fresh(); await p.waitForTimeout(300);
  const ax = nums(await last('^Ax = A·cosθ = '))[0], ay = nums(await last('^Ay = A·sinθ = '))[0];
  t('components at |A| = 3.5, θ = 135°: Ax < 0, Ay > 0, the right sizes', close(ax, 3.5 * Math.cos(135 * D), 0.011) && close(ay, 3.5 * Math.sin(135 * D), 0.011), ax + ', ' + ay);

  await open('newton2.n2-law');
  await set('n2-mu', 0.2); await click('btn-n2-reset'); await fresh(); await p.waitForTimeout(400);
  const sf = nums(await last('^ΣF = ')), aa = nums(await last('^a {2}= ')), NN = nums(await last('^N {2}= '));
  t('second law, m = 5 kg, F = 20 N, μ = 0.2: N = mg, ΣF = F − μN, a = ΣF/m', close(NN[0], 49, 0.06) && close(sf[0], 20 - 0.2 * 49, 0.006) && close(aa[0], (20 - 9.8) / 5, 0.0006), NN[0] + ' N, ' + sf[0] + ' N, ' + aa[0]);

  await open('newton2.n2-apps');
  await set('inc-mu', 0.2); await fresh(); await p.waitForTimeout(300);
  const ia = nums(await last('^= [\\d.]+ m/s²$'))[0], iN = nums(await last('^N = mg·cosθ = '))[0];
  t('incline 30°, μ = 0.2, 3 kg: N = mg cosθ and a = g(sinθ − μ cosθ)', close(iN, 3 * 9.8 * Math.cos(30 * D), 0.06) && close(ia, 9.8 * (0.5 - 0.2 * Math.cos(30 * D)), 0.0006), iN + ' N, ' + ia);
  await set('inc-theta', 10); await set('inc-mu', 0.3); await click('btn-inc-reset'); await fresh(); await p.waitForTimeout(400);
  const hold = await last('^fₛ = mg·sinθ = ');
  t('... at 10° with μ = 0.3 it holds, and friction is mg sinθ, not μN', !!hold && close(nums(hold)[0], 3 * 9.8 * Math.sin(10 * D), 0.06) && !!(await last('^a = 0$')), hold);

  await open('forces.tension');
  await set('ten-ea', 2); await fresh(); await p.waitForTimeout(300);
  const at = await last('^' + LR('אטווד:  a = ')), el = await last('^' + LR('במעלית:  T = m(g + a) = '));
  const g = 9.8, A1 = (5 - 3) * g / 8, T1 = 2 * 3 * 5 * g / 8;
  t('tension: Atwood a and T, the lift T = m(g + a)', close(nums(at)[0], A1, 0.006) && close(nums(at).pop(), T1, 0.06) && close(nums(el).pop(), 3 * (g + 2), 0.06), at + ' | ' + el);

  await open('newton2.n2-atwood');
  await set('atw-m1', 2); await set('atw-m2', 7); await fresh(); await p.waitForTimeout(300);
  const aw = nums(await last('^= \\(')).pop(), tw = nums(await last('^T = 2m₁m₂g')).pop();
  t('Atwood 2 kg and 7 kg: a = (m2−m1)g/(m1+m2), T = 2m1m2g/(m1+m2)', close(aw, 5 * 9.8 / 9, 0.0006) && close(tw, 2 * 2 * 7 * 9.8 / 9, 0.006), aw + ', ' + tw);

  await open('forces2.gravity-force');
  await set('gf-m', 55); await fresh(); await p.waitForTimeout(300);
  const gs = [...new Set((await all('^g = [\\d.]+')).map(s => nums(s)[0]))], ws = new Set((await all('^W = [\\d.]+ N$')).map(s => nums(s)[0]));
  // printed to 0.1 N below 100 N, to 1 N above
  t('weight on six bodies: W = mg for m = 55 kg', gs.length === 6 && gs.every(gg => ws.has(55 * gg < 100 ? Math.round(550 * gg) / 10 : Math.round(55 * gg))), gs.join(',') + ' → ' + [...ws].join(','));

  await open('forces2.static-friction');
  await set('sft-mass', 5); await set('sft-mu', 0.7); await fresh(); await p.waitForTimeout(300);
  const mu = await last('^μₛN = [\\d.]+ N$');
  t('static friction ceiling μₛN = μₛ·mg', !!mu && close(nums(mu).pop(), 0.7 * 5 * 9.8, 0.06), mu);

  await open('forces2.kinetic-friction');
  await set('kf-v0', 8); await set('kf-mu', 0.4); await fresh(); await p.waitForTimeout(200);
  const pr = await last('^a = −μₖg = ');
  const dWant = 64 / (2 * 0.4 * 9.8);
  t('kinetic friction: a = −μg and d = v0²/(2μg) printed', !!pr && close(nums(pr)[0], -0.4 * 9.8, 0.006) && close(nums(pr).pop(), dWant, 0.006), pr);
  await click('btn-kf-launch');
  await p.waitForTimeout(3500);
  const xs = (await all('^v = [\\d.]+ m/s {5}x = ')).map(s => nums(s));
  const xEnd = xs.length ? xs[xs.length - 1][1] : NaN;
  t('... and the block actually stops at that distance', close(xEnd, dWant, 0.02 * dWant), xEnd + ' m of ' + dWant.toFixed(2));

  await open('forces2.friction-combined');
  await fresh(); await p.waitForTimeout(300);
  const fN = nums(await last('^N = mg·cosθ = '))[0], fW = nums(await last('^W∥ = mg·sinθ = '))[0], fs = await last('^fₛ = [\\d.]+ N \\(');
  t('rough incline 20°, 5 kg, held: N = mg cosθ, and fₛ = mg sinθ', close(fN, 5 * 9.8 * Math.cos(20 * D), 0.06) && close(fW, 5 * 9.8 * Math.sin(20 * D), 0.06) && !!fs && close(nums(fs)[0], fW, 0.051), fN + ', ' + fW + ', ' + fs);

  await open('forces2.spring-force');
  await set('sf-k', 100); await set('sf-m', 1); await fresh(); await p.waitForTimeout(300);
  const Tsp = await last('T = 2π√\\(m/k\\) = ');
  t('spring: T = 2π√(m/k) for 1 kg on 100 N/m', !!Tsp && close(nums(Tsp).pop(), 2 * Math.PI * 0.1, 0.006), Tsp);

  await open('forces.normal-force');
  await set('nf-theta', 30); await fresh(); await p.waitForTimeout(300);
  const nf = nums(await last('^N = mg·cosθ = '))[0];
  t('normal force on a 30° slope: N = mg cosθ (4 kg)', close(nf, 4 * 9.8 * Math.cos(30 * D), 0.06), nf);

  await open('forces.n3-law');
  await click('btn-n3-push');
  await p.waitForTimeout(250);
  const fa = (await all('^A: \\d')).map(s => nums(s)[0]), fb = (await all('^B: \\d')).map(s => nums(s)[0]);
  await p.waitForTimeout(1200);
  const sp = (await all('^Σp = ')).slice(-20).map(s => nums(s).pop());
  t('third law: the two measured forces are equal during the push', fa.length > 0 && fa.some(x => x > 0) && fa.every((x, i) => fb[i] === undefined || x === fb[i]), fa.slice(0, 4) + ' / ' + fb.slice(0, 4));
  t('... and the skaters\' Σp stays 0', sp.length > 5 && sp.every(x => Math.abs(x) < 0.051), sp.slice(-3).join(','));

  // ── 3. touch ────────────────────────────────────────────────────────
  console.log('\n3) draggable canvases, by touch');
  const rect = () => p.evaluate(() => { const q = document.querySelector('#app canvas').getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width }; });
  const drag = async (rr, pts) => {
    const P = q => ({ x: rr.x + q[0], y: rr.y + q[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
    for (let i = 1; i < pts.length; i++) { await p.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] }); }
    await p.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(150);
  };
  const val = id => p.evaluate(id => parseFloat(document.getElementById('inp-' + id).value), id);
  let rr, W;

  await open('newton2.n2-law'); rr = await rect(); W = rr.w;
  await drag(rr, [[W / 2, 30], [W / 2 + 20, 30], [W / 2 + 56, 30]]);
  t('second law: dragging the top bar sets F = 40 N', close(await val('n2-F'), 40, 1.01), await val('n2-F'));

  await open('vectors.vec-components'); rr = await rect(); W = rr.w;
  const CX = W / 2, CY = 60 + 4 * 36 + 10;
  await drag(rr, [[CX + 2.75 * 36, CY - 1.75 * 36], [CX + 1 * 36, CY - 2 * 36], [CX - 2 * 36, CY - 2 * 36]]);
  t('components: dragging the tip to (−2, 2) gives θ = 135°, |A| = 2.8', close(await val('vc-ang'), 135, 1.01) && close(await val('vc-mag'), Math.hypot(2, 2), 0.06), (await val('vc-ang')) + '°, ' + (await val('vc-mag')));

  await open('newton2.n2-apps'); rr = await rect(); W = rr.w;
  const RX = W * 0.14, RY = 430 - 72;
  await drag(rr, [[RX + 100 * Math.cos(30 * D), RY - 100 * Math.sin(30 * D)], [RX + 100 * Math.cos(38 * D), RY - 100 * Math.sin(38 * D)], [RX + 100 * Math.cos(45 * D), RY - 100 * Math.sin(45 * D)]]);
  t('incline: dragging the ramp tilts it to 45°', close(await val('inc-theta'), 45, 1.01), await val('inc-theta'));

  await open('kinematics.const-velocity');
  await click('btn-cv-reset'); rr = await rect(); W = rr.w;
  const GL = 58, GR = W - 34, VPX = Math.min(18, (GR - GL) / 32), x0px = GL + 10 / 20 * (GR - GL);
  await drag(rr, [[x0px, 112], [x0px + 2 * VPX, 112], [x0px + 4 * VPX, 112]]);
  t('constant velocity: dragging from the ball sets v = +4 m/s', close(await val('cv-v'), 4, 0.51), await val('cv-v'));

  // ── 3b. static friction, rebuilt: a push you drag, and a crate on a truck
  console.log('\n3b) static friction: f follows the push up to μₛN; on a truck it drives the crate forward');
  const probe = () => p.evaluate(() => document.querySelector('#app canvas')._probe());
  const model = () => p.evaluate(() => { const e = document.querySelector('#app .sk-model'); return e ? e.textContent : ''; });
  const done = () => p.evaluate(() => [...document.querySelectorAll('#app .sk-m')].map(li => li.classList.contains('done')));
  await open('forces2.static-friction'); rr = await rect();
  // the prediction is about the crate on screen: with μₛN = 0.98 N a 6 N push would slide it, so the question
  // (asked again while unanswered) pushes with 0.5 N, under the ceiling, and its answer leaves the crate at rest
  await set('sft-mass', 1); await set('sft-mu', 0.1); await p.waitForTimeout(200);
  const sfQ = await p.evaluate(() => document.querySelector('#app .sk-pq').textContent);
  await p.evaluate(() => document.querySelectorAll('#app .sk-opt')[1].click()); await p.waitForTimeout(300);
  let q0 = await probe();
  t('static friction: the prediction follows the sliders (μₛN = 1.0 N → a 0.5 N push), and its answer leaves the crate at rest with fₛ = F', /μₛN = 1\.0 N/.test(sfQ) && /F = 0\.5 N/.test(sfQ) && q0.F === 0.5 && !q0.sliding && q0.f === 0.5, sfQ.replace(/\s+/g, ' ').slice(0, 90));
  await set('sft-F', 0);
  await set('sft-mass', 5); await set('sft-mu', 0.7); await p.waitForTimeout(200);
  await drag(rr, [[90, 140], [115, 140], [140, 140]]);
  t('static friction: dragging the hand 50 px to the right pushes with F = 20 N', close(await val('sft-F'), 20, 1.01), await val('sft-F'));
  const N5 = 5 * 9.8, CS = 0.7 * N5, CK = 0.75 * CS, rows2 = [];
  for (const F of [0, 6, 20, 34]) { await set('sft-F', F); await p.waitForTimeout(300); const q = await probe(); rows2.push([F, q.f, q.sliding, q.x, await model()]); }
  t('below μₛN = 34.3 N the crate stays put and fₛ = F exactly (0, 6, 20, 34 N)', rows2.every(([F, f, sl, x, ml]) => !sl && Math.abs(f - F) < 1e-9 && x === 0 && ml.includes('fₛ = F = ' + F.toFixed(1) + ' N ≤ μₛN = 0.70 × 49.0 = 34.3 N')), rows2.map(r => r[0] + '→' + r[1]).join(', '));
  await set('sft-F', 40); await p.waitForTimeout(500);
  let q2 = await probe();
  t('past μₛN it slides: friction drops to μₖN = 0.75 μₛN, a = (F − fₖ)/m', q2.sliding && Math.abs(q2.f - CK) < 1e-9 && Math.abs(q2.a - (40 - CK) / 5) < 1e-9 && q2.v > 0, `f ${q2.f.toFixed(2)} N, a ${q2.a.toFixed(3)} m/s²`);
  const mlS = await model(), aM = mlS.match(/= ([\d.]+) m\/s²/);
  t('... and the model line prints that a', !!aM && close(+aM[1], (40 - CK) / 5, 0.006), aM && aM[1]);
  await set('sft-F', 30); await p.waitForTimeout(300); q2 = await probe();
  t('a sliding crate does not re-check μₛN: at fₖ < F = 30 N < μₛN it still speeds up', q2.sliding && q2.a > 0.8, q2.a.toFixed(3));
  // waits counted on the sim's own clock (a slow machine caps its frames, it does not skip them)
  const simWait = (sec, until) => p.evaluate(async ([sec, until]) => { const cv = document.querySelector('#app canvas'), c0 = cv._probe().clock, f = until ? new Function('q', 'return ' + until) : null;
    while (cv._probe().clock - c0 < sec && !(f && f(cv._probe()))) await new Promise(r => setTimeout(r, 30)); return cv._probe(); }, [sec, until || '']);
  await set('sft-F', 25.5); await simWait(1.4);
  const md1 = await done();
  t('missions: the ceiling found, then constant velocity at F ≈ μₖN', md1[0] && md1[1], JSON.stringify(md1));
  await set('sft-F', 10); q2 = await simWait(12, '!q.sliding');
  t('below fₖ it slows and stops, and then static friction is the push again (10 N)', !q2.sliding && q2.v === 0 && Math.abs(q2.f - 10) < 1e-9, `v ${q2.v}, f ${q2.f}`);
  // the truck: friction along the motion
  await set('sft-mu', 0.4); await p.evaluate(() => document.getElementById('btn-sft-scene').click()); await p.waitForTimeout(250);
  t('the truck asks first which way friction points', await p.evaluate(() => /🚚|truck|משאית/.test(document.querySelector('#app .sk-pq').textContent)));
  await set('sft-a', 2); q2 = await simWait(0.7);
  const ml2 = await model();
  t('truck speeding up at 2 m/s²: the crate rides along, fₛ = ma = +10 N — forward', q2.stick && Math.abs(q2.f - 10) < 1e-9 && q2.vc === q2.vt && ml2.includes('fₛ = ma = 5.0 × 2.0 = 10.0 N ≤ μₛmg = 19.6 N'), q2.f + ' N');
  await set('sft-a', 3.8); await simWait(0.5);
  await set('sft-a', 5); q2 = await simWait(0.9);
  t('at 5 m/s² > μₛg it slips back: kinetic friction μₖmg still points forward, a_crate = μₖg', !q2.stick && q2.vc < q2.vt && Math.abs(q2.f - 0.3 * N5) < 1e-9 && Math.abs(q2.ac - 0.3 * 9.8) < 1e-9, `f ${q2.f.toFixed(2)} N, a ${q2.ac.toFixed(2)}`);
  await set('sft-a', -6); q2 = await simWait(1.2);
  t('braking hard it slides forward and friction turns backward', !q2.stick && q2.vc > q2.vt && q2.f < 0, `f ${q2.f.toFixed(2)} N`);
  const md2 = await done();
  t('missions: largest acceleration without slipping (μₛg), and the forward slide when braking', md2[2] && md2[3], JSON.stringify(md2));

  // ── 3c. springs, sliding, inclines and planets: what the missions ask, the sims do
  console.log('\n3c) spring force, kinetic friction, a block on an incline, six planets: missions and model lines');
  const f2_fpoll = (cond, ms) => p.evaluate(async ([c, ms]) => { const f = new Function('q', 'return ' + c), cv = document.querySelector('#app canvas');
    for (let i = 0; i < ms / 25; i++) { const q = cv._probe(); if (f(q)) return q; await new Promise(r => setTimeout(r, 25)); } return cv._probe(); }, [cond, ms]);
  const f2_touchHold = async (rr2, pts) => {   // a drag that stays down, then a lift
    const P = q => ({ x: rr2.x + q[0], y: rr2.y + q[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
    for (let i = 1; i < pts.length; i++) { await p.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] }); }
    await p.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(80);
  };
  await open('forces2.spring-force'); rr = await rect();
  // the mass is caught at rest at x = 0 (the reset), then pulled: a moving mass slips the finger
  const f2_sfPull = async (xm, whileHeld) => { await click('btn-sf-reset'); await p.waitForTimeout(60); const q = await probe();
    const P = z => ({ x: rr.x + q.EQ_X + z * q.PX, y: rr.y + q.SPRING_Y });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(0)] });
    for (const z of [xm / 2, xm]) { await p.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(z)] }); }
    await p.waitForTimeout(300); const got = whileHeld ? await whileHeld() : null;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(80); return got; };
  let f2_fml = await f2_sfPull(0.1, model);   // read while the finger holds it there
  t('spring force: the mass dragged by touch to +10 cm: F = −kx = −40 × 0.100 = −4.00 N, pulling back', /F = −kx = −40 × 0\.100 = −4\.00\s*N/.test(f2_fml), f2_fml.slice(0, 50));
  await f2_sfPull(-0.1);
  let f2_fq = await probe();
  t('... and to −10 cm: the same size, the other way (mission 1)', f2_fq.heldPos && f2_fq.heldNeg, `${f2_fq.heldPos} ${f2_fq.heldNeg}`);
  await set('sf-k', 150); await f2_sfPull(0.1);
  f2_fq = await probe();
  t('... k = 150 N/m: 15 N for a 10 cm stretch (mission 2)', f2_fq.k150, String(f2_fq.k150));
  let f2_fdm = await done();
  t('spring force missions done', f2_fdm.length === 2 && f2_fdm.every(Boolean), JSON.stringify(f2_fdm));
  await set('sf-k', 200); await set('sf-m', 0.1); await set('sf-damp', 0); await f2_sfPull(0.1);
  const f2_sfAmp = await p.evaluate(async () => { const cv = document.querySelector('#app canvas'); let mx = 0; const t0 = cv._probe().t;
    while (cv._probe().t - t0 < 3) { mx = Math.max(mx, Math.abs(cv._probe().x)); await new Promise(r => setTimeout(r, 7)); } return mx; });
  t('a stiff spring and a light mass (k = 200 N/m, m = 0.1 kg, b = 0): 3 s of oscillation, the amplitude holds at 10 cm', f2_sfAmp <= 0.1 * 1.015 && f2_sfAmp > 0.095, (f2_sfAmp * 100).toFixed(2) + ' cm');

  await open('forces2.kinetic-friction');
  const f2_kfRun = async (v0, m) => { await set('kf-v0', v0); await set('kf-mass', m); await click('btn-kf-launch'); return f2_fpoll('!q.running && q.launched', 30000); };
  let f2_kq = await f2_kfRun(6, 5);
  const f2_muK = await val('kf-mu');
  t('kinetic friction: a 6 m/s slide stops at exactly v₀²/(2μₖg)', Math.abs(f2_kq.last.d - 36 / (2 * f2_muK * 9.8)) < 1e-9, f2_kq.last.d.toFixed(4) + ' m');
  f2_kq = await f2_kfRun(12, 5);
  t('... at 12 m/s: 4 times as far (mission 1)', Math.abs(f2_kq.last.d / (36 / (2 * f2_muK * 9.8)) - 4) < 1e-9 && f2_kq.v4, (f2_kq.last.d / (36 / (2 * f2_muK * 9.8))).toFixed(4) + '×');
  f2_kq = await f2_kfRun(12, 10);
  t('... twice the mass, the same speed: the same distance (mission 2)', f2_kq.mSame && Math.abs(f2_kq.last.d - 144 / (2 * f2_muK * 9.8)) < 1e-9, f2_kq.last.d.toFixed(3) + ' m');
  f2_fml = await model();
  t('... the model line: d = v₀²/(2μₖg) with the numbers', f2_fml.includes('d = v₀²/(2μₖg) = 12² / (2 × ' + f2_muK.toFixed(2) + ' × 9.8) = ' + (144 / (2 * f2_muK * 9.8)).toFixed(2)), f2_fml.slice(-50));
  f2_fdm = await done();
  t('kinetic friction missions done', f2_fdm.length === 2 && f2_fdm.every(Boolean), JSON.stringify(f2_fdm));
  // the mass slider moves in half kilograms: the model line must multiply the mass it is given (4.5, not "5")
  await set('kf-mass', 4.5); await p.waitForTimeout(400);
  f2_fml = await model();
  t('... at m = 4.5 kg the model line prints fₖ = μₖ × 4.5 × 9.8 and its true product', f2_fml.includes('fₖ = μₖmg = ' + f2_muK.toFixed(2) + ' × 4.5 × 9.8 = ' + (f2_muK * 4.5 * 9.8).toFixed(1)), f2_fml.slice(0, 44));

  await open('forces2.friction-combined');
  await set('fc-theta', 20); await set('fc-m', 5); await set('fc-mu', 0.45); await set('fc-F', 16); await p.waitForTimeout(150);
  let f2_cq = await probe();
  const f2_Wpar = 5 * 9.8 * Math.sin(20 * D);
  t('incline 20°, 5 kg, F = 16 N: at rest with fₛ = mg·sinθ − F, up the slope (mission 2: |fₛ| < 1 N)', f2_cq.state === 'static' && Math.abs(f2_cq.f - (f2_Wpar - 16)) < 1e-9 && f2_cq.mZero, f2_cq.f.toFixed(3) + ' N');
  await set('fc-F', 36); await p.waitForTimeout(150); f2_cq = await probe();
  t('... F = 36 N: still at rest, friction now down the slope, the next 2 N would break it (mission 1)', f2_cq.state === 'static' && f2_cq.f < 0 && f2_cq.mMax && f2_cq.F0 + 2 > f2_cq.fsMax, `f ${f2_cq.f.toFixed(2)}, μₛN ${f2_cq.fsMax.toFixed(2)}`);
  f2_fml = await model();
  t('... the model line prints fₛ = mg·sinθ − F and the ceiling μₛN', f2_fml.includes('fₛ = mg·sinθ − F = ' + f2_Wpar.toFixed(1) + ' − 36 = −' + (36 - f2_Wpar).toFixed(1)), f2_fml.slice(0, 60));
  await set('fc-F', 2); await set('fc-theta', 40); f2_cq = await f2_fpoll('q.mDown', 4000);
  t('... at 40° with F = 2 N up the slope it slides down; kinetic friction points up, with F (mission 3)', f2_cq.mDown && f2_cq.state === 'down' && f2_cq.f > 0 && Math.abs(f2_cq.a - (2 - 5 * 9.8 * Math.sin(40 * D) + 0.75 * 0.45 * 5 * 9.8 * Math.cos(40 * D)) / 5) < 1e-9, `a ${f2_cq.a.toFixed(3)} m/s²`);
  f2_fdm = await done();
  t('incline missions done', f2_fdm.length === 3 && f2_fdm.every(Boolean), JSON.stringify(f2_fdm));

  await open('forces2.gravity-force'); rr = await rect();
  await f2_touchHold(rr, [[rr.w / 2, 24]]);
  let f2_gq = await f2_fpoll('q.race', 6000);
  const f2_gs = [3.7, 8.87, 9.81, 3.72, 24.8, 1.62];
  t('six planets: one tap drops every ball; each lands at t = √(2h/g) (mission 1)', f2_gq.race && f2_gs.every((g2, i) => f2_gq.drops[i] && Math.abs(f2_gq.drops[i].land - Math.sqrt(4 / g2)) < 1e-12), f2_gq.drops[5] && f2_gq.drops[5].land.toFixed(3) + ' s on the Moon');
  await set('gf-m', 61); await p.waitForTimeout(150); f2_gq = await probe();
  t('... 61 kg on the Moon weighs what 10 kg does on Earth (mission 2)', f2_gq.moonBag && Math.abs(61 * 1.62 - 98.1) < 1, (61 * 1.62).toFixed(1) + ' N');
  f2_fdm = await done();
  t('gravity missions done', f2_fdm.length === 2 && f2_fdm.every(Boolean), JSON.stringify(f2_fdm));

  // ── 4. the learning experience ──────────────────────────────────────
  console.log('\n4) misconception boxes, quiz keys, hints, units');
  await require('./mech_learning')(p, ['kinematics', 'vectors', 'forces', 'newton2', 'forces2'], t);

  t('no page errors, touchend included', errs.length === 0, errs.join(' | ') || 'none');
  await b.close();
  console.log(`check_mech1: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ MECHANICS א-ה: ANSWERS, READOUTS AND DRAGS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
