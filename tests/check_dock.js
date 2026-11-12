// A simulation on a phone: the canvas and its controls on one screen.
//
//   node tests/check_dock.js           (every sim on a phone upright and on its
//                                       side, then the hardest ones on every
//                                       phone size, then the dock's own parts)
//
// On a phone or a tablet a simulation is docked (_simDockSet in the master):
// upright, the canvas stays at the top of the screen and the rest scrolls
// beneath it, its sliders first; on its side, the canvas sits beside the rest.
// For every simulation, scrolled to where it docks:
//   - the canvas is whole on the screen, and so is the first row of its
//     controls: under it (upright) or beside it (on its side);
//   - it is no smaller than the rule allows: 72% of its size, or 62% of the
//     screen's height, where the screen has room for that;
//   - scrolled down to its last button, the canvas is still whole at the top;
//   - a press at the canvas's far corner maps to the sim's own (W, H);
//   - nothing runs past the screen's side.
// Then: the speed buttons (shown by a moving sim, never by a still one or by
// position-time; the clock really runs slow, smooth for the sims that step by
// the frame's time, on fewer frames for those that step per frame; a new page
// starts at normal speed), the pin (full size, kept across a reload), the
// description shown once, the layout undone on another tab, a phone turned
// and turned back, and a desktop left exactly as it was.
const { chromium } = require('playwright');
const path = require('path');
const K = require('./_katex');   // KATEX=local: with KaTeX loaded
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info !== undefined ? ': ' + info : ''}`); }
};

const UPRIGHT = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932]];
const SIDEWAYS = [[568, 320], [667, 375], [844, 390], [932, 430]];
// the tallest canvas, the tallest controls, a mode bar, the longest
// description, a sim with no timestamp, the hand-driven one
const HARD = ['elc-millikan', 'mag-transformer', 'incline', 'opt-color-mix', 'dc-twoloop', 'collision', 'opt-diffraction', 'position-time'];

async function page(b, w, h, touch) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: !!touch, hasTouch: !!touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  await K.route(p);
  await p.goto(F);
  await p.waitForTimeout(900);
  await K.ready(p);
  // The first visit's welcome is closed by the page, and only so: a start-up
  // script that writes its flag touches localStorage before the page does,
  // and that can leave a reloaded page (headless Chromium, file://) on
  // another, empty storage area -- "across a reload" below then failed one
  // run in five.
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
  return p;
}

// every simulation's place: [subject, chapter, section, type]
const SIMS = p => p.evaluate(() => {
  const out = [];
  ['mechanics', 'optics', 'electro', 'circuits', 'magnetism'].forEach(s => {
    state.subject = s;
    getChapters().forEach(c => c.sections.forEach(x => {
      const k = c.id + '.' + x.id;
      if (CONTENT[k] && CONTENT[k].sim) out.push([s, c.id, x.id, CONTENT[k].sim.type]);
    }));
  });
  return out;
});

const open = (p, where, wait) => p.evaluate(async ([w, ms]) => {
  // the tip shown already: the layout a returning learner sees
  try { localStorage.setItem('simtip_' + w[1] + '.' + w[2], '1'); } catch (e) {}
  state.subject = w[0]; state.chapter = w[1]; state.section = w[2]; state.tab = 'sim';
  render(); window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, ms));
}, [where, wait || 750]);

// docked: scrolled so the simulation starts where the canvas sticks
const measure = p => p.evaluate(async () => {
  const de = document.documentElement, sc = document.querySelector('#app .sim-container');
  const cv = document.getElementById('sim-canvas');
  if (!sc || !cv) return null;
  const top = parseFloat(getComputedStyle(de).getPropertyValue('--dock-top')) || 0;
  // where it docks: the canvas at the top of the screen (a mode bar above it,
  // as colour mixing has, scrolls away under the header first)
  window.scrollTo(0, cv.parentNode.getBoundingClientRect().top + window.pageYOffset - top);
  await new Promise(r => setTimeout(r, 120));
  const R = e => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height }; };
  let ctl = null;
  for (const c of sc.children) if (c.classList.contains('sim-controls') && !c.classList.contains('sim-foot')) { ctl = c; break; }
  // its first row: the first slider, button or select
  const first = ctl && ctl.querySelector('.range-wrap, button, select');
  const bar = sc.querySelector('.sim-bar');
  const WH = cv._fitWH || [cv.width, cv.height];
  // the far corner of the box, read as the sims read a press
  const corner = simPointerXY(cv, window.devicePixelRatio || 1, { clientX: R(cv).r, clientY: R(cv).b });
  const out = {
    mode: _dock.mode, top, vh: window.innerHeight, vw: window.innerWidth, svh: _dock.vh,
    cv: R(cv), wrap: R(cv.parentNode), bar: bar ? R(bar) : null, first: first ? R(first) : null, ctl: ctl ? R(ctl) : null,
    W: WH[0], H: WH[1], corner, sticky: getComputedStyle(cv.parentNode).position,
    sideways: de.scrollWidth - window.innerWidth,
  };
  // the last button: scrolled to, the canvas is still whole at the top
  const foot = sc.querySelector('.sim-foot');
  if (foot) { foot.scrollIntoView({ block: 'end' }); await new Promise(r => setTimeout(r, 120)); out.cvEnd = R(cv); out.footEnd = R(foot); }
  return out;
});

function judge(tag, m, want) {
  if (!m) { t(`${tag}: a canvas`, false); return; }
  t(`${tag}: docked ${want}`, m.mode === want, m.mode);
  t(`${tag}: nothing past the screen's side`, m.sideways <= 1, m.sideways + ' px');
  // within the half pixel the box's height is rounded to, in the sim's units
  const tol = 0.6 * m.H / m.cv.h + 0.5;
  t(`${tag}: a press at the canvas's far corner is the sim's (W, H)`,
    Math.abs(m.corner.x - m.W) < tol && Math.abs(m.corner.y - m.H) < tol,
    `${m.corner.x.toFixed(1)},${m.corner.y.toFixed(1)} for ${m.W}x${m.H}`);
  t(`${tag}: the canvas whole on the screen`, m.cv.t >= m.top - 1 && m.cv.b <= m.vh + 1,
    `${Math.round(m.cv.t)}..${Math.round(m.cv.b)} of ${m.vh}`);
  // a sim without sliders or buttons of its own (vectors-basic) is all canvas
  const ctl = !!m.first;
  if (ctl) t(`${tag}: and the first row of its controls`, m.first.t >= -1 && m.first.b <= m.vh + 1,
    `${Math.round(m.first.t)}..${Math.round(m.first.b)} of ${m.vh}`);
  if (want === 'top') {
    const avail = m.svh - m.top - (m.bar ? m.bar.h : 0);
    const floor = Math.min(m.H, m.H * 0.72, avail * 0.62, avail - 140);
    if (ctl) t(`${tag}: under the canvas`, m.first.t >= m.wrap.b - 1);
    // (less the pixel its width is rounded to)
    t(`${tag}: no smaller than the rule (${Math.round(floor)} px)`, m.cv.h >= floor - 1 - m.H / m.W, Math.round(m.cv.h));
    t(`${tag}: kept at the top`, m.sticky === 'sticky', m.sticky);
    if (m.cvEnd) t(`${tag}: scrolled to its last button, the canvas still whole at the top`,
      Math.abs(m.cvEnd.t - m.top) <= 1.5 && m.cvEnd.b <= m.vh + 1, `${Math.round(m.cvEnd.t)}..${Math.round(m.cvEnd.b)}`);
  } else {
    if (ctl) t(`${tag}: beside the canvas`, m.first.l >= m.wrap.r - 1 || m.first.r <= m.wrap.l + 1,
      `${Math.round(m.first.l)}..${Math.round(m.first.r)} vs ${Math.round(m.wrap.l)}..${Math.round(m.wrap.r)}`);
    if (ctl) t(`${tag}: the controls keep a column of their own`, m.ctl.w >= 270, Math.round(m.ctl.w));
    if (m.cvEnd) t(`${tag}: scrolled to its last button, the canvas still whole`,
      m.cvEnd.t >= -1 && m.cvEnd.b <= m.vh + 1, `${Math.round(m.cvEnd.t)}..${Math.round(m.cvEnd.b)}`);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  let sims = null, errs = [];

  // ── 1. every simulation, upright and on its side ─────────────────────────
  console.log('\n1) every simulation docked, on a 390 x 844 phone and turned to 844 x 390');
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const p = await page(b, w, h, true);
    sims = sims || await SIMS(p);
    for (const s of sims) {
      await open(p, s);
      judge(`${s[3]} @${w}x${h}`, await measure(p), w > h ? 'side' : 'top');
    }
    errs = errs.concat(p._errs);
    await p.context().close();
  }
  console.log(`   ${sims.length} simulations`);

  // ── 2. the hardest ones on every phone ───────────────────────────────────
  console.log('\n2) the tallest canvases and controls on every phone size');
  for (const [w, h] of UPRIGHT.concat(SIDEWAYS)) {
    if ((w === 390 && h === 844) || (w === 844 && h === 390)) continue;
    const p = await page(b, w, h, true);
    for (const type of HARD) {
      const s = sims.find(x => x[3] === type);
      await open(p, s);
      judge(`${type} @${w}x${h}`, await measure(p), w > h ? 'side' : 'top');
    }
    errs = errs.concat(p._errs);
    await p.context().close();
  }

  // ── 3. the dock's own parts ─────────────────────────────────────────────
  console.log('\n3) speed, pin, the description once, other tabs, turning, a desktop');
  const where = type => sims.find(x => x[3] === type);
  const p = await page(b, 390, 844, true);
  const shown = () => p.evaluate(() => { const e = document.querySelector('#app .sim-speed'); return !!e && !e.hidden; });

  await open(p, where('pendulum'), 2600);
  t('a moving sim (pendulum) shows the speed buttons', await shown());
  for (const type of ['vectors-basic', 'statics-beam', 'fbd']) {
    await open(p, where(type), 3000);
    t(`a still one (${type}) never does`, !(await shown()));
  }
  // position-time draws the learner's own hand against time: never slowed
  await open(p, where('position-time'), 600);
  await p.evaluate(async () => {
    const cv = document.getElementById('sim-canvas'), r = cv.getBoundingClientRect();
    for (let i = 0; i <= 20; i++) {
      const o = { clientX: r.left + r.width * (0.2 + 0.03 * i), clientY: r.top + r.height * 0.25, bubbles: true, cancelable: true, buttons: 1 };
      cv.dispatchEvent(new MouseEvent(i ? 'mousemove' : 'mousedown', o));
      await new Promise(q => setTimeout(q, 30));
    }
    cv.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(q => setTimeout(q, 2500));
  });
  t('position-time never shows them', !(await shown()));

  // the projectile's own clock, read off its readout "t = 0.50 s"
  const flight = k => p.evaluate(async ([w, k]) => {
    state.subject = w[0]; state.chapter = w[1]; state.section = w[2]; state.tab = 'sim'; render();
    await new Promise(r => setTimeout(r, 900));
    const P = CanvasRenderingContext2D.prototype, of = P.fillText; let last = null;
    P.fillText = function (s, ...a) { if (/^t = /.test(s)) last = s; return of.call(this, s, ...a); };
    if (k !== 1) document.querySelector('.sim-sp[data-k="' + k + '"]').click();
    document.getElementById('btn-proj-launch').click();
    await new Promise(r => setTimeout(r, 1000));
    P.fillText = of;
    return { t: last && parseFloat(last.slice(4)), pressed: document.querySelector('.sim-sp[aria-pressed=true]').dataset.k };
  }, [where('projectile'), k]);
  for (const k of [1, 0.5, 0.25]) {
    const r = await flight(k);
    t(`projectile at ${k}×: one second takes the flight to t = ${k} s`, r.t !== null && Math.abs(r.t - k) < 0.06 + 0.06 * k, r.t);
    t(`projectile at ${k}×: its button is the one pressed`, r.pressed === String(k), r.pressed);
  }
  // a sim stepping a fixed amount per frame is run on k of them
  const draws = k => p.evaluate(async ([w, k]) => {
    state.subject = w[0]; state.chapter = w[1]; state.section = w[2]; state.tab = 'sim'; render();
    await new Promise(r => setTimeout(r, 900));
    if (k !== 1) simSpeed(k);
    const g = document.getElementById('sim-canvas').getContext('2d'), P = CanvasRenderingContext2D.prototype, of = P.fillRect;
    let n = 0, lt = -1;
    P.fillRect = function (...a) { if (this === g) { const x = performance.now(); if (x - lt > 4) { n++; lt = x; } } return of.apply(this, a); };
    await new Promise(r => setTimeout(r, 1000)); P.fillRect = of;
    return n;
  }, [where('dc-junction'), k]);
  const d1 = await draws(1), d4 = await draws(0.25);
  t('a sim stepping per frame (dc-junction) draws a quarter of the frames at ¼×', d4 > 0 && d4 / d1 > 0.18 && d4 / d1 < 0.34, `${d4}/${d1}`);
  await open(p, where('pendulum'), 300);
  t('a new page starts at normal speed, the buttons hidden again', await p.evaluate(() =>
    !_clk.on && _clk.k === 1 && document.querySelector('.sim-sp[aria-pressed=true]').dataset.k === '1' && document.querySelector('.sim-speed').hidden));
  t('at normal speed the browser\'s own requestAnimationFrame runs the sims', await p.evaluate(() => {
    const before = _clk.map.size; let id = requestAnimationFrame(function () {}); cancelAnimationFrame(id);
    return !_clk.on && id < 1e9 && _clk.map.size === before; }));

  // the pin: full size with the page, kept across a reload, and back
  await open(p, where('mag-transformer'));
  const g0 = await measure(p);
  await p.click('.sim-pin');
  await p.waitForTimeout(300);
  const un = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('sim-unpin'), h: document.getElementById('sim-canvas').getBoundingClientRect().height,
    H: document.getElementById('sim-canvas')._fitWH[1], pos: getComputedStyle(document.querySelector('.sim-canvas-wrap')).position,
    ls: localStorage.getItem('phys_simpin'), pressed: document.querySelector('.sim-pin').getAttribute('aria-pressed') }));
  t('📌 lets the canvas go: its full size, scrolling with the page', un.cls && Math.abs(un.h - un.H) < 1 && un.pos !== 'sticky' && un.pressed === 'false', JSON.stringify(un));
  t('and the choice is kept', un.ls === '0');
  await p.reload(); await p.waitForTimeout(1200);
  t('across a reload', await p.evaluate(() => state.tab === 'sim' && document.documentElement.classList.contains('sim-unpin') &&
    document.querySelector('.sim-pin').getAttribute('aria-pressed') === 'false'));
  await p.click('.sim-pin');
  await p.waitForTimeout(300);
  const g1 = await measure(p);
  t('📌 again: the canvas back at the top, the size it had', g1.sticky === 'sticky' && Math.abs(g1.cv.h - g0.cv.h) < 1, `${g1.cv.h} vs ${g0.cv.h}`);

  // the description once: the tip, or the footer
  const desc = await p.evaluate(async (w) => {
    localStorage.removeItem('simtip_' + w[1] + '.' + w[2]);
    state.subject = w[0]; state.chapter = w[1]; state.section = w[2]; state.tab = 'sim'; render();
    await new Promise(r => setTimeout(r, 900));
    const tip = document.querySelector('#app .sim-tip'), foot = () => getComputedStyle(document.querySelector('#app .sim-desc')).display;
    const a = { tip: !!tip, foot: foot() };
    if (tip) tip.querySelector('button').click();
    a.after = foot();
    return a;
  }, where('incline'));
  t('a first visit shows the description once: the tip, not the footer', desc.tip && desc.foot === 'none', JSON.stringify(desc));
  t('the tip closed, the footer has it', desc.after !== 'none', desc.after);

  // another tab: no trace of the dock
  const quiz = await p.evaluate(() => { state.tab = 'quiz'; render();
    return { cls: document.documentElement.className, main: getComputedStyle(document.querySelector('.main')).overflowY }; });
  t('another tab undoes the dock', !/sim-dock/.test(quiz.cls) && quiz.main === 'auto', JSON.stringify(quiz));

  // turned and turned back: the same canvas
  await open(p, where('pendulum'));
  const up = await measure(p);
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1300);
  const side = await measure(p);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1300);
  const back = await measure(p);
  t('turned on its side, docked beside', side && side.mode === 'side' && side.cv.b <= side.vh + 1, side && side.mode);
  t('turned back, the canvas it had', back && back.mode === 'top' && Math.abs(back.cv.h - up.cv.h) < 1 && Math.abs(back.cv.w - up.cv.w) < 1,
    back && `${back.cv.w}x${back.cv.h} vs ${up.cv.w}x${up.cv.h}`);
  errs = errs.concat(p._errs);
  await p.context().close();

  // a desktop: as it was
  const d = await page(b, 1280, 800, false);
  await open(d, where('incline'));
  const desk = await d.evaluate(() => {
    const sc = document.querySelector('#app .sim-container'), w = sc.querySelector('.sim-canvas-wrap');
    return { cls: document.documentElement.className, bar: getComputedStyle(sc.querySelector('.sim-bar')).display,
      fit: document.getElementById('sim-canvas').classList.contains('sim-fit'), pos: getComputedStyle(w).position,
      hint: !!sc.querySelector(':scope > .sim-hint'), main: getComputedStyle(document.querySelector('.main')).overflowY };
  });
  t('a desktop is not docked', !/sim-dock/.test(desk.cls) && desk.bar === 'none' && !desk.fit && desk.pos === 'relative' && desk.main === 'auto', JSON.stringify(desk));
  t('its touch hint under the canvas, as before', desk.hint);
  errs = errs.concat(d._errs);
  await d.context().close();

  console.log('   page errors:', errs.length ? errs.slice(0, 5).join(' | ') : 'NONE');
  if (errs.length) fail++;
  await b.close();
  console.log(fail ? `\n❌ check_dock: ${fail} FAILED (of ${checks})` : `\ncheck_dock: ${checks}/${checks} passed\n\n✅ EVERY SIMULATION AND ITS CONTROLS ON ONE PHONE SCREEN`);
  process.exit(fail ? 1 : 0);
})();
