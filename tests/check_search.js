// The search field at the head of the topic list.
//
//   node tests/check_search.js
//   APP_FILE=physics_game_en.html node tests/check_search.js
//
// Every topic is found by its own title, every term by its name and every
// formula by its caption, in whichever subject they are. A formula is also
// found by its letters ("f=ma"), sub- and superscripts and letter case do not
// matter, and in Hebrew neither do the final letters. A result opens its
// topic -- across subjects -- and brings the definition or formula into view.
// What is typed reaches the page only as text (a tag typed into the field
// stays text), nothing typed is stored, the field keeps its place and its
// caret while it is typed in, Escape and the ✕ bring the topic list back, and
// on a phone the field is always in view at the head of the drawer.
const { chromium } = require('playwright');
const path = require('path');
const { L, LANG } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const open = async (vw, vh, mobile) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: !!mobile, isMobile: !!mobile });
    await ctx.route(/^(https?|wss?):/, r => r.abort());
    await ctx.addInitScript(() => {
      try { localStorage.setItem('phys_onboarded', '1'); } catch (e) {}
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + (e.sample || '').slice(0, 40)));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(F + '#/kinematics/distance-time/theory');
    await p.waitForFunction(() => typeof window._searchType === 'function' && document.querySelector('.ts-inp'), null, { timeout: 20000 });
    await p.waitForTimeout(400);
    return { ctx, p, errs };
  };

  // ── desktop: the index and what it finds ─────────────────────────────────
  let { ctx, p, errs } = await open(1280, 860);
  const ix = await p.evaluate(() => {
    const t0 = performance.now(), ix = _searchIndex(), ms = performance.now() - t0;
    const key = (at) => at.c + '.' + at.s;
    const miss = { sec: [], def: [], frm: [] };
    // a topic by its own title: listed, among the title matches
    ix.sec.forEach(e => { const r = _searchFind(e.at.title); if (!r || !r.sec.some(x => key(x.e.at) === key(e.at) && x.r <= 1)) miss.sec.push(e.at.title); });
    ix.def.forEach(e => { const r = _searchFind(e.name); if (!r || !r.def.some(x => x.e === e)) miss.def.push(e.name); });
    ix.frm.forEach(e => { const r = _searchFind(e.name); if (!r || !r.frm.some(x => x.e === e)) miss.frm.push(e.name); });
    const subjects = {}; ix.sec.forEach(e => subjects[e.at.subj] = (subjects[e.at.subj] || 0) + 1);
    return { ms, n: { sec: ix.sec.length, def: ix.def.length, frm: ix.frm.length, txt: ix.txt.length }, miss, subjects,
      emptyText: ix.txt.filter(e => e.text.length < 200).length,
      glued: ix.txt.filter(e => /katex-mathml|<\/?(span|div|p|b|i|sub|sup|canvas|button|annotation)\b/i.test(e.text)).length };
  });
  t('the index holds every topic', ix.n.sec === 107 && ix.n.txt === 107, JSON.stringify(ix.n));
  t('all five subjects are in it', Object.keys(ix.subjects).length === 5, JSON.stringify(ix.subjects));
  t('it holds the terms and the formulas of the theory pages', ix.n.def > 100 && ix.n.frm > 120, JSON.stringify(ix.n));
  t('every topic has its theory text, as text', ix.emptyText === 0 && ix.glued === 0, `${ix.emptyText} short, ${ix.glued} with markup`);
  t('the index is built in well under a second', ix.ms < 1500, Math.round(ix.ms) + ' ms');
  t('every topic is found by its own title', ix.miss.sec.length === 0, ix.miss.sec.slice(0, 5).join(' | '));
  t('every term is found by its name', ix.miss.def.length === 0, ix.miss.def.slice(0, 5).join(' | '));
  t('every formula is found by its caption', ix.miss.frm.length === 0, ix.miss.frm.slice(0, 5).join(' | '));

  const find = (q) => p.evaluate((q) => { const r = _searchFind(q); return r && { n: r.n, sec: r.sec.map(x => x.e.at.c + '.' + x.e.at.s), def: r.def.map(x => x.e.name),
    frm: r.frm.map(x => x.e.at.c + '.' + x.e.at.s), txt: r.txt.map(x => x.e.at.c + '.' + x.e.at.s) }; }, q);
  let r;
  r = await find('f=ma');
  t('"f=ma" finds Newton\'s second law by its letters', !!r && r.frm.includes('newton2.n2-law'), JSON.stringify(r && r.frm));
  r = await find('F = M·A');
  t('letter case, spaces and the product dot do not matter', !!r && r.frm.includes('newton2.n2-law'));
  r = await find('v0');
  t('"v0" finds formulas written with v₀', !!r && r.frm.length > 2, JSON.stringify(r && r.frm.slice(0, 4)));
  r = await find('x');
  t('one character is not a search', r === null);
  r = await find('qqqqzzzz');
  t('a word that is nowhere finds nothing', !!r && r.n === 0);
  r = await find('  ');
  t('spaces alone are not a search', r === null);
  // two words: both must be there
  const two = await p.evaluate(() => { const e = _searchIndex().sec.find(x => x.at.title.split(' ').length >= 2), w = e.at.title.split(' ');
    const a = _searchFind(w[1] + ' ' + w[0]), b2 = _searchFind(w[0] + ' qqqqzzzz'); return { a: !!a && a.sec.some(x => x.e === e), b: !!b2 && b2.n === 0 }; });
  t('two words are found in any order, and both are required', two.a && two.b, JSON.stringify(two));
  if (LANG === 'he') {
    r = await find('אורכ');
    const full = await find('אורך');
    t('Hebrew: a final letter typed or not finds the same ("אורכ" = "אורך…")', !!r && !!full && r.n >= full.n && r.n > 3, `${r && r.n} vs ${full && full.n}`);
    r = await find('עדש');
    t('Hebrew: part of a word finds the lenses, in optics, from a mechanics page', !!r && r.sec.includes('opt-lenses.convex-lens') && r.sec.includes('opt-lenses.concave-lens'));
  } else {
    r = await find('NEWTON');
    const low = await find('newton');
    t('upper and lower case find the same', !!r && !!low && r.n === low.n && r.n > 3, `${r && r.n} vs ${low && low.n}`);
    r = await find('lens');
    t('part of a word finds the lenses, in optics, from a mechanics page', !!r && r.sec.includes('opt-lenses.convex-lens') && r.sec.includes('opt-lenses.concave-lens'));
  }

  // ── desktop: the field in the sidebar ───────────────────────────────────
  const title = await p.evaluate(() => _searchIndex().sec.find(e => e.at.c === 'opt-lenses' && e.at.s === 'convex-lens').at.title);
  const word = title.split(' ')[0];
  const before = await p.evaluate(() => ({ ls: Object.keys(localStorage).sort().join(), save: localStorage.getItem('phys_game_state_v2') }));
  await p.click('#sidebar-nav .ts-inp');
  await p.keyboard.type(word, { delay: 15 });
  await p.waitForTimeout(250);
  let ui = await p.evaluate(() => { const sb = document.getElementById('sidebar-nav'), inp = sb.querySelector('.ts-inp');
    return { value: inp.value, focused: document.activeElement === inp, caret: inp.selectionStart, listHidden: sb.querySelector('.sb-list').hidden, resHidden: sb.querySelector('.search-results').hidden,
      hits: sb.querySelectorAll('.sr-hit').length, groups: [...sb.querySelectorAll('.sr-group')].map(g => g.textContent), marks: sb.querySelectorAll('.search-results mark').length,
      clear: !sb.querySelector('.ts-clear').hidden, label: inp.getAttribute('aria-label'), region: sb.querySelector('.search-results').getAttribute('aria-label'),
      inView: inp.getBoundingClientRect().top >= 0 && inp.getBoundingClientRect().bottom <= innerHeight }; });
  t('typing keeps the field, its text and its caret', ui.value === word && ui.focused && ui.caret === word.length, JSON.stringify(ui));
  t('the results stand in for the topic list', ui.listHidden && !ui.resHidden && ui.hits > 1, JSON.stringify(ui));
  t('the first group is the topics', ui.groups[0] === L('נושאים'), ui.groups.join(' | '));
  t('the words found are marked', ui.marks > 0);
  t('the field and the results are named for a screen reader', ui.label === L('חיפוש בקורס') && ui.region === L('תוצאות החיפוש') && ui.clear, JSON.stringify([ui.label, ui.region]));
  const after = await p.evaluate(() => ({ ls: Object.keys(localStorage).sort().join(), save: localStorage.getItem('phys_game_state_v2') }));
  t('nothing typed is stored', before.ls === after.ls && before.save === after.save);

  // the keyboard: down into the results, Enter opens -- in another subject
  await p.keyboard.press('ArrowDown');
  const first = await p.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('sr-hit') ? a.getAttribute('onclick') : null; });
  t('ArrowDown goes from the field to the first result', !!first && /_searchGo\('opt-lenses','convex-lens'/.test(first), String(first));
  await p.keyboard.press('ArrowUp');
  t('ArrowUp returns to the field', await p.evaluate(() => document.activeElement.classList.contains('ts-inp')));
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  ui = await p.evaluate(() => ({ hash: location.hash, subj: state.subject, q: _searchQ, focus: (document.activeElement || {}).id,
    shown: !document.querySelector('#sidebar-nav .search-results').hidden, value: document.querySelector('#sidebar-nav .ts-inp').value,
    active: !!document.querySelector('#sidebar-nav .search-results .sr-hit.active'), h1: document.getElementById('sec-title').textContent }));
  t('a result opens its topic, in its own subject', ui.hash === '#/opt-lenses/convex-lens/theory' && ui.subj === 'optics' && ui.h1 === title, JSON.stringify(ui));
  t('the keyboard lands on the topic\'s title', ui.focus === 'sec-title');
  t('in the sidebar the results stay, with the open topic marked', ui.shown && ui.value === word && ui.q === word && ui.active, JSON.stringify(ui));
  await p.goBack();
  await p.waitForTimeout(400);
  t('Back returns to the topic the search started from', await p.evaluate(() => location.hash === '#/kinematics/distance-time/theory' && state.subject === 'mechanics'));

  // Escape empties the field and brings the list back
  await p.click('#sidebar-nav .ts-inp');
  await p.keyboard.press('Escape');
  ui = await p.evaluate(() => { const sb = document.getElementById('sidebar-nav'); return { q: _searchQ, value: sb.querySelector('.ts-inp').value, list: !sb.querySelector('.sb-list').hidden,
    res: sb.querySelector('.search-results').hidden, clear: sb.querySelector('.ts-clear').hidden, focused: document.activeElement === sb.querySelector('.ts-inp'), topics: sb.querySelectorAll('.sb-list .sec-btn').length }; });
  t('Escape empties the field and the topic list is back', ui.q === '' && ui.value === '' && ui.list && ui.res && ui.clear && ui.focused && ui.topics > 20, JSON.stringify(ui));

  // "/" from the page goes to the field; typing in it is not a shortcut
  await p.evaluate(() => { document.activeElement.blur(); });
  await p.keyboard.press('/');
  t('"/" puts the keyboard in the field', await p.evaluate(() => document.activeElement.classList.contains('ts-inp')));
  await p.keyboard.type('2/3D');
  await p.waitForTimeout(150);
  ui = await p.evaluate(() => ({ v: document.querySelector('#sidebar-nav .ts-inp').value, tab: state.tab, theme: state.theme }));
  t('digits, "/" and capitals typed in the field are text, not shortcuts', ui.v === '2/3D' && ui.tab === 'theory', JSON.stringify(ui));

  // what is typed is text: a tag stays a tag's text
  await p.evaluate(() => { window.__x = 0; });
  await p.fill('#sidebar-nav .ts-inp', '<img src=x onerror="window.__x=1"><b>z</b>');
  await p.waitForTimeout(350);
  ui = await p.evaluate(() => { const box = document.querySelector('#sidebar-nav .search-results');
    return { x: window.__x, img: box.querySelectorAll('img,b,script').length, text: box.textContent, csp: window.__csp.length }; });
  t('a tag typed into the field is shown as text and runs nothing', ui.x === 0 && ui.img === 0 && ui.text.includes('<img src=x') && ui.csp === 0, JSON.stringify(ui).slice(0, 200));
  await p.evaluate(() => render());
  await p.waitForTimeout(300);
  ui = await p.evaluate(() => { const sb = document.getElementById('sidebar-nav'); return { x: window.__x, img: sb.querySelectorAll('.topic-search img, .search-results img, .search-results b').length, v: sb.querySelector('.ts-inp').value }; });
  t('...and after the page is drawn again', ui.x === 0 && ui.img === 0 && ui.v.startsWith('<img src=x'), JSON.stringify(ui));
  await p.click('#sidebar-nav .ts-clear');
  t('✕ empties the field', await p.evaluate(() => _searchQ === '' && document.querySelector('#sidebar-nav .ts-inp').value === '' && !document.querySelector('#sidebar-nav .sb-list').hidden));

  // a term and a formula: the result brings the block itself into view
  for (const kind of ['def', 'frm']) {
    const tgt = await p.evaluate((kind) => { const e = _searchIndex()[kind].find(x => x.at.c === 'shm' && x.i >= 1) || _searchIndex()[kind].find(x => x.at.c === 'energy'); return { name: e.name, c: e.at.c, s: e.at.s, i: e.i }; }, kind);
    await p.fill('#sidebar-nav .ts-inp', tgt.name);
    await p.waitForTimeout(300);
    await p.evaluate(([kind, tgt]) => { const re = new RegExp("_searchGo\\('" + tgt.c + "','" + tgt.s + "',this,'" + kind + "'," + tgt.i + "\\)");
      const h = [...document.querySelectorAll('#sidebar-nav .sr-hit')].find(x => re.test(x.getAttribute('onclick'))); h.click(); }, [kind, tgt]);
    await p.waitForTimeout(700);
    const seen = await p.evaluate(([kind, tgt]) => { const el = document.querySelectorAll('#main-content ' + (kind === 'def' ? '.def-block' : '.formula-box'))[tgt.i]; const r = el.getBoundingClientRect();
      return { at: location.hash, inView: r.top >= 50 && r.bottom <= innerHeight, flash: el.classList.contains('sr-flash') }; }, [kind, tgt]);
    t(`a ${kind === 'def' ? 'term' : 'formula'} result opens its topic with the block in view, marked`, seen.at === `#/${tgt.c}/${tgt.s}/theory` && seen.inView && seen.flash, JSON.stringify(seen));
  }
  await p.click('#sidebar-nav .ts-clear');
  t('desktop: no page errors, no CSP violations', errs.length === 0 && (await p.evaluate(() => window.__csp.length)) === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  // ── phone: the field at the head of the drawer ──────────────────────────
  ({ ctx, p, errs } = await open(390, 844, true));
  await p.evaluate(() => { location.hash = '#/shm/pendulum/theory'; });
  await p.waitForTimeout(500);
  await p.evaluate(() => openDrawer());
  await p.waitForTimeout(450);
  ui = await p.evaluate(() => { const dr = document.getElementById('mobile-drawer'), inp = dr.querySelector('.ts-inp'), r = inp.getBoundingClientRect(), d = dr.getBoundingClientRect();
    return { scrolled: dr.scrollTop, top: r.top - d.top, inView: r.top >= d.top - 1 && r.bottom <= d.bottom, h: r.height, font: parseFloat(getComputedStyle(inp).fontSize), w: r.width, dw: d.width }; });
  t('phone: with the drawer scrolled to the open topic, the field is still in view', ui.scrolled > 200 && ui.inView, JSON.stringify(ui));
  t('phone: the field is a finger\'s target, and its text is 16 px (no zoom on focus)', ui.h >= 44 && ui.font >= 16, JSON.stringify(ui));
  await p.fill('#drawer-nav .ts-inp', word);
  await p.waitForTimeout(350);
  ui = await p.evaluate(() => { const dr = document.getElementById('mobile-drawer'), box = dr.querySelector('.search-results'), d = dr.getBoundingClientRect();
    const hits = [...box.querySelectorAll('.sr-hit')];
    return { n: hits.length, top: dr.scrollTop, wide: hits.filter(h => h.getBoundingClientRect().right > d.right + 1 || h.getBoundingClientRect().left < d.left - 1 || h.scrollWidth > h.clientWidth + 1).length,
      small: hits.filter(h => h.getBoundingClientRect().height < 44).length, pageScroll: document.documentElement.scrollWidth - innerWidth }; });
  t('phone: the results start at the top of the drawer and fit its width', ui.n > 1 && ui.top === 0 && ui.wide === 0 && ui.pageScroll <= 0, JSON.stringify(ui));
  t('phone: every result is a finger\'s target', ui.small === 0, String(ui.small));
  await p.evaluate(() => { const h = [...document.querySelectorAll('#drawer-nav .sr-hit')].find(x => /_searchGo\('opt-lenses','convex-lens'/.test(x.getAttribute('onclick'))); h.click(); });
  await p.waitForTimeout(600);
  ui = await p.evaluate(() => ({ hash: location.hash, open: document.getElementById('mobile-drawer').classList.contains('open'), q: _searchQ, subj: state.subject, lock: document.body.style.overflow }));
  t('phone: a result opens its topic and closes the drawer', ui.hash === '#/opt-lenses/convex-lens/theory' && !ui.open && ui.subj === 'optics' && ui.lock === '', JSON.stringify(ui));
  await p.evaluate(() => openDrawer());
  await p.waitForTimeout(400);
  ui = await p.evaluate(() => { const dn = document.getElementById('drawer-nav'); return { v: dn.querySelector('.ts-inp').value, list: !dn.querySelector('.sb-list').hidden, active: !!dn.querySelector('.sb-list .sec-btn.active') }; });
  t('phone: the drawer opens on the topics again, the search over', ui.v === '' && ui.list && ui.active, JSON.stringify(ui));
  // Escape: first the field, then the drawer
  await p.fill('#drawer-nav .ts-inp', word);
  await p.focus('#drawer-nav .ts-inp');
  await p.keyboard.press('Escape');
  const e1 = await p.evaluate(() => ({ open: document.getElementById('mobile-drawer').classList.contains('open'), q: _searchQ }));
  await p.keyboard.press('Escape');
  const e2 = await p.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'));
  t('phone: Escape empties the field first, and only then closes the drawer', e1.open && e1.q === '' && !e2, JSON.stringify([e1, e2]));
  t('phone: no page errors, no CSP violations', errs.length === 0 && (await p.evaluate(() => window.__csp.length)) === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  await b.close();
  console.log(`check_search: ${checks - fail}/${checks} passed (${ix.n.sec} topics, ${ix.n.def} terms, ${ix.n.frm} formulas; index in ${Math.round(ix.ms)} ms)`);
  process.exit(fail ? 1 : 0);
})();
