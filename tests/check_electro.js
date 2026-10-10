// Electrostatics: every guided problem recomputed from first principles, and
// the simulations read back through what they print -- the places where a
// previous version drew or reported the wrong physics.
//
//   node tests/check_electro.js
//
// Each problem step's stated answer must agree with an independent computation
// (to its own tolerance, or 1.5 %, whichever is looser), and the step's
// tolerance must accept the computed value rounded to two significant figures
// -- the rounding a student will most often type. Then the simulations:
//   - Millikan: weigh the drop by its fall (V = 0), balance it, and n = q/e
//     must come out within 2 % of a whole number, for several random drops;
//   - pair energy: released from rest, two like charges actually fly apart;
//   - electroscope: a rod of the opposite sign CLOSES a charged electroscope's
//     leaves as it approaches (the classic sign test);
//   - conductor in an external field: E = 0 inside a neutral sphere;
//   - charged sphere, Q < 0: |E| > 0 outside and V < 0;
//   - three geometries, potential view: inside the sphere V = kQ/R;
//   - deflection: a particle that hits the plate reports the hit.
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0, n = 0;
const t = (name, ok, info) => { n++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

const k = 9e9, e = 1.6e-19, me = 9.1e-31, eps0 = 8.85e-12;
const aDef = e * (150 / 0.03) / me;
const EXPECT = {
  'elc-charge.elc-basics': [3.2e-9 / e, 1.6],
  'elc-charge.elc-coulomb': [k * 1e-12 / 0.1 ** 2, k * 1e-12 / 0.05 ** 2],
  'elc-charge.elc-field': [e * 2000, e * 2000 / me],
  'elc-charge.elc-plane': [6e-6 / (2 * eps0), 6e-6 / eps0, 6e-6 / eps0 * 0.03, e * 6e-6 / eps0],
  'elc-charge.elc-conductor': [k * 2e-6 / 0.1, k * 2e-6 / 0.2 ** 2, 0],
  'elc-energy.elc-potential': [2e-6 * (500 - 100), 2e-6 * (500 - 100)],
  'elc-energy.elc-upair': [k * 4e-6 * -2e-6 / 0.4, -k * 4e-6 * -2e-6 / 0.4, k * 4e-6 * 2e-6 / 0.4],
  'elc-energy.elc-sphere': [k * 4e-6 / 0.15, k * 4e-6 / 0.3 ** 2, k * (4e-6) ** 2 / (2 * 0.15), 3e6 * 0.15 ** 2 / k * 1e6],
  'elc-energy.elc-plates': [200 / 0.004, e * 200, Math.sqrt(2 * e * 200 / me)],
  'elc-energy.elc-capacitor': [100e-6 * 12, 0.5 * 100e-6 * 12 ** 2],
  'elc-energy.elc-network': [4 + 12, 1 / (1 / 4 + 1 / 12), (1 / (1 / 4 + 1 / 12)) * 24 / 4],
  'elc-energy.elc-dielectric': [5 * 150, 5 * 150e-12 * 10 * 1e9, 150e-12 * 10 / (5 * 150e-12)],
  'elc-energy.elc-compare': [k * 1.2e-6 / 0.15 ** 2, k * 1.2e-6 / 0.15 ** 2, (1.2e-6 / 2) / (2 * eps0)],
  'elc-motion.elc-deflection': [150 / 0.03, aDef, 0.5 * aDef * (0.08 / 2.5e7) ** 2 * 1000],
  'elc-motion.elc-millikan': [600 / 0.006, 4.8e-15 * 10 / (600 / 0.006), 4.8e-15 * 10 / (600 / 0.006) / e],
};
const sig2 = x => x === 0 ? 0 : Number(x.toPrecision(2));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', x => errs.push(x.message));
  // every canvas label, so a simulation can be read through what it prints
  await p.addInitScript(() => {
    window.__txt = [];
    const P = CanvasRenderingContext2D.prototype, o = P.fillText;
    P.fillText = function (s, ...r) { if (typeof s === 'string') { window.__txt.push(s); if (window.__txt.length > 600) window.__txt.splice(0, 300); } return o.call(this, s, ...r); };
  });
  await p.goto(F);
  await p.waitForTimeout(700);
  const content = await p.evaluate(() => {
    if (window.closeOnboarding) closeOnboarding();
    const out = {};
    for (const ch of ELECTRO_CHAPTERS) for (const se of ch.sections) {
      const key = ch.id + '.' + se.id, C = CONTENT[key];
      out[key] = { steps: ((C.problem || {}).steps || []).map(s => ({ a: parseFloat(s.answer), tol: s.tolerance || 0 })),
        quiz: (C.quiz || []).map(q => q.correct >= 0 && q.correct < q.opts.length) };
    }
    return out;
  });
  t('every electrostatics section has an independent computation', Object.keys(content).every(x => EXPECT[x]),
    Object.keys(content).filter(x => !EXPECT[x]).join(' '));
  for (const key in content) {
    const want = EXPECT[key] || [], got = content[key].steps;
    t(key + ': step count', got.length === want.length, got.length + ' vs ' + want.length);
    got.forEach((s, i) => {
      if (want[i] === undefined) return;
      const lim = Math.max(s.tol, Math.abs(want[i]) * 0.015);
      t(key + '#' + i, Math.abs(s.a - want[i]) <= lim, 'answer ' + s.a + ', computed ' + want[i].toPrecision(5));
      t(key + '#' + i + ' accepts the 2-figure rounding', Math.abs(sig2(want[i]) - s.a) <= s.tol * 1.0001,
        'typed ' + sig2(want[i]) + ', answer ' + s.a + ' ± ' + s.tol);
    });
    t(key + ': quiz keys in range', content[key].quiz.every(Boolean));
  }

  // ── simulations ──
  const open = async (se) => {
    await p.evaluate((s2) => {
      const c2 = ELECTRO_CHAPTERS.find(c => c.sections.some(x => x.id === s2)).id;
      state.subject = 'electro'; state.chapter = c2; state.section = s2; state.tab = 'sim'; render();
    }, se);
    await p.waitForTimeout(900);
  };
  const setR = (id, v) => p.evaluate(([i, x]) => { const el = document.getElementById(i); el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  const click = id => p.evaluate(i => document.getElementById(i).click(), id);
  // bidi isolates and marks are inserted around maths runs; read the bare text
  const bare = s => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '');
  const txt = async (ms = 250) => { await p.evaluate(() => { window.__txt = []; }); await p.waitForTimeout(ms); return bare(await p.evaluate(() => window.__txt.join('\n'))); };
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-').replace(/×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (a, ex) => 'e' + ex.replace('⁻', '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)))) : NaN; };
  const drag = async (fx0, fy0, fx1, fy1) => {
    const bb = await (await p.$('#app canvas')).boundingBox();
    await p.mouse.move(bb.x + bb.width * fx0, bb.y + bb.height * fy0); await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(bb.x + bb.width * (fx0 + (fx1 - fx0) * i / 10), bb.y + bb.height * (fy0 + (fy1 - fy0) * i / 10));
    await p.mouse.up();
  };

  // Millikan: weigh, then balance -- n must be a whole number
  await open('elc-millikan');
  for (let drop = 0; drop < 3; drop++) {
    if (drop) await click('btn-mk-new');
    await setR('inp-mk-V', 0);
    const fall = await txt(400);
    t(`Millikan drop ${drop}: the fall at V = 0 gives the mass`, /m = [0-9.]+×10⁻¹⁵ kg/.test(fall), fall.split('\n').find(l => /⇒/.test(l)));
    // sweep the voltage up through the balance, 1 V at a time, as a learner
    // fine-tuning would; the simulation keeps the best balance it saw
    let nq = NaN, hit = 0;
    for (let v = 20; v <= 1000; v += 1) {
      await setR('inp-mk-V', v);
      await p.waitForTimeout(20);
      const s = bare(await p.evaluate(() => { const r = window.__txt.slice(-30).join('\n'); window.__txt = []; return r; }));
      const m = s.match(/n = q\/e = ([0-9.]+)/);
      if (m) { nq = parseFloat(m[1]); if (!hit) hit = v; }
      if (hit && v > hit * 1.04) break;
    }
    t(`Millikan drop ${drop}: n = q/e is a whole number`, Math.abs(nq - Math.round(nq)) < 0.02 && nq >= 0.98, 'n = ' + nq);
  }

  // pair energy: released from rest, two like charges fly apart
  await open('elc-upair');
  const r0 = num(await txt(), /r = ([0-9.]+) m/);
  await click('btn-up-release');
  const r1 = num(await txt(900), /r = ([0-9.]+) m/);
  t('pair released from rest: the charges move apart', r1 > r0 + 0.05, r0 + ' → ' + r1);

  // electroscope: charge it by contact, then an opposite rod closes the leaves
  await open('elc-basics');
  await drag(0.22, 0.27, 0.55, 0.25);
  await click('btn-scope-touch');
  await drag(0.55, 0.25, 0.12, 0.62);
  await click('btn-scope-flip');
  const ang = async () => num(await txt(300), /זווית עלים: ([0-9.]+)°/);
  const aFar = await ang();
  await drag(0.12, 0.62, 0.50, 0.27);
  const aNear = await ang();
  t('electroscope: an opposite rod closes a charged electroscope\'s leaves', aNear < aFar - 3, aFar + '° → ' + aNear + '°');

  // conductor in an external field: neutral sphere, probe inside, E = 0
  await open('elc-conductor');
  await click('btn-cnd-ext');
  await setR('inp-cnd-Q', 0);
  await drag(0.38, 0.32, 0.29, 0.40);
  const cnd = await txt();
  t('neutral conductor in an external field: E = 0 inside', /E = 0 בדיוק/.test(cnd), cnd.split('\n').filter(l => /^‎?E = /.test(l)).slice(-1)[0]);

  // charged sphere with Q < 0: a real field outside, a negative potential
  await open('elc-sphere');
  await setR('inp-sph-Q', -6);
  await drag(0.5, 0.5, 0.6, 0.5);
  const sph = await txt();
  const eS = num(sph, /E = ([0-9.]+×10[⁻⁰-⁹¹²³⁴⁵⁶⁷⁸⁹]+) V\/m/), vS = num(sph, /V = (-?[0-9.]+×10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+) V/);
  t('negative sphere: |E| > 0 outside and V < 0', eS > 0 && vS < 0, 'E=' + eS + ' V=' + vS);

  // three geometries, potential view: inside the sphere V = kQ/R (not 0)
  await open('elc-compare');
  await click('btn-cmp-v');
  await drag(0.10, 0.5, 0.08, 0.5);       // a probe well inside R = 5 cm
  const cmp = await txt();
  const vs = [...cmp.matchAll(/V = ([0-9.]+) kV/g)].map(m => parseFloat(m[1]));
  t('compare (V view): inside the sphere V = kQ/R', vs.some(v => Math.abs(v - 8.988e9 * 0.5e-6 / 0.05 / 1e3) < 1), vs.join(','));

  // deflection: a particle that hits the plate reports the hit
  await open('elc-deflection');
  await setR('inp-df-v0', 1);
  const df = await txt();
  t('deflection: a hit reports y = d/2 and where', /y = d\/2/.test(df) && /x = v₀t/.test(df), df.split('\n').filter(l => /y = /.test(l)).slice(-1)[0]);

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`check_electro: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ELECTROSTATICS ANSWERS AND SIMULATIONS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
