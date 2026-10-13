// Learning-experience standards for the mechanics sections, shared by
// check_mech1.js (chapters א-ה) and check_mech2.js (chapters ו-י):
//  - every section confronts a misconception in a .mis-block box;
//  - the quiz key does not give itself away by length: it is the strictly
//    longest option in at most 30 % of questions (chance is 25 %), and never
//    more than 1.3 times (and 3+ characters) as long as the next option;
//  - every problem hint guides in words (a sentence in the page's language, then the formula
//    if useful), is shorter than the step's explanation, and does not end in
//    the step's own answer;
//  - no number is glued to its unit ("5m", "20N") in anything a student reads.
// Lengths are measured on the rendered text, as the student sees it.
const { LANG } = require('./_lang.js');
module.exports = async function mechLearning(p, chapterIds, t) {
  const r = await p.evaluate(([ids, WSRC]) => {
    const txt = h => { const d = document.createElement('template'); d.innerHTML = String(h || '').replace(/<\/(div|p|li|td|th)>/g, ' </$1>'); return d.content.textContent.replace(/\s+/g, ' ').trim(); };
    const heb = s => (s.match(new RegExp(WSRC, 'g')) || []).length;   // words of the page's language
    const glue = /(\d)(km\/h|m\/s²|m\/s|kg|km|cm|mm|Hz|rad|J|W|N|s|m)(?![A-Za-zא-ת₀-ₜₐ-ₜ₀-₉])/;
    const o = { secs: 0, noMis: [], q: 0, longest: 0, loud: [], weakHint: [], longHint: [], answerHint: [], glued: [] };
    for (const ch of MECH_CHAPTERS) {
      if (!ids.includes(ch.id)) continue;
      for (const se of ch.sections) {
        const k = ch.id + '.' + se.id, c = CONTENT[k]; if (!c) continue;
        o.secs++;
        if (!/class="mis-block"/.test((c.theory && c.theory.html) || '')) o.noMis.push(k);
        (c.quiz || []).forEach((q, i) => {
          const L = q.opts.map(x => txt(x).length), key = L[q.correct], next = Math.max(...L.filter((_, j) => j !== q.correct));
          o.q++;
          if (key > next) o.longest++;
          if (key > 1.3 * next && key - next >= 3) o.loud.push(k + ' #' + i + ' ' + key + '/' + next);
        });
        const strs = [c.theory && c.theory.html, c.theory && c.theory.enrich && c.theory.enrich.html, c.sim && c.sim.desc];
        if (c.example) { strs.push(c.example.text); (c.example.steps || []).forEach(s => strs.push(s.q, s.a)); }
        (c.quiz || []).forEach(q => strs.push(q.q, q.explain, q.hint, ...q.opts));
        if (c.problem) {
          strs.push(c.problem.text);
          c.problem.steps.forEach((s, i) => {
            strs.push(s.q, s.nudge, s.hint, s.explain);
            const h = txt(s.hint), x = txt(s.explain);
            if (heb(h) < 3) o.weakHint.push(k + ' #' + i + ': ' + h);
            if (h.length >= x.length) o.longHint.push(k + ' #' + i + ' ' + h.length + '/' + x.length);
            const a = parseFloat(s.answer), m = h.match(/=\s*(−|-)?([\d.]+)\s*[A-Za-z/²°]*\s*$/);
            if (isFinite(a) && m && Math.abs(parseFloat((m[1] ? '-' : '') + m[2]) - a) <= Math.abs(a) * 0.02 + 1e-9) o.answerHint.push(k + ' #' + i + ': ' + h);
          });
        }
        strs.forEach(h => { if (!h) return; const s = txt(h), m = s.match(glue); if (m) o.glued.push(k + ': …' + s.slice(Math.max(0, m.index - 12), m.index + 10) + '…'); });
      }
    }
    return o;
  }, [chapterIds, LANG === 'he' ? '[א-ת]{2,}' : '[A-Za-zÀ-ɏ]{2,}']);
  t('every section has a misconception box (' + r.secs + ' sections)', r.noMis.length === 0, r.noMis.join(', ') || 'all');
  t('the quiz key is the longest option in ≤ 30 % of questions', r.longest <= 0.3 * r.q, r.longest + '/' + r.q);
  t('no quiz key is more than 1.3× (and 3+ characters) longer than the next option', r.loud.length === 0, r.loud.join('; ') || 'none');
  t('every problem hint says in words what to do', r.weakHint.length === 0, r.weakHint.join(' | ') || 'all');
  t('every problem hint is shorter than its explanation', r.longHint.length === 0, r.longHint.join('; ') || 'all');
  t('no hint ends in the step\'s own answer', r.answerHint.length === 0, r.answerHint.join(' | ') || 'none');
  t('no number glued to its unit', r.glued.length === 0, r.glued.join(' | ') || 'none');
};
