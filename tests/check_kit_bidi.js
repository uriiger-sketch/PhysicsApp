// Mathematics in the sim kit's texts reads left to right, on screen.
//
// The kit's texts -- missions, hints, the reason shown when a mission is
// solved, the prediction and its answer, the live model line, the mode bar --
// are built after the page's render and change as the learner works, so
// check_bidi (which scans each tab as it first opens) sees few of them. Here
// every simulation of every subject is opened with all its missions solved,
// every hint open and its prediction answered (each option in turn), at a
// phone's width and a desktop's, and every run of mathematics in those texts
// and in the simulation's description is measured where it really lands: the
// run is broken when its first character sits to the right of its last one
// (the bidi algorithm laid it out right to left, "A 2.0" or "³x/1").
//
// A run is a number with its unit ("2.0 A", "6×10¹⁹ C"), a relation
// ("θc = 41.8°", "B′ = 2B"), a fraction ("1/x³", "v²/r", "n₂/n₁") or a primed
// symbol ("B′"): the last two are what check_bidi's pattern misses (a prime
// is a neutral character that a right-to-left line takes to the far side of
// its letter; ¹ ² ³ are not in the ⁰–⁹ block).
//
// On the Hebrew master only runs inside Hebrew text are judged. On a
// left-to-right edition every run in those texts is, and must read left to
// right as well (a stray right-to-left context would break it).
// Before the scan, a probe of its own: runs written raw into a right-to-left
// line must be found broken, and the same runs as kit maths, intact.
//
//   node tests/check_kit_bidi.js
//   APP_FILE=<edition.html> node tests/check_kit_bidi.js
//   WIDTHS=320,390 node tests/check_kit_bidi.js        (default 390,1366)
const { chromium } = require('playwright');
const path = require('path');
const { LANG } = require('./_lang.js');
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));
const WIDTHS = (process.env.WIDTHS || '390,1366').split(',').map(Number);

let n = 0, fail = 0;
const t = (name, ok, info) => {
  n++; if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? ' — ' + info : ''}`);
};

// Runs in the page: every run in the given roots, with where its ends land.
// hebOnly: judge only text whose block holds Hebrew.
const SCAN = (roots, hebOnly) => {
  const HEB = /[֐-׿]/;
  const L = 'A-Za-z\\u0370-\\u03FF', SUP = '⁰¹²³⁴-⁹⁺⁻', SUB = '₀-₉ₐ-ₜ', PR = '′″';
  const SYM = `[${L}][${L}${SUB}${SUP}${PR}]*`;
  const RUN = new RegExp([
    // a relation: θc = 41.8°, R₁ ≈ 4 Ω, B′ = 2B, I = −0.5 A
    `${SYM}\\s?[=<>≤≥≈≠]\\s?[+\\-−±]?[\\d${L}][\\d.,/${L}${SUB}${SUP}${PR}°%]*(?:\\s?(?:×\\s?10[${SUP}]+|[${L}µΩ°%][${L}/·${SUP}]*))?`,
    // a fraction: 1/x³, v²/r, n₂/n₁, 1/2.42
    `(?:\\d[\\d.,]*|${SYM})\\/[\\d${L}][\\d.,${L}${SUB}${SUP}${PR}]*`,
    // a quantity: 2.0 A, 580 nm, 6×10¹⁹ C, 4.29×10¹⁴ Hz
    `[+\\-−±]?\\d[\\d.,]*(?:\\s?×\\s?10[${SUP}]+)?\\s?(?:[${L}µΩ][${L}/·${SUP}Ω]*|×\\s?10[${SUP}]+)`,
    // a primed symbol: B′, x″
    `[${L}][${SUB}]*[${PR}]+`,
  ].join('|'), 'g');
  const out = [];
  const seen = new Set();
  roots.forEach(root => {
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let nd;
    while ((nd = w.nextNode())) {
      if (seen.has(nd)) continue; seen.add(nd);
      const s = nd.nodeValue; if (!s || !s.trim()) continue;
      const pe = nd.parentElement;
      if (!pe || pe.closest('script,style,.visually-hidden')) continue;
      // the block the text sits in decides whether it is a Hebrew line
      let blk = pe; while (blk && getComputedStyle(blk).display.indexOf('inline') === 0) blk = blk.parentElement;
      if (hebOnly && (!blk || !HEB.test(blk.textContent))) continue;
      let m; RUN.lastIndex = 0;
      while ((m = RUN.exec(s))) {
        // sentence punctuation is the sentence's, not the run's
        const run = m[0].replace(/[.,;:]+$/, '').trim();
        if (run.length < 2 || HEB.test(run)) continue;
        // a bare symbol or number is no run; a prime, a slash, a relation, a power, a space are
        if (!/[\s=<>≤≥≈≠/′″×]/.test(run)) continue;
        const a = s.indexOf(run, m.index), z = a + run.length - 1;
        const rg = document.createRange();
        rg.setStart(nd, a); rg.setEnd(nd, a + 1); const b1 = rg.getBoundingClientRect();
        rg.setStart(nd, z); rg.setEnd(nd, z + 1); const b2 = rg.getBoundingClientRect();
        if (!b1.width || !b2.width) continue;                       // not on screen
        if (Math.abs(b1.top - b2.top) > 4) continue;                // wrapped over two lines: no order to judge
        out.push({ s: run, ok: b1.left < b2.left, ctx: s.slice(Math.max(0, a - 20), z + 20).replace(/\s+/g, ' ') });
      }
    }
  });
  return out;
};

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const errs = [];
  let checked = 0;
  const bad = [];
  const kinds = { rel: 0, frac: 0, prime: 0 };
  for (const W of WIDTHS) {
    const p = await b.newPage({ viewport: { width: W, height: 900 } });
    p.on('pageerror', e => errs.push(W + ': ' + e.message));
    await p.route(/^https?:/, r => r.abort());
    await p.goto(F); await p.waitForTimeout(1200);
    await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {}; });

    // ── the probe sees what it must: raw maths in a right-to-left line is
    // found broken, the same maths as kit maths (_skM) is found intact ──
    if (W === WIDTHS[0]) {
      const self = await p.evaluate(([scan]) => {
        const SCAN = eval(scan);
        const host = document.createElement('div'); host.dir = 'rtl'; host.lang = 'he';
        host.style.cssText = 'position:absolute;top:0;left:0;width:340px;font:16px Heebo,sans-serif';
        // (a letter first holds a run together on its own -- "v²/r", "I = 2.0 A";
        // a number first, or a prime last, is what the line pulls apart)
        const raw = ['השדה ב־B′ גדל', 'הכוח יורד כמו 1/x³ כאן', 'הזרם 2.0 A בענף'];
        host.innerHTML = raw.map(x => '<p>' + x + '</p>').join('') +
          '<p>השדה ב־' + _skM('B′') + ' גדל, הכוח כמו ' + _skM('1/x³') + ' כאן, ו־' + _skM('v²/r') + ' ו־' + _skM('2.0 A') + ' ו־' + _skM('n₂/n₁') + '.</p>';
        document.body.appendChild(host);
        const ps = host.querySelectorAll('p');
        const rawRes = SCAN([].slice.call(ps, 0, raw.length), true), kitRes = SCAN([ps[raw.length]], true);
        host.remove();
        return { raw: rawRes.map(r => r.s + (r.ok ? ':ok' : ':broken')), kit: kitRes.map(r => r.s + (r.ok ? ':ok' : ':broken')) };
      }, ['(' + SCAN.toString() + ')']);
      t('the probe finds raw B′, 1/x³ and 2.0 A in a right-to-left line broken', ['B′', '1/x³', '2.0 A'].every(r => self.raw.includes(r + ':broken')), self.raw.join(' '));
      t('the probe finds the same maths intact once it is kit maths (_skM)', self.kit.length >= 5 && self.kit.every(r => /:ok$/.test(r)), self.kit.join(' '));
    }

    const list = await p.evaluate(() => {
      const o = [];
      for (const [sub, chs] of [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]])
        for (const ch of chs) for (const s of ch.sections) if (CONTENT[ch.id + '.' + s.id] && CONTENT[ch.id + '.' + s.id].sim) o.push([sub, ch.id, s.id]);
      return o;
    });
    let panels = 0;
    for (const [sub, c, se] of list) {
      for (let opt = 0; opt < 4; opt++) {
        await p.evaluate(([sub, c, x]) => {
          state.missions = state.missions || {}; state.missions[c + '.' + x] = { 0: true, 1: true, 2: true, 3: true, 4: true };
          state.subject = sub; state.chapter = c; state.section = x; state.tab = 'sim'; render();
        }, [sub, c, se]);
        await p.waitForTimeout(650);
        await p.evaluate((opt) => {
          document.querySelectorAll('#app .sk-hint-b').forEach(h => { if (h.getAttribute('aria-expanded') !== 'true') h.click(); });
          const o = document.querySelectorAll('#app .sk-opt')[opt]; if (o) o.click();
        }, opt);
        await p.waitForTimeout(300);
        const res = await p.evaluate(([scan, hebOnly]) => {
          const S = eval(scan), app = document.getElementById('app');
          const roots = [app.querySelector('.sk-panel'), app.querySelector('.sk-tabs'), app.querySelector('.sim-container > .sim-controls > p')];
          return { runs: S(roots, hebOnly), panel: !!roots[0], opts: app.querySelectorAll('.sk-opt').length };
        }, ['(' + SCAN.toString() + ')', LANG === 'he']);
        if (res.panel && opt === 0) panels++;
        for (const r of res.runs) {
          checked++;
          if (/[=<>≤≥≈≠]/.test(r.s)) kinds.rel++;
          if (/\//.test(r.s)) kinds.frac++;
          if (/[′″]/.test(r.s)) kinds.prime++;
          if (!r.ok) bad.push(`${W} ${c}.${se}${res.opts ? ' (prediction ' + (opt + 1) + ')' : ''}: «${r.s}» in «${r.ctx}»`);
        }
        if (opt + 1 >= res.opts) break;          // every option answered once (none: one pass)
      }
    }
    // (88 of 107 when this test was written: the scan must not quietly find none)
    t(`${W} px: the simulations' kit panels were scanned (${panels} of ${list.length} sims have one)`, panels >= 0.75 * list.length, panels + ' panels');
    await p.close();
  }
  const uniq = [...new Set(bad)];
  console.log(`   ${checked} runs measured (${kinds.rel} relations, ${kinds.frac} fractions, ${kinds.prime} with a prime), in ${LANG === 'he' ? 'Hebrew lines' : 'every line'}`);
  if (uniq.length) { console.log(`   ${uniq.length} broken, first few:`); uniq.slice(0, 15).forEach(x => console.log('      ' + x)); }
  t('every run of mathematics in the kit texts reads left to right', uniq.length === 0, uniq.length + ' broken');
  t('the scan measured the runs it should (relations, fractions and primes among them)', checked > 500 && kinds.frac > 0 && kinds.prime > 0, JSON.stringify(kinds));
  t('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`check_kit_bidi: ${n - fail}/${n} passed`);
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ THE KIT\'S MATHEMATICS READS LEFT TO RIGHT');
  process.exit(fail ? 1 : 0);
})();
