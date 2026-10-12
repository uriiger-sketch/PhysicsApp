// A language edition shows the same unit badges as the Hebrew master.
//
//   node tests/check_i18n_badges.js [lang]          (default en)
//   APP_FILE=<edition.html> node tests/check_i18n_badges.js
//
// Every SI badge on a symbol chip or a formula-box parameter is worked out
// from the master's Hebrew wording (tools/i18n.js writes it into the edition).
// This opens every section's theory in the master and in the edition and
// compares the badges one by one, in order.
const { chromium } = require('playwright');
const path = require('path');
const lang = process.argv[2] || 'en';
const ROOT = path.resolve(__dirname, '..');
const MASTER = 'file://' + path.join(ROOT, 'physics_game_v28.html');
const EDITION = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE)
  : path.join(ROOT, require(path.join(ROOT, 'i18n', lang, 'config.json')).file));

async function badges(b, url) {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:/, r => r.abort());
  await p.goto(url); await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    if (window.closeOnboarding) closeOnboarding();
    const wait = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    for (const [s, chs] of [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]])
      for (const c of chs) for (const x of c.sections) {
        state.subject = s; state.chapter = c.id; state.section = x.id; state.tab = 'theory'; render(); await wait(30);
        o[c.id + '.' + x.id] = [...document.querySelectorAll('#app .param-wrap')].map(w => {
          const u = w.querySelector('.unit-badge');
          return (w.querySelector('.math-ltr, .param-val') || w).textContent.trim().slice(0, 24) + ' [' + (u ? u.textContent : '') + ']';
        });
      }
    return o;
  });
  await p.close();
  return { out, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const he = await badges(b, MASTER), ed = await badges(b, EDITION);
  await b.close();
  let n = 0, bad = 0;
  for (const k of Object.keys(he.out)) {
    const A = he.out[k], B = ed.out[k] || [];
    if (A.length !== B.length) { bad++; console.log(`   FAIL ${k}: ${A.length} chips in Hebrew, ${B.length} in the edition`); continue; }
    A.forEach((a, i) => { n++; const ua = a.replace(/^.* \[/, '['), ub = B[i].replace(/^.* \[/, '[');
      if (ua !== ub) { bad++; console.log(`   FAIL ${k} #${i}: ${a} (Hebrew) vs ${B[i]} (edition)`); } });
  }
  for (const e of he.errs.concat(ed.errs)) { bad++; console.log('   page error: ' + e); }
  console.log(bad ? `❌ ${bad} BADGE DIFFERENCES (of ${n})` : `✅ all ${n} symbol badges match the Hebrew`);
  process.exit(bad ? 1 : 0);
})();
