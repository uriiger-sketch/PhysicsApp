// Every quiz item and every guided problem step, driven through the real UI:
// the stated answer must be accepted, and the marked option must score.
//
//   node tests/check_answers.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0;
const t = (name, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${got} want ${want}`);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const r = await p.evaluate(async () => {
    const out = { quiz: 0, quizOk: 0, quizBad: [], steps: 0, stepsOk: 0, stepsBad: [], noOpts: [] };
    const chapters = [].concat(MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS);
    for (const ch of chapters) for (const se of ch.sections) {
      const key = ch.id + '.' + se.id, c = CONTENT[key];
      state.subject = ch.id.startsWith('opt-') ? 'optics' : ch.id.startsWith('elc-') ? 'electro' : 'mechanics';
      state.chapter = ch.id; state.section = se.id;

      // ── quiz: click the option the content marks correct ──
      state.quizState = {};
      state.tab = 'quiz'; render();
      await new Promise(r2 => setTimeout(r2, 60));
      for (let qi = 0; qi < (c.quiz || []).length; qi++) {
        out.quiz++;
        const opts = document.querySelectorAll('#app .quiz-opt');
        if (!opts.length) { out.noOpts.push(key + '#' + qi); continue; }
        const qs = getQS(ch.id, se.id);
        opts[c.quiz[qi].correct].click();
        await new Promise(r2 => setTimeout(r2, 30));
        // the app records the chosen index; "accepted" is that it equals correct
        if (qs.ans[qi] === c.quiz[qi].correct) out.quizOk++; else out.quizBad.push(key + '#' + qi);
        if (qi < c.quiz.length - 1) nextQ(); else finishQuiz();
        await new Promise(r2 => setTimeout(r2, 30));
      }

      // ── problem: type the stated answer into each step ──
      const steps = (c.problem && c.problem.steps) || [];
      if (!steps.length) continue;
      // the problem tab is gated behind the quiz, so mark it done
      markCompleted(ch.id, se.id, 'quiz', 0);
      state.problemState = {};
      state.tab = 'problem'; render();
      await new Promise(r2 => setTimeout(r2, 60));
      for (let si = 0; si < steps.length; si++) {
        out.steps++;
        const inp = document.getElementById('si' + si);
        if (!inp) { out.stepsBad.push(key + '#' + si + ' (no input)'); continue; }
        upInp(si, String(steps[si].answer));
        chkStep(si);
        await new Promise(r2 => setTimeout(r2, 40));
        const ps = getPS(ch.id, se.id);
        if (ps.feedback[si] === 'correct') out.stepsOk++;
        else out.stepsBad.push(key + '#' + si + ' (answer "' + steps[si].answer + '" rejected)');
        render();
        await new Promise(r2 => setTimeout(r2, 30));
      }
    }
    return out;
  });

  console.log(`   ${r.quiz} quiz items, ${r.steps} problem steps driven through the UI`);
  t('every quiz item scores when the marked option is clicked', r.quizBad.slice(0, 6).join(' ') || 'none', 'none');
  t('every quiz renders its options', r.noOpts.slice(0, 6).join(' ') || 'none', 'none');
  t('every problem step accepts its own stated answer', r.stepsBad.slice(0, 6).join(' ') || 'none', 'none');
  // a cursor past the end must not take the page down
  const overrun = await p.evaluate(async () => {
    state.subject = 'mechanics'; state.chapter = 'kinematics'; state.section = 'distance-time';
    state.tab = 'quiz'; render();
    const qs = getQS('kinematics', 'distance-time');
    qs.cur = 99;
    try { render(); } catch (e) { return 'threw: ' + e.message; }
    return document.querySelectorAll('#app').length ? 'rendered' : 'empty';
  });
  t('a quiz cursor past the last question still renders', overrun, 'rendered');

  console.log('   page errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'NONE');
  if (errs.length) fail++;
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ALL ANSWER TESTS PASS');
  process.exit(fail ? 1 : 0);
})();
