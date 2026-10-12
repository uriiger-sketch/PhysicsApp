// The layout follows the page's direction: every component sits where the
// reading direction puts it -- on the inline start (the right in Hebrew, the
// left in a left-to-right edition) or on the inline end -- whichever page
// this is run on. It reads the direction from <html dir> and asserts the
// mirror image of the same layout in each.
//
//   node tests/check_dir.js                                   (the Hebrew master)
//   APP_FILE=physics_game_en.html node tests/check_dir.js     (an edition)
//
// Checked at 1366 and 360 px: topic list, topic buttons, subject tabs (no
// name wider than its tab), drawer, formula sheet and its button, formula-
// box symbol chips, worked-example step badges and answer bars, summary /
// misconception / example / problem accent bars, quiz options and question
// number, the answer field, the enrichment badge, sensor-lab readouts, the
// scroll fades (both box directions, whatever the page), and the arrow keys.
const { chromium } = require('playwright');
const path = require('path');
const K = require('./_katex');   // KATEX=local: with KaTeX loaded
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

let fail = 0, pass = 0;
const t = (name, ok, got) => { if (ok) pass++; else fail++; if (!ok || process.env.VERBOSE) console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${got !== undefined ? ': ' + got : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errs = [];
  let dir = '';
  for (const [w, h] of [[1366, 800], [360, 740]]) {
    const phone = w < 800;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
    await ctx.addInitScript(() => { try { localStorage.setItem('phys_onboarded', '1'); } catch (e) {} });
    await K.route(ctx);
    await ctx.route(/^https?:/, r => (K.ON && /cdn\.jsdelivr\.net\/npm\/katex/.test(r.request().url())) ? r.fallback() : r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(F);
    await p.waitForFunction(() => typeof render === 'function' && document.querySelector('#app .tabs'), null, { timeout: 30000 });
    await K.ready(p);
    dir = await p.evaluate(() => document.documentElement.dir || 'ltr');
    const rtl = dir === 'rtl', W = `[${w}px ${dir}]`;
    if (w === 1366) console.log(`   page direction: ${dir}`);
    const go = (s, c, x, tab, pre) => p.evaluate(([s, c, x, tab, pre]) => {
      state.subject = s; state.chapter = c; state.section = x; state.tab = tab;
      if (pre) (0, eval)(pre);
      render(); window.scrollTo(0, 0);
    }, [s, c, x, tab, pre || '']).then(() => p.waitForTimeout(450));

    // ── theory: chips, accent bars, enrichment badge, topic list ──
    await go('mechanics', 'kinematics', 'distance-time', 'theory');
    let r = await p.evaluate(() => {
      const R = e => e.getBoundingClientRect(), cs = (e, ps) => getComputedStyle(e, ps);
      const o = {};
      const chip = [...document.querySelectorAll('#app .formula-box+div .param-wrap')][0];
      if (chip) { const s = R(chip.querySelector('.math-ltr')), n = R(chip.querySelector('span[style*="muted"]')), u = chip.querySelector('.unit-badge');
        o.chip = { sym: s.left, name: n.left, unit: u ? R(u).left : null }; }
      const bar = sel => { const e = document.querySelector('#app ' + sel); if (!e) return null; const c = cs(e); return { l: parseFloat(c.borderLeftWidth), r: parseFloat(c.borderRightWidth) }; };
      o.sum = bar('.sum-open'); o.mis = bar('.mis-block');
      const en = document.querySelector('#app .enrich-card');
      if (en) { const c = cs(en, '::before'), E = R(en); o.enrich = { l: parseFloat(c.left), r: parseFloat(c.right), w: E.width }; }
      const sb = document.getElementById('sidebar-nav'), mn = document.getElementById('main-content');
      if (sb && sb.offsetWidth) { const c = cs(sb); o.side = { sb: R(sb).left, main: R(mn).left, bl: parseFloat(c.borderLeftWidth), br: parseFloat(c.borderRightWidth) }; }
      const btn = document.querySelector('#app .sec-btn'), dot = btn && btn.querySelector('.sec-dot');
      if (btn && btn.offsetWidth) { const B = R(btn), D = R(dot); o.sec = { dL: D.left - B.left, dR: B.right - D.right, dir: cs(btn).direction, ta: cs(btn).textAlign }; }
      const fab = document.getElementById('formula-fab');
      if (fab && fab.offsetWidth) { const f = R(fab); o.fab = { l: f.left, r: innerWidth - f.right }; }
      o.tabs = [...document.querySelectorAll('#app .subject-tab')].filter(x => x.offsetWidth).map(x => { const l = x.querySelector('span:last-child'); return { n: l.textContent, over: R(l).width - x.clientWidth }; });
      return o;
    });
    if (r.chip) {
      const order = rtl ? (r.chip.sym > r.chip.name && (r.chip.unit === null || r.chip.name > r.chip.unit)) : (r.chip.sym < r.chip.name && (r.chip.unit === null || r.chip.name < r.chip.unit));
      t(`${W} formula chip reads symbol — name [unit] from the start`, order, JSON.stringify(r.chip));
    } else t(`${W} formula chip present`, false);
    for (const k of ['sum', 'mis']) if (r[k]) t(`${W} .${k === 'sum' ? 'sum-open' : 'mis-block'} accent bar on the start side`, rtl ? r[k].r > r[k].l : r[k].l > r[k].r, JSON.stringify(r[k]));
    if (r.enrich) t(`${W} enrichment badge on the end side`, rtl ? r.enrich.l < r.enrich.r : r.enrich.r < r.enrich.l, JSON.stringify(r.enrich));
    if (!phone) {
      t(`${W} topic list on the start side, its border toward the reading column`, rtl ? (r.side.sb > r.side.main && r.side.bl > 0 && !r.side.br) : (r.side.sb < r.side.main && r.side.br > 0 && !r.side.bl), JSON.stringify(r.side));
      t(`${W} topic button in the page direction, its dot at the start`, r.sec.dir === dir && (rtl ? r.sec.dR < r.sec.dL : r.sec.dL < r.sec.dR), JSON.stringify(r.sec));
      if (r.fab) t(`${W} formula button on the end side`, rtl ? r.fab.l < r.fab.r : r.fab.r < r.fab.l, JSON.stringify(r.fab));
      r.tabs.forEach(x => t(`${W} subject tab "${x.n}" fits its tab`, x.over <= 1.5, x.over.toFixed(1) + ' px over'));
    }

    // ── worked example and quiz ──
    await go('mechanics', 'kinematics', 'distance-time', 'quiz', "state.quizState['kinematics.distance-time']={cur:0,ans:[],done:false,v:2};");
    r = await p.evaluate(() => {
      const R = e => e.getBoundingClientRect(), o = {};
      const li = document.querySelector('#app .wx-steps>li');
      if (li) { const c = getComputedStyle(li, '::before'), L = getComputedStyle(li); o.wx = { bl: parseFloat(c.left), br: parseFloat(c.right), pl: parseFloat(L.paddingLeft), pr: parseFloat(L.paddingRight) }; }
      const a = document.querySelector('#app .wx-a'); if (a) { const c = getComputedStyle(a); o.wxa = { l: parseFloat(c.borderLeftWidth), r: parseFloat(c.borderRightWidth) }; }
      const opt = document.querySelector('#app .quiz-opt'); if (opt) { const B = R(opt), L = R(opt.querySelector('.quiz-opt-letter')), T = opt.querySelector('.quiz-opt-text');
        const rg = document.createRange(); rg.selectNodeContents(T); const X = rg.getClientRects()[0];
        // the text's first line starts right after the letter, on its far side from the edge
        o.opt = { letL: L.left - B.left, letR: B.right - L.right, gapL: X.left - L.right, gapR: L.left - X.right, ta: getComputedStyle(opt).textAlign }; }
      const q = document.querySelector('#app .quiz-q-num'); if (q) { const c = getComputedStyle(q); o.qn = { ml: parseFloat(c.marginLeft), mr: parseFloat(c.marginRight) }; }
      return o;
    });
    if (r.wx) t(`${W} worked-example badge and indent on the start side`, rtl ? (Math.abs(r.wx.br) < 1 && r.wx.pr > r.wx.pl) : (Math.abs(r.wx.bl) < 1 && r.wx.pl > r.wx.pr), JSON.stringify(r.wx));
    if (r.wxa) t(`${W} worked-example answer bar on the start side`, rtl ? r.wxa.r > r.wxa.l : r.wxa.l > r.wxa.r, JSON.stringify(r.wxa));
    if (r.opt) t(`${W} quiz option: letter and text from the start`, rtl ? (r.opt.letR < r.opt.letL && r.opt.gapR >= 0 && r.opt.gapR < 20) : (r.opt.letL < r.opt.letR && r.opt.gapL >= 0 && r.opt.gapL < 20), JSON.stringify(r.opt));
    if (r.qn) t(`${W} question number's gap toward the question`, rtl ? r.qn.ml > r.qn.mr : r.qn.mr > r.qn.ml, JSON.stringify(r.qn));

    // ── problem: statement bar, answer field ──
    await go('mechanics', 'kinematics', 'distance-time', 'problem', "state.completed['kinematics.distance-time.quiz']=true;");
    r = await p.evaluate(() => {
      const o = {}, pt = document.querySelector('#app .problem-text');
      if (pt) { const c = getComputedStyle(pt); o.pt = { l: parseFloat(c.borderLeftWidth), r: parseFloat(c.borderRightWidth) }; }
      const inp = document.querySelector('#app .step-inp'); if (inp) o.inp = getComputedStyle(inp).textAlign;
      return o;
    });
    if (r.pt) t(`${W} problem statement bar on the start side`, rtl ? r.pt.r > r.pt.l : r.pt.l > r.pt.r, JSON.stringify(r.pt));
    if (r.inp) t(`${W} answer field aligned to the page's start`, r.inp === (rtl ? 'right' : 'left'), r.inp);

    // ── sensor-lab readouts: label at the start, the value right before its unit ──
    await go('mechanics', 'kinematics', 'acceleration', 'theory', 'phoneHasMotion=function(){return true;};');
    r = await p.evaluate(() => [...document.querySelectorAll('#app .sl-chip')].filter(c => c.querySelector('u') && c.querySelector('u').textContent).slice(0, 3).map(c => {
      const R = e => e.getBoundingClientRect(), i = R(c.querySelector('i')), v = R(c.querySelector('b')), u = R(c.querySelector('u'));
      return { lab: i.left, val: v.left, valR: v.right, unit: u.left, he: /[֐-׿]/.test(c.textContent) };
    }));
    if (!r.length) t(`${W} sensor-lab readouts present`, false);
    r.forEach((c, k) => t(`${W} sensor readout ${k}: label at the start, then value and unit`, c.valR <= c.unit + 1 && (rtl || c.he ? c.lab > c.unit : c.lab < c.val), JSON.stringify(c)));

    // ── panels ──
    if (phone) {
      await go('mechanics', 'kinematics', 'distance-time', 'theory');
      await p.evaluate(() => openDrawer()); await p.waitForTimeout(500);
      r = await p.evaluate(() => { const d = document.getElementById('mobile-drawer').getBoundingClientRect(), hb = document.getElementById('hamburger-btn').getBoundingClientRect();
        return { dl: d.left, dr: innerWidth - d.right, hl: hb.left, hr: innerWidth - hb.right }; });
      t(`${W} drawer opens on the start edge`, rtl ? Math.abs(r.dr) < 1 : Math.abs(r.dl) < 1, JSON.stringify(r));
      t(`${W} menu button on the start side of the header`, rtl ? r.hr < r.hl : r.hl < r.hr, JSON.stringify(r));
      await p.evaluate(() => closeDrawer()); await p.waitForTimeout(500);
      r = await p.evaluate(() => { const d = document.getElementById('mobile-drawer').getBoundingClientRect(); return { l: d.left, r: d.right }; });
      t(`${W} closed drawer is off the screen`, r.r <= 1 || r.l >= w - 1, JSON.stringify(r));
    }
    await p.evaluate(() => openFormulaPanel()); await p.waitForTimeout(500);
    r = await p.evaluate(() => { const d = document.getElementById('formula-panel').getBoundingClientRect(); return { l: d.left, r: innerWidth - d.right }; });
    t(`${W} formula sheet opens on the end edge`, rtl ? Math.abs(r.l) < 1 : Math.abs(r.r) < 1, JSON.stringify(r));
    await p.evaluate(() => closeFormulaPanel()); await p.waitForTimeout(400);

    if (!phone) {
      // ── scroll fades: the hidden side, for a box of either direction ──
      r = await p.evaluate(async () => {
        const out = {};
        for (const d of ['ltr', 'rtl']) {
          const box = document.createElement('div'); box.style.cssText = 'width:200px;overflow-x:auto;white-space:nowrap;direction:' + d;
          box.innerHTML = '<span style="display:inline-block;width:500px">x</span>'; document.body.appendChild(box);
          const cls = () => (box.classList.contains('x-more-l') ? 'L' : '') + (box.classList.contains('x-more-r') ? 'R' : '');
          _scrollEdges(box); const rest = cls();
          box.scrollLeft = d === 'rtl' ? -150 : 150; _scrollEdges(box); const mid = cls();
          box.scrollLeft = d === 'rtl' ? -1e4 : 1e4; _scrollEdges(box); const end = cls();
          box.style.width = '497px'; box.scrollLeft = 0; _scrollEdges(box); const tiny = cls();
          box.remove(); out[d] = [rest, mid, end, tiny].join(' ');
        }
        return out;
      });
      t('scroll fade: a left-to-right box hides its end on the right, then both, then its start', r.ltr === 'R LR L ', r.ltr);
      t('scroll fade: a right-to-left box hides its end on the left, then both, then its start', r.rtl === 'L LR R ', r.rtl);

      // ── arrow keys: back along the reading direction is the previous topic ──
      await go('mechanics', 'kinematics', 'const-velocity', 'theory');
      await p.keyboard.press(rtl ? 'ArrowRight' : 'ArrowLeft'); await p.waitForTimeout(250);
      const back = await p.evaluate(() => state.section);
      await p.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight'); await p.waitForTimeout(250);
      const fwd = await p.evaluate(() => state.section);
      t(`arrow toward the start goes back, toward the end forward (${rtl ? '→/←' : '←/→'})`, back === 'distance-time' && fwd === 'const-velocity', back + ' / ' + fwd);
    }
    await ctx.close();
  }
  await b.close();
  t('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed -- the layout ${fail ? 'does not follow' : 'follows'} the page direction (${dir})`);
  process.exit(fail ? 1 : 0);
})();
