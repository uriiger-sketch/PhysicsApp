// Magnetism: is every number, every direction and every simulation readout
// the physics? Answers are recomputed here independently of the content; the
// simulations are read through the text they draw (fillText is recorded), so
// their live readouts are checked against the formulas they claim to show.
//
//   node tests/check_mag.js
const { chromium } = require('playwright');
const path = require('path');
const { L, LR, WORDS } = require('./_lang.js');   // the words of the page's language
// the induction captions of the coil, approaching and receding
const APPR = [L('מתקרב: השטף גדל — הסליל דוחה')];
const RECD = [L('מתרחק: השטף קטן — הסליל מושך')];
const isAppr = (c) => APPR.some((a) => c.includes(a)), isRecd = (c) => RECD.some((a) => c.includes(a));
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

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
  const LX = await p.evaluate((WSRC) => { const WORDS = new RegExp(WSRC, 'g');   // words of the page's language
    const div = document.createElement('div'); div.style.cssText = 'position:absolute;left:0;top:0;width:2000px'; document.body.appendChild(div);
    const txt = h => { div.innerHTML = String(h || ''); return div.innerText.replace(/\s+/g, ' ').trim(); };
    const r = { mis: [], hint: [], long: [], nudge: [], q: 0, longest: 0, consp: [] };
    for (const ch of MAG_CHAPTERS) for (const se of ch.sections) { const k = ch.id + '.' + se.id, C = MAG_CONTENT[k];
      if (!/mis-block/.test(C.theory.html)) r.mis.push(k);
      C.problem.steps.forEach((s, i) => { const h = txt(s.hint);
        if ((h.match(WORDS) || []).length < 3) r.hint.push(k + '#' + (i + 1));
        if (h.length >= txt(s.explain).length) r.long.push(k + '#' + (i + 1));
        if (s.nudge && /=/.test(txt(s.nudge))) r.nudge.push(k + '#' + (i + 1)); });
      C.quiz.forEach((q, i) => { r.q++; const L = q.opts.map(o => txt(o).length), key = L[q.correct], next = Math.max(...L.filter((_, j) => j !== q.correct));
        if (key > next) { r.longest++; if (key > 1.3 * next && key - next >= 3) r.consp.push(k + '#' + (i + 1)); } }); }
    div.remove(); return r; }, WORDS.source);
  t('every section has a misconception box', LX.mis.length === 0, LX.mis.join(' '));
  t('every problem hint opens with a Hebrew sentence', LX.hint.length === 0, LX.hint.join(' '));
  t('every hint is shorter than its explanation', LX.long.length === 0, LX.long.join(' '));
  t('no nudge hands over a formula', LX.nudge.length === 0, LX.nudge.join(' '));
  t('the quiz key is the longest option in at most 30 % of questions', LX.longest <= 0.3 * LX.q, LX.longest + '/' + LX.q);
  t('and never conspicuously (more than 1.3× and 3+ characters longer than the next option)', LX.consp.length === 0, LX.consp.join(' '));

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
  // what the canvas drew in the next ms milliseconds — and, on a loaded machine
  // whose frames stall, until at least one whole frame has been drawn
  const read = async (ms = 120) => { await p.evaluate(() => { window.__txt = []; }); await p.waitForTimeout(ms);
    for (let k = 0; k < 40 && !(await p.evaluate(() => window.__txt.length)); k++) await p.waitForTimeout(25);
    return p.evaluate(() => window.__txt.slice()); };
  const num = (arr, re) => { for (const s of arr.slice().reverse()) { const m = s.match(re); if (m) return parseFloat(m[1].replace('−', '-')); } return NaN; };
  const has = (arr, sub) => arr.some(s => s.includes(sub));
  const click = id => p.evaluate(i => document.getElementById(i).click(), id);
  const slide = (id, v) => p.evaluate(([i, x]) => simSyncSlider(i, x, 3), [id, v]);

  console.log('\n3) simulation readouts and directions');
  // the bar magnet: the field the compass reads is the field of the bar's two
  // poles (m = 1 A·m², 8 cm), worked out here; then the magnet is cut in two
  const MGQ = 1 / 0.08, mgB = (x, y, poles, earth) => { let bx = 0, by = earth ? 30e-6 : 0;
    for (const [px, q] of poles) { const dx = x - px, dy = y, r3 = Math.pow(dx * dx + dy * dy, 1.5); bx += 1e-7 * q * dx / r3; by += 1e-7 * q * dy / r3; }
    return [bx, by]; };
  const BAR = [[0.04, MGQ], [-0.04, -MGQ]];
  await open('mag-field', 'mag-magnets');
  const mgPut = (x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('sim-canvas'), R = cv.getBoundingClientRect(), W = cv.offsetWidth, s = W / 0.6, Hc = 470 * 0.44;
    const ev = (t) => cv.dispatchEvent(new MouseEvent(t, { clientX: R.left + W / 2 + x * s, clientY: R.top + Hc - y * s, bubbles: true, cancelable: true }));
    ev('mousedown'); ev('mouseup'); }, [x, y]);
  const mgRead = async () => { const T2 = await read(); const m = await p.evaluate(() => (document.querySelector('.sk-model-tx') || {}).textContent || '');
    const d = m.match(/(\d+)°/); return { B: num(T2, /B\| [^=]*= ([\d.]+) μT/), dir: d ? +d[1] : NaN, T: T2, m }; };
  await mgPut(0, 0.10); let mr = await mgRead(), mB = mgB(0, 0.10, BAR);
  t('magnets: on the perpendicular bisector the field points back along the bar (180°), |B| from its two poles', mr.dir === 180 && near(mr.B, Math.hypot(...mB) * 1e6, 0.03 * Math.hypot(...mB) * 1e6), mr.B + ' μT at ' + mr.dir + '° vs ' + (Math.hypot(...mB) * 1e6).toFixed(1));
  await mgPut(-0.07, 0); mr = await mgRead();
  const mgDone = i => p.evaluate(i => document.querySelectorAll('.sk-m')[i].classList.contains('done'), i);
  t('  on the axis beyond S the field points INTO S (0° ± 3°, toward the magnet): the needle\'s N end points at the S pole', (mr.dir <= 3 || mr.dir >= 357) && await mgDone(1), mr.dir + '°');
  const mgBars = () => p.evaluate(async () => { const cv = document.getElementById('sim-canvas'), o = window.magBar, b = [];
    window.magBar = function (c, x, y, len, th, ang) { if (c.canvas === cv) b.push([Math.round(len), ang || 0]); return o.apply(this, arguments); };
    await new Promise(r => setTimeout(r, 150)); window.magBar = o; return b.slice(-4); });
  const mb0 = await mgBars();
  const mAsk = await p.evaluate(() => { document.getElementById('btn-mgm-cut').click(); const o = document.querySelectorAll('.sk-predict .sk-opt'); if (o.length) o[1].click(); return o.length; });
  const mb1 = await mgBars();
  t('  cut (predicted first): two magnets of half the length, each with its N to the right — no lone pole', mAsk === 3 && mb1.length >= 2 && mb1.slice(-2).every(b => b[1] === 0 && Math.abs(b[0] - mb0[mb0.length - 1][0] / 2) <= 1) && await mgDone(0), JSON.stringify([mb0.slice(-1), mb1.slice(-2)]));
  await click('btn-mgm-cut'); await click('btn-mgm-earth');
  // the neutral point with Earth's 30 μT (north = up): searched here on a grid, then the compass put there
  let nb = [1, 0, 0]; for (let x = -0.2; x <= 0.2; x += 0.002) for (let y = 0.03; y <= 0.14; y += 0.002) { const b = mgB(x, y, BAR, true), n = Math.hypot(...b); if (n < nb[0]) nb = [n, x, y]; }
  await mgPut(nb[1], nb[2]); mr = await mgRead();
  t('  with Earth\'s field: a neutral point at (' + (nb[1] * 100).toFixed(1) + ', ' + (nb[2] * 100).toFixed(1) + ') cm — |B| < 2 μT, the warning, the mission', mr.B < 2 && mr.T.some(x => x.includes(L('⚠ נקודה ניטרלית — השדות מבטלים זה את זה, והמחט אינה מתכוונת'))) && await mgDone(2), mr.B + ' μT');
  await open('mag-field', 'mag-wire'); let T = await read();
  t('wire: B at the probe = μ₀I/2πr (20 A, 4.5 cm)', near(num(T, /B = ([\d.]+) μT/), 2e-7 * 20 / 0.045 * 1e6, 0.2), num(T, /B = ([\d.]+) μT/));
  const wmodel = () => p.evaluate(() => { const e = document.querySelector('.sk-model-tx'); return e ? e.textContent : ''; });
  let WM = await wmodel();
  t('  the model line: B = μ₀I/2πr = (4π×10⁻⁷ × 20)/(2π × 0.045) = 88.9 μT', WM.includes('B = μ₀I/2πr = (4π×10⁻⁷ × 20)/(2π × 0.045) = 88.9 μT'), WM);
  // reversing the current (a prediction first) turns the probe's field arrow round
  const wArrow = () => p.evaluate(async () => { const cv = document.getElementById('sim-canvas'), o = window.simArrow; let a = null;
    window.simArrow = function (c, x1, y1, x2, y2, col) { if (c.canvas === cv && col === '#34d399') a = [x2 - x1, y2 - y1]; return o.apply(this, arguments); };
    await new Promise(r => setTimeout(r, 150)); window.simArrow = o; return a; });
  const wa0 = await wArrow();
  const wAsk = await p.evaluate(() => { document.getElementById('btn-mgw-dir').click(); const o = document.querySelectorAll('.sk-predict .sk-opt'); if (o.length) o[1].click(); return o.length; });
  const wa1 = await wArrow();
  t('  current reversed (predicted first): the field at the probe turns round — up for ⊙ east of the wire, down for ⊗', wAsk === 3 && wa0[1] < -5 && wa1[1] > 5 && Math.abs(wa0[0]) < 2, JSON.stringify([wa0, wa1]));
  await click('btn-mgw-dir');
  // two wires with currents the same way (20 A, at −4 and +7 cm): the fields cancel half-way, at 1.5 cm
  await click('btn-mgw-two'); await slide('mgw-I2', 20);
  await p.evaluate(() => { const cv = document.getElementById('sim-canvas'), R = cv.getBoundingClientRect(), W = cv.offsetWidth, s = W / 0.30, cy = 480 * 0.6 * 0.5;
    const ev = (t, x, y) => cv.dispatchEvent(new MouseEvent(t, { clientX: R.left + x, clientY: R.top + y, bubbles: true, cancelable: true }));
    ev('mousedown', W / 2 + 0.015 * s, cy - 0.02 * s); ev('mousemove', W / 2 + 0.015 * s, cy); ev('mouseup', W / 2 + 0.015 * s, cy); });
  T = await read(); WM = await wmodel();
  const wmd = await p.evaluate(() => document.querySelectorAll('.sk-m')[2].classList.contains('done'));
  const wB = WM.match(/B₁ = ([\d.]+) μT.*B₂ = ([\d.]+) μT/);
  t('  two currents the same way: the null point half-way between them (B ≈ 0, B₁ = B₂ = 72.7 μT in the model line), its mission done', near(num(T, /B = ([\d.]+) μT/), 0, 0.2) && wB && near(+wB[1], 72.7, 0.3) && near(+wB[1], +wB[2], 0.2) && wmd, num(T, /B = ([\d.]+) μT/) + ' | ' + WM.slice(0, 70));
  await click('btn-mgw-two');
  // the right-hand-rule challenge: the current and the point read off the picture,
  // B ∝ I ẑ × r̂ worked out here, and the chip in that direction tapped
  const WH = await p.evaluate(async () => { const cv = document.getElementById('sim-canvas'), wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const CH = [[0, 1], [0, -1], [-1, 0], [1, 0]];
    for (let k = 0; k < 5; k++) {
      document.getElementById('btn-mgw-rhr').click(); if (k > 0) document.getElementById('btn-mgw-rhr').click();
      const rec = { wire: null, q: null, chips: [], fb: null };
      const oD = window.magDot, oT = window.simText, oArc = CanvasRenderingContext2D.prototype.arc;
      window.magDot = function (c, x, y, r, o) { if (c.canvas === cv && r === 14) rec.wire = [x, y, o ? 1 : -1]; return oD.apply(this, arguments); };
      window.simText = function (c, s, x, y) { if (c.canvas === cv && s === '?') rec.q = [x, y]; return oT.apply(this, arguments); };
      CanvasRenderingContext2D.prototype.arc = function (x, y, r) { if (this.canvas === cv && r === 24) rec.chips.push([x, y]); return oArc.apply(this, arguments); };
      await wait(60); for (let w = 0; w < 30 && !(rec.wire && rec.q && rec.chips.length >= 4); w++) await wait(50); window.magDot = oD; window.simText = oT; CanvasRenderingContext2D.prototype.arc = oArc;
      const dx = rec.q[0] - rec.wire[0], dy = -(rec.q[1] - 5 - rec.wire[1]), L = Math.hypot(dx, dy), rx = Math.round(dx / L), ry = Math.round(dy / L);
      const B = [-rec.wire[2] * ry, rec.wire[2] * rx];
      let ans = CH.findIndex(c => c + '' === B + ''); if (k === 4) ans = (ans + 2) % 4;
      const chip = rec.chips.slice(-4)[ans], R = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: R.left + chip[0], clientY: R.top + chip[1], bubbles: true, cancelable: true }));
      cv.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      const o2 = window.simText; window.simText = function (c, s) { if (c.canvas === cv && /^[✓✗]/.test(s)) rec.fb = s; return o2.apply(this, arguments); };
      for (let w = 0; w < 30 && !rec.fb; w++) await wait(50); window.simText = o2; out.push({ B: B.join(','), fb: rec.fb });
    }
    return { out, done: document.querySelectorAll('.sk-m')[0].classList.contains('done') }; });
  const wOk = WH.out.slice(0, 4).every((r, i) => r.fb && r.fb.startsWith('✓') && r.fb.endsWith(String(i + 1))) && WH.out[4].fb && WH.out[4].fb.startsWith('✗');
  t('  right-hand-rule challenge: the compass the sim expects is B ∝ I ẑ × r̂ (4 dealt), a wrong tap resets the streak', wOk && WH.done, WH.out.map(r => r.B + ':' + (r.fb || '').slice(0, 12)).join(' | '));
  await open('mag-field', 'mag-loop'); T = await read();
  t('loop: centre field = μ₀NI/2R (1.26 mT)', has(T, '1.26 mT'));
  await open('mag-field', 'mag-solenoid'); await p.waitForTimeout(400); T = await read();
  t('solenoid: μ₀nI = 0.38 mT and the centre is 94% of it', has(T, '0.38 mT') && has(T, '94%'));
  await open('mag-force', 'mag-lorentz'); T = await read();
  const kmodel = () => p.evaluate(() => { const e = document.querySelector('.sk-model-tx'); return e ? e.textContent : ''; });
  let LM = await kmodel();
  t('Lorentz: F = qvB = 1.60×10⁻¹³ N (model line), r = mv/qB = 4.2 cm, T = 2πm/qB = 131 ns', LM.includes('F = qvB = 1.60×10⁻¹³ N') && has(T, 'r = mv/qB = 4.2 cm') && has(T, 'T = 2πm/qB = 131 ns'), LM.slice(0, 40));
  // launch (after the prediction) and follow the charge: a circle of radius
  // mv/qB = 4.175 cm (69.9 px at 1675 px/m), counter-clockwise for + in B into
  // the page, clockwise for −, and the speedometer reading the same throughout
  const orbit = () => p.evaluate(async () => { const cv = document.getElementById('sim-canvas'), pts = [], sp = new Set();
    const oC = window.simCircle, oT = window.simText;
    window.simCircle = function (c, x, y, r, f) { if (c.canvas === cv && r === 10) pts.push([x, y]); return oC.apply(this, arguments); };
    window.simText = function (c, s) { if (c.canvas === cv && /^\|v\| = /.test(s)) sp.add(s); return oT.apply(this, arguments); };
    document.getElementById('btn-mgz-go').click();
    const o = document.querySelectorAll('.sk-predict .sk-opt'); if (o.length && !o[0].disabled) o[2].click();
    await new Promise(r => setTimeout(r, 2600)); window.simCircle = oC; window.simText = oT;
    // the circle through three points far apart, then every point against it
    const P = pts.slice(5), a = P[0], b = P[Math.floor(P.length / 2)], c = P[P.length - 1];
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
    const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
    const R = Math.hypot(a[0] - ux, a[1] - uy), dev = Math.max(...P.map(q => Math.abs(Math.hypot(q[0] - ux, q[1] - uy) - R)));
    let turn = 0; for (let i = 1; i < P.length; i++) { let da = Math.atan2(-(P[i][1] - uy), P[i][0] - ux) - Math.atan2(-(P[i - 1][1] - uy), P[i - 1][0] - ux);
      da = (da + 3 * Math.PI) % (2 * Math.PI) - Math.PI; turn += da; }
    return { n: P.length, R, dev, turn, speeds: [...sp] }; });
  let ob = await orbit();
  t('  launched: a circle of r = mv/qB (69.9 px), counter-clockwise for + in B ⊗, the speed never changing', ob.n > 60 && Math.abs(ob.R - 69.9) < 1.5 && ob.dev < 1.5 && ob.turn > 2 && ob.speeds.length === 1, `R=${ob.R.toFixed(1)} dev=${ob.dev.toFixed(2)} turn=${ob.turn.toFixed(2)} ${ob.speeds.join('/')}`);
  await click('btn-mgz-q'); ob = await orbit();
  t('  a − charge: the same circle, clockwise', Math.abs(ob.R - 69.9) < 1.5 && ob.dev < 1.5 && ob.turn < -2 && ob.speeds.length === 1, `R=${ob.R.toFixed(1)} turn=${ob.turn.toFixed(2)}`);
  await click('btn-mgz-q');
  await click('btn-mgz-mode'); T = await read();
  t('Lorentz, B along +x, v at 60°: force INTO the page on a + charge', has(T, L('F נכנס לדף')));
  await click('btn-mgz-q'); T = await read();
  t('  and OUT of the page on a − charge', has(T, L('F יוצא מהדף')));
  // the keyboard: twelve presses of → turn v 60° clockwise, onto the field: no force
  await p.focus('#sim-canvas'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowRight');
  T = await read(); LM = await kmodel();
  const still = await p.evaluate(() => state.section);
  t('  v turned onto B with the arrow keys (the page stays): θ = 0°, F = 0', still === 'mag-lorentz' && has(T, 'θ = 0°') && has(T, 'F = 0') && /sin 0° = 0 N/.test(LM), still + ' ' + LM.slice(0, 50));
  // the right-hand-rule challenge: what was dealt is read off the picture,
  // F = q v×B worked out here, and the chip in that direction tapped
  const RH = await p.evaluate(async (WR) => { const cv = document.getElementById('sim-canvas'), wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const CH = [[0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 0, 0]];
    const rect = () => cv.getBoundingClientRect();
    for (let k = 0; k < 5; k++) {
      document.getElementById('btn-mgz-rhr').click();
      const rec = { v: null, B: null, z: 0, q: 0, chips: [], fb: null };
      const oA = window.simArrow, oM = window.magFieldMarks, oT = window.simText, oArc = CanvasRenderingContext2D.prototype.arc;
      window.simArrow = function (c, x1, y1, x2, y2, col) { if (c.canvas === cv) { if (col === '#34d399') rec.v = [x2 - x1, y1 - y2]; if (col === 'rgba(129,140,248,.55)') rec.B = [x2 - x1, y1 - y2]; } return oA.apply(this, arguments); };
      window.magFieldMarks = function (c, a, b, d, e, o) { if (c.canvas === cv) rec.z = o ? 1 : -1; return oM.apply(this, arguments); };
      window.simText = function (c, s) { if (c.canvas === cv) { if (s === '+' || s === '−') rec.q = s === '+' ? 1 : -1; } return oT.apply(this, arguments); };
      CanvasRenderingContext2D.prototype.arc = function (x, y, r) { if (this.canvas === cv && r === 22) rec.chips.push([x, y]); return oArc.apply(this, arguments); };
      await wait(60); for (let w = 0; w < 30 && !(rec.v && rec.q && rec.chips.length >= 7); w++) await wait(50);
      window.simArrow = oA; window.magFieldMarks = oM; window.simText = oT; CanvasRenderingContext2D.prototype.arc = oArc;
      const u = a => a.map(c => Math.round(c / Math.hypot(...a)));
      const v = u(rec.v).concat(0), B = rec.z ? [0, 0, rec.z] : u(rec.B).concat(0);
      const F = [v[1] * B[2] - v[2] * B[1], v[2] * B[0] - v[0] * B[2], v[0] * B[1] - v[1] * B[0]].map(c => c * rec.q);
      let ans = CH.findIndex(c => c + '' === F + '');
      if (k === 4) ans = (ans + 1) % 7;                         // and one wrong answer, on purpose
      const chip = rec.chips.slice(-7)[ans], R = rect(), sc = R.width / cv.offsetWidth;
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: R.left + chip[0] * sc, clientY: R.top + chip[1] * sc, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      const o2 = window.simText; window.simText = function (c, s) { if (c.canvas === cv && /^[✓✗]/.test(s)) rec.fb = s; return o2.apply(this, arguments); };
      for (let w = 0; w < 30 && !rec.fb; w++) await wait(50); window.simText = o2;
      out.push({ F: F.join(','), fb: rec.fb });
    }
    return { out, done: document.querySelectorAll('.sk-m')[2].classList.contains('done') };
  }, []);
  const okFb = RH.out.slice(0, 4).every((r, i) => r.fb && r.fb.startsWith('✓') && r.fb.endsWith(String(i + 1))), badFb = RH.out[4].fb && RH.out[4].fb.startsWith('✗');
  t('  right-hand-rule challenge: the sim\'s answer key is F = qv×B (4 dealt, worked out independently), a wrong tap resets the streak', okFb && badFb && RH.done, RH.out.map(r => r.F + ':' + (r.fb || '').slice(0, 14)).join(' | '));
  // the circle sim, on its fixed scale (42 cm of the field's edge in H − 64 px):
  // the proton enters moving right; in B into the page it turns UP, and lands
  // 2r = 2mv/qB = 31.3 cm from where it entered — on the ruler and in the mark
  await open('mag-force', 'mag-circle');
  const cmodel = () => p.evaluate(() => (document.querySelector('.sk-model-tx') || {}).textContent || '');
  let CM = await cmodel();
  t('circle: r = mv/qB = 15.66 cm and T/2 = πm/qB = 164.0 ns in the model line', CM.includes(') = 15.66 cm') && CM.includes('T/2 = πm/qB = 164.0 ns'), CM.slice(0, 80));
  const shoot = (btn, ms, ans) => p.evaluate(async ([btn, ms, ans]) => { const cv = document.getElementById('sim-canvas'), o = window.simCircle, oT = window.simText, fr = [], tx = new Set();
    let cur = []; window.simCircle = function (c, x, y, r) { if (c.canvas === cv && r === 6) cur.push([x, y]); return o.apply(this, arguments); };
    window.simText = function (c, s) { if (c.canvas === cv) tx.add(s); return oT.apply(this, arguments); };
    const real = window.requestAnimationFrame; window.requestAnimationFrame = cb => real(t => { cur = []; cb(t); fr.push(cur); });
    document.getElementById(btn).click(); const op = document.querySelectorAll('.sk-predict .sk-opt'); if (ans !== undefined && op.length && !op[0].disabled) op[ans].click();
    await new Promise(r => setTimeout(r, ms)); window.simCircle = o; window.simText = oT; window.requestAnimationFrame = real;
    return { fr: fr.filter(f => f.length), tx: [...tx], H: cv.offsetHeight, W: cv.offsetWidth }; }, [btn, ms, ans]);
  let sh = await shoot('btn-mgr-fire', 3600);
  const sc0 = (sh.H - 64) / 0.42, yE0 = sh.H - 30, ys = sh.fr.map(f => f[0][1]);
  t('  the proton curves UP in B ⊗ and lands 2r = 31.3 cm above the entry (310 px on the ruler\'s scale)', Math.min(...ys) < yE0 - 0.3 * sc0 && near(ys[ys.length - 1], yE0 - 0.3132 * sc0, 2) && sh.tx.some(x => x.startsWith('2r = 31.3 cm')), (yE0 - ys[ys.length - 1]).toFixed(1) + ' px vs ' + (0.3132 * sc0).toFixed(1));
  await click('btn-mgr-Bdir'); sh = await shoot('btn-mgr-fire', 3600);
  const ys2 = sh.fr.map(f => f[0][1]);
  t('  and DOWN when B comes out of the page, the same 2r below the entry', near(ys2[ys2.length - 1], 30 + 0.3132 * sc0, 2), (ys2[ys2.length - 1] - 30).toFixed(1) + ' px');
  await click('btn-mgr-Bdir');
  // the target, 24 cm away: B = 2mv/(qD) = 0.261 T → 0.260 on the slider's 0.005 T steps
  await slide('mgr-B', 0.26); sh = await shoot('btn-mgr-fire', 3600);
  const cDone = i => p.evaluate(i => document.querySelectorAll('.sk-m')[i].classList.contains('done'), i);
  t('  B = 0.260 T puts the proton on the 24 cm detector (2r = 24.1 cm): a hit, and its mission', sh.tx.some(x => x.includes('24.1 cm')) && sh.tx.some(x => x.startsWith(L('🎯 פגיעה! 2r = '))) && await cDone(0), sh.tx.filter(x => /2r/.test(x)).join(' | '));
  // an α particle (m/q twice the proton's) at the same v needs twice the field
  await click('btn-mgr-p'); await click('btn-mgr-p'); await slide('mgr-B', 0.52); sh = await shoot('btn-mgr-fire', 3600);
  t('  an α at the same speed hits it at twice the field, B = 0.520 T (2r = 23.9 cm)', sh.tx.some(x => x.includes('23.9 cm')) && await cDone(2), sh.tx.filter(x => /2r/.test(x)).join(' | '));
  // v and 2v (a prediction first): both leave the field in the same frame
  await slide('mgr-B', 0.4); sh = await shoot('btn-mgr-pair', 3600, 2);
  const X0c = sh.W * 0.2, out1 = sh.fr.findIndex(f => f.length === 2 && f[0][0] < X0c - 1 && f[0][1] < yE0 - 5), out2 = sh.fr.findIndex(f => f.length === 2 && f[1][0] < X0c - 1 && f[1][1] < yE0 - 5);
  t('  v and 2v leave the field together (T = 2πm/qB), the faster on a circle twice as large', out1 > 0 && Math.abs(out1 - out2) <= 1 && await cDone(1), 'frames ' + out1 + ' / ' + out2);
  await open('mag-force', 'mag-spectro'); T = await read();
  t('spectrometer: v = E/B = 4.00×10⁵ m/s; ¹²C and ¹⁴C land at 49.8 and 58.1 cm', has(T, '4.00×10⁵') && has(T, '49.8 cm') && has(T, '58.1 cm'));
  await open('mag-force', 'mag-wireforce'); await p.waitForTimeout(2500); T = await read();
  const phi = num(T, /φ = ([\d.]+)°/);
  t('swing: F = BIL = 0.080 N, equilibrium tanφ = F/mg', has(T, '0.080 N') && near(phi, Math.atan(0.08 / 0.196) * 180 / Math.PI, 0.3), phi);
  t('  I out of the page, N above: pushed to the RIGHT', has(T, L('ימינה')));
  await click('btn-mgf-flip'); T = await read();
  t('  magnet flipped: pushed to the LEFT', has(T, L('שמאלה')));
  await open('mag-force', 'mag-parallel'); T = await read();
  t('parallel: 10 A and 10 A at 5 cm, same way: 4.00×10⁻⁴ N/m, attraction', has(T, '4.00×10⁻⁴') && has(T, L('משיכה')));
  await slide('mgq-I2', -10); T = await read();
  t('  one current reversed: repulsion, same size', has(T, '4.00×10⁻⁴') && has(T, L('דחייה')));
  await open('mag-force', 'mag-motor'); T = await read();
  t('motor: τmax = NBIA = 0.0300 N·m', has(T, '0.0300 N·m'));
  // a 90 ms window with no frame in it (a loaded machine) reads nothing: such
  // windows are left out, and at least 3/4 of them must have read a torque
  const taus = async n => { const a = []; for (let i = 0; i < n; i++) { const r = await read(90); a.push(num(r, /τ = (-?[\d.]+) N·m/)); }
    const ok = a.filter(x => isFinite(x)); return ok.length >= 0.75 * n ? ok : [NaN]; };
  let tv = await taus(30);
  t('  with the commutator the torque never reverses', tv.every(x => x >= -1e-4), Math.min(...tv).toFixed(4));
  await click('btn-mgo-comm'); await p.waitForTimeout(300); tv = await taus(40);
  t('  without it the torque takes both signs (it rocks)', Math.min(...tv) < -1e-3 && Math.max(...tv) > 1e-3, Math.min(...tv).toFixed(4) + '…' + Math.max(...tv).toFixed(4));
  await open('mag-induction', 'mag-flux'); T = await read();
  t('flux: BA at θ = 0 is 10.00 mWb', has(T, '10.00 mWb'));
  await slide('mgx-th', 60); T = await read();
  t('  and 5.00 mWb at 60°', has(T, '5.00 mWb'));
  await open('mag-induction', 'mag-faraday'); T = await read();
  t('Faraday: a magnet at rest induces nothing', num(T, /ε = ([-−]?[\d.]+) mV/) === 0);
  // pair each readout with the caption drawn right after it, frame by frame
  const pairs = (r, re) => { const out = []; for (let i = 0; i + 1 < r.length; i++) { const m = r[i].match(re);
    if (m) out.push([parseFloat(m[1].replace("−", "-")), r[i + 1]]); } return out; };
  await click('btn-mgy-auto'); let sgn = { app: [], rec: [] };
  for (let i = 0; i < 60; i++) { for (const [e, c] of pairs(await read(80), /ε = ([-−]?[\d.]+) mV/)) {
    if (isAppr(c) && e) sgn.app.push(e); if (isRecd(c) && e) sgn.rec.push(e); } }
  t('  N approaching: ε < 0 (the coil sets up a field toward the magnet — repulsion)', sgn.app.length > 3 && sgn.app.every(e => e < 0), sgn.app.slice(0, 4).join(','));
  t('  N receding: ε > 0 (attraction)', sgn.rec.length > 3 && sgn.rec.every(e => e > 0), sgn.rec.slice(0, 4).join(','));
  // the model line under the canvas is Faraday's law with the numbers in it:
  // its ε must be −N times its ΔΦ/Δt, and its I that ε over 10 Ω, every time
  const fmod = async () => p.evaluate(() => { const e = document.querySelector('.sk-model-tx'); return e ? e.textContent : ''; });
  const mnum = x => parseFloat(String(x).replace('−', '-'));
  let fm = { n: 0, big: 0, bad: [] };
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(130); const m = await fmod();
    const a = m.match(/ε = −N·ΔΦ\/Δt = −(\d+) × \(([−\d.]+) mWb\/s\) = ([−\d.]+) mV/), b = m.match(/I = ε\/R = ([−\d.]+) mV \/ 10 Ω = ([−\d.]+) mA/);
    if (!a || !b) { fm.bad.push(m.slice(0, 60)); continue; } fm.n++;
    const N = +a[1], r = mnum(a[2]), e = mnum(a[3]), e2 = mnum(b[1]), I = mnum(b[2]);
    if (Math.abs(e) > 20) fm.big++;
    if (Math.abs(e + N * r) > 0.5 * N * 0.01 + 1 || e2 !== e || Math.abs(I - e / 10) > 0.1) fm.bad.push(m); }
  t('  the model line: ε = −N·ΔΦ/Δt and I = ε/R with its own numbers, in every reading', fm.n > 30 && fm.big > 5 && fm.bad.length === 0, fm.n + ' read, ' + fm.big + ' large; ' + fm.bad.slice(0, 2).join(' | '));
  await click('btn-mgy-auto');
  const parkAsked = await p.evaluate(() => { document.getElementById('btn-mgy-park').click(); const o = document.querySelectorAll('.sk-predict .sk-opt'); if (o.length) o[2].click(); return o.length; });
  await p.waitForTimeout(2600); T = await read();
  const parked = await p.evaluate(() => ({ m: document.querySelector('.sk-model-tx').textContent, done: document.querySelectorAll('.sk-m.done').length }));
  t('  parked in the coil, where the flux is largest (predicted first): ε = 0, ΔΦ/Δt = 0, and the mission says why', parkAsked === 3 && num(T, /ε = ([-−]?[\d.]+) mV/) === 0 && /\(0\.00 mWb\/s\)/.test(parked.m) && parked.done >= 1, parkAsked + ' options; ' + parked.m.slice(0, 50) + '; ' + parked.done + ' done');
  // The ring is stepped once per animation frame, and on a busy machine a
  // frame can be 40 ms long: then one frame's readout and caption could
  // disagree, and this check failed now and then (seen at load 8.8). Here
  // the sim runs on a clock of exactly 1/60 s per frame, the rate it is
  // built for, and EVERY frame of the push and the return is checked --
  // the same assertion, on all frames instead of a sample, whatever the load.
  // And at 1/20 s per frame -- a slow phone: there one frame carried the
  // magnet past the ring's centre and the force was the last sub-step's
  // current times dΦ/dz at the end position, so it flipped sign for a frame.
  // Lenz: every frame of a push in, the ring's swing and a pull out, at
  // 60 fps and at 20 fps (a slow phone, where one frame can carry the magnet
  // across a pole). Each frame records what the learner sees: the caption,
  // the force arrow on the ring, the two field arrows at the ring (the
  // magnet's, blue; the induced one, green) and where the magnet is.
  const LZG = [L('השטף גדל ⇒ השדה המושרה נגד שדה המגנט ⇒ הטבעת נדחית')], LZS = [L('השטף קטן ⇒ השדה המושרה עם שדה המגנט ⇒ הטבעת נמשכת')];
  for (const [hz, tag] of [[60, ''], [20, ' (20 fps)']]) {
  await open('mag-induction', 'mag-lenz');
  const lz = await p.evaluate(async ([hz, G, S]) => {
    const real = window.requestAnimationFrame, q = [];
    let T = performance.now() + 1000, rec = null;
    const oA = window.simArrow, oB = window.magBar, oT = window.simText;
    window.simArrow = function (c, x1, y1, x2, y2, col) { if (rec && c.canvas.id === 'sim-canvas') rec.ar.push([x1, x2, col]); return oA.apply(this, arguments); };
    window.magBar = function (c, x) { if (rec && c.canvas.id === 'sim-canvas') rec.mag = x; return oB.apply(this, arguments); };
    window.simText = function (c, s) { if (rec && c.canvas.id === 'sim-canvas') { if (G.some(g => s.includes(g))) rec.cap = 'grow'; else if (S.some(g => s.includes(g))) rec.cap = 'shrink'; } return oT.apply(this, arguments); };
    window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
    // the frame already asked of the browser runs once more and hands over
    for (let i = 0; i < 40 && !q.length; i++) await new Promise(r => setTimeout(r, 25));
    const tick = () => { const cbs = q.splice(0); T += 1000 / hz; rec = { ar: [], mag: null, cap: null }; cbs.forEach(c => c(T)); const r = rec; rec = null; return r; };
    // each move is gated by a prediction: answer it, and the move starts
    const answer = () => { const o = document.querySelectorAll('.sk-predict .sk-opt'); if (o.length) o[1].click(); return o.length ? 1 : 0; };
    for (let i = 0; i < 6; i++) tick();
    const frames = []; let asked = 0;
    document.getElementById('btn-mgn-push').click(); asked += answer();
    for (let i = 0; i < Math.ceil(1.6 * hz); i++) frames.push(tick());   // in, and the ring's swing
    document.getElementById('btn-mgn-pull').click(); asked += answer();
    for (let i = 0; i < Math.ceil(1.2 * hz); i++) frames.push(tick());   // out again
    window.simArrow = oA; window.magBar = oB; window.simText = oT;
    window.requestAnimationFrame = real; q.splice(0).forEach(c => real(c));
    return { frames, asked };
  }, [hz, LZG, LZS]);
  const st = { gF: [0, 0], sF: [0, 0], gB: [0, 0], sB: [0, 0] };   // [agree, disagree]
  for (const f of lz.frames) { if (!f.cap) continue;
    const F = f.ar.find(a => a[2] === '#fb923c'), Bm = f.ar.find(a => a[2] === '#60a5fa'), Bi = f.ar.find(a => a[2] === '#34d399');
    if (F) { const away = Math.sign(F[1] - F[0]) === Math.sign(F[0] - f.mag); st[f.cap === 'grow' ? 'gF' : 'sF'][(f.cap === 'grow') === away ? 0 : 1]++; }
    if (Bm && Bi) { const same = Math.sign(Bm[1] - Bm[0]) === Math.sign(Bi[1] - Bi[0]); st[f.cap === 'grow' ? 'gB' : 'sB'][(f.cap === 'shrink') === same ? 0 : 1]++; } }
  t('Lenz' + tag + ': both moves ask for a prediction first', lz.asked === 2, lz.asked);
  t('  flux growing' + tag + ': the ring is pushed AWAY from the magnet, every frame', st.gF[0] > 2 && st.gF[1] === 0, st.gF.join('/'));
  t('  flux shrinking' + tag + ': the ring is pulled TOWARD the magnet, every frame', st.sF[0] > 1 && st.sF[1] === 0, st.sF.join('/'));
  t('  flux growing' + tag + ': the induced field points AGAINST the magnet\'s', st.gB[0] > 2 && st.gB[1] === 0, st.gB.join('/'));
  t('  flux shrinking' + tag + ': the induced field points WITH the magnet\'s (it opposes the change, not the field)', st.sB[0] > 1 && st.sB[1] === 0, st.sB.join('/'));
  }
  await click('btn-mgn-reset'); await click('btn-mgn-cut'); await click('btn-mgn-push');
  let lzI = [], lzF = 0;
  for (let i = 0; i < 12; i++) { const r = await read(70); lzI.push(num(r, /^I = ([\d.]+) A/)); if (r.some(x => /^F = /.test(x))) lzF++; }
  t('  a cut ring: no current, no force', lzI.every(v => v === 0) && lzF === 0, lzI.join(',') + ' / ' + lzF);
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
  await p.evaluate(([AP, RE]) => { window.__face = []; const o = window.__oST = window.simText; window.simText = function (c, s, x, ...r) {
    if (c.canvas.id === 'sim-canvas') { if (s === 'N' || s === 'S') window.__face.push(['f', s, x]);
      else if (s === AP || s === RE) window.__face.push(['c', s === AP]); }
    return o.call(this, c, s, x, ...r); }; }, [APPR[0], RECD[0]]);
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
  t('Lorentz, B reversed to −x, v at 60°: θ from B is 240° and the force on + comes OUT of the page', has(T, 'θ = 240°') && has(T, L('F יוצא מהדף')));
  await open('mag-force', 'mag-wireforce');
  await slide('mgf-I', 10); await slide('mgf-B', 1); await slide('mgf-L', 0.3); await slide('mgf-m', 5); await p.waitForTimeout(2500);
  const WF = (await read(800)).filter(s => /^F = BIL/.test(s));
  t('current balance, F/mg ≈ 61: the wire rests on the pole face, F stays 3.000 N (no flicker)', WF.length > 10 && WF.every(s => s.includes('3.000 N')) && has(await read(), L('F גדול מדי: התיל נעצר על פני הקוטב העליון — לפני שהגיע לזווית שיווי המשקל')), WF.length + ' frames');
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
    // read the readout while the finger moves, not only once it is still: a
    // readout that depends on the motion itself (the induced current of
    // mag-lenz) is back to zero a moment after the finger stops, and on a busy
    // machine that moment came before the one reading
    const seen = [];
    for (let i = 1; i < pts.length; i++) { await q.waitForTimeout(50); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] });
      await q.waitForTimeout(40); seen.push(await tlast(re)); }
    await q.waitForTimeout(120); seen.push(await tlast(re));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(150); return seen; };
  // where each sim's handle starts, from its own layout (W = canvas width)
  const TOUCH = [
    ['mag-field', 'mag-magnets', W => [[W / 2, 206.8 - 0.125 * W], [W / 2 + 40, 266.8 - 0.125 * W]], '^' + LR('|B| במצפן = ')],
    ['mag-field', 'mag-wire', W => [[W * 0.65, 144], [W * 0.65 + 30, 154], [W * 0.65 + 50, 124]], '^' + LR('בגשש: B = ')],
    ['mag-field', 'mag-loop', W => [[W / 2 + 20, 155], [W / 2 + 50, 155], [W / 2 + 80, 155]], '^' + LR('בגשש (x = ')],
    ['mag-field', 'mag-solenoid', W => [[W * 0.6, 140], [W * 0.7, 150]], '^' + LR('בגשש: ')],
    ['mag-force', 'mag-lorentz', W => [[W * 0.8, 120], [W * 0.85, 100]], '^r = mv/qB'],
    ['mag-force', 'mag-parallel', W => [[W / 2 + 40, 170], [W / 2 + 70, 170], [W / 2 + 90, 170]], '^F/L'],
    ['mag-force', 'mag-motor', W => [[W * 0.36 + 30, 163], [W * 0.36, 128], [W * 0.36 - 30, 153]], '^θ = '],
    ['mag-induction', 'mag-flux', W => [[W * 0.3, 150], [W * 0.3, 180], [W * 0.3, 210]], '^θ = '],
    ['mag-induction', 'mag-faraday', W => [[0.13 * W, 110], [W * 0.3, 110], [W * 0.42, 110]], '^ε = '],
    ['mag-induction', 'mag-lenz', W => [[W * 0.14, 150], [W * 0.3, 150], [W * 0.42, 150]], '^I = '],
    ['mag-induction', 'mag-motional', W => [[174, 130], [200, 130], [230, 130]], '^ε = BLv'],
  ];
  const deaf = [];
  for (const [c, s, pf, re] of TOUCH) { const r = await topen(c, s), before = await tlast(re), seen = await swipe(r, pf(r.w), re);
    if (!before || !seen.some(h => h && h !== before)) deaf.push(s + ': ' + before + ' → ' + seen[seen.length - 1]); }
  t(TOUCH.length + ' simulations follow a finger (touch start, move, end)', deaf.length === 0, deaf.join(' | '));
  await tc.close();

  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌ ' + fail + ' FAILED' : '✅ MAGNETISM: EVERY NUMBER AND DIRECTION IS THE PHYSICS'} (${checks - fail}/${checks})`);
  process.exit(fail ? 1 : 0);
})();
