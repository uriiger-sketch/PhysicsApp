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
const { L, LR, WORD } = require('./_lang.js');   // the words of the page's language
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
      // f(400 nm) = 92.7 mm: an object at 93 mm is just outside the focus, not at it (1/92.7 − 1/93 is not 0)
      await setv(pre + '-do', 93); await p.waitForTimeout(140);
      { const tx = await modelFor('− 1/93 '); t(se + ': dₒ = 93 mm beside f(400 nm) = 92.7 mm gives a finite dᵢ', !/= 0 —/.test(tx) && /dᵢ = [+−]\d+ mm/.test(tx), tx); }
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
      if (F.tir) { t(`${se} n₁=${n1} n₂=${n2} θ=${th}: total internal reflection`, /> 1/.test(tx) && !/θ₂ = \d/.test(tx), tx);
        const gs = /= (\d\.\d+) > 1/.exec(tx); t(`${se} n₁=${n1} n₂=${n2} θ=${th}: the printed sin θ₂ itself exceeds 1`, gs && +gs[1] > 1, tx); }
      else {
        const g = /θ₂ = (\d+\.\d)°/.exec(tx), r = /(\d+\.?\d*)%[^%]*?(\d+\.?\d*)%/.exec(tx);
        t(`${se} n₁=${n1} n₂=${n2} θ=${th}: θ₂ by Snell`, g && Math.abs(+g[1] - F.t2) < 0.06, tx);
        t(`${se} n₁=${n1} n₂=${n2} θ=${th}: Fresnel R and T`, r && Math.abs(+r[1] / 100 - F.R) < (F.R >= 0.1 ? 0.0051 : 0.0006) && Math.abs(+r[1] + +r[2] - 100) < 1.01, tx);
      }
    }
  }
  await reach('opt-refraction', 'snell-law', [['snell-n1', 1], ['snell-n2', 1.5], ['snell-th', 0], ['snell-th', 56], ['snell-n1', 1.5], ['snell-n2', 1], ['snell-th', 30]], '111');
  // θc is found where the refracted ray vanishes -- not 0.4° before it, where it still carries half of the light
  await open('opt-refraction', 'tir');
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('tir-n1', 1.5); await setv('tir-n2', 1); await setv('tir-th', 41.4); await p.waitForTimeout(160);
  t('TIR: 0.4° below θc the critical angle is not yet found', (await missions())[0] === '0', await missions());
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
  // cos²89° is small but not zero: the light has not vanished, and the line says how much is left
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('pol-i0', 80); await setv('pol-angle', 89); await p.waitForTimeout(160);
  { const tx = await modelTx(); t('Malus at 89°: not yet dark (0.01 %), the crossing mission not solved', (await missions())[0] === '0' && /= 0\.01%;/.test(tx), (await missions()) + ' | ' + tx); }

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
  // a 22 nm soap film still reflects a tenth of the brightest film -- dark grey, not black
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => { document.querySelector('#app .sim-container').dispatchEvent(new Event('click')); document.getElementById('btn-tf-soap').click(); });
  await setv('tf-thick', 22); await p.waitForTimeout(160);
  t('thin film: a 22 nm soap film does not count as black', (await missions())[0] === '0', await missions());
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

  // ── the speed of light in matter: v = c/n, λ = λ₀/n, f the same; missions ──
  await open('opt-light', 'light-speed');
  for (const [nn, l0] of [[1.5, 500], [1.33, 600], [2.42, 400]]) {
    await setv('ri-n', nn); await setv('ri-wl', l0);
    const tx = await modelTx(), v = /v = c\/n = [^=]+= (\d\.\d\d)×10⁸/.exec(tx), l = /= (\d+) nm/.exec(tx), f = /f = c\/λ₀ = (\d\.\d\d)×10¹⁴/.exec(tx);
    t(`light in n=${nn}: v = c/n`, v && Math.abs(+v[1] - 3 / nn) < 0.006, tx);
    t(`light in n=${nn}: λ = λ₀/n`, l && Math.abs(+l[1] - l0 / nn) < 0.51, tx);
    t(`light in n=${nn}: f = c/λ₀, unchanged`, f && Math.abs(+f[1] - 3e8 / (l0 * 1e-9) / 1e14) < 0.006, tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelectorAll('.sk-opt')[1].click()); await p.waitForTimeout(150);
  await setv('ri-n', 1.5); await setv('ri-wl', 600); await setv('ri-n', 2.42);
  t('light speed: every mission is reachable', await missions() === '1111', await missions());

  // ── plane mirror: dᵢ = −dₒ; a body point at h is seen at (h + h_eye)/2 on the
  // mirror, so the part seen is [2·bottom − h_eye, 2·top − h_eye], at any distance ──
  await open('opt-reflection', 'plane-mirror');
  for (const [d, top, bot] of [[2, 1.4, 0.6], [0.5, 1.4, 0.6], [3.5, 1.74, 0.84], [1, 2.0, 1.2], [2, 0.8, 0.5]]) {
    await setv('pm-bot', 0); await setv('pm-top', top); await setv('pm-bot', bot); await setv('pm-dist', d);
    const tx = await modelTx(), lo = Math.max(0, 2 * bot - 1.68), hi = Math.min(1.8, 2 * top - 1.68), g = /(\d\.\d\d) m[^\d]+(\d\.\d\d) m\.$/.exec(tx);
    t(`plane mirror d=${d}: dᵢ = −dₒ`, tx.includes('dᵢ = −dₒ = −' + d.toFixed(1) + ' m'), tx);
    if (hi > lo) t(`plane mirror top=${top} bottom=${bot}: seen ${lo.toFixed(2)}–${hi.toFixed(2)} m`, g && Math.abs(+g[1] - lo) < 0.006 && Math.abs(+g[2] - hi) < 0.006, tx);
    else t(`plane mirror top=${top} bottom=${bot}: nothing seen`, !g, tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelectorAll('.sk-opt')[1].click()); await p.waitForTimeout(150);
  await setv('pm-top', 1.74); await setv('pm-bot', 0.84); await setv('pm-top', 1.4); await setv('pm-dist', 0.5); await setv('pm-dist', 2.5);
  t('plane mirror: every mission is reachable', await missions() === '111', await missions());

  // ── prism (60°, flint n = 1.62 + 8800(1/λ² − 1/550²)): the deviation of red
  // and violet from two refractions, δ = θ₁ + θ₄ − A; violet trapped first ──
  await open('opt-refraction', 'prism');
  const nF = l => 1.62 + 8800 * (1 / l ** 2 - 1 / 550 ** 2);
  const dev = (th, n) => { const t2 = asind(sind(th) / n), t3 = 60 - t2; if (n * sind(t3) >= 1) return null; return th + asind(n * sind(t3)) - 60; };
  for (const th of [55, 45, 70]) {
    await setv('prism-ang', th);
    const tx = await modelTx(), g = /\) (\d+\.\d)°[^)]*\) (\d+\.\d)°/.exec(tx.replace(/,/g, ''));
    t(`prism θ=${th}°: deviation of red and violet`, g && Math.abs(+g[1] - dev(th, nF(700))) < 0.06 && Math.abs(+g[2] - dev(th, nF(400))) < 0.06, tx + ' | ' + dev(th, nF(700)).toFixed(2) + ' ' + dev(th, nF(400)).toFixed(2));
  }
  await setv('prism-ang', 38);
  t('prism θ=38°: violet trapped, red out', /arcsin/.test(await modelTx()) && dev(38, nF(400)) === null && dev(38, nF(700)) !== null, await modelTx());
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelectorAll('.sk-opt')[2].click()); await p.waitForTimeout(150);
  await setv('prism-ang', Math.round(asind(nF(700) * sind(30)))); await setv('prism-ang', 38);
  t('prism: every mission is reachable', await missions() === '111', await missions());

  // ── law of reflection: θᵣ = θᵢ and the angle from the surface 90° − θᵢ; the
  // target sits where only θᵢ = 52° sends the reflected ray ──
  await open('opt-reflection', 'refl-laws');
  for (const th of [40, 60, 0]) { await setv('ref-angle', th); const tx = await modelTx();
    t(`reflection θᵢ=${th}°`, tx.includes('θᵣ = θᵢ = ' + th + '°') && tx.includes('90° − ' + th + '° = ' + (90 - th) + '°'), tx); }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('ref-angle', 52); await setv('ref-angle', 60); await setv('ref-angle', 0);
  t('reflection: every mission is reachable', await missions() === '111', await missions());

  // ── the eye: vergence model, glasses touching the eye. Sharp exactly when
  // 1/d − P lies in [D_far, D_far + A]; the glasses' image dᵢ = 1/(P − 1/d)
  // is in the equation line; the section's problem (+3.33 D) is a mission ──
  const click = id => p.evaluate(id => document.getElementById('btn-' + id).click(), id);
  await reach('opt-lenses', 'lens-eye', [async () => click('eye-myopia'), ['eye-P', 0], ['eye-dist', Math.log10(0.48)], ['eye-dist', 1.1], ['eye-P', -2],
    async () => click('eye-hyper'), ['eye-dist', Math.log10(0.25)], ['eye-P', 3.35], async () => click('eye-normal'), ['eye-P', 0], ['eye-dist', Math.log10(0.26)]], '1111');
  const EYE = { normal: [0, 4], myopia: [2, 4], hyper: [-10 / 3, 4], presby: [0, 1] };
  for (let [mode, P, d] of [['myopia', 0, 0.6], ['myopia', 0, 0.3], ['myopia', -2, Infinity], ['myopia', -1.5, Infinity], ['hyper', 0, 0.5], ['hyper', 0, 2], ['hyper', 3.35, 0.251],
    ['normal', 0, 0.2], ['presby', 0, 0.5], ['presby', 3, 0.3], ['presby', 3, 3], ['hyper', 3.35, 1], ['hyper', 6, 0.5], ['normal', 3, Infinity]]) {
    await click('eye-' + mode); await setv('eye-P', P); await setv('eye-dist', isFinite(d) ? Math.log10(d) : 1.1); await p.waitForTimeout(140);
    const v = +(await p.evaluate(() => document.getElementById('inp-eye-dist').value)); d = v > 1.0001 ? Infinity : 10 ** v;   // as the slider holds it
    const tx = await modelTx(), [far, A] = EYE[mode], Dp = (isFinite(d) ? 1 / d : 0) - P, sharp = Dp >= far - 0.03 && Dp <= far + A + 0.03;
    t(`eye ${mode} P=${P} d=${d}: ${sharp ? 'sharp' : 'blurred'}`, sharp ? /— (ולכן הוא )?חד|sharp\.?$|— sharp/.test(tx) && !/מטושטש|blurred/.test(tx) : /מטושטש|blurred/.test(tx), tx);
    if (P !== 0) { const g = /dᵢ = ([+−-]?\d+\.\d\d) m/.exec(tx); t(`eye ${mode} P=${P} d=${d}: the glasses' image dᵢ`, g && Math.abs(num(g[1]) - 1 / (P - (isFinite(d) ? 1 / d : 0))) < 0.011, tx);
      // dᵢ > 0: the light enters the eye converging, toward a point behind it -- not an image "in range"
      if (P - (isFinite(d) ? 1 / d : 0) > 1e-6) t(`eye ${mode} P=${P} d=${d}: converging light, said so`, /מתכנס|converging/.test(tx) && !/בטווח|in range/.test(tx), tx); }
  }

  // ── optical fibre: θc = arcsin(n₂/n₁), NA = √(n₁² − n₂²), θmax = arcsin NA;
  // the ray is trapped exactly when sin θ ≤ NA (n₁ > n₂), whatever the sim draws ──
  await open('opt-refraction', 'fiber-optics');
  for (const [n1, n2, th] of [[1.5, 1.46, 12], [1.5, 1.46, 21], [1.62, 1.52, 34], [1.62, 1.52, 35], [1.8, 1.2, 40], [1.4, 1.5, 10]]) {
    await setv('fib-n1', n1); await setv('fib-n2', n2); await setv('fib-ang', th); await p.waitForTimeout(100);
    const tx = await modelTx();
    if (n1 <= n2) { t(`fibre n₁=${n1} n₂=${n2}: no critical angle, leaks`, /n₁ ≤ n₂/.test(tx) && !/≥ θc/.test(tx), tx); continue; }
    const NA = Math.sqrt(n1 * n1 - n2 * n2), tm = NA >= 1 ? 90 : asind(NA), trapped = sind(th) <= NA;
    const gc = /θc = (\d+\.\d)°/.exec(tx), gn = /= (\d\.\d{3}) ⇒ θmax = (\d+\.\d)°/.exec(tx);
    t(`fibre n₁=${n1} n₂=${n2}: θc = arcsin(n₂/n₁)`, gc && Math.abs(+gc[1] - asind(n2 / n1)) < 0.051, tx);
    t(`fibre n₁=${n1} n₂=${n2}: NA and θmax`, gn && Math.abs(+gn[1] - NA) < 0.0006 && Math.abs(+gn[2] - tm) < 0.051, tx);
    t(`fibre n₁=${n1} n₂=${n2} θ=${th}°: ${trapped ? 'trapped' : 'leaks'}`, trapped ? /≥ θc/.test(tx) : /< θc/.test(tx), tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('fib-n1', 1.5); await setv('fib-n2', 1.46); await setv('fib-ang', 20); await setv('fib-n2', 1.6);
  await setv('fib-n1', 1.62); await setv('fib-n2', 1.52); await setv('fib-ang', 34);
  t('fibre: every mission is reachable', await missions() === '111', await missions());

  // ── telescope (Kepler): M = −fₒ/fₑ, length fₒ + fₑ; missions ──
  await open('opt-lenses', 'telescope');
  for (const [fo, fe] of [[150, 25], [300, 5], [30, 60]]) {
    await setv('tel-fo', fo); await setv('tel-fe', fe); const tx = await modelFor('= −' + fo + '/' + fe + ' ');
    t(`telescope fₒ=${fo} fₑ=${fe}: M = −fₒ/fₑ and length`, tx.includes('M = −fₒ/fₑ = −' + fo + '/' + fe + ' = −' + (fo / fe).toFixed(2)) && tx.includes('fₒ + fₑ = ' + (fo + fe) + ' mm'), tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('tel-fo', 150); await setv('tel-fe', 15); await setv('tel-fo', 200); await setv('tel-fe', 10); await setv('tel-fo', 30); await setv('tel-fe', 60);
  t('telescope: every mission is reachable', await missions() === '111', await missions());

  // ── two-source interference: a tap anywhere reads the exact path difference
  // |r₂ − r₁|/λ (sources 60 px per µm apart); |m| ≤ d/λ; the missions are
  // reached by tapping where the geometry puts Δ = 1.5λ and Δ = 2λ ──
  await open('opt-waves', 'interference');
  await p.evaluate(() => document.getElementById('sim-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const igeo = () => p.evaluate(() => { const cv = document.getElementById('sim-canvas'), b = cv.getBoundingClientRect();
    return { x: b.left, y: b.top, W: cv.offsetWidth, H: cv.offsetHeight, lam: +document.getElementById('inp-int-lambda').value, d: +document.getElementById('inp-int-d').value }; });
  const iD = (g, x, y) => { const sx = g.W * 0.22, s1 = g.H / 2 - g.d * 30, s2 = g.H / 2 + g.d * 30; return Math.abs(Math.hypot(x - sx, y - s2) - Math.hypot(x - sx, y - s1)) / (g.lam * 0.06); };
  // a point 70 px past the barrier where Δ = want (Δ grows from 0 on the axis towards the top)
  const iAt = (g, want) => { const x = g.W * 0.22 + 70; let lo = 14, hi = g.H / 2; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (iD(g, x, m) > want) lo = m; else hi = m; } return { x, y: (lo + hi) / 2 }; };
  // a mouse event carries whole client pixels: tap there and return the canvas point the sim receives
  const iTap = async pt => { const g = await igeo(), cx = Math.round(g.x + pt.x), cy = Math.round(g.y + pt.y); await p.mouse.click(cx, cy); await p.waitForTimeout(160); return { x: cx - g.x, y: cy - g.y }; };
  for (const [lam, d, want] of [[500, 2, 1.5], [500, 2, 2], [650, 3.4, 3], [400, 1.2, 0.5]]) {
    await setv('int-lambda', lam); await setv('int-d', d); const g = await igeo(), pt = iAt(g, want);
    // the line once it shows the tapped point (a frame can be late on a busy machine)
    const q0 = await iTap(pt), want0 = iD(g, q0.x, q0.y).toFixed(2) + 'λ', tx = await modelFor('= ' + want0), gD = /Δ = \|r₂ − r₁\| = (\d+\.\d\d)λ/.exec(tx), r = d * 1000 / lam;
    t(`interference λ=${lam} d=${d}: Δ at the tapped point`, gD && Math.abs(+gD[1] - iD(g, q0.x, q0.y)) < 0.0051 && Math.abs(+gD[1] - want) < 0.05, tx + ' | ' + iD(g, q0.x, q0.y).toFixed(3));
    t(`interference λ=${lam} d=${d}: ${Number.isInteger(want) ? 'constructive, m = ' + want : 'destructive'}`, Number.isInteger(want) ? tx.includes('(m = ' + want + ')') : !/\(m = /.test(tx), tx);
    t(`interference λ=${lam} d=${d}: d/λ and |m| ≤ ⌊d/λ⌋`, tx.includes('= ' + r.toFixed(2) + 'λ') && tx.includes('|m| ≤ ' + Math.floor(r + 1e-9)), tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.getElementById('sim-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  await setv('int-lambda', 500); await setv('int-d', 2);
  { const g = await igeo(); await iTap(iAt(g, 1.5)); await iTap(iAt(g, 2)); }
  await setv('int-lambda', 700); await setv('int-d', 1);
  t('interference: every mission is reachable', await missions() === '111', await missions());

  // ── the EM wave: f = c/λ and T = 1/f in the live line; λ drawn to one scale
  // for every colour (the λ label sits at the middle of the bracket, X0 + 8 + λ/2) ──
  await open('opt-light', 'light-nature');
  await p.evaluate(() => { if (window.__PX) return; window.__PX = []; const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, x) { if (typeof s === 'string' && this.canvas.id === 'sim-canvas' && /^λ=\d/.test(s.replace(/[⁦-⁩‎]/g, ''))) { window.__PX.push([s.replace(/[⁦-⁩‎]/g, ''), x]); if (window.__PX.length > 400) window.__PX.splice(0, 200); } return o.apply(this, arguments); }; });
  const lamPx = async lam => { await p.waitForTimeout(120); return p.evaluate(lam => { const a = window.__PX.filter(q => q[0] === 'λ=' + lam + 'nm'); return a.length ? 2 * (a[a.length - 1][1] - 38) : null; }, lam); };
  const wpx = {};
  for (const lam of [380, 550, 700]) {
    await setv('emw-wl', lam); const tx = await modelFor('/ ' + lam + '×10⁻⁹'), g = /= (\d\.\d\d)×10¹⁴ Hz/.exec(tx), T = /T = 1\/f = (\d\.\d\d) fs/.exec(tx);
    t(`EM wave λ=${lam}: f = c/λ`, g && Math.abs(+g[1] - c / (lam * 1e-9) / 1e14) < 0.006, tx);
    t(`EM wave λ=${lam}: T = 1/f`, T && Math.abs(+T[1] - lam * 1e-9 / c * 1e15) < 0.006, tx);
    wpx[lam] = await lamPx(lam);
  }
  t('EM wave: the drawn wavelength is proportional to λ', wpx[380] && wpx[700] && Math.abs(wpx[700] / wpx[380] - 700 / 380) < 0.03 && Math.abs(wpx[550] / wpx[380] - 550 / 380) < 0.03, JSON.stringify(wpx));
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('emw-wl', 550); await setv('emw-wl', 400); await setv('emw-wl', 700); await setv('emw-wl', 400);
  t('EM wave: every mission is reachable', await missions() === '111', await missions());

  // ── the EM spectrum (log scale, f from 10³ to 10²² Hz): λ = c/f, E = hf, the
  // band from λ (the lesson's table), and at 1 mW N = P/E photons a second ──
  const unitM = { km: 1e3, m: 1, cm: 1e-2, mm: 1e-3, 'μm': 1e-6, nm: 1e-9, pm: 1e-12 }, unitE = { MeV: 1e6, keV: 1e3, eV: 1, meV: 1e-3, 'μeV': 1e-6, neV: 1e-9 };
  const sup = s => +s.replace(/⁻/g, '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch));
  const band = l => l > 1 ? 'גלי רדיו' : l > 1e-3 ? 'מיקרוגל' : l > 700e-9 ? 'IR' : l >= 380e-9 ? 'נראה' : l > 10e-9 ? 'UV' : l > 1e-11 ? 'רנטגן' : 'גמא';
  const Lh = s => /[\u0590-\u05FF]/.test(s) ? L(s) : s;
  const act = eV => eV >= 10 ? 'מייננת — תולשת אלקטרונים מאטומים' : eV >= 3 ? 'שוברת קשרים כימיים, אך אינה מייננת' : 'אינה שוברת קשרים — רק מחממת או מעוררת';
  for (const [ch, se] of [['opt-light', 'em-spectrum'], ['opt-modern', 'em-spectrum-full']]) {
    await open(ch, se);
    for (const pos of [0, 10, 26.3, 33.6, 50, 61.4, 63.5, 65.2, 80, 98]) {
      await setv('ems-pos', pos); await p.waitForTimeout(60);
      const tx = await modelTx(), f = 10 ** (3 + pos / 100 * 19), lam = c / f, eV = h * f / e;
      // each read to half a unit of its own last digit
      const gf = /λ = c\/f = 3\.00×10⁸ \/ (\d\.\d\d)×10([⁰¹²³⁴⁵⁶⁷⁸⁹]+) Hz = (\d+\.(\d+))(?:×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))? (\S+?)[.\s]/.exec(tx), gE = /E = hf = (\d+\.(\d+))(?:×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))? (\S*eV)/.exec(tx);
      const half = d => 0.51 * 10 ** -d.length, lu = gf ? (gf[5] ? 10 ** sup(gf[5]) : 1) * unitM[gf[6]] : 1;
      t(`${se} at ${pos}%: f, and λ = c/f`, gf && Math.abs(+gf[1] - f / 10 ** sup(gf[2])) <= 0.0051 && Math.abs(+gf[3] - lam / lu) <= half(gf[4]) && lam / lu >= 0.99, tx);
      const eu = gE ? (gE[3] ? 10 ** sup(gE[3]) : 1) * unitE[gE[4]] : 1;
      t(`${se} at ${pos}%: E = hf`, gE && Math.abs(+gE[1] - eV / eu) <= half(gE[2]) && eV / eu >= 0.99, tx);
      t(`${se} at ${pos}%: the band`, tx.includes(Lh(band(lam)) + '.'), tx + ' | ' + band(lam));
      if (se === 'em-spectrum-full') {
        const gN = /N = P\/E = (\d\.\d\d)×10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/.exec(tx);
        t(`${se} at ${pos}%: N = P/E at 1 mW`, gN && Math.abs(+gN[1] * 10 ** sup(gN[2]) / (1e-3 / (h * f)) - 1) < 0.003, tx);
        t(`${se} at ${pos}%: what the photon can do`, tx.includes(L(act(eV))), tx);
      }
    }
    await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
    await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
    // a sweep across the whole bar passes every target without stopping: no mission
    for (let x = 0; x <= 100; x += 0.3) await p.evaluate(x => { const el = document.getElementById('inp-ems-pos'); el.value = x.toFixed(1); el.dispatchEvent(new Event('input', { bubbles: true })); return new Promise(r => requestAnimationFrame(r)); }, x);
    await setv('ems-pos', 100); await p.waitForTimeout(600);
    t(`${se}: a sweep across the bar solves nothing`, await missions() === '000', await missions());
    for (const x of se === 'em-spectrum' ? [33.6, 26.3, 62] : [65.2, 63.5, 61.4]) { await setv('ems-pos', x); await p.waitForTimeout(600); }
    t(`${se}: every mission is reachable`, await missions() === '111', await missions());
  }

  // ── Doppler (relativistic, the source's clock slowed by γ): approaching
  // λ₀√((1−β)/(1+β)), receding λ₀√((1+β)/(1−β)); moving right (+) approaches
  // the right-hand observer; after the prediction, the classical λ₀(1 ∓ β) ──
  await open('opt-modern', 'doppler');
  await capT();
  const rel = b => Math.sqrt((1 - b) / (1 + b));
  for (const v of [30, -30, 1, 80]) {
    await setv('dop-wl', 550); await setv('dop-v', v); await p.waitForTimeout(140);
    // the line: λ = λ₀√((1 ∓ β)/(1 ± β)), then β, the approaching λ, the receding λ
    const b = Math.abs(v) / 100, tx = await modelTx(), g = /λ₀√\(\(1 ∓ β\)\/\(1 ± β\)\)[^β]+β = (\d\.\d\d)[^\d]+(\d+) nm[^\d]+(\d+) nm/.exec(tx);
    t(`Doppler v=${v}%: approaching and receding λ`, g && +g[1] === b && Math.abs(+g[2] - 550 * rel(b)) <= 0.51 && Math.abs(+g[3] - 550 / rel(b)) <= 0.51, tx);
    const right = await lastT('^' + LR('ימין: λ = ')), want = v > 0 ? 550 * rel(b) : 550 / rel(b), gr = /= (\d+) nm/.exec(right || '');
    t(`Doppler v=${v}%: the right-hand observer ${v > 0 ? 'approached' : 'receded from'}`, gr && Math.abs(+gr[1] - want) <= 0.51, String(right));
  }
  await p.evaluate(() => { const o = document.querySelectorAll('.sk-opt'); if (o[2]) o[2].click(); }); await setv('dop-v', 30); await p.waitForTimeout(140);
  { const tx = await modelTx(), zr = 1 / rel(0.3) - 1, g = /(\d+) nm[^\d]+(\d+) nm[^\d]+(\d+\.\d)%/.exec(tx.slice(tx.indexOf('λ₀(1 ∓ β)')));
    t('Doppler: the classical λ₀(1 ∓ β) and the gap in the redshift', g && +g[1] === 385 && +g[2] === 715 && Math.abs(+g[3] - (zr - 0.3) / zr * 100) < 0.051, tx); }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('dop-wl', 550); await setv('dop-v', 30); await setv('dop-v', 1);
  t('Doppler: every mission is reachable', await missions() === '111', await missions());

  // ── lasers: E = hc/λ per photon; above threshold (45%) the output grows as P − P_th ──
  await open('opt-modern', 'lasers');
  const ltype = v => p.evaluate(v => { const s = document.getElementById('inp-laser-type'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, String(v));
  for (const wl of [633, 514, 1064]) for (const pump of [30, 60, 100]) {
    await ltype(wl); await setv('laser-pump', pump); await p.waitForTimeout(60);
    const tx = await modelTx(), g = /\/ (\d+) nm = (\d\.\d\d) eV/.exec(tx), on = pump > 45;
    t(`laser ${wl} nm: E = hc/λ`, g && +g[1] === wl && Math.abs(+g[2] - h * c / (wl * 1e-9) / e) < 0.006, tx);
    t(`laser ${wl} nm at ${pump}%: ${on ? 'output ∝ P − P_th' : 'below threshold, no beam'}`, on ? tx.includes(pump + '% − 45%') && tx.includes(Math.round((pump - 45) / 55 * 100) + '%') : !/Pₒᵤₜ/.test(tx), tx);
  }
  await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(1100);
  await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
  await setv('laser-pump', 50); await ltype(514); await ltype(1064);
  t('lasers: every mission is reachable', await missions() === '111', await missions());

  // ── no mission is solved by the state a simulation starts in: the first
  // touch must not hand out a mission the learner did nothing for (colour
  // mixing belongs to the kit team) ──
  const secs = await p.evaluate(() => OPTICS_CHAPTERS.flatMap(c => c.sections.filter(s => s.id !== 'color-mixing').map(s => [c.id, s.id])));
  const idle = [];
  for (const [c2, s2] of secs) {
    await open(c2, s2);
    await p.evaluate(() => { state.missions = {}; render(); }); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelector('#app .sim-container').dispatchEvent(new Event('click')));
    await p.waitForTimeout(700);
    const m = await missions(); if (/1/.test(m)) idle.push(s2 + ': ' + m);
  }
  t(secs.length + ' optics simulations: no mission is solved at the starting state', idle.length === 0, idle.join(' | '));

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
    // a tap on the first material chip (vacuum) sets n = 1
    ['optics', 'opt-light', 'light-speed', W => { const cw = Math.min(84, (W - 28 - 24) / 5), x = (W - (5 * cw + 24)) / 2 + cw / 2; return [[x, 30], [x, 31]]; }, { slider: 'ri-n' }],
    ['optics', 'opt-light', 'em-spectrum', W => [[W * 0.3, 50], [W * 0.5, 50], [W * 0.7, 50]], { slider: 'ems-pos' }],
    ['optics', 'opt-light', 'color-mixing', (W, H) => { const cr = Math.min(W * 0.2, H * 0.27), y = H * 0.42 - cr * 0.62; return [[W / 2, y], [W / 2, y - 20], [W / 2, y - 40]]; }, { gone: '^' + LR('✋ גררו את העיגולים — צרו חפיפות חדשות!') }],
    ['optics', 'opt-reflection', 'refl-laws', W => [[W * 0.3, 120], [W * 0.2, 200], [W * 0.15, 260]], { slider: 'ref-angle' }],
    // the person stands 2 m from the mirror (at 0.55 W); drag the person away
    ['optics', 'opt-reflection', 'plane-mirror', W => { const MX = Math.round(W * 0.55), x = MX - 2 * (MX - 34) / 4.2; return [[x, 250], [x - 15, 250], [x - 30, 250]]; }, { slider: 'pm-dist' }],
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
