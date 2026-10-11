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

  console.log('\n1b) the learning experience: misconceptions, hints that guide, keys not given away');
  const LX = await p.evaluate(() => {
    const div = document.createElement('div'); div.style.cssText = 'position:absolute;left:0;top:0;width:2000px'; document.body.appendChild(div);
    const txt = h => { div.innerHTML = String(h || ''); return div.innerText.replace(/\s+/g, ' ').trim(); };
    const r = { mis: [], hint: [], long: [], nudge: [], q: 0, longest: 0, consp: [] };
    for (const ch of MAG_CHAPTERS) for (const se of ch.sections) { const k = ch.id + '.' + se.id, C = MAG_CONTENT[k];
      if (!/mis-block/.test(C.theory.html)) r.mis.push(k);
      C.problem.steps.forEach((s, i) => { const h = txt(s.hint);
        if ((h.match(/[א-ת]+/g) || []).length < 3) r.hint.push(k + '#' + (i + 1));
        if (h.length >= txt(s.explain).length) r.long.push(k + '#' + (i + 1));
        if (s.nudge && /=/.test(txt(s.nudge))) r.nudge.push(k + '#' + (i + 1)); });
      C.quiz.forEach((q, i) => { r.q++; const L = q.opts.map(o => txt(o).length), key = L[q.correct], next = Math.max(...L.filter((_, j) => j !== q.correct));
        if (key > next) { r.longest++; if (key > 1.3 * next) r.consp.push(k + '#' + (i + 1)); } }); }
    div.remove(); return r; });
  t('every section has a misconception box', LX.mis.length === 0, LX.mis.join(' '));
  t('every problem hint opens with a Hebrew sentence', LX.hint.length === 0, LX.hint.join(' '));
  t('every hint is shorter than its explanation', LX.long.length === 0, LX.long.join(' '));
  t('no nudge hands over a formula', LX.nudge.length === 0, LX.nudge.join(' '));
  t('the quiz key is the longest option in at most 30 % of questions', LX.longest <= 0.3 * LX.q, LX.longest + '/' + LX.q);
  t('and never conspicuously (more than 1.3× the next option)', LX.consp.length === 0, LX.consp.join(' '));

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
  // The ring is stepped once per animation frame, and on a busy machine a
  // frame can be 40 ms long: then one frame's readout and caption could
  // disagree, and this check failed now and then (seen at load 8.8). Here
  // the sim runs on a clock of exactly 1/60 s per frame, the rate it is
  // built for, and EVERY frame of the push and the return is checked --
  // the same assertion, on all frames instead of a sample, whatever the load.
  await open('mag-induction', 'mag-lenz');
  const lz = await p.evaluate(async () => {
    const real = window.requestAnimationFrame, q = [];
    let T = performance.now() + 1000;
    window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
    // the frame already asked of the browser runs once more and hands over
    for (let i = 0; i < 40 && !q.length; i++) await new Promise(r => setTimeout(r, 25));
    const tick = () => { const cbs = q.splice(0); T += 1000 / 60; window.__txt = []; cbs.forEach(c => c(T)); return window.__txt.slice(); };
    for (let i = 0; i < 6; i++) tick();
    document.getElementById('btn-mgn-push').click();
    const frames = [];
    for (let i = 0; i < 90; i++) frames.push(tick());   // 1.5 s: in, back out, at rest
    window.requestAnimationFrame = real; q.splice(0).forEach(c => real(c));
    return frames;
  });
  let fa = [], fr = [];
  for (const fm of lz) for (const [f, c] of pairs(fm, /F = (-?[\d.]+) mN/)) {
    if (c.includes('מתקרב') && f) fa.push(f); if (c.includes('מתרחק') && f) fr.push(f); }
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

  console.log('\n4) the bar magnet behind the coil and the ring');
  // a bar magnet is a line of dipoles: its flux through a loop is the sum of
  // theirs (exact, from ∮A·dl), however close the loop is to a pole
  const BF = await p.evaluate(() => {
    const m = 6, l = 0.07, a = 0.02, N = 2000, F0 = magBarFlux(m, l, a, 0);
    const sup = z => { let s = 0; for (let k = 0; k < N; k++) s += magDipFlux(m / N, a, z - (-l / 2 + (k + 0.5) * l / N)); return s; };
    const zs = [0, 0.012, 0.035, 0.05, 0.12, -0.03];
    const errS = Math.max(...zs.map(z => Math.abs(sup(z) - magBarFlux(m, l, a, z)) / F0));
    const DM = magBarFluxDmax(m, l, a);
    const errD = Math.max(...zs.map(z => { const h = 1e-6; return Math.abs((magBarFlux(m, l, a, z + h) - magBarFlux(m, l, a, z - h)) / (2 * h) - magBarFluxD(m, l, a, z)) / DM; }));
    let zm = 0, dm = 0; for (let z = 0; z < 0.2; z += 1e-4) { const d = Math.abs(magBarFluxD(m, l, a, z)); if (d > dm) { dm = d; zm = z; } }
    return { errS, errD, far: magBarFlux(m, l, a, 1) / magDipFlux(m, a, 1), zm, l, a,
      sym: Math.abs(magBarFlux(m, l, a, 0.03) - magBarFlux(m, l, a, -0.03)) / F0 };
  });
  t('bar flux = the sum of the fluxes of the dipoles it is made of (6 positions, through the poles)', BF.errS < 1e-5, BF.errS.toExponential(1));
  t('  its derivative is the slope of the flux', BF.errD < 1e-4, BF.errD.toExponential(1));
  t('  far away it is the point dipole\'s flux', near(BF.far, 1, 0.01), BF.far.toFixed(4));
  t('  the same on both sides of the magnet', BF.sym < 1e-12, BF.sym);
  t('  the EMF peaks as a POLE crosses the loop, not the centre', Math.abs(BF.zm - BF.l / 2) < 0.25 * BF.a, (BF.zm * 100).toFixed(2) + ' cm');

  // the coil's induced pole: N toward an approaching pole (repel), S toward a
  // receding one (attract) — on whichever side of the coil the magnet is
  await open('mag-induction', 'mag-faraday');
  await p.evaluate(() => { window.__face = []; const o = window.__oST = window.simText; window.simText = function (c, s, x, ...r) {
    if (c.canvas.id === 'sim-canvas') { if (s === 'N' || s === 'S') window.__face.push(['f', s, x]);
      else if (/^מתקרב|^מתרחק/.test(s)) window.__face.push(['c', s.startsWith('מתקרב')]); }
    return o.call(this, c, s, x, ...r); }; });
  await click('btn-mgy-auto'); await p.waitForTimeout(3500);
  const FC = await p.evaluate(() => { const W = document.getElementById('sim-canvas').offsetWidth, X0 = W * 0.05 + 0.36 * W * 0.9 / 0.6;
    const out = { rep: 0, att: 0, bad: 0, far: 0 }, L = window.__face;
    for (let i = 0; i + 1 < L.length; i++) if (L[i][0] === 'f' && L[i + 1][0] === 'c') {
      const side = L[i][2] > X0 ? 1 : -1, facing = side < 0 ? 'N' : 'S', app = L[i + 1][1];   // N is the magnet's right end
      if (side > 0) out.far++;
      if (app ? L[i][1] === facing : L[i][1] !== facing) app ? out.rep++ : out.att++; else out.bad++; }
    window.simText = window.__oST; return out; });
  t('Faraday coil: faces N to an approaching N and S to a receding one, from either side', FC.rep > 5 && FC.att > 5 && FC.bad === 0 && FC.far > 3, JSON.stringify(FC));

  // the theory animations: what the lesson says, in the picture
  const anim = async (sec, id, ts) => p.evaluate(async ([sec, id, ts]) => {
    const ch = MAG_CHAPTERS.find(c => c.sections.some(x => x.id === sec)).id;
    state.subject = 'magnetism'; state.chapter = ch; state.section = sec; state.tab = 'theory'; render();
    await new Promise(r => setTimeout(r, 150));
    const s = _anim[id]; s.paused = true; const rec = { arrow: [], label: [], dot: [] };
    const oa = window.arrow, ol = window.label, od = window.magDot;
    window.arrow = function (c, x1, y1, x2, y2, col) { rec.arrow.push([x1, y1, x2, y2, col]); return oa.apply(this, arguments); };
    window.label = function (c, tx, x, y, col) { rec.label.push([tx, x, y, col]); return ol.apply(this, arguments); };
    window.magDot = function (c, x, y, r, out) { rec.dot.push([x, y, out]); return od.apply(this, arguments); };
    const res = ts.map(T => { rec.arrow = []; rec.label = []; rec.dot = []; s.fn(s.cv, s.ctx, s.W, s.H, T); return JSON.parse(JSON.stringify(rec)); });
    window.arrow = oa; window.label = ol; window.magDot = od; return res;
  }, [sec, id, ts]);
  const [LZ] = await anim('mag-lenz', 'anim-mag-lenz', [2]);
  const ring = LZ.arrow.filter(a => a[4] === '#fbbf24' && Math.abs(a[1] - a[3]) < 1e-6).sort((u, v) => u[1] - v[1]);
  const Fup = LZ.arrow.find(a => a[4] === '#fb923c');
  t('Lenz animation: ring above the falling magnet circulates counter-clockwise seen from above (near edge →)', ring.length === 2 && ring[0][2] > ring[0][0], ring.map(a => (a[2] - a[0]).toFixed(0)).join(','));
  t('  the ring below it clockwise (near edge ←): both push the magnet up', ring.length === 2 && ring[1][2] < ring[1][0] && Fup && Fup[3] < Fup[1]);
  const [FA, FR] = await anim('mag-faraday', 'anim-mag-faraday', [0.95, 3.25]);
  const fdesc = r => { const g = r.arrow.find(a => a[4] === '#34d399'), dots = r.dot.filter(d => Math.abs(d[0] - r.dot[0][0]) < 1).sort((u, v) => u[1] - v[1]);
    return { face: (r.label.find(l => l[0] === 'N' || l[0] === 'S') || [])[0], left: g && g[2] < g[0], topOut: dots.length ? dots[0][2] : null }; };
  const fdA = fdesc(FA), fdR = fdesc(FR);
  t('Faraday animation, magnet in: coil face N, induced B toward the magnet, ⊗ on top', fdA.face === 'N' && fdA.left === true && fdA.topOut === false, JSON.stringify(fdA));
  t('  magnet out: face S, induced B away from it, ⊙ on top', fdR.face === 'S' && fdR.left === false && fdR.topOut === true, JSON.stringify(fdR));
  // a field line may close on itself or leave the picture, but never end in it
  const ML = await p.evaluate(() => { const T = []; for (let k = 0; k < 9; k++) T.push(-54 + (k + 0.5) * 12);
    const L = _magLoopLines('bar-test', T, 11, 1, 822, 822, 4, 2600); let closed = 0, inside = 0, back = 0;
    const out = q => Math.max(Math.abs(q[0]), Math.abs(q[1])) > 411 - 1;
    for (const l of L) { const a = l[0], z = l[l.length - 1]; if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 3 || (out(a) && out(z))) closed++;
      for (let i = 1; i < l.length; i++) if (Math.abs(l[i][0]) < 40 && Math.abs(l[i][1]) < 10) { inside++; if (l[i][0] < l[i - 1][0]) back++; } }
    return { n: L.length, closed, inside, back }; });
  t('magnets animation: every field line closes through the bar or leaves the picture — none ends in mid-air', ML.closed === ML.n, ML.closed + '/' + ML.n);
  t('  and run inside the magnet from S to N', ML.inside > 100 && ML.back === 0, ML.inside + ' steps, ' + ML.back + ' backwards');

  console.log('\n5) directions and limits in the reworked simulations');
  await open('mag-force', 'mag-motor'); await p.waitForTimeout(1500); await read(10);
  const TH = (await read(900)).map(s => s.match(/^θ = (\d+)°/)).filter(Boolean).map(m => +m[1]);
  let dec = 0, inc = 0, flips = 0;
  for (let i = 1; i < TH.length; i++) { const d = TH[i] - TH[i - 1]; if (d > 100) { if (TH[i - 1] < 40 && TH[i] > 140) flips++; else inc += 10; } else if (d < 0) dec++; else if (d > 1) inc++; }
  t('motor: n̂ follows the current (right-hand rule), so θ falls toward 0 as the coil turns…', dec > 10 && inc === 0, `${dec} falling, ${inc} rising`);
  t('  …and jumps back to 180° when the commutator reverses the current', flips >= 1, flips + ' flips');
  await open('mag-force', 'mag-lorentz'); await click('btn-mgz-mode'); await click('btn-mgz-Bdir'); T = await read();
  t('Lorentz, B reversed to −x, v at 60°: θ from B is 240° and the force on + comes OUT of the page', has(T, 'θ = 240°') && has(T, 'יוצא מהדף'));
  await open('mag-force', 'mag-wireforce');
  await slide('mgf-I', 10); await slide('mgf-B', 1); await slide('mgf-L', 0.3); await slide('mgf-m', 5); await p.waitForTimeout(2500);
  const WF = (await read(800)).filter(s => /^F = BIL/.test(s));
  t('current balance, F/mg ≈ 61: the wire rests on the pole face, F stays 3.000 N (no flicker)', WF.length > 10 && WF.every(s => s.includes('3.000 N')) && has(await read(), 'נעצר על פני הקוטב'), WF.length + ' frames');
  await open('mag-induction', 'mag-transformer'); await slide('mgt-VL', 5); T = await read();
  t('transformer: the line voltage stops at 20 kV, where 25 % is lost (never 100 %)', has(T, '2.50 MW') && has(T, '25.0%'));

  console.log('\n6) every quiz and problem through the UI, and the classic wrong answers rejected');
  // rounding of the true value to 2 and 3 significant figures must pass; these
  // misconceptions must not: sin↔cos, 1/r², tan inverted, radius for diameter,
  // ε_max/2 for the rms value, the inverted current ratio, forgetting N
  const WRONG = { 'mag-field.mag-magnets': { 1: 56.3 }, 'mag-field.mag-wire': { 1: 25 }, 'mag-field.mag-loop': { 0: 0.0251 },
    'mag-force.mag-lorentz': { 2: 1.39 }, 'mag-force.mag-spectro': { 3: 4.15 }, 'mag-force.mag-wireforce': { 1: 0.346 },
    'mag-force.mag-motor': { 1: 0.026 }, 'mag-induction.mag-flux': { 1: 8.66 }, 'mag-induction.mag-generator': { 2: 157 },
    'mag-induction.mag-transformer': { 2: 38.3 }, 'mag-induction.mag-faraday': { 0: 0.05 } };
  const UI = await p.evaluate(async ([EXP, WRONG]) => {
    const sf = (x, n) => +x.toPrecision(n), out = { quiz: 0, quizBad: [], ok: 0, bad: [] }, wait = ms => new Promise(r => setTimeout(r, ms));
    for (const ch of MAG_CHAPTERS) for (const se of ch.sections) {
      const key = ch.id + '.' + se.id, c = CONTENT[key];
      state.subject = 'magnetism'; state.chapter = ch.id; state.section = se.id; state.quizState = {}; state.tab = 'quiz'; render(); await wait(40);
      for (let qi = 0; qi < c.quiz.length; qi++) { out.quiz++; const opts = document.querySelectorAll('#app .quiz-opt'); const qs = getQS(ch.id, se.id);
        if (opts.length !== 4) { out.quizBad.push(key + '#' + qi + ' opts'); continue; }
        opts[quizView(c.quiz[qi]).correct].click(); await wait(20); if (qs.ans[qi] !== c.quiz[qi].correct) out.quizBad.push(key + '#' + qi);
        if (qi < c.quiz.length - 1) nextQ(); else finishQuiz(); await wait(20); }
      markCompleted(ch.id, se.id, 'quiz', 0); state.problemState = {}; state.tab = 'problem'; render(); await wait(40);
      const try1 = (si, v) => { upInp(si, String(v)); chkStep(si); return getPS(ch.id, se.id).feedback[si] === 'correct'; };
      c.problem.steps.forEach((st, si) => { const e = EXP[key][si], w = (WRONG[key] || {})[si];
        if (w !== undefined && try1(si, w)) out.bad.push(key + '#' + si + ' accepts wrong ' + w);
        for (const v of [sf(e, 2), sf(e, 3), st.answer]) if (!try1(si, v)) out.bad.push(key + '#' + si + ' rejects ' + v);
        out.ok++; });
    }
    return out; }, [EXPECT, WRONG]);
  t(UI.quiz + ' quiz items: the marked option scores', UI.quizBad.length === 0, UI.quizBad.slice(0, 4).join(' '));
  t(UI.ok + ' problem steps: 2- and 3-figure roundings pass, ' + Object.keys(WRONG).length + ' classic mistakes fail', UI.bad.length === 0, UI.bad.slice(0, 4).join(' | '));

  console.log('\n7) every animation and every simulation at its limits');
  const AN = await p.evaluate(async () => { const bad = [];
    for (const ch of MAG_CHAPTERS) for (const se of ch.sections) {
      state.subject = 'magnetism'; state.chapter = ch.id; state.section = se.id; state.tab = 'theory'; render();
      for (let k = 0; k < 30 && [...document.querySelectorAll('canvas[id^="anim-"]')].some(c => !_anim[c.id] || !_anim[c.id].ctx); k++) await new Promise(r => setTimeout(r, 50));
      for (const cv of document.querySelectorAll('canvas[id^="anim-"]')) { const s = _anim[cv.id]; if (!s) { bad.push(cv.id + ' never started'); continue; } s.paused = true;
        const g = cv.getContext('2d'), seen = [], of = g.fillText; g.fillText = function (x) { seen.push(String(x)); return of.apply(this, arguments); };
        for (const T of [0.3, 1.7, 3.3, 5.1, 7.9, 11.6]) { s.fn(s.cv, s.ctx, s.W, s.H, T);
          const d = g.getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 240) lit++;
          if (lit < 20) bad.push(cv.id + ' blank at t=' + T); }
        g.fillText = of; if (seen.some(x => /NaN|Infinity|undefined/.test(x))) bad.push(cv.id + ': ' + seen.find(x => /NaN|Infinity|undefined/.test(x))); } }
    return bad; });
  t('16 animations draw something at six moments, with no NaN or Infinity', AN.length === 0, AN.slice(0, 4).join(' | '));
  const LIM = [];
  for (const ch of await p.evaluate(() => MAG_CHAPTERS.map(c => [c.id, c.sections.map(s => s.id)]))) for (const se of ch[1]) {
    await open(ch[0], se);
    const ids = await p.evaluate(() => [...document.querySelectorAll('#app input[type=range]')].map(e => [e.id.slice(4), +e.min, +e.max]));
    for (const ends of [1, 2]) { for (const [id, lo, hi] of ids) await slide(id, ends === 1 ? lo : hi);
      const btns = await p.evaluate(() => [...document.querySelectorAll('#app button[id^="btn-mg"]')].map(e => e.id));
      for (const bid of btns) { await click(bid); await p.waitForTimeout(60); }
      await p.waitForTimeout(500); const tx = await read(200);
      const badTx = tx.find(s => /NaN|Infinity|undefined/.test(s)); if (badTx) LIM.push(se + (ends === 1 ? ' min: ' : ' max: ') + badTx); }
  }
  t('every slider at both ends, every button pressed: no NaN, Infinity or undefined on any canvas', LIM.length === 0, LIM.slice(0, 4).join(' | '));

  console.log('\n8) every draggable simulation by touch, on a phone');
  const tc = await b.newContext({ viewport: { width: 390, height: 1300 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const q = await tc.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(() => { window.__T = []; const o = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s) { if (typeof s === 'string' && this.canvas.id === 'sim-canvas') window.__T.push(s.replace(/[⁦-⁩]/g, ''));
      if (window.__T.length > 4000) window.__T.splice(0, 2000); return o.apply(this, arguments); }; });
  await q.goto(F); await q.waitForTimeout(700);
  const cdp = await tc.newCDPSession(q);
  const topen = async (c, s) => { await q.evaluate(([c, s]) => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {};
    state.subject = 'magnetism'; state.chapter = c; state.section = s; state.tab = 'sim'; render(); }, [c, s]);
    await q.waitForTimeout(700); await (await q.$('#sim-canvas')).scrollIntoViewIfNeeded(); await q.waitForTimeout(200);
    return q.evaluate(() => { const r = document.getElementById('sim-canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; }); };
  const tlast = re => q.evaluate(r => { const R = new RegExp(r), a = window.__T.filter(s => R.test(s)); return a.length ? a[a.length - 1] : null; }, re);
  const swipe = async (r, pts, re) => { const P = z => ({ x: r.x + z[0], y: r.y + z[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
    for (let i = 1; i < pts.length; i++) { await q.waitForTimeout(50); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] }); }
    await q.waitForTimeout(120); const held = await tlast(re);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(150); return held; };
  // where each sim's handle starts, from its own layout (W = canvas width)
  const TOUCH = [
    ['mag-field', 'mag-magnets', W => [[W / 2, 206.8 - 0.15 * W], [W / 2 + 40, 266.8 - 0.15 * W]], '^\\|B\\| במצפן'],
    ['mag-field', 'mag-wire', W => [[W / 2, 144 - 0.15 * W], [W / 2 + 30, 154 - 0.15 * W], [W / 2 + 50, 144]], '^בגשש: B'],
    ['mag-field', 'mag-loop', W => [[W / 2 + 20, 155], [W / 2 + 50, 155], [W / 2 + 80, 155]], '^בגשש \\(x'],
    ['mag-field', 'mag-solenoid', W => [[W * 0.6, 140], [W * 0.7, 150]], '^בגשש:'],
    ['mag-force', 'mag-lorentz', W => [[W * 0.8, 120], [W * 0.85, 100]], '^r = mv/qB'],
    ['mag-force', 'mag-parallel', W => [[W / 2 + 40, 170], [W / 2 + 70, 170], [W / 2 + 90, 170]], '^F/L'],
    ['mag-force', 'mag-motor', W => [[W * 0.36 + 30, 163], [W * 0.36, 128], [W * 0.36 - 30, 153]], '^θ = '],
    ['mag-induction', 'mag-flux', W => [[W * 0.3, 150], [W * 0.3, 180], [W * 0.3, 210]], '^θ = '],
    ['mag-induction', 'mag-faraday', W => [[0.2 * W, 114], [W * 0.4, 114], [W * 0.5, 114]], '^NΦ ='],
    ['mag-induction', 'mag-lenz', W => [[W * 0.316, 221], [W * 0.4, 221], [W * 0.5, 221]], '^I = '],
    ['mag-induction', 'mag-motional', W => [[174, 130], [200, 130], [230, 130]], '^ε = BLv'],
  ];
  const deaf = [];
  for (const [c, s, pf, re] of TOUCH) { const r = await topen(c, s), before = await tlast(re), held = await swipe(r, pf(r.w), re);
    if (!before || held === before) deaf.push(s + ': ' + before + ' → ' + held); }
  t(TOUCH.length + ' simulations follow a finger (touch start, move, end)', deaf.length === 0, deaf.join(' | '));
  await tc.close();

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌ ' + fail + ' FAILED' : '✅ MAGNETISM: EVERY NUMBER AND DIRECTION IS THE PHYSICS'} (${checks - fail}/${checks})`);
  process.exit(fail ? 1 : 0);
})();
