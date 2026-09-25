// Version tracking: every push that changes the app must carry a new version.
//
//   node tests/check_version.js
//
// Checks that APP_VERSION is MAJOR.MINOR, that the changelog's top entry is
// that version, that versions in the changelog strictly decrease, that the
// app differs from the last commit only if the version was bumped, and that the
// badge is rendered in the header and opens the changelog.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'physics_game_v28.html');

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info ? ': ' + info : ''}`); }
};
const verOf = src => { const m = /var APP_VERSION='([^']+)'/.exec(src); return m ? m[1] : null; };
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1]; };

(async () => {
  const src = fs.readFileSync(FILE, 'utf8');
  const v = verOf(src);
  t('APP_VERSION present and MAJOR.MINOR', v && /^\d+\.\d+$/.test(v), v);

  // Compare with the committed version, if there is a commit to compare with.
  let head = null;
  try { head = execSync('git show HEAD:physics_game_v28.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(); } catch (e) {}
  if (head !== null) {
    const hv = verOf(head);
    if (head === src) console.log(`   (app unchanged since HEAD, v${v})`);
    else if (hv) t(`app changed since HEAD → version bumped past v${hv}`, v && cmp(v, hv) > 0, `still v${v}`);
    if (hv && head !== src) console.log(`   HEAD v${hv} → working v${v}`);
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const log = await p.evaluate(() => APP_CHANGELOG.map(e => ({ v: e.v, d: e.d, n: e.notes.length })));
  t('changelog top entry is APP_VERSION', log[0] && log[0].v === v, log[0] && log[0].v);
  for (let i = 1; i < log.length; i++)
    t(`changelog order ${log[i - 1].v} > ${log[i].v}`, cmp(log[i - 1].v, log[i].v) > 0);
  t('every changelog entry has a date and notes', log.every(e => /^\d{4}-\d\d-\d\d$/.test(e.d) && e.n > 0));
  t('versions unique', new Set(log.map(e => e.v)).size === log.length);

  const badge = await p.evaluate(() => { const e = document.getElementById('ver-badge');
    return e ? { txt: e.textContent, vis: e.getBoundingClientRect().width > 0 } : null; });
  t('header badge shows the version', badge && badge.txt === 'v' + v, badge && badge.txt);
  t('header badge visible', badge && badge.vis);
  await p.click('#ver-badge');
  await p.waitForTimeout(400);
  const open = await p.evaluate(() => { const e = document.getElementById('changelog-panel');
    return e && e.classList.contains('open') && e.textContent.includes('v' + APP_VERSION); });
  t('badge opens changelog listing the version', open);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  t('Escape closes changelog', await p.evaluate(() => !document.getElementById('changelog-panel').classList.contains('open')));

  // Phone width: the badge must still be there (the title is hidden there).
  await p.setViewportSize({ width: 390, height: 800 });
  await p.evaluate(() => render());
  await p.waitForTimeout(300);
  t('badge visible at phone width', await p.evaluate(() => { const e = document.getElementById('ver-badge');
    const r = e && e.getBoundingClientRect(); return !!r && r.width > 0 && r.right <= innerWidth + 1; }));
  t('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();

  console.log(`check_version: ${checks - fail}/${checks} passed (v${v})`);
  process.exit(fail ? 1 : 0);
})();
