// Does every guided answer agree with the number its own explanation computes?
// check_answers proves the app ACCEPTS the stated answer; this asks whether the
// stated answer is the one the worked reasoning actually arrives at. It is the
// check that catches drift after content edits.
//
//   node tests/check_numbers.js
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
  await p.goto(F);
  await p.waitForTimeout(800);

  const rows = await p.evaluate(() => {
    // ¹ ² ³ live in Latin-1 and NOT in the superscript block, and Hebrew text
    // uses U+2212 MINUS rather than the ASCII hyphen -- miss either and a
    // perfectly correct explanation looks like a mismatch.
    const SUP = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+' };
    const SUPCH = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺';
    // "2.26×10⁵", "1.6×10⁻¹⁹", "9×10⁹", "0.81", "13.3", "1.35e5", "240,000"
    const nums = (s) => {
      const out = [];
      const txt = String(s || '').replace(/<[^>]*>/g, ' ');
      const re = new RegExp('([-\u2212]?\\d[\\d,]*\\.?\\d*)\\s*(?:[\u00D7x*]\\s*10\\s*([' + SUPCH + ']+|\\^?[-\u2212]?\\d+)|[eE]([+-]?\\d+))?', 'g');
      let m;
      while ((m = re.exec(txt))) {
        // "ב-570" is Hebrew prefix + hyphen, not a negative number
        const before = txt[m.index - 1] || '';
        let raw = m[1].replace(/,/g, '').replace(/\u2212/g, '-');
        if (/^[-]/.test(raw) && /[\u0590-\u05FF]/.test(before)) raw = raw.slice(1);
        let mant = parseFloat(raw);
        if (!isFinite(mant)) continue;
        let exp = 0;
        if (m[2]) exp = parseInt(String(m[2]).split('').map(c => SUP[c] !== undefined ? SUP[c] : c)
          .join('').replace('^', '').replace(/\u2212/g, '-'), 10);
        else if (m[3]) exp = parseInt(m[3], 10);
        if (isFinite(exp) && exp !== 0) mant *= Math.pow(10, exp);
        out.push(mant);
      }
      return out;
    };
    const out = [];
    for (const k of Object.keys(CONTENT)) {
      const steps = ((CONTENT[k].problem || {}).steps) || [];
      steps.forEach((s, i) => {
        if (s.tolerance === -1) return;                  // an exact-match word answer
        const a = parseFloat(String(s.answer).replace(/,/g, ''));
        if (!isFinite(a)) return;
        const found = nums(s.explain);
        // does the explanation contain the answer, to within its own tolerance
        // (or 2%, whichever is looser -- explanations round)
        const tol = Math.max(Math.abs(s.tolerance || 0), Math.abs(a) * 0.02, 1e-12);
        const hit = found.some(v => Math.abs(v - a) <= tol);
        if (!hit) out.push({ k: k + '#' + i, answer: s.answer, unit: s.unit,
                             seen: found.slice(0, 8).map(v => v.toPrecision(3)).join(', ') });
      });
    }
    return out;
  });

  console.log(`   ${rows.length} step(s) whose explanation never states the answer`);
  rows.slice(0, 40).forEach(r => console.log(`      ${r.k}  answer=${r.answer} ${r.unit || ''}   explanation has: ${r.seen}`));
  t('every guided answer appears in its own explanation', rows.length, 0);
  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ EVERY ANSWER MATCHES ITS EXPLANATION');
  process.exit(fail ? 1 : 0);
})();
