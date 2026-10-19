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
//   - three geometries, potential view: inside the sphere V = kQ/R; the
//     1 m × 1 m sheet's field on its axis, summed over the sheet, and weaker
//     than the point charge's at every distance (no "crossing");
//   - field lines: on EACH charge of a pair 2.5 per μC; equipotentials at
//     equal steps ΔV;
//   - deflection: a particle that hits the plate reports the hit.
// Last, every draggable simulation is driven by a finger on a 390 px phone:
// what it drives must change, and the page must not scroll under the drag.
// Also the learning experience: a misconception box per section, quiz keys
// that are not conspicuously the longest option, hints that are sentences,
// and no number glued to its unit.
const { chromium } = require('playwright');
const path = require('path');
const { LR, WORD } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

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

  // ── the learning experience: a misconception box in every section; quiz keys
  // that do not give themselves away by length (strictly longest in at most
  // 30 % of questions, never more than 1.3x the next option); second-tier
  // hints that are a Hebrew sentence, not a bare formula; numbers spaced
  // from their units ──
  const lx = await p.evaluate((WSRC) => { const WORD = new RegExp(WSRC);   // a word of the page's language
    const txt = h => { const d = document.createElement('template'); d.innerHTML = _ltSafe(String(h || '')); return d.content.textContent.replace(/\s+/g, ' ').trim(); };
    const r = { noMis: [], q: 0, longest: 0, loud: [], bareHint: [], glued: [] };
    for (const ch of ELECTRO_CHAPTERS) for (const se of ch.sections) {
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

  // the missions' check boxes, and a drag in canvas pixels (the sims publish
  // their model in those units)
  const done = () => p.evaluate(() => [...document.querySelectorAll('.sk-m')].map(li => li.classList.contains('done')));
  // a mission is checked on the next frame, and frames come late on a busy machine: wait for it (2 s at most)
  const solved = async (i) => { for (let j = 0; j < 20; j++) { if ((await done())[i] === true) return true; await p.waitForTimeout(100); } return false; };
  const cv = async () => p.evaluate(() => { const r = document.querySelector('#app canvas').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const dragTo = async (x0, y0, x1, y1) => { const o = await cv(); await p.mouse.move(o.x + x0, o.y + y0); await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(o.x + x0 + (x1 - x0) * i / 12, o.y + y0 + (y1 - y0) * i / 12);
    await p.mouse.up(); await p.waitForTimeout(250); };

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
      const s = bare(await p.evaluate(() => { const r = window.__txt.slice(-160).join('\n'); window.__txt = []; return r; }));
      // the simulation prints the measured q only; n = q/e is computed here
      const q = num(s, /q = mgd\/V = ([0-9.]+×10⁻[⁰¹²³⁴⁵⁶⁷⁸⁹]+) C/);
      if (q > 0) { nq = q / e; if (!hit) hit = v; }
      if (hit && v > hit * 1.04) break;
    }
    t(`Millikan drop ${drop}: n = q/e is a whole number`, Math.abs(nq - Math.round(nq)) < 0.02 && nq >= 0.98, 'n = ' + nq);
  }
  // the comb: half of e fits every dot too, but is not the answer; the
  // largest spacing that fits settles on e itself, measured from the data
  const mk = () => p.evaluate(() => document.querySelector('#app canvas').__mk());
  let mkm = await mk();
  const qX = q => mkm.qX0 + (mkm.qX1 - mkm.qX0) * q / mkm.QMAX;
  t('Millikan: three drops in the log, with no common factor in their electron counts',
    mkm.log.length === 3 && mkm.log.reduce((a, x) => { let b = x.n; while (b) [a, b] = [b, a % b]; return a; }, 0) === 1, mkm.log.map(x => x.n).join(','));
  t('missions "measure a charge" solved, "four drops" not yet', (await solved(0)) && (await done())[1] === false);
  await dragTo(qX(mkm.comb), mkm.NLy - 16, qX(0.81e-19), mkm.NLy - 16); mkm = await mk();
  t('Millikan comb at e/2: every dot is on a tooth, yet the mission is not solved', Math.abs(mkm.comb / 0.8e-19 - 1) < 0.02 && (await done())[2] === false, mkm.comb);
  await dragTo(qX(mkm.comb), mkm.NLy - 16, qX(1.52e-19), mkm.NLy - 16); mkm = await mk();
  t('Millikan comb: the largest spacing that fits every drop is e, to 2 %', Math.abs(mkm.comb / e - 1) < 0.02 && (await solved(2)), mkm.comb);

  // pair energy: released from rest, two like charges fly apart
  await open('elc-upair');
  const r0 = num(await txt(), /r = ([0-9.]+) cm/);
  await click('btn-up-release');
  const up = () => p.evaluate(() => document.querySelector('#app canvas').__up());
  // the flight is animated: wait for it to end (frame rates vary), at most 6 s
  const landed = async () => { for (let i = 0; i < 60; i++) { if (!(await p.evaluate(() => document.querySelector('#app canvas').__up().released))) return; await p.waitForTimeout(100); } };
  await landed();
  const r1 = num(await txt(300), /r = ([0-9.]+) cm/);
  t('pair released from rest: the charges move apart', r1 > r0 + 5, r0 + ' → ' + r1);
  let u1 = await up();
  t('pair, like charges let go: U + E_k stays U₀ (energy from the motion, not an integrator)', u1.U0 > 0 && Math.abs(u1.U + u1.K - u1.U0) < 1e-9 * u1.U0 && u1.K > 0, JSON.stringify(u1));
  t('pair at the start: 2 and 3 μC at 30 cm, U = kq₁q₂/r = +0.18 J', Math.abs(k * 6e-12 / 0.3 - 0.18) < 1e-12 && Math.abs(r0 - 30) < 0.05);
  // an unlike pair let go from rest falls together: U more negative, E_k > 0
  await setR('inp-up-q2', -3); u1 = await up();
  await dragTo(u1.x2, u1.cy, u1.x1 + 30 * u1.PXC, u1.cy);
  await click('btn-up-release'); await landed(); await p.waitForTimeout(150); const u2 = await up();
  t('pair, unlike charges let go: they approach, U falls below U₀ < 0 and E_k = U₀ − U > 0', u2.U0 < 0 && u2.r < 0.3 - 0.02 && u2.U < u2.U0 && Math.abs(u2.K - (u2.U0 - u2.U)) < 1e-12, JSON.stringify(u2));
  t('pair missions: U < 0, a like pair and an unlike pair released', (await solved(0)) && (await solved(2)) && (await solved(3)));
  u1 = await up(); await dragTo(u1.x2, u1.cy, u1.x1 + 40 * u1.PXC, u1.cy); u1 = await up();
  const U40 = u1.U, r40 = u1.r; await dragTo(u1.x2, u1.cy, u1.x1 + 20 * u1.PXC, u1.cy); u1 = await up();
  t('pair: U ∝ 1/r -- about half the distance, about twice the energy; mission solved',
    Math.abs(u1.U / U40 - r40 / u1.r) < 1e-9 && Math.abs(r40 / u1.r - 2) < 0.02 && (await solved(1)), (u1.U / U40).toFixed(4) + ' vs ' + (r40 / u1.r).toFixed(4));

  // electroscope: charge it by contact, then an opposite rod closes the leaves
  await open('elc-basics');
  await drag(0.22, 0.27, 0.55, 0.25);
  await click('btn-scope-touch');
  await drag(0.55, 0.25, 0.12, 0.62);
  await click('btn-scope-flip');
  const ang = async () => num(await txt(300), new RegExp(LR('זווית עלים: ') + '([0-9.]+)°'));
  const aFar = await ang();
  await drag(0.12, 0.62, 0.50, 0.27);
  const aNear = await ang();
  t('electroscope: an opposite rod closes a charged electroscope\'s leaves', aNear < aFar - 3, aFar + '° → ' + aNear + '°');
  await drag(0.50, 0.27, 0.55, 0.25);
  t('electroscope missions: charged by contact; the sign test (leaves close for an opposite rod)', (await solved(0)) && (await solved(2)));
  // induction with the earth: rod near, ground, cut the ground, rod away
  await open('elc-basics'); await p.waitForTimeout(300);
  const sc = () => p.evaluate(() => document.querySelector('#app canvas').__scope);
  await drag(0.22, 0.27, 0.55, 0.25);
  await click('btn-scope-ground'); await p.waitForTimeout(1500);
  let s1 = await sc();
  t('electroscope grounded with the rod near: the leaves hang closed (the far end is at earth potential)', s1.grounded && s1.leaf < 1.5 && s1.q > 0.5, JSON.stringify(s1));
  await click('btn-scope-ground'); await drag(0.55, 0.25, 0.12, 0.62); await p.waitForTimeout(300);
  s1 = await sc();
  t('electroscope charged by induction: opposite to the rod, the earth took the rest, the total conserved',
    s1.q > 0.5 && s1.rod < 0 && Math.abs(s1.rod + s1.q + s1.earth - (-5)) < 1e-6 && s1.step >= 4 && (await solved(1)), JSON.stringify(s1));

  // conductor in an external field: neutral sphere, probe inside, E = 0
  await open('elc-conductor');
  await click('btn-cnd-ext');
  await setR('inp-cnd-Q', 0);
  await drag(0.38, 0.32, 0.29, 0.40);
  const cnd = await txt();
  t('neutral conductor in an external field: E = 0 inside', new RegExp('E = ' + LR('0 בדיוק')).test(cnd), cnd.split('\n').filter(l => /^‎?E = /.test(l)).slice(-1)[0]);
  t('conductor missions: E inside; a neutral conductor in an external field', (await solved(0)) && (await solved(1)));
  // the discharge mission asks for the threshold: at the defaults the tip
  // already sparks, so switching the mode alone must not solve it
  await setR('inp-cnd-Q', 4); await p.waitForTimeout(150); await click('btn-cnd-mode'); await p.waitForTimeout(300);
  t('conductor, sharp tip at the defaults: sparking already, the discharge mission not yet solved',
    (await p.evaluate(() => document.querySelector('#app canvas').__cnd)).Etip > 3e6 && (await done())[2] === false);
  await setR('inp-cnd-Q', 2); await p.waitForTimeout(250);
  t('conductor, sharp tip, 2 μC on R = 25 cm: E at the tip below 3×10⁶ V/m, no discharge',
    (await p.evaluate(() => document.querySelector('#app canvas').__cnd)).Etip < 3e6);
  await setR('inp-cnd-Q', 8); await setR('inp-cnd-R', 30); await p.waitForTimeout(200);
  const cn = await p.evaluate(() => document.querySelector('#app canvas').__cnd);
  t('conductor, sharp tip: E ≈ V/ρ = (kQ/R)/(0.16R) above 3×10⁶ V/m -- discharge mission', cn.sharp && Math.abs(cn.Etip - (k * 8e-6 / 0.15) / (0.15 * 0.16)) < 1e-6 * cn.Etip && cn.Etip > 3e6 && (await solved(2)), JSON.stringify(cn));

  // charged sphere with Q < 0: a real field outside, a negative potential
  await open('elc-sphere');
  await setR('inp-sph-Q', -6);
  await drag(0.5, 0.5, 0.6, 0.5);
  const sph = await txt();
  const eS = num(sph, /E = ([0-9.]+×10[⁻⁰-⁹¹²³⁴⁵⁶⁷⁸⁹]+) V\/m/), vS = num(sph, /V = ([-−]?[0-9.]+×10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+) V/);
  t('negative sphere: |E| > 0 outside and V < 0', eS > 0 && vS < 0, 'E=' + eS + ' V=' + vS);
  const sphm = () => p.evaluate(() => document.querySelector('#app canvas').__sph);
  await drag(0.6, 0.5, 0.03, 0.5); await p.waitForTimeout(250); let sp1 = await sphm();
  t('sphere: inside the metal E = 0 and V = kQ/R -- mission', sp1.inside && sp1.E === 0 && Math.abs(sp1.V - 8.988e9 * sp1.Q / sp1.R) < 1e-6 * Math.abs(sp1.V) && (await solved(0)), JSON.stringify(sp1));
  await setR('inp-sph-Q', 3); await setR('inp-sph-R', 10); await p.waitForTimeout(250); sp1 = await sphm(); await setR('inp-sph-R', 20); await p.waitForTimeout(250); const sp2 = await sphm();
  t('sphere: U = kQ²/2R, twice R half U -- mission', Math.abs(sp1.U - 8.988e9 * 9e-12 / 0.2) < 1e-9 && Math.abs(sp1.U / sp2.U - 2) < 1e-9 && (await solved(1)));
  await setR('inp-sph-Q', 6); await setR('inp-sph-R', 2); await p.waitForTimeout(200);
  t('sphere: 6 μC on 2 cm is beyond Qmax = (3×10⁶)R²/k -- mission', Math.abs((await sphm()).Qmax - 3e6 * 0.02 ** 2 / 8.988e9) < 1e-12 && (await solved(2)));

  // three geometries, potential view: inside the sphere V = kQ/R (not 0)
  await open('elc-compare');
  await click('btn-cmp-v');
  await drag(0.10, 0.5, 0.08, 0.5);       // a probe well inside R = 5 cm
  const cmp = await txt();
  const vs = [...cmp.matchAll(/V = ([0-9.]+) kV/g)].map(m => parseFloat(m[1]));
  t('compare (V view): inside the sphere V = kQ/R', vs.some(v => Math.abs(v - 8.988e9 * 0.5e-6 / 0.05 / 1e3) < 1), vs.join(','));
  t('compare mission: V view inside the sphere', await solved(2));
  await click('btn-cmp-v');
  // the sheet is a real 1 m × 1 m square read on its axis: its field, summed
  // here piece by piece (Coulomb's law over a 400 × 400 grid), against what
  // the simulation draws and prints
  const sheetE = (z, Qc) => { const Ng = 400, d = 1 / Ng, dq = Qc * d * d; let E = 0;
    for (let i = 0; i < Ng; i++) for (let j = 0; j < Ng; j++) { const x = -0.5 + (i + 0.5) * d, y = -0.5 + (j + 0.5) * d, r2 = x * x + y * y + z * z; E += 8.988e9 * dq * z / (r2 * Math.sqrt(r2)); }
    return E; };
  const cbb = await (await p.$('#app canvas')).boundingBox();
  const cmpAt = async (r) => { await drag(0.5, 0.5, (52 + (cbb.width - 68) * r / 0.6) / cbb.width, 0.5); return p.evaluate(() => document.querySelector('#app canvas').__cmp); };
  let cm = await cmpAt(0.10);
  t('compare: the 1 m × 1 m sheet on its axis, 10 cm away: E as summed over the sheet, below σ/2ε₀',
    Math.abs(cm.Esh / sheetE(cm.r, 0.5e-6) - 1) < 2e-3 && Math.abs(cm.Einf - 0.5e-6 / (2 * 8.854e-12)) < 1e-6 && cm.Esh < cm.Einf,
    (cm.Esh / sheetE(cm.r, 0.5e-6)).toFixed(4));
  t('missions about the sheet not solved at 10 cm', (await done())[0] === false && (await done())[1] === false);
  cm = await cmpAt(0.0558);
  t('compare: the sheet\'s field falls to 90 % of σ/2ε₀ at about 5.6 cm -- mission', Math.abs(cm.Esh / cm.Einf - 0.9) < 0.012 && (await solved(0)), (cm.Esh / cm.Einf).toFixed(3) + ' at ' + cm.r.toFixed(4));
  t('missions: "more than half the point charge" not yet', (await done())[1] === false);
  // on the axis the point charge is the stronger at every distance: there is
  // no crossing (the infinite plane's σ/2ε₀ applied at 40 cm made one up)
  const weaker = [];
  for (const r of [0.01, 0.1, 0.25, 0.4, 0.58]) { cm = await cmpAt(r); weaker.push(cm.Esh < cm.Ept && cm.Esh < cm.Einf); }
  t('compare: the sheet is weaker than the point charge at 1, 10, 25, 40 and 58 cm', weaker.every(Boolean), weaker.join(','));
  cm = await cmpAt(0.55);
  t('compare: 55 cm away the sheet gives more than half of kQ/r², and still less -- mission', cm.Esh / cm.Ept > 0.5 && cm.Esh / cm.Ept < 1 && (await solved(1)), (cm.Esh / cm.Ept).toFixed(3));
  await setR('inp-cmp-Q', 4); await p.waitForTimeout(200); const cm4 = await p.evaluate(() => document.querySelector('#app canvas').__cmp);
  t('compare: eight times the charge, every field eight times larger', Math.abs(cm4.Esh / cm.Esh - 8) < 1e-9 && Math.abs(cm4.Ept / cm.Ept - 8) < 1e-9);

  // infinite plane: the field does not fall off; two plates add or cancel
  await open('elc-plane'); await p.waitForTimeout(300);
  const pln = () => p.evaluate(() => document.querySelector('#app canvas').__pln);
  await click('btn-pln-two');
  await drag(0.5, 0.3, 0.33, 0.3); const pa = await pln(); await drag(0.33, 0.3, 0.95, 0.3); const pb2 = await pln();
  t('one plane: E = σ/2ε₀ near it and far from it -- mission', Math.abs(Math.abs(pa.E) - 4e-6 / (2 * 8.854e-12)) < 1 && Math.abs(Math.abs(pb2.E) - Math.abs(pa.E)) < 1e-6 && (await solved(0)), pa.E + ' / ' + pb2.E);
  await click('btn-pln-two'); await setR('inp-pln-s2', -4); await p.waitForTimeout(200);
  t('two plates, +4 and −4 μC/m²: zero outside -- mission', await solved(1));
  await setR('inp-pln-s2', 4); await p.waitForTimeout(200);
  t('two plates, +4 and +4 μC/m²: zero between -- mission', await solved(2));

  // deflection: a particle that hits the plate reports the hit
  await open('elc-deflection');
  await setR('inp-df-v0', 1);
  const df = await txt();
  t('deflection: a hit reports y = d/2 and where', /y = d\/2/.test(df) && /x = v₀t/.test(df), df.split('\n').filter(l => /y = /.test(l)).slice(-1)[0]);

  // ── the field and potential explorer (elc-field, elc-potential) ──
  // its model, as the sim publishes it: charges, probe readings, null point,
  // and where every field line starts (from) and ends (end)
  const elc = () => p.evaluate(() => document.querySelector('#app canvas').__elc());
  const perQ = (m, i) => m.lines.filter(l => l.from === i).length + m.lines.filter(l => l.end === i).length;
  await open('elc-field');
  let m = await elc();
  t('field lines: a lone +4 μC charge sends out 2.5 lines per μC, all to far away',
    m.lines.length === 10 && m.lines.every(l => l.from === 0 && l.dir === 1 && l.end === null), JSON.stringify(m.lines.map(l => [l.from, l.end])));
  await click('btn-field-dipole');
  await setR('inp-elc-Q2', -4); m = await elc();
  t('field lines, ±4 μC: lines leave + and end on −, as many on each as its |Q| asks',
    m.lines.filter(l => l.from === 0).every(l => l.dir === 1) && m.lines.filter(l => l.end === 1).length >= 8 && perQ(m, 1) === 10,
    'ending on −: ' + m.lines.filter(l => l.end === 1).length + ', on −: ' + perQ(m, 1));
  await setR('inp-elc-Q', 1); await setR('inp-elc-Q2', -6); m = await elc();
  t('field lines, +1 and −6 μC: every line from the small + ends on the −; the − carries exactly 15',
    m.lines.filter(l => l.from === 0).length === 3 && m.lines.filter(l => l.from === 0).every(l => l.end === 1) && perQ(m, 1) === 15,
    'from +: ' + m.lines.filter(l => l.from === 0).map(l => l.end).join(',') + '; on −: ' + perQ(m, 1));
  // unequal unlike pairs: as many lines on EACH charge as 2.5 per μC asks
  // (spacing the lines evenly round both charges put 4 on a −1 μC beside
  // +4 μC, and 3 on a −0.5 μC beside +6 μC); none may stall short of a charge
  // or end on the charge it started from
  const nL = q => Math.max(Math.abs(q) > 0.05 ? 1 : 0, Math.round(2.5 * Math.abs(q)));
  for (const [qa, qb] of [[4, -1], [6, -0.5], [-2, 5.5], [3, -6], [2, -2], [5, 1]]) {
    await setR('inp-elc-Q', qa); await setR('inp-elc-Q2', qb); m = await elc();
    t(`field lines, ${qa} and ${qb} μC: ${nL(qa)} and ${nL(qb)} lines meet the two charges`,
      perQ(m, 0) === nL(qa) && perQ(m, 1) === nL(qb) && m.lines.every(l => l.end !== l.from),
      'on them: ' + perQ(m, 0) + ', ' + perQ(m, 1));
  }
  // like charges: drag the test charge to near the null point -- it settles there, E reads 0, the mission is solved
  await setR('inp-elc-Q', 4); await setR('inp-elc-Q2', 2); m = await elc();
  const nx = m.A[0].x + (m.A[1].x - m.A[0].x) * 2 / (2 + Math.SQRT2), ny = m.A[0].y;
  t('null point of +4 and +2 μC: on the axis, √4/(√4+√2) of the way', m.nul && Math.hypot(m.nul.x - nx, m.nul.y - ny) < 0.5, JSON.stringify(m.nul));
  await dragTo(m.probe.x, m.probe.y, nx + 6, ny - 5);
  m = await elc(); let tx2 = await txt();
  t('the test charge let go near the null point settles on it: E = 0 there', m.E < 1 && /\|E\| = 0 N\/C/.test(tx2), 'E = ' + m.E);
  t('mission "find E = 0 between two positive charges" is solved by doing it', (await solved(0)));
  // unlike, unequal: the null point is beyond the weaker charge, where kQ₁/r₁² = kQ₂/r₂²
  await setR('inp-elc-Q2', -1); m = await elc();
  const n1 = Math.hypot(m.nul.x - m.A[0].x, m.nul.y - m.A[0].y), n2 = Math.hypot(m.nul.x - m.A[1].x, m.nul.y - m.A[1].y);
  t('null point of +4 and −1 μC: outside the segment, beyond the −1, with 4/r₁² = 1/r₂²',
    n1 > n2 && n1 > Math.hypot(m.A[1].x - m.A[0].x, m.A[1].y - m.A[0].y) && Math.abs(4 / n1 ** 2 - 1 / n2 ** 2) < 1e-3 * 4 / n1 ** 2, n1.toFixed(1) + " " + n2.toFixed(1));
  // a test charge released from rest: along a straight (radial) line it stays on it; in a dipole it leaves it
  await click('btn-field-dipole'); m = await elc();
  await click('btn-field-release'); await p.waitForTimeout(2500); m = await elc();
  t('released from rest in a lone charge\'s radial field, the test charge moves along its field line', m.fly && m.fly.dev < 1.5, JSON.stringify(m.fly));
  await click('btn-field-dipole'); await setR('inp-elc-Q2', -4); m = await elc();
  const sep = m.A[1].x - m.A[0].x;
  await dragTo(m.probe.x, m.probe.y, m.A[0].x + sep * 0.3, m.A[0].y - sep * 0.4);
  await click('btn-field-release');
  for (let i = 0; i < 80; i++) { m = await elc(); if (m.fly && (m.fly.done || m.fly.dev >= 12)) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(150); m = await elc();
  t('released from rest where the line curves (a dipole), it leaves the field line: inertia', m.fly && m.fly.dev >= 12 && (await solved(2)), JSON.stringify(m.fly));
  await click('btn-field-q0'); await p.waitForTimeout(300);
  t('a negative test charge: F = q₀E reverses, E does not -- mission solved', (await solved(3)));

  await open('elc-potential');
  await click('btn-pot-two'); m = await elc();
  // superposition of a scalar: V at the probe = kQ₁/r₁ + kQ₂/r₂, independently recomputed
  const Vind = m.A.reduce((a, c) => a + k * c.q * 1e-6 / (Math.hypot(m.probe.x - c.x, m.probe.y - c.y) / m.PXM), 0);
  t('potential: V = kQ₁/r₁ + kQ₂/r₂ at the probe', Math.abs(m.V - Vind) < 1e-6 * Math.abs(Vind) + 1e-6, m.V + ' vs ' + Vind);
  // V = 0 line of +2 and −3 μC crosses the axis 2/5 of the way: let the probe go next to it
  const vx = m.A[0].x + 0.4 * (m.A[1].x - m.A[0].x), vy = m.A[0].y;
  await dragTo(m.probe.x, m.probe.y, vx + 5, vy - 30); m = await elc(); tx2 = await txt();
  t('potential: let go by the white line, the probe reads V = 0 while |E| is far from 0', Math.abs(m.V) < 1 && m.E > 1e4 && /^V = 0 V$/m.test(tx2), 'V = ' + m.V + ', E = ' + m.E);
  t('mission "V = 0 but E ≠ 0" is solved by doing it', (await solved(0)));
  await setR('inp-elc-Vq2', 3); m = await elc();
  await dragTo(m.probe.x, m.probe.y, m.nul.x + 5, m.nul.y + 4); m = await elc();
  t('potential: at the null point of two like charges E = 0 but V = kQ₁/r₁ + kQ₂/r₂ > 0',
    m.E < 1 && m.V > 1e4 && (await solved(1)), 'E = ' + m.E + ', V = ' + m.V);
  // equipotentials at EQUAL steps of V (a 1-2-5 step, its value printed), so
  // that their crowding shows the field's strength; with unlike charges V = 0
  // is one of them
  const eqSteps = mm => { const L = mm.levels.filter(v => v !== 0).map(v => v / mm.dV);
    const pos = L.filter(v => v > 0).sort((a, b) => a - b);
    return mm.dV > 0 && /^[125]0*$/.test(String(Math.round(mm.dV))) && L.every(v => Math.abs(v - Math.round(v)) < 1e-9) && pos.every((v, i) => v === i + 1) && pos.length >= 3; };
  t('potential: the equipotentials of +2 and +3 μC are at equal steps ΔV', eqSteps(m), JSON.stringify([m.dV, m.levels]));
  t('potential: the step ΔV is printed on the canvas', new RegExp('ΔV = ' + (m.dV >= 1000 ? +(m.dV / 1000).toPrecision(3) + ' kV' : m.dV + ' V')).test(await txt()), m.dV);
  await setR('inp-elc-Vq2', -3); await p.waitForTimeout(250); m = await elc();   // the contours follow on the next frame
  t('potential: +2 and −3 μC, equal steps and V = 0 among them', eqSteps(m) && m.levels.includes(0), JSON.stringify([m.dV, m.levels]));

  // ── Coulomb: equal arrows (Newton 3) on one linear scale, and the inverse square measured ──
  await open('elc-coulomb');
  const clb = () => p.evaluate(() => document.querySelector('#app canvas').__clb());
  let cb = await clb();
  t('Coulomb at the start: r = 20 cm, F = k|q₁q₂|/r² = 1.35 N', Math.abs(cb.r - 20) < 0.01 && Math.abs(cb.F - k * 6e-12 / 0.04) < 1e-9, cb.r + ' cm, ' + cb.F + ' N');
  await setR('inp-elc-q1', 5); await setR('inp-elc-q2', 1); await p.waitForTimeout(250); cb = await clb();
  t('Coulomb, q₁ = 5 μC and q₂ = 1 μC: the two force arrows are equal in length (Newton 3)', cb.L1 > 0 && cb.L1 === cb.L2 && Math.abs(cb.F - k * 5e-12 / (cb.r / 100) ** 2) < 1e-9, cb.L1 + ' / ' + cb.L2);
  t('mission "one charge 4 times the other" is solved by doing it', (await solved(0)));
  for (const rc of [10, 20, 30]) { cb = await clb(); await dragTo(cb.x2, cb.cy, cb.x1 + rc * cb.PXC, cb.cy); }
  cb = await clb();
  const fr2 = cb.tab.map(m2 => m2.F * (m2.r / 100) ** 2);
  t('Coulomb: three measurements, F·r² the same at each = k|q₁q₂|', cb.tab.length === 3 && fr2.every(v => Math.abs(v - k * 5e-12) < 1e-9 * k * 5e-12),
    JSON.stringify(cb.tab));
  t('Coulomb: doubling r from 10 to 20 cm divides F by 4', Math.abs(cb.tab[0].F / cb.tab[1].F - 4) < 1e-6, (cb.tab[0].F / cb.tab[1].F).toFixed(4));
  t('mission "measure at three distances" is solved by doing it', (await solved(1)));
  await setR('inp-elc-q1', 2); await setR('inp-elc-q2', -3); cb = await clb();
  await dragTo(cb.x2, cb.cy, cb.x1 + 12 * cb.PXC, cb.cy);
  await click('btn-clb-three'); await p.waitForTimeout(200); cb = await clb();
  await dragTo(cb.x3, cb.cy, cb.x2 + (cb.x2 - cb.x1) + 6, cb.cy); await p.waitForTimeout(200); cb = await clb();
  t('superposition: with q₃ = q₁ the net force on q₂ vanishes where r₃ = r₁', Math.abs(cb.Fn) < 1e-9 && Math.abs((cb.x3 - cb.x2) - (cb.x2 - cb.x1)) < 1e-6 && (await solved(2)), 'ΣF = ' + cb.Fn);

  // ── capacitor: C from the geometry alone; connected (V fixed) vs disconnected (Q fixed) ──
  await open('elc-capacitor'); await p.waitForTimeout(400);
  const cap = async () => { await p.waitForTimeout(250); return p.evaluate(() => document.querySelector('#app canvas').__cap); };
  let c1 = await cap();
  t('capacitor: C = ε₀A/d = 44.3 pF for 200 cm² at 4 mm', Math.abs(c1.C - eps0 * 0.02 / 0.004) < 1e-15, c1.C);
  await setR('inp-elc-cV', 6); const c6 = await cap(); await setR('inp-elc-cV', 24); const c24 = await cap();
  t('capacitor: 6 V → 24 V, C unchanged and Q ×4 (C = Q/V measures, does not set)', c6.C === c24.C && Math.abs(c24.Q / c6.Q - 4) < 1e-9 && (await solved(0)));
  await click('btn-cap-disc'); const cd0 = await cap(); await setR('inp-elc-cd', 8); const cd1 = await cap();
  t('capacitor disconnected, gap doubled: V ×2, E unchanged, U ×2, Q fixed', Math.abs(cd1.V / cd0.V - 2) < 1e-9 && Math.abs(cd1.E - cd0.E) < 1e-6 * cd0.E && Math.abs(cd1.U / cd0.U - 2) < 1e-9 && cd1.Q === cd0.Q && (await solved(1)), JSON.stringify([cd0, cd1, await done()]));
  await click('btn-cap-disc'); const cc0 = await cap(); await setR('inp-elc-cd', 4); const cc1 = await cap();
  t('capacitor connected, gap halved: C, Q, U ×2 and E ×2, V fixed', Math.abs(cc1.C / cc0.C - 2) < 1e-9 && Math.abs(cc1.U / cc0.U - 2) < 1e-9 && Math.abs(cc1.E / cc0.E - 2) < 1e-9 && cc1.V === cc0.V && (await solved(2)));

  // ── uniform field between plates: E = V/d, a = eE/m, the proton barely moves ──
  await open('elc-plates'); await p.waitForTimeout(400);
  const pl = async () => { await p.waitForTimeout(200); return p.evaluate(() => document.querySelector('#app canvas').__pl); };
  await setR('inp-elc-V', 200); await setR('inp-elc-d', 8); let pw = await pl();
  t('plates: E = V/d = 200/0.08 = 2500 V/m, a = eE/m', pw.E === 2500 && Math.abs(pw.a - 1.6e-19 * 2500 / 9.11e-31) < 1e-6 * pw.a, JSON.stringify(pw));
  await setR('inp-elc-d', 4); pw = await pl();
  t('plates: half the gap at the same V, twice the field -- mission', pw.E === 5000 && (await solved(0)));
  await setR('inp-elc-V', 400); await setR('inp-elc-d', 2); await setR('inp-elc-v0', 5);
  await click('btn-pl-launch');
  for (let i = 0; i < 40 && !(await pl()).hit; i++);
  t('plates: a slow electron in a strong field hits a plate -- mission', (await pl()).hit === true && (await solved(1)));
  await click('btn-pl-part'); await setR('inp-elc-v0', 20); await click('btn-pl-launch');
  t('plates: a proton launched the same way leaves the plates -- mission', await solved(2) || await solved(2));

  // ── capacitors in series and in parallel ──
  await open('elc-network'); await p.waitForTimeout(400);
  const net = async () => { await p.waitForTimeout(200); return p.evaluate(() => document.querySelector('#app canvas').__net); };
  let nw = await net();
  t('parallel 2 and 3 μF at 12 V: C = 5 μF, Q₁ = 24 μC, Q₂ = 36 μC, U = 360 μJ', nw.C === 5 && nw.Q1 === 24 && nw.Q2 === 36 && Math.abs(nw.U - 360) < 1e-9, JSON.stringify(nw));
  await click('btn-net-mode'); nw = await net();
  t('series 2 and 3 μF at 12 V: C = 1.2 μF, the same Q = 14.4 μC on both, V₁ + V₂ = 12 V', Math.abs(nw.C - 1.2) < 1e-12 && nw.Q1 === nw.Q2 && Math.abs(nw.Q1 - 14.4) < 1e-9 && Math.abs(nw.V1 + nw.V2 - 12) < 1e-9, JSON.stringify(nw));
  await setR('inp-net-c2', 6); nw = await net();
  t('series 2 and 6 μF: V₁ = 3V₂ (the smaller capacitor takes the larger voltage) -- mission', Math.abs(nw.V1 / nw.V2 - 3) < 1e-9 && (await solved(0)));
  await setR('inp-net-c1', 4); await setR('inp-net-c2', 4); nw = await net();
  t('series 4 and 4 μF: C = 2 μF -- mission', Math.abs(nw.C - 2) < 1e-12 && (await solved(1)));
  const Us = nw.U; await click('btn-net-mode'); nw = await net();
  t('equal capacitors: parallel stores 4 times the series energy -- mission', Math.abs(nw.U / Us - 4) < 1e-9 && (await solved(2)));

  // ── dielectric: what is held fixed. Bars read C, Q, V, E, U against the empty capacitor ──
  await open('elc-dielectric'); await p.waitForTimeout(400);
  const ratios = async () => { const l = (await txt(300)).split('\n').filter(x => /^×[0-9.]+$/.test(x)).map(x => +x.slice(1)); return l.slice(-6, -1); };
  await setR('inp-di-k', 4); await setR('inp-di-f', 1);
  let rt = await ratios();
  t('dielectric, battery connected, slab in: C, Q, U ×κ; V, E ×1', JSON.stringify(rt) === JSON.stringify([4, 4, 1, 1, 4]), rt.join(' '));
  t('mission "connected: slide it in" is solved by doing it', (await solved(0)));
  await click('btn-di-mode'); rt = await ratios();
  t('dielectric: opening the switch with the slab in moves no charge (Q stays ×4, V stays 12 V)', JSON.stringify(rt) === JSON.stringify([4, 4, 1, 1, 4]), rt.join(' '));
  await setR('inp-di-f', 0); rt = await ratios();
  t('dielectric, disconnected, slab pulled out: Q fixed, V and E ×κ, U = Q²/2C ×κ²', JSON.stringify(rt) === JSON.stringify([1, 4, 4, 4, 16]), rt.join(' '));
  await click('btn-di-mode'); await click('btn-di-mode');      // reconnect (charge back to Q0), disconnect empty
  await setR('inp-di-f', 1); rt = await ratios();
  t('dielectric, disconnected empty, slab in: V, E and U fall by κ (×0.25)', JSON.stringify(rt) === JSON.stringify([4, 1, 0.25, 0.25, 0.25]), rt.join(' '));
  t('mission "disconnect, then insert: V to a quarter" is solved by doing it', (await solved(1)));
  await setR('inp-di-f', 0); await p.waitForTimeout(200);
  t('mission "pull the slab out: does U rise?" is solved by doing it', (await solved(2)));

  // ── deflection: y = qVL²/(2mdv₀²), tan α = qVL/(mdv₀²), a straight line to the screen ──
  await open('elc-deflection'); await p.waitForTimeout(400);
  const dfm = () => p.evaluate(() => document.querySelector('#app canvas').__df);
  await setR('inp-df-V', 100); await setR('inp-df-v0', 2); await setR('inp-df-L', 10); await p.waitForTimeout(200);
  let df1 = await dfm(), dtx = await txt();
  const yWant = e * 100 * 0.1 ** 2 / (2 * me * 0.04 * 2e7 ** 2), aWant = Math.atan(e * 100 * 0.1 / (me * 0.04 * 2e7 ** 2)) * 180 / Math.PI;
  t('deflection at the exit: y = qVL²/(2mdv₀²)', Math.abs(df1.y - yWant) < 1e-9 && new RegExp('y = ½at² = ' + (yWant * 1000).toFixed(2) + ' mm').test(dtx), df1.y + ' vs ' + yWant);
  t('exit angle: tan α = qVL/(mdv₀²), printed', Math.abs(df1.ang - aWant) < 1e-9 && new RegExp('α = ' + aWant.toFixed(1) + '°').test(dtx), df1.ang + ' vs ' + aWant);
  t('on the screen: y + tan α · D (a straight line after the plates)', Math.abs(df1.Ys - (df1.y + Math.tan(aWant * Math.PI / 180) * df1.D)) < 1e-12, df1.Ys);
  await setR('inp-df-v0', 4); await p.waitForTimeout(200);
  const df2 = await dfm();
  t('doubling v₀ divides the exit deflection by 4', Math.abs(df1.y / df2.y - 4) < 1e-9, (df1.y / df2.y).toFixed(4));
  await setR('inp-df-v0', 2);
  for (let v = 100; v <= 300; v += 10) { await setR('inp-df-V', v); await p.waitForTimeout(60); const d3 = await dfm(); if (Math.abs(d3.Ys - d3.YT) < 0.0015) break; }
  await p.waitForTimeout(150);
  t('mission "hit the target" is reachable with the sliders and solved', (await solved(0)), JSON.stringify(await dfm()));
  await setR('inp-df-V', 300); await setR('inp-df-v0', 1.5); await p.waitForTimeout(200);
  t('V = 300 V at v₀ = 1.5×10⁷ m/s: the electron hits the plate', (await dfm()).hit === true);
  await setR('inp-df-v0', 3); await p.waitForTimeout(200);
  t('a faster electron is rescued: mission solved', (await dfm()).hit === false && (await solved(1)));

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
  const TOUCH = [
    ['electro', 'elc-charge', 'elc-basics', W => [[W * 0.22, 170], [W * 0.35, 160], [W * 0.5, 150]], { text: '^[✓•] 1\\.' }],
    ['electro', 'elc-charge', 'elc-coulomb', W => { const c = (W - 80) / (W < 560 ? 40 : 60), x = W / 2 - 10 * c; return [[x, 112], [x - 20, 112], [x - 40, 112]]; }, { text: '^r = ' }],
    ['electro', 'elc-charge', 'elc-field', (W, H) => [[W * 0.68, H * 0.3], [W * 0.62, H * 0.35], [W * 0.55, H * 0.4]], { text: '^\\|E\\| = ' }],
    ['electro', 'elc-charge', 'elc-plane', (W, H) => [[W * 0.5, H * 0.3], [W * 0.45, H * 0.3], [W * 0.1, H * 0.3]], { text: '^E = E₁ \\+ E₂|^E₁ \\+ E₂' }],
    ['electro', 'elc-charge', 'elc-conductor', (W, H) => [[W * 0.27 + 95, H * 0.42 - 40], [W * 0.27 + 60, H * 0.42 - 30], [W * 0.27 + 30, H * 0.42 - 10]], { text: '^' + LR('גשוש r=') }],
    ['electro', 'elc-energy', 'elc-potential', (W, H) => [[W * 0.7, H * 0.26], [W * 0.65, H * 0.3], [W * 0.6, H * 0.34]], { text: '^V = ' }],
    ['electro', 'elc-energy', 'elc-upair', (W, H) => { const c = (W - 60) / (W < 560 ? 40 : 60), x = W / 2 + 15 * c; return [[x, H * 0.3], [x + 20, H * 0.3], [x + 40, H * 0.3]]; }, { text: '^r = ' }],
    ['electro', 'elc-energy', 'elc-sphere', W => [[46 + 0.2 * (W - 60), 300], [46 + 0.4 * (W - 60), 300], [46 + 0.6 * (W - 60), 300]], { text: '^r = [0-9]' }],
    ['electro', 'elc-energy', 'elc-plates', (W, H) => [[W * 0.28 - 20, H / 2], [W * 0.28 - 40, H / 2], [W * 0.28 - 60, H / 2]], { slider: 'elc-v0' }],
    ['electro', 'elc-energy', 'elc-capacitor', W => [[W * 0.3 + 72, 193], [W * 0.3 + 90, 193], [W * 0.3 + 110, 193]], { slider: 'elc-cd' }],
    ['electro', 'elc-energy', 'elc-dielectric', (W, H) => [[W * 0.5, H * 0.28], [W * 0.4, H * 0.28], [W * 0.3, H * 0.28]], { slider: 'di-f' }],
    ['electro', 'elc-energy', 'elc-compare', W => [[52 + 0.2 * (W - 68), 200], [52 + 0.4 * (W - 68), 200], [52 + 0.6 * (W - 68), 200]], { text: '^r = ' }],
    ['electro', 'elc-motion', 'elc-millikan', W => [[W * 0.44, 200], [W * 0.44, 180], [W * 0.44, 150]], { slider: 'mk-V' }],
    ['electro', 'elc-motion', 'elc-deflection', (W, H) => [[W * 0.4514, H * 0.55 + 4], [W * 0.42, H * 0.55 + 4], [W * 0.38, H * 0.55 + 4]], { slider: 'df-L' }],
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
  console.log(`check_electro: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ELECTROSTATICS ANSWERS AND SIMULATIONS AGREE WITH THE PHYSICS');
  process.exit(fail ? 1 : 0);
})();
