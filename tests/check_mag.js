// Magnetism: is every number, every direction and every simulation readout
// the physics? Answers are recomputed here independently of the content; the
// simulations are read through the text they draw (fillText is recorded), so
// their live readouts are checked against the formulas they claim to show.
//
//   node tests/check_mag.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? ': ' + info : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const MU0 = 4 * Math.PI * 1e-7, E = 1.6e-19, MP = 1.67e-27, U = 1.66e-27, ME = 9.11e-31;
// every guided-problem answer, derived from scratch
const EXPECT = {
  'mag-field.mag-magnets': [Math.hypot(30, 20), Math.atan(20 / 30) * 180 / Math.PI, 30],
  'mag-field.mag-wire': [2e-7 * 20 / 0.04 * 1e6, 2e-7 * 20 / 0.08 * 1e6, 2e-7 * 20 / 30e-6 * 100, 2 * 2e-7 * 20 / 0.05 * 1e6],
  'mag-field.mag-loop': [MU0 * 50 * 2 / (2 * 0.05) * 1e3, 2e-3 * 2 * 0.05 / (MU0 * 50), Math.PI],
  'mag-field.mag-solenoid': [MU0 * 2000 * 4 * 1e3, MU0 * 1000 * 4 * 1e3, 25e-3 / (MU0 * 2000)],
  'mag-force.mag-lorentz': [E * 2e6 * 0.5 / 1e-13, E * 2e6 * 0.5 / MP / 1e13, E * 2e6 * 0.5 * 0.5 / 1e-13, E * 2e6 * 0.5 / (MP * 9.8)],
  'mag-force.mag-circle': [MP * 3e6 / (E * 0.2) * 100, 2 * Math.PI * MP / (E * 0.2) * 1e6, MP * 6e6 / (E * 0.2) * 100, ME * 3e6 / (E * 0.2) * 1000],
  'mag-force.mag-spectro': [4e4 / 0.1 / 1e5, 12 * U * 4e5 / (E * 0.2) * 100, 14 * U * 4e5 / (E * 0.2) * 100, 2 * (14 - 12) * U * 4e5 / (E * 0.2) * 100],
  'mag-force.mag-wireforce': [0.4 * 5 * 0.2, 0.4 * 5 * 0.2 * 0.5, 0.02 * 9.8 / (0.4 * 0.2)],
  'mag-force.mag-parallel': [2e-7 * 100 / 0.05 / 1e-4, 2e-7 * 100 / 0.05 * 2 * 1e3, 2e-7 * 300 / 0.05 / 1e-4],
  'mag-force.mag-motor': [100 * 0.3 * 0.5 * 2e-3, 100 * 0.3 * 0.5 * 2e-3 * 0.5, 100 * 0.5 * 2e-3],
  'mag-induction.mag-flux': [0.5 * 0.02 * 1e3, 0.5 * 0.02 * 0.5 * 1e3, 200 * 0.5 * 0.02],
  'mag-induction.mag-faraday': [200 * 0.5 * 0.01 / 0.1, 10 / 20, 200 * 0.5 * 0.01 / 20, 200 * 0.5 * 0.01 / 0.5],
  'mag-induction.mag-lenz': [0.4 * 5e-3 * 1e3, 0.4 * 5e-3 / 0.02, 0.01 * 0.02 * 1e3, MU0 * 0.1 / (2 * Math.sqrt(5e-3 / Math.PI)) * 1e6],
  'mag-induction.mag-motional': [0.3 * 0.5 * 4, 0.6 / 2, 0.3 * 0.3 * 0.5, 0.3 * 0.3 * 0.5 * 4],
  'mag-induction.mag-generator': [2 * Math.PI * 50, 100 * 0.2 * 0.05 * 2 * Math.PI * 50, 100 * 0.2 * 0.05 * 2 * Math.PI * 50 / Math.SQRT2, 100 * 0.2 * 0.05 * 2 * Math.PI * 25],
  'mag-induction.mag-transformer': [230 * 60 / 1150, 24 / 12, 24 / 230, Math.pow((10e6 / 20e3) / (10e6 / 400e3), 2)],
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(F); await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {};
    const P = CanvasRenderingContext2D.prototype, o = P.fillText; window.__txt = [];
    P.fillText = function (s, ...r) { if (this.canvas.id === 'sim-canvas') window.__txt.push(String(s).replace(/[⁦-⁩]/g, '')); return o.call(this, s, ...r); }; });

  console.log('\n1) structure: 16 sections, each complete and wired');
  const S = await p.evaluate(() => MAG_CHAPTERS.flatMap(c => c.sections.map(s => {
    const k = c.id + '.' + s.id, C = MAG_CONTENT[k] || {};
    const anim = ((C.theory || {}).html || '').match(/<canvas id="(anim-[^"]+)"/);
    return { k, hasTheory: !!(C.theory && C.theory.html), sim: C.sim && C.sim.type, simFn: !!(C.sim && MAG_SIMS[C.sim.type]),
      ctrl: !!(C.sim && MAG_CTRL[C.sim.type]), anim: anim && anim[1], quiz: (C.quiz || []).length,
      quizOK: (C.quiz || []).every(q => q.opts.length === 4 && q.correct >= 0 && q.correct < 4 && q.explain),
      steps: ((C.problem || {}).steps || []).map(s => ({ a: parseFloat(s.answer), tol: s.tolerance })),
      ex: ((C.example || {}).steps || []).length };
  })));
  t('16 sections', S.length === 16, S.length);
  for (const s of S) {
    t(s.k + ': theory, sim with controls, animation, 6 quiz items, worked example',
      s.hasTheory && s.simFn && s.ctrl && !!s.anim && s.quiz === 6 && s.quizOK && s.ex >= 3);
    const e = EXPECT[s.k] || [];
    t(s.k + ': every answer is the physics', e.length === s.steps.length &&
      s.steps.every((st, i) => near(st.a, e[i], Math.max(st.tol, 1e-9))),
      s.steps.map((st, i) => st.a + '≈' + (e[i] === undefined ? '?' : +e[i].toPrecision(4))).join(' | '));
  }

  console.log('\n2) the field helpers against first principles');
  const H = await p.evaluate(() => {
    const bs = (R, I, rho, z) => { let Br = 0, Bz = 0; const n = 4000;
      for (let i = 0; i < n; i++) { const ph = 2 * Math.PI * i / n, dp = 2 * Math.PI / n, sx = R * Math.cos(ph), sy = R * Math.sin(ph),
        dlx = -R * Math.sin(ph) * dp, dly = R * Math.cos(ph) * dp, rx = rho - sx, ry = -sy, rz = z, r3 = Math.pow(rx * rx + ry * ry + rz * rz, 1.5);
        Br += (dly * rz) / r3; Bz += (dlx * ry - dly * rx) / r3; }
      return [Br * 1e-7 * I, Bz * 1e-7 * I]; };
    const pts = [[0, 0], [0.02, 0.01], [0.07, -0.03], [0.049, 0.002]];
    const loop = pts.map(q => { const a = magLoopB(0.05, 2, q[0], q[1]), c = bs(0.05, 2, q[0], q[1]);
      return Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1])) / Math.hypot(c[0], c[1]); });
    // a long solenoid made of many loops approaches μ₀nI, with the finite-length factor
    const N = 400, L = 0.4, a = 0.02; let Bc = 0; for (let k = 0; k < N; k++) Bc += magLoopB(a, 1, 0, -L / 2 + (k + 0.5) * L / N)[1];
    const fd = (magDipFlux(2, 0.02, 0.0301) - magDipFlux(2, 0.02, 0.0299)) / 0.0002;
    return { loop, sol: Bc / (MU0 * N / L), solF: L / Math.sqrt(L * L + 4 * a * a), fd, an: magDipFluxD(2, 0.02, 0.03),
      centre: magLoopB(0.05, 2, 0, 0)[1] / (MU0 * 2 / 0.1) };
  });
  t('loop field matches Biot–Savart (4 points)', H.loop.every(e => e < 2e-3), H.loop.map(e => e.toExponential(1)).join(' '));
  t('loop centre is μ₀I/2R', near(H.centre, 1, 1e-9), H.centre);
  t('400 loops give μ₀nI·L/√(L²+4a²) at the centre', near(H.sol, H.solF, 2e-3), H.sol.toFixed(4) + ' vs ' + H.solF.toFixed(4));
  t('dipole flux derivative is the slope of the flux', near(H.fd, H.an, Math.abs(H.an) * 1e-3), H.fd.toExponential(4) + ' vs ' + H.an.toExponential(4));

  // helpers to drive a simulation and read what it draws
  const open = async (ch, se) => { await p.evaluate(([c, s]) => { state.subject = 'magnetism'; state.chapter = c; state.section = s; state.tab = 'sim'; render(); }, [ch, se]); await p.waitForTimeout(700); };
  const read = async (ms = 120) => { await p.evaluate(() => { window.__txt = []; }); await p.waitForTimeout(ms); return p.evaluate(() => window.__txt.slice()); };
  const num = (arr, re) => { for (const s of arr.slice().reverse()) { const m = s.match(re); if (m) return parseFloat(m[1].replace('−', '-')); } return NaN; };
  const has = (arr, sub) => arr.some(s => s.includes(sub));
  const click = id => p.evaluate(i => document.getElementById(i).click(), id);
  const slide = (id, v) => p.evaluate(([i, x]) => simSyncSlider(i, x, 3), [id, v]);

  console.log('\n3) simulation readouts and directions');
  await open('mag-field', 'mag-wire'); let T = await read();
  t('wire: B at the probe = μ₀I/2πr (20 A, 4.5 cm)', near(num(T, /B = ([\d.]+) μT/), 2e-7 * 20 / 0.045 * 1e6, 0.2), num(T, /B = ([\d.]+) μT/));
  await open('mag-field', 'mag-loop'); T = await read();
  t('loop: centre field = μ₀NI/2R (1.26 mT)', has(T, '1.26 mT'));
  await open('mag-field', 'mag-solenoid'); await p.waitForTimeout(400); T = await read();
  t('solenoid: μ₀nI = 0.38 mT and the centre is 94% of it', has(T, '0.38 mT') && has(T, '94%'));
  await open('mag-force', 'mag-lorentz'); T = await read();
  t('Lorentz: F = qvB = 1.60×10⁻¹³ N, r = 4.2 cm, T = 131 ns', has(T, '1.60×10⁻¹³') && has(T, '4.2 cm') && has(T, '131 ns'));
  await click('btn-mgz-mode'); T = await read();
  t('Lorentz, B along +x, v at 60°: force INTO the page on a + charge', has(T, 'נכנס לדף'));
  await click('btn-mgz-q'); T = await read();
  t('  and OUT of the page on a − charge', has(T, 'יוצא מהדף'));
  await open('mag-force', 'mag-circle'); await click('btn-mgr-fire'); T = await read();
  t('circle: r = mv/qB = 15.66 cm, T/2 = 164.0 ns', has(T, '15.66 cm') && has(T, '164.0 ns'));
  // a proton in B into the page turns counter-clockwise: from the lower entry, upward
  const yel = async () => p.evaluate(() => { const c = document.getElementById('sim-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let up = 0, lo = 0; for (let y = 0; y < c.height; y += 2) for (let x = Math.round(c.width * 0.25); x < c.width; x += 2) { const i = (y * c.width + x) * 4;
      if (d[i] > 220 && d[i + 1] > 160 && d[i + 1] < 210 && d[i + 2] < 80) { if (y < c.height / 2) up++; else lo++; } } return [up, lo]; });
  await p.waitForTimeout(2600); let yy = await yel();
  t('  the proton curves UP (counter-clockwise) in B into the page', yy[0] > 20, yy.join('/'));
  await click('btn-mgr-Bdir'); await click('btn-mgr-fire'); await p.waitForTimeout(2600); yy = await yel();
  t('  and DOWN (clockwise) when B comes out of the page', yy[1] > 20 && yy[1] > yy[0], yy.join('/'));
  await open('mag-force', 'mag-spectro'); T = await read();
  t('spectrometer: v = E/B = 4.00×10⁵ m/s; ¹²C and ¹⁴C land at 49.8 and 58.1 cm', has(T, '4.00×10⁵') && has(T, '49.8 cm') && has(T, '58.1 cm'));
  await open('mag-force', 'mag-wireforce'); await p.waitForTimeout(2500); T = await read();
  const phi = num(T, /φ = ([\d.]+)°/);
  t('swing: F = BIL = 0.080 N, equilibrium tanφ = F/mg', has(T, '0.080 N') && near(phi, Math.atan(0.08 / 0.196) * 180 / Math.PI, 0.3), phi);
  t('  I out of the page, N above: pushed to the RIGHT', has(T, 'ימינה'));
  await click('btn-mgf-flip'); T = await read();
  t('  magnet flipped: pushed to the LEFT', has(T, 'שמאלה'));
  await open('mag-force', 'mag-parallel'); T = await read();
  t('parallel: 10 A and 10 A at 5 cm, same way: 4.00×10⁻⁴ N/m, attraction', has(T, '4.00×10⁻⁴') && has(T, 'משיכה'));
  await slide('mgq-I2', -10); T = await read();
  t('  one current reversed: repulsion, same size', has(T, '4.00×10⁻⁴') && has(T, 'דחייה'));
  await open('mag-force', 'mag-motor'); T = await read();
  t('motor: τmax = NBIA = 0.0300 N·m', has(T, '0.0300 N·m'));
  const taus = async n => { const a = []; for (let i = 0; i < n; i++) { const r = await read(90); a.push(num(r, /τ = (-?[\d.]+) N·m/)); } return a; };
  let tv = await taus(30);
  t('  with the commutator the torque never reverses', tv.every(x => x >= -1e-4), Math.min(...tv).toFixed(4));
  await click('btn-mgo-comm'); await p.waitForTimeout(300); tv = await taus(40);
  t('  without it the torque takes both signs (it rocks)', Math.min(...tv) < -1e-3 && Math.max(...tv) > 1e-3, Math.min(...tv).toFixed(4) + '…' + Math.max(...tv).toFixed(4));
  await open('mag-induction', 'mag-flux'); T = await read();
  t('flux: BA at θ = 0 is 10.00 mWb', has(T, '10.00 mWb'));
  await slide('mgx-th', 60); T = await read();
  t('  and 5.00 mWb at 60°', has(T, '5.00 mWb'));
  await open('mag-induction', 'mag-faraday'); T = await read();
  t('Faraday: a magnet at rest induces nothing', num(T, /ε = (-?[\d.]+) mV/) === 0);
  // pair each readout with the caption drawn right after it, frame by frame
  const pairs = (r, re) => { const out = []; for (let i = 0; i + 1 < r.length; i++) { const m = r[i].match(re);
    if (m) out.push([parseFloat(m[1]), r[i + 1]]); } return out; };
  await click('btn-mgy-auto'); let sgn = { app: [], rec: [] };
  for (let i = 0; i < 60; i++) { for (const [e, c] of pairs(await read(80), /ε = (-?[\d.]+) mV/)) {
    if (c.includes('מתקרב') && e) sgn.app.push(e); if (c.includes('מתרחק') && e) sgn.rec.push(e); } }
  t('  N approaching: ε < 0 (the coil sets up a field toward the magnet — repulsion)', sgn.app.length > 3 && sgn.app.every(e => e < 0), sgn.app.slice(0, 4).join(','));
  t('  N receding: ε > 0 (attraction)', sgn.rec.length > 3 && sgn.rec.every(e => e > 0), sgn.rec.slice(0, 4).join(','));
  await open('mag-induction', 'mag-lenz'); await click('btn-mgn-push'); let fa = [], fr = [];
  for (let i = 0; i < 30; i++) { for (const [f, c] of pairs(await read(70), /F = (-?[\d.]+) mN/)) {
    if (c.includes('מתקרב') && f) fa.push(f); if (c.includes('מתרחק') && f) fr.push(f); } }
  t('Lenz: magnet pushed in — the ring is pushed AWAY (F > 0)', fa.length > 2 && fa.every(f => f > 0), fa.slice(0, 4).join(','));
  t('  magnet drawn out — the ring is pulled AFTER it (F < 0)', fr.length > 1 && fr.every(f => f < 0), fr.slice(0, 4).join(','));
  await click('btn-mgn-reset'); await click('btn-mgn-cut'); await click('btn-mgn-push'); fa = [];
  for (let i = 0; i < 12; i++) { const r = await read(70); fa.push(num(r, /F = (-?[\d.]+) mN/)); }
  t('  a cut ring: no current, no force', fa.every(f => f === 0));
  await open('mag-induction', 'mag-motional'); await click('btn-mgv-go'); T = await read();
  t('motional: terminal speed FR/B²L² = 1.60 m/s', has(T, '1.60 m/s'));
  await p.waitForTimeout(1500); T = await read();
  const eps = num(T, /ε = BLv = ([\d.]+) V/), I = num(T, /I = ([\d.]+) A/), fb = num(T, /BIL = ([\d.]+) N/);
  t('  I = ε/R and BIL = B·I·L while it runs', near(I, eps / 2, 2e-3) && near(fb, 0.5 * I * 0.5, 2e-3), `ε=${eps} I=${I} F=${fb}`);
  await open('mag-induction', 'mag-generator'); T = await read();
  t('generator: ε_max = NBAω = 6.3 V, ε_rms = 4.4 V at 1 Hz', has(T, '6.3 V') && has(T, '4.4 V'));
  await open('mag-induction', 'mag-transformer'); T = await read();
  t('transformer: V₂ = 12.0 V, I₂ = 2.00 A, I₁ = 0.104 A, P₁ = P₂ = 24.0 W', has(T, '12.0 V') && has(T, '2.00 A') && has(T, '0.104 A') && has(T, '24.0 W'));
  t('  and 10 MW at 20 kV loses 2.50 MW in a 10 Ω line', has(T, '2.50 MW'));

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌ ' + fail + ' FAILED' : '✅ MAGNETISM: EVERY NUMBER AND DIRECTION IS THE PHYSICS'} (${checks - fail}/${checks})`);
  process.exit(fail ? 1 : 0);
})();
