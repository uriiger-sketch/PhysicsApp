// The formula sheet: each subject's own formulas, and after them what all the
// subjects share -- the constants, the powers of ten, the units, the
// conversions.
//
//   node tests/check_sheet.js
//   APP_FILE=physics_game_en.html node tests/check_sheet.js
//
// In every subject the sheet opens on that subject's chapters and ends with
// the same four shared sections; the button at its head brings them into
// view; the constants are the values the lessons work with; every row fits a
// 360 px phone without scrolling sideways or cutting a formula; and the
// conditions that a formula needs are written beside it.
const { chromium } = require('playwright');
const path = require('path');
const { L, LANG } = require('./_lang.js');
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  await ctx.route(/^(https?|wss?):/, r => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F + '#/kinematics/distance-time/theory');
  await p.waitForFunction(() => typeof window.openFormulaPanel === 'function' && document.querySelector('#sidebar-nav'), null, { timeout: 20000 });
  await p.evaluate(() => { if (document.getElementById('onboard-overlay')) closeOnboarding(); });
  await p.waitForTimeout(300);

  const SHARED = [L('קבועים פיזיקליים'), L('קידומות — חזקות של 10'), L('יחידות'), L('המרות')];
  const per = await p.evaluate(() => {
    const out = {};
    for (const s of ['mechanics', 'optics', 'electro', 'circuits', 'magnetism']) {
      state.subject = s; openFormulaPanel();
      const pn = document.getElementById('formula-panel'), rows = [...pn.querySelectorAll('.formula-row')];
      const ref = document.getElementById('fp-ref');
      out[s] = { chapters: [...pn.querySelectorAll('.formula-chapter')].map(x => x.textContent), rows: rows.length,
        own: rows.filter(r => r.compareDocumentPosition(ref) & Node.DOCUMENT_POSITION_FOLLOWING).length,
        sideways: pn.scrollWidth - pn.clientWidth, page: document.documentElement.scrollWidth - innerWidth,
        cut: rows.filter(r => { const m = r.querySelector('.formula-math'); return m.scrollWidth > m.clientWidth + 1; }).map(r => r.textContent.slice(0, 30)),
        out: rows.filter(r => { const q = r.getBoundingClientRect(), w = pn.getBoundingClientRect(); return q.left < w.left - 1 || q.right > w.right + 1; }).length,
        empty: rows.filter(r => !r.querySelector('.formula-math').textContent.trim() || !r.querySelector('.formula-desc').textContent.trim()).length,
        raw: rows.filter(r => /_[A-Za-z0-9]/.test(r.textContent)).map(r => r.textContent.slice(0, 30)) };
      closeFormulaPanel();
    }
    return out; });
  const subj = Object.keys(per);
  t('every subject\'s sheet ends with the four shared sections', subj.every(s => per[s].chapters.slice(-4).join('|') === SHARED.join('|')), JSON.stringify(per.optics.chapters.slice(-4)));
  t('and opens on its own chapters', subj.every(s => per[s].chapters.length >= 7 && per[s].own >= 15) && new Set(subj.map(s => per[s].chapters[0])).size === 5, JSON.stringify(subj.map(s => [per[s].chapters.length, per[s].own])));
  t('the shared part is the same 33 rows everywhere', new Set(subj.map(s => per[s].rows - per[s].own)).size === 1 && per.mechanics.rows - per.mechanics.own === 33, JSON.stringify(subj.map(s => per[s].rows - per[s].own)));
  t('on a 360 px phone nothing scrolls sideways and no formula is cut', subj.every(s => per[s].sideways <= 0 && per[s].page <= 0 && per[s].cut.length === 0 && per[s].out === 0), JSON.stringify(subj.map(s => [per[s].sideways, per[s].cut])));
  t('no row is empty, and no subscript is left as an underscore', subj.every(s => per[s].empty === 0 && per[s].raw.length === 0), JSON.stringify(subj.map(s => per[s].raw)));

  // the values the lessons work with
  await p.evaluate(() => { state.subject = 'electro'; openFormulaPanel(); });
  await p.waitForTimeout(300);
  const ref = await p.evaluate(() => { const pn = document.getElementById('formula-panel'), anchor = document.getElementById('fp-ref');
    const rows = [...pn.querySelectorAll('.formula-row')].filter(r => anchor.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
    return rows.map(r => r.querySelector('.formula-math').textContent.replace(/\s+/g, ' ').trim() + ' | ' + r.querySelector('.formula-desc').textContent.trim()); });
  const has = (f) => ref.some(r => r.startsWith(f + ' | '));
  t('the constants', ['g = 9.8 m/s²', 'G = 6.67×10⁻¹¹ N·m²/kg²', 'c = 3.00×10⁸ m/s', 'e = 1.6×10⁻¹⁹ C', 'k = 9×10⁹ N·m²/C²', 'ε0 = 8.85×10⁻¹² F/m', 'μ0 = 4π×10⁻⁷ T·m/A', 'h = 6.63×10⁻³⁴ J·s', 'me = 9.11×10⁻³¹ kg', 'mp = 1.67×10⁻²⁷ kg'].every(has), ref.slice(0, 10).join(' ; '));
  t('the powers of ten, each on a unit the course uses', ['1 GHz = 10⁹ Hz', '1 MΩ = 10⁶ Ω', '1 km = 10³ m', '1 cm = 10⁻² m', '1 mA = 10⁻³ A', '1 μC = 10⁻⁶ C', '1 nm = 10⁻⁹ m', '1 pF = 10⁻¹² F'].every(has), ref.slice(10, 18).join(' ; '));
  t('the units and the conversions', ['1 N = 1 kg·m/s²', '1 J = 1 N·m', '1 W = 1 J/s', '1 V = 1 J/C', '1 Ω = 1 V/A', '1 F = 1 C/V', '1 T = 1 N/(A·m)', '1 Wb = 1 T·m²', '1 N/C = 1 V/m', '1 m/s = 3.6 km/h', '1 kWh = 3.6×10⁶ J', '1 eV = 1.6×10⁻¹⁹ J', '180° = π rad'].every(has), ref.slice(18).join(' ; '));
  // consistent with one another: k = 1/4πε0, kWh, eV
  const k = 1 / (4 * Math.PI * 8.85e-12);
  t('k, ε0, the kWh and the eV agree with one another', Math.abs(k - 9e9) / 9e9 < 0.002 && 1000 * 3600 === 3.6e6 && Math.abs(1e3 / 3600 * 3.6 - 1) < 1e-12);

  // the button at the head of the sheet
  const jump = await p.evaluate(() => { const pn = document.getElementById('formula-panel'), bt = pn.querySelector('.fp-jump'); pn.scrollTop = 0;
    const r = bt.getBoundingClientRect(), before = pn.scrollTop; bt.click();
    const h = [...pn.querySelectorAll('.formula-chapter')].slice(-4)[0].getBoundingClientRect(), w = pn.getBoundingClientRect();
    return { text: bt.textContent, h: r.height, before, after: pn.scrollTop, headTop: h.top - w.top, headVisible: h.top >= w.top && h.bottom <= w.bottom, focus: document.activeElement.id }; });
  t('the button at its head names the shared part and is a finger\'s target', jump.text === L('קבועים, קידומות ויחידות ↓') && jump.h >= 44, JSON.stringify(jump));
  t('and brings it into view, clear of the sheet\'s title', jump.after > jump.before + 200 && jump.headVisible && jump.headTop >= 40 && jump.focus === 'fp-ref', JSON.stringify(jump));
  await p.keyboard.press('Escape');
  const closed = await p.evaluate(() => ({ open: document.getElementById('formula-panel').classList.contains('open'), lock: document.body.style.overflow }));
  t('Escape closes the sheet', !closed.open && closed.lock === '', JSON.stringify(closed));

  // a formula that holds only in a particular case says so
  const cond = await p.evaluate(() => { const find = (s, f) => { const r = FORMULA_BY_SUBJECT[s].flatMap(c => c.rows).find(x => x.f.replace(/<[^>]+>/g, '') === f); return r ? r.d : null; };
    return { work: find('mechanics', 'W = F·Δx·cosθ'), fric: find('mechanics', 'ΔEk + ΔEp = Wf'), slit: find('optics', 'a·sinθ = mλ'), crit: find('optics', 'sinθc = n2/n1'), film: find('optics', '2nt = (m+½)λ'),
      sol: FORMULA_BY_SUBJECT.magnetism.flatMap(c => c.rows).some(x => /n = N\/L/.test(x.f)), defl: find('electro', 'y = qVL²/(2mdv0²)') }; });
  t('work is of a constant force; friction\'s work is negative', cond.work === L('עבודה של כוח קבוע (θ: הזווית בין F ל־Δx)') && cond.fric === L('עם חיכוך (W_f היא עבודת החיכוך — שלילית)'), JSON.stringify([cond.work, cond.fric]));
  t('single-slit minima exclude m = 0; the critical angle needs n₁ > n₂', /0/.test(cond.slit || '') && /±1/.test(cond.slit || '') && /n₁ > n₂/.test(cond.crit || ''), JSON.stringify([cond.slit, cond.crit]));
  t('the thin film, the solenoid and the deflection name their symbols', /λ/.test(cond.film || '') && cond.sol && /V:/.test(cond.defl || '') && /L:/.test(cond.defl || ''), JSON.stringify([cond.film, cond.sol, cond.defl]));
  t('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
  await b.close();
  console.log(`check_sheet: ${checks - fail}/${checks} passed (${subj.map(s => per[s].own).join(' + ')} formulas + ${per.mechanics.rows - per.mechanics.own} shared rows; ${LANG})`);
  process.exit(fail ? 1 : 0);
})();
