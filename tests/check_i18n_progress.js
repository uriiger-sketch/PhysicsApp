// A learner's progress is the same in every language.
//
//   node tests/check_i18n_progress.js [lang]          (default en)
//   APP_FILE=<edition.html> node tests/check_i18n_progress.js
//
// The Hebrew page and an edition are served from one origin, as on the site,
// so they share localStorage. A learner finishes two quizzes in Hebrew (some
// answers wrong), leaves a third half done, then switches language with the 🌐
// menu: the edition must open the same topic and tab, and show the same XP,
// the same completed sections and every quiz exactly as it was left: the same
// answers on the same questions, the same score. Then a question is answered in
// the edition, and the Hebrew page must show it.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const lang = process.argv[2] || 'en';
const ROOT = path.resolve(__dirname, '..');
const CONF = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', lang, 'config.json'), 'utf8'));
const ORIGIN = 'http://progress.test/';
const FILES = {
  'physics_game_v28.html': path.join(ROOT, 'physics_game_v28.html'),
  [CONF.file]: process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.join(ROOT, CONF.file),
};

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) fail++; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? ': ' + info : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => {
    const name = r.request().url().split('#')[0].split('?')[0].replace(ORIGIN, '');
    if (FILES[name]) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(FILES[name]) });
    return r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.dismiss().catch(() => {}));
  const settle = async () => { await p.waitForFunction(() => typeof render === 'function' && typeof state === 'object', null, { timeout: 20000 }); await p.waitForTimeout(600);
    await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); }); };
  const open = (key, tab) => p.evaluate(([key, tab]) => {
    const [c, s] = key.split('.');
    state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : c.startsWith('dc-') ? 'circuits' : c.startsWith('mag-') ? 'magnetism' : 'mechanics';
    state.chapter = c; state.section = s; state.tab = tab; render();
  }, [key, tab]).then(() => p.waitForTimeout(80));
  const answer = async (which) => {
    const k = await p.evaluate(() => { const q = CONTENT[state.chapter + '.' + state.section].quiz[getQS(state.chapter, state.section).cur], v = quizView(q); return { c: v.correct, n: v.n }; });
    await p.click(`#app .quiz-opt >> nth=${which === 'right' ? k.c : (k.c + 1) % k.n}`);
    await p.waitForTimeout(60);
  };
  const next = async () => { await p.click('#app .quiz-card .btn'); await p.waitForTimeout(80); };
  // a quiz as the learner sees it: language-free facts only
  const look = (key) => p.evaluate((key) => {
    const [c, s] = key.split('.'), st = getQS(c, s);
    const score = ((document.querySelector('.done-banner p') || {}).textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    return { ans: JSON.stringify(st.ans), cur: st.cur, done: !!st.done, score: score ? score[1] + '/' + score[2] : null,
      dots: [...document.querySelectorAll('.qp-dot')].map(d => d.className.replace(/\s*\bcurrent\b/, '')).join(' '),
      marked: [...document.querySelectorAll('.quiz-opt')].map(o => /\bcorrect\b/.test(o.className) ? 'c' : /\bwrong\b/.test(o.className) ? 'w' : '-').join('') };
  }, key);
  const snapshot = async (keys) => {
    const o = { xp: await p.evaluate(() => state.xp), completed: await p.evaluate(() => JSON.stringify(Object.keys(state.completed).filter(k => state.completed[k]).sort())) };
    for (const k of keys) { await open(k, 'quiz'); o[k] = await look(k); }
    return o;
  };

  // ── in Hebrew: two quizzes finished, a third half done
  await p.goto(ORIGIN + 'physics_game_v28.html'); await settle();
  const keys = await p.evaluate(() => {
    const pick = (chs, ci, si) => chs[ci].id + '.' + chs[ci].sections[si].id;
    return [pick(MECH_CHAPTERS, 0, 1), pick(OPTICS_CHAPTERS, 1, 0), pick(MAG_CHAPTERS, 0, 1)];
  });
  for (const key of keys.slice(0, 2)) {
    await open(key, 'quiz');
    const n = await p.evaluate(k => CONTENT[k].quiz.length, key);
    for (let qi = 0; qi < n; qi++) { await answer(qi % 3 === 0 ? 'wrong' : 'right'); await next(); }
  }
  await open(keys[2], 'quiz'); await answer('right'); await next(); await answer('wrong');
  await open(keys[1], 'sim'); await p.waitForTimeout(200);
  const he = await snapshot(keys);
  t('Hebrew: two quizzes finished with a score, a third in progress', he[keys[0]].done && he[keys[1]].done && he[keys[0]].score && !he[keys[2]].done, JSON.stringify(he));

  // ── the 🌐 menu: the same topic and tab, in the edition
  await open(keys[1], 'sim');
  await p.click('#lang-btn'); await p.waitForTimeout(150);
  t('the language menu lists the edition', await p.locator(`.lang-item[lang="${lang}"]`).count() === 1);
  await Promise.all([p.waitForNavigation(), p.click(`.lang-item[lang="${lang}"]`)]);
  await settle();
  t(`the menu opens ${CONF.file}`, p.url().split('#')[0] === ORIGIN + CONF.file, p.url());
  t('in the edition\'s language', await p.evaluate(() => APP_LANG + ' ' + document.documentElement.lang) === `${lang} ${lang}`);
  const where = await p.evaluate(() => [state.chapter, state.section, state.tab].join('.'));
  t('the same topic and tab are open', where === keys[1] + '.sim', where);

  // ── every saved fact is the same
  const ed = await snapshot(keys);
  t('XP is the same', ed.xp === he.xp, he.xp + ' vs ' + ed.xp);
  t('the completed sections are the same', ed.completed === he.completed, ed.completed);
  for (const k of keys) {
    t(`${k}: the same answers on the same questions`, ed[k].ans === he[k].ans && ed[k].cur === he[k].cur && ed[k].done === he[k].done, JSON.stringify([he[k], ed[k]]));
    t(`${k}: the same progress dots and marked options`, ed[k].dots === he[k].dots && ed[k].marked === he[k].marked, JSON.stringify([he[k].dots, ed[k].dots, he[k].marked, ed[k].marked]));
    if (he[k].done) t(`${k}: the same score`, ed[k].score === he[k].score, he[k].score + ' vs ' + ed[k].score);
  }

  // ── an answer given in the edition is there in Hebrew
  await open(keys[2], 'quiz'); await next(); await answer('right');
  const ed2 = await look(keys[2]);
  await p.goto(ORIGIN + 'physics_game_v28.html'); await settle();
  await open(keys[2], 'quiz');
  const he2 = await look(keys[2]);
  t('an answer given in the edition shows in Hebrew', he2.ans === ed2.ans && he2.cur === ed2.cur, JSON.stringify([ed2, he2]));

  for (const e of errs) { fail++; console.log('   page error: ' + e); }
  await b.close();
  console.log(fail ? `\n❌ ${fail} of ${checks} PROGRESS CHECKS FAILED` : `\n✅ progress is the same in Hebrew and in ${CONF.name} (${checks} checks)`);
  process.exit(fail ? 1 : 0);
})();
