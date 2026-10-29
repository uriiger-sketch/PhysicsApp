// The sim kit: missions the simulation checks, the live model line, the
// prediction card, the mode bar -- what every simulation builds its lesson on.
//
//   node tests/check_simkit.js                       the master (an English
//                                                    edition is built for the
//                                                    shared-progress checks)
//   APP_FILE=<edition.html> node tests/check_simkit.js
//
// 1. The kit itself, on a kit built in the page with missions of its own: a
//    mission is not solved before the learner touches the sim (a hint, a
//    prediction or the description are not a touch), is solved once, gives
//    10 XP exactly once, calls onSolve once, shows why; the list folds to one
//    line when it comes back all done; the model line is rewritten only when
//    it changes; the prediction marks right and wrong and calls back with
//    (choice, correct); the mode bar reports its mode; a reduced-motion
//    reader gets no animation.
// 2. On a real simulation (colour mixing): a mission solved by the hand on
//    the canvas gives 10 XP once, survives a restart of the sim and a reload
//    of the page, and is the same in the other language (both pages served
//    from one origin, so they share localStorage, as on the site); one solved
//    there is solved here.
// 3. Every simulation that uses the kit: a restart leaves exactly one panel
//    and at most one mode bar.
// No page errors anywhere.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(ROOT, 'physics_game_v28.html');
const UNDER = process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : MASTER;
const isMaster = UNDER === MASTER;
// the other language: the master when an edition is under test; else a fresh
// English build (the committed edition may lag behind the master)
let OTHER = MASTER;
if (isMaster) {
  OTHER = path.join(os.tmpdir(), 'simkit-' + process.pid + '-en.html');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'i18n.js'), 'build', 'en'], { env: { ...process.env, I18N_OUT: OTHER }, stdio: 'ignore' });
}
const ORIGIN = 'http://simkit.test/';
const FILES = { 'a.html': UNDER, 'b.html': OTHER };

let fail = 0, n = 0;
const t = (name, ok, info) => { n++; if (!ok) fail++; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info !== undefined ? ': ' + info : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const errs = [];
  const newCtx = async (o) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...(o || {}) });
    await ctx.route('**/*', r => {
      const name = r.request().url().split('#')[0].split('?')[0].replace(ORIGIN, '');
      if (FILES[name]) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(FILES[name]) });
      return r.abort();
    });
    return ctx;
  };
  const page = async (ctx, file) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(file + ': ' + e.message));
    p.on('dialog', d => d.dismiss().catch(() => {}));
    await p.goto(ORIGIN + file);
    await p.waitForFunction(() => typeof render === 'function' && typeof simKit === 'function', null, { timeout: 20000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
    return p;
  };
  const openSim = (p, c, s) => p.evaluate(async ([c, s]) => {
    state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : c.startsWith('dc-') ? 'circuits' : c.startsWith('mag-') ? 'magnetism' : 'mechanics';
    state.chapter = c; state.section = s; state.tab = 'sim'; render();
    for (let i = 0; i < 60 && !document.querySelector('#app .sk-panel'); i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 250));
  }, [c, s]);

  // ── 1. the kit on its own ───────────────────────────────────────────
  {
    const ctx = await newCtx(), p = await page(ctx, 'a.html');
    const r = await p.evaluate(async () => {
      const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
      state.chapter = 'kit'; state.section = '__check__';
      const host = document.createElement('div'); host.className = 'sim-container';
      host.innerHTML = '<div class="sim-canvas-wrap"><canvas id="kt-cv" width="300" height="100"></canvas></div><div class="sim-controls"><input type="range" id="inp-kt-x"></div>';
      document.getElementById('app').appendChild(host);
      const cv = host.querySelector('canvas'), solvedBy = [];
      const make = () => simKit(host.querySelector('canvas'), { onSolve: i => solvedBy.push(i), missions: [
        { id: 'always', text: 'A', hint: 'H', why: 'because A', done: () => true },
        { text: 'B', why: 'because B', done: s => s.v > 5 }] });
      const xp0 = state.xp;
      let kit = make();
      out.panels = host.querySelectorAll('.sk-panel').length;
      out.items = host.querySelectorAll('.sk-m').length;
      out.nextFirst = host.querySelectorAll('.sk-m')[0].classList.contains('next');
      kit.check({ v: 0 });
      out.beforeTouch = kit.solved(0) || kit.solved(1);
      // a hint, a prediction: not a touch of the sim
      host.querySelector('.sk-hint-b').click();
      out.hintOpen = !host.querySelector('.sk-hint').hidden && host.querySelector('.sk-hint-b').getAttribute('aria-expanded') === 'true';
      let cb = null;
      kit.predict({ q: 'Q?', opts: ['a', 'b', 'c'], correct: 1, why: 'W' }, (i, ok) => { cb = [i, ok]; });
      out.predictRole = host.querySelector('.sk-predict').getAttribute('role');
      host.querySelectorAll('.sk-opt')[2].click();
      kit.check({ v: 0 });
      out.afterHintAndPredict = kit.solved(0);
      out.cb = cb;
      const opts = [...host.querySelectorAll('.sk-opt')];
      out.marks = opts.map(o => o.classList.contains('right') ? 'R' : o.classList.contains('wrong') ? 'W' : '-').join('');
      out.signs = opts.map(o => o.querySelector('.sk-mk').textContent || '-').join('');
      out.answerShown = !host.querySelector('.sk-pa').hidden && /W/.test(host.querySelector('.sk-pa').textContent);
      opts[1].click(); out.cbAgain = cb && cb[0] === 2;               // a second answer is ignored
      // the hand on the canvas
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      kit.check({ v: 0 }); kit.check({ v: 0 });
      out.solved0 = kit.solved(0); out.solved1 = kit.solved(1);
      out.xpAfterOne = state.xp - xp0;
      out.why0 = !host.querySelectorAll('.sk-why')[0].hidden;
      out.why1 = !host.querySelectorAll('.sk-why')[1].hidden;
      out.count = host.querySelector('.sk-count').textContent;
      out.pips = [...host.querySelectorAll('.sk-pips i')].map(i => i.classList.contains('on') ? 1 : 0).join('');
      out.nextSecond = host.querySelectorAll('.sk-m')[1].classList.contains('next');
      kit.check({ v: 9 }); kit.check({ v: 9 });
      out.xpAfterTwo = state.xp - xp0;
      out.onSolve = solvedBy.join(',');
      out.allClass = host.querySelector('.sk-missions').classList.contains('all');
      out.saved = JSON.stringify((JSON.parse(localStorage.getItem('phys_game_state_v2')).missions || {})['kit.__check__']);
      // the model line: written only when it changes
      let writes = 0; const mo = new MutationObserver(m => { writes += m.length; });
      kit.model('I = ' + kit.m('x_0 = 2 A'));
      const M = host.querySelector('.sk-model'); mo.observe(M, { childList: true, subtree: true, characterData: true });
      for (let i = 0; i < 30; i++) kit.model('I = ' + kit.m('x_0 = 2 A'));
      await wait(30); out.modelWrites = writes;
      out.modelSub = !!M.querySelector('.sk-f sub');
      kit.model('I = ' + kit.m('x_0 = 3 A')); await wait(30); out.modelChanged = writes > 0 && /3 A/.test(M.textContent);
      // the mode bar
      let mode = null;
      const tabs = kit.tabs({ label: 'modes', value: 'kt-a', items: [{ id: 'kt-a', label: 'A' }, { id: 'kt-b', label: 'B' }], onChange: v => { mode = v; } });
      host.querySelector('#btn-sk-kt-b').click();
      out.tabs = [mode, tabs.get(), host.querySelector('#btn-sk-kt-b').getAttribute('aria-pressed'), host.querySelector('#btn-sk-kt-a').getAttribute('aria-pressed')].join(' ');
      out.tabsAbove = host.firstElementChild.classList.contains('sk-tabs');
      // built again (a restart): one panel, still solved, folded to one line
      kit = make();
      out.panelsAgain = host.querySelectorAll('.sk-panel').length + host.querySelectorAll('.sk-tabs').length;
      out.stillSolved = kit.solved(0) && kit.solved(1);
      out.folded = host.querySelector('.sk-missions').classList.contains('shut') && host.querySelector('.sk-head').getAttribute('aria-expanded') === 'false';
      host.querySelector('.sk-head').click();
      out.unfolds = !host.querySelector('.sk-missions').classList.contains('shut');
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); kit.check({ v: 9 });
      out.xpFinal = state.xp - xp0;
      out.listeners = typeof host._skArm === 'function';
      delete state.missions['kit.__check__']; saveState(); host.remove();
      return out;
    });
    t('kit: one panel with its missions, the first marked next', r.panels === 1 && r.items === 2 && r.nextFirst, JSON.stringify(r));
    t('kit: a mission true from the start is not solved before the learner touches the sim', !r.beforeTouch);
    t('kit: a hint opens (aria-expanded) and, like a prediction, is not a touch of the sim', r.hintOpen && !r.afterHintAndPredict && r.predictRole === 'group');
    t('kit: the prediction marks the right answer and the wrong choice, with a sign as well as a colour', r.marks === '-RW' && r.signs === '-✓✗' && r.answerShown, r.marks + ' ' + r.signs);
    t('kit: the prediction calls back once with (choice, correct)', JSON.stringify(r.cb) === '[2,false]' && r.cbAgain, JSON.stringify(r.cb));
    t('kit: after a touch, the mission is solved once: 10 XP, its reason shown, the next one marked', r.solved0 && !r.solved1 && r.xpAfterOne === 10 && r.why0 && !r.why1 && r.nextSecond, JSON.stringify(r));
    t('kit: progress at a glance (count and pips)', r.count === '1/2' && r.pips === '10', r.count + ' ' + r.pips);
    t('kit: a second mission, 10 XP more, each mission once (onSolve once each)', r.xpAfterTwo === 20 && r.onSolve === '0,1' && r.allClass, r.xpAfterTwo + ' ' + r.onSolve);
    t('kit: saved per section, under the mission id or its index', r.saved === '{"1":true,"always":true}', r.saved);
    t('kit: the model line is not rewritten while it does not change, and is when it does', r.modelWrites === 0 && r.modelChanged, r.modelWrites);
    t('kit: maths in the model line sets x_0 as a subscript', r.modelSub);
    t('kit: the mode bar sits above the canvas and reports its mode', r.tabs === 'kt-b kt-b true false' && r.tabsAbove, r.tabs);
    t('kit: built again, one panel (no mode bar left behind), missions still solved, folded to one line that opens', r.panelsAgain === 1 && r.stillSolved && r.folded && r.unfolds, JSON.stringify(r));
    t('kit: no XP for a mission solved before', r.xpFinal === 20, r.xpFinal);
    await ctx.close();
  }
  // the kit's texts get the page's inline-maths pass: a number and its unit
  // stay one left-to-right run, a formula keeps the full stop touching it,
  // and running the pass again (as some sims do) changes nothing
  {
    const ctx = await newCtx(), p = await page(ctx, 'a.html');
    const r = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
      state.chapter = 'kit'; state.section = '__bidi__';
      const host = document.createElement('div'); host.className = 'sim-container';
      host.innerHTML = '<div class="sim-canvas-wrap"><canvas width="300" height="100"></canvas></div>';
      document.getElementById('app').appendChild(host);
      const kit = simKit(host.querySelector('canvas'), { missions: [
        { text: 'הזיזו את הגוף 10 cm, עד ' + M('x=2\\,\\text{m}') + '.', hint: 'המטען הוא 5 μC.', why: 'כי ' + M('F=ma') + '.', done: () => false }] });
      kit.model('המהירות: ' + kit.m('v = 3.0 m/s') + '.');
      kit.predict({ q: 'כמה אלקטרונים: 6×10¹⁹ או 10 cm?', opts: ['א', 'ב'], correct: 0, why: 'בערך 6×10¹⁹.' }, () => {});
      await wait(50);
      const P = kit.el, runs = [...P.querySelectorAll('.ltr-run')].map(e => e.textContent);
      out.runs = runs.join(' | ');
      out.mission = runs.includes('10 cm');
      out.hint = !!P.querySelector('.sk-hint .ltr-run') || /5 μC/.test([...P.querySelectorAll('.sk-hint .math-ltr,.sk-hint .ltr-run')].map(e => e.textContent).join(''));
      out.predict = /6×10¹⁹/.test([...P.querySelectorAll('.sk-pq .ltr-run,.sk-pq .math-ltr')].map(e => e.textContent).join(' '));
      const g = P.querySelector('.sk-t .mglue');
      out.glued = !!(g && g.querySelector('.math-ltr') && /\.$/.test(g.textContent));
      const f = P.querySelector('.sk-model .sk-f');
      out.modelInline = getComputedStyle(f).display === 'inline' && f.nextSibling && /^\./.test(f.nextSibling.textContent);
      const h0 = P.innerHTML; fixInlineMath(P); fixInlineMath(P); out.idempotent = P.innerHTML === h0;
      delete state.missions['kit.__bidi__']; host.remove();
      return out;
    });
    t('kit texts: "10 cm" in a mission and the numbers of a hint and a prediction are left-to-right runs', r.mission && r.hint && r.predict, r.runs);
    t('kit texts: a formula and the full stop after it are glued (_gluePunct); kit.m maths is inline, the stop follows it', r.glued && r.modelInline, JSON.stringify(r));
    t('kit texts: the inline-maths pass run twice more changes nothing (sims that run it themselves stay harmless)', r.idempotent);
    await ctx.close();
  }
  // reduced motion: the success moment does not animate
  {
    const ctx = await newCtx({ reducedMotion: 'reduce' }), p = await page(ctx, 'a.html');
    const anim = await p.evaluate(() => {
      state.chapter = 'kit'; state.section = '__rm__';
      const host = document.createElement('div'); host.className = 'sim-container';
      host.innerHTML = '<div class="sim-canvas-wrap"><canvas></canvas></div>';
      document.getElementById('app').appendChild(host);
      const kit = simKit(host.querySelector('canvas'), { missions: [{ text: 'A', why: 'W', done: () => true }] });
      host.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); kit.check({});
      const li = host.querySelector('.sk-m'), r = [getComputedStyle(li).animationName, getComputedStyle(li.querySelector('.sk-box')).animationName].join(' ');
      delete state.missions['kit.__rm__']; saveState(); return r;
    });
    t('kit: under prefers-reduced-motion the success moment does not animate', anim === 'none none', anim);
    await ctx.close();
  }

  // ── 2. a real simulation, across restart, reload and language ───────
  {
    const ctx = await newCtx();
    let p = await page(ctx, 'a.html');
    await openSim(p, 'opt-light', 'color-mixing');
    const st = () => p.evaluate(() => ({ xp: state.xp, done: [...document.querySelectorAll('#app .sk-m')].map(li => li.classList.contains('done') ? 1 : 0).join(''),
      panels: document.querySelectorAll('#app .sk-panel').length, tabs: document.querySelectorAll('#app .sk-tabs').length,
      saved: JSON.stringify((state.missions || {})['opt-light.color-mixing'] || {}) }));
    // tap a canvas spot whose colour passes a test (the yellow of red + green, the blue of two filters)
    const tapColour = async (src) => {
      const at = await p.evaluate((src) => {
        const f = new Function('r', 'g', 'b', 'return ' + src), cv = document.getElementById('sim-canvas'), g = cv.getContext('2d');
        const d = g.getImageData(0, 0, cv.width, cv.height).data, R = cv.getBoundingClientRect(), k = cv.width / R.width;
        let sx = 0, sy = 0, m = 0;
        for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) { const i = (y * cv.width + x) * 4; if (f(d[i], d[i + 1], d[i + 2])) { sx += x; sy += y; m++; } }
        return m ? { x: R.left + sx / m / k, y: R.top + sy / m / k } : null;
      }, src);
      if (at) { await p.mouse.click(at.x, at.y); await p.waitForTimeout(250); }
      return at;
    };
    const s0 = await st();
    t('colour mixing: a fresh learner sees four missions, none solved, one panel and one mode bar', s0.done === '0000' && s0.panels === 1 && s0.tabs === 1, JSON.stringify(s0));
    await (await p.$('#sim-canvas')).scrollIntoViewIfNeeded();
    const y = await tapColour('r>200&&g>200&&b<80');
    const s1 = await st();
    t('colour mixing: the probe on the yellow of two lamps solves the first mission, 10 XP', y && s1.done === '1000' && s1.xp - s0.xp === 10, JSON.stringify(s1));
    await tapColour('r>200&&g>200&&b<80');
    const s2 = await st();
    t('colour mixing: solving it again gives nothing', s2.xp === s1.xp, s2.xp - s1.xp);
    await p.evaluate(() => restartSim()); await p.waitForTimeout(900);
    const s3 = await st();
    t('colour mixing: a restart keeps it solved, one panel, one mode bar, no XP', s3.done === '1000' && s3.panels === 1 && s3.tabs === 1 && s3.xp === s1.xp, JSON.stringify(s3));
    await p.reload(); await p.waitForFunction(() => typeof render === 'function'); await p.waitForTimeout(500);
    await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
    await openSim(p, 'opt-light', 'color-mixing');
    const s4 = await st();
    t('colour mixing: a reload keeps it solved and the XP', s4.done === '1000' && s4.xp === s1.xp && s4.saved === '{"cm-yellow":true}', JSON.stringify(s4));
    // the other language, same origin: the same progress
    const q = await page(ctx, 'b.html');
    const lang = await q.evaluate(() => document.documentElement.lang);
    p = q; await openSim(p, 'opt-light', 'color-mixing');
    const s5 = await st();
    t(`colour mixing in the other edition (${lang}): the same mission solved, the same XP`, s5.done === '1000' && s5.xp === s1.xp, JSON.stringify(s5));
    await p.click('#btn-sk-cm-sub'); await p.waitForTimeout(400);
    await (await p.$('#sim-canvas')).scrollIntoViewIfNeeded();
    await tapColour('b>180&&r<110&&g<40');
    const s6 = await st();
    t('colour mixing: a mission solved there (two filters make blue) gives 10 XP there', s6.done === '1010' && s6.xp === s1.xp + 10, JSON.stringify(s6));
    p = await page(ctx, 'a.html'); await openSim(p, 'opt-light', 'color-mixing');
    const s7 = await st();
    t('colour mixing: and is solved here too', s7.done === '1010' && s7.xp === s6.xp, JSON.stringify(s7));
    await ctx.close();
  }

  // ── 3. every simulation that uses the kit: a restart leaves one panel ──
  {
    const ctx = await newCtx(), p = await page(ctx, 'a.html');
    const r = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), bad = [], used = [];
      for (const [s, chs] of [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]])
        for (const c of chs) for (const x of c.sections) {
          const C = CONTENT[c.id + '.' + x.id]; if (!C || !C.sim) continue;
          state.subject = s; state.chapter = c.id; state.section = x.id; state.tab = 'sim'; render();
          await wait(450);
          if (!document.querySelector('#app .sk-panel')) continue;
          used.push(x.id);
          restartSim(); await wait(450); restartSim(); await wait(450);
          const np = document.querySelectorAll('#app .sk-panel').length, nt = document.querySelectorAll('#app .sk-tabs').length;
          if (np !== 1 || nt > 1) bad.push(c.id + '.' + x.id + ' panels=' + np + ' tabs=' + nt);
        }
      return { bad, used };
    });
    console.log(`   ${r.used.length} simulations use the kit: ${r.used.join(' ')}`);
    t('every simulation with the kit: two restarts leave one panel and at most one mode bar', r.used.length >= 1 && r.bad.length === 0, r.bad.join(' | '));
    await ctx.close();
  }

  t('no page errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  await b.close();
  if (isMaster) try { fs.unlinkSync(OTHER); } catch (e) {}
  console.log(fail ? `\n❌ ${fail} of ${n} SIM KIT CHECKS FAILED` : `\n✅ THE SIM KIT KEEPS ITS PROMISES (${n} checks)`);
  process.exit(fail ? 1 : 0);
})();
