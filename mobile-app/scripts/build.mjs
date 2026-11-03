// Builds the app's web bundle, www/, from the two pages of the game at the
// repository root -- it only reads them -- and brings the native projects
// (android/, ios/) up to date with it.
//
//   npm run build                 from mobile-app/
//   APP_BUILD=1 npm run build     a second store upload of the same game version
//   npm run build -- --no-sync    www/ only, the native projects left as they are
//
// The app is the website's pages with four differences, each an exact text
// substitution counted here -- anything unexpected stops the build, so a change
// in the master can never be shipped half-adapted:
//
//  1. KaTeX comes from the app itself (www/vendor/katex@<version>/), the npm
//     release byte for byte, still held to the page's own SRI hashes. The app
//     works offline and contacts no site at all.
//  2. The CSP names that path on the app's two origins (Android
//     https://localhost, iOS capacitor://localhost) where the site names
//     jsDelivr; the preconnect to jsDelivr is dropped.
//  3. 🖨 (print a progress summary) is hidden and window.open returns null: a
//     phone's web view has no print dialog, and on Android the blank window
//     would replace the course instead of opening beside it.
//  4. index.html opens the edition chosen before with the 🌐 menu, otherwise
//     the device's language: Hebrew on a Hebrew device, English elsewhere.
//
// The version shown in the stores is the game's APP_VERSION (28.40 -> 28.40),
// with the build number MAJOR*100000 + MINOR*100 + APP_BUILD on Android
// (2804000) and MAJOR.MINOR.APP_BUILD on iOS (28.40.0).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const WWW = path.join(APP, 'www');
const SYNC = !process.argv.includes('--no-sync');

const fail = (msg) => { console.error(`build: ${msg}`); process.exit(1); };
const read = (p) => fs.readFileSync(p, 'utf8');
const sha = (alg, data) => crypto.createHash(alg).update(data).digest('base64');

const cfg = JSON.parse(read(path.join(APP, 'capacitor.config.json')));
const host = (cfg.server && cfg.server.hostname) || 'localhost';
const ORIGINS = [
  `${(cfg.server && cfg.server.androidScheme) || 'https'}://${host}`,
  `${(cfg.server && cfg.server.iosScheme) || 'capacitor'}://${host}`,
];
const EDITIONS = [
  { file: 'physics_game_v28.html', lang: 'he' },
  { file: 'physics_game_en.html', lang: 'en' },
];

// exactly n occurrences of `from` in src, each replaced by `to`
function swap(src, from, to, n, what) {
  const parts = src.split(from);
  if (parts.length - 1 !== n)
    fail(`${what}: expected ${n} × ${JSON.stringify(from.slice(0, 80))}, found ${parts.length - 1}. ` +
      'The master changed in a way this build does not know yet -- update scripts/build.mjs.');
  return parts.join(to);
}

// ── the game's version and KaTeX, from the Hebrew master ──────────────────
const master = read(path.join(ROOT, EDITIONS[0].file));
const version = (/var APP_VERSION='(\d+)\.(\d+)'/.exec(master) || []).slice(1).map(Number);
if (version.length !== 2) fail('no APP_VERSION=\'MAJOR.MINOR\' in the master');
const build = Number(process.env.APP_BUILD || 0);
if (!Number.isInteger(build) || build < 0 || build > 99) fail('APP_BUILD must be a whole number 0-99');
const [MAJOR, MINOR] = version;
if (MINOR > 999) fail('MINOR above 999 does not fit the Android version code');
const versionName = `${MAJOR}.${MINOR}`;
const versionCode = MAJOR * 100000 + MINOR * 100 + build;
const iosBuild = `${MAJOR}.${MINOR}.${build}`;

const KV = (/var D='https:\/\/cdn\.jsdelivr\.net\/npm\/katex@([0-9.]+)\/dist\/'/.exec(master) || [])[1];
if (!KV) fail('the master no longer loads KaTeX from jsDelivr the way this build expects');
const KDIR = path.join(APP, 'node_modules', 'katex');
if (!fs.existsSync(KDIR)) fail('node_modules/katex is missing: run `npm ci` in mobile-app/ first');
const kInstalled = JSON.parse(read(path.join(KDIR, 'package.json'))).version;
if (kInstalled !== KV)
  fail(`the pages load katex@${KV} but mobile-app has katex@${kInstalled}: set "katex": "${KV}" in mobile-app/package.json and run npm install`);

// ── www/ from scratch ───────────────────────────────────────────────────────
fs.rmSync(WWW, { recursive: true, force: true });
const KOUT = path.join(WWW, 'vendor', `katex@${KV}`);
fs.mkdirSync(path.join(KOUT, 'dist', 'contrib'), { recursive: true });
fs.mkdirSync(path.join(KOUT, 'dist', 'fonts'), { recursive: true });

// KaTeX: the three files the pages load, and the woff2 fonts its stylesheet
// asks for first (every supported web view takes woff2, so .woff/.ttf would
// only add weight). Its MIT licence travels with it.
const KFILES = ['katex.min.css', 'katex.min.js', 'contrib/auto-render.min.js'];
const kHashes = {};
for (const f of KFILES) {
  const b = fs.readFileSync(path.join(KDIR, 'dist', f));
  kHashes[f] = 'sha384-' + sha('sha384', b);
  fs.writeFileSync(path.join(KOUT, 'dist', f), b);
}
const css = read(path.join(KDIR, 'dist', 'katex.min.css'));
const fonts = [...new Set([...css.matchAll(/url\((fonts\/[A-Za-z0-9_-]+\.woff2)\)/g)].map((m) => m[1]))];
if (fonts.length < 15) fail(`katex.min.css names only ${fonts.length} woff2 fonts`);
for (const f of fonts) fs.copyFileSync(path.join(KDIR, 'dist', f), path.join(KOUT, 'dist', f));
fs.copyFileSync(path.join(KDIR, 'LICENSE'), path.join(KOUT, 'LICENSE'));

// the licences of what the app carries travel inside it: the fonts' OFL at
// fonts/OFL.txt, where the pages' own note points; Capacitor's MIT licence
fs.mkdirSync(path.join(WWW, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'fonts', 'OFL.txt'), path.join(WWW, 'fonts', 'OFL.txt'));
fs.mkdirSync(path.join(WWW, 'licenses'), { recursive: true });
const capVersion = JSON.parse(read(path.join(APP, 'node_modules', '@capacitor', 'core', 'package.json'))).version;
fs.copyFileSync(path.join(APP, 'node_modules', '@capacitor', 'core', 'LICENSE'), path.join(WWW, 'licenses', 'capacitor-LICENSE.txt'));
fs.writeFileSync(path.join(WWW, 'licenses', 'NOTICE.txt'), `Third-party components in this app

- KaTeX ${KV} (formula typesetting): MIT License, vendor/katex@${KV}/LICENSE
- Heebo (Copyright 2014 The Heebo Project Authors) and Rubik (Copyright 2015
  The Rubik Project Authors), embedded in the pages: SIL Open Font License 1.1,
  fonts/OFL.txt
- Capacitor ${capVersion} (the native shell): MIT License, licenses/capacitor-LICENSE.txt
- Android only: AndroidX libraries, Apache License 2.0,
  https://www.apache.org/licenses/LICENSE-2.0
`);

// ── the two editions ───────────────────────────────────────────────────────
const CDN = `https://cdn.jsdelivr.net/npm/katex@${KV}/`;
const LOCAL = ORIGINS.map((o) => `${o}/vendor/katex@${KV}/`).join(' ');
const APP_NOTE =
  '<!-- app build (mobile-app/scripts/build.mjs): a phone\'s web view has no print\n' +
  '     dialog, and on Android a blank window would replace the course -->\n' +
  '<style>.print-btn{display:none!important}</style>\n' +
  '<script>window.open=function(){return null;};</script>\n';

let appVersion = null;
for (const ed of EDITIONS) {
  let src = read(path.join(ROOT, ed.file));
  const v = (/var APP_VERSION='([^']+)'/.exec(src) || [])[1];
  if (v !== versionName) fail(`${ed.file} is v${v} but the master is v${versionName}: rebuild the edition first (node tools/i18n.js build en)`);
  if (!new RegExp(`var APP_LANG='${ed.lang}';`).test(src)) fail(`${ed.file} is not the ${ed.lang} edition`);

  // 1-2. the CSP: jsDelivr's KaTeX path -> the same path in the app, nothing else
  const cspRe = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/;
  const m = cspRe.exec(src);
  if (!m || src.split('http-equiv="Content-Security-Policy"').length !== 2) fail(`${ed.file}: not exactly one CSP`);
  const csp = swap(m[1], CDN, LOCAL, 3, `${ed.file} CSP (script-src, style-src, font-src)`);
  src = src.slice(0, m.index) + m[0].replace(m[1], csp) + src.slice(m.index + m[0].length);
  src = swap(src, `var D='${CDN}dist/'`, `var D='vendor/katex@${KV}/dist/'`, 1, `${ed.file} KaTeX loader`);
  src = swap(src, '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>', '', 1, `${ed.file} preconnect`);

  // 3. no print button, no window
  const headEnd = src.indexOf('</head>');
  if (headEnd < 0 || headEnd > src.indexOf('<body')) fail(`${ed.file}: no </head> before <body>`);
  src = src.slice(0, headEnd) + APP_NOTE + src.slice(headEnd);
  swap(src, 'class="theme-btn print-btn"', '', 1, `${ed.file} print button`);

  // what the app must never carry: the CDN, or any other site
  if (/cdn\.jsdelivr\.net/.test(src)) fail(`${ed.file}: a reference to jsDelivr is left`);
  const sites = (src.match(/[a-z]+:\/\/[A-Za-z0-9.-]+[^\s"'`)<>\\]*/g) || [])
    .map((u) => u.replace(/[;,]+$/, ''))
    .filter((u) => !/^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1998\/Math\/MathML)/.test(u))
    .filter((u) => !ORIGINS.some((o) => u === `${o}/vendor/katex@${KV}/`));
  if (sites.length) fail(`${ed.file}: unexpected address ${sites[0]}`);
  for (const [f, h] of Object.entries(kHashes))
    if (!src.includes(`integrity='${h}'`)) fail(`${ed.file}: the page's SRI for ${f} is not the hash of katex@${KV}'s ${f}`);

  fs.writeFileSync(path.join(WWW, ed.file), src);
  appVersion = v;
}

// ── 4. the launcher ─────────────────────────────────────────────────────────
const style =
  'html,body{margin:0;background:#07101f;color:#dde6f0;font:16px/1.7 system-ui,Arial,sans-serif;text-align:center}' +
  'p{margin:0;padding:64px 16px;opacity:0;animation:s .3s 1.5s forwards}@keyframes s{to{opacity:1}}a{color:#60a5fa}';
const script =
  "(function(){var f={he:'physics_game_v28.html',en:'physics_game_en.html'},l=null,p='';" +
  "try{l=localStorage.getItem('phys_lang');}catch(e){}" +
  "if(!Object.prototype.hasOwnProperty.call(f,l)){" +
  "try{p=String((navigator.languages&&navigator.languages[0])||navigator.language||'');}catch(e){}" +
  "l=/^(he|iw)\\b/i.test(p)?'he':'en';}" +
  "window.location.replace(f[l]+(window.location.hash||''));})();";
const launcher = `<!DOCTYPE html><html lang="he" dir="rtl"><head>
<meta charset="utf-8">
<!-- the app's start page: it opens the edition chosen before with the 🌐 menu,
     otherwise the device's language (Hebrew on a Hebrew device, English
     elsewhere). Generated by mobile-app/scripts/build.mjs; its one script and
     one style are allowed by their SHA-256. -->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${sha('sha256', script)}'; style-src 'sha256-${sha('sha256', style)}'; img-src data:; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>פיזיקה · Physics</title>
<style>${style}</style>
</head><body>
<p><a href="physics_game_v28.html">פיזיקה לבגרות</a> · <a href="physics_game_en.html" lang="en" dir="ltr">Physics in English</a></p>
<script>${script}</script>
</body></html>
`;
fs.writeFileSync(path.join(WWW, 'index.html'), launcher);

// ── the native projects: identity and version ──────────────────────────────
function edit(file, edits) {
  if (!fs.existsSync(file)) return false;
  let s = read(file);
  for (const [re, to, n, what] of edits) {
    const found = (s.match(re) || []).length;
    if (found !== n) fail(`${path.relative(APP, file)}: expected ${n} × ${what}, found ${found}`);
    s = s.replace(re, to);
  }
  fs.writeFileSync(file, s);
  return true;
}
const gradle = edit(path.join(APP, 'android', 'app', 'build.gradle'), [
  [/applicationId "[^"]*"/g, `applicationId "${cfg.appId}"`, 1, 'applicationId'],
  [/versionCode \d+/g, `versionCode ${versionCode}`, 1, 'versionCode'],
  [/versionName "[^"]*"/g, `versionName "${versionName}"`, 1, 'versionName'],
]);
const pbx = edit(path.join(APP, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), [
  [/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${cfg.appId};`, 2, 'PRODUCT_BUNDLE_IDENTIFIER'],
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`, 2, 'MARKETING_VERSION'],
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${iosBuild};`, 2, 'CURRENT_PROJECT_VERSION'],
]);

const kb = (p) => fs.statSync(p).size / 1024;
console.log(`build: www/ for v${appVersion} -- ${EDITIONS.map((e) => `${e.file} ${kb(path.join(WWW, e.file)).toFixed(0)} KB`).join(', ')}, katex@${KV} (${fonts.length} fonts)`);
console.log(`build: ${cfg.appId} ${versionName} -- Android versionCode ${versionCode}${gradle ? '' : ' (no android/ yet)'}, iOS build ${iosBuild}${pbx ? '' : ' (no ios/ yet)'}`);

if (SYNC && (gradle || pbx)) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync'], { cwd: APP, stdio: 'inherit' });
}
