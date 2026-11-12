// The mixed review: the questions of the quizzes already finished, from every
// subject, mixed.
//
//   node tests/check_review.js
//   APP_FILE=physics_game_en.html node tests/check_review.js
//
// A round holds up to ten questions: the ones whose last answer was wrong
// first, then the ones the review has not asked yet, no more than two from a
// topic while there are topics to choose from, and never a question that
// leans on its neighbours in the quiz (seq). A question reads exactly as it
// does in its quiz -- text, options, their order, the explanation -- and its
// topic is named only after the answer. The review's one record, the mark of
// each question's last answer, is saved beside the quiz's answers, follows
// its question when the quiz is edited, survives a reload, and is cleaned
// like the rest of the save. The dialog is a dialog: focus goes in and comes
// back, Tab stays inside, 1-4 answer, Escape and Back close it, and on a
// phone it fills the screen and scrolls nothing sideways.
const { chromium } = require('playwright');
const path = require('path');
const { L, LANG } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

// seven finished quizzes over the five subjects; every third answer wrong
const KEYS = ['kinematics.distance-time', 'kinematics.freefall', 'forces.n3-law', 'opt-lenses.convex-lens', 'elc-charge.elc-coulomb', 'dc-basics.dc-resistance', 'mag-force.mag-circle'];
const seed = (keys) => {
  let wrong = 0;
  keys.forEach((k, n) => {
    const qs = CONTENT[k].quiz;
    const ans = qs.map((q, i) => { const bad = (i + n) % 3 === 0; if (bad && !q.seq) wrong++; return bad ? (q.correct + 1) % q.opts.length : q.correct; });
    state.quizState[k] = { cur: qs.length - 1, ans, done: true, v: 2 };
    state.completed[k + '.quiz'] = true;
  });
  saveState(); render();
  return wrong;
};
// the displayed slot of the right answer, or of a wrong one, for the question on screen
const slot = (right) => { const it = _rv.list[_rv.pos], qv = quizView(CONTENT[it.k].quiz[it.i]); return right ? qv.correct : (qv.correct + 1) % qv.opts.length; };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const open = async (vw, vh, mobile, hash) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: !!mobile, isMobile: !!mobile });
    await ctx.route(/^(https?|wss?):/, r => r.abort());
    await ctx.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + (e.sample || '').slice(0, 40)));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(F + (hash || '#/kinematics/distance-time/theory'));
    await p.waitForFunction(() => typeof window.openReview === 'function' && document.querySelector('#sidebar-nav .rv-btn'), null, { timeout: 20000 });
    // The first visit's welcome is closed here, by the page, and not by a
    // start-up script that writes its flag: a script that touches
    // localStorage before the page does can leave a reloaded page (headless
    // Chromium, file://) on another, empty storage area -- one reload in five
    // came back without the save.
    await p.evaluate(() => { if (document.getElementById('onboard-overlay')) closeOnboarding(); });
    await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  const dlg = (p) => p.evaluate(() => { const ov = document.getElementById('review-overlay'); if (!ov) return null;
    const body = ov.querySelector('.rv-body'), a = document.activeElement;
    return { open: ov.classList.contains('open'), count: ov.querySelector('.rv-count').textContent, q: (body.querySelector('.quiz-q') || {}).textContent || '',
      opts: [...body.querySelectorAll('.quiz-opt')].map(o => ({ cls: o.className, dis: o.disabled, text: o.querySelector('.quiz-opt-text').textContent })),
      fb: (body.querySelector('.quiz-feedback') || {}).className || '', from: (body.querySelector('.rv-from') || {}).textContent || '',
      next: (body.querySelector('.rv-next') || {}).textContent || '', focus: a ? (a.id || a.className) : '', inside: !!a && ov.contains(a), text: body.innerText }; });

  // ── the questions that stay out ──────────────────────────────────────────
  let { ctx, p, errs } = await open(1280, 860);
  const data = await p.evaluate(() => {
    const plain = h => { const d = document.createElement('div'); d.innerHTML = String(h || ''); return d.textContent.replace(/\s+/g, ' ').trim(); };
    // Hebrew words by which a question leans on its neighbour, or sends the reader to it
    const Q = /^(ו?ב?אות[וה] (כדור|גוף|מגנט|נסיעה|מצב|שנאי|מעגל|מקרה)|ומה |ומהי |ומהו )|הקודמ|הקודם|שבסעיף/;
    const E = /השאלה הבאה|השאלה הקודמת|השאלות הקודמות|בשאלה הקודמת|בשאלה הבאה|כמו בשאלה|שאלה \d/;
    let total = 0, seq = 0; const lean = [];
    for (const k of Object.keys(CONTENT)) (CONTENT[k].quiz || []).forEach((q, i) => { total++; if (q.seq) seq++;
      else if (document.documentElement.lang === 'he' && (Q.test(plain(q.q)) || E.test(plain(q.explain) + ' ' + plain(q.hint)))) lean.push(k + '#' + (i + 1)); });
    // every quiz finished: the whole pool
    const all = [];
    [MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS, DC_CHAPTERS, MAG_CHAPTERS].forEach(l => l.forEach(ch => ch.sections.forEach(se => all.push(ch.id + '.' + se.id))));
    const keep = JSON.stringify(state.quizState);
    all.forEach(k => { const qs = CONTENT[k].quiz; state.quizState[k] = { cur: 0, ans: qs.map(q => q.correct), done: true, v: 2 }; });
    const pool = _rvPool();
    const subj = {}; pool.forEach(x => { subj[_subjectOf(x.c)] = 1; });
    const r = { total, seq, lean, sections: all.length, pool: pool.length, seqIn: pool.filter(x => CONTENT[x.k].quiz[x.i].seq).length, missed: pool.filter(x => x.missed).length,
      subjects: Object.keys(subj).length, round: _rvPick().length, perMax: Math.max(...Object.values(_rvPick().reduce((a, x) => (a[x.k] = (a[x.k] || 0) + 1, a), {}))) };
    state.quizState = JSON.parse(keep);
    return r;
  });
  t('questions that lean on their neighbours are marked', data.seq >= 17 && data.lean.length === 0, `${data.seq} marked; unmarked: ${data.lean.join(', ')}`);
  t('with every quiz finished the pool is every question but those', data.pool === data.total - data.seq && data.seqIn === 0 && data.subjects === 5, JSON.stringify(data));
  t('a round is ten questions, no more than two from a topic', data.round === 10 && data.perMax <= 2 && data.missed === 0, JSON.stringify(data));

  // ── nothing finished yet ─────────────────────────────────────────────────
  let ui = await p.evaluate(() => { const b = document.querySelector('#sidebar-nav .rv-btn'); return { text: b.textContent.trim(), badge: !!b.querySelector('.rv-badge'), first: b.closest('.sb-list').firstElementChild.classList.contains('rv-entry') }; });
  t('the review has its button at the head of the topic list', ui.text === L('🔁 חזרה מעורבת') && !ui.badge && ui.first, JSON.stringify(ui));
  const xp0 = await p.evaluate(() => state.xp);
  await p.click('#sidebar-nav .rv-btn');
  await p.waitForTimeout(250);
  let d = await dlg(p);
  t('before any quiz is finished it says what it is, and asks nothing', d.open && d.opts.length === 0 && d.count === '' && d.text.includes(L('הבנתי')) && d.inside, JSON.stringify(d).slice(0, 300));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ui = await p.evaluate(() => ({ open: document.getElementById('review-overlay').classList.contains('open'), lock: document.body.style.overflow, onBtn: document.activeElement === document.querySelector('#sidebar-nav .rv-btn'), xp: state.xp }));
  t('Escape closes it, and the focus is back on its button', !ui.open && ui.lock === '' && ui.onBtn && ui.xp === xp0, JSON.stringify(ui));

  // ── a round ──────────────────────────────────────────────────────────────
  const wrong = await p.evaluate(seed, KEYS);
  ui = await p.evaluate(() => { const b = document.querySelector('#sidebar-nav .rv-btn .rv-badge'); return { badge: b ? b.textContent.replace(/\D+/g, '') : '', pool: _rvPool().length, missed: _rvPool().filter(x => x.missed).length }; });
  t('the button counts the questions answered wrong in their quizzes', wrong >= 12 && ui.missed === wrong && ui.badge === String(wrong), JSON.stringify({ wrong, ui }));
  await p.click('#sidebar-nav .rv-btn');
  await p.waitForTimeout(250);
  let round = await p.evaluate(() => ({ n: _rv.list.length, missed: _rv.list.filter(x => x.missed).length, per: Math.max(...Object.values(_rv.list.reduce((a, x) => (a[x.k] = (a[x.k] || 0) + 1, a), {}))),
    adj: _rv.list.filter((x, i) => i && x.k === _rv.list[i - 1].k).length, seq: _rv.list.filter(x => CONTENT[x.k].quiz[x.i].seq).length, topics: new Set(_rv.list.map(x => x.k)).size,
    lock: document.body.style.overflow, role: document.querySelector('#review-overlay .rv-card').getAttribute('role'), modal: document.querySelector('#review-overlay .rv-card').getAttribute('aria-modal') }));
  t('the round takes the missed questions first', round.n === 10 && round.missed === 10 && round.seq === 0, JSON.stringify(round));
  t('no more than two from a topic, and not one after the other', round.per <= 2 && round.adj === 0 && round.topics >= 5, JSON.stringify(round));
  t('it is a modal dialog over a page that does not scroll', round.role === 'dialog' && round.modal === 'true' && round.lock === 'hidden');
  d = await dlg(p);
  const view = await p.evaluate(() => { const it = _rv.list[0], q = CONTENT[it.k].quiz[it.i], qv = quizView(q), div = document.createElement('div');
    const plain = h => { div.innerHTML = _ltSafe(h); return div.textContent; };
    return { title: it.title, q: plain(q.q), opts: qv.opts.map(plain), n: _rv.list.length }; });
  t('the question reads as in its quiz: its text, its options, their order', d.q.replace(/\s+/g, '') === ('1' + view.q).replace(/\s+/g, '') && d.opts.length === view.opts.length &&
    d.opts.every((o, i) => o.text.replace(/\s+/g, '') === view.opts[i].replace(/\s+/g, '')), JSON.stringify([d.q, view.q]));
  t('the topic is not named before the answer', d.from === '' && d.fb === '' && d.next === '' && d.opts.every(o => !o.dis), JSON.stringify(d).slice(0, 200));
  t('the focus is on the question, and the count says where we are', d.focus === 'rv-q' && /1\D+10/.test(d.count), JSON.stringify([d.focus, d.count]));

  // a wrong answer, by its number key
  const before = await p.evaluate(() => ({ xp: state.xp, tab: state.tab, hash: location.hash }));
  const wSlot = await p.evaluate(slot, false);
  await p.keyboard.press(String(wSlot + 1));
  await p.waitForTimeout(200);
  d = await dlg(p);
  let st = await p.evaluate(() => { const it = _rv.list[0], s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { xp: state.xp, tab: state.tab, hash: location.hash, rv: s.quizState[it.k].rv[it.i], qv: quizView(CONTENT[it.k].quiz[it.i]).correct,
    say: (document.getElementById('sr-live') || document.querySelector('[aria-live]') || {}).textContent || '' }; });
  t('a number key answers; the page behind does not take it', d.opts[wSlot].cls.includes('wrong') && d.opts[st.qv].cls.includes('correct') && d.opts.every(o => o.dis) && st.tab === before.tab && st.hash === before.hash, JSON.stringify([d.opts.map(o => o.cls), st]));
  t('a wrong answer: the explanation, no XP, and the mark is saved', d.fb.includes('fb-err') && d.text.includes(L('❌ לא נכון.')) && st.xp === before.xp && st.rv === 0, JSON.stringify([d.fb, st]));
  t('now the topic is named, and the way on has the focus', d.from.includes(view.title) && d.from.includes(L('מתוך הנושא:')) && d.focus.includes('rv-next'), JSON.stringify([d.from, d.focus]));
  // a second answer to the same question changes nothing
  await p.evaluate((s) => window._rvAnswer(s), st.qv);
  const again = await p.evaluate(() => ({ right: _rv.right, xp: state.xp, n: _rv.ans.length }));
  t('a question is answered once', again.right === 0 && again.xp === before.xp && again.n === 1, JSON.stringify(again));

  // Tab stays inside the dialog
  const tabs = [];
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => document.getElementById('review-overlay').contains(document.activeElement))); }
  t('Tab stays inside the dialog', tabs.every(Boolean), JSON.stringify(tabs));

  // on to the next: Enter on the focused button; then a right answer
  await p.evaluate(() => document.querySelector('#review-overlay .rv-next').focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  d = await dlg(p);
  t('Enter goes on to the next question', /2\D+10/.test(d.count) && d.focus === 'rv-q' && d.fb === '', JSON.stringify([d.count, d.focus]));
  const second = await p.evaluate(() => { const it = _rv.list[1]; return { k: it.k, i: it.i }; });
  await p.keyboard.press(String((await p.evaluate(slot, true)) + 1));
  await p.waitForTimeout(200);
  d = await dlg(p);
  st = await p.evaluate(() => { const it = _rv.list[1], s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { xp: state.xp, saved: s.xp, rv: s.quizState[it.k].rv[it.i], badge: document.getElementById('xp-badge-el').textContent }; });
  t('a right answer: 5 XP, in the header and in the save, and the mark', d.fb.includes('fb-ok') && d.text.includes(L('✅ נכון!')) && st.xp === before.xp + 5 && st.saved === st.xp && st.rv === 1 && st.badge.includes(String(st.xp)), JSON.stringify([d.fb, st, before.xp]));

  // the rest: every fourth wrong; then the summary
  const tally = await p.evaluate(() => { let right = 1, wrongTopics = {}; wrongTopics[_rv.list[0].k] = 1;
    for (let i = 2; i < _rv.list.length; i++) { _rvNext(); const it = _rv.list[_rv.pos], qv = quizView(CONTENT[it.k].quiz[it.i]); const ok = i % 4 !== 3;
      _rvAnswer(ok ? qv.correct : (qv.correct + 1) % qv.opts.length); if (ok) right++; else wrongTopics[it.k] = 1; }
    const titles = _rv.list.filter(x => wrongTopics[x.k]).map(x => x.title);
    _rvNext();
    return { right, n: _rv.list.length, titles: [...new Set(titles)], xp: state.xp }; });
  await p.waitForTimeout(200);
  d = await dlg(p);
  const sum = await p.evaluate(() => ({ weak: [...document.querySelectorAll('#review-overlay .rv-weak .sec-btn')].map(x => x.textContent.trim()), h: document.querySelector('#review-overlay h2').textContent,
    xpLine: (document.querySelector('#review-overlay .rv-xp') || {}).textContent || '', focusIn: document.getElementById('review-overlay').contains(document.activeElement) }));
  t('the summary: the score, and the XP of the round', new RegExp('^' + tally.right + '\\D+' + tally.n).test(sum.h) && sum.xpLine.includes(String(tally.right * 5)) && tally.xp === before.xp + tally.right * 5 && sum.focusIn, JSON.stringify([sum, tally]));
  t('it names the topics of the questions missed, each once', sum.weak.length === tally.titles.length && tally.titles.every(x => sum.weak.includes(x)), JSON.stringify([sum.weak, tally.titles]));

  // the count on the button after the round; then it survives a reload
  const expect = await p.evaluate(() => _rvPool().filter(x => x.missed).length);
  t('a missed question answered right leaves the count; one answered wrong stays', expect === wrong - tally.right, JSON.stringify({ expect, wrong, right: tally.right }));
  // a second round in the same session: a question already paid for pays nothing more
  await p.evaluate(() => _rvStart(1));
  await p.waitForTimeout(150);
  const r2 = await p.evaluate((second) => { const xp = state.xp; _rv.list = [{ k: second.k, c: second.k.split('.')[0], s: second.k.split('.')[1], i: second.i, title: '' }]; _rv.pos = 0; _rv.ans = [];
    const qv = quizView(CONTENT[second.k].quiz[second.i]); _rvAnswer(qv.correct); return { xp0: xp, xp1: state.xp, right: _rv.right }; }, second);
  t('5 XP for a question once a session', r2.right === 1 && r2.xp1 === r2.xp0, JSON.stringify(r2));
  await p.evaluate(() => closeReview());
  await p.waitForTimeout(150);
  ui = await p.evaluate(() => { const b = document.querySelector('#sidebar-nav .rv-btn'); return { badge: (b.querySelector('.rv-badge') || { textContent: '' }).textContent.replace(/\D+/g, ''), onBtn: document.activeElement === b, lock: document.body.style.overflow }; });
  t('closed: the button shows the new count and has the focus again', ui.badge === String(expect) && ui.onBtn && ui.lock === '', JSON.stringify([ui, expect]));
  await p.reload();
  await p.waitForFunction(() => typeof window.openReview === 'function' && document.querySelector('#sidebar-nav .rv-btn'), null, { timeout: 20000 });
  await p.waitForTimeout(300);
  ui = await p.evaluate(() => { const b = document.querySelector('#sidebar-nav .rv-btn .rv-badge'); const pool = _rvPool();
    return { badge: b ? b.textContent.replace(/\D+/g, '') : '', asked: pool.filter(x => x.asked).length, first: _rvPick().slice(0).filter(x => x.missed).length }; });
  t('after a reload the marks are still there', ui.badge === String(expect) && ui.asked === 10 && ui.first === Math.min(10, expect), JSON.stringify([ui, expect]));

  // the topic link: the review closes and the topic opens, in its subject
  await p.click('#sidebar-nav .rv-btn');
  await p.waitForTimeout(200);
  const target = await p.evaluate(() => { const i = _rv.list.findIndex(x => _subjectOf(x.c) !== state.subject); const it = _rv.list[i < 0 ? 0 : i]; _rv.pos = _rv.list.indexOf(it); _rvDraw('q');
    const qv = quizView(CONTENT[it.k].quiz[it.i]); _rvAnswer(qv.correct); return { c: it.c, s: it.s, subj: _subjectOf(it.c) }; });
  await p.click('#review-overlay .rv-link');
  await p.waitForTimeout(500);
  ui = await p.evaluate(() => ({ hash: location.hash, subj: state.subject, open: document.getElementById('review-overlay').classList.contains('open'), lock: document.body.style.overflow }));
  t('the topic named after an answer opens it, across subjects', ui.hash.indexOf('#/' + target.c + '/' + target.s + '/') === 0 && ui.subj === target.subj && !ui.open && ui.lock === '', JSON.stringify([ui, target]));
  // Back closes an open review
  await p.evaluate(() => openReview());
  await p.waitForTimeout(150);
  await p.goBack();
  await p.waitForTimeout(400);
  ui = await p.evaluate(() => ({ open: document.getElementById('review-overlay').classList.contains('open'), lock: document.body.style.overflow }));
  t('Back closes the review', !ui.open && ui.lock === '', JSON.stringify(ui));

  // ── the mark in the save ─────────────────────────────────────────────────
  const save = await p.evaluate(() => {
    const k = 'elc-charge.elc-coulomb', qs = CONTENT[k].quiz, out = {};
    // hostile and broken marks are cleaned like the rest of the save
    const c = _cleanSave({ quizState: { [k]: { cur: 0, done: true, v: 2, ans: [0, 1, 2, 3, 0, 1], rv: ['<img src=x onerror=alert(1)>', 5, { a: 1 }, 1, 0, -1, null] }, 'a.b': { cur: 0, done: true, ans: [], rv: 'x' } } });
    out.clean = JSON.stringify(c.quizState[k].rv); out.dropped = c.quizState['a.b'].rv === undefined;
    // the mark follows its question when the quiz changes under it
    const ids = _qidsOf(k).slice();
    const sw = { cur: 0, done: true, v: 2, ids: [ids[1], ids[0]].concat(ids.slice(2)), ans: [qs[1].correct, qs[0].correct].concat(qs.slice(2).map(q => q.correct)), rv: [1, 0, null, null, 1, null] };
    state.quizState[k] = sw; const q = getQS('elc-charge', 'elc-coulomb');
    out.moved = JSON.stringify([q.rv[0], q.rv[1], q.rv[4]]);
    out.poolMissed = _rvPool().filter(x => x.k === k && x.missed).map(x => x.i).join();
    // a question the review marked wrong is missed even if its quiz answer was right, and the other way round
    state.quizState[k] = { cur: 0, done: true, v: 2, ans: qs.map((q, i) => i === 2 ? (q.correct + 1) % q.opts.length : q.correct), rv: [0, null, 1] };
    out.last = _rvPool().filter(x => x.k === k && x.missed).map(x => x.i).join();
    // retaking the quiz starts its questions afresh
    const keepC = state.chapter, keepS = state.section; state.chapter = 'elc-charge'; state.section = 'elc-coulomb'; state.subject = 'electro';
    resetQuiz(); out.reset = state.quizState[k].rv === undefined && !_rvPool().some(x => x.k === k);
    return out; });
  t('the save keeps a mark only as 1 or 0', save.clean === '[null,null,null,1,0,null,null]' && save.dropped, JSON.stringify(save));
  t('a mark follows its question when the quiz is edited', save.moved === '[0,1,1]' && save.poolMissed === '0', JSON.stringify(save));
  t('the last answer decides: in the review if it was asked there, else in the quiz', save.last === '0', save.last);
  t('retaking a quiz starts its questions afresh', save.reset);
  t('no page errors, no CSP violations', errs.length === 0 && (await p.evaluate(() => window.__csp.length)) === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  // ── a question reads exactly as in its quiz, formulas and all ────────────
  ({ ctx, p, errs } = await open(1280, 860, false, '#/elc-charge/elc-coulomb/quiz'));
  await p.evaluate(() => { state.completed['elc-charge.elc-coulomb.theory'] = true; state.completed['elc-charge.elc-coulomb.sim'] = true; setTab('quiz'); });
  await p.waitForTimeout(300);
  const norm = (h) => h.replace(/<span class="quiz-q-num">\d+<\/span>/, '').replace(/\s+/g, ' ').trim();
  const quizHTML = [];
  for (let i = 0; i < 6; i++) {
    const cur = await p.evaluate(() => { const st = getQS('elc-charge', 'elc-coulomb'), q = CONTENT['elc-charge.elc-coulomb'].quiz[st.cur], qv = quizView(q); answerQuiz((qv.correct + 1) % qv.opts.length); return st.cur; });
    await p.waitForTimeout(250);
    quizHTML[cur] = await p.evaluate(() => ({ q: document.querySelector('#app .quiz-q').innerHTML, opts: [...document.querySelectorAll('#app .quiz-opt-text')].map(x => x.innerHTML), ex: document.querySelector('#app .quiz-feedback > div:nth-child(2)').innerHTML,
      formula: (document.querySelector('#app .quiz-feedback > div:nth-child(3)') || { innerHTML: '' }).innerHTML }));
    await p.evaluate(() => nextQ());
    await p.waitForTimeout(200);
  }
  const fin = await p.evaluate(() => ({ done: getQS('elc-charge', 'elc-coulomb').done, pool: _rvPool().length, missed: _rvPool().filter(x => x.missed).length }));
  t('a quiz finished in the page puts its questions in the review', fin.done && fin.pool === 6 && fin.missed === 6, JSON.stringify(fin));
  await p.evaluate(() => openReview());
  await p.waitForTimeout(250);
  const diffs = [];
  let ltr = 0;
  for (let i = 0; i < 6; i++) {
    const got = await p.evaluate(() => { const it = _rv.list[_rv.pos], qv = quizView(CONTENT[it.k].quiz[it.i]); _rvAnswer((qv.correct + 1) % qv.opts.length); const b = document.querySelector('#review-overlay .rv-body');
      const r = { i: it.i, q: b.querySelector('.quiz-q').innerHTML, opts: [...b.querySelectorAll('.quiz-opt-text')].map(x => x.innerHTML), ex: b.querySelector('.quiz-feedback > div:nth-child(2)').innerHTML,
        formula: (b.querySelector('.rv-formula') || { innerHTML: '' }).innerHTML, ltr: b.querySelectorAll('.ltr-run, .katex').length };
      _rvNext(); return r; });
    const want = quizHTML[got.i]; ltr += got.ltr;
    if (norm(got.q) !== norm(want.q)) diffs.push(`q${got.i + 1} text`);
    if (got.opts.join('\u0001') !== want.opts.join('\u0001')) diffs.push(`q${got.i + 1} options`);
    if (norm(got.ex) !== norm(want.ex)) diffs.push(`q${got.i + 1} explanation`);
    if (norm(got.formula) !== norm(want.formula)) diffs.push(`q${got.i + 1} formula`);
  }
  t('text, options, explanation and formula are the quiz\'s own, mark for mark', diffs.length === 0 && ltr > 0, diffs.join(', ') || 'no formula met');
  t('no page errors in the quiz and its review', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  // ── a phone ──────────────────────────────────────────────────────────────
  ({ ctx, p, errs } = await open(390, 780, true));
  await p.evaluate(seed, KEYS);
  await p.evaluate(() => openDrawer());
  await p.waitForTimeout(400);
  ui = await p.evaluate(() => { const b = document.querySelector('#mobile-drawer .rv-btn'), r = b.getBoundingClientRect(), d = document.getElementById('mobile-drawer').getBoundingClientRect();
    return { h: r.height, inside: r.left >= d.left && r.right <= d.right + 1, badge: (b.querySelector('.rv-badge') || { textContent: '' }).textContent.replace(/\D+/g, '') }; });
  t('phone: the button is in the drawer, a finger\'s target, with its count', ui.h >= 44 && ui.inside && +ui.badge > 0, JSON.stringify(ui));
  await p.tap('#mobile-drawer .rv-btn');
  await p.waitForTimeout(450);
  ui = await p.evaluate(() => { const ov = document.getElementById('review-overlay'), card = ov.querySelector('.rv-card').getBoundingClientRect(), opts = [...ov.querySelectorAll('.quiz-opt')], x = ov.querySelector('.formula-panel-close').getBoundingClientRect();
    return { open: ov.classList.contains('open'), drawer: document.getElementById('mobile-drawer').classList.contains('open'), w: card.width, h: card.height, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth - innerWidth,
      osw: ov.scrollWidth - ov.clientWidth, small: opts.filter(o => o.getBoundingClientRect().height < 44).length, n: opts.length, wide: opts.filter(o => o.scrollWidth > o.clientWidth + 1).length, close: x.width >= 40 && x.height >= 40 && x.top >= 0, lock: document.body.style.overflow }; });
  t('phone: the review opens over the whole screen, the drawer closed', ui.open && !ui.drawer && Math.abs(ui.w - ui.vw) <= 1 && ui.h >= ui.vh - 1 && ui.lock === 'hidden', JSON.stringify(ui));
  t('phone: nothing scrolls sideways, every option is a finger\'s target', ui.sw <= 0 && ui.osw <= 0 && ui.n >= 2 && ui.small === 0 && ui.wide === 0 && ui.close, JSON.stringify(ui));
  // every question of two rounds fits the width, answered and not
  const fit = await p.evaluate(() => { const ov = document.getElementById('review-overlay'); let bad = [];
    for (let round = 0; round < 2; round++) { for (let i = 0; i < _rv.list.length; i++) { const it = _rv.list[_rv.pos], qv = quizView(CONTENT[it.k].quiz[it.i]);
        if (ov.scrollWidth > ov.clientWidth + 1) bad.push(it.k + '#' + (it.i + 1));
        _rvAnswer(i % 2 ? qv.correct : (qv.correct + 1) % qv.opts.length);
        if (ov.scrollWidth > ov.clientWidth + 1 || [...ov.querySelectorAll('.rv-body *')].some(e => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1)) bad.push(it.k + '#' + (it.i + 1) + ' answered');
        _rvNext(); }
      if (round === 0) _rvStart(1); }
    return bad; });
  t('phone: twenty questions and their explanations fit the width', fit.length === 0, fit.slice(0, 4).join(', '));
  await p.evaluate(() => closeReview());
  await p.waitForTimeout(200);
  ui = await p.evaluate(() => ({ lock: document.body.style.overflow, open: document.getElementById('review-overlay').classList.contains('open') }));
  t('phone: closed, the page scrolls again', ui.lock === '' && !ui.open, JSON.stringify(ui));
  t('phone: no page errors, no CSP violations', errs.length === 0 && (await p.evaluate(() => window.__csp.length)) === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  await b.close();
  console.log(`check_review: ${checks - fail}/${checks} passed (${data.total} questions, ${data.seq} kept out, a pool of ${data.pool} over ${data.sections} topics; ${LANG})`);
  process.exit(fail ? 1 : 0);
})();
