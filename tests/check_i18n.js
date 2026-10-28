// A translated build shows no Hebrew anywhere: page text, tooltips and
// screen-reader labels, and every string drawn on every canvas -- in every
// section, every tab, every quiz question, and the panels around them.
// Also: no translation placeholder (⟦n⟧) leaked, no page error.
//
//   node tests/check_i18n.js [lang]          (default en; reads i18n/<lang>/config.json)
//   APP_FILE=path/to/build.html node tests/check_i18n.js en
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const lang = process.argv[2] || 'en';
const conf = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'i18n', lang, 'config.json'), 'utf8'));
const FILE = process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', conf.file);
const F = 'file://' + FILE;

const HOOK = `(() => {
  window.__cv = [];
  for (const P of [CanvasRenderingContext2D.prototype]) for (const m of ['fillText', 'strokeText']) {
    const o = P[m]; P[m] = function (t, ...a) { try { window.__cv.push(String(t)); } catch (e) {} return o.call(this, t, ...a); };
  }
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(HOOK);
  await p.route(/^https?:/, r => r.abort());
  await p.goto(F); await p.waitForTimeout(1200);

  const SCAN = () => {
    const HEB = /[֐-׿]/, out = [];
    const ok = (el) => el && el.closest && el.closest('[lang="he"]');     // the language menu names Hebrew in Hebrew
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.textContent; if (!t || !t.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('script,style') || ok(el)) continue;
      if (HEB.test(t)) out.push('text: ' + t.trim().slice(0, 70));
      if (/⟦\d+⟧/.test(t)) out.push('placeholder: ' + t.trim().slice(0, 70));
    }
    document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el => {
      if (ok(el)) return;
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && HEB.test(v)) out.push(a + ': ' + v.slice(0, 70)); }
    });
    (window.__cv || []).forEach(t => { if (HEB.test(t)) out.push('canvas: ' + t.slice(0, 70)); if (/⟦\d+⟧/.test(t)) out.push('canvas placeholder: ' + t.slice(0, 70)); });
    window.__cv = [];
    if (document.title && HEB.test(document.title)) out.push('document.title: ' + document.title);
    return out;
  };

  const meta = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, app: typeof APP_LANG === 'string' ? APP_LANG : null }));
  const found = {}; const note = (where, list) => list.forEach(x => { (found[x] = found[x] || []).push(where); });
  // text the stylesheet generates (content:'…') is on screen too
  const html = fs.readFileSync(FILE, 'utf8');
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g))
    for (const c of m[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/content:\s*(['"])([^'"]*)\1/g))
      if (/[\u0590-\u05FF]/.test(c[2])) note('stylesheet', ['css content: ' + c[2]]);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const subjects = await p.evaluate(() => [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]]
    .map(q => ({ s: q[0], ch: q[1].map(c => ({ id: c.id, se: c.sections.map(x => x.id) })) })));
  let views = 0;
  for (const S of subjects) for (const ch of S.ch) for (const se of ch.se) {
    const r = await p.evaluate(async ([s, c, x, SCANsrc]) => {
      const SCAN = eval('(' + SCANsrc + ')'), out = []; let v = 0;
      const wait = (ms) => new Promise(r2 => setTimeout(r2, ms));
      state.subject = s; state.chapter = c; state.section = x;
      for (const tab of ['theory', 'sim']) {
        state.tab = tab; render(); await wait(tab === 'sim' ? 900 : 700); v++;
        document.querySelectorAll('#app details').forEach(d => { d.open = true; });
        await wait(60);
        SCAN().forEach(t => out.push([tab, t]));
      }
      const C = CONTENT[c + '.' + x];
      if (C && C.quiz) for (let qi = 0; qi < C.quiz.length; qi++) {
        state.quizState[c + '.' + x] = { cur: qi, ans: [], done: false, v: 2 };
        state.tab = 'quiz'; render(); await wait(40); v++;
        SCAN().forEach(t => out.push(['quiz #' + qi, t]));
        // the answered state: explanation and feedback
        if (window.answerQuiz) { answerQuiz(0); await wait(40); SCAN().forEach(t => out.push(['quiz #' + qi + ' answered', t])); }
      }
      if (C && C.problem) {
        state.problemState[c + '.' + x] = undefined; state.tab = 'problem'; render(); await wait(80); v++;
        SCAN().forEach(t => out.push(['problem', t]));
        // every hint level and the feedback of a wrong answer
        const steps = (C.problem.steps || []).length;
        for (let si = 0; si < steps; si++) {
          if (window.showHint) { showHint(si); showHint(si); }
          if (window.upInp && window.chkStep) { upInp(si, '123456'); chkStep(si); chkStep(si); chkStep(si); }
        }
        await wait(60); SCAN().forEach(t => out.push(['problem (hints, feedback)', t]));
      }
      return { out, v };
    }, [S.s, ch.id, se, SCAN.toString()]);
    views += r.v;
    r.out.forEach(([tab, t]) => note(`${ch.id}.${se}/${tab}`, [t]));
  }
  // the panels and dialogs around the content
  for (const act of ['openFormulaPanel()', 'openChangelog()', 'openDrawer()', 'showOnboarding()', "openLangMenu(document.getElementById('lang-btn'))"]) {
    const r = await p.evaluate(async ([a, SCANsrc]) => {
      const SCAN = eval('(' + SCANsrc + ')');
      try { closeDrawer(); closeFormulaPanel(); closeChangelog(); closeLangMenu && closeLangMenu(); } catch (e) {}
      try { eval(a); } catch (e) { return ['(could not run ' + a + ': ' + e.message + ')']; }
      await new Promise(r2 => setTimeout(r2, 300));
      const o = SCAN();
      try { closeDrawer(); closeFormulaPanel(); closeChangelog(); closeLangMenu && closeLangMenu(); if (window.closeOnboarding) closeOnboarding(); } catch (e) {}
      return o;
    }, [act, SCAN.toString()]);
    note('panel ' + act, r);
  }
  await b.close();

  const keys = Object.keys(found);
  console.log(`   ${path.basename(FILE)}: <html lang="${meta.lang}" dir="${meta.dir}">, APP_LANG=${meta.app}; ${views} views scanned`);
  keys.slice(0, 60).forEach(k => console.log('   HEBREW ' + JSON.stringify(k) + '  @' + found[k][0] + (found[k].length > 1 ? ` (+${found[k].length - 1})` : '')));
  console.log(`   page errors: ${errs.length ? [...new Set(errs)].slice(0, 5).join(' | ') : 'NONE'}`);
  const ok = !keys.length && !errs.length && meta.lang === conf.lang && meta.dir === conf.dir && meta.app === conf.lang;
  console.log(ok ? `\n✅ ${conf.name.toUpperCase()}: NO HEBREW LEFT ANYWHERE, NO PLACEHOLDER LEAKED` : `\n❌ ${keys.length} UNTRANSLATED TEXTS` + (meta.app !== conf.lang ? ' (and APP_LANG is wrong)' : ''));
  process.exit(ok ? 0 : 1);
})();
