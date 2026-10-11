// Saved quiz answers across an update.
//
//   node tests/check_quizstate.js [app.html]
//
// A learner answers quizzes, the app is updated with a question's wording
// changed -- in a quiz they answered and in one they did not -- and they come
// back. Every saved answer must still be marked as it was: the same score on
// each finished quiz, the same right/wrong dots and the same highlighted
// options on the one in progress, and every question's options in the order
// the learner saw them. The answers used to be saved as DISPLAYED slots dealt
// over all questions of the app at once, so one edited question anywhere
// re-dealt the slots and re-marked finished quizzes after an update.
//
// Then a save from before that change (no v:2 marker): its completion and XP
// stay, no score is invented for it, and a quiz it left half done restarts.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'physics_game_v28.html'));
const ORIGIN = 'http://quizstate.test/';
const URL = ORIGIN + 'physics_game_v28.html';
const MARK = ' (נוסח מעודכן)';

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? ': ' + info : ''}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const original = fs.readFileSync(FILE, 'utf8');
  let body = original;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // one origin, so localStorage outlives the "update"; nothing else loads
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.split('#')[0] === URL) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    if (u === ORIGIN + 'blank.html') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' });
    return r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.dismiss().catch(() => {}));
  const load = async () => {
    await p.goto(URL); await p.waitForTimeout(900);
    await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
  };
  const open = (key, tab) => p.evaluate(([key, tab]) => {
    const [c, s] = key.split('.');
    state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : c.startsWith('dc-') ? 'circuits' : c.startsWith('mag-') ? 'magnetism' : 'mechanics';
    state.chapter = c; state.section = s; state.tab = tab; render();
  }, [key, tab]).then(() => p.waitForTimeout(80));
  // the quiz as the learner sees it
  const look = (key) => p.evaluate((key) => {
    const [c, s] = key.split('.'), st = getQS(c, s), txt = e => e ? e.textContent.trim() : null;
    return {
      ans: st.ans.slice(), cur: st.cur, done: st.done,
      banner: txt(document.querySelector('.done-banner p')),
      icon: txt(document.querySelector('.done-banner .big-icon')),
      dots: [...document.querySelectorAll('.qp-dot')].map(d => d.className),
      right: txt(document.querySelector('.quiz-opt.correct .quiz-opt-text')),
      wrong: txt(document.querySelector('.quiz-opt.wrong .quiz-opt-text')),
      fb: !!document.querySelector('.quiz-feedback'),
    };
  }, key);
  // click option `which` ('right' | 'wrong') of the current question, as a learner does
  const answer = async (which) => {
    const k = await p.evaluate(() => { const q = CONTENT[state.chapter + '.' + state.section].quiz[getQS(state.chapter, state.section).cur], v = quizView(q); return { c: v.correct, n: v.n }; });
    await p.click(`#app .quiz-opt >> nth=${which === 'right' ? k.c : (k.c + 1) % k.n}`);
    await p.waitForTimeout(60);
  };
  const next = async () => { await p.click('#app .quiz-card .btn'); await p.waitForTimeout(80); };
  const deal = () => p.evaluate(() => {
    const o = {};
    for (const k in CONTENT) (CONTENT[k].quiz || []).forEach((q, i) => { const v = quizView(q); o[k + '#' + i] = v.src ? v.src.join('') : v.opts.map(x => q.opts.indexOf(x)).join(''); });
    return o;
  });

  // ── 1. a learner's progress under the shipped content
  await load();
  const keys = await p.evaluate(() => {
    const pick = (chs, ci, si) => chs[ci].id + '.' + chs[ci].sections[si].id;
    return { done1: pick(MECH_CHAPTERS, 0, 0), done2: pick(OPTICS_CHAPTERS, 1, 0), mid: pick(MAG_CHAPTERS, 0, 1), other: pick(ELECTRO_CHAPTERS, 0, 0) };
  });
  const plan = qi => (qi % 3 === 0 ? 'wrong' : 'right');
  for (const key of [keys.done1, keys.done2]) {
    await open(key, 'quiz');
    const n = await p.evaluate(k => CONTENT[k].quiz.length, key);
    for (let qi = 0; qi < n; qi++) { await answer(plan(qi)); await next(); }
  }
  await open(keys.mid, 'quiz');
  for (let qi = 0; qi < 3; qi++) { await answer(plan(qi)); await next(); }
  await answer('wrong');   // answered, not yet advanced
  const before = {};
  for (const key of [keys.done1, keys.done2, keys.mid]) { await open(key, 'quiz'); before[key] = await look(key); }
  const deal0 = await deal();
  t('the learner\'s quizzes were recorded', /^\d+\/\d+/.test(before[keys.done1].banner || '') && before[keys.mid].wrong !== null, JSON.stringify(before[keys.done1]));
  t('a finished quiz scores what was answered', (before[keys.done1].banner || '').startsWith('4/6'), before[keys.done1].banner);

  // ── 2. the update: a question reworded in a quiz the learner finished, and in one they never opened
  const qtext = await p.evaluate(([a, b]) => [CONTENT[a].quiz.map(q => q.q), CONTENT[b].quiz.map(q => q.q)], [keys.done1, keys.other]);
  const edit = list => { const i = list.findIndex(q => !/[\\'"`]/.test(q) && original.split(q).length === 2); return i; };
  const e1 = edit(qtext[0]), e2 = edit(qtext[1]);
  t('found a question to reword in each quiz', e1 >= 0 && e2 >= 0, e1 + ' ' + e2);
  body = original.replace(qtext[0][e1], qtext[0][e1] + MARK).replace(qtext[1][e2], qtext[1][e2] + MARK);
  await load();
  const took = await p.evaluate(([a, i, b, j, m]) => CONTENT[a].quiz[i].q.endsWith(m) && CONTENT[b].quiz[j].q.endsWith(m), [keys.done1, e1, keys.other, e2, MARK]);
  t('the reworded questions are in the reloaded app', took);
  const after = {};
  for (const key of [keys.done1, keys.done2, keys.mid]) { await open(key, 'quiz'); after[key] = await look(key); }
  for (const key of [keys.done1, keys.done2]) {
    t(`${key}: finished quiz keeps its score after the update`, after[key].banner === before[key].banner, `${before[key].banner} -> ${after[key].banner}`);
    t(`${key}: its saved answers are unchanged`, same(after[key].ans, before[key].ans), `${before[key].ans} -> ${after[key].ans}`);
  }
  t(`${keys.mid}: quiz in progress keeps its right/wrong dots`, same(after[keys.mid].dots, before[keys.mid].dots), `${before[keys.mid].dots} -> ${after[keys.mid].dots}`);
  t(`${keys.mid}: the answered question still marks the option chosen`, after[keys.mid].wrong === before[keys.mid].wrong && after[keys.mid].right === before[keys.mid].right,
    `${before[keys.mid].wrong} -> ${after[keys.mid].wrong}`);
  const deal1 = await deal();
  const moved = Object.keys(deal0).filter(k => deal1[k] !== deal0[k]);
  t('no question\'s options moved, the reworded ones included', moved.length === 0, moved.length + ' moved, e.g. ' + moved.slice(0, 4).join(' '));

  // ── 3. a save written before answers were stored by authored index
  body = original;
  await p.goto(ORIGIN + 'blank.html');
  const L = { a: keys.done1, b: keys.mid, c: keys.done2 };
  await p.evaluate(L => {
    localStorage.clear();
    const [c, s] = L.a.split('.'), comp = {};
    comp[L.a + '.theory'] = true; comp[L.a + '.sim'] = true; comp[L.a + '.quiz'] = true; comp[L.c + '.quiz'] = true;
    const qs = {}; qs[L.a] = { cur: 5, ans: [0, 1, 2, 3, 0, 1], done: true }; qs[L.b] = { cur: 3, ans: [1, 2, 0], done: false }; qs[L.c] = { cur: 0, ans: [], done: false };
    localStorage.setItem('phys_game_state_v2', JSON.stringify({ subject: 'mechanics', chapter: c, section: s, tab: 'quiz', xp: 777, completed: comp, visited: {}, quizState: qs, problemState: {}, theme: 'dark' }));
  }, L);
  await load();
  const comp0 = await p.evaluate(() => JSON.stringify(state.completed));
  await open(L.a, 'quiz');
  let g = await look(L.a);
  t('legacy finished quiz: still finished, and no score is made up for it', g.done && g.banner && !/\d+\s*\/\s*\d+/.test(g.banner) && /גרסה קודמת/.test(g.banner) && g.icon !== '🏆', JSON.stringify(g));
  t('legacy save: XP kept', await p.evaluate(() => state.xp) === 777);
  t('legacy save: completed sections kept', await p.evaluate(() => JSON.stringify(state.completed)) === comp0 && JSON.parse(comp0)[L.a + '.quiz'] === true);
  t('legacy save: the problem tab stays open after the finished quiz', await p.evaluate(() => !document.querySelector('.tab.locked[onclick*="problem"], .tab[aria-disabled="true"][onclick*="problem"]')));
  await open(L.b, 'quiz');
  g = await look(L.b);
  t('legacy quiz in progress restarts at its first question, unmarked', g.cur === 0 && g.ans.length === 0 && !g.fb && !g.dots.some(d => / (done|wrong)/.test(d)), JSON.stringify(g));
  await open(L.c, 'quiz');
  t('legacy save: an untouched quiz is simply marked current', await p.evaluate(k => { const q = state.quizState[k]; return q.v === 2 && !q.legacy && q.cur === 0; }, L.c));
  await load();
  await open(L.a, 'quiz');
  g = await look(L.a);
  t('legacy finished quiz reads the same after another reload', /גרסה קודמת/.test(g.banner || '') && (await p.evaluate(() => state.xp)) === 777, JSON.stringify(g));
  // trying it again scores normally and pays nothing twice
  await p.click('.done-banner .btn-primary'); await p.waitForTimeout(80);
  const n = await p.evaluate(k => CONTENT[k].quiz.length, L.a);
  for (let qi = 0; qi < n; qi++) { await answer('right'); await next(); }
  g = await look(L.a);
  t('a legacy quiz taken again shows its new score', g.banner === `${n}/${n} תשובות נכונות — ניקוד מלא!` && g.icon === '🏆', JSON.stringify(g));
  t('taking it again earns no XP twice', await p.evaluate(() => state.xp) === 777);

  t('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fail ? `\n❌ ${fail}/${checks} FAILED` : `\n✅ ALL ${checks} QUIZ-STATE CHECKS PASS`);
  process.exit(fail ? 1 : 0);
})();
