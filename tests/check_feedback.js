// A wrong number in a guided problem is told what kind of miss it is.
//
//   node tests/check_feedback.js
//   APP_FILE=physics_game_en.html node tests/check_feedback.js
//
// Every numeric step of every guided problem is given, through the real
// checker, the classic slips of its own answer: the opposite sign, a thousand
// times too large and too small, double, the square, 7 % off, and a number
// that is simply wrong. Each must draw its own diagnosis -- and only when the
// number leaves no doubt: a miss that fits two slips at once gets none, a
// number that is merely wrong gets "try again", and nothing a learner may type
// is ever accepted because of the diagnosis. The line must also survive the
// save (plain text, at most 300 characters) and fit the phone's width.
const { chromium } = require('playwright');
const path = require('path');
const { L } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

const MSG = {
  sign: L('הגודל נכון, אבל הסימן הפוך. בדקו איזה כיוון נקבע כחיובי ומה השאלה מבקשת.'),
  up: L('הספרות נכונות, אבל התשובה גדולה פי ⟦0⟧ מהנדרש. בדקו המרת יחידות וחזקות של 10.').replace('⟦0⟧', '1000'),
  down: L('הספרות נכונות, אבל התשובה קטנה פי ⟦0⟧ מהנדרש. בדקו המרת יחידות וחזקות של 10.').replace('⟦0⟧', '1000'),
  unit: L('היחידה הנדרשת כתובה ליד השדה.'),
  two: L('נראה שגורם של 2 חסר או מיותר. בדקו נוסחאות שיש בהן ½ או 2, רדיוס מול קוטר, ומרחק או זמן של הלוך ושוב.'),
  sq: L('המספר שלכם הוא הריבוע של התשובה: נראה שנשאר להוציא שורש (למשל מ־v² ל־v).'),
  near: L('קרוב מאוד, אבל מחוץ לדיוק הנדרש. ייתכן שעיגלתם מוקדם מדי, או שהשתמשתם בערך שונה מזה שהבעיה נותנת (g, π, sin…). עגלו רק בסוף.'),
  plain: L('❌ לא מדויק (ניסיון ⟦0⟧/3). נסו שוב.').replace('⟦0⟧', '1'),
  with: L('❌ לא מדויק (ניסיון ⟦0⟧/3). ⟦1⟧').replace('⟦0⟧', '1'),
};

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/^(https?|wss?):/, r => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForFunction(() => typeof window.chkStep === 'function' && typeof state === 'object', null, { timeout: 20000 });
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  // every numeric step, every slip of its own answer
  const r = await p.evaluate((MSG) => {
    const out = { steps: 0, seen: { sign: 0, up: 0, down: 0, two: 0, sq: 0, near: 0, plain: 0 }, bad: [], longest: 0, accepted: [] };
    const SUBJ = { mechanics: MECH_CHAPTERS, optics: OPTICS_CHAPTERS, electro: ELECTRO_CHAPTERS, circuits: DC_CHAPTERS, magnetism: MAG_CHAPTERS };
    const say = (x) => (Math.abs(x) >= 1e-3 && Math.abs(x) < 1e7 ? String(+x.toPrecision(10)) : x.toExponential(8));
    for (const [subj, chapters] of Object.entries(SUBJ)) for (const ch of chapters) for (const se of ch.sections) {
      const key = ch.id + '.' + se.id, steps = CONTENT[key].problem.steps;
      state.subject = subj; state.chapter = ch.id; state.section = se.id; state.tab = 'problem';
      steps.forEach((step, si) => {
        const ans = parseFloat(step.answer), tol = step.tolerance || 0;
        if (step.tolerance === -1 || isNaN(ans) || !ans) return;
        out.steps++;
        // the band the checker accepts the answer in (chkStep's own rule)
        const sf2 = 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(ans))) - 1);
        const band = Math.max(tol, Math.abs(ans) * 0.04, sf2) * (1 + 1e-9);
        const ok = (x) => Math.abs(x - ans) <= band;
        const near = (x) => Math.abs(x - ans) <= Math.abs(ans) * 0.1;
        const pow = (x) => { const k = Math.round(Math.log10(Math.abs(x / ans))); return !!k && ok(x / Math.pow(10, k)); };
        const two = (x) => ok(x / 2) || ok(x * 2);
        const sq = (x) => ans > 0 && x > 0 && ok(Math.sqrt(x));
        const unit = step.unit ? ' ' + MSG.unit : '';
        const tryIt = (x, kind, want) => {
          // only where the slip is the one reading of the number
          if (ok(x)) return;
          const fits = [ok(-x), pow(x), two(x), sq(x)].filter(Boolean).length;
          const expect = near(x) ? MSG.with.replace('⟦1⟧', MSG.near) : (fits === 1 && want) ? MSG.with.replace('⟦1⟧', want) : fits === 0 && !want ? MSG.plain : null;
          if (expect === null) return;
          const ps = state.problemState[key] = { idx: si, inputs: [], solved: [], hints: [], feedback: [], done: false, attempts: [], tried: [] };
          ps.inputs[si] = say(x);
          chkStep(si);
          const got = ps.feedback[si];
          out.longest = Math.max(out.longest, String(got).length);
          if (ps.solved[si]) out.accepted.push(key + '#' + si + ' ' + kind + ' ' + say(x));
          else if (got !== expect) out.bad.push(key + '#' + (si + 1) + ' ' + kind + ' (' + say(x) + ' for ' + step.answer + '): ' + got);
          else out.seen[near(x) ? 'near' : kind]++;
        };
        tryIt(-ans, 'sign', MSG.sign);
        tryIt(ans * 1000, 'up', MSG.up + unit);
        tryIt(ans / 1000, 'down', MSG.down + unit);
        tryIt(ans * 2, 'two', MSG.two);
        tryIt(ans * ans, 'sq', MSG.sq);
        tryIt(ans * 1.07, 'near', MSG.near);
        tryIt(ans * 3.7, 'plain', '');
        delete state.problemState[key];
      });
    }
    return out;
  }, MSG);
  t(`every slip of every numeric step draws its own line (${r.steps} steps)`, r.bad.length === 0, r.bad.slice(0, 6).join(' || '));
  t('no slip was accepted as an answer', r.accepted.length === 0, r.accepted.slice(0, 4).join(' | '));
  for (const k of Object.keys(r.seen)) t(`the "${k}" line was exercised on many steps`, r.seen[k] > 40, String(r.seen[k]));
  t('the longest line fits the save (300 characters)', r.longest > 60 && r.longest <= 300, String(r.longest));

  // a miss that fits two slips at once is not diagnosed: 4 for an answer of 2
  const amb = await p.evaluate(() => [
    _missWhy([4], 2, 0.1, true), _missWhy([100], 10, 0.4, true), _missWhy([0.25], 0.5, 0.02, false),
    _missWhy([7], 0, 0.5, true), _missWhy([], 5, 0.2, true), _missWhy([NaN, Infinity], 5, 0.2, true),
  ]);
  t('4 for 2 (doubled or squared?), 100 for 10, 0.25 for 0.5: no diagnosis', amb[0] === '' && amb[1] === '' && amb[2] === '', JSON.stringify(amb.slice(0, 3)));
  t('an answer of zero, nothing typed, or not a number: no diagnosis', amb[3] === '' && amb[4] === '' && amb[5] === '', JSON.stringify(amb.slice(3)));
  // large powers of ten are written with a superscript; a comma read both ways counts once
  // (a comma is read both ways -- "5,000" is 5000 and 5 -- and either reading may carry the slip)
  const pw = await p.evaluate(() => [_missWhy([3.2e-10], 3.2e-16, 1.3e-17, false), _missWhy([5000, 5], 2.5, 0.1, false), _missWhy([-5], 5, 0.2, false)]);
  t('a million times too large is written 10⁶', pw[0].includes('10⁶') && !pw[0].includes('1000000'), pw[0]);
  t('"5,000" for 2.5: its reading as 5 is the doubled answer', pw[1] === MSG.two, pw[1]);
  t('the opposite sign is named', pw[2] === MSG.sign, pw[2]);

  // on the page: the line is shown under the field, survives a reload, and fits a phone
  await p.setViewportSize({ width: 360, height: 760 });
  const key = await p.evaluate(() => {
    const find = () => { for (const k of Object.keys(CONTENT)) { const s = CONTENT[k].problem.steps[0]; const a = parseFloat(s.answer); if (s.tolerance !== -1 && a > 3 && s.unit) return k; } };
    const k = find(), [c, s] = k.split('.');
    state.subject = _subjectOf(c); state.chapter = c; state.section = s; state.tab = 'problem';
    state.completed[k + '.quiz'] = true;
    state.problemState[k] = { idx: 0, inputs: [String(parseFloat(CONTENT[k].problem.steps[0].answer) * 1000)], solved: [], hints: [], feedback: [], done: false, attempts: [], tried: [] };
    render(); chkStep(0); saveState();
    return k;
  });
  await p.waitForTimeout(250);
  const shown = await p.evaluate(() => { const e = document.querySelector('.step-fb.err'); const r = e && e.getBoundingClientRect();
    return e ? { text: e.textContent, fits: r.right <= innerWidth + 1 && r.left >= -1 && e.scrollWidth <= e.clientWidth + 1 } : null; });
  t('the diagnosis is shown under the field', !!shown && shown.text === MSG.with.replace('⟦1⟧', MSG.up + ' ' + MSG.unit), shown && shown.text);
  t('it fits a 360 px phone', !!shown && shown.fits);
  await p.reload();
  await p.waitForFunction(() => typeof window.chkStep === 'function' && typeof state === 'object', null, { timeout: 20000 });
  const kept = await p.evaluate((k) => (state.problemState[k] || { feedback: [] }).feedback[0], key);
  t('it survives the save and a reload', kept === (shown && shown.text), String(kept));
  // the third miss still opens the hints, whatever the diagnosis
  const third = await p.evaluate((k) => { const ps = state.problemState[k]; const a = parseFloat(CONTENT[k].problem.steps[0].answer);
    ps.inputs[0] = String(-a); chkStep(0); ps.inputs[0] = String(a * 2); chkStep(0); return { attempts: ps.attempts[0], hints: ps.hints[0] }; }, key);
  t('three misses open the hints as before', third.attempts === 3 && third.hints === 2, JSON.stringify(third));

  t('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log(`check_feedback: ${checks - fail}/${checks} passed (${r.steps} numeric steps; sign ${r.seen.sign}, ×1000 ${r.seen.up}, ÷1000 ${r.seen.down}, ×2 ${r.seen.two}, squared ${r.seen.sq}, near ${r.seen.near}, plain ${r.seen.plain})`);
  process.exit(fail ? 1 : 0);
})();
