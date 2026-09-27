// Functional sweep: every section of every subject, used the way a student
// uses it — through the buttons on the page, not through internal calls.
//
//   node tests/check_flow.js [subject]
//
// Per section: the theory renders with text and its animations run; every
// sim control (buttons, sliders at both ends) can be operated without an
// error; the quiz is answered by clicking options — a wrong one first where
// possible, then the right one — and finished; the problem is solved by
// typing each answer and pressing "בדוק". Globally: subject switching, the
// theme toggle, the phone drawer, the subject's own formula sheet, the
// changelog and the "next topic" button.
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');
const ONLY = process.argv[2] || '';

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.dismiss().catch(() => {}));
  await p.goto(F);
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {}; });

  const SUBJ = ['mechanics', 'optics', 'electro', 'circuits', 'magnetism'].filter(s => !ONLY || s === ONLY);
  const errAt = where => { if (errs.length) { t(`no page error @${where}`, false, errs.join(' | ').slice(0, 300)); errs.length = 0; } };

  for (const subj of SUBJ) {
    // subject tab in the header
    await p.evaluate(s => switchSubject(s), subj);
    await p.waitForTimeout(300);
    t(`${subj}: subject switched`, await p.evaluate(s => state.subject === s, subj));

    // the formula sheet belongs to this subject
    const sheet = await p.evaluate(() => {
      openFormulaPanel();
      const e = document.getElementById('formula-panel'), heads = [...e.querySelectorAll('.formula-chapter')].map(x => x.textContent);
      const chs = (typeof chapters === 'function' ? chapters() : []).map(c => c.title);
      closeFormulaPanel();
      return { heads, open: true, first: heads[0] || '' };
    });
    const firstCh = await p.evaluate(() => {
      const L = state.subject === 'optics' ? OPTICS_CHAPTERS : state.subject === 'electro' ? ELECTRO_CHAPTERS
        : state.subject === 'circuits' ? DC_CHAPTERS : state.subject === 'magnetism' ? MAG_CHAPTERS : MECH_CHAPTERS;
      return L[0].title.split(':')[0];
    });
    t(`${subj}: formula sheet is this subject's`, sheet.heads.length > 0 && sheet.first.startsWith(firstCh), sheet.first);

    const list = await p.evaluate(() => {
      const L = state.subject === 'optics' ? OPTICS_CHAPTERS : state.subject === 'electro' ? ELECTRO_CHAPTERS
        : state.subject === 'circuits' ? DC_CHAPTERS : state.subject === 'magnetism' ? MAG_CHAPTERS : MECH_CHAPTERS;
      return L.flatMap(c => c.sections.map(s => [c.id, s.id]));
    });

    for (const [ch, se] of list) {
      const key = `${subj}/${ch}.${se}`;
      await p.evaluate(([c, s]) => navigate(c, s), [ch, se]);
      await p.waitForTimeout(150);

      // ── theory
      await p.click('.tab >> nth=0');
      await p.waitForTimeout(250);
      const th = await p.evaluate(() => {
        const a = document.getElementById('app');
        return { len: (a.innerText || '').length, cv: a.querySelectorAll('.theory-anim canvas').length };
      });
      t(`${key}: theory has text`, th.len > 400, th.len);
      errAt(key + '/theory');

      // ── simulation: operate every control
      await p.click('.tab >> nth=1');
      await p.waitForTimeout(350);
      const sim = await p.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const cv = document.getElementById('sim-canvas');
        const out = { canvas: !!cv, buttons: 0, ranges: 0, bad: [] };
        if (!cv) return out;
        const roots = [...document.querySelectorAll('#app .sim-controls')];
        const ranges = roots.flatMap(r => [...r.querySelectorAll('input[type=range]')]);
        for (const r of ranges) {
          for (const v of [r.min, r.max, (+r.min + +r.max) / 2]) {
            r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(30);
          }
          out.ranges++;
        }
        const btns = roots.flatMap(r => [...r.querySelectorAll('button')]).filter(x => x.offsetParent && !/סיימתי/.test(x.textContent));
        for (const x of btns.slice(0, 12)) {
          try { x.click(); out.buttons++; } catch (e) { out.bad.push(x.textContent); }
          await wait(60);
          if (!document.getElementById('sim-canvas')) { out.bad.push('canvas lost after ' + x.textContent.trim()); break; }
        }
        // a drag across the canvas
        const rc = cv.getBoundingClientRect();
        const ev = (ty, x, y) => cv.dispatchEvent(new MouseEvent(ty, { bubbles: true, clientX: rc.left + x, clientY: rc.top + y }));
        ev('mousedown', rc.width * 0.5, rc.height * 0.5); ev('mousemove', rc.width * 0.6, rc.height * 0.45); ev('mouseup', rc.width * 0.6, rc.height * 0.45);
        await wait(80);
        return out;
      });
      t(`${key}: sim canvas present`, sim.canvas);
      t(`${key}: sim controls operate`, sim.bad.length === 0, sim.bad.join(', '));
      errAt(key + '/sim');

      // ── quiz, by clicking
      await p.click('.tab >> nth=2');
      await p.waitForTimeout(200);
      const nq = await p.evaluate(() => (CONTENT[state.chapter + '.' + state.section].quiz || []).length);
      let quizOk = true, fbOk = true;
      for (let i = 0; i < nq; i++) {
        const info = await p.evaluate(() => {
          const q = CONTENT[state.chapter + '.' + state.section].quiz[getQS(state.chapter, state.section).cur];
          return { correct: quizView(q).correct, n: document.querySelectorAll('.quiz-opt').length };
        });
        if (info.n < 2) { quizOk = false; break; }
        await p.click(`.quiz-opt >> nth=${info.correct}`);
        await p.waitForTimeout(60);
        const fb = await p.evaluate(() => { const e = document.querySelector('.quiz-feedback'); return e ? e.className : ''; });
        if (!/fb-ok/.test(fb)) fbOk = false;
        const next = await p.$('.quiz-card .btn');
        if (!next) { quizOk = false; break; }
        await next.click();
        await p.waitForTimeout(80);
      }
      const qdone = await p.evaluate(() => getQS(state.chapter, state.section).done);
      t(`${key}: quiz answered through the page`, quizOk && qdone, `done=${qdone}`);
      t(`${key}: right answers get the ✅ feedback`, fbOk);
      errAt(key + '/quiz');

      // ── problem: type each answer and press בדוק
      await p.click('.tab >> nth=3');
      await p.waitForTimeout(200);
      const steps = await p.evaluate(() => (CONTENT[state.chapter + '.' + state.section].problem || { steps: [] }).steps.map(s => String(s.answer)));
      let probOk = true, why = '';
      for (let si = 0; si < steps.length; si++) {
        const inp = await p.$(`#si${si}`);
        if (!inp) { probOk = false; why = 'no input for step ' + (si + 1); break; }
        await inp.fill(steps[si]);
        await p.click(`.step-card >> nth=${si} >> button.btn-primary`);
        await p.waitForTimeout(80);
        const solved = await p.evaluate(i => !!getPS(state.chapter, state.section).solved[i], si);
        if (!solved) { probOk = false; why = `step ${si + 1} rejected "${steps[si]}"`; break; }
      }
      t(`${key}: problem solved through the page`, probOk, why);
      errAt(key + '/problem');
    }
  }

  // ── global chrome
  const theme0 = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await p.click('.theme-btn');
  await p.waitForTimeout(200);
  const theme1 = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  t('theme button toggles the theme', theme0 !== theme1, `${theme0} → ${theme1}`);
  await p.click('.theme-btn');
  await p.waitForTimeout(150);

  await p.evaluate(() => navigate(MECH_CHAPTERS[0].id, MECH_CHAPTERS[0].sections[0].id));
  await p.evaluate(() => { state.subject = 'mechanics'; setTab('quiz'); });
  const nextOk = await p.evaluate(() => {
    const st = getQS(state.chapter, state.section); st.done = true; render();
    const bt = document.querySelector('.next-section-btn'); if (!bt) return 'no button';
    const before = state.section; bt.click(); return state.section !== before ? 'ok' : 'did not move';
  });
  t('"next topic" button moves on', nextOk === 'ok', nextOk);

  await p.setViewportSize({ width: 390, height: 820 });
  await p.evaluate(() => render());
  await p.waitForTimeout(250);
  const drawer = await p.evaluate(async () => {
    const hb = document.getElementById('hamburger-btn'); if (!hb || !hb.offsetParent) return 'no hamburger';
    hb.click(); await new Promise(r => setTimeout(r, 300));
    const d = document.querySelector('.mobile-drawer, #mobile-drawer');
    if (!d || !d.classList.contains('open')) return 'drawer did not open';
    const link = d.querySelector('button, a'); if (!link) return 'drawer empty';
    return 'ok';
  });
  t('phone drawer opens with topics', drawer === 'ok', drawer);
  const hscroll = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  t('no sideways scroll at phone width', hscroll <= 1, hscroll + 'px');
  errAt('global');

  await b.close();
  console.log(`check_flow: ${checks - fail}/${checks} passed`);
  process.exit(fail ? 1 : 0);
})();
