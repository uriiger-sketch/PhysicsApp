// No canvas label is lost in translation.
//
//   node tests/check_i18n_labels.js [lang]          (default en)
//   APP_FILE=<edition.html> node tests/check_i18n_labels.js
//
// A simulation or animation label that does not fit the canvas is not drawn
// (_fitLabel returns null), so a translation longer than its Hebrew can make a
// label silently disappear. This opens every section's simulation and theory,
// at phone and desktop width — and every slider at both ends — in the master
// and in the edition, records every
// label that was dropped, and fails where the edition drops more labels than
// the Hebrew does in the same view.
const { chromium } = require('playwright');
const path = require('path');
const lang = process.argv[2] || 'en';
const ROOT = path.resolve(__dirname, '..');
const MASTER = 'file://' + path.join(ROOT, 'physics_game_v28.html');
const EDITION = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE)
  : path.join(ROOT, require(path.join(ROOT, 'i18n', lang, 'config.json')).file));
const WIDTHS = [390, 1366];

async function drops(b, url, width) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:/, r => r.abort());
  // the same random numbers in both pages (a projectile's target, a noise
  // trace), so the two editions draw exactly the same scenes
  await p.addInitScript(() => { let s = 20261013; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; });
  await p.goto(url); await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    if (window.closeOnboarding) closeOnboarding();
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    let rec = null;
    const fit = window._fitLabel;
    window._fitLabel = function (ctx, txt) { const r = fit.apply(this, arguments); if (r === null && rec) rec.add(String(txt).replace(/[‎‏⁦-⁩]/g, '').replace(/-?\d+([.,]\d+)?/g, '#')); return r; };
    for (const [s, chs] of [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]])
      for (const c of chs) for (const x of c.sections) for (const tab of ['sim', 'theory']) {
        state.subject = s; state.chapter = c.id; state.section = x.id; state.tab = tab; render();
        rec = new Set(); await wait(tab === 'sim' ? 900 : 1200);
        // every slider at its two ends: the states where captions change
        if (tab === 'sim') for (const r of [...document.querySelectorAll('#app input[type=range]')]) {
          const v0 = r.value;
          for (const v of [r.min, r.max]) { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); await wait(260); }
          r.value = v0; r.dispatchEvent(new Event('input', { bubbles: true })); await wait(60);
        }
        o[c.id + '.' + x.id + '/' + tab] = [...rec]; rec = null;
      }
    return o;
  });
  await p.close();
  return { out, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let bad = 0, views = 0;
  for (const w of WIDTHS) {
    const he = await drops(b, MASTER, w), ed = await drops(b, EDITION, w);
    for (const k of Object.keys(he.out)) {
      views++;
      // only labels with words can be lost in translation: a readout of symbols
      // and a number ("H = 12.3 m") is the same text in every edition, and
      // whether it fits depends only on the animation frame that was sampled
      const worded = (l) => l.filter(x => /[A-Za-zÀ-ɏ\u0590-\u05FF]{3,}/.test(x));
      const A = worded(he.out[k]), B = worded(ed.out[k] || []);
      if (B.length > A.length) { bad++; console.log(`   FAIL ${w}px ${k}: ${B.length} label(s) dropped (Hebrew ${A.length}): ${B.map(s => '«' + s.slice(0, 70) + '»').join(' ')}`); }
    }
    for (const e of he.errs.concat(ed.errs)) { bad++; console.log(`   page error (${w}px): ${e}`); }
  }
  await b.close();
  console.log(bad ? `❌ ${bad} VIEWS LOSE LABELS IN TRANSLATION (of ${views})` : `✅ no label is lost in translation (${views} views, ${WIDTHS.join(' and ')} px)`);
  process.exit(bad ? 1 : 0);
})();
