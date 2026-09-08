// Mathematics inside Hebrew text must read left to right. This does not guess:
// for every formula-looking run it measures where the FIRST and LAST character
// actually land on screen, and reports the run as broken when the first sits to
// the right of the last (i.e. the run was reordered as if it were Hebrew).
//
//   node tests/check_bidi.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0;
const t = (name, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${got} want ${want}`);
};

const SCAN = `(() => {
  const HEB = /[\\u0590-\\u05FF]/;
  // a formula: contains a relation or operator, and no Hebrew of its own
  const MATH = /[A-Za-z0-9₀-₉⁰-⁹\\u0370-\\u03FF()\\[\\]{}.,^_|√°%]+(?:\\s*[=≈≠<>≤≥+\\-−×·*/^⇒→∝]\\s*[A-Za-z0-9₀-₉⁰-⁹\\u0370-\\u03FF()\\[\\]{}.,^_|√°%]+)+/g;
  const out = [];
  const host = document.getElementById('app');
  if (!host) return out;
  const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let e = n.parentElement;
      while (e && e !== host) {
        const tag = e.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
        if (e.classList.contains('katex') || e.classList.contains('math-ltr')) return NodeFilter.FILTER_REJECT;
        if (e.getAttribute && e.getAttribute('dir') === 'ltr') return NodeFilter.FILTER_REJECT;
        e = e.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walk.nextNode())) {
    const s = n.nodeValue;
    // only text that actually sits in a Hebrew (RTL) context can be reordered
    if (!HEB.test(n.parentElement.textContent)) continue;
    MATH.lastIndex = 0;
    let m;
    while ((m = MATH.exec(s))) {
      // sentence punctuation is not part of the formula; a trailing full stop
      // belongs to the Hebrew sentence and legitimately sits on its left
      let run = m[0].trim().replace(/[.,;:]+$/, '');
      const count = (str, chr) => str.split(chr).length - 1;
      while (run.length && count(run, ')') > count(run, '(') && run.endsWith(')'))
        run = run.slice(0, -1);
      while (run.length && count(run, '(') > count(run, ')') && run.startsWith('('))
        run = run.slice(1);
      if (run.length < 3 || HEB.test(run)) continue;
      const off = s.indexOf(run, m.index);
      if (off < 0) continue;
      const i0 = off, i1 = i0 + run.length - 1;
      const box = (a, b2) => { const r = document.createRange(); r.setStart(n, a); r.setEnd(n, b2);
        return r.getBoundingClientRect(); };
      const A = box(i0, i0 + 1), B = box(i1, i1 + 1);
      if (!A.width || !B.width) continue;
      if (Math.abs(A.top - B.top) > 4) continue;          // wrapped across lines
      if (A.left > B.left) out.push(run);                  // first char to the RIGHT of last
    }
  }
  return out;
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto(F);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const chapters = await p.evaluate(() => [].concat(MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS)
    .map(c => ({ id: c.id, s: c.sections.map(x => x.id) })));

  const bad = {};
  let scanned = 0;
  for (const ch of chapters) for (const se of ch.s) {
    for (const tab of ['theory', 'quiz', 'problem', 'sim']) {
      const hits = await p.evaluate(async ([c, x, tb, scan]) => {
        state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : 'mechanics';
        state.chapter = c; state.section = x; state.tab = tb;
        markCompleted(c, x, 'quiz', 0);
        render();
        await new Promise(r => setTimeout(r, tb === 'theory' ? 620 : tb === 'sim' ? 750 : 120));
        if (tb === 'theory') document.querySelectorAll('.fold-btn').forEach(b2 => b2.click());
        if (tb === 'quiz') {   // reveal an explanation, which is where much of the maths lives
          const o = document.querySelector('#app .quiz-opt'); if (o) o.click();
          await new Promise(r => setTimeout(r, 40));
        }
        return eval(scan);
      }, [ch.id, se, tab, SCAN]);
      scanned++;
      hits.forEach(h => { const k = `${ch.id}.${se}/${tab}`; (bad[k] = bad[k] || []).push(h); });
    }
  }
  const keys = Object.keys(bad);
  const total = keys.reduce((a, k) => a + bad[k].length, 0);
  console.log(`   ${scanned} tab-renders scanned`);
  if (total) {
    console.log(`   ${total} misordered formulas in ${keys.length} places, first few:`);
    keys.slice(0, 12).forEach(k => console.log(`      ${k}: ${[...new Set(bad[k])].slice(0, 4).map(x => JSON.stringify(x)).join(', ')}`));
  }
  t('no formula renders right-to-left', total, 0);
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ALL MATHS READS LEFT TO RIGHT');
  process.exit(fail ? 1 : 0);
})();
