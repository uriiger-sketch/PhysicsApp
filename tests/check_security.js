// Security invariants: what an attacker must never get from the app.
//
//   node tests/check_security.js                        (the Hebrew master)
//   APP_FILE=physics_game_en.html node tests/check_security.js
//
// The attackers this guards against (see .claude/skills/security-sweep):
//  * a sibling page on the shared <user>.github.io origin, or a hand edit on a
//    shared school computer, that writes localStorage -- the save is input;
//  * a crafted link (#/chapter/section/tab, the language choice);
//  * a compromised or swapped CDN file, or a request that leaks who is learning;
//  * a careless commit that brings back a credential or a private endpoint.
//
// Static: no credential or private endpoint in the page; the CSP and the
// referrer policy are there and strict; the only other site is KaTeX's exact
// path on jsDelivr, every file from it under SRI; no eval-like sink; every id
// the save schema checks fits it. Dynamic, with the network cut: a save
// poisoned in every field runs no script, pollutes no prototype, leaves the
// app working and is written back clean; a full honest save comes back
// unchanged; hostile addresses go nowhere; no request leaves for any site but
// KaTeX's; the page breaks no rule of its own CSP; "reset" erases the record.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.join(ROOT, 'physics_game_v28.html');
const URL = 'file://' + FILE;
const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/';

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); }
};

// what a credential, a private endpoint or a key looks like (also in CI)
const SECRET = /AKfyc[A-Za-z0-9_-]{20,}|script\.google(usercontent)?\.com\/macros\/|openById\(|(ADMIN|STUDENT)_PASS|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AIza[0-9A-Za-z_-]{35}|(AKIA|ASIA)[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/;

function csp(src) {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(src);
  if (!m) return null;
  const d = {};
  m[1].split(';').map(s => s.trim()).filter(Boolean).forEach(s => { const [k, ...v] = s.split(/\s+/); d[k] = v; });
  return { at: m.index, d };
}

function staticChecks(name, src, isApp) {
  t(`${name}: no credential, key or private endpoint`, !SECRET.test(src), (SECRET.exec(src) || [])[0]);
  const P = csp(src);
  t(`${name}: has a Content-Security-Policy`, !!P);
  if (P) {
    // before anything it governs: the first <script>, <link> or <style>
    const first = Math.min(...['<script', '<link', '<style'].map(x => { const i = src.indexOf(x); return i < 0 ? Infinity : i; }));
    t(`${name}: the CSP comes before every script, link and style`, P.at < first);
    const d = P.d, eq = (k, v) => JSON.stringify(d[k] || null) === JSON.stringify(v);
    for (const k of ['default-src', 'object-src', 'base-uri', 'form-action'])
      t(`${name}: CSP ${k} 'none'`, eq(k, ["'none'"]), (d[k] || []).join(' '));
    t(`${name}: CSP connect-src 'none' (the app sends nothing anywhere)`, !d['connect-src'] || eq('connect-src', ["'none'"]), (d['connect-src'] || []).join(' '));
    const all = Object.values(d).flat();
    t(`${name}: CSP never allows eval`, !all.includes("'unsafe-eval'") && !all.includes("'wasm-unsafe-eval'"));
    t(`${name}: CSP allows no whole scheme or wildcard`, !all.some(v => /^(https?:|\*|data:\*|blob:\*)$/.test(v) || /\*/.test(v)), all.filter(v => /\*|^https?:$/.test(v)).join(' '));
    t(`${name}: CSP script-src takes no data: or blob:`, !(d['script-src'] || []).some(v => /^(data|blob):$/.test(v)));
    // any site named is KaTeX's exact path, never a host as a whole
    const sites = all.filter(v => /^https?:\/\//.test(v));
    t(`${name}: CSP names only KaTeX's exact path`, sites.every(v => v === KATEX.replace(/dist\/$/, '') || v === KATEX), sites.join(' '));
  }
  if (!isApp && P) {
    // index.html: its one script and one style allowed by hash, not 'unsafe-inline'
    const crypto = require('crypto'), h = x => `'sha256-${crypto.createHash('sha256').update(x, 'utf8').digest('base64')}'`;
    const want = (re) => [...src.matchAll(re)].map(m => h(m[1])).sort().join(' ');
    t(`${name}: script-src is exactly the hash of its script`, (P.d['script-src'] || []).slice().sort().join(' ') === want(/<script>([\s\S]*?)<\/script>/g), (P.d['script-src'] || []).join(' '));
    t(`${name}: style-src is exactly the hash of its style`, (P.d['style-src'] || []).slice().sort().join(' ') === want(/<style>([\s\S]*?)<\/style>/g), (P.d['style-src'] || []).join(' '));
  }
  t(`${name}: referrer policy no-referrer`, /<meta name="referrer" content="no-referrer">/.test(src));
  // every URL of another site in the page
  const urls = (src.match(/https?:\/\/[A-Za-z0-9.-]+[^\s"'`)<>\\]*/g) || [])
    .filter(u => !/^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1998\/Math\/MathML)/.test(u));
  t(`${name}: no site but KaTeX's path on jsDelivr`, urls.every(u => u.startsWith('https://cdn.jsdelivr.net/npm/katex@0.16.9/') || u === 'https://cdn.jsdelivr.net' || u === 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/'), urls.filter(u => !u.startsWith('https://cdn.jsdelivr.net')).slice(0, 5).join(' '));
  t(`${name}: nothing from Google Fonts (it logs every visitor's IP)`, !/fonts\.(googleapis|gstatic)\.com/.test(src));
  if (!isApp) return;
  // KaTeX's three files, each under Subresource Integrity, anonymous CORS
  const loads = (src.match(/\.src=D\+'[^']+'|\.href=D\+'[^']+'/g) || []).length;
  const sri = (src.match(/\.integrity='sha384-[A-Za-z0-9+/=]{64}'/g) || []).length;
  t('KaTeX: every file loaded from the CDN carries an SRI hash', loads === 3 && sri === 3, `${loads} loads, ${sri} hashes`);
  t('KaTeX: every CDN load is crossorigin=anonymous', (src.match(/crossOrigin='anonymous'/g) || []).length === 3);
  // the app's code: no way to turn text into code
  const code = (/<script type="text\/x-physics-app" id="app-js">([\s\S]*?)<\/script>/.exec(src) || [])[1] || '';
  t('app script found', code.length > 1e6);
  for (const [what, re] of [['eval(', /\beval\s*\(/], ['new Function', /new\s+Function\s*\(/], ['a string timer', /set(Timeout|Interval)\s*\(\s*['"`]/],
    ['document.domain', /document\.domain/], ['a message listener', /addEventListener\(\s*['"]message['"]/], ['javascript: URL', /['"`]javascript:/i]])
    t(`app script has no ${what}`, !re.test(code));
  // the ids the save schema (_cleanSave) checks must fit it, or honest
  // progress would be dropped on load
  const ids = (code.match(/\{id:'[^']*'/g) || []).map(s => s.slice(5, -1));
  const bad = ids.filter(s => !/^[A-Za-z0-9_-]{1,40}$/.test(s));
  t(`every {id:'…'} (chapters, sections, missions) fits the save schema (${ids.length})`, ids.length > 100 && !bad.length, bad.slice(0, 5).join(' '));
}

(async () => {
  const src = fs.readFileSync(FILE, 'utf8');
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  staticChecks(path.basename(FILE), src, true);
  staticChecks('index.html', index, false);

  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // nothing reaches the network; every request to another site is recorded
  const away = [];
  await ctx.route(/^(https?|wss?):/, r => { away.push(r.request().url()); r.abort(); });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '').slice(0, 40)));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(900);

  // ── 1. an honest save, as full as the course allows, comes back unchanged
  const honest = await p.evaluate(() => {
    if (window.closeOnboarding) closeOnboarding();
    const L = [MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS, DC_CHAPTERS, MAG_CHAPTERS];
    const SEC = /^[a-z0-9-]{1,64}$/; let badId = [];
    L.forEach(list => list.forEach(c => {
      if (!SEC.test(c.id)) badId.push(c.id);
      c.sections.forEach(s => {
        if (!SEC.test(s.id)) badId.push(s.id);
        const k = c.id + '.' + s.id, C = CONTENT[k];
        ['theory', 'sim', 'quiz', 'problem'].forEach(tb => state.completed[k + '.' + tb] = true);
        state.visited[k] = true;
        if (C && C.quiz) { const q = getQS(c.id, s.id); C.quiz.forEach((x, i) => { if (i % 2) q.ans[i] = i % (x.opts ? x.opts.length : 2); }); q.cur = 1; q.hints = { 1: true }; }
        if (C && C.problem) { const ps = getPS(c.id, s.id); ps.inputs[0] = '3.2e-16'; ps.tried[0] = '3'; ps.attempts[0] = 2; ps.hints[0] = 1;
          ps.feedback[0] = 'x (2/3)'; ps.feedback[1] = 'correct'; ps.solved[1] = true; ps.idx = 1; }
        state.missions[k] = { 0: true, 'cm-yellow': true };
      });
    }));
    state.xp = 12345; state.lastPos = { optics: { c: OPTICS_CHAPTERS[0].id, s: OPTICS_CHAPTERS[0].sections[0].id, t: 'sim' } };
    saveState();
    const raw = localStorage.getItem('phys_game_state_v2');
    return { raw, badId };
  });
  t('every chapter and section id fits the save schema', !honest.badId.length, honest.badId.join(' '));
  await p.reload(); await p.waitForTimeout(900);
  const back = await p.evaluate(() => { saveState(); return localStorage.getItem('phys_game_state_v2'); });
  // the same to the code that reads it: keys in any order, and an empty or
  // false value the same as a missing one (a hole in solved[] comes back false)
  const canon = v => Array.isArray(v) ? v.map(x => canon(x) === undefined ? null : canon(x)).reduceRight((a, x) => a.length || x !== null ? [x, ...a] : a, [])
    : v && typeof v === 'object' ? (o => Object.keys(o).length ? o : undefined)(Object.keys(v).sort().reduce((o, k) => { const c = canon(v[k]); if (c !== undefined) o[k] = c; return o; }, {}))
    : v === false || v === null || v === 0 || v === '' ? undefined : v;
  const A = JSON.parse(honest.raw), B = JSON.parse(back);
  for (const k of ['xp', 'completed', 'visited', 'quizState', 'problemState', 'missions', 'theme']) {
    const a = JSON.stringify(canon(A[k])), bb = JSON.stringify(canon(B[k]));
    t(`honest save: ${k} comes back unchanged`, a === bb, (a || '').slice(0, 90) + ' → ' + (bb || '').slice(0, 90));
  }
  // (the page adds the subject it opens on to lastPos: what was there stays)
  t('honest save: lastPos comes back unchanged', Object.keys(A.lastPos).every(k => JSON.stringify(A.lastPos[k]) === JSON.stringify(B.lastPos[k])), JSON.stringify(B.lastPos));

  // ── 2. a save poisoned in every field
  const X = n => `<img src=x onerror="window.__pwn=(window.__pwn||[]).concat('${n}')">`;
  const Q = n => `"><svg onload="window.__pwn=(window.__pwn||[]).concat('${n}')">`;
  const sec = await p.evaluate(() => ({ c: MECH_CHAPTERS[0].id, s: MECH_CHAPTERS[0].sections[0].id }));
  const key = sec.c + '.' + sec.s;
  const evil = {
    subject: 'constructor', chapter: X('chapter'), section: Q('section'), tab: ['quiz'], xp: '1e400',
    theme: X('theme'), difficulty: { toString: 1 },
    completed: { '__proto__.quiz': true, 'constructor.quiz': true, [X('ck')]: true, [key + '.sim']: 'yes', [key + '.quiz']: true },   // a quiz done opens the problem
    visited: { [X('vk')]: true },
    quizState: { [key]: { cur: X('cur'), ans: [X('ans'), 99, -1, 1.5], done: 'true', ids: [X('ids')], hints: { 0: X('hint') }, v: X('v') } },
    problemState: { [key]: { idx: -5, inputs: [Q('input'), 'y'.repeat(20000)], tried: [X('tried')], solved: [X('solved')],
      hints: [X('h')], attempts: [X('attempts')], feedback: [X('feedback'), Q('fb2')], done: X('done') } },
    missions: { [key]: { [X('mk')]: true, 0: X('mv') } },
    lastPos: { mechanics: { c: X('lc'), s: Q('ls'), t: ['sim'] }, optics: 'x' },
  };
  // JSON.parse makes "__proto__" an own key, as a hand-written save would
  const raw = JSON.stringify(evil).replace(/^\{/, '{"__proto__":{"polluted":"yes"},');
  const big = raw.length;
  await p.evaluate(([r, k]) => { localStorage.setItem('phys_game_state_v2', r); localStorage.setItem('phys_lang', '__proto__'); localStorage.setItem('simtip_' + k, '1'); localStorage.setItem('phys_login_log', '[{"user":"a student"}]'); }, [raw, key]);
  await p.goto('about:blank');      // a new load, not a change of the # alone
  await p.goto(URL + '#/' + sec.c + '/' + sec.s + '/problem');
  await p.waitForTimeout(1200);
  const after = await p.evaluate(async (k) => {
    const out = { app: [] };
    const say = () => out.app.push((document.getElementById('app') || {}).textContent.length || 0);
    for (const tb of ['problem', 'quiz', 'sim', 'theory']) { state.tab = tb; render(); await new Promise(r => setTimeout(r, 350)); say(); }
    // a wrong answer after a poisoned attempt count
    state.tab = 'problem'; render(); await new Promise(r => setTimeout(r, 200));
    const inp = document.getElementById('si0');
    if (inp) { inp.value = '987654'; inp.dispatchEvent(new Event('input', { bubbles: true })); chkStep(0); }
    await new Promise(r => setTimeout(r, 200));
    out.fb = (document.querySelector('.step-fb.err') || {}).textContent || '';
    // the panels and menus that read the state
    try { openDrawer(); closeDrawer(); } catch (e) { out.err = String(e); }
    try { openFormulaPanel(); closeFormulaPanel(); openChangelog(); closeChangelog(); } catch (e) { out.err = String(e); }
    try { switchSubject('optics'); switchSubject('mechanics'); } catch (e) { out.err = String(e); }
    out.pwn = window.__pwn || null;
    out.polluted = ({}).polluted || Object.prototype.polluted || null;
    out.subject = state.subject; out.xp = state.xp; out.theme = state.theme;
    out.kept = state.completed[k + '.quiz'] === true && !(k + '.sim' in state.completed);
    out.saved = localStorage.getItem('phys_game_state_v2');
    out.login = localStorage.getItem('phys_login_log');
    return out;
  }, key);
  // one bad field must not cost the learner the rest of the save
  t('poisoned save: loaded, its honest part kept and its bad part dropped', after.kept);
  t('poisoned save: no script runs', !after.pwn, JSON.stringify(after.pwn));
  t('poisoned save: no prototype polluted', !after.polluted);
  t('poisoned save: every tab still renders', after.app.every(n => n > 50), after.app.join(','));
  t('poisoned save: no page error', !after.err && !errs.length, after.err || errs.join(' | '));
  t('poisoned save: a real subject, a sane XP, a real theme', /^(mechanics|optics|electro|circuits|magnetism)$/.test(after.subject) && after.xp >= 0 && after.xp <= 1e7 && /^(dark|light)$/.test(after.theme), `${after.subject} ${after.xp} ${after.theme}`);
  t('poisoned save: a wrong answer counts as attempt 1', /1\s*\/\s*3/.test(after.fb), after.fb);
  t('poisoned save: written back without any markup', !/<|>|onerror|onload/.test(after.saved), after.saved.slice(0, 120));
  t('poisoned save: written back bounded', after.saved.length < big / 4, `${after.saved.length} of ${big}`);
  t('poisoned save: an old login log is erased at start', after.login === null);

  // ── 3. typed text comes back as text, never as markup
  const typed = await p.evaluate(async () => {
    state.tab = 'problem'; render(); await new Promise(r => setTimeout(r, 200));
    const inp = document.getElementById('si0'); if (!inp) return null;
    inp.value = '"><img src=x onerror="window.__pwn=1">'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    chkStep(0); await new Promise(r => setTimeout(r, 200));
    render(); await new Promise(r => setTimeout(r, 200));
    const again = document.getElementById('si0');
    return { pwn: window.__pwn || null, value: again ? again.value : null, imgs: document.querySelectorAll('#app img[src="x"]').length };
  });
  t('typed answer: re-rendered as the same text, no element made of it', typed && !typed.pwn && typed.imgs === 0 && typed.value === '"><img src=x onerror="window.__pwn=1">', JSON.stringify(typed));

  // ── 4. hostile addresses go nowhere
  for (const h of ['#/__proto__/constructor/quiz', '#/constructor/prototype', '#/%3Cimg%20src=x%20onerror=window.__pwn=1%3E/a/theory',
    `#/${sec.c}/${sec.s}/quiz"><svg onload=window.__pwn=1>`, '#/' + 'a'.repeat(5000) + '/b']) {
    // followed on the page (popstate), then opened afresh (boot)
    for (const how of ['followed', 'opened']) {
      if (how === 'opened') await p.goto('about:blank');
      await p.goto(URL + h); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ pwn: window.__pwn || null, app: (document.getElementById('app') || {}).textContent.length || 0, subj: state.subject }));
      t(`address ${h.slice(0, 40)} ${how}: no script, the app works`, !r.pwn && r.app > 50 && /^(mechanics|optics|electro|circuits|magnetism)$/.test(r.subj), JSON.stringify(r));
    }
  }

  // ── 5. "reset all progress" leaves no record of the learner behind
  const reset = await p.evaluate(async (k) => {
    localStorage.setItem('simtip_' + k, '1');
    window.confirm = () => true;
    resetAllProgress(); await new Promise(r => setTimeout(r, 200));
    const left = Object.keys(localStorage).filter(x => /^simtip_/.test(x));
    const s = JSON.parse(localStorage.getItem('phys_game_state_v2') || '{}');
    return { left, xp: s.xp, done: Object.keys(s.completed || {}).length, ps: Object.keys(s.problemState || {}).length };
  }, key);
  t('reset: no sim-tip record, no XP, no completion, no typed answer', !reset.left.length && !reset.xp && !reset.done && !reset.ps, JSON.stringify(reset));

  // ── 6. the page broke no rule of its own CSP, and asked no other site
  const viol = await p.evaluate(() => window.__csp);
  t('no CSP violation anywhere above', !viol.length, viol.slice(0, 5).join(' | '));
  const other = away.filter(u => !u.startsWith(KATEX));
  t('no request to any site but KaTeX\'s path on jsDelivr', !other.length, other.slice(0, 5).join(' '));

  // ── 7. the landing page: a language name from storage is looked up, not inherited
  // (once, with the master: CI names it in APP_FILE too)
  if (FILE === path.join(ROOT, 'physics_game_v28.html')) {
    const ip = await ctx.newPage();
    for (const l of ['__proto__', 'constructor', 'toString', 'javascript:alert(1)']) {
      await ip.goto('file://' + path.join(ROOT, 'index.html'));
      await ip.evaluate(v => localStorage.setItem('phys_lang', v), l);
      await ip.goto('file://' + path.join(ROOT, 'index.html'));
      await ip.waitForTimeout(400);
      t(`index.html with phys_lang=${l}: opens the Hebrew page`, /\/physics_game_v28\.html(#.*)?$/.test(ip.url()), ip.url());
    }
    // 'en' must reach the English page: only the script can do that (the meta
    // refresh always goes to Hebrew), so this fails if the CSP blocks the script
    await ip.evaluate(() => localStorage.setItem('phys_lang', 'en'));
    await ip.goto('file://' + path.join(ROOT, 'index.html#/kinematics/distance-time/quiz'));
    await ip.waitForTimeout(400);
    t('index.html with phys_lang=en: its script runs and opens the English page at the same topic', /\/physics_game_en\.html#\/kinematics\/distance-time\/quiz$/.test(ip.url()), ip.url());
    await ip.evaluate(() => localStorage.setItem('phys_lang', 'he'));
  }

  await b.close();
  console.log(`check_security: ${checks - fail}/${checks} passed (${path.basename(FILE)})`);
  process.exit(fail ? 1 : 0);
})();
