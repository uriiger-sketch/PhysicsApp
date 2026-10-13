// The words a test reads, in the language of the page under test.
//
// Tests check the physics by reading the app's own words: a canvas readout
// ("זווית עלים: 34°"), a button label, a hint. Run on a language edition
// (APP_FILE=physics_game_en.html), the same words are that edition's. L(he)
// returns the edition's text for a piece of Hebrew, from i18n/<lang>/*.json:
//
//   L('זווית עלים: ')            the whole unit, or the literal piece of a unit
//                                 that ends at the same placeholder ('Leaf angle: ')
//   LR('זווית עלים: ')           the same, escaped for a RegExp
//   WORD                         a word of the page's language (3+ letters)
//   WORDS                        every word of the page's language (a global RegExp)
//   LANG                         'he' for the master, else the edition's code
//
// On the master every function returns its Hebrew unchanged.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let LANG = 'he';
if (process.env.APP_FILE) {
  const base = path.basename(process.env.APP_FILE);
  for (const d of fs.readdirSync(path.join(ROOT, 'i18n'))) {
    const f = path.join(ROOT, 'i18n', d, 'config.json');
    if (!fs.existsSync(f)) continue;
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (c.file === base) LANG = c.lang;
  }
  // a scratch build (I18N_OUT=…/en.html) is named by its language
  if (LANG === 'he' && /^[a-z]{2}\.html$/.test(base) && fs.existsSync(path.join(ROOT, 'i18n', base.slice(0, 2)))) LANG = base.slice(0, 2);
}

let UNITS = null;
function units() {
  if (UNITS) return UNITS;
  UNITS = [];
  const dir = path.join(ROOT, 'i18n', LANG);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'config.json') continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const u of Object.values(d.units || {})) if ((u[LANG] || '').trim()) UNITS.push([u.he, u[LANG]]);
  }
  return UNITS;
}

const PH = /⟦(\d+)⟧/g;
// the literal piece of a text that ends at placeholder k (or at the end: k = null)
function pieceBefore(text, k) {
  const parts = text.split(/(⟦\d+⟧)/);
  for (let i = 1; i < parts.length; i += 2) if (parts[i] === '⟦' + k + '⟧') return parts[i - 1];
  return k === null ? parts[parts.length - 1] : null;
}

function L(he) {
  if (LANG === 'he') return he;
  const U = units();
  for (const [h, t] of U) if (h === he) return t;
  // a literal piece of a longer unit: find the placeholder that follows it
  // in the Hebrew, and take the piece before the same placeholder in the edition
  for (const [h, t] of U) {
    const parts = h.split(/(⟦\d+⟧)/);
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i] !== he && parts[i].trim() !== he.trim()) continue;
      const next = parts[i + 1] ? +parts[i + 1].replace(/\D/g, '') : null;
      const piece = pieceBefore(t, next);
      if (piece !== null) return parts[i] === he ? piece : piece.trim();
    }
  }
  throw new Error(`tests/_lang.js: no ${LANG} text for «${he}»`);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LR = (he) => esc(L(he));
const WORD = LANG === 'he' ? /[א-ת]{3,}/ : /[A-Za-zÀ-ɏ]{3,}/;
const WORDS = LANG === 'he' ? /[א-ת]+/g : /[A-Za-zÀ-ɏ]+/g;

module.exports = { L, LR, WORD, WORDS, LANG };
