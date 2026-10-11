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
const K = require('./_katex');   // KATEX=local: also compare question identities with KaTeX
const F2 = 'file://' + FILE;

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

  // ── 4. questions inserted and removed: the answers follow their questions
  // (a v28.17 save -- answers by position, no question identities -- first)
  body = original;
  await p.goto(ORIGIN + 'blank.html');
  await p.evaluate(() => localStorage.clear());
  await load();
  const S4 = { a: keys.done1, b: keys.mid, c: keys.done2 };
  const v2 = await p.evaluate(S4 => {
    // what v28.17 saved: the same answers, by position, without ids
    const o = {}, n = CONTENT[S4.a].quiz.length;
    o[S4.a] = { cur: n - 1, ans: CONTENT[S4.a].quiz.map((q, i) => i % 3 === 0 ? (q.correct + 1) % q.opts.length : q.correct), done: true, v: 2 };
    return o;
  }, S4);
  await p.goto(ORIGIN + 'blank.html');
  await p.evaluate(([v2, a]) => {
    const comp = {}; comp[a + '.quiz'] = true;
    localStorage.setItem('phys_game_state_v2', JSON.stringify({ subject: 'mechanics', chapter: a.split('.')[0], section: a.split('.')[1], tab: 'quiz', xp: 500, completed: comp, visited: {}, quizState: v2, problemState: {}, theme: 'dark' }));
  }, [v2, S4.a]);
  await load();
  await open(S4.a, 'quiz');
  g = await look(S4.a);
  t('v28.17 save (no ids): its answers are taken by position', g.done && (g.banner || '').startsWith('4/6') && same(g.ans, v2[S4.a].ans), JSON.stringify(g));
  // the learner goes on: one more quiz finished, one half done
  for (const [key, k] of [[S4.c, 99], [S4.b, 3]]) {
    await open(key, 'quiz');
    const n = await p.evaluate(k => CONTENT[k].quiz.length, key);
    for (let qi = 0; qi < Math.min(n, k); qi++) { await answer(plan(qi)); await next(); }
    if (k < n) await answer('wrong');
  }
  // every question's mark, by the question it belongs to
  const marks = keys => p.evaluate(keys => {
    const o = {};
    keys.forEach(k => { const [c, s] = k.split('.'), st = getQS(c, s);
      o[k] = { done: st.done, cur: CONTENT[k].quiz[st.cur] ? CONTENT[k].quiz[st.cur].q : null,
        q: CONTENT[k].quiz.map((q, i) => ({ q: q.q, a: st.ans[i], ok: st.ans[i] === undefined ? null : st.ans[i] === quizView(q).ci })) }; });
    return o;
  }, keys);
  for (const key of [S4.a, S4.b, S4.c]) await open(key, 'quiz');
  const m0 = await marks([S4.a, S4.b, S4.c]);
  const xp0 = await p.evaluate(() => state.xp), comp4 = await p.evaluate(() => JSON.stringify(state.completed));
  // the update: a question inserted into the finished quiz and the one in
  // progress (before the learner's place), and one removed from the other
  // finished quiz. Located in the source by question text.
  const objAt = (src, start) => {   // [start, end) of the object literal opening at start, and a following comma
    let d = 0, i = start, q = null;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') q = ch;
      else if ('{[('.includes(ch)) d++;
      else if ('}])'.includes(ch) && --d === 0) { i++; break; }
    }
    while (/\s/.test(src[i])) i++;
    if (src[i] === ',') i++;
    return [start, i];
  };
  const locate = (src, key, from) => p.evaluate(([key, from]) => CONTENT[key].quiz.map((q, i) => [i, q.q]).filter(x => x[0] >= from), [key, from])
    .then(list => { for (const [i, q] of list) { const needle = "{q:'" + q + "'"; if (!/[\\'"`]/.test(q) && src.split(needle).length === 2) return { i, at: src.indexOf(needle) }; } return null; });
  const NEWQ = "{q:'שאלה שנוספה בעדכון: כמה הם 2+2?',opts:['3','4','5','22'],correct:1,explain:'2+2=4.'},\n    ";
  let src = original;
  const insA = await locate(src, S4.a, 1), insB = await locate(src, S4.b, 1), remC = await locate(src, S4.c, 1);
  t('found the places to insert and remove a question', !!(insA && insB && remC), JSON.stringify([insA, insB, remC]));
  if (insA && insB && remC) {
    const cut = objAt(src, remC.at);
    const edits = [[insA.at, insA.at, NEWQ], [insB.at, insB.at, NEWQ], [cut[0], cut[1], '']].sort((x, y) => y[0] - x[0]);
    edits.forEach(([a, z, s]) => { src = src.slice(0, a) + s + src.slice(z); });
    body = src;
    await load();
    const n4 = await p.evaluate(S4 => [S4.a, S4.b, S4.c].map(k => CONTENT[k].quiz.length), S4);
    t('the reloaded app has the inserted and removed questions', same(n4, [m0[S4.a].q.length + 1, m0[S4.b].q.length + 1, m0[S4.c].q.length - 1]), JSON.stringify(n4));
    for (const key of [S4.a, S4.b, S4.c]) await open(key, 'quiz');
    const m1 = await marks([S4.a, S4.b, S4.c]);
    const byQ = m => Object.fromEntries(m.q.map(x => [x.q, [x.a, x.ok]]));
    for (const key of [S4.a, S4.b, S4.c]) {
      const was = byQ(m0[key]), now = byQ(m1[key]);
      const lost = Object.keys(was).filter(q => q in now && JSON.stringify(now[q]) !== JSON.stringify(was[q]));
      t(`${key}: every question that stayed keeps its answer and its mark`, lost.length === 0, lost.length + ' changed, e.g. ' + (lost[0] || '').slice(0, 50) + ' ' + JSON.stringify([was[lost[0]], now[lost[0]]]));
      const fresh = m1[key].q.filter(x => !(x.q in was));
      t(`${key}: an inserted question is unanswered`, fresh.every(x => x.a === undefined), JSON.stringify(fresh));
    }
    t(`${S4.a}: the finished quiz reopens on the inserted question`, !m1[S4.a].done && /שנוספה בעדכון/.test(m1[S4.a].cur || ''), JSON.stringify([m1[S4.a].done, m1[S4.a].cur]));
    t(`${S4.b}: the quiz in progress stays on the learner's question`, m1[S4.b].cur === m0[S4.b].cur && !m1[S4.b].done, JSON.stringify([m0[S4.b].cur, m1[S4.b].cur]));
    await open(S4.c, 'quiz');
    g = await look(S4.c);
    const okC = m1[S4.c].q.filter(x => x.ok).length;
    t(`${S4.c}: a quiz with a question removed stays finished, scored on the rest`, m1[S4.c].done && g.banner === `${okC}/${m1[S4.c].q.length} תשובות נכונות`, g.banner);
    t('completion and XP unchanged by the update', (await p.evaluate(() => state.xp)) === xp0 && (await p.evaluate(() => JSON.stringify(state.completed))) === comp4);
    // the learner answers the new question in the finished quiz: it finishes again, nothing paid twice
    await open(S4.a, 'quiz');
    g = await look(S4.a);
    const okDots = m1[S4.a].q.map((x, i) => x.ok === null ? null : x.ok);
    t(`${S4.a}: the reopened quiz shows the other answers' dots`, g.dots.every((d, i) => okDots[i] === null ? !/ (done|wrong)/.test(d) : (okDots[i] ? / done/.test(d) : / wrong/.test(d))), JSON.stringify([g.dots, okDots]));
    if (!g.done) { await answer('right'); await next(); }
    g = await look(S4.a);
    const okA = m1[S4.a].q.filter(x => x.ok).length + 1;
    t(`${S4.a}: answering it finishes the quiz again with the new score`, g.done && g.banner === `${okA}/${m1[S4.a].q.length} תשובות נכונות`, JSON.stringify(g));
    t('no XP paid twice for the reopened quiz', (await p.evaluate(() => state.xp)) === xp0);
    // and the next update changes nothing more
    await load();
    for (const key of [S4.a, S4.b, S4.c]) await open(key, 'quiz');
    const m2 = await marks([S4.a, S4.b, S4.c]);
    t('a reload after that keeps every answer', same(m2[S4.b], m1[S4.b]) && same(m2[S4.c], m1[S4.c]) && m2[S4.a].done, JSON.stringify(m2[S4.a].done));
  }
  body = original;

  // ── 5. with KaTeX (KATEX=local) and without it, a question has the same identity
  if (K.ON) {
    const ids = async (pg) => pg.evaluate(() => { const o = {}; for (const k in CONTENT) if (CONTENT[k].quiz) o[k] = _qidsOf(k).join(','); return o; });
    const kp = await b.newPage(); await K.route(kp); await kp.goto(F2); await kp.waitForTimeout(900); await K.ready(kp);
    const op = await b.newPage(); await op.goto(F2); await op.waitForTimeout(900);
    const A = await ids(kp), B = await ids(op);
    const diff = Object.keys(A).filter(k => A[k] !== B[k]);
    t('every question has the same identity with KaTeX as offline', diff.length === 0 && await op.evaluate(() => !window.katex), diff.slice(0, 5).join(' '));
  } else console.log('   SKIP same identity with and without KaTeX (run with KATEX=local)');

  t('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fail ? `\n❌ ${fail}/${checks} FAILED` : `\n✅ ALL ${checks} QUIZ-STATE CHECKS PASS`);
  process.exit(fail ? 1 : 0);
})();
