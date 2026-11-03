// Checks the app's web bundle (www/) the way the app runs it: served at the
// app's own origin (Capacitor's https://localhost) with every other address
// cut off.
//
//   npm run check        (after npm run build; needs Playwright + Chromium, see _tools.mjs)
//
// Static: each edition in www/ is its page at the repository root with exactly
// the app's changes (scripts/build.mjs) and nothing else; KaTeX's files are
// the ones the pages' SRI hashes name; the start page's CSP hashes are its own.
// In the browser: the start page opens the edition chosen before, else the
// device's language; each edition typesets with the app's own KaTeX, breaks no
// rule of its CSP, throws nothing, reaches for no other site, hides 🖨, opens
// no window; 🌐 keeps the topic; topics and tabs go into the history (the
// Android back button walks it); the sensor lab has the secure context it needs.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP, ROOT, WWW, ORIGIN, launch, serveApp } from './_tools.mjs';

let fail = 0, checks = 0;
const t = (name, ok, info) => { checks++; if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); } };
const read = (p) => fs.readFileSync(p, 'utf8');
if (!fs.existsSync(path.join(WWW, 'index.html'))) { console.error('check: no www/ -- run npm run build first'); process.exit(1); }

const EDITIONS = { he: 'physics_game_v28.html', en: 'physics_game_en.html' };
const KV = (/var D='vendor\/katex@([0-9.]+)\/dist\/'/.exec(read(path.join(WWW, EDITIONS.he))) || [])[1];

// ── static ─────────────────────────────────────────────────────────────────
for (const [lang, file] of Object.entries(EDITIONS)) {
  const orig = read(path.join(ROOT, file)).split('\n'), app = read(path.join(WWW, file)).split('\n');
  // the app's only addition: four lines just before </head>
  const at = app.findIndex((l) => l.startsWith('<!-- app build (mobile-app/scripts/build.mjs)'));
  t(`${file}: the app's note is in <head>`, at > 0 && app[at + 4] === '</head>', `line ${at}`);
  const rest = app.slice(0, at).concat(app.slice(at + 4));
  t(`${file}: as many lines as the page at the root`, rest.length === orig.length, `${rest.length} vs ${orig.length}`);
  const changed = rest.map((l, i) => (l === orig[i] ? null : i)).filter((i) => i !== null);
  const kinds = changed.map((i) => (/http-equiv="Content-Security-Policy"/.test(orig[i]) ? 'csp'
    : /var D='https:\/\/cdn\.jsdelivr\.net/.test(orig[i]) ? 'katex' : /rel="preconnect"/.test(orig[i]) ? 'preconnect' : `line ${i + 1}`));
  t(`${file}: differs from the root page only in the CSP, the KaTeX path and the preconnect`,
    kinds.sort().join() === 'csp,katex,preconnect', kinds.join(', '));
  const src = app.join('\n');
  t(`${file}: no jsDelivr left`, !/cdn\.jsdelivr\.net/.test(src));
  t(`${file}: is the ${lang} edition`, src.includes(`var APP_LANG='${lang}';`));
  for (const f of ['katex.min.css', 'katex.min.js', 'contrib/auto-render.min.js']) {
    const h = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(WWW, 'vendor', `katex@${KV}`, 'dist', f))).digest('base64');
    t(`${file}: the page's SRI matches the app's ${f}`, src.includes(`integrity='${h}'`));
  }
}
{
  const idx = read(path.join(WWW, 'index.html'));
  const h = (x) => `'sha256-${crypto.createHash('sha256').update(x, 'utf8').digest('base64')}'`;
  const csp = (/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(idx) || [])[1] || '';
  const script = (/<script>([\s\S]*?)<\/script>/.exec(idx) || [])[1], style = (/<style>([\s\S]*?)<\/style>/.exec(idx) || [])[1];
  t('index.html: script-src is the hash of its script', csp.includes(`script-src ${h(script)};`));
  t('index.html: style-src is the hash of its style', csp.includes(`style-src ${h(style)};`));
  t('index.html: default-src none, no inline allowance', /default-src 'none'/.test(csp) && !/unsafe/.test(csp));
}

// ── in the browser, at the app's origin ───────────────────────────────────
const browser = await launch();
const PLACE = { IL: ['Asia/Jerusalem', 'he-IL'], 'IL/en': ['Asia/Jerusalem', 'en-US'], 'abroad/en-IL': ['Europe/London', 'en-IL'],
  US: ['America/New_York', 'en-US'], DE: ['Europe/Berlin', 'de-DE'], unknown: ['UTC', 'fr-FR'] };
async function session(place, saved) {
  const [timezoneId, locale] = PLACE[place];
  const ctx = await browser.newContext({ viewport: { width: 400, height: 820 }, locale, timezoneId, hasTouch: true, isMobile: true });
  const away = await serveApp(ctx);
  await ctx.addInitScript(([saved]) => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
    try { localStorage.setItem('phys_onboarded', '1'); if (saved !== null && !sessionStorage.getItem('seeded')) { localStorage.setItem('phys_lang', saved); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* none */ }
  }, [saved]);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors, away };
}

// the start page (the game then writes its first topic into the address: #/…)
let direct;
{
  const s = await session('IL', null);
  await s.page.goto(`${ORIGIN}/${EDITIONS.he}`);
  await s.page.waitForTimeout(600);
  direct = await s.page.evaluate(() => history.length);
  await s.ctx.close();
}
// the website's own rule (index.html, copied byte for byte): the language of
// the last visit, else Hebrew in Israel -- by time zone, or an Israeli region
// in the device's languages -- and English elsewhere or where unknown
t('index.html: the website\'s own start page, byte for byte', read(path.join(WWW, 'index.html')) === read(path.join(ROOT, 'index.html')));
for (const [locale, saved, want] of [['IL', null, 'he'], ['IL/en', null, 'he'], ['abroad/en-IL', null, 'he'],
  ['US', null, 'en'], ['DE', null, 'en'], ['unknown', null, 'en'],
  ['IL', 'en', 'en'], ['US', 'he', 'he'], ['US', 'xx', 'en'], ['IL', 'xx', 'he']]) {
  const s = await session(locale, saved);
  await s.page.goto(ORIGIN + '/');
  await s.page.waitForURL(/physics_game_/, { timeout: 15000 }).catch(() => {});
  await s.page.waitForTimeout(600);
  const url = s.page.url();
  t(`start page, ${locale}, saved ${saved}: opens ${want}`, url.split('#')[0] === `${ORIGIN}/${EDITIONS[want]}`, url);
  // back from the first topic must leave the app, not land on the start page
  t(`start page, ${locale}: leaves no history entry of its own`, await s.page.evaluate(() => history.length) === direct);
  await s.ctx.close();
}

for (const [lang, file] of Object.entries(EDITIONS)) {
  const s = await session(lang === 'he' ? 'IL' : 'US', null);
  await s.page.goto(`${ORIGIN}/${file}#/kinematics/distance-time/theory`);
  await s.page.waitForFunction(() => typeof window.render === 'function' && document.querySelector('.tab'), null, { timeout: 20000 });
  await s.page.waitForTimeout(700);
  const r = await s.page.evaluate(() => ({
    katex: !!(window.katex && window.katex.render), typeset: document.querySelectorAll('.katex').length,
    print: (() => { const b = document.querySelector('.print-btn'); return b ? getComputedStyle(b).display : 'none'; })(),
    open: window.open('', '_blank'), secure: window.isSecureContext, lang: APP_LANG,
  }));
  t(`${file}: KaTeX from the app itself`, r.katex);
  t(`${file}: formulas typeset by KaTeX`, r.typeset > 3, String(r.typeset));
  t(`${file}: 🖨 hidden`, r.print === 'none', r.print);
  t(`${file}: window.open opens nothing`, r.open === null);
  t(`${file}: secure context (the sensor lab needs it)`, r.secure);

  // topics and tabs go into the history: Android's back button steps through them
  const h0 = await s.page.evaluate(() => history.length);
  await s.page.click('.tab:nth-of-type(2)');
  await s.page.waitForTimeout(400);
  const h1 = await s.page.evaluate(() => ({ n: history.length, hash: location.hash }));
  t(`${file}: a tab is a history entry`, h1.n === h0 + 1 && /\/sim$/.test(h1.hash), JSON.stringify(h1));
  await s.page.goBack();
  await s.page.waitForTimeout(500);
  t(`${file}: back returns to the tab before`, await s.page.evaluate(() => location.hash === '#/kinematics/distance-time/theory' && state.tab === 'theory'));

  // every subject's first sim paints, under the app's CSP
  for (const route of ['planar/projectile/sim', 'opt-lenses/convex-lens/sim', 'elc-charge/elc-field/sim', 'dc-network/dc-mixed/sim', 'mag-field/mag-solenoid/sim']) {
    await s.page.evaluate((h) => { location.hash = h; }, '#/' + route);
    await s.page.waitForTimeout(700);
    t(`${file}: ${route} drawn`, await s.page.evaluate(() => { const c = document.getElementById('sim-canvas'); return !!c && c.width > 0; }));
  }

  // 🌐: the other edition, same topic and tab
  await s.page.evaluate(() => { location.hash = '#/kinematics/distance-time/quiz'; });
  await s.page.waitForTimeout(500);
  const other = lang === 'he' ? 'en' : 'he';
  await s.page.evaluate((o) => _langGo(o), other);
  await s.page.waitForURL(new RegExp(EDITIONS[other]), { timeout: 15000 }).catch(() => {});
  t(`${file}: 🌐 → ${other} keeps the topic`, s.page.url() === `${ORIGIN}/${EDITIONS[other]}#/kinematics/distance-time/quiz`, s.page.url());
  await s.page.waitForTimeout(900);
  t(`${file}: 🌐 choice remembered for the next start`, await s.page.evaluate(() => localStorage.getItem('phys_lang')) === other);

  const csp = await s.page.evaluate(() => window.__csp);
  t(`${file}: no CSP violation`, csp.length === 0, csp.slice(0, 3).join(' | '));
  t(`${file}: no page error`, s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
  t(`${file}: no request to any other site`, s.away.length === 0, s.away.slice(0, 3).join(' '));
  await s.ctx.close();
}
// a session in an edition is remembered: the next start opens it, wherever the device is
for (const [place, file, want] of [['IL', EDITIONS.en, 'en'], ['US', EDITIONS.he, 'he']]) {
  const s = await session(place, null);
  await s.page.goto(`${ORIGIN}/${file}`);
  await s.page.waitForFunction(() => localStorage.getItem('phys_lang'), null, { timeout: 20000 }).catch(() => {});
  await s.page.goto(ORIGIN + '/');
  await s.page.waitForURL(/physics_game_/, { timeout: 15000 }).catch(() => {});
  t(`last session in ${want}, device ${place}: the next start opens ${want}`, s.page.url().split('#')[0] === `${ORIGIN}/${EDITIONS[want]}`, s.page.url());
  await s.ctx.close();
}
await browser.close();

console.log(`check: ${checks - fail}/${checks} passed`);
process.exit(fail ? 1 : 0);
