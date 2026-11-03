// The Play Store feature graphics (1024 x 500, 24-bit, no alpha), in Hebrew
// and English: the app's icon with its name and what it teaches.
//
//   python3 scripts/icon.py && node scripts/art.mjs     (npm run art)
//
// The icon itself -- every size, for both stores and the pages' favicon -- is
// made by scripts/icon.py from resources/icon-source.jpg; this script uses its
// rounded 512 px version and the game's own fonts (Rubik, Heebo).

import fs from 'node:fs';
import path from 'node:path';
import { APP, launch, toRGB, pngInfo, gameFonts } from './_tools.mjs';

const ICON = path.join(APP, 'resources', 'icon-rounded-512.png');
if (!fs.existsSync(ICON)) throw new Error('no resources/icon-rounded-512.png: run python3 scripts/icon.py first');
const iconURI = 'data:image/png;base64,' + fs.readFileSync(ICON).toString('base64');

const FEATURE = {
  he: { dir: 'rtl', title: 'פיזיכיף', sub: 'מכניקה · אופטיקה · חשמל · מגנטיות',
    tag: 'פיזיקה לבגרות: תיאוריה, סימולציות אינטראקטיביות, חידונים ובעיות מודרכות' },
  en: { dir: 'ltr', title: 'Physfun', sub: 'Mechanics · Optics · Electricity · Magnetism',
    tag: 'High-school physics: theory, interactive simulations, quizzes and guided problems' },
};

function feature(lang) {
  const t = FEATURE[lang], rtl = t.dir === 'rtl';
  const ax = rtl ? 232 : 792;            // the icon at the far end of the reading line
  const tx = rtl ? 1024 - 56 : 56;       // the throw starts under the words, lands short of the icon
  const throwPath = `M${tx} 500 Q ${rtl ? 760 : 264} 300 ${rtl ? 470 : 554} 500`;
  return `<!DOCTYPE html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8"><style>
${gameFonts()}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
.fg{position:relative;width:1024px;height:500px;background:radial-gradient(circle at ${rtl ? 22 : 78}% 46%,#0f2a50 0,#0a1a33 38%,#071426 72%)}
svg{position:absolute;inset:0}
.icon{position:absolute;left:${ax - 150}px;top:100px;width:300px;height:300px;border-radius:67px;
  box-shadow:0 0 0 1px rgba(148,163,184,.22),0 24px 60px rgba(0,0,0,.55),0 0 90px rgba(34,211,238,.18)}
.words{position:absolute;top:0;bottom:0;${rtl ? 'right' : 'left'}:72px;width:560px;display:flex;flex-direction:column;justify-content:center;color:#e6eef8;font-family:Heebo,sans-serif}
h1{margin:0;font:900 ${rtl ? 92 : 100}px/1.05 Rubik,Heebo,sans-serif;letter-spacing:${rtl ? 0 : '-1px'};color:#fff}
.sub{margin:22px 0 0;font:600 27px/1.3 Heebo,sans-serif;color:#22d3ee;text-wrap:balance}
.tag{margin:14px 0 0;font:400 22px/1.45 Heebo,sans-serif;color:#b8c7da;text-wrap:balance}
</style></head><body><div class="fg">
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#3b82f6" stroke-opacity=".10" stroke-width="1">${[...Array(21)].map((_, i) => `<line x1="${i * 52}" y1="0" x2="${i * 52}" y2="500"/>`).join('')}${[...Array(10)].map((_, i) => `<line x1="0" y1="${i * 52 + 12}" x2="1024" y2="${i * 52 + 12}"/>`).join('')}</g>
  <path d="${throwPath}" fill="none" stroke="#f59e0b" stroke-opacity=".30" stroke-width="3" stroke-dasharray="10 9"/>
  <path d="${[...Array(103)].map((_, i) => `${i ? 'L' : 'M'}${i * 10} ${472 - 14 * Math.sin(i / 3.2)}`).join(' ')}" fill="none" stroke="#22d3ee" stroke-opacity=".20" stroke-width="2.5"/>
</svg>
<img class="icon" alt="" src="${iconURI}">
<div class="words"><h1>${t.title}</h1><p class="sub">${t.sub}</p><p class="tag">${t.tag}</p></div>
</div></body></html>`;
}

const browser = await launch();
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1024, height: 500 } });
for (const lang of ['he', 'en']) {
  await page.setContent(feature(lang), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = toRGB(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1024, height: 500 } }));
  const rel = `store/google-play/feature-graphic-${lang}.png`;
  fs.writeFileSync(path.join(APP, rel), png);
  const i = pngInfo(png);
  console.log(`  ${rel}  ${i.width}x${i.height} ${i.alpha ? 'RGBA' : 'RGB'}`);
}
await browser.close();
