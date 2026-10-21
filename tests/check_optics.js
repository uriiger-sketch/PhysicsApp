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

  // ── colour mixing: the colour science first (the model the simulation
  // draws with, _cmx), then the simulation itself ──
  const cm = await p.evaluate(() => {
    const C = _cmx, add = (...a) => [0, 1, 2].map(k => a.reduce((s, v) => s + v[k], 0)), sc = (x, k) => x.map(v => v * k);
    const [R, G, B] = C.LX, nm = (X, s) => C.nameKey(X, !!s), o = {};
    // lights add in linear light: the cone signals of a mixture are the sums
    // of its parts' at any power (gamma-encoded RGB values do not add)
    const a = 0.37, b = 0.81, mix = C.cones(add(sc(R, a), sc(G, b))), sum = add(sc(C.cones(R), a), sc(C.cones(G), b));
    o.additive = Math.max(...mix.map((v, i) => Math.abs(v - sum[i])));
    // and so do their spectra: the light of the mixture IS the sum of the lamps' light
    const sp = C.addS(C.LED, [a, b, 0]); let e1 = 0;
    for (let i = 0; i < C.N; i++) e1 = Math.max(e1, Math.abs(sp[i] - a * C.LED[0][i] - b * C.LED[1][i]));
    o.specAdd = e1;
    // the three lamps at full power make daylight white (D65) of luminance 1
    o.white = add(R, G, B).map(v => +v.toFixed(3)).join(',');
    o.lamps = [R, G, B].map(X => Math.round(C.hue(X).wl)).join(',');
    o.names = ['RG', 'GB', 'RB', 'RGB', 'R', 'G', 'B'].map(k => nm(add(...k.split('').map(c => C.LX['RGB'.indexOf(c)])))).join(',');
    o.dim = nm(sc(add(R, G, B), 0.2)) + ',' + nm([0, 0, 0]) + ',' + nm(add(R, sc(G, 0.2))) + ',' + nm(add(sc(R, 0.7), sc(G, 0.8))) + ',' + nm(C.YX);
    // filters on a white box: transmissions multiply, wavelength by wavelength
    const F = (...k) => C.adaptXYZ(C.xyz(C.mulS(C.FLAT, ...k.map(i => C.FIL[i]))));
    const cmT = C.mulS(C.FIL[0], C.FIL[1]); let e2 = 0;
    for (let i = 0; i < C.N; i++) e2 = Math.max(e2, Math.abs(cmT[i] - C.FIL[0][i] * C.FIL[1][i]));
    o.mult = e2;
    o.filters = [F(), F(0), F(1), F(2), F(0, 1), F(1, 2), F(0, 2), F(0, 1, 2)].map(X => nm(X, 1)).join(',');
    // objects under a lamp: what comes back is lamp × reflectance
    const S = (v, k) => C.xyz(C.mulS(C.addS(C.LED, v), C.REF[k]));
    o.objects = [S([1, 1, 1], 0), S([1, 0, 0], 0), S([0, 1, 0], 0), S([0, 0, 1], 0), S([1, 1, 1], 1), S([1, 0, 0], 1), S([0, 0, 1], 1), S([1, 1, 1], 2), S([0, 1, 0], 2)].map(X => nm(X, 1)).join(',');
    // metamerism: red + green can match the single 580 nm line to CIEDE2000 < 3
    // on 1 % slider steps -- although that mixture has no 580 nm light in it
    const Lt = C.lab(C.YX); let best = [1e9];
    for (let i = 0; i <= 100; i++) for (let j = 0; j <= 100; j++) { const d = C.de00(C.lab(add(sc(R, i / 100), sc(G, j / 100))), Lt); if (d < best[0]) best = [d, i, j]; }
    o.match = best;
    const ms = C.addS(C.LED, [best[1] / 100, best[2] / 100, 0]); let mx = 0; for (let i = 0; i < C.N; i++) mx = Math.max(mx, ms[i]);
    o.at580 = ms[200] / mx;
    // the leaf mission's physics: beside the white paper (which shows the
    // lamp is on) the leaf returns a twentieth of the paper's light in red,
    // blue or magenta light, and is black; in white, yellow, cyan or green
    // light it returns 30-40 % of it, at any power, and dimming such a lamp
    // only makes everything darker
    const rel = v => { const Lf = S(v, 1), Pp = S(v, 2); return Lf[1] / Pp[1]; };
    o.leafNoGreen = [[1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 0, 0.3]].map(v => nm(S(v, 1), 1) + ':' + (nm(S(v, 2), 1) !== 'black') + ':' + (rel(v) < 0.2)).join(',');
    o.leafGreen = Math.min(...[[1, 1, 1], [0.05, 0.05, 0.05], [1, 1, 0], [0, 1, 1], [0, 1, 0], [0.04, 0.04, 0]].map(rel));
    // CIEDE2000: all 34 reference pairs of Sharma, Wu & Dalal (2005), both
    // ways round (the hue-angle averages across 0/360 and the zero-chroma pairs
    // are the ones an implementation gets wrong)
    o.sharma = [[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412], [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
      [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0000], [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0000],
      [[50, 0, 0], [50, -1, 2], 2.3669], [[50, -1, 2], [50, 0, 0], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792], [[50, 2.49, -0.001], [50, -2.49, 0.0010], 7.1792],
      [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195], [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
      [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045], [[50, -0.001, 2.49], [50, 0.0010, -2.49], 4.8045],
      [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461], [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, 2.5, 0], [73, 25, -18], 27.1492], [[50, 2.5, 0], [61, -5, 29], 22.8977], [[50, 2.5, 0], [56, -27, -3], 31.9030],
      [[50, 2.5, 0], [58, 24, 15], 19.4535], [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0000], [[50, 2.5, 0], [50, 3.2972, 0], 1.0000],
      [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0000], [[50, 2.5, 0], [50, 3.2592, 0.3350], 1.0000],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
      [[61.2901, 3.7196, -5.3901], [61.4292, 2.2480, -4.9620], 1.8731], [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
      [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373], [[36.4612, 47.8580, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
      [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441], [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
      [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377], [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082]]
      .map(([A, B2, w]) => Math.max(Math.abs(C.de00(A, B2) - w), Math.abs(C.de00(B2, A) - w)));
    // the worked example: a fifth of the green light is sRGB code 124 (#7C),
    // as the section's example says, not 0.2 × 255 = 51
    const g5 = Math.round(255 * C.enc(0.2)), exd = document.createElement('div');
    exd.innerHTML = OPTICS_CONTENT['opt-light.color-mixing'].example.steps[1].a;
    const ex = exd.textContent.replace(/[\s​-‏⁦-⁩]/g, '');
    o.example = g5 + ' ' + (ex.includes('(255,' + g5 + ',0)') && ex.includes('#FF' + g5.toString(16).toUpperCase() + '00'));
    // a single wavelength's dominant wavelength is itself; the cones peak where they should
    o.dom = [460, 500, 530, 580, 610].map(w => Math.round(C.hue(C.xyz(C.band(w, 0.5))).wl)).join(',');
    o.peaks = [0, 1, 2].map(k => { let bi = 0; for (let i = 0; i < C.N; i++) if (C.CONE[i][k] > C.CONE[bi][k]) bi = i; return C.LAM[bi]; }).join(',');
    return o;
  });
  t('colour model: lights add in linear light (cone signals and spectra of a mixture are the sums)', cm.additive < 1e-9 && cm.specAdd < 1e-9, cm.additive + ' ' + cm.specAdd);
  t('colour model: the three LED lamps at full power make D65 white of luminance 1', cm.white === '0.95,1,1.089', cm.white);
  t('colour model: the lamps are seen at their own wavelengths (red ≈ 626, green ≈ 537, blue ≈ 460 nm)', cm.lamps === '626,537,460', cm.lamps);
  t('colour model: R+G yellow, G+B cyan, R+B magenta, R+G+B white; each lamp its colour', cm.names === 'yellow,cyan,magenta,white,red,green,blue', cm.names);
  t('colour model: dim white is dim white, no light is black, red + a fifth of green is orange, 0.7 R + 0.8 G only yellow-green, 580 nm yellow',
    cm.dim === 'dimwhite,black,orange,ygreen,yellow', cm.dim);
  t('colour model: filters multiply, wavelength by wavelength', cm.mult < 1e-6, cm.mult);
  t('colour model: white box, C, M, Y alone; C·M blue, M·Y red, C·Y green, C·M·Y black', cm.filters === 'white,cyan,magenta,yellow,blue,red,green,black', cm.filters);
  t('colour model: red shirt red in white and red light, black in green and blue; green leaf green, black in red and blue; paper white, green in green',
    cm.objects === 'red,red,black,black,green,black,black,white,green', cm.objects);
  t('colour model: red + green matches the 580 nm line (CIEDE2000 < 3 at some 1 % slider pair)', cm.match[0] < 3 && cm.match[0] > 0.5, JSON.stringify(cm.match));
  t('colour model: … with no 580 nm light in that mixture (< 2 % of its peak)', cm.at580 < 0.02, cm.at580);
  t('colour model: in red, blue or magenta light the leaf is black beside a lit paper and returns < 20 % of its light',
    cm.leafNoGreen === 'black:true:true,black:true:true,black:true:true,black:true:true', cm.leafNoGreen);
  t('colour model: in light with green in it the leaf returns ≥ 30 % of the paper\'s light, however dim the lamp', cm.leafGreen > 0.29, cm.leafGreen);
  t('colour model: CIEDE2000 reproduces all 34 Sharma reference pairs to 1e-4, both ways round', cm.sharma.length === 34 && cm.sharma.every(d => d < 1e-4), cm.sharma.map(d => d.toExponential(1)).join(','));
  t('colour model: the worked example\'s green code is the sRGB encoding of a fifth of the light, (255, 124, 0) = #FF7C00', cm.example === '124 true', cm.example);
  t('colour model: a single wavelength has itself as dominant wavelength', cm.dom === '460,500,530,580,610', cm.dom);
  t('colour model: cone sensitivities peak at S ≈ 448, M ≈ 543, L ≈ 567 nm (Smith–Pokorny transform of the CIE 1931 functions)', cm.peaks === '567,543,448', cm.peaks);

  // the simulation: what is on the screen and in the model line, and every mission reachable by the hand
  await p.evaluate(() => { window.__CT = []; const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) { if (typeof s === 'string' && this.canvas.id === 'sim-canvas') window.__CT.push(s.replace(/[⁦-⁩‎]/g, '')); if (window.__CT.length > 3000) window.__CT.splice(0, 1500); return o.apply(this, arguments); }; });
  await open('opt-light', 'color-mixing');
  const cmModel = () => p.evaluate(() => (document.querySelector('.sk-model-tx') || {}).textContent || '');
  const cmDone = () => p.evaluate(() => [...document.querySelectorAll('#app .sk-m')].map(li => li.classList.contains('done') ? 1 : 0).join(''));
  const cmTap = async (src) => {
    const at = await p.evaluate((src) => {
      const f = new Function('r', 'g', 'b', 'return ' + src), cv = document.getElementById('sim-canvas'), g = cv.getContext('2d');
      const d = g.getImageData(0, 0, cv.width, cv.height).data, R = cv.getBoundingClientRect(), k = cv.width / R.width;
      let sx = 0, sy = 0, m = 0;
      for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) { const i = (y * cv.width + x) * 4; if (f(d[i], d[i + 1], d[i + 2])) { sx += x; sy += y; m++; } }
      return m ? { x: R.left + sx / m / k, y: R.top + sy / m / k } : null;
    }, src);
    if (at) { await p.mouse.click(at.x, at.y); await p.waitForTimeout(250); }
    return at;
  };
  const slide = (k, v) => p.evaluate(([k, v]) => { const e = document.getElementById('inp-' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
  await (await p.$('#sim-canvas')).scrollIntoViewIfNeeded();
  const m0 = await cmModel(), xp0 = await p.evaluate(() => state.xp);
  t('colour mixing: the model line starts with the three lamps at the probe, seen white', m0.includes('I = 0.80·R + 0.80·G + 0.80·B') && m0.includes(L('לבן')), m0);
  const drawn = await p.evaluate(() => [...new Set(window.__CT)]);
  t('colour mixing: the overlaps are named by what they are (yellow, cyan, magenta)', ['צהוב', 'ציאן', 'מגנטה'].every(h => drawn.includes(L(h))), drawn.join(' | '));
  // half a red lamp on the screen is the model's colour (linear light), not the 128 that adding gamma-encoded values gave
  await slide('cm-green', 0); await slide('cm-blue', 0); await slide('cm-red', 50); await p.waitForTimeout(250);
  const half = await p.evaluate(() => {
    // the red of the red-only part of the screen: the commonest pure red on the canvas
    const cv = document.getElementById('sim-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, h = {};
    for (let i = 0; i < d.length; i += 8) if (d[i] > 60 && d[i + 1] < 12 && d[i + 2] < 12) h[d[i]] = (h[d[i]] || 0) + 1;
    const top = Object.keys(h).sort((x, y) => h[y] - h[x])[0];
    return { screen: +top, model: _cmx.disp(_cmx.LX[0].map(v => v * 0.5))[0] };
  });
  t('colour mixing: half a red lamp is drawn as the model computes it in linear light (not gamma-added)', Math.abs(half.screen - half.model) <= 2 && half.screen > 200, JSON.stringify(half));
  await slide('cm-red', 80); await slide('cm-green', 80); await slide('cm-blue', 80); await p.waitForTimeout(250);
  // mission 1: yellow from two lamps
  await cmTap('r>200&&g>200&&b<80');
  const m1 = await cmModel();
  t('colour mixing: the probe on red + green reads 0.80·R + 0.80·G, seen yellow; the first mission solved', m1.includes('I = 0.80·R + 0.80·G ') && !m1.includes('·B') && m1.includes(L('צהוב')) && (await cmDone()) === '1000', m1);
  // mission 2: match the 580 nm line
  await p.click('#btn-cm-yel'); await slide('cm-red', cm.match[1]); await slide('cm-green', cm.match[2]); await p.waitForTimeout(300);
  const m2 = await cmModel(), de = parseFloat((m2.match(/ΔE00 = ([\d.]+)/) || [])[1]);
  t('colour mixing: the 580 nm lamp matched by red + green (ΔE00 < 3 in the model line); the second mission solved', de < 3 && (await cmDone()) === '1100', m2);
  // mission 3: two filters make blue
  await p.click('#btn-sk-cm-sub'); await p.waitForTimeout(400);
  await cmTap('b>180&&r<110&&g<40');
  const m3 = await cmModel();
  t('colour mixing: under cyan and magenta the probe reads I₀·T_C·T_M, seen blue; the third mission solved', /I = I₀·TC·TM /.test(m3) && m3.includes(L('כחול')) && (await cmDone()) === '1110', m3);
  // the prediction, then mission 4
  await p.click('#btn-sk-cm-obj'); await p.waitForTimeout(400);
  const pq = await p.evaluate(() => !document.querySelector('.sk-predict').hidden && document.querySelectorAll('.sk-opt').length);
  await p.click('.sk-opt >> nth=2'); await p.waitForTimeout(1400);
  const m4a = await cmModel(), right = await p.evaluate(() => document.querySelectorAll('.sk-opt')[2].classList.contains('right'));
  t('colour mixing: the prediction (red shirt under green light) is asked, marked, and the lamp turns green: the shirt is seen black', pq === 4 && right && m4a.includes('(1.00·G)·ρ') && m4a.includes(L('שחור')), m4a);
  // a white lamp turned almost off makes the leaf dark, not the lesson: not solved
  await slide('cm-red', 5); await slide('cm-green', 5); await slide('cm-blue', 5); await p.waitForTimeout(300);
  t('colour mixing: a white lamp at 5 % (leaf dark, paper grey) does not solve the leaf mission', (await cmDone()) === '1110', await cmDone());
  // blue light has no green in it (and only 4 % of the white's luminance): the leaf is black
  await p.click('#btn-cm-lb'); await p.waitForTimeout(1300);
  t('colour mixing: in blue light the green leaf is black -- the fourth mission solved, 40 XP in all', (await cmDone()) === '1111' && (await p.evaluate(() => state.xp)) - xp0 === 40, await cmDone());

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
    // the blue lamp's handle, at the top of the three spots (a phone: the stage above the eye's panel)
    ['optics', 'opt-light', 'color-mixing', (W, H) => { const sw = W - 16, sh = H - 248, cr = Math.min(sw * 0.24, sh * 0.27), y = 8 + sh * 0.53 - cr * 0.62; return [[W / 2, y], [W / 2, y - 20], [W / 2, y - 40]]; }, { gone: '^' + LR('גררו את הפנסים · הקישו כדי להזיז את הגשוש') }],
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
    ['optics', 'opt-waves', 'diffraction', W => [[W - 52, 220], [W - 52, 260], [W - 52, 300]], { text: '^' + LR('גלאי: a·sinθ = ') }],
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
