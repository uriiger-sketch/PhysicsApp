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
  // waits on what the sim shows, not on the clock: a slow frame rate stretches sim time
  const until = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await p.waitForTimeout(80); } return false; };
  // the sim kit: a mission solved, the live model line, a prediction's options
  const mission = (k, i) => p.evaluate(([k, i]) => !!((state.missions || {})[k] || {})[i], [k, i]);
  const modelTxt = () => p.evaluate(() => { const m = document.querySelector('#app .sk-model'); return m && !m.hidden ? m.textContent.replace(/[⁦-⁩‎‏]/g, '') : ''; });
  const predOpts = () => p.evaluate(() => [...document.querySelectorAll('#app .sk-opt')].map(b => b.textContent));

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
  await set('inc-mu', 0.2); await click('btn-inc-drop'); await fresh(); await p.waitForTimeout(300);
  const ia = nums(await last('^a = [−+]?[\\d.]+ m/s²$'))[0], iN = nums(await last('^N = mg·cosθ = '))[0];
  t('incline 30°, μ = 0.2, 3 kg, let go at the top: N = mg cosθ and a = −g(sinθ − μ cosθ)', close(iN, 3 * 9.8 * Math.cos(30 * D), 0.06) && close(ia, -9.8 * (0.5 - 0.2 * Math.cos(30 * D)), 0.0006), iN + ' N, ' + ia);
  await set('inc-v0', 5); await click('btn-inc-push'); await fresh(); await p.waitForTimeout(250);
  const iu = nums(await last('^a = [−+]?[\\d.]+ m/s²$'))[0], ifk = nums(await last('^fₖ = μN = '))[0];
  t('... pushed up it slides up with a = −g(sinθ + μ cosθ): friction μN now points down the slope', close(iu, -9.8 * (0.5 + 0.2 * Math.cos(30 * D)), 0.0006) && close(ifk, 0.2 * 3 * 9.8 * Math.cos(30 * D), 0.06) && /\+ 0\.20×0\.866\)/.test(await modelTxt()), iu + ', ' + ifk + ' N | ' + await modelTxt());
  await set('inc-theta', 10); await set('inc-mu', 0.3); await click('btn-inc-drop'); await fresh(); await p.waitForTimeout(400);
  const hold = await last('^fₛ = mg·sinθ = ');
  t('... at 10° with μ = 0.3 it holds, and friction is mg sinθ, not μN', !!hold && close(nums(hold)[0], 3 * 9.8 * Math.sin(10 * D), 0.06) && !!(await last('^a = 0\\.000 m/s²$')), hold);

  await open('forces.tension');
  await set('ten-ea', 2); await fresh(); await p.waitForTimeout(300);
  const at = await last('^' + LR('אטווד:  a = ')), el = await last('^' + LR('במעלית:  T = m(g + a) = '));
  const g = 9.8, A1 = (5 - 3) * g / 8, T1 = 2 * 3 * 5 * g / 8;
  t('tension: Atwood a and T, the lift T = m(g + a)', close(nums(at)[0], A1, 0.006) && close(nums(at).pop(), T1, 0.06) && close(nums(el).pop(), 3 * (g + 2), 0.06), at + ' | ' + el);

  await open('newton2.n2-atwood');
  await set('atw-m1', 2); await set('atw-m2', 7); await fresh(); await p.waitForTimeout(300);
  const h1 = nums(await last('^T₁ = [\\d.]+ N$'))[0], h2 = nums(await last('^T₂ = [\\d.]+ N$'))[0];
  t('Atwood 2 kg and 7 kg, braked: each side of the string reads its own weight, T₁ = m₁g, T₂ = m₂g', close(h1, 19.6, 0.051) && close(h2, 68.6, 0.051), h1 + ' N, ' + h2 + ' N');
  await click('btn-atw-launch'); await fresh(); await p.waitForTimeout(300);
  const aw = nums(await last('^a = [\\d.]+ m/s²$'))[0], tw = nums(await last('^T = [\\d.]+ N'))[0];
  const s1 = nums(await last('^T₁ = [\\d.]+ N$'))[0], s2 = nums(await last('^T₂ = [\\d.]+ N$'))[0];
  t('... released: a = (m2−m1)g/(m1+m2), T = 2m1m2g/(m1+m2) on both scales, between m₁g and m₂g', close(aw, 5 * 9.8 / 9, 0.0006) && close(tw, 2 * 2 * 7 * 9.8 / 9, 0.006) && s1 === s2 && close(s1, tw, 0.051) && 19.6 < tw && tw < 68.6, aw + ', ' + tw + ' (' + s1 + ', ' + s2 + ')');
  t('... and the model line substitutes the numbers', /\(7\.0−2\.0\)×9\.8\/9\.0 = 5\.444 m\/s²/.test(await modelTxt()), await modelTxt());

  await open('forces2.gravity-force');
  await set('gf-m', 55); await fresh(); await p.waitForTimeout(300);
  const gs = [...new Set((await all('^g = [\\d.]+')).map(s => nums(s)[0]))], ws = new Set((await all('^W = [\\d.]+ N$')).map(s => nums(s)[0]));
  // printed to 0.1 N below 100 N, to 1 N above
  t('weight on six bodies: W = mg for m = 55 kg', gs.length === 6 && gs.every(gg => ws.has(55 * gg < 100 ? Math.round(550 * gg) / 10 : Math.round(55 * gg))), gs.join(',') + ' → ' + [...ws].join(','));

  await open('forces2.static-friction');
  await set('sft-mass', 5); await set('sft-mu', 0.7); await fresh(); await p.waitForTimeout(300);
  const mu = await last('^μₛN = [\\d.]+×');
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
  const n3 = async () => {   // one push: the two gauges (each from its own skater's Δp), and the speeds after it
    await click('btn-n3-push'); await p.waitForTimeout(300);
    const fa = (await all('^' + LR('על A: ') + '\\d')).map(s => nums(s)[0]), fb = (await all('^' + LR('על B: ') + '\\d')).map(s => nums(s)[0]);
    const pa = await last('^' + LR('F על A = ') + '\\d'), pb = await last('^' + LR('F על B = ') + '\\d');
    await fresh(); await until(async () => (await all('^v = [−+][\\d.]+ m/s$')).length >= 4 && (await all('^Σp = ')).length >= 6, 4000);
    const vs = (await all('^v = [−+][\\d.]+ m/s$')).map(s => nums(s)[0]);
    const sp = (await all('^Σp = ')).slice(-20).map(s => nums(s).pop());
    return { fa, fb, pa: pa && nums(pa)[0], pb: pb && nums(pb)[0], vA: Math.min(...vs), vB: Math.max(...vs), sp };
  };
  let r3 = await n3();
  t('third law: the two measured forces are equal during the push (A pushes, 60 kg on 30 kg)', r3.fa.length > 0 && r3.fa.some(x => x > 0) && r3.fa.every((x, i) => r3.fb[i] === undefined || x === r3.fb[i]) && r3.pa === 300 && r3.pb === 300, r3.fa.slice(0, 4) + ' / ' + r3.fb.slice(0, 4) + ' | ' + r3.pa + ', ' + r3.pb);
  t('... and the skaters\' Σp stays 0', r3.sp.length > 5 && r3.sp.every(x => Math.abs(x) < 0.051), r3.sp.slice(-3).join(','));
  t('... equal impulses F·Δt = 150 N·s: vA = −150/60, vB = +150/30', close(r3.vA, -2.5, 0.006) && close(r3.vB, 5, 0.006), r3.vA + ', ' + r3.vB);
  await click('btn-n3-reset'); await click('btn-n3-who');
  r3 = await n3();
  t('... when B pushes instead, nothing changes: the same 300 N on each, the same speeds', r3.fa.some(x => x === 300) && r3.fa.every((x, i) => r3.fb[i] === undefined || x === r3.fb[i]) && close(r3.vA, -2.5, 0.006) && close(r3.vB, 5, 0.006), r3.vA + ', ' + r3.vB);

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
  const RX = W < 600 ? 56 : 76, RY = (W < 600 ? 500 : 460) - 48;
  await drag(rr, [[RX + 100 * Math.cos(30 * D), RY - 100 * Math.sin(30 * D)], [RX + 100 * Math.cos(38 * D), RY - 100 * Math.sin(38 * D)], [RX + 100 * Math.cos(45 * D), RY - 100 * Math.sin(45 * D)]]);
  t('incline: dragging the ramp tilts it to 45°', close(await val('inc-theta'), 45, 1.01), await val('inc-theta'));
  await set('inc-theta', 30); await fresh();
  const bx0 = RX - 17 - 3, by0 = RY - 17;   // the block, resting on the floor at the foot
  await drag(rr, [[bx0, by0], [bx0 + 40 * Math.cos(30 * D), by0 - 40 * Math.sin(30 * D)], [bx0 + 75 * Math.cos(30 * D), by0 - 75 * Math.sin(30 * D)]]);
  await p.waitForTimeout(120);
  const pv = (await all('^v = \\+[\\d.]+ m/s$')).map(x => nums(x)[0]);
  t('incline: pulling the block 5 m/s worth up the slope pushes it off at v0 = 5 m/s', close(await val('inc-v0'), 5, 0.051) && pv.length > 0 && Math.max(...pv) <= 5 + 1e-9 && Math.max(...pv) > 4, (await val('inc-v0')) + ' m/s, first v ' + Math.max(...pv));

  await open('kinematics.const-velocity');
  await click('btn-cv-reset'); rr = await rect(); W = rr.w;
  const GL = 58, GR = W - 34, VPX = Math.min(18, (GR - GL) / 32), x0px = GL + 10 / 20 * (GR - GL);
  await drag(rr, [[x0px, 112], [x0px + 2 * VPX, 112], [x0px + 4 * VPX, 112]]);
  t('constant velocity: dragging from the ball sets v = +4 m/s', close(await val('cv-v'), 4, 0.51), await val('cv-v'));

  // ── 3b. the rebuilt simulations: missions, predictions, model line ───
  console.log('\n3b) rebuilt simulations: their physics, their missions and predictions');
  const tap = async (rr, x, y) => drag(rr, [[x, y], [x, y]]);

  // free fall: the flight is v = v0 − gt, y = v0t − ½gt², and a = −g at EVERY instant
  await open('kinematics.freefall');
  t('free fall: a prediction is asked first — four options, "a at the top"', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await set('v0', 18); await set('ff-g', 9.8); await fresh();
  // read in short stretches: the label log keeps only the last few thousand texts
  await click('btn-throw');
  let ff = [];
  const ffLanded = r => r && r[0] > 0.5 && r[3] === 0;
  for (let k = 0; k < 14 && !ffLanded(ff[ff.length - 1]); k++) { await p.waitForTimeout(650); ff = ff.concat((await all('^t = [\\d.]+ s +· ')).map(nums)); await fresh(); }   // t y v a
  const inAir = ff.filter(r => r[0] > 0.02 && r[0] < 2 * 18 / 9.8 - 0.02);
  // (t is printed to 0.01 s, y and v to 0.1: each frame is held to its own rounding)
  t('free fall: every frame in the air obeys v = v0 − gt and y = v0t − ½gt²', inAir.length > 40 && inAir.every(r => close(r[2], 18 - 9.8 * r[0], 0.05 + 9.8 * 0.005 + 1e-9) && close(r[1], 18 * r[0] - 4.9 * r[0] ** 2, 0.05 + Math.abs(18 - 9.8 * r[0]) * 0.005 + 1e-9)), inAir.length + ' frames');
  const nearTop = inAir.filter(r => Math.abs(r[2]) < 1.5);
  t('... and a = −9.8 m/s² in every one of them, the frames around the top included', inAir.every(r => r[3] === -9.8) && nearTop.length > 0, nearTop.length + ' frames with |v| < 1.5 m/s');
  const landed = ff[ff.length - 1];
  t('... on the ground after landing it rests: v = 0, a = 0, t = 2v0/g', close(landed[0], 2 * 18 / 9.8, 0.006) && landed[2] === 0 && landed[3] === 0, landed.join(', '));
  t('... the model line substitutes the numbers: v = v0 − g·t', /v = v₀ − g·t = 18 − 9\.8×3\.67 = −18\.0 m\/s/.test(await modelTxt()), await modelTxt());
  // mission 2: drag the time cursor to the top
  rr = await rect(); W = rr.w;
  const ffSW = W < 600 ? Math.round(W * 0.42) : Math.min(320, Math.round(W * 0.38)), ffGX = ffSW + (W < 600 ? 28 : 40), ffGW = W - ffGX - 12;
  await fresh(); await drag(rr, [[ffGX + ffGW * 0.3, 120], [ffGX + ffGW * 0.45, 120], [ffGX + ffGW * 0.5 + 3, 120]]);
  await p.waitForTimeout(250);
  const top = nums(await last('^t = [\\d.]+ s +· '));
  t('free fall: dragging along the graph moves the ball in time — at the top v = 0 and still a = −g', close(top[0], 18 / 9.8, 0.006) && top[2] === 0 && top[3] === -9.8 && close(top[1], 18 * 18 / 19.6, 0.06), top.join(', '));
  t('... which solves the mission "the acceleration at the top"', await mission('kinematics.freefall', 1));
  // mission 1: pull v0 = 14 m/s straight off the ball, and the ball goes to 10 m
  await click('btn-throw'); await fresh();
  await until(async () => ffLanded(nums(await last('^t = [\\d.]+ s +· ') || '')), 9000);
  rr = await rect(); W = rr.w;
  const ffAX = 36, ffBX = Math.round(ffAX + (ffSW - ffAX) / 2 + 6), ffG = 460 - 40, ffAIM = (ffG - 34 - 44) / 30, ffR = 9 + 5 * Math.cbrt(0.5);
  await fresh(); await drag(rr, [[ffBX, ffG - ffR], [ffBX, ffG - ffR - 7 * ffAIM], [ffBX, ffG - ffR - 14 * ffAIM]]);
  t('free fall: pulling 14 m/s worth up from the ball sets v0 = 14 m/s', close(await val('v0'), 14, 0.01), await val('v0'));
  await until(() => mission('kinematics.freefall', 0), 6000);
  const hm14 = nums(await last('^hₘₐₓ = '))[0];
  t('... and throws it: h_max = v0²/2g = 10.0 m, mission "reach 10 m" solved', close(hm14, 10, 0.051) && await mission('kinematics.freefall', 0), hm14);
  // mission 3: the mass does not enter
  const T6 = [];
  for (const mm of [0.5, 5]) {
    await until(async () => ffLanded(nums(await last('^t = [\\d.]+ s +· ') || '')), 9000);
    await set('v0', 6); await set('ff-m', mm); await click('btn-throw'); await fresh(); await p.waitForTimeout(300);
    await until(async () => ffLanded(nums(await last('^t = [\\d.]+ s +· ') || '')), 6000);
    T6.push(nums(await last('^t = [\\d.]+ s +· '))[0]);
  }
  t('free fall: a 0.5 kg and a 5 kg ball thrown at 6 m/s land at the same t = 2v0/g', T6.every(x => close(x, 12 / 9.8, 0.006)) && await mission('kinematics.freefall', 2), T6.join(' s, ') + ' s');

  // acceleration: negative a that speeds up, a turn-around, 10 m in 2 s
  await open('kinematics.acceleration');
  t('acceleration: a prediction is asked first — negative velocity and negative acceleration', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await set('acc-v0', -4); await set('acc-a', -3);
  await until(() => mission('kinematics.acceleration', 0), 4000);
  t('acceleration: v₀ = −4 m/s, a = −3 m/s² — speeding up with a < 0, mission solved', await mission('kinematics.acceleration', 0));
  await set('acc-v0', 6); await set('acc-a', -4);
  await until(() => mission('kinematics.acceleration', 1), 5000);
  t('... v₀ = +6 m/s, a = −4 m/s² turns round — mission solved', await mission('kinematics.acceleration', 1));
  await set('acc-a', 5); await set('acc-v0', 0); await fresh(); await p.waitForTimeout(500);
  // the area label and the status line of ONE frame (the area is drawn first)
  const am = await modelTxt(), [ar, axl] = await p.evaluate(re => { const T = window.__T, R = new RegExp(re);
    let i = T.length - 1; while (i >= 0 && !/^t = .* · {3}x = /.test(T[i])) i--;
    let j = i; while (j >= 0 && !R.test(T[j])) j--; return [T[j], T[i]]; }, '^' + LR('שטח = Δx = '));
  const axs = nums(axl);
  t('... the model line is v = v₀ + at, and the area under v(t) is the x travelled', /v = v₀ \+ at = 0 \+ 5\.0×/.test(am) && !!ar && Math.abs(nums(ar)[0] - axs[1]) <= 0.1, am + ' | ' + ar + ' | x ' + axs[1]);
  await until(() => mission('kinematics.acceleration', 2), 4000);
  t('... from rest with a = 5 m/s² it reaches x = 10 m at t = 2.00 s — mission solved', await mission('kinematics.acceleration', 2));

  // the normal force: a constraint, not mg
  await open('forces.normal-force');
  t('normal force: a prediction is asked first — N on a 30° slope', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await set('nf-F', 20); await fresh(); await p.waitForTimeout(300);
  const nf20 = nums(await last('^N = \\(mg \\+ F\\)·cosθ = '))[0];
  t('normal force: pressing 20 N on a flat surface gives N = mg + F = 59.2 N — mission solved', close(nf20, 4 * 9.8 + 20, 0.051) && await mission('forces.normal-force', 0), nf20);
  await set('nf-F', -15); await fresh(); await p.waitForTimeout(300);
  const nfm = nums(await last('^N = \\(mg \\+ F\\)·cosθ = '))[0];
  t('... pulling up 15 N: N = mg − F = 24.2 N < mg — mission solved', close(nfm, 4 * 9.8 - 15, 0.051) && await mission('forces.normal-force', 1), nfm);
  await set('nf-mass', 1); await fresh(); await p.waitForTimeout(300);
  t('... a 1 kg block pulled up with 15 N > mg: N cannot go negative — the hand carries the weight, N = 0', nums(await last('^N = \\(mg \\+ F\\)·cosθ = '))[0] === 0);
  await set('nf-mass', 4); await set('nf-F', 0); await set('nf-theta', 60); await fresh(); await p.waitForTimeout(300);
  t('... no hand, 60°: N = mg cos60° = ½mg — mission solved', close(nums(await last('^N = mg·cosθ = '))[0], 19.6, 0.051) && await mission('forces.normal-force', 2));

  // the second law: the net force sets the change, not the motion
  await open('newton2.n2-law');
  t('second law: a prediction is asked first — the net force on a crate that slides and slows', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await set('mass', 10); await set('n2-mu', 0); await set('n2-F', 20); await click('btn-n2-reset');
  await until(() => mission('newton2.n2-law', 1), 3000);
  t('second law: 20 N on 10 kg, smooth floor: a = 2.00 m/s² — mission solved', await mission('newton2.n2-law', 1) && nums(await last('^a {2}= '))[0] === 2);
  await set('mass', 5); await set('n2-mu', 0.2); await set('n2-F', 25); await click('btn-n2-reset');
  await until(() => mission('newton2.n2-law', 2), 3000);
  t('... 25 N on 5 kg with μ = 0.2: a = (25 − 9.8)/5 = 3.04 m/s² — mission solved', await mission('newton2.n2-law', 2) && nums(await last('^a {2}= '))[0] === 3.04);
  await p.waitForTimeout(600); await set('n2-F', 0); await fresh();
  await until(() => mission('newton2.n2-law', 0), 3000);
  const sf0 = nums(await last('^ΣF = '))[0];
  t('... let go while it moves: ΣF = −μmg = −9.8 N with the block still moving right — mission solved', await mission('newton2.n2-law', 0) && sf0 === -9.8 && /ΣF = F \+ f = 0\.0 − 9\.8 = −9\.8 N/.test(await modelTxt()), sf0 + ' | ' + await modelTxt());

  // the incline: friction flips with the sliding, the section's problem, the angle of repose
  await open('newton2.n2-apps');
  t('incline: a prediction is asked first — which way friction points while the block slides up', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await set('inc-theta', 30); await set('inc-mu', 0.3); await set('inc-v0', 5); await click('btn-inc-push'); await fresh();
  await until(async () => !!(await last('^' + LR('חזר לתחתית במהירות ') + '[\\d.]+')), 9000);
  t('incline 30°, μ = 0.3: pushed up, the block stops and slides back — mission "watch the friction both ways"', await mission('newton2.n2-apps', 0));
  const back = await last('^' + LR('חזר לתחתית במהירות ') + '[\\d.]+');
  // back at the foot: v² = 2|a_down|·d, with d = v0²/2|a_up|
  const aUp = 9.8 * (0.5 + 0.3 * Math.cos(30 * D)), aDn = 9.8 * (0.5 - 0.3 * Math.cos(30 * D));
  t('... and returns to the foot slower than it left: v = v0·√(a_down/a_up)', !!back && close(nums(back)[0], 5 * Math.sqrt(aDn / aUp), 0.03), back);
  await set('inc-theta', 37); await set('inc-mu', 0.2); await set('inc-v0', 7.6); await click('btn-inc-push'); await fresh();
  await until(async () => !!(await last('^d = [\\d.]+ m$')), 6000);
  const dUp = nums(await last('^d = [\\d.]+ m$'))[0], dWant37 = 7.6 ** 2 / (2 * 9.8 * (Math.sin(37 * D) + 0.2 * Math.cos(37 * D)));
  t('incline: the section\'s problem (37°, μ 0.2, 7.6 m/s) climbs d = v0²/2g(sinθ + μcosθ) = 3.87 m — mission solved', close(dUp, dWant37, 0.011) && await mission('newton2.n2-apps', 1), dUp + ' m of ' + dWant37.toFixed(3));
  await set('inc-mu', 0.5); await set('inc-theta', 28); await set('inc-v0', 3); await click('btn-inc-push'); await fresh(); await p.waitForTimeout(300); await fresh();
  await until(async () => !!(await last('^N = mg = ')), 7000);
  t('incline μ = 0.5: at 28° (tan 28° > 0.5) the block slides back to the floor', !!(await last('^N = mg = ')) && !(await mission('newton2.n2-apps', 2)));
  await set('inc-theta', 26); await click('btn-inc-push'); await fresh();
  await until(() => mission('newton2.n2-apps', 2), 6000);
  t('... at 26° (tan 26° < 0.5, within 2° of arctan μ) it stays put — mission "the angle of repose" solved', !!(await last('^fₛ = mg·sinθ = ')) && await mission('newton2.n2-apps', 2));

  // the third law: missions
  await open('forces.n3-law');
  t('third law: a prediction is asked first — which force is larger, 90 kg on 30 kg', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  await click('btn-n3-who'); await click('btn-n3-push'); await until(() => mission('forces.n3-law', 0), 4000);
  t('third law: the light skater (B, 30 kg) pushes the heavy one — mission solved', await mission('forces.n3-law', 0));
  await click('btn-n3-reset'); await set('n3-mB', 20); await click('btn-n3-push'); await until(() => mission('forces.n3-law', 1), 4000);
  t('... 60 kg and 20 kg glide apart at a speed ratio of 3 — mission solved', await mission('forces.n3-law', 1));
  await click('btn-n3-reset'); await set('n3-F', 240); await click('btn-n3-push'); await p.waitForTimeout(300);
  const aa3 = (await all('^a = [\\d.]+ m/s²$')).map(s => nums(s)[0]);
  t('... F = 240 N on 60 kg: a_A = 4.0 m/s² and a_B = 240/20 = 12.0 m/s² — mission solved', aa3.includes(4) && aa3.includes(12) && await mission('forces.n3-law', 2), [...new Set(aa3)].join(', '));
  // the push by hand: tap B, pull it away from A, let go
  await click('btn-n3-reset'); await set('n3-mB', 30); rr = await rect(); W = rr.w;
  const n3xB = W / 2 + 30 * (W < 600 ? 1 : 1.3) * Math.cbrt(30 / 60) + 2, n3y = (W < 600 ? 284 : 262) - 40;
  await drag(rr, [[n3xB, n3y], [n3xB + 20, n3y], [n3xB + 50, n3y]]);
  t('third law: pulling skater B 50 px away from A sets F = 350 N and B is the pusher', close(await val('n3-F'), 350, 0.01) && /B/.test(await p.evaluate(() => document.getElementById('btn-n3-who').textContent)), await val('n3-F'));

  // the first law: hold to push; a force changes the motion, nothing keeps it
  await open('forces.inertia');
  t('first law: a prediction is asked first — what keeps a puck moving on frictionless ice', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  rr = await rect(); W = rr.w;
  const press = async (ms, side) => {   // hold a finger down beside the block (left of it pushes right)
    const P = { x: rr.x + W / 2 + (side || -1) * 90, y: rr.y + (W < 600 ? 260 : 240) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P] });
    await p.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const card = async re => { const s = await last(re); return s ? nums(s)[0] : NaN; };
  await set('friction', 0); await set('in-F', 15); await set('mass-in', 5);
  await press(500); await p.waitForTimeout(300); await fresh(); await p.waitForTimeout(1200);
  const vc = (await all('^v = [−+][\\d.]+ m/s$')).map(s => nums(s)[0]);
  t('first law, μ = 0: after one push the velocity stays constant — no force, no change', vc.length > 20 && vc[0] > 1 && vc.every(x => x === vc[0]) && (await card('^ΣF = ')) === 0, vc.length + ' frames at ' + vc[0] + ' m/s');
  await until(() => mission('forces.inertia', 0), 4000);
  t('... which is the mission "one push on a smooth floor"', await mission('forces.inertia', 0));
  await click('btn-in-reset'); await set('friction', 0.2); await set('in-F', 5); await fresh();
  await press(400);
  const fsAll = await all('^fₛ = '), vAll = (await all('^v = ')).map(s => nums(s)[0]);
  t('first law, μ = 0.2, 5 kg, F = 5 N < μmg: the block stays, static friction fₛ = −F', fsAll.some(s => /fₛ = −5\.0 N/.test(s)) && vAll.length > 5 && vAll.every(x => x === 0), [...new Set(fsAll)].join(' | '));
  // get it going with 15 N, then balance friction with 10 N on the slider while the push stays on
  await set('in-F', 15); await click('btn-in-hold'); await p.waitForTimeout(700); await set('in-F', 10); await fresh();
  await until(() => mission('forces.inertia', 1), 5000);
  const ifk1 = await card('^fₖ = '), isf1 = await card('^ΣF = ');
  t('... F = 10 N: kinetic friction −μmg = −9.8 N, ΣF = +0.2 N — nearly constant speed, mission solved', ifk1 === -9.8 && isf1 === 0.2 && await mission('forces.inertia', 1), ifk1 + ', ' + isf1);
  await click('btn-in-hold'); await fresh(); await p.waitForTimeout(250);
  const ad = await card('^a = ΣF/m = ');
  t('... let go: ΣF = −μmg, so a = −μg = −1.96 m/s² — moving right, pushed left: mission solved', ad === -1.96 && await mission('forces.inertia', 2), ad);

  // Atwood: the tension between the weights, g/2, and the section's problem
  await open('newton2.n2-atwood');
  t('Atwood: a prediction is asked first — where the tension lies', (await predOpts()).length === 4, (await predOpts()).join(' | '));
  rr = await rect(); W = rr.w;
  const atPX = W < 600 ? W * 0.42 : W * 0.36, atPY = 28 + (W < 600 ? 36 : 44) + 8;
  await tap(rr, atPX, atPY);    // tap the pulley: the brake lets go
  await until(() => mission('newton2.n2-atwood', 0), 3000);
  t('Atwood: tapping the pulley releases it — mission "compare T with both weights" solved', await mission('newton2.n2-atwood', 0));
  await click('btn-atw-reset'); await set('atw-m1', 1); await set('atw-m2', 3); await click('btn-atw-launch');
  await until(() => mission('newton2.n2-atwood', 1), 3000);
  t('Atwood: m₂ = 3m₁ gives a = g/2 — mission solved', await mission('newton2.n2-atwood', 1) && nums(await last('^a = [\\d.]+ m/s²$'))[0] === 4.9);
  await click('btn-atw-reset'); await set('atw-m1', 4); await set('atw-m2', 6); await click('btn-atw-launch'); await fresh();
  await until(() => mission('newton2.n2-atwood', 2), 5000);
  const v2m = await last('^' + LR('בירידה של 2 m:  v = ') + '[\\d.]+');
  t('Atwood 4 kg and 6 kg: after a 2 m drop v = √(2ad) = 2.80 m/s — the section\'s problem, mission solved', !!v2m && close(nums(v2m)[1], Math.sqrt(2 * (2 * 9.8 / 10) * 2), 0.006) && await mission('newton2.n2-atwood', 2), v2m);

  // ── 4. the learning experience ──────────────────────────────────────
  console.log('\n4) misconception boxes, quiz keys, hints, units');
  await require('./mech_learning')(p, ['kinematics', 'vectors', 'forces', 'newton2', 'forces2'], t);

  t('no page errors, touchend included', errs.length === 0, errs.join(' | ') || 'none');
  await b.close();
  console.log(`check_mech1: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ MECHANICS א-ה: ANSWERS, READOUTS AND DRAGS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
