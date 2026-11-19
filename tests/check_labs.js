// The enrichment labs: the list, every lab, the way in and the way out --
// on whichever edition this is run.
//
//   node tests/check_labs.js                                   (the Hebrew master)
//   APP_FILE=physics_game_en.html node tests/check_labs.js     (an edition)
//   node tests/check_labs.js cherenkov                         (one lab)
//
// The host: the entry in the topic list opens the list of labs, a card opens a
// lab on its own address (#/labs/<id>), "back" and Escape step out, ✕ returns
// to the course, the browser's back button does the same, a link to a lab
// opens it, a link to no lab opens nothing; the card in a section leads to its
// lab and back to that section; the course behind an open lab is inert.
// Every lab, at a desktop's width and a phone's: it draws, throws nothing,
// breaks no rule of the page's CSP, asks no other site for anything, fits the
// screen, follows the theme (or keeps its one dark look), and once closed runs
// nothing. Its language: on the Hebrew master the lab reads right to left and
// every number, unit and formula inside its Hebrew reads left to right, on
// screen; on an edition no Hebrew is left in it -- page text, labels, canvas.
// Its physics: a few numbers of each lab against the textbook.
// The one lab that keeps something (the circuit on the bench): a poisoned
// record runs no script and leaves the lab working; "reset" erases it.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.join(ROOT, 'physics_game_v28.html');
const URL = 'file://' + FILE;
const ONLY = process.argv[2] || '';

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info !== undefined && info !== '' ? ': ' + String(info).slice(0, 300) : ''}`); }
  else if (process.env.VERBOSE) console.log(`   PASS ${name}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// what every page gets: the welcome tour off, CSP violations and canvas text recorded,
// animation frames counted
const INIT = () => {
  try { localStorage.setItem('phys_onboarded', '1'); } catch (e) {}
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '').slice(0, 40)));
  window.__cv = [];
  for (const m of ['fillText', 'strokeText']) {
    const o = CanvasRenderingContext2D.prototype[m];
    CanvasRenderingContext2D.prototype[m] = function (s, ...a) { try { if (window.__cv.length < 50000) window.__cv.push(String(s)); } catch (e) {} return o.call(this, s, ...a); };
  }
  window.__raf = 0;
  const r = window.requestAnimationFrame;
  window.requestAnimationFrame = function (f) { window.__raf++; return r.call(window, f); };
};

// ── in the page ────────────────────────────────────────────────────────────
// the open lab: Hebrew and placeholders in its text, attributes and canvases
const SCAN = () => {
  const HEB = /[֐-׿]/, host = document.getElementById('xlab-host'), root = host && host.shadowRoot;
  const out = { heb: [], ph: [], words: 0 };
  const scan = (r) => {
    if (!r) return;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue; if (!s || !s.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('style,script')) continue;
      if (HEB.test(s)) out.heb.push('text: ' + s.trim().slice(0, 60));
      if (/⟦\d+⟧/.test(s)) out.ph.push(s.trim().slice(0, 60));
      out.words += (s.match(/[A-Za-z֐-׿]{3,}/g) || []).length;
    }
    r.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el => {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && HEB.test(v)) out.heb.push(a + ': ' + v.slice(0, 60)); if (v && /⟦\d+⟧/.test(v)) out.ph.push(v.slice(0, 60)); }
    });
  };
  scan(document.getElementById('xlab-overlay')); scan(root);
  (window.__cv || []).forEach(s => { if (HEB.test(s)) out.heb.push('canvas: ' + s.slice(0, 60)); if (/⟦\d+⟧/.test(s)) out.ph.push('canvas: ' + s.slice(0, 60)); });
  out.heb = [...new Set(out.heb)]; out.ph = [...new Set(out.ph)];
  return out;
};
// the open lab: every left-to-right island inside right-to-left text (a
// number with its unit, a formula, a Latin name) must read left to right on
// screen, and a short number-and-unit must not be torn across two lines
const BIDI = () => {
  const host = document.getElementById('xlab-host'), root = host && host.shadowRoot;
  const HEB = /[֐-׿]/;
  const A = 'A-Za-z0-9\\u00B5\\u0370-\\u03FF\\u2070-\\u209F\\u00B2\\u00B3\\u00B9\\u00B0%\\u2032\\u2033\\u210F\\u2609\\u2295\\u263E';
  const SEQ = new RegExp('[' + A + '(\\[|][' + A + ' \\u00A0()\\[\\]{}.,:;=\\u2248\\u2260<>\\u2264\\u2265\\u00B1\\u00D7\\u00B7*/^_|\\u221A\\u221D\\u2192+\\-\\u2212\\u2013\\u223C~\\u2019\']*[' + A + ')\\]|]', 'g');
  const core = new RegExp('[' + A + ']'), out = [];
  document.querySelectorAll('#xlab-overlay details').forEach(d => { d.open = true; });
  if (root) root.querySelectorAll('details').forEach(d => { d.open = true; });
  const scan = (r, where) => {
    if (!r) return;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const s0 = n.nodeValue; if (!s0 || !s0.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('style,script,canvas,svg,option')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let blk = el; while (blk && getComputedStyle(blk).display.indexOf('inline') === 0) blk = blk.parentElement;
      if (!(HEB.test(s0) || (blk && HEB.test(blk.textContent)) || cs.direction === 'rtl')) continue;
      SEQ.lastIndex = 0; let m;
      while ((m = SEQ.exec(s0))) {
        const s = m[0].replace(/[ .,:;]+$/, ''); if (s.length < 3) continue;
        if (!/[  =≈<>≤≥±×·*/^+\-−–(]/.test(s.slice(1))) continue;
        let i0 = 0, i1 = s.length - 1;
        while (i0 < i1 && !core.test(s[i0])) i0++;
        while (i1 > i0 && !core.test(s[i1])) i1--;
        if (i1 - i0 < 2) continue;
        const a = m.index + i0, z = m.index + i1, rg = document.createRange();
        rg.setStart(n, a); rg.setEnd(n, a + 1); const ra = rg.getClientRects()[0];
        rg.setStart(n, z); rg.setEnd(n, z + 1); const rz = rg.getClientRects()[0];
        if (!ra || !rz || (!ra.width && !rz.width)) continue;
        if (Math.abs(ra.top - rz.top) > 4) { if (s.length <= 14 && /^[\d.,−-]+[  ]*[°µA-Za-zΩ%]/.test(s)) out.push(where + ' torn «' + s + '»'); continue; }
        if (ra.left > rz.left + 1) out.push(where + ' reversed «' + s + '» in «' + s0.trim().slice(0, 50) + '»');
      }
    }
  };
  scan(root, 'lab'); scan(document.querySelector('#xlab-overlay .xlab-tasks'), 'tasks'); scan(document.querySelector('#xlab-overlay .xlab-hub'), 'list');
  return [...new Set(out)];
};
// the open lab: is anything drawn? (a 2D canvas with more than one colour, or a WebGL canvas with a context)
const PAINTED = () => {
  const root = document.getElementById('xlab-host').shadowRoot; let n = 0, painted = 0, gl = 0;
  root.querySelectorAll('canvas').forEach(c => {
    if (!c.width || !c.height || !c.getClientRects().length) return; n++;
    let g = null; try { g = c.getContext('2d'); } catch (e) {}
    if (!g) { gl++; return; }
    try { const w = Math.min(c.width, 400), h = Math.min(c.height, 300), d = g.getImageData(0, 0, w, h).data, seen = new Set();
      for (let i = 0; i < d.length && seen.size < 3; i += 4 * 37) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]);
      if (seen.size > 1) painted++; } catch (e) {}
  });
  return { n, painted, gl };
};
const STATE = () => {
  const ov = document.getElementById('xlab-overlay'), host = document.getElementById('xlab-host'), body = document.getElementById('xlab-body');
  const app = document.getElementById('app'), root = host && host.shadowRoot, wrap = root && root.querySelector('[dir]');
  return { open: !!(ov && ov.classList.contains('open')), hash: location.hash, lab: host ? host.getAttribute('data-lab') : null,
    title: (document.getElementById('xlab-h') || {}).textContent || '', inert: !!(app && app.hasAttribute('inert')),
    theme: host ? host.getAttribute('data-theme') : null, dir: wrap ? wrap.getAttribute('dir') : null,
    children: root ? root.children.length : 0, cards: document.querySelectorAll('#xlab-overlay .xlab-card').length,
    overflow: body ? body.scrollWidth - body.clientWidth : 0, backHidden: (document.getElementById('xlab-back') || {}).hidden,
    themeHidden: (document.getElementById('xlab-theme') || {}).hidden, tasks: document.querySelectorAll('#xlab-overlay .xlab-tasks li').length,
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : '' };
};

// ── physics: a few numbers of each lab against the textbook ────────────────────
// Each gets the page with its lab open at a desktop's width, and returns [name, ok, info] rows.
const PHYSICS = {
  async cherenkov(p) {
    const rows = [];
    const read = () => p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, g = i => r.getElementById(i).textContent;
      return { light: g('cmpC'), part: g('cmpP'), op: g('cmpOp'), th: g('rTh'), phi: g('rPh'), nb: g('rNB'), max: g('nThMax'), ke: g('rKE'), y: g('rN'), tbl: r.getElementById('tbl').textContent }; });
    const set = (medium, mode, betaU, frac) => p.evaluate(([m, md, u, f]) => { const r = document.getElementById('xlab-host').shadowRoot;
      const s = r.getElementById('medium'); s.value = m; s.dispatchEvent(new Event('change', { bubbles: true }));
      r.querySelector('#segMode [data-v="' + md + '"]').click();
      const b = r.getElementById('beta'); b.value = u; b.dispatchEvent(new Event('input', { bubbles: true }));
      const sc = r.getElementById('scrub'); sc.value = Math.round(f * 1000); sc.dispatchEvent(new Event('input', { bubbles: true })); }, [medium, mode, betaU, frac]);
    // water, constant β = 0.95 (the slider's default position)
    await set('water', 'const', 237, 0.9); await p.waitForTimeout(150);
    let v = await read();
    const n = 1.33335, b = parseFloat(v.part);
    rows.push(['cherenkov: light in water moves at c/n = 0.750c', v.light === '0.750c', v.light]);
    rows.push(['cherenkov: β = 0.95 is past the threshold (">")', near(b, 0.95, 0.002) && v.op === '>', v.part + ' ' + v.op]);
    rows.push(['cherenkov: photon angle obeys cos θc = 1/(nβ)', near(parseFloat(v.th), Math.acos(1 / (n * b)) * 180 / Math.PI, 0.05), v.th]);
    rows.push(['cherenkov: cone half-angle is 90° − θc', near(parseFloat(v.phi) + parseFloat(v.th), 90, 0.02), v.phi + ' + ' + v.th]);
    rows.push(['cherenkov: the widest cone in water is arccos(1/n) = 41.4°', v.max === '41.4°', v.max]);
    rows.push(['cherenkov: about 300 photons per cm in 300–600 nm at β = 0.95 (Frank–Tamm)', near(parseFloat(v.y), 296, 6), v.y]);
    rows.push(['cherenkov: electron threshold in water is 262 keV, proton 480 MeV', /26[1-3]\s*keV/.test(v.tbl) && /48\d(\.\d)?\s*MeV/.test(v.tbl), v.tbl.slice(0, 120)]);
    // below threshold: no cone, no photons
    await set('water', 'const', 0, 0.9); await p.waitForTimeout(150);
    v = await read();
    rows.push(['cherenkov: at β = 0.3 nothing is emitted ("<", no angle, no photons)', v.op === '<' && v.th === '—' && v.y === '0', `${v.op} ${v.th} ${v.y}`]);
    // diamond: a lower threshold, a wider cone
    await set('diamond', 'const', 237, 0.9); await p.waitForTimeout(150);
    v = await read();
    rows.push(['cherenkov: diamond, light at 0.414c and a cone up to 65.6°', v.light === '0.414c' && v.max === '65.6°', v.light + ' ' + v.max]);
    // every motion, every medium: no error (page errors are collected by the caller)
    for (const m of ['water', 'd2o', 'ice', 'silica', 'sf6', 'diamond', 'aerogel', 'air'])
      for (const md of ['accel', 'const', 'stop']) { await set(m, md, 600, 0.5); await p.waitForTimeout(40); }
    await set('water', 'accel', 237, 0.8);
    return rows;
  },
};

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const errs = [], away = [];
  const newPage = async (w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 });
    await ctx.addInitScript(INIT);
    await ctx.route(/^(https?|wss?):/, r => { away.push(r.request().url()); r.abort(); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    return { ctx, p };
  };
  const ready = p => p.waitForFunction(() => typeof render === 'function' && typeof _xlabList === 'function' && document.querySelector('#app .tabs'), null, { timeout: 30000 });
  const st = p => p.evaluate(STATE);

  // ── 1. the host, at a desktop's width ────────────────────────────────
  let { ctx, p } = await newPage(1280, 860);
  await p.goto(URL); await ready(p); await p.waitForTimeout(400);
  const meta = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', labs: _xlabList().map(L => ({ id: L.id, dark: !!L.dark, fill: !!L.fill, store: !!L.store, tasks: (L.tasks || []).length, title: L.title })), all: XLABS.length }));
  const HE = meta.lang === 'he';
  t('every lab of the list has its page', meta.labs.length === meta.all && meta.all >= 1, `${meta.labs.length} of ${meta.all}`);
  const LABS = meta.labs.filter(L => !ONLY || L.id === ONLY);
  const first = meta.labs[0].id, course = await p.evaluate(() => location.hash);

  // the entry in the topic list
  t('the topic list has the entry to the labs', await p.locator('#sidebar-nav .xlab-btn').count() === 1);
  await p.locator('#sidebar-nav .xlab-btn').click(); await p.waitForTimeout(250);
  let s = await st(p);
  t('the entry opens the list of labs, on #/labs', s.open && s.hash === '#/labs' && s.cards === meta.labs.length && !s.lab, JSON.stringify(s));
  t('the course behind the list is inert', s.inert);
  t('the list has no "back" (only ✕)', s.backHidden === true);
  // a card opens its lab
  await p.locator(`#xlab-overlay .xlab-card[data-lab="${first}"]`).click(); await p.waitForTimeout(500);
  s = await st(p);
  t('a card opens its lab on #/labs/<id>', s.open && s.hash === '#/labs/' + first && s.lab === first && s.children >= 2, JSON.stringify(s));
  t('the bar carries the lab\'s name and "back"', s.title.length > 3 && s.backHidden === false, s.title);
  // back -> the list; Escape -> the course
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(300);
  s = await st(p);
  t('"back" in a lab returns to the list', s.open && s.hash === '#/labs' && !s.lab, JSON.stringify(s));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  s = await st(p);
  t('Escape on the list returns to the course', !s.open && s.hash === course && !s.inert, JSON.stringify(s));
  t('the keyboard is back on the entry in the topic list', /xlab-btn/.test(s.focus), s.focus);
  // the browser's own back and forward
  await p.evaluate(id => openLab(id), first); await p.waitForTimeout(400);
  await p.goBack(); await p.waitForTimeout(400);
  s = await st(p);
  t('the browser\'s back button closes a lab opened from the course', !s.open && s.hash === course, JSON.stringify(s));
  await p.goForward(); await p.waitForTimeout(500);
  s = await st(p);
  t('…and its forward button opens it again', s.open && s.lab === first, JSON.stringify(s));
  // ✕ from a lab opened through the list: straight to the course
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  await p.evaluate(() => openLabs()); await p.waitForTimeout(200);
  await p.evaluate(id => openLab(id), first); await p.waitForTimeout(400);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(500);
  s = await st(p);
  t('✕ in a lab returns to the course in one step', !s.open && s.hash === course && !s.inert, JSON.stringify(s));
  // the keyboard shortcut, and the course's own shortcuts while a lab is open
  await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await p.keyboard.press('Shift+L'); await p.waitForTimeout(300);
  s = await st(p);
  t('Shift+L opens the list of labs', s.open && s.hash === '#/labs', JSON.stringify(s));
  const tabBefore = await p.evaluate(() => state.tab);
  await p.keyboard.press('2'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  t('the course takes no shortcut while the labs are open', await p.evaluate(() => state.tab) === tabBefore && (await st(p)).open);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);

  // a link to a lab, to the list, to no lab
  await p.goto('about:blank'); await p.goto(URL + '#/labs/' + first); await ready(p); await p.waitForTimeout(600);
  s = await st(p);
  t('a link to a lab opens it', s.open && s.lab === first && s.hash === '#/labs/' + first, JSON.stringify(s));
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(300);
  s = await st(p);
  t('…"back" there shows the list (there is no step to go back to)', s.open && !s.lab && s.hash === '#/labs', JSON.stringify(s));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  s = await st(p);
  t('…and ✕ returns to the course, whose address replaces the lab\'s', !s.open && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(s.hash) && !s.inert, JSON.stringify(s));
  await p.goto('about:blank'); await p.goto(URL + '#/labs/' + first); await ready(p); await p.waitForTimeout(600);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  s = await st(p);
  t('✕ on a lab opened by a link returns to the course', !s.open && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(s.hash), JSON.stringify(s));
  for (const h of ['#/labs/no-such-lab', '#/labs/constructor']) {
    await p.goto('about:blank'); await p.goto(URL + h); await ready(p); await p.waitForTimeout(400);
    s = await st(p);
    t(`a link to no lab (${h}) shows the list`, s.open && !s.lab && s.hash === '#/labs', JSON.stringify(s));
  }
  for (const h of ['#/labs/__proto__', '#/labs/%3Cimg%20src=x%20onerror=window.__pwn=1%3E', '#/labs/a/b', '#/labs/' + 'a'.repeat(300), '#/labs/"><svg onload=window.__pwn=1>']) {
    await p.goto('about:blank'); await p.goto(URL + h); await ready(p); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ pwn: window.__pwn || null, open: _xlabOpen(), app: document.getElementById('app').textContent.length, hash: location.hash }));
    t(`a hostile lab address opens nothing and runs nothing (${h.slice(0, 30)})`, !r.pwn && !r.open && r.app > 50 && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(r.hash), JSON.stringify(r));
  }

  // the card in a section leads to its lab, and back to that section
  const ties = await p.evaluate(() => Object.keys(XLAB_TIES).map(k => ({ k, lab: XLAB_TIES[k][0], ok: !!CONTENT[k] && !!_xlabById(XLAB_TIES[k][0]) })));
  t('every section that leads to a lab exists, and so does its lab', ties.length > 0 && ties.every(x => x.ok), ties.filter(x => !x.ok).map(x => x.k + '→' + x.lab).join(' '));
  const tie = ties.find(x => x.ok && (!ONLY || x.lab === ONLY)) || ties[0];
  await p.goto('about:blank'); await p.goto(URL + '#/' + tie.k.replace('.', '/') + '/theory'); await ready(p); await p.waitForTimeout(500);
  t('a section that leads to a lab shows its card', await p.locator('#app .xlab-tiecard').count() === 1, tie.k);
  await p.locator('#app .xlab-tiecard .btn').click(); await p.waitForTimeout(600);
  s = await st(p);
  t('the card opens its lab', s.open && s.lab === tie.lab, JSON.stringify(s));
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(600);
  s = await st(p);
  const where = await p.evaluate(() => state.chapter + '.' + state.section + '/' + state.tab);
  t('"back" returns to that very section', !s.open && where === tie.k + '/theory', where);
  t('…with the keyboard on the card that was used', await p.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.xlab-tiecard'))));

  // the search finds every lab by its name, and a result opens it
  const found = await p.evaluate(() => _xlabList().map(L => { const d = document.createElement('div'); d.innerHTML = L.title;
    const w = d.textContent.split(/[\s?]+/).filter(x => x.length > 2).slice(0, 2).join(' '), r = _searchFind(w);
    return { id: L.id, w, ok: !!r && r.lab.some(x => x.e.id === L.id) }; }));
  t('the search finds every lab by its name', found.every(x => x.ok), found.filter(x => !x.ok).map(x => x.id + ' «' + x.w + '»').join(' '));
  await p.locator('#sidebar-nav .ts-inp').fill(found[0].w); await p.waitForTimeout(300);
  t('…in a group of its own, after the course\'s results', await p.locator('#sidebar-nav .search-results .sr-lab').count() >= 1);
  await p.locator('#sidebar-nav .search-results .sr-lab').first().click(); await p.waitForTimeout(600);
  s = await st(p);
  t('…and a result opens the lab', s.open && s.lab === found[0].id, JSON.stringify(s));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = document.querySelector('#sidebar-nav .ts-clear'); if (c) c.click(); }); await p.waitForTimeout(200);

  // the list itself: its language and its layout
  await p.evaluate(() => openLabs()); await p.waitForTimeout(300);
  let sc = await p.evaluate(SCAN);
  if (!HE) t('the list of labs shows no Hebrew', !sc.heb.length, sc.heb.slice(0, 4).join(' | '));
  t('the list of labs leaks no placeholder', !sc.ph.length, sc.ph.join(' | '));
  if (HE) t('the list of labs: formulas inside Hebrew read left to right', !(await p.evaluate(BIDI)).length, (await p.evaluate(BIDI)).slice(0, 4).join(' | '));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(300);
  await ctx.close();

  // ── 2. every lab, at a desktop's width and a phone's ─────────────────────
  for (const [w, h] of [[1280, 860], [390, 780]]) {
    ({ ctx, p } = await newPage(w, h));
    // on the quiz tab the course itself animates nothing: what runs is the lab's
    await p.goto(URL); await ready(p);
    await p.evaluate(() => { state.tab = 'quiz'; render(); }); await p.waitForTimeout(700);
    const idle = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 600)); return window.__raf - a; });
    for (const L of LABS) {
      const W = `[${L.id} ${w}px]`, e0 = errs.length;
      await p.evaluate(() => { window.__cv = []; });
      await p.evaluate(id => openLab(id), L.id); await p.waitForTimeout(1500);
      s = await st(p);
      t(`${W} opens`, s.open && s.lab === L.id && s.children >= 2, JSON.stringify(s));
      t(`${W} reads ${meta.dir}`, s.dir === meta.dir, s.dir);
      t(`${W} fits the width of the screen`, s.overflow <= 1, s.overflow + ' px wider');
      const pt = await p.evaluate(PAINTED);
      t(`${W} draws`, pt.n > 0 && (pt.painted > 0 || pt.gl > 0), JSON.stringify(pt));
      sc = await p.evaluate(SCAN);
      t(`${W} has its text`, sc.words > 40, sc.words + ' words');
      t(`${W} leaks no placeholder`, !sc.ph.length, sc.ph.slice(0, 3).join(' | '));
      if (!HE) t(`${W} shows no Hebrew (text, labels, canvas)`, !sc.heb.length, sc.heb.slice(0, 5).join(' | '));
      else {
        t(`${W} is in Hebrew`, sc.heb.length > 10, sc.heb.length + ' Hebrew texts');
        const bd = await p.evaluate(BIDI);
        t(`${W} numbers, units and formulas inside Hebrew read left to right`, !bd.length, bd.slice(0, 5).join(' | '));
      }
      t(`${W} its inquiry tasks are listed`, s.tasks === L.tasks, `${s.tasks} of ${L.tasks}`);
      // the theme: followed, or one deliberate dark look
      const th0 = s.theme;
      await p.evaluate(() => toggleTheme()); await p.waitForTimeout(350);
      const s2 = await st(p), app2 = await p.evaluate(() => state.theme);
      if (L.dark) t(`${W} keeps its dark look in the light theme, and offers no theme button`, s2.theme === 'dark' && s2.themeHidden === true, s2.theme);
      else {
        t(`${W} follows the theme`, s2.theme === app2 && s2.theme !== th0 && s2.themeHidden === false, th0 + ' → ' + s2.theme);
        const pt2 = await p.evaluate(PAINTED);
        t(`${W} draws in the other theme too`, pt2.painted > 0 || pt2.gl > 0, JSON.stringify(pt2));
      }
      await p.evaluate(() => toggleTheme()); await p.waitForTimeout(250);
      // its physics, once
      if (w > 700 && PHYSICS[L.id]) for (const [name, ok, info] of await PHYSICS[L.id](p)) t(name, ok, info);
      // closed, it runs nothing
      const running = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 400)); return window.__raf - a; });
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(600);
      const after = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 600)); return window.__raf - a; });
      s = await st(p);
      t(`${W} closes`, !s.open && !s.inert && !s.lab, JSON.stringify(s));
      t(`${W} once closed, asks for no more animation frames`, after <= idle + 2, `${running} while open, ${after} after, ${idle} before`);
      t(`${W} no page error`, errs.length === e0, errs.slice(e0, e0 + 3).join(' | '));
      // again: a second opening starts clean
      await p.evaluate(id => openLab(id), L.id); await p.waitForTimeout(700);
      t(`${W} opens a second time`, (await st(p)).lab === L.id && errs.length === e0, errs.slice(e0).join(' | '));
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
    }
    const viol = await p.evaluate(() => window.__csp);
    t(`[${w}px] no lab broke a rule of the page's CSP`, !viol.length, viol.slice(0, 4).join(' | '));
    await ctx.close();
  }

  // ── 3. the lab that keeps something on the device ───────────────────────
  const keeper = meta.labs.find(L => L.store);
  if (keeper && (!ONLY || ONLY === keeper.id)) {
    ({ ctx, p } = await newPage(1280, 860));
    await p.goto(URL); await ready(p);
    const KEY = 'phys_lab_' + keeper.id, e0 = errs.length;
    const X = n => `<img src=x onerror="window.__pwn=(window.__pwn||[]).concat('${n}')">`;
    const poison = [X('raw'), '{"__proto__":{"polluted":"yes"},"v":1,"text":' + JSON.stringify(X('text') + '\n' + '"><svg onload=window.__pwn=1>') + ',"probes":[' + JSON.stringify(X('probe')) + '],"opts":{"potential":' + JSON.stringify(X('opt')) + '},"speed":"1e400","example":' + JSON.stringify(X('ex')) + '}',
      '[]', 'null', '{"v":999,"text":12345}', 'x'.repeat(70000)];
    for (const [i, v] of poison.entries()) {
      await p.evaluate(([k, val]) => localStorage.setItem(k, val), [KEY, v]);
      await p.evaluate(id => openLab(id), keeper.id); await p.waitForTimeout(900);
      const r = await p.evaluate(() => ({ pwn: window.__pwn || null, polluted: ({}).polluted || null, open: _xlabOpen(), kids: document.getElementById('xlab-host').shadowRoot.children.length,
        imgs: document.getElementById('xlab-host').shadowRoot.querySelectorAll('img[src="x"]').length }));
      t(`a poisoned record of the ${keeper.id} lab (#${i + 1}): no script, nothing polluted, the lab works`, !r.pwn && !r.polluted && r.open && r.kids >= 2 && !r.imgs && errs.length === e0, JSON.stringify(r) + ' ' + errs.slice(e0).join(' | '));
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
    }
    // what the lab writes back is its own, bounded, and without markup
    const back = await p.evaluate(k => localStorage.getItem(k), KEY);
    t('what the lab keeps is bounded and holds no markup', back === null || (back.length <= 60000 && !/<|onerror|onload/.test(back)), (back || '').slice(0, 100));
    await p.evaluate(k => { localStorage.setItem(k, '{"v":1}'); window.confirm = () => true; resetAllProgress(); }, KEY); await p.waitForTimeout(300);
    t('"reset" erases what the lab kept', await p.evaluate(k => localStorage.getItem(k), KEY) === null);
    await ctx.close();
  }

  await b.close();
  const other = away.filter(u => !u.startsWith('https://cdn.jsdelivr.net/npm/katex@'));
  t('no request to any site but KaTeX\'s', !other.length, other.slice(0, 4).join(' '));
  t('no page error anywhere', !errs.length, [...new Set(errs)].slice(0, 5).join(' | '));
  console.log(`check_labs (${path.basename(FILE)}, ${meta.lang}, ${LABS.length} lab${LABS.length === 1 ? '' : 's'}): ${checks - fail}/${checks} passed`);
  process.exit(fail ? 1 : 0);
})();
