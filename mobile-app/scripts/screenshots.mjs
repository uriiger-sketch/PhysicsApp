// Store screenshots: the app's own screens, rendered from www/ at the app's
// origin (so KaTeX, the fonts and the layout are exactly the app's), each under
// a short headline, at the sizes the stores ask for, in Hebrew and English.
//
//   npm run build -- --no-sync && node scripts/screenshots.mjs
//
// The app screen is drawn 1:1 (rendered at the frame's own pixel density), so
// its text stays sharp; no device frame or status bar is faked.

import fs from 'node:fs';
import path from 'node:path';
import { APP, WWW, ORIGIN, launch, serveApp, gameFonts } from './_tools.mjs';

const SHOTS = [
  { route: 'opt-lenses/convex-lens/sim',
    he: 'סימולציה אינטראקטיבית בכל נושא', en: 'Interactive simulations in every topic' },
  { route: 'kinematics/distance-time/theory',
    he: 'תיאוריה ברורה, צעד אחר צעד', en: 'Clear theory, step by step' },
  { route: 'energy/energy-cons/sim',
    he: 'גוררים, משחררים ורואים את הפיזיקה', en: 'Drag, release, and see the physics' },
  { route: 'mag-force/mag-lorentz/quiz',
    he: 'חידונים עם רמזים ודוגמאות פתורות', en: 'Quizzes with hints and worked examples' },
  // a guided problem opens once its quiz is done: done here, as a learner would have
  { route: 'dc-network/dc-mixed/problem', unlock: 'dc-network.dc-mixed.quiz',
    he: 'בעיות מודרכות, שלב אחר שלב', en: 'Guided problems, one step at a time' },
  { route: 'mag-field/mag-solenoid/sim',
    he: 'מכניקה, אופטיקה, חשמל ומגנטיות', en: 'Mechanics, optics, electricity and magnetism',
    subHe: 'בלי חשבון · בלי פרסומות · עובד גם בלי אינטרנט', subEn: 'No account · no ads · works offline' },
];

// w x h logical px at dpr = the store's pixel size; cap = headline band; m = side margin
const DEVICES = [
  { id: 'iphone-6.9', store: 'app-store', w: 440, h: 956, dpr: 3, cap: 190, m: 28, r: 26, h1: 30, sub: 16 },     // 1320 x 2868
  { id: 'ipad-13', store: 'app-store', w: 1032, h: 1376, dpr: 2, cap: 220, m: 56, r: 30, h1: 46, sub: 22 },      // 2064 x 2752
  { id: 'phone', store: 'google-play', w: 432, h: 768, dpr: 2.5, cap: 150, m: 24, r: 24, h1: 26, sub: 14 },      // 1080 x 1920
  { id: 'tablet-10', store: 'google-play', w: 900, h: 1600, dpr: 1.6, cap: 210, m: 48, r: 30, h1: 42, sub: 20 }, // 1440 x 2560
];
const EDITION = { he: 'physics_game_v28.html', en: 'physics_game_en.html' };

if (!fs.existsSync(path.join(WWW, 'index.html'))) throw new Error('no www/: run `npm run build -- --no-sync` first');
const FONTS = gameFonts();

function frame(d, lang, shot, png) {
  const rtl = lang === 'he', cw = d.w - 2 * d.m, ch = d.h - d.cap - d.m;
  const title = shot[lang], sub = shot[rtl ? 'subHe' : 'subEn'];
  return `<!DOCTYPE html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
${FONTS}
html,body{margin:0;width:${d.w}px;height:${d.h}px;overflow:hidden}
body{background:radial-gradient(120% 60% at 50% 0%,#14336a 0,#0b1f3f 45%,#071426 80%);font-family:Heebo,sans-serif;color:#fff}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(59,130,246,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.07) 1px,transparent 1px);background-size:${Math.round(d.w / 9)}px ${Math.round(d.w / 9)}px}
.cap{position:absolute;top:0;left:${d.m}px;right:${d.m}px;height:${d.cap}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
h1{margin:0;font:900 ${d.h1}px/1.18 Rubik,Heebo,sans-serif;letter-spacing:${rtl ? 0 : '-.3px'};text-wrap:balance;max-width:${Math.round(cw * 0.94)}px}
p{margin:${Math.round(d.h1 * 0.38)}px 0 0;font:600 ${d.sub}px/1.35 Heebo,sans-serif;color:#22d3ee;text-wrap:balance}
.card{position:absolute;left:${d.m}px;top:${d.cap}px;width:${cw}px;height:${ch}px;border-radius:${d.r}px;overflow:hidden;
  box-shadow:0 0 0 1px rgba(148,163,184,.28),0 ${Math.round(d.m * 0.8)}px ${d.m * 2}px rgba(0,0,0,.55)}
.card img{display:block;width:${cw}px;height:${ch}px}
</style></head><body><div class="grid"></div>
<div class="cap"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
<div class="card"><img alt="" src="data:image/png;base64,${png.toString('base64')}"></div>
</body></html>`;
}

const browser = await launch();
const errors = [], away = [], written = [];
for (const d of DEVICES) {
  const cw = d.w - 2 * d.m, ch = d.h - d.cap - d.m;
  for (const lang of ['he', 'en']) {
    const app = await browser.newContext({ viewport: { width: cw, height: ch }, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: d.w < 600 });
    await serveApp(app, away);
    await app.addInitScript(() => { try { localStorage.setItem('phys_onboarded', '1'); } catch (e) { /* none */ } });
    const page = await app.newPage();
    page.on('pageerror', (e) => errors.push(`${d.id}/${lang}: ${e.message}`));
    const framer = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr });
    const fp = await framer.newPage();
    const dir = path.join(APP, 'store', d.store, 'screenshots', lang);
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, shot] of SHOTS.entries()) {
      await page.goto(`${ORIGIN}/${EDITION[lang]}#/${shot.route}`);
      await page.waitForTimeout(1600);
      if (shot.unlock) {
        await page.evaluate((k) => { state.completed[k] = true; saveState(); render(); window.scrollTo(0, 0); }, shot.unlock);
        await page.waitForTimeout(900);
      }
      const png = await page.screenshot({ type: 'png' });
      await fp.setContent(frame(d, lang, shot, png), { waitUntil: 'load' });
      await fp.evaluate(() => document.fonts.ready);
      // a headline takes two lines at most: a longer one is set smaller
      await fp.evaluate(() => {
        const h = document.querySelector('h1');
        for (let i = 0; i < 40; i++) {
          const cs = getComputedStyle(h);
          if (h.getBoundingClientRect().height <= parseFloat(cs.lineHeight) * 2.2) break;
          h.style.fontSize = (parseFloat(cs.fontSize) - 1) + 'px';
        }
      });
      const file = path.join(dir, `${d.id}-${i + 1}.jpg`);
      fs.writeFileSync(file, await fp.screenshot({ type: 'jpeg', quality: 90 }));
      written.push(`${path.relative(APP, file)}  ${Math.round(d.w * d.dpr)}x${Math.round(d.h * d.dpr)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    }
    await app.close(); await framer.close();
  }
}
await browser.close();
console.log(written.map((w) => '  ' + w).join('\n'));
if (errors.length || away.length) {
  console.error(`screenshots: ${errors.length} page errors, ${away.length} requests to other sites`, errors.slice(0, 3), away.slice(0, 3));
  process.exit(1);
}
