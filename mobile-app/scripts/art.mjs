// Renders the app's icon, launch images and store graphics, and writes the
// Android vector icon, all from one design: the atom of the game's favicon
// (index.html) in its colours -- cyan orbits, an amber nucleus, navy -- drawn
// as a physics atom: tilted, an electron on every orbit, the nucleus lit. (The
// favicon's flat, level three-orbit mark is close to a well-known software
// logo; a store icon has to be told apart from it at a glance.)
//
//   node scripts/art.mjs        (needs Playwright + Chromium; see _tools.mjs)
//
// Writes:
//   resources/icon.svg                                   the design, for reference
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/      1024 px, no alpha (App Store rule)
//   ios/App/App/Assets.xcassets/Splash.imageset/         2732 px launch image
//   android/app/src/main/res/drawable/ic_launcher_*.xml  adaptive icon (Android 8+), and its
//                                                        one-colour layer for themed icons
//   android/app/src/main/res/drawable/splash_logo.xml    launch atom (Android 7-11)
//   android/app/src/main/res/mipmap-*/ic_launcher*.png   Android 7.x icons
//   store/app-store/icon-1024.png                        the same as the app's icon
//   store/google-play/icon-512.png                       Play listing icon, 32-bit
//   store/google-play/feature-graphic-{he,en}.png        1024 x 500, 24-bit (Play rule)

import fs from 'node:fs';
import path from 'node:path';
import { APP, launch, toRGB, pngInfo, gameFonts } from './_tools.mjs';

// ── the design, in the favicon's own 64-unit square (centre 32,32) ─────────
const ORBIT_RX = 24, ORBIT_RY = 9, ORBIT_W = 3.0;
const TILT = -16;                                  // the whole atom, degrees
const ORBITS = [0, 60, -60];                       // each orbit's turn
const ELECTRON_AT = [200, 20, 20];                 // each electron just past a tip of its orbit: left, lower right, top
const NUCLEUS_R = 5.4, ELECTRON_R = 2.2, HALO_R = 3.9;
const C = { orbitA: '#67E8F9', orbitB: '#3B82F6', nucA: '#FDE68A', nucB: '#F59E0B', nucC: '#D97706',
  electron: '#F0F9FF', halo: '#22D3EE', bgA: '#0D2547', bgB: '#071426', ground: '#07101F' };

const num = (x) => (Math.round(x * 1000) / 1000).toString();
const rad = (d) => (d * Math.PI) / 180;
// the atom's parts in a target space: centre (ox, oy), k target units per design unit
function parts(ox, oy, k) {
  const P = (x, y) => [ox + (x - 32) * k, oy + (y - 32) * k];
  const orbits = ORBITS.map((turn) => {
    const phi = turn + TILT, c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
    const [x1, y1] = P(32 - ORBIT_RX * c, 32 - ORBIT_RX * s), [x2, y2] = P(32 + ORBIT_RX * c, 32 + ORBIT_RX * s);
    const a = `A${num(ORBIT_RX * k)},${num(ORBIT_RY * k)} ${num(phi)} 1,1`;
    return `M${num(x1)},${num(y1)} ${a} ${num(x2)},${num(y2)} ${a} ${num(x1)},${num(y1)} Z`;
  });
  const electrons = ORBITS.map((turn, i) => {
    const phi = rad(turn + TILT), t = rad(ELECTRON_AT[i]);
    const x = 32 + ORBIT_RX * Math.cos(t) * Math.cos(phi) - ORBIT_RY * Math.sin(t) * Math.sin(phi);
    const y = 32 + ORBIT_RX * Math.cos(t) * Math.sin(phi) + ORBIT_RY * Math.sin(t) * Math.cos(phi);
    return P(x, y);
  });
  const circle = ([x, y], r) => `M${num(x - r)},${num(y)} A${num(r)},${num(r)} 0 1,1 ${num(x + r)},${num(y)} A${num(r)},${num(r)} 0 1,1 ${num(x - r)},${num(y)} Z`;
  return {
    orbits, width: ORBIT_W * k, circle,
    nucleus: P(32, 32), nucleusR: NUCLEUS_R * k,
    electrons, electronR: ELECTRON_R * k, haloR: HALO_R * k,
    grad: { a: P(10, 12), b: P(54, 52), nuc: P(30.2, 30.2), nucR: NUCLEUS_R * k * 1.25 },
  };
}

// as SVG (ids prefixed, so two atoms can share a document)
function atomSVG(ox, oy, k, id = 'a') {
  const p = parts(ox, oy, k);
  return `
  <defs>
    <linearGradient id="${id}o" gradientUnits="userSpaceOnUse" x1="${num(p.grad.a[0])}" y1="${num(p.grad.a[1])}" x2="${num(p.grad.b[0])}" y2="${num(p.grad.b[1])}">
      <stop offset="0" stop-color="${C.orbitA}"/><stop offset="1" stop-color="${C.orbitB}"/></linearGradient>
    <radialGradient id="${id}n" gradientUnits="userSpaceOnUse" cx="${num(p.grad.nuc[0])}" cy="${num(p.grad.nuc[1])}" r="${num(p.grad.nucR)}">
      <stop offset="0" stop-color="${C.nucA}"/><stop offset=".55" stop-color="${C.nucB}"/><stop offset="1" stop-color="${C.nucC}"/></radialGradient>
  </defs>
  <g fill="none" stroke="url(#${id}o)" stroke-width="${num(p.width)}">${p.orbits.map((d) => `<path d="${d}"/>`).join('')}</g>
  <circle cx="${num(p.nucleus[0])}" cy="${num(p.nucleus[1])}" r="${num(p.nucleusR)}" fill="url(#${id}n)"/>
  ${p.electrons.map(([x, y]) => `<circle cx="${num(x)}" cy="${num(y)}" r="${num(p.haloR)}" fill="${C.halo}" fill-opacity=".30"/><circle cx="${num(x)}" cy="${num(y)}" r="${num(p.electronR)}" fill="${C.electron}"/>`).join('')}`;
}

// as an Android VectorDrawable (108 x 108 viewport unless given)
function atomVector(k, { mono = false, size = 108, dp = 108, note }) {
  const o = size / 2, p = parts(o, o, k);
  const grad = (inner) => `\n        <aapt:attr name="${inner}">`;
  const orbit = (d) => mono
    ? `    <path android:pathData="${d}" android:fillColor="#00000000" android:strokeColor="#FFFFFFFF" android:strokeWidth="${num(p.width)}" />`
    : `    <path android:pathData="${d}" android:fillColor="#00000000" android:strokeWidth="${num(p.width)}">${grad('android:strokeColor')}
            <gradient android:type="linear" android:startX="${num(p.grad.a[0])}" android:startY="${num(p.grad.a[1])}" android:endX="${num(p.grad.b[0])}" android:endY="${num(p.grad.b[1])}" android:startColor="${C.orbitA}" android:endColor="${C.orbitB}" />
        </aapt:attr>
    </path>`;
  const nucleus = mono
    ? `    <path android:pathData="${p.circle(p.nucleus, p.nucleusR)}" android:fillColor="#FFFFFFFF" />`
    : `    <path android:pathData="${p.circle(p.nucleus, p.nucleusR)}">${grad('android:fillColor')}
            <gradient android:type="radial" android:centerX="${num(p.grad.nuc[0])}" android:centerY="${num(p.grad.nuc[1])}" android:gradientRadius="${num(p.grad.nucR)}">
                <item android:offset="0" android:color="${C.nucA}" />
                <item android:offset="0.55" android:color="${C.nucB}" />
                <item android:offset="1" android:color="${C.nucC}" />
            </gradient>
        </aapt:attr>
    </path>`;
  const electrons = p.electrons.map((e) => (mono ? '' : `    <path android:pathData="${p.circle(e, p.haloR)}" android:fillColor="#4D22D3EE" />\n`) +
    `    <path android:pathData="${p.circle(e, p.electronR)}" android:fillColor="${mono ? '#FFFFFFFF' : '#FF' + C.electron.slice(1)}" />`);
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- ${note} (generated by mobile-app/scripts/art.mjs) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="${dp}dp"
    android:height="${dp}dp"
    android:viewportWidth="${size}"
    android:viewportHeight="${size}">
${p.orbits.map(orbit).join('\n')}
${nucleus}
${electrons.join('\n')}
</vector>
`;
}

const BG = `<radialGradient id="bg" cx="512" cy="436" r="760" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${C.bgA}"/><stop offset="1" stop-color="${C.bgB}"/></radialGradient>`;
const svg = (view, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}">${body}\n</svg>`;
// full-bleed square: iOS and Google Play cut the corners themselves
const ICON = svg(1024, `<defs>${BG}</defs><rect width="1024" height="1024" fill="url(#bg)"/>${atomSVG(512, 512, 13.6)}`);
// Android 7.x launchers show the file as it is: the shape is in the image
const LEGACY_SQUARE = svg(1024, `<defs>${BG}</defs><rect x="64" y="64" width="896" height="896" rx="160" fill="url(#bg)"/>${atomSVG(512, 512, 12)}`);
const LEGACY_ROUND = svg(1024, `<defs>${BG}</defs><circle cx="512" cy="512" r="464" fill="url(#bg)"/>${atomSVG(512, 512, 11.4)}`);
// launch image: the page's own ground; aspect-fill keeps the middle ~1260 px
// of a phone in view, so the atom stays well inside it
const SPLASH = svg(2732, `<rect width="2732" height="2732" fill="${C.ground}"/>${atomSVG(1366, 1366, 9)}`);

const FEATURE = {
  he: { dir: 'rtl', title: 'פיזיקה לבגרות', sub: 'מכניקה · אופטיקה · חשמל · מגנטיות',
    tag: 'תיאוריה, סימולציות אינטראקטיביות, חידונים ובעיות מודרכות' },
  en: { dir: 'ltr', title: 'Physics', sub: 'Mechanics · Optics · Electricity · Magnetism',
    tag: 'Theory, interactive simulations, quizzes and guided problems' },
};
function feature(lang) {
  const t = FEATURE[lang], rtl = t.dir === 'rtl';
  const ax = rtl ? 232 : 792;            // the atom at the far end of the reading line
  const tx = rtl ? 1024 - 56 : 56;       // the throw starts under the words, lands short of the atom
  const throwPath = `M${tx} 500 Q ${rtl ? 760 : 264} 300 ${rtl ? 470 : 554} 500`;
  return `<!DOCTYPE html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8"><style>
${gameFonts()}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
.fg{position:relative;width:1024px;height:500px;background:radial-gradient(circle at ${rtl ? 22 : 78}% 46%,#0f2a50 0,#0a1a33 38%,#071426 72%)}
svg{position:absolute}
.words{position:absolute;top:0;bottom:0;${rtl ? 'right' : 'left'}:72px;width:560px;display:flex;flex-direction:column;justify-content:center;color:#e6eef8;font-family:Heebo,sans-serif}
h1{margin:0;font:900 ${rtl ? 76 : 96}px/1.05 Rubik,Heebo,sans-serif;letter-spacing:${rtl ? 0 : '-1px'};color:#fff}
.sub{margin:22px 0 0;font:600 27px/1.3 Heebo,sans-serif;color:#22d3ee;text-wrap:balance}
.tag{margin:14px 0 0;font:400 22px/1.45 Heebo,sans-serif;color:#b8c7da;text-wrap:balance}
</style></head><body><div class="fg">
<svg style="inset:0" width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#3b82f6" stroke-opacity=".10" stroke-width="1">${[...Array(21)].map((_, i) => `<line x1="${i * 52}" y1="0" x2="${i * 52}" y2="500"/>`).join('')}${[...Array(10)].map((_, i) => `<line x1="0" y1="${i * 52 + 12}" x2="1024" y2="${i * 52 + 12}"/>`).join('')}</g>
  <path d="${throwPath}" fill="none" stroke="#f59e0b" stroke-opacity=".30" stroke-width="3" stroke-dasharray="10 9"/>
  <path d="${[...Array(103)].map((_, i) => `${i ? 'L' : 'M'}${i * 10} ${472 - 14 * Math.sin(i / 3.2)}`).join(' ')}" fill="none" stroke="#22d3ee" stroke-opacity=".20" stroke-width="2.5"/>
</svg>
<svg style="left:${ax - 170}px;top:80px" width="340" height="340" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
  <circle cx="170" cy="170" r="168" fill="#22d3ee" fill-opacity=".05"/>${atomSVG(170, 170, 5.9, 'f')}
</svg>
<div class="words"><h1>${t.title}</h1><p class="sub">${t.sub}</p><p class="tag">${t.tag}</p></div>
</div></body></html>`;
}

const out = (rel) => { const p = path.join(APP, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); return p; };
const written = [];
const save = (rel, buf) => { fs.writeFileSync(out(rel), buf); const i = pngInfo(buf); written.push(`${rel}  ${i.width}x${i.height}${i.alpha ? ' RGBA' : ' RGB'}`); };
const saveText = (rel, text) => { fs.writeFileSync(out(rel), text); written.push(rel); };

// ── the vector files ──────────────────────────────────────────────────────
saveText('resources/icon.svg', ICON + '\n');
const RES = 'android/app/src/main/res/drawable/';
// adaptive icon: 108 dp canvas, the atom inside the 66 dp safe circle
saveText(RES + 'ic_launcher_foreground.xml', atomVector(1.1, { note: 'adaptive icon, front layer: inside the 66 dp safe zone' }));
saveText(RES + 'ic_launcher_monochrome.xml', atomVector(1.1, { mono: true, note: 'themed icon (Android 13+): one colour, which the system tints' }));
saveText(RES + 'splash_logo.xml', atomVector(1.72, { dp: 140, note: 'the atom alone, for the launch screen of Android 7-11 (drawable/splash.xml)' }));

// ── the pictures ─────────────────────────────────────────────────────────
const browser = await launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(html, w, h, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  const doc = html.startsWith('<svg')
    ? `<!DOCTYPE html><html><head><style>html,body{margin:0;background:${transparent ? 'transparent' : C.bgB}}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${html}</body></html>`
    : html;
  await page.setContent(doc, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

const icon1024 = toRGB(await render(ICON, 1024, 1024));
save('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', icon1024);
save('store/app-store/icon-1024.png', icon1024);
// Play's spec asks for a 32-bit PNG: opaque, with an alpha channel
save('store/google-play/icon-512.png', await render(ICON, 512, 512, true));

const splash = toRGB(await render(SPLASH, 2732, 2732));
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  save(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, splash);

for (const [d, n] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  save(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, await render(LEGACY_SQUARE, n, n, true));
  save(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, await render(LEGACY_ROUND, n, n, true));
}

for (const lang of ['he', 'en'])
  save(`store/google-play/feature-graphic-${lang}.png`, toRGB(await render(feature(lang), 1024, 500)));

// the Android vectors drawn by the same browser, as a check of the geometry
const vec = fs.readFileSync(path.join(APP, RES, 'ic_launcher_foreground.xml'), 'utf8');
if ((vec.match(/<path /g) || []).length !== 3 + 1 + 6) throw new Error('foreground vector: unexpected number of paths');

await browser.close();
console.log(written.map((w) => '  ' + w).join('\n'));
