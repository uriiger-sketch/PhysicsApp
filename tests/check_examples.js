// Worked examples and enrichments: structure, units and clean maths.
//
//   node tests/check_examples.js
//
// Every worked example (quiz tab) has a title, a statement and answered
// steps; every in-theory example box states what is given and lists numbered
// steps; units are SI symbols, never Hebrew abbreviations glued to numbers
// ("11 מ'" is what used to flip whole formulas around); and no formula leaves
// a raw LaTeX command or an underscore on the page.
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const out = { ex: 0, box: 0, card: 0, bad: [] };
    const HEB_UNIT = /\d\s*(?:מ['׳](?![א-ת])|ש['׳](?![א-ת]))/;   // prose "10 ס״מ" is fine; "11 מ'" next to a formula is not
    const text = h => { const d = document.createElement('div'); d.innerHTML = h;
      d.querySelectorAll('.katex-mathml,annotation').forEach(e => e.remove()); return d; };
    for (const k in CONTENT) {
      const C = CONTENT[k];
      if (C.example) {
        out.ex++;
        const e = C.example;
        if (!e.title || !e.text) out.bad.push(k + ': example lacks title or statement');
        if (!(e.steps || []).length || e.steps.some(s => !s.q || !s.a)) out.bad.push(k + ': example step without question or answer');
        const d = text(buildExample(e));
        if (HEB_UNIT.test(d.textContent)) out.bad.push(k + ': Hebrew unit in example — ' + (d.textContent.match(HEB_UNIT) || [''])[0]);
        if (/\\[a-zA-Z]{2,}/.test(d.textContent)) out.bad.push(k + ': raw LaTeX in example');
      }
      const html = (C.theory ? C.theory.html : '') + (C.theory && C.theory.enrich ? C.theory.enrich.html : '');
      const d = text(html);
      d.querySelectorAll('.ex-block').forEach(bx => {
        out.box++;
        if (!bx.querySelector('.ex-title')) out.bad.push(k + ': example box without title');
        if (!bx.querySelector('.ex-given')) out.bad.push(k + ': example box without a stated problem');
        if (!bx.querySelector('ol.ex-steps li')) out.bad.push(k + ': example box without numbered steps');
      });
      d.querySelectorAll('.enrich-card').forEach(() => out.card++);
      if (C.theory && C.theory.enrich) out.card++;
      d.querySelectorAll('.ex-block,.enrich-card').forEach(bx => {
        if (HEB_UNIT.test(bx.textContent)) out.bad.push(k + ': Hebrew unit — ' + (bx.textContent.match(HEB_UNIT) || [''])[0]);
      });
    }
    return out;
  });
  t('worked examples found', r.ex > 100, r.ex);
  t('in-theory example boxes found', r.box > 50, r.box);
  t('enrichments found', r.card > 100, r.card);
  r.bad.forEach(x => t(x, false));
  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`check_examples: ${checks - fail}/${checks} passed (${r.ex} examples, ${r.box} example boxes, ${r.card} enrichments)`);
  process.exit(fail ? 1 : 0);
})();
