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
  const lx = await p.evaluate(() => {
    const txt = h => { const d = document.createElement('template'); d.innerHTML = _ltSafe(String(h || '')); return d.content.textContent.replace(/\s+/g, ' ').trim(); };
    const r = { noMis: [], q: 0, longest: 0, loud: [], bareHint: [], glued: [] };
    for (const ch of OPTICS_CHAPTERS) for (const se of ch.sections) {
      const k = ch.id + '.' + se.id, C = CONTENT[k];
      if (!/mis-block/.test(C.theory.html + ((C.theory.enrich || {}).html || ''))) r.noMis.push(k);
      (C.quiz || []).forEach((q, i) => {
        r.q++;
        const L = q.opts.map(o => txt(o).length), key = L[q.correct], rest = Math.max(...L.filter((_, j) => j !== q.correct));
        if (key > rest) r.longest++;
        if (key > 1.3 * rest) r.loud.push(k + '#' + i);
      });
      const steps = (C.problem || {}).steps || [];
      steps.forEach((st, i) => { if (!/[א-ת]{3,}/.test(txt(st.hint))) r.bareHint.push(k + '#' + i); });
      const all = [C.theory.html, ...(C.quiz || []).flatMap(q => [q.q, ...q.opts, q.explain]), ...steps.flatMap(s => [s.q, s.nudge, s.hint, s.explain])].map(txt).join(' | ');
      const m = all.match(/(?<![A-Za-z_])\d(?:nm|mm|cm|μm|keV|meV|eV|kHz|MHz|GHz|THz|Hz|kV|V)(?![A-Za-z0-9\/])/g);
      if (m) r.glued.push(k + ': ' + m.join(','));
    }
    return r;
  });
  t('every section has a misconception box', lx.noMis.length === 0, lx.noMis.join(' '));
  t('quiz key strictly longest in at most 30 % of questions', lx.longest <= 0.3 * lx.q, lx.longest + '/' + lx.q);
  t('no quiz key more than 1.3x longer than every other option', lx.loud.length === 0, lx.loud.join(' '));
  t('every problem hint says something in Hebrew', lx.bareHint.length === 0, lx.bareHint.join(' '));
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
  const mirrorObj = (W, concave) => { const mx = Math.round(W * 0.62), k = Math.min(1, (mx - 26) / 340, concave ? 9 : (W - mx - 24) / 170), ox = mx - 2.5 * 85 * k; return [[ox, 200], [ox - 15, 200], [ox - 30, 200]]; };
  const lensObj = (W, y) => { const lx = W / 2, k = Math.min(1, (lx - 26) / 380), ox = lx - 2.2 * 95 * k; return [[ox, y], [ox - 15, y], [ox - 30, y]]; };
  const TOUCH = [
    ['optics', 'opt-light', 'light-nature', W => [[W / 2, 200], [W / 2 + 40, 200], [W / 2 + 80, 200]], { slider: 'emw-wl' }],
    ['optics', 'opt-light', 'light-speed', () => [[44, 120], [44, 121]], { slider: 'ri-n' }],
    ['optics', 'opt-light', 'em-spectrum', W => [[W * 0.3, 50], [W * 0.5, 50], [W * 0.7, 50]], { slider: 'ems-pos' }],
    ['optics', 'opt-light', 'color-mixing', (W, H) => { const cr = Math.min(W * 0.2, H * 0.27), y = H * 0.42 - cr * 0.62; return [[W / 2, y], [W / 2, y - 20], [W / 2, y - 40]]; }, { gone: '^✋ גררו את העיגולים' }],
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
    ['optics', 'opt-lenses', 'lens-eye', (W, H) => { const es = Math.min(1, (W * 0.28 - 8) / 118), ef = W * 0.72 - 118 * es, xR = ef - Math.max(60, 90 * es), xL = Math.min(60, W * 0.08), ox = xR - Math.log(8) / Math.log(24) * (xR - xL); return [[ox, H * 0.46 - 10], [ox + 15, H * 0.46 - 10], [ox + 30, H * 0.46 - 10]]; }, { slider: 'eye-dist' }],
    ['optics', 'opt-lenses', 'telescope', (W, H) => { const m = W * 0.05, sc = (W - m * 2 - 70) / (150 * 1.3 + 25), L1 = m + 150 * sc * 0.3; return [[L1, H / 2], [L1 + 10, H / 2], [L1 + 20, H / 2]]; }, { slider: 'tel-fo' }],
    ['optics', 'opt-waves', 'interference', W => [[W * 0.7, 120], [W * 0.75, 160]], { text: '^Δ = \\|r₂' }],
    ['optics', 'opt-waves', 'youngs-slits', W => { const x = 136 + 0.2 * (W - 180); return [[x, 300], [x + 20, 300], [x + 40, 300]]; }, { slider: 'ys-L' }],
    ['optics', 'opt-waves', 'diffraction', W => [[W - 52, 220], [W - 52, 260], [W - 52, 300]], { text: '^גלאי: a·sinθ' }],
    ['optics', 'opt-waves', 'thin-film', W => [[W * 0.44, 150], [W * 0.44, 200], [W * 0.44, 260]], { slider: 'tf-thick' }],
    ['optics', 'opt-modern', 'polarization', (W, H) => [[W * 0.62 + 20, H * 0.42], [W * 0.62 + 10, H * 0.42 + 20], [W * 0.62, H * 0.42 + 25]], { slider: 'pol-angle' }],
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
