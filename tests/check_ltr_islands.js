// Maths with no Hebrew around it ("7 N", "15 cm", "N=kg·m/s²") sitting in a
// right-to-left page: the browser's bidi algorithm swaps a number and its unit
// unless the run is set left to right. check_bidi looks at maths inside Hebrew
// sentences; this looks at the islands that have no Hebrew at all — quiz
// options, answers, labels — in every section, every quiz question and every
// problem step, and measures where their first and last characters land.
//
//   node tests/check_ltr_islands.js
const { chromium } = require('playwright');
const path = require('path');
const K = require('./_katex');   // KATEX=local: with KaTeX loaded
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await K.route(p);
  await p.goto(F); await p.waitForTimeout(1200);
  await K.ready(p);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {}; });

  const SCAN = () => {
    const HEB = /[֐-׿]/, RUNS = /[0-9A-Za-zͰ-Ͽ√∞][^]*[\s,;:=+\-−×·\/()][^]*[0-9A-Za-zͰ-Ͽ√∞]/;
    const bad = [];
    const blockOf = n => { let e = n.parentElement; while (e && getComputedStyle(e).display.indexOf('inline') === 0) e = e.parentElement; return e; };
    const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent; if (!t.trim() || HEB.test(t) || !RUNS.test(t.trim())) continue;
      const el = n.parentElement; if (!el || el.closest('canvas,svg,.katex,script,style')) continue;
      if (getComputedStyle(el).direction !== 'rtl') continue;           // already set left to right
      const blk = blockOf(n); if (!blk || HEB.test(blk.textContent)) continue;  // maths inside Hebrew: check_bidi's job
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const s = t.search(/\S/), e = t.replace(/\s+$/, '').length - 1;
      const rg = document.createRange();
      rg.setStart(n, s); rg.setEnd(n, s + 1); const a = rg.getBoundingClientRect();
      rg.setStart(n, e); rg.setEnd(n, e + 1); const z = rg.getBoundingClientRect();
      if (Math.abs(a.top - z.top) > 4) continue;                        // wrapped: order across lines is not comparable
      if (a.left > z.left) bad.push(t.trim().slice(0, 40));
    }
    return bad;
  };

  const subjects = await p.evaluate(() => [['mechanics', MECH_CHAPTERS, 'CONTENT'], ['optics', OPTICS_CHAPTERS, 'OPTICS_CONTENT'],
    ['electro', ELECTRO_CHAPTERS, 'ELECTRO_CONTENT'], ['circuits', DC_CHAPTERS, 'DC_CONTENT'], ['magnetism', MAG_CHAPTERS, 'MAG_CONTENT']]
    .map(q => ({ s: q[0], C: q[2], ch: q[1].map(c => ({ id: c.id, se: c.sections.map(x => x.id) })) })));

  const found = {}; let views = 0;
  for (const S of subjects) for (const ch of S.ch) for (const se of ch.se) {
    const r = await p.evaluate(async ([s, Cn, c, x, SCANsrc]) => {
      const SCAN = eval('(' + SCANsrc + ')');
      const C = (0, eval)(Cn)[c + '.' + x]; const out = []; let v = 0;
      state.subject = s; state.chapter = c; state.section = x;
      state.tab = 'theory'; render(); await new Promise(r2 => setTimeout(r2, 120)); v++;
      SCAN().forEach(t => out.push('theory: ' + t));
      if (C && C.quiz) for (let qi = 0; qi < C.quiz.length; qi++) {
        state.quizState[c + '.' + x] = { cur: qi, ans: [], done: false, v: 2 };
        state.tab = 'quiz'; render(); await new Promise(r2 => setTimeout(r2, 30)); v++;
        SCAN().forEach(t => out.push('quiz #' + qi + ': ' + t));
      }
      if (C && C.problem) {
        state.tab = 'problem'; render(); await new Promise(r2 => setTimeout(r2, 60)); v++;
        SCAN().forEach(t => out.push('problem: ' + t));
      }
      return { out, v };
    }, [S.s, S.C, ch.id, se, SCAN.toString()]);
    views += r.v;
    r.out.forEach(t => { (found[t] = found[t] || []).push(ch.id + '.' + se); });
  }
  const keys = Object.keys(found);
  console.log(`   ${views} views scanned (theory, every quiz question, problem) in all five subjects`);
  keys.slice(0, 40).forEach(k => console.log('   REVERSED ' + JSON.stringify(k) + ' @' + found[k][0]));
  console.log(`   page errors: ${errs.length ? errs.slice(0, 3).join(' | ') : 'NONE'}`);
  await b.close();
  const ok = !keys.length && !errs.length;
  console.log(ok ? '\n✅ NO NUMBER AND UNIT SWAP PLACES OUTSIDE HEBREW TEXT' : `\n❌ ${keys.length} REVERSED LEFT-TO-RIGHT ISLANDS`);
  process.exit(ok ? 0 : 1);
})();
