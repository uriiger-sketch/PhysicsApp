// Whole-app smoke test: walk every section of every subject through every tab,
// paint every simulation, and assert nothing throws and nothing renders blank.
//
//   node tests/smoke.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0, checks = 0;
const t = (name, got, want) => {
  checks++;
  const ok = String(got) === String(want);
  if (!ok) { fail++; console.log(`   FAIL ${name}: got ${got} want ${want}`); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const subjects = await p.evaluate(() => ['mechanics', 'optics', 'electro'].map(s => {
    state.subject = s;
    return { s, chapters: getChapters().map(c => ({ id: c.id, sections: c.sections.map(x => x.id) })) };
  }));

  const blank = [];   // canvases that painted nothing at all
  const empty = [];   // tabs that rendered no content
  let sections = 0, sims = 0, quizzes = 0, problems = 0;

  for (const { s, chapters } of subjects) {
    for (const c of chapters) {
      for (const se of c.sections) {
        sections++;
        const r = await p.evaluate(async ([s, ch, se]) => {
          const out = { theory: 0, sim: 0, quiz: 0, prob: 0, blank: [], canvases: 0 };
          state.subject = s; state.chapter = ch; state.section = se;

          state.tab = 'theory'; render();
          await new Promise(r => setTimeout(r, 700));   // KaTeX retry loop, then a 60 ms boot
          out.theory = (document.getElementById('app') || {}).textContent?.trim().length || 0;
          // theory animations paint into their own canvases
          document.querySelectorAll('#app canvas').forEach(cv => {
            out.canvases++;
            const g = cv.getContext('2d');
            const d = g.getImageData(0, 0, cv.width, cv.height).data;
            let ink = 0;
            for (let i = 3; i < d.length; i += 400) if (d[i] > 8) ink++;
            if (!ink) out.blank.push(cv.id || 'anon');
          });

          state.tab = 'sim'; render();
          await new Promise(r => setTimeout(r, 800));   // same, plus initSim's two frames
          const cv = document.querySelector('#app canvas');
          if (cv) {
            out.sim = 1; out.canvases++;
            const g = cv.getContext('2d');
            const d = g.getImageData(0, 0, cv.width, cv.height).data;
            let ink = 0;
            for (let i = 3; i < d.length; i += 400) if (d[i] > 8) ink++;
            if (!ink) out.blank.push('sim:' + (cv.id || 'anon'));
          }

          state.tab = 'quiz'; render();
          await new Promise(r => setTimeout(r, 60));
          out.quiz = document.querySelectorAll('#app .quiz-opt').length;

          state.tab = 'problem'; render();
          await new Promise(r => setTimeout(r, 60));
          out.prob = (document.getElementById('app') || {}).textContent?.trim().length || 0;
          return out;
        }, [s, c.id, se]);

        const key = `${s}/${c.id}.${se}`;
        if (!r.theory) empty.push(key + ' theory');
        if (!r.prob) empty.push(key + ' problem');
        if (r.sim) sims++;
        if (r.quiz) quizzes++;
        if (r.prob) problems++;
        r.blank.forEach(x => blank.push(key + ' → ' + x));
      }
    }
  }

  console.log(`   ${sections} sections walked, ${sims} simulations painted, ${quizzes} quizzes rendered`);
  t('every section renders theory and a problem tab', empty.join(' | '), '');
  t('no canvas renders blank', blank.join(' | '), '');
  t('every section has a simulation', sims, sections);
  t('every section has a quiz', quizzes, sections);

  // the three-state progress dots
  const dots = await p.evaluate(() => {
    // render() marks the CURRENT section visited, so the dot under test has to
    // belong to a section we are not standing on
    state.subject = 'mechanics'; state.chapter = 'shm'; state.section = 'pendulum';
    state.visited = {}; state.completed = {}; render();
    const cls = () => Array.from(document.querySelectorAll('#sidebar-nav .sec-dot'))
      .map(e => e.className.replace('sec-dot', '').replace('active', '').trim());
    const before = cls();
    state.visited['kinematics.distance-time'] = true; render();
    const mid = cls();
    state.completed['kinematics.distance-time.problem'] = true; render();
    return { n: before.length, red: before[0], yellow: mid[0], green: cls()[0] };
  });
  t('a never-opened subsection is fresh (red)', dots.red, 'fresh');
  t('an opened one turns seen (yellow)', dots.yellow, 'seen');
  t('and a solved one turns done (green)', dots.green, 'done');

  // theory animation loops must not survive leaving the tab
  const leak = await p.evaluate(async () => {
    state.subject = 'mechanics'; state.chapter = 'forces'; state.section = 'force-types';
    state.tab = 'theory'; render();
    await new Promise(r => setTimeout(r, 300));
    const live = Object.keys(_thAnim || {}).length;
    state.tab = 'quiz'; render();
    await new Promise(r => setTimeout(r, 300));
    return { live, after: Object.keys(_thAnim || {}).length };
  }).catch(() => null);
  if (leak) {
    t('theory animations run while the theory tab is open', leak.live > 0, true);
    t('and every one of them stops on leaving it', leak.after, 0);
  }

  // the sensor-lab flag in the sidebar
  const flags = await p.evaluate(() => {
    state.subject = 'mechanics'; render();
    const marked = document.querySelectorAll('#sidebar-nav .sec-lab').length;
    let want = 0;
    for (const k of Object.keys(SENSOR_LABS)) if (!k.startsWith('opt-') && !k.startsWith('elc-')) want++;
    return { marked, want };
  });
  t('every sensor section is flagged in the sidebar', flags.marked, flags.want);

  console.log('   page errors:', errs.length ? errs.join(' | ') : 'NONE');
  if (errs.length) fail++;
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED (of ${checks})` : `\n✅ ALL ${checks} SMOKE CHECKS PASS`);
  process.exit(fail ? 1 : 0);
})();
