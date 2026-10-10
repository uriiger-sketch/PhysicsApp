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
// image must lie behind the mirror.
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

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

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`check_optics: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ OPTICS ANSWERS AND SIMULATIONS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
