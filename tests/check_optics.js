// Optics: every guided problem recomputed from first principles, and two
// simulations that once drew nothing where the physics says something is.
//
//   node tests/check_optics.js
//
// Each problem step's stated answer must agree with an independent
// computation (to its own tolerance, or 1.5 %, whichever is looser) -- a
// stricter test than the app's acceptance window. Then: the prism must spread
// white light into a spectrum at its default angle (it once sent every colour
// into total internal reflection and drew nothing), and the convex mirror's
// image must lie behind the mirror. Last, every draggable simulation is
// driven by a finger on a 390 px phone: what it drives must change, and the
// page must not scroll under the drag.
// Also the learning experience: a misconception box per section, quiz keys
// that are not conspicuously the longest option, hints that are sentences,
// and no number glued to its unit.
const { chromium } = require('playwright');
const path = require('path');
const { LR, WORD } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

let fail = 0, n = 0;
const t = (name, ok, info) => { n++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

const D = Math.PI / 180, h = 6.626e-34, c = 3e8, e = 1.602e-19;
const asind = x => Math.asin(x) / D, sind = x => Math.sin(x * D), tand = x => Math.tan(x * D), cosd = x => Math.cos(x * D);
const lens = (f, d) => 1 / (1 / f - 1 / d);
// key -> the value of every step, in the units of the step
const PRISM = (() => {
  const dev = n => { const t2 = asind(sind(40) / n), t3 = 30 - t2, t4 = asind(n * sind(t3)); return [t2, t3, t4, 40 + t4 - 30]; };
  const r = dev(1.51), v = dev(1.53); return [r[0], r[1], r[2], r[3], v[3] - r[3]];
})();
const EXPECT = {
  'opt-light.light-nature': [1e8, c / 1e8],
  'opt-light.light-speed': [600 / 450, c / (600 / 450)],
  'opt-light.em-spectrum': [c / 1e6, h * 1e6 / e * 1e9],
  'opt-light.color-mixing': [580, 580],
  'opt-reflection.refl-laws': [50, 50, 40],
  'opt-reflection.plane-mirror': [20, 4],
  'opt-reflection.concave-mirror': [30, lens(30, 25), -lens(30, 25) / 25],
  'opt-reflection.convex-mirror': [lens(-40, 200), -lens(-40, 200) / 200],
  'opt-refraction.snell-law': [sind(45) / 1.5, asind(sind(45) / 1.5)],
  'opt-refraction.tir': [1 / 1.33, asind(1 / 1.33), 2.0 * tand(asind(1 / 1.33))],
  'opt-refraction.prism': PRISM,
  'opt-refraction.fiber-optics': [1.52 / 1.62, Math.sqrt(1.62 ** 2 - 1.52 ** 2), asind(Math.sqrt(1.62 ** 2 - 1.52 ** 2))],
  'opt-lenses.convex-lens': [lens(5, 6), -lens(5, 6) / 6],
  'opt-lenses.concave-lens': [lens(-1e9, 1) && 1 / (1 / 60 + 1 / 60), 100 / 30, 100 / 30 - 10, 100 / (100 / 30 - 10)],
  'opt-lenses.lens-eye': [-1.5, 1 / 0.25 - 1 / 1.5, 100 / (1 / 0.25 - 1 / 1.5)],
  'opt-lenses.telescope': [160 / 4, 250 / 10, 1000],
  'opt-waves.interference': [1500, 1500 / 500, 1500 / 2.5],
  'opt-waves.youngs-slits': [3e-3 * 0.3e-3 / 1.5 * 1e9, c / (3e-3 * 0.3e-3 / 1.5)],
  'opt-waves.diffraction': [2.5, 633e-9 / (2.5e-3 / 2.0) * 1e3, 2 * 2.0 * 633e-9 / (633e-9 / (2.5e-3 / 2.0) / 2) * 1e3],
  'opt-waves.thin-film': [4 * 1.34 * 320 / 3, 4 * 1.34 * 320 / 5],
  'opt-waves.grating': [asind(486 / 1250), asind(656 / 1250), asind(656 / 1250) - asind(486 / 1250)],
  'opt-modern.em-spectrum-full': [13.6 * e, 13.6 * e / h, c / (13.6 * e / h) * 1e9],
  'opt-modern.polarization': [500, 500 * cosd(40) ** 2],
  'opt-modern.doppler': [2, c * 2e3 / (2 * 10e9) * 3.6],
  'opt-modern.lasers': [h * c / 532e-9, 5e-3 / (h * c / 532e-9)],
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', x => errs.push(x.message));
  await p.goto(F);
  await p.waitForTimeout(700);
  const content = await p.evaluate(() => {
    if (window.closeOnboarding) closeOnboarding();
    const out = {};
    for (const ch of OPTICS_CHAPTERS) for (const se of ch.sections) {
      const k = ch.id + '.' + se.id, C = CONTENT[k];
      out[k] = { steps: ((C.problem || {}).steps || []).map(s => ({ a: parseFloat(s.answer), tol: s.tolerance || 0 })),
        quiz: (C.quiz || []).map(q => q.correct >= 0 && q.correct < q.opts.length) };
    }
    return out;
  });
  t('every optics section has an independent computation', Object.keys(content).every(k => EXPECT[k]), Object.keys(content).filter(k => !EXPECT[k]).join(' '));
  for (const k in content) {
    const want = EXPECT[k] || [], got = content[k].steps;
    t(k + ': step count', got.length === want.length, got.length + ' vs ' + want.length);
    got.forEach((s, i) => {
      if (want[i] === undefined) return;
      const lim = Math.max(s.tol, Math.abs(want[i]) * 0.015);
      t(k + '#' + i, Math.abs(s.a - want[i]) <= lim, 'answer ' + s.a + ', computed ' + want[i].toPrecision(5));
    });
    t(k + ': quiz keys in range', content[k].quiz.every(Boolean));
  }

  // ── the learning experience: a misconception box in every section; quiz keys
  // that do not give themselves away by length (strictly longest in at most
  // 30 % of questions, never more than 1.3x the next option); second-tier
  // hints that are a Hebrew sentence, not a bare formula; numbers spaced
  // from their units ──
  const lx = await p.evaluate((WSRC) => { const WORD = new RegExp(WSRC);   // a word of the page's language
    const txt = h => { const d = document.createElement('template'); d.innerHTML = _ltSafe(String(h || '')); return d.content.textContent.replace(/\s+/g, ' ').trim(); };
    const r = { noMis: [], q: 0, longest: 0, loud: [], bareHint: [], glued: [] };
    for (const ch of OPTICS_CHAPTERS) for (const se of ch.sections) {
      const k = ch.id + '.' + se.id, C = CONTENT[k];
      if (!/mis-block/.test(C.theory.html + ((C.theory.enrich || {}).html || ''))) r.noMis.push(k);
      (C.quiz || []).forEach((q, i) => {
        r.q++;
        const L = q.opts.map(o => txt(o).length), key = L[q.correct], rest = Math.max(...L.filter((_, j) => j !== q.correct));
        if (key > rest) r.longest++;
        if (key > 1.3 * rest && key - rest >= 3) r.loud.push(k + '#' + i);
      });
      const steps = (C.problem || {}).steps || [];
      steps.forEach((st, i) => { if (!WORD.test(txt(st.hint))) r.bareHint.push(k + '#' + i); });
      const all = [C.theory.html, ...(C.quiz || []).flatMap(q => [q.q, ...q.opts, q.explain]), ...steps.flatMap(s => [s.q, s.nudge, s.hint, s.explain])].map(txt).join(' | ');
      const m = all.match(/(?<![A-Za-z_])\d(?:nm|mm|cm|μm|keV|meV|eV|kHz|MHz|GHz|THz|Hz|kV|V)(?![A-Za-z0-9\/])/g);
      if (m) r.glued.push(k + ': ' + m.join(','));
    }
    return r;
  }, WORD.source);
  t('every section has a misconception box', lx.noMis.length === 0, lx.noMis.join(' '));
  t('quiz key strictly longest in at most 30 % of questions', lx.longest <= 0.3 * lx.q, lx.longest + '/' + lx.q);
  t('no quiz key more than 1.3x (and 3+ characters) longer than every other option', lx.loud.length === 0, lx.loud.join(' '));
  t('every problem hint says something in words', lx.bareHint.length === 0, lx.bareHint.join(' '));
  t('no number glued to its unit', lx.glued.length === 0, lx.glued.join(' | '));

  // ── simulations ──
  const open = async (chId, se) => {
    await p.evaluate(([c2, s2]) => { state.subject = 'optics'; state.chapter = c2; state.section = s2; state.tab = 'sim'; render(); }, [chId, se]);
    await p.waitForTimeout(1100);
  };
  // the prism at its default angle: count distinct hues to the right of the prism
  await open('opt-refraction', 'prism');
  const hues = await p.evaluate(() => {
    const cv = document.getElementById('sim-canvas'), g = cv.getContext('2d');
    const x0 = Math.floor(cv.width * 0.72), d = g.getImageData(x0, 0, cv.width - x0, cv.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2], mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx < 120 || mx - mn < 80) continue;
      let hh = mx === r ? ((gg - bb) / (mx - mn)) % 6 : mx === gg ? (bb - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
      seen.add(Math.round(((hh * 60) + 360) % 360 / 30));
    }
    return seen.size;
  });
  t('prism spreads white light into a spectrum at its default angle', hues >= 4, hues + ' hue bands');
  // the convex mirror: the virtual image (green, dashed) must be to the right of the mirror
  await open('opt-reflection', 'convex-mirror');
  const behind = await p.evaluate(() => {
    const cv = document.getElementById('sim-canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const mx = Math.round(W * 0.62), d = g.getImageData(0, Math.round(H * 0.3), W, Math.round(H * 0.25)).data, w = W;
    let left = 0, right = 0;
    for (let i = 0; i < d.length; i += 4) {
      const x = (i / 4) % w, r = d[i], gg = d[i + 1], bb = d[i + 2];
      // the image arrow is opaque #34d399; the rays of that colour are drawn fainter
      if (Math.abs(r - 52) < 26 && Math.abs(gg - 211) < 26 && Math.abs(bb - 153) < 26) { if (x > mx + 6) right++; else left++; }
    }
    return { left, right };
  });
  t('convex mirror: the virtual image is drawn behind the mirror', behind.right > 40, JSON.stringify(behind));

  // ── the imaging bench (both lenses, both mirrors): the live equation line
  // must carry the thin-lens / mirror equation's own dᵢ and m, the image must
  // be drawn where that dᵢ puts it, the lens's f must follow n(λ), and every
  // mission must be reachable ──
  // set a slider, then wait two frames: the sim has drawn (and checked its missions) with the new value
  const setv = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById('inp-' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true }));
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, [id, v]);
  const modelTx = () => p.evaluate(() => (document.querySelector('.sk-model-tx') || {}).textContent || '');
  // the live line once it shows what was just set (a frame can be late on a busy machine)
  const modelFor = async (needle, ms = 2500) => { let tx = ''; for (let w = 0; w < ms; w += 50) { tx = await modelTx(); if (tx.includes(needle)) return tx; await p.waitForTimeout(50); } return tx; };
  const missions = () => p.evaluate(() => [...document.querySelectorAll('.sk-m')].map(li => li.classList.contains('done') ? 1 : 0).join(''));
  const num = s => parseFloat(String(s).replace('−', '-').replace('+', ''));
  const BENCH = [
    ['opt-lenses', 'convex-lens', 'cl', 1, false, [[209, 95], [60, 95], [143, 95], [300, 50], [120, 160]]],
    ['opt-lenses', 'concave-lens', 'dcl', -1, false, [[209, 95], [30, 95], [380, 60], [95, 95]]],
    ['opt-reflection', 'concave-mirror', 'cm', 1, true, [[213, 85], [60, 85], [170, 85], [380, 45], [100, 140]]],
    ['opt-reflection', 'convex-mirror', 'cvm', -1, true, [[213, 85], [20, 85], [300, 45]]],
  ];
  for (const [chId, se, pre, sg, mirror, cases] of BENCH) {
    await open(chId, se);
    await p.evaluate(() => { localStorage.removeItem('phys_game_state_v2'); state.missions = {}; });
    for (const [dO, f0] of cases) {
      await setv(pre + '-do', dO); await setv(pre + '-f', f0); await p.waitForTimeout(140);
      const tx = await modelFor('− 1/' + dO + ' '), f = sg * f0, di = f * dO / (dO - f), m = -di / dO;
      const gdi = /dᵢ = ([+−-]?\d+) mm/.exec(tx), gm = /m = −dᵢ\/dₒ = ([+−-]?\d+\.\d\d)/.exec(tx);
      t(se + ` dₒ=${dO} f=${f}: dᵢ in the equation line`, gdi && Math.abs(num(gdi[1]) - di) <= 0.6, tx);
      t(se + ` dₒ=${dO} f=${f}: m in the equation line`, gm && Math.abs(num(gm[1]) - m) <= 0.006, tx);
      // the image arrow (red if real, green if virtual) stands where dᵢ puts it
      // (rows of a 3 px strip at x(dᵢ) in the image's colour: a vertical arrow
      // fills most of its rows, a ray crossing the strip only a few)
      const at = await p.evaluate(([di, m, real, mirror]) => {
        const cv = document.getElementById('sim-canvas'), g = cv.getContext('2d'), dpr = cv.width / cv.offsetWidth, W = cv.offsetWidth, H = cv.offsetHeight;
        const narrow = W < 520, X0 = mirror ? Math.round(W * 0.62) : Math.round(W * (narrow ? 0.44 : 0.45)), k = (X0 - 24) / (narrow ? 300 : 400);
        const ix = X0 + (mirror ? -1 : 1) * di * k, cy = Math.round(H * (mirror ? 0.43 : 0.42)), len = Math.min(Math.abs(m) * (narrow ? 44 : 58), 120);
        if (ix < 8 || ix > W - 8) return { off: true };
        const want = real ? [248, 113, 113] : [52, 211, 153], y0 = Math.round((cy - 130) * dpr), rows = Math.round(260 * dpr), cols = Math.max(3, Math.round(3 * dpr));
        const d = g.getImageData(Math.round(ix * dpr) - Math.floor(cols / 2), y0, cols, rows).data;
        let n = 0; for (let r = 0; r < rows; r++) { let hit = false;
          for (let c = 0; c < cols; c++) { const i = (r * cols + c) * 4; if (Math.abs(d[i] - want[0]) < 30 && Math.abs(d[i + 1] - want[1]) < 30 && Math.abs(d[i + 2] - want[2]) < 30) hit = true; }
          if (hit) n++; }
        return { n: n / dpr, len };
      }, [di, m, di > 0, mirror]);
      t(se + ` dₒ=${dO} f=${f}: the image is drawn at dᵢ`, at.off || at.n >= Math.max(5, 0.45 * at.len), JSON.stringify(at));
    }
    if (!mirror) {   // chromatic aberration: f(λ) = f₅₅₀·(n₅₅₀−1)/(n(λ)−1), Cauchy crown glass
      await setv(pre + '-do', 209); await setv(pre + '-f', 95); await setv(pre + '-wl', 400); await p.waitForTimeout(140);
      const n4 = 1.5 + 4241 * (1 / 400 ** 2 - 1 / 550 ** 2), fv = 95 * 0.5 / (n4 - 1);
      const g = /1\/\(?−?(\d+\.\d)\)? − 1\/209/.exec(await modelTx());
      t(se + ': violet focuses nearer, f(400 nm) from n(λ)', g && Math.abs(+g[1] - fv) < 0.06, (g || [])[1] + ' vs ' + fv.toFixed(2));
      await setv(pre + '-wl', 550);
    }
  }
  // every mission of the bench can be solved, by the state its text asks for
  const reach = async (chId, se, steps, wantAll) => {
    await open(chId, se);
    await p.evaluate(() => { state.missions = {}; render(); });
    await p.waitForTimeout(1100);
    await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
    for (const s of steps) { if (typeof s === 'function') await s(); else { await setv(s[0], s[1]); await p.waitForTimeout(160); } }
    const got = await missions();
    t(se + ': every mission is reachable', got === wantAll, got);
  };
  await reach('opt-lenses', 'convex-lens', [['cl-f', 95], ['cl-do', 190], ['cl-do', 60], ['cl-do', 143],
    async () => {   // a screen at dᵢ = 3f, dragged there by mouse, then cover the lens after predicting
      await p.evaluate(() => { document.getElementById('btn-cl-screen').click(); document.getElementById('sim-canvas').scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(500);
      const r = await p.evaluate(() => { const cv = document.getElementById('sim-canvas'), b = cv.getBoundingClientRect(), W = cv.offsetWidth, H = cv.offsetHeight;
        const X0 = Math.round(W * (W < 520 ? 0.44 : 0.45)), k = (X0 - 24) / (W < 520 ? 300 : 400), s0 = Math.min(W - 30, X0 + Math.max(60, (W - X0) * 0.62));
        return { x: b.left, y: b.top, s0, to: X0 + 95 * 143 / (143 - 95) * k, yy: H - 96 }; });
      await p.mouse.move(r.x + r.s0, r.y + r.yy); await p.mouse.down(); await p.mouse.move(r.x + (r.s0 + r.to) / 2, r.y + r.yy); await p.mouse.move(r.x + r.to, r.y + r.yy); await p.mouse.up(); await p.waitForTimeout(160);
      await p.evaluate(() => document.getElementById('btn-cl-cover').click()); await p.waitForTimeout(150);
      await p.evaluate(() => document.querySelectorAll('.sk-opt')[2].click()); await p.waitForTimeout(200);
    }], '1111');
  await reach('opt-lenses', 'concave-lens', [['dcl-f', 95], ['dcl-do', 20], ['dcl-do', 95], ['dcl-f', 50], ['dcl-do', 210]], '111');
  await reach('opt-reflection', 'concave-mirror', [['cm-f', 85], ['cm-do', 170], ['cm-do', 60], ['cm-do', 300], ['cm-do', 85]], '1111');
  await reach('opt-reflection', 'convex-mirror', [['cvm-f', 85], ['cvm-do', 20], ['cvm-do', 85], ['cvm-f', 50], ['cvm-do', 210]], '111');

  // ── Snell and TIR: θ₂ from n₁ sin θ₁ = n₂ sin θ₂, the reflected share from
  // Fresnel's equations (unpolarized), total reflection exactly past θc ──
  const fres = (n1, n2, th) => { const s2 = n1 / n2 * sind(th); if (s2 >= 1) return { R: 1, t2: 90, tir: true };
    const t2 = Math.asin(s2), ci = cosd(th), ct = Math.cos(t2), rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
    return { R: (rs * rs + rp * rp) / 2, t2: t2 / D, tir: false }; };
  for (const [se, pre, cases] of [['snell-law', 'snell', [[1, 1.5, 35], [1, 1.5, 0], [1, 1.33, 60], [1.5, 1, 30], [1.5, 1, 45], [1, 2.42, 80]]],
    ['tir', 'tir', [[1.5, 1, 41.7], [1.5, 1, 41.9], [1.33, 1, 48.7], [1.33, 1, 48.8], [2.42, 1, 24.3], [1.2, 1.5, 89]]]]) {
    await open('opt-refraction', se);
    for (const [n1, n2, th] of cases) {
      await setv(pre + '-n1', n1); await setv(pre + '-n2', n2); await setv(pre + '-th', th); await p.waitForTimeout(140);
      const tx = await modelTx(), F = fres(n1, n2, th);
      if (F.tir) t(`${se} n₁=${n1} n₂=${n2} θ=${th}: total internal reflection`, /> 1/.test(tx) && !/θ₂ = \d/.test(tx), tx);
      else {
        const g = /θ₂ = (\d+\.\d)°/.exec(tx), r = /(\d+\.?\d*)%[^%]*?(\d+\.?\d*)%/.exec(tx);
        t(`${se} n₁=${n1} n₂=${n2} θ=${th}: θ₂ by Snell`, g && Math.abs(+g[1] - F.t2) < 0.06, tx);
        t(`${se} n₁=${n1} n₂=${n2} θ=${th}: Fresnel R and T`, r && Math.abs(+r[1] / 100 - F.R) < (F.R >= 0.1 ? 0.0051 : 0.0006) && Math.abs(+r[1] + +r[2] - 100) < 1.01, tx);
      }
    }
  }
  await reach('opt-refraction', 'snell-law', [['snell-n1', 1], ['snell-n2', 1.5], ['snell-th', 0], ['snell-th', 56], ['snell-n1', 1.5], ['snell-n2', 1], ['snell-th', 30]], '111');
  await reach('opt-refraction', 'tir', [['tir-n1', 1.5], ['tir-n2', 1], ['tir-th', 41.8], ['tir-th', 41.6], ['tir-n1', 2.42], ['tir-th', 24.4], ['tir-n1', 1.2], ['tir-n2', 1.5], ['tir-th', 89]], '1111');

  // ── polarization: I₁ = I₀/2, then cos² of each angle between axes ──
  await open('opt-modern', 'polarization');
  for (const [i0, th] of [[80, 45], [80, 60], [100, 30], [50, 90], [80, 0]]) {
    await setv('pol-i0', i0); await setv('pol-angle', th); await p.waitForTimeout(140);
    const g = /= (\d+\.?\d*)%;/.exec(await modelTx()), want = i0 / 2 * cosd(th) ** 2;
    t(`Malus: I₀=${i0}% θ=${th}°`, g && Math.abs(+g[1] - want) <= (want < 10 ? 0.051 : 0.51), (g || [])[1] + ' vs ' + want.toFixed(2));
  }
  await reach('opt-modern', 'polarization', [['pol-i0', 80], ['pol-angle', 90], ['pol-angle', 60],
    async () => { await p.evaluate(() => document.getElementById('btn-pol-mid').click()); await p.waitForTimeout(150);
      await p.evaluate(() => document.querySelectorAll('.sk-opt')[1].click()); await p.waitForTimeout(250); }], '111');
  for (const [m, a] of [[45, 90], [30, 90], [60, 120]]) {
    await setv('pol-mid', m); await setv('pol-angle', a); await p.waitForTimeout(140);
    const g = /= (\d+\.?\d*)%, /.exec(await modelTx()), want = 40 * cosd(m) ** 2 * cosd(a - m) ** 2;
    t(`three polarizers: middle ${m}°, analyzer ${a}°`, g && Math.abs(+g[1] - want) <= (want < 10 ? 0.051 : 0.51), (g || [])[1] + ' vs ' + want.toFixed(2));
  }

  // ── thin film: the orders reinforced in the visible follow the phase
  // reversals (one: 2nt = (m+½)λ; two: 2nt = mλ), a vanishing soap film is
  // black while bare glass under a vanishing coating is not, and every
  // mission is reachable ──
  await open('opt-waves', 'thin-film');
  for (const [pre, nf, tt, odd] of [['tf-soap', 1.33, 300, true], ['tf-soap', 1.33, 500, true], ['tf-oil', 1.45, 200, true], ['tf-ar', 1.38, 400, false], ['tf-ar', 1.38, 700, false]]) {
    await p.evaluate(id => document.getElementById('btn-' + id).click(), pre); await setv('tf-thick', tt); await p.waitForTimeout(160);
    const tx = await modelTx(), want = [];
    for (let m = 0; m < 12; m++) { const l = odd ? 2 * nf * tt / (m + 0.5) : (m ? 2 * nf * tt / m : Infinity); if (l >= 380 && l <= 700) want.push(Math.round(l)); }
    const got = ((/:\s*([\d ,nm—]+)\.$/.exec(tx) || [])[1] || '').match(/\d+/g) || [];
    t(`thin film ${pre} t=${tt}: reinforced ${want.join(',')}`, got.join(',') === want.join(','), tx);
  }
  for (const [pre, dark] of [['tf-soap', true], ['tf-ar', false]]) {
    await p.evaluate(id => document.getElementById('btn-' + id).click(), pre); await p.waitForTimeout(250);
    const px = await p.evaluate(() => { const cv = document.getElementById('sim-canvas'), W = cv.offsetWidth, dpr = cv.width / W, x = Math.max(10, W * 0.04) + Math.min(110, W * 0.24) / 2;
      const d = cv.getContext('2d').getImageData(Math.round(x * dpr), Math.round(36 * dpr), 1, 1).data; return d[0] + d[1] + d[2]; });
    t(`thin film ${pre}: the thinnest film is ${dark ? 'black' : 'not black'}`, dark ? px < 60 : px > 200, String(px));
  }
  await reach('opt-waves', 'thin-film', [async () => p.evaluate(() => document.getElementById('btn-tf-soap').click()), ['tf-thick', 10], ['tf-thick', 100],
    async () => p.evaluate(() => document.getElementById('btn-tf-ar').click()), ['tf-thick', 100]], '111');

  // ── Young: Δy = λL/d in the equation line; the markers read the exact path
  // difference; the missions (fringes spread as d shrinks, a measured Δy, a
  // missing order where d = 3a) are reachable by dragging the markers ──
  const capT = () => p.evaluate(() => { if (window.__PT) return; window.__PT = []; const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) { if (typeof s === 'string' && this.canvas.id === 'sim-canvas') { window.__PT.push(s.replace(/[⁦-⁩‎]/g, '')); if (window.__PT.length > 3000) window.__PT.splice(0, 1500); } return o.apply(this, arguments); }; });
  const lastT = re => p.evaluate(src => { const R = new RegExp(src), a = (window.__PT || []).filter(s => R.test(s)); return a.length ? a[a.length - 1] : null; }, re);
  await capT();
  await open('opt-waves', 'youngs-slits');
  const ygeo = () => p.evaluate(() => { const cv = document.getElementById('sim-canvas'), b = cv.getBoundingClientRect(), W = cv.offsetWidth, H = cv.offsetHeight, nw = W < 520,
    sx = nw ? 50 : 84, a = sx + (nw ? 70 : 140), L = +document.getElementById('inp-ys-L').value, scr = a + (L - 0.5) / 2.5 * (W - (nw ? 54 : 80) - a);
    return { x: b.left, y: b.top, scr, cy: Math.round(H * 0.47), k: H * 0.44 / 16 }; });
  const yOf = (m, lam, d, L) => { const s = m * lam / d; return L * s / Math.sqrt(1 - s * s) * 1e3; };   // mm, where r₂ − r₁ = mλ
  const dragMk = async (fromMm, toMm) => { await p.evaluate(() => document.getElementById('sim-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(120);
    const g = await ygeo(), X = g.x + g.scr + 20, Y = mm => g.y + g.cy - mm * g.k;
    await p.mouse.move(X, Y(fromMm)); await p.mouse.down(); await p.mouse.move(X, (Y(fromMm) + Y(toMm)) / 2); await p.mouse.move(X, Y(toMm)); await p.mouse.up(); await p.waitForTimeout(160); };
  for (const [lam, d, L] of [[500, 0.3, 1.5], [650, 0.5, 2], [400, 0.1, 1]]) {
    await setv('ys-lambda', lam); await setv('ys-d', d); await setv('ys-L', L); await p.waitForTimeout(140);
    const g = /= (\d+\.\d\d) mm;/.exec(await modelTx()), want = lam * 1e-9 * L / (d * 1e-3) * 1e3;
    t(`Young λ=${lam} d=${d} L=${L}: Δy = λL/d`, g && Math.abs(+g[1] - want) < 0.006, (g || [])[1] + ' vs ' + want.toFixed(3));
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('ys-lambda', 500); await setv('ys-L', 1.5); await setv('ys-a', 0.04); await setv('ys-d', 0.15); await p.waitForTimeout(160);
  await setv('ys-d', 0.3); await p.waitForTimeout(160);
  const yB0 = 5 * 500e-9 * 1.5 / 0.3e-3 * 1e3 * 0.97, yB5 = yOf(5, 500e-9, 0.3e-3, 1.5);
  await dragMk(yB0, yB5);
  const rb = await lastT('^B: Δ = ');
  t('Young: marker B on m = 5 reads Δ = 5.00λ (exact geometry)', rb && /Δ = 5\.0\dλ|Δ = 4\.9\dλ/.test(rb), String(rb));
  await setv('ys-a', 0.1); await p.waitForTimeout(140);
  await dragMk(0, yOf(3, 500e-9, 0.3e-3, 1.5));
  t('Young: every mission is reachable', await missions() === '111', await missions());

  // ── single slit: y₁ = L tan(asin(λ/a)) in the live line; the detector finds
  // the minima a sinθ = mλ; every mission ──
  await open('opt-waves', 'diffraction');
  for (const [a, lam] of [[0.1, 500], [0.05, 650], [0.3, 400]]) {
    await setv('diff-a', a); await setv('diff-lambda', lam); await p.waitForTimeout(140);
    const g = /y₁ = L tan θ₁ = (\d+\.\d) mm/.exec(await modelTx()), want = Math.tan(Math.asin(lam * 1e-9 / (a * 1e-3))) * 1e3;
    t(`single slit a=${a} λ=${lam}: y₁`, g && Math.abs(+g[1] - want) < 0.051, (g || [])[1] + ' vs ' + want.toFixed(2));
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('diff-lambda', 500); await setv('diff-a', 0.05); await p.waitForTimeout(160); await setv('diff-a', 0.2); await p.waitForTimeout(120);   // the 2nd minimum on the screen
  const probeTo = async (m) => { await p.evaluate(() => document.getElementById('sim-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(120);
    const g = await p.evaluate(() => { const cv = document.getElementById('sim-canvas'), b = cv.getBoundingClientRect(); return { x: b.left, y: b.top, W: cv.offsetWidth, H: cv.offsetHeight }; });
    const Leff = 1000 * g.H * 0.28 / 5, ym = Math.tan(Math.asin(m * 500e-9 / 0.2e-3)) * Leff, X = g.x + g.W - 52;
    await p.mouse.move(X, g.y + g.H / 2 + 0.15 * g.H); await p.mouse.down(); await p.mouse.move(X, g.y + g.H / 2 + ym); await p.mouse.up(); await p.waitForTimeout(160); };
  await probeTo(1); await probeTo(2);
  t('single slit: every mission is reachable', await missions() === '111', await missions());

  // ── grating: θ₁ = asin(λ/d), the highest order ⌊d/λ⌋, and every mission
  // (white light, no second order of 700 nm, N = 30, the hydrogen line by the
  // detector on the arc) ──
  await open('opt-waves', 'grating');
  for (const [d, lam] of [[1.5, 550], [1.25, 656], [1.25, 486], [3.0, 400], [0.9, 700]]) {
    await setv('gr-d', d); await setv('gr-lambda', lam); await p.waitForTimeout(140);
    const tx = await modelTx(), g = /θ₁ = (\d+\.\d)°/.exec(tx), mm = /= (\d+)\.$/.exec(tx), want = Math.asin(lam / (d * 1000)) / D;
    t(`grating d=${d} λ=${lam}: θ₁`, g && Math.abs(+g[1] - want) < 0.051, tx);
    t(`grating d=${d} λ=${lam}: highest order`, mm && +mm[1] === Math.floor(d * 1000 / lam), tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await p.evaluate(() => document.getElementById('btn-gr-white').click()); await p.waitForTimeout(250);
  await p.evaluate(() => document.getElementById('btn-gr-white').click()); await p.waitForTimeout(150);
  await setv('gr-lambda', 700); await setv('gr-d', 1.39); await p.waitForTimeout(150); await setv('gr-N', 30); await p.waitForTimeout(150);
  await setv('gr-d', 1.25); await setv('gr-lambda', 656); await p.waitForTimeout(150);
  await p.evaluate(() => document.getElementById('sim-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const gg = await p.evaluate(() => { const cv = document.getElementById('sim-canvas'), b = cv.getBoundingClientRect(), W = cv.offsetWidth, H = cv.offsetHeight, nw = W < 520;
    let gX = Math.round(W * (nw ? 0.10 : 0.16)); const RA = Math.min(W - gX - (nw ? 34 : 70), H * 0.43); if (!nw) gX = Math.round(Math.max(gX, W / 2 - RA * 0.45));
    return { x: b.left + gX, y: b.top + Math.round(H * 0.47), RA }; });
  const arcPt = deg => ({ x: gg.x + gg.RA * cosd(deg), y: gg.y + gg.RA * sind(deg) });
  { const a = arcPt(20), m1 = arcPt(26), bb = arcPt(asind(656 / 1250)); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(m1.x, m1.y); await p.mouse.move(bb.x, bb.y); await p.mouse.up(); await p.waitForTimeout(200); }
  t('grating: every mission is reachable', await missions() === '1111', await missions());

  // ── the eye: vergence model, glasses touching the eye. Sharp exactly when
  // 1/d − P lies in [D_far, D_far + A]; the glasses' image dᵢ = 1/(P − 1/d)
  // is in the equation line; the section's problem (+3.33 D) is a mission ──
  const click = id => p.evaluate(id => document.getElementById('btn-' + id).click(), id);
  await reach('opt-lenses', 'lens-eye', [async () => click('eye-myopia'), ['eye-P', 0], ['eye-dist', Math.log10(0.48)], ['eye-dist', 1.1], ['eye-P', -2],
    async () => click('eye-hyper'), ['eye-dist', Math.log10(0.25)], ['eye-P', 3.35], async () => click('eye-normal'), ['eye-P', 0], ['eye-dist', Math.log10(0.26)]], '1111');
  const EYE = { normal: [0, 4], myopia: [2, 4], hyper: [-10 / 3, 4], presby: [0, 1] };
  for (let [mode, P, d] of [['myopia', 0, 0.6], ['myopia', 0, 0.3], ['myopia', -2, Infinity], ['myopia', -1.5, Infinity], ['hyper', 0, 0.5], ['hyper', 0, 2], ['hyper', 3.35, 0.251],
    ['normal', 0, 0.2], ['presby', 0, 0.5], ['presby', 3, 0.3], ['presby', 3, 3]]) {
    await click('eye-' + mode); await setv('eye-P', P); await setv('eye-dist', isFinite(d) ? Math.log10(d) : 1.1); await p.waitForTimeout(140);
    const v = +(await p.evaluate(() => document.getElementById('inp-eye-dist').value)); d = v > 1.0001 ? Infinity : 10 ** v;   // as the slider holds it
    const tx = await modelTx(), [far, A] = EYE[mode], Dp = (isFinite(d) ? 1 / d : 0) - P, sharp = Dp >= far - 0.03 && Dp <= far + A + 0.03;
    t(`eye ${mode} P=${P} d=${d}: ${sharp ? 'sharp' : 'blurred'}`, sharp ? /— (ולכן הוא )?חד|sharp\.?$|— sharp/.test(tx) && !/מטושטש|blurred/.test(tx) : /מטושטש|blurred/.test(tx), tx);
    if (P !== 0) { const g = /dᵢ = ([+−-]?\d+\.\d\d) m/.exec(tx); t(`eye ${mode} P=${P} d=${d}: the glasses' image dᵢ`, g && Math.abs(num(g[1]) - 1 / (P - (isFinite(d) ? 1 / d : 0))) < 0.011, tx); }
  }

  console.log('   every draggable simulation by touch, on a phone');
  const tc = await b.newContext({ viewport: { width: 390, height: 1300 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const q = await tc.newPage(); q.on('pageerror', x => errs.push(x.message));
  await q.addInitScript(() => { window.__T = []; const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) { if (typeof s === 'string' && this.canvas.id === 'sim-canvas') window.__T.push(s.replace(/[\u2066-\u2069\u200e]/g, ''));
      if (window.__T.length > 4000) window.__T.splice(0, 2000); return o.apply(this, arguments); }; });
  await q.goto(F); await q.waitForTimeout(700);
  const cdp = await tc.newCDPSession(q);
  const topen = async (s, c, se, pre) => { await q.evaluate(([s, c, se]) => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {};
    state.subject = s; state.chapter = c; state.section = se; state.tab = 'sim'; render(); }, [s, c, se]);
    await q.waitForTimeout(900); await (await q.$('#sim-canvas')).scrollIntoViewIfNeeded();
    if (pre) await q.evaluate(([k, v]) => { const e = document.getElementById('inp-' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, pre);
    await q.waitForTimeout(300);
    return q.evaluate(() => { const r = document.getElementById('sim-canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); };
  // a slider the drag drives, or the newest canvas line matching a pattern;
  // {gone} is a hint that must stop being drawn once the learner has dragged
  const probe = async c => q.evaluate(c => {
    if (c.slider) { const e = document.getElementById('inp-' + c.slider); return e ? e.value : 'no slider'; }
    const R = new RegExp(c.text || c.gone), a = window.__T.filter(s => R.test(s)); return a.length ? a[a.length - 1] : null; }, c);
  const swipe = async (r, pts) => { const P = z => ({ x: r.x + z[0], y: r.y + z[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
    for (let i = 1; i < pts.length; i++) { await q.waitForTimeout(50); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] }); }
    await q.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(200); };
  // where each handle starts, from the simulation's own layout (W, H = canvas size)
  // the imaging bench: one scale, px per mm, set by the width; the object's
  // stem (between its tip and the axis) drags its distance
  const benchObj = (W, mirror, dO) => { const narrow = W < 520, X0 = mirror ? Math.round(W * 0.62) : Math.round(W * (narrow ? 0.44 : 0.45)),
    k = (X0 - 24) / (narrow ? 300 : 400), ox = X0 - dO * k, y = Math.round((mirror ? 470 * 0.43 : 490 * 0.42)) - 10; return [[ox, y], [ox - 15, y], [ox - 30, y]]; };
  const mirrorObj = (W) => benchObj(W, true, 213);
  const lensObj = (W) => benchObj(W, false, 209);
  const TOUCH = [
    ['optics', 'opt-light', 'light-nature', W => [[W / 2, 200], [W / 2 + 40, 200], [W / 2 + 80, 200]], { slider: 'emw-wl' }],
    ['optics', 'opt-light', 'light-speed', () => [[44, 120], [44, 121]], { slider: 'ri-n' }],
    ['optics', 'opt-light', 'em-spectrum', W => [[W * 0.3, 50], [W * 0.5, 50], [W * 0.7, 50]], { slider: 'ems-pos' }],
    ['optics', 'opt-light', 'color-mixing', (W, H) => { const cr = Math.min(W * 0.2, H * 0.27), y = H * 0.42 - cr * 0.62; return [[W / 2, y], [W / 2, y - 20], [W / 2, y - 40]]; }, { gone: '^' + LR('✋ גררו את העיגולים — צרו חפיפות חדשות!') }],
    ['optics', 'opt-reflection', 'refl-laws', W => [[W * 0.3, 120], [W * 0.2, 200], [W * 0.15, 260]], { slider: 'ref-angle' }],
    ['optics', 'opt-reflection', 'plane-mirror', W => [[W * 0.3, 210], [W * 0.25, 210], [W * 0.2, 210]], { slider: 'pm-dist' }],
    ['optics', 'opt-reflection', 'concave-mirror', W => mirrorObj(W, true), { slider: 'cm-do' }],
    ['optics', 'opt-reflection', 'convex-mirror', W => mirrorObj(W, false), { slider: 'cvm-do' }],
    ['optics', 'opt-refraction', 'snell-law', (W, H) => [[W / 2 - 60, H * 0.44 - 80], [W / 2 - 90, H * 0.44 - 50], [W / 2 - 110, H * 0.44 - 30]], { slider: 'snell-th' }],
    ['optics', 'opt-refraction', 'tir', (W, H) => [[W / 2 - 60, H * 0.46 - 80], [W / 2 - 90, H * 0.46 - 50], [W / 2 - 110, H * 0.46 - 30]], { slider: 'tir-th' }],
    ['optics', 'opt-refraction', 'prism', () => [[20, 300], [20, 340], [30, 380]], { slider: 'prism-ang' }],
    ['optics', 'opt-refraction', 'fiber-optics', (W, H) => [[W * 0.05, H * 0.4 + 30], [W * 0.05, H * 0.4 + 60], [W * 0.05, H * 0.4 + 90]], { slider: 'fib-ang' }],
    ['optics', 'opt-lenses', 'convex-lens', W => lensObj(W, 200), { slider: 'cl-do' }],
    ['optics', 'opt-lenses', 'concave-lens', W => lensObj(W, 180), { slider: 'dcl-do' }],
    // the eye: a log axis from ∞ (left) through 10 m … 0.1 m to the glasses in front of the eye
    ['optics', 'opt-lenses', 'lens-eye', (W, H) => { const nw = W < 520, es = Math.min(1, (W * (nw ? 0.24 : 0.30) - 8) / 118), cx = W - Math.max(14, W * 0.04) - 118 * es, ef = cx - 118 * es,
      xR = ef - 24 * es - Math.max(34, 40 * es), xInf = Math.max(18, W * 0.035), xL = xInf + Math.max(26, W * 0.05), ox = xR - (0.301 + 1) / 2 * (xR - xL), y = Math.round(H * (nw ? 0.46 : 0.42)) - 10;
      return [[ox, y], [ox + 15, y], [ox + 30, y]]; }, { slider: 'eye-dist' }],
    ['optics', 'opt-lenses', 'telescope', (W, H) => { const m = W * 0.05, sc = (W - m * 2 - 70) / (150 * 1.3 + 25), L1 = m + 150 * sc * 0.3; return [[L1, H / 2], [L1 + 10, H / 2], [L1 + 20, H / 2]]; }, { slider: 'tel-fo' }],
    ['optics', 'opt-waves', 'interference', W => [[W * 0.7, 120], [W * 0.75, 160]], { text: '^Δ = \\|r₂' }],
    ['optics', 'opt-waves', 'youngs-slits', W => { const nw = W < 520, a = (nw ? 50 : 84) + (nw ? 70 : 140), x = a + 0.4 * (W - (nw ? 54 : 80) - a); return [[x, 300], [x + 20, 300], [x + 40, 300]]; }, { slider: 'ys-L' }],
    ['optics', 'opt-waves', 'diffraction', W => [[W - 52, 220], [W - 52, 260], [W - 52, 300]], { text: '^' + LR('גלאי: a·sinθ = ') }],
    ['optics', 'opt-waves', 'thin-film', W => { const x = Math.max(10, W * 0.04) + Math.min(110, W * 0.24) / 2; return [[x, 150], [x, 200], [x, 260]]; }, { slider: 'tf-thick' }],
    ['optics', 'opt-waves', 'grating', (W, H) => { const gX = Math.round(W * 0.10), RA = Math.min(W - gX - 34, H * 0.43), cy = Math.round(H * 0.47), p0 = [gX + RA * Math.cos(20 * Math.PI / 180), cy + RA * Math.sin(20 * Math.PI / 180)];
      return [p0, [p0[0] - 4, p0[1] + 20], [p0[0] - 10, p0[1] + 40]]; }, { text: '^' + LR('גלאי: θ = ') }],
    ['optics', 'opt-modern', 'polarization', (W, H) => { const y = Math.round(H * 0.31), x = W * 0.69; return [[x + 20, y], [x + 10, y + 20], [x, y + 25]]; }, { slider: 'pol-angle' }],
    // the star rests at the centre when v = 0; a quick flick sets its speed
    ['optics', 'opt-modern', 'doppler', (W, H) => [[W / 2, H / 2], [W / 2 + 40, H / 2], [W / 2 + 80, H / 2]], { slider: 'dop-v' }, ['dop-v', 0]],
    ['optics', 'opt-modern', 'lasers', W => [[W * 0.4, 200], [W * 0.5, 200], [W * 0.6, 200]], { slider: 'laser-pump' }],
  ];
  const deaf = [], scrolled = [];
  for (const [s, c, se, pf, chk, pre] of TOUCH) {
    const r = await topen(s, c, se, pre), before = await probe(chk), y0 = await q.evaluate(() => scrollY);
    await swipe(r, pf(r.w, r.h));
    if (chk.gone) { await q.evaluate(() => { window.__T = []; }); await q.waitForTimeout(300); }
    const after = await probe(chk);
    if (await q.evaluate(() => scrollY) !== y0) scrolled.push(se);
    if (chk.gone ? !(before && after === null) : (before === null || after === before)) deaf.push(se + ': ' + before + ' → ' + after);
  }
  t(TOUCH.length + ' simulations follow a finger (touch start, move, end)', deaf.length === 0, deaf.join(' | '));
  t('dragging on a simulation does not scroll the page', scrolled.length === 0, scrolled.join(', '));
  await tc.close();

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`check_optics: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ OPTICS ANSWERS AND SIMULATIONS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
