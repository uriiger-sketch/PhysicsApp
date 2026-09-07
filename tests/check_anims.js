// Theory animations: every one of them is driven by runAnim and must respond to
// the pointer the same way -- tap to pause, drag to scrub through time.
//
//   node tests/check_anims.js
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0;
const t = (name, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${got} want ${want}`);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  const chapters = await p.evaluate(() => [].concat(MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS)
    .map(c => ({ id: c.id, s: c.sections.map(x => x.id) })));

  let seen = 0, noHandler = [], noScrub = [], noPause = [], blank = [];
  for (const ch of chapters) for (const se of ch.s) {
    const r = await p.evaluate(async ([c, x]) => {
      state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : 'mechanics';
      state.chapter = c; state.section = x; state.tab = 'theory'; render();
      await new Promise(r2 => setTimeout(r2, 700));
      const out = [];
      for (const id of Object.keys(_anim)) {
        const cv = document.getElementById(id);
        if (!cv) continue;
        const s = _anim[id];
        const rect = cv.getBoundingClientRect();
        const fire = (type, dx) => {
          const ev = new MouseEvent(type, { clientX: rect.left + 40 + dx, clientY: rect.top + 10,
                                            bubbles: true, cancelable: true });
          cv.dispatchEvent(ev);
        };
        // drag: time must move, and the animation must park itself
        const t0 = s.t;
        fire('mousedown', 0); fire('mousemove', 60); fire('mouseup', 60);
        const scrubbed = Math.abs(s.t - t0) > 0.05, parked = s.paused === true;
        // tap: toggles back
        fire('mousedown', 0); fire('mouseup', 0);
        const toggled = s.paused === false;
        animReset(id);
        // and it must have painted something
        const g = cv.getContext('2d');
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let ink = 0;
        for (let i = 3; i < d.length; i += 400) if (d[i] > 8) ink++;
        out.push({ id, handler: cv.getAttribute('data-noh') !== '1', scrubbed, parked, toggled, ink: ink > 0 });
      }
      return out;
    }, [ch.id, se]);
    for (const a of r) {
      seen++;
      if (!a.scrubbed) noScrub.push(`${ch.id}.${se}/${a.id}`);
      if (!a.parked || !a.toggled) noPause.push(`${ch.id}.${se}/${a.id}`);
      if (!a.ink) blank.push(`${ch.id}.${se}/${a.id}`);
    }
  }
  console.log(`   ${seen} theory animations exercised`);
  t('every animation scrubs with a drag', noScrub.slice(0, 6).join(' ') || 'none', 'none');
  t('every animation pauses on a drag and toggles on a tap', noPause.slice(0, 6).join(' ') || 'none', 'none');
  t('none of them renders blank', blank.slice(0, 6).join(' ') || 'none', 'none');
  console.log('   page errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'NONE');
  if (errs.length) fail++;
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ALL ANIMATION TESTS PASS');
  process.exit(fail ? 1 : 0);
})();
