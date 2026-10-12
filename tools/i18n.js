#!/usr/bin/env node
// Languages for the physics app.
//
// physics_game_v28.html (Hebrew) is the one source of code and physics. Every
// other language is a set of translations, i18n/<lang>/*.json, from which this
// tool generates that language's app file. A fix to the code or the physics is
// made once, in the master, and reaches every language on the next build.
//
//   node tools/i18n.js extract <lang>   add every Hebrew text of the master to
//                                       i18n/<lang>/*.json (translations kept;
//                                       texts that left the master -> _stale)
//   node tools/i18n.js check <lang>     validate every translation; exit 1 on an
//                                       error (and on a missing one with --strict)
//   node tools/i18n.js build <lang>     write the language's app file
//   node tools/i18n.js stats <lang>     what is translated, per file
//   node tools/i18n.js todo <lang> <area> [n] [--all] [--from=k]
//                                       the next units to translate (or review)
//   node tools/i18n.js set <lang> <patch.json> [--reviewed=tag]
//                                       save a batch {id: translation}, validated
//
// What a translation unit is. The parser (acorn, vendored in tools/vendor)
// finds every JavaScript string that holds Hebrew. A whole expression that
// produces text -- 'a' + tex('x') + 'b', or a template literal with ${...} --
// is ONE unit, so a translator sees whole sentences. Everything inside it that
// is not literal text (a formula M(...)/tex(...), a number, a variable, a
// nested expression) becomes a placeholder ⟦0⟧, ⟦1⟧, ... that the translator
// may move but never changes: formulas and numbers computed by the code cannot
// be damaged by a translation. A string the code itself compares or searches
// for (=== 'עברית', .indexOf('...'), a switch case, an object key) is logic,
// not display text: it is listed by `check` and never translated.
//
// Guards checked on every translation (check):
//   error  the placeholders differ, Hebrew is left in it, the HTML tags differ
//   warn   the numbers differ, the maths symbols differ
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require('./vendor/acorn.js');

const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(ROOT, 'physics_game_v28.html');
const HEB = /[\u0590-\u05FF]/;
const PH = (i) => '⟦' + i + '⟧';
const PH_RE = /⟦(\d+)⟧/g;

// ── languages ────────────────────────────────────────────────────────────
function langConf(lang) {
  const f = path.join(ROOT, 'i18n', lang, 'config.json');
  if (!fs.existsSync(f)) die(`no ${path.relative(ROOT, f)} -- create it first (see i18n/README.md)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function die(m) { console.error('i18n: ' + m); process.exit(2); }

// ── the master, split into its parts ─────────────────────────────────────
function readMaster() {
  const src = fs.readFileSync(MASTER, 'utf8');
  const open = '<script type="text/x-physics-app" id="app-js">';
  const a = src.indexOf(open);
  if (a < 0) die('app script not found in the master');
  const s = a + open.length, e = src.indexOf('</script>', s);
  return { src, before: src.slice(0, s), code: src.slice(s, e), after: src.slice(e) };
}

// ── units in the code ────────────────────────────────────────────────────
const LOGIC_METHODS = new Set(['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith',
  'replace', 'replaceAll', 'split', 'match', 'matchAll', 'search', 'test']);
const isStr = (n) => n && n.type === 'Literal' && typeof n.value === 'string';
const isTpl = (n) => n && n.type === 'TemplateLiteral';
const isPiece = (n) => isStr(n) || isTpl(n);

function children(n) {
  const out = [];
  for (const k in n) {
    if (k === 'loc' || k === 'range' || k === 'start' || k === 'end') continue;
    const v = n[k];
    if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') out.push(x); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
}

// '+' chain -> its operands in order; null when it is not a string concatenation.
// Operands before the first piece of text are one placeholder: 1+2+'x' is "3x".
function concatOps(n) {
  if (!(n.type === 'BinaryExpression' && n.operator === '+')) return null;
  const spine = []; let cur = n;
  while (cur.type === 'BinaryExpression' && cur.operator === '+') { spine.push(cur); cur = cur.left; }
  spine.reverse();                       // spine[0] is the innermost (leftmost) '+'
  const ops = [cur].concat(spine.map(s => s.right));
  const f = ops.findIndex(isPiece);
  if (f < 0) return null;
  if (f <= 1) return ops;                // a piece at 0 or 1: nothing numeric can come first
  // ops[0..f-1] fold into the subtree spine[f-2] (= ops[0] + ... + ops[f-1])
  return [spine[f - 2]].concat(ops.slice(f));
}

function pieceParts(n, parts) {          // text pieces and placeholder nodes, in order
  if (isStr(n)) parts.push({ t: n.value });
  else if (isTpl(n)) {
    n.quasis.forEach((q, i) => {
      parts.push({ t: q.value.cooked == null ? q.value.raw : q.value.cooked });
      if (i < n.expressions.length) parts.push({ e: n.expressions[i] });
    });
  } else parts.push({ e: n });
}

function unitOf(n) {                     // -> {parts} when n is a text expression
  if (isStr(n) || isTpl(n)) { const parts = []; pieceParts(n, parts); return parts; }
  const ops = concatOps(n);
  if (!ops) return null;
  const parts = [];
  for (const o of ops) pieceParts(o, parts);
  return parts;
}

function scanCode(code, base) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const units = [], logic = [];
  const lineOf = (pos) => base + code.slice(0, pos).split('\n').length - 1;

  function ctxPath(stack) {              // CONTENT['kinematics.x'].quiz[0].q, simFoo, runAnim('anim-x') ...
    let out = '', top = '';
    for (let i = 0; i < stack.length; i++) {
      const s = stack[i], p = stack[i - 1];
      if (s.type === 'FunctionDeclaration' && s.id && !top) top = s.id.name;
      if (s.type === 'VariableDeclarator' && s.id && s.id.name && !top) top = s.id.name;
      if (s.type === 'CallExpression' && s.callee && s.callee.name === 'runAnim' && isStr(s.arguments[0]) && !top) top = "runAnim('" + s.arguments[0].value + "')";
      if (s.type === 'AssignmentExpression' && !top && s.left && s.left.type === 'MemberExpression' && s.left.property) top = (s.left.object.name || '') + '.' + (s.left.property.name || s.left.property.value);
      if (p && p.type === 'Property' && p.value === s && top) {
        const k = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        out += /^[A-Za-z_$][\w$]*$/.test(k) ? '.' + k : "['" + k + "']";
      }
      if (p && p.type === 'ArrayExpression' && top) out += '[' + p.elements.indexOf(s) + ']';
    }
    return (top || '(top)') + out;
  }

  function isLogicUse(n, parent, gp) {
    if (!parent) return false;
    if (parent.type === 'Property' && parent.key === n && !parent.computed) return true;
    if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in'].includes(parent.operator)) return true;
    if (parent.type === 'SwitchCase' && parent.test === n) return true;
    if (parent.type === 'CallExpression' && parent.arguments[0] === n && parent.callee.type === 'MemberExpression' &&
        parent.callee.property && LOGIC_METHODS.has(parent.callee.property.name)) return true;
    if ((parent.type === 'NewExpression' || parent.type === 'CallExpression') && parent.callee.name === 'RegExp') return true;
    if (parent.type === 'TaggedTemplateExpression') return true;
    return false;
  }

  function walk(n, stack) {
    const parent = stack[stack.length - 1], gp = stack[stack.length - 2];
    const parts = unitOf(n);
    if (parts && parts.some(p => p.t !== undefined && HEB.test(p.t))) {
      if (isLogicUse(n, parent, gp)) {
        logic.push({ line: lineOf(n.start), at: ctxPath(stack.concat(n)), text: parts.map(p => p.t !== undefined ? p.t : '…').join('') });
      } else {
        let i = 0, text = '', phs = [];
        for (const p of parts) {
          if (p.t !== undefined) text += p.t;
          else { text += PH(i++); phs.push(p.e); }
        }
        units.push({ node: n, start: n.start, end: n.end, text, phs, line: lineOf(n.start), at: ctxPath(stack.concat(n)) });
        // inner texts live inside the placeholders
        for (const e of phs) walk(e, stack.concat(n));
        return;
      }
    }
    for (const c of children(n)) walk(c, stack.concat(n));
  }
  walk(ast, []);
  return { units, logic };
}

// ── units in the HTML around the scripts ─────────────────────────────────
// <title>, <meta content=...>, the noscript message, the loading line.
function htmlUnits(html) {
  const out = [];
  const re = /(content|title|aria-label|alt)="([^"]*[\u0590-\u05FF][^"]*)"|>([^<>]*[\u0590-\u05FF][^<>]*)</g;
  let m;
  while ((m = re.exec(html))) {
    const text = m[2] !== undefined ? m[2] : m[3];
    out.push({ text: text.trim(), raw: text });
  }
  return out;
}
function nonScriptChunks(s) {            // the HTML outside <script> and <style>
  const out = []; const re = /<(script|style)\b[\s\S]*?<\/\1>/g; let last = 0, m;
  while ((m = re.exec(s))) { out.push([last, m.index]); last = m.index + m[0].length; }
  out.push([last, s.length]);
  return out;
}

// ── area of a unit (which translation file it lives in) ──────────────────
const MECH_A = new Set(['kinematics', 'vectors', 'forces', 'newton2', 'forces2']);
const OPT_A = new Set(['opt-light', 'opt-reflection', 'opt-refraction']);
function areaOf(u, topIdx) {
  const at = u.at;
  let m = /^CONTENT\['([^.']+)\./.exec(at);
  if (m) return MECH_A.has(m[1]) ? 'content-mechanics-1' : 'content-mechanics-2';
  m = /^OPTICS_CONTENT\['([^.']+)\./.exec(at);
  if (m) return OPT_A.has(m[1]) ? 'content-optics-1' : 'content-optics-2';
  if (/^OPTICS_CONTENT\b/.test(at)) return 'content-optics-1';
  if (/^ELECTRO_CONTENT\b/.test(at)) return 'content-electro';
  if (/^DC_CONTENT\b/.test(at)) return 'content-circuits';
  if (/^MAG_CONTENT\b/.test(at)) return 'content-magnetism';
  if (/^[A-Z]+_CHAPTERS\b/.test(at)) return 'chapters';
  if (/^(FORMULA_DATA|FORMULA_BY_SUBJECT)\b/.test(at)) return 'formulas';
  if (/^APP_CHANGELOG\b/.test(at)) return 'changelog';
  return topIdx(u.line);
}

// code regions by the master's own section markers: the first marker at or
// above a line decides (sims and animations are grouped by subject)
function codeRegions(code, base) {
  const marks = [
    [/^\/\/ SIMULATION REGISTRY/m, 'ui'],
    [/^\/\/ CH4 SIM 1: MULTI-FREEFALL|^\/\/ CH2 SIM 1: INERTIA/m, 'sims-mechanics'],
    [/^\/\/ OPTICS SIMULATIONS/m, 'sims-optics'],
    [/^\/\/ ─── shared helpers ─/m, 'ui'],
    [/^\/\/ ── Energy-track model/m, 'sims-mechanics'],
    [/^\/\/ DC ANIM:/m, 'sims-circuits'],
    [/^\/\/ CH5 THEORY ANIMATIONS/m, 'sims-mechanics'],
    [/^\/\/ ── OPTICS THEORY MINI-ANIMS/m, 'sims-optics'],
    [/^\/\/ ENERGY CHAPTER ANIMATIONS/m, 'sims-mechanics'],
    [/^\/\/ ═══ ELECTROSTATICS THEORY ANIMATIONS/m, 'sims-electro'],
    [/^\/\/ ==== MAGNETISM:CODE BEGIN/m, 'sims-magnetism'],
    [/^\/\/ ==== MAGNETISM:CODE END/m, 'sims-electro'],
    [/^\/\/ ── a small kit shared by the DC circuit simulations/m, 'sims-circuits'],
    [/^\/\/ RENDER ENGINE/m, 'ui'],
    [/^\/\/ PHONE SENSOR LABS/m, 'sensors'],
    [/^\/\/ EVENT HANDLERS/m, 'ui'],
  ];
  const at = [];
  for (const [re, area] of marks) {
    const r = new RegExp(re.source, 'gm'); let m;
    while ((m = r.exec(code))) at.push([base + code.slice(0, m.index).split('\n').length - 1, area]);
  }
  at.sort((x, y) => x[0] - y[0]);
  return (line) => { let a = 'ui'; for (const [l, ar] of at) { if (l <= line) a = ar; else break; } return a; };
}

const CSS_CONTENT = /content:\s*(['"])((?:(?!\1)[^\\]|\\.)*[\u0590-\u05FF](?:(?!\1)[^\\]|\\.)*)\1/g;
function cssTexts(html) {
  const out = []; const re = /<style\b[^>]*>([\s\S]*?)<\/style>/g; let m;
  while ((m = re.exec(html))) { const css = m[1].replace(/\/\*[\s\S]*?\*\//g, ''); let c; const r = new RegExp(CSS_CONTENT.source, 'g'); while ((c = r.exec(css))) out.push(c[2]); }
  return out;
}
const idOf = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);

function collect() {
  const M = readMaster();
  const base = M.before.split('\n').length;            // line of the first code line
  const { units, logic } = scanCode(M.code, base);
  const region = codeRegions(M.code, base);
  const byId = new Map();
  for (const u of units) {
    u.id = idOf(u.text);
    u.area = areaOf(u, region);
    const e = byId.get(u.id);
    if (e) { e.n++; if (e.at.length < 3) e.at.push(u.at + '  L' + u.line); }
    else byId.set(u.id, { id: u.id, area: u.area, he: u.text, n: 1, at: [u.at + '  L' + u.line],
      ph: u.phs.map(p => M.code.slice(p.start, p.end).replace(/\s+/g, ' ').slice(0, 90)) });
  }
  const html = [];
  for (const part of [M.before, M.after]) for (const [a, b] of nonScriptChunks(part)) for (const h of htmlUnits(part.slice(a, b))) html.push(h);
  for (const h of html) {
    const id = idOf(h.text);
    if (!byId.has(id)) byId.set(id, { id, area: 'ui', he: h.text, n: 1, at: ['(html head/body)'], ph: [] });
  }
  // generated text in the stylesheet: content:'נתון: '
  for (const t of cssTexts(M.before + M.after)) {
    const id = idOf(t);
    if (!byId.has(id)) byId.set(id, { id, area: 'ui', he: t, n: 1, at: ['(CSS content)'], ph: [] });
  }
  return { M, units, logic, byId, html };
}

// the master's units, cached by its hash (check/stats/todo/set need no AST)
function units() {
  const src = fs.readFileSync(MASTER, 'utf8');
  const h = crypto.createHash('sha1').update(src).update(fs.readFileSync(__filename)).digest('hex').slice(0, 16);
  const dir = path.join(ROOT, 'i18n', '.cache'), f = path.join(dir, 'units-' + h + '.json');
  if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); return { byId: new Map(d.units.map(u => [u.id, u])), logic: d.logic }; }
  const { byId, logic } = collect();
  fs.mkdirSync(dir, { recursive: true });
  for (const x of fs.readdirSync(dir)) if (x.startsWith('units-')) try { fs.unlinkSync(path.join(dir, x)); } catch (e) {}
  fs.writeFileSync(f, JSON.stringify({ units: [...byId.values()], logic }));
  return { byId, logic };
}

// ── translation files ────────────────────────────────────────────────────
function loadLang(lang) {
  const dir = path.join(ROOT, 'i18n', lang);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'config.json' && f !== 'glossary.json') : [];
  const tr = new Map(), fileOf = new Map(), data = {};
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    data[f] = d;
    for (const [id, e] of Object.entries(d.units || {})) { tr.set(id, e); fileOf.set(id, f); }
  }
  return { dir, files, tr, fileOf, data };
}

function cmdExtract(lang) {
  langConf(lang);
  const { byId, logic } = collect();
  const L = loadLang(lang);
  const out = {};
  for (const e of byId.values()) {
    const f = e.area + '.json';
    const old = L.tr.get(e.id);
    (out[f] = out[f] || {})[e.id] = {
      he: e.he,
      [lang]: old ? (old[lang] || '') : '',
      ...(old && old.keep ? { keep: true } : {}),
      ...(old && old.note ? { note: old.note } : {}),
      ...(old && old.reviewed ? { reviewed: old.reviewed } : {}),
      at: e.at, ...(e.n > 1 ? { n: e.n } : {}), ...(e.ph.length ? { ph: e.ph } : {}),
    };
  }
  // texts that left the master keep their translation for reuse
  const stale = {};
  for (const [id, e] of L.tr) if (!byId.has(id) && (e[lang] || '').trim()) stale[id] = { he: e.he, [lang]: e[lang] };
  for (const f of Object.keys(out).sort()) {
    const ids = Object.keys(out[f]).sort((a, b) => out[f][a].at[0].localeCompare(out[f][b].at[0], 'en', { numeric: true }));
    const units = {}; for (const id of ids) units[id] = out[f][id];
    const prevStale = (L.data[f] && L.data[f]._stale) || {};
    const body = { _about: `Translations ${lang} for the area "${f.replace('.json', '')}". Edit only the "${lang}" values (and "note"). Generated keys: he, at, n, ph. See i18n/README.md.`, units };
    const st = {}; for (const [id, e] of Object.entries(Object.assign({}, prevStale, stale))) if (!byId.has(id) && (L.fileOf.get(id) === f || prevStale[id])) st[id] = e;
    if (Object.keys(st).length) body._stale = st;
    fs.writeFileSync(path.join(L.dir, f), JSON.stringify(body, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(L.dir, '_logic.txt'), '# Hebrew strings the code compares or searches for: logic, not display text.\n# They are never translated; if one is shown to the learner, change the code.\n' +
    logic.map(l => `L${l.line}\t${l.at}\t${l.text.replace(/\s+/g, ' ').slice(0, 100)}`).join('\n') + '\n');
  const n = byId.size, done = [...byId.keys()].filter(id => (L.tr.get(id) || {})[lang]).length;
  console.log(`i18n extract ${lang}: ${n} units (${done} translated), ${logic.length} logic strings listed in i18n/${lang}/_logic.txt`);
}

// ── guards ───────────────────────────────────────────────────────────────
const tagsOf = (s) => (s.match(/<\/?[a-zA-Z][a-zA-Z0-9-]*/g) || []).map(t => t.toLowerCase()).sort().join(' ');
const nums = (s) => (s.replace(PH_RE, ' ').match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '.')).sort().join(' ');
const maths = (s) => (s.replace(PH_RE, ' ').match(/[=≈≠<>≤≥±×·÷√∞∑∫∂∆Δ∇θλμνπρσφωΩαβγδεηκτψ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺₀₁₂₃₄₅₆₇₈₉ₐₑₒₓᵢₙₘₖₚₛₜₕₗⱼᵣᵤᵥ→←⇒⇔∝∥⊥]/g) || []).sort().join('');
const phs = (s) => (s.match(PH_RE) || []).sort().join('');
// attributes that are not reading text (class, style, onclick, id, data-*,
// href...) must come through byte for byte: they are code
const TEXT_ATTRS = new Set(['title', 'aria-label', 'alt', 'placeholder']);
const attrsOf = (s) => (s.match(/<[a-zA-Z][^<>]*>/g) || []).map(tag => (tag.match(/[a-zA-Z_:][-a-zA-Z0-9_:.]*\s*=\s*("[^"]*"|'[^']*')/g) || [])
  .filter(a => !TEXT_ATTRS.has(a.split('=')[0].trim().toLowerCase()))).flat().sort().join(' ');

function validate(e, lang) {
  const t = e[lang], errs = [], warns = [];
  if (e.keep) return { errs, warns };
  if (phs(t) !== phs(e.he)) errs.push(`placeholders ${phs(e.he) || '∅'} → ${phs(t) || '∅'}`);
  if (HEB.test(t)) errs.push('Hebrew left in the translation');
  if (tagsOf(t) !== tagsOf(e.he)) errs.push(`HTML tags differ: [${tagsOf(e.he)}] → [${tagsOf(t)}]`);
  else { const A = attrsOf(e.he).replace(/dir="rtl"/g, 'dir="ltr"').replace(/direction:\s*rtl/g, 'direction:ltr'), B = attrsOf(t).replace(/dir="rtl"/g, 'dir="ltr"').replace(/direction:\s*rtl/g, 'direction:ltr');
    if (A !== B) errs.push('an HTML attribute changed (class, style, onclick... must stay exactly as in the Hebrew)'); }
  if (nums(t) !== nums(e.he)) warns.push(`numbers ${nums(e.he)} → ${nums(t)}`);
  if (maths(t) !== maths(e.he)) warns.push(`maths symbols ${maths(e.he)} → ${maths(t)}`);
  return { errs, warns };
}

function cmdCheck(lang, strict) {
  langConf(lang);
  const { byId, logic } = units();
  const L = loadLang(lang);
  let missing = 0, nerr = 0, nwarn = 0; const lines = [];
  for (const e of byId.values()) {
    const t = L.tr.get(e.id);
    if (!t || !(t[lang] || '').trim()) { if (!(t && t.keep)) missing++; continue; }
    const { errs, warns } = validate(Object.assign({}, t, { he: e.he }), lang);
    nerr += errs.length; nwarn += warns.length;
    for (const x of errs) lines.push(`ERROR ${L.fileOf.get(e.id)} ${e.id}: ${x}   «${e.he.slice(0, 60)}»`);
    if (!process.argv.includes('--quiet')) for (const x of warns) lines.push(`warn  ${L.fileOf.get(e.id)} ${e.id}: ${x}   «${e.he.slice(0, 60)}»`);
  }
  console.log(lines.join('\n'));
  console.log(`i18n check ${lang}: ${byId.size} units, ${missing} missing, ${nerr} errors, ${nwarn} warnings, ${logic.length} logic strings (never translated)`);
  process.exit(nerr || (strict && missing) ? 1 : 0);
}

function cmdStats(lang) {
  const { byId } = units();
  const L = loadLang(lang);
  const per = {};
  for (const e of byId.values()) {
    const f = e.area; per[f] = per[f] || { units: 0, words: 0, done: 0, reviewed: 0 };
    per[f].units++; per[f].words += (e.he.match(/[\u05D0-\u05EA]+/g) || []).length;
    const t = L.tr.get(e.id); if (t && (t[lang] || t.keep)) per[f].done++; if (t && t.reviewed) per[f].reviewed++;
  }
  let T = { units: 0, words: 0, done: 0, reviewed: 0 };
  for (const [f, s] of Object.entries(per).sort()) { console.log(`${f.padEnd(22)} ${String(s.units).padStart(5)} units ${String(s.words).padStart(6)} Hebrew words   translated ${s.done}   reviewed ${s.reviewed}`); for (const k in T) T[k] += s[k]; }
  console.log(`${'TOTAL'.padEnd(22)} ${String(T.units).padStart(5)} units ${String(T.words).padStart(6)} Hebrew words   translated ${T.done}   reviewed ${T.reviewed}`);
}

// todo <lang> <area> [n] [--all]: the next untranslated units of an area, as
// compact JSON a translator works from (id, he, ph, at); --all includes the
// translated ones (for review), with their current translation
function cmdTodo(lang) {
  const area = process.argv[4], n = +(process.argv[5] || 40), all = process.argv.includes('--all');
  const from = +(process.argv.find(a => a.startsWith('--from=')) || '--from=0').slice(7);
  if (!area) die('usage: todo <lang> <area> [n] [--all] [--from=k]');
  const { byId } = units(); const L = loadLang(lang);
  const list = [...byId.values()].filter(e => e.area === area).filter(e => { const t = L.tr.get(e.id); return all || !(t && ((t[lang] || '').trim() || t.keep)); });
  const out = list.slice(from, from + n).map(e => { const t = L.tr.get(e.id) || {}; const o = { id: e.id, he: e.he };
    if (e.ph && e.ph.length) o.ph = e.ph; o.at = e.at[0]; if (all) o[lang] = t[lang] || ''; if (t.note) o.note = t.note; return o; });
  console.log(JSON.stringify(out, null, 1));
  console.error(`(${list.length} ${all ? 'units' : 'untranslated'} in ${area}; showing ${from}–${from + out.length})`);
}
// set <lang> <patch.json> [--reviewed=physics|language]: merge {id: translation}
// (or {id: {"<lang>": ..., "note": ...}}) into the right area files, validate it
function cmdSet(lang) {
  const pf = process.argv[4]; if (!pf) die('usage: set <lang> <patch.json> [--reviewed=tag]');
  const rv = (process.argv.find(a => a.startsWith('--reviewed=')) || '').slice(11);
  const patch = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const { byId } = units(); const L = loadLang(lang);
  let ok = 0, bad = 0; const touched = new Set();
  for (const [id, v] of Object.entries(patch)) {
    const e = byId.get(id), f = L.fileOf.get(id);
    if (!e || !f) { console.log(`ERROR ${id}: no such unit (run extract?)`); bad++; continue; }
    const val = typeof v === 'string' ? { [lang]: v } : v;
    const u = L.data[f].units[id];
    const cand = Object.assign({}, u, val, { he: e.he });
    const { errs, warns } = validate(cand, lang);
    if (errs.length) { console.log(`ERROR ${id}: ${errs.join('; ')}   «${e.he.slice(0, 60)}»`); bad++; continue; }
    for (const w of warns) console.log(`warn  ${id}: ${w}   «${e.he.slice(0, 60)}»`);
    Object.assign(u, val);
    if (rv) { u.reviewed = Array.from(new Set([...(u.reviewed || []), rv])); }
    touched.add(f); ok++;
  }
  for (const f of touched) fs.writeFileSync(path.join(L.dir, f), JSON.stringify(L.data[f], null, 1) + '\n');
  console.log(`i18n set ${lang}: ${ok} saved, ${bad} refused`);
  process.exit(bad ? 1 : 0);
}

// ── build ────────────────────────────────────────────────────────────────
function escTpl(s) { return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/<\/script/gi, '<\\/script'); }

// the master's own quiz identities, computed by the master itself
async function qidTable() {
  let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage();
    await p.route(/^https?:/, r => r.abort());
    await p.goto('file://' + MASTER);
    await p.waitForFunction(() => typeof _qidsOf === 'function' && typeof CONTENT === 'object', null, { timeout: 30000 });
    return await p.evaluate(() => { const o = {}; for (const k of Object.keys(CONTENT)) { const c = CONTENT[k]; if (c && Array.isArray(c.quiz) && c.quiz.length) o[k] = _qidsOf(k); } return o; });
  } finally { await b.close(); }
}

async function cmdBuild(lang) {
  const C = langConf(lang);
  const { M, units } = collect();
  const L = loadLang(lang);
  const ltr = C.dir === 'ltr';
  const dirFix = (s) => (ltr ? s.replace(/dir="rtl"/g, 'dir="ltr"').replace(/dir='rtl'/g, "dir='ltr'").replace(/direction:\s*rtl/g, 'direction:ltr') : s)
    .replace(/lang="he"/g, 'lang="' + lang + '"');
  // I18N_PSEUDO=1: every untranslated text is transliterated into Latin
  // letters -- a test build that shows whether any Hebrew escapes extraction
  const PSEUDO = process.env.I18N_PSEUDO === '1';
  const pseudo = (s) => s.replace(/[\u0591-\u05C7]/g, '').replace(/[\u05D0-\u05EA]/g, (c) => 'abgdhvzhtiykklmmnnsappcckrst'[c.charCodeAt(0) - 0x05D0] || 'x').replace(/״/g, '"').replace(/׳/g, "'").replace(/\u05BE/g, '-');
  const tr = (u) => {
    const t = L.tr.get(u.id || idOf(u.text));
    if (PSEUDO && !(t && (t[lang] || '').trim())) return dirFix(pseudo(u.text));
    if (!t) return null;
    if (t.keep) return null;
    const v = (t[lang] || '').trim() ? t[lang] : null;
    if (!v) return null;
    return validate(Object.assign({}, t, { he: u.text }), lang).errs.length ? null : dirFix(v);
  };
  // units sorted by start; emit() rebuilds a range, translating the outermost
  // units in it and recursing into their placeholders
  const sorted = units.slice().sort((a, b) => a.start - b.start || b.end - a.end);
  const code = M.code;
  let fallbacks = 0;
  function emit(start, end, skip) {
    let out = '', pos = start;
    for (const u of sorted) {
      if (u === skip || u.start < pos || u.end > end || u.start < start) continue;
      out += code.slice(pos, u.start);
      out += unitCode(u);
      pos = u.end;
    }
    return out + code.slice(pos, end);
  }
  function unitCode(u) {
    const t = tr(u);
    if (t == null) { fallbacks++; return emit(u.start, u.end, u); }
    let s = '`', last = 0, m; const re = /⟦(\d+)⟧/g;
    while ((m = re.exec(t))) { s += escTpl(t.slice(last, m.index)); const p = u.phs[+m[1]]; s += '${' + emit(p.start, p.end) + '}'; last = m.index + m[0].length; }
    return s + escTpl(t.slice(last)) + '`';
  }
  let newCode = emit(0, code.length, null);
  for (const [from, to] of C.codePatches || []) {
    const n = newCode.split(from).length - 1;
    if (n !== 1) die(`code patch must match exactly once (${n}×): ${from}`);
    newCode = newCode.replace(from, () => to);
  }
  // quiz identity: a learner's saved answers belong to the question, whatever
  // language it is shown in -- the Hebrew identities, by section and position
  const qt = await qidTable();
  if (newCode.split('var _qidCache=new Map();').length !== 2) die('quiz identity anchor not found');
  newCode = newCode.replace('var _qidCache=new Map();', () => 'var _qidCache=new Map();\nvar QID_TABLE=' + JSON.stringify(qt) + ';');
  // the HTML around the code
  const html = (part) => {
    let out = '', last = 0;
    for (const [a, b] of nonScriptChunks(part)) {
      out += part.slice(last, a);
      let chunk = part.slice(a, b);
      chunk = chunk.replace(/((?:content|title|aria-label|alt)=")([^"]*[\u0590-\u05FF][^"]*)(")|(>)([^<>]*[\u0590-\u05FF][^<>]*)(<)/g, (all, a1, t1, z1, a2, t2, z2) => {
        const text = t1 !== undefined ? t1 : t2, e = L.tr.get(idOf(text.trim()));
        let v = e && (e[lang] || '').trim() && !e.keep ? e[lang] : null;
        if (!v && PSEUDO) v = pseudo(text.trim());
        if (!v) { fallbacks++; return all; }
        const pre = text.match(/^\s*/)[0], post = text.match(/\s*$/)[0];
        return t1 !== undefined ? a1 + v.replace(/"/g, '&quot;') + z1 : a2 + pre + v + post + z2;
      });
      out += chunk; last = b;
    }
    return out + part.slice(last);
  };
  const css = (part) => part.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (all, o, body, c) => o + body.replace(new RegExp(CSS_CONTENT.source, 'g'), (a, q, text) => {
    const e = L.tr.get(idOf(text));
    let v = e && (e[lang] || '').trim() && !e.keep ? e[lang] : null;
    if (!v && PSEUDO) v = pseudo(text);
    if (!v) { fallbacks++; return a; }
    return 'content:' + q + v.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q) + q;
  }) + c);
  let before = css(html(M.before)), after = css(html(M.after));
  for (const [from, to] of C.htmlPatches || []) {
    const n = before.split(from).length - 1;
    if (n !== 1) die(`html patch must match exactly once (${n}×): ${from}`);
    before = before.replace(from, () => to);
  }
  const outFile = process.env.I18N_OUT ? path.resolve(process.env.I18N_OUT) : path.join(ROOT, C.file);
  const banner = `<!-- GENERATED by tools/i18n.js from physics_game_v28.html and i18n/${lang}/ -- do not edit by hand -->\n`;
  fs.writeFileSync(outFile, banner + before + newCode + after);
  console.log(`i18n build ${lang}: wrote ${path.relative(ROOT, outFile)} (${fallbacks} texts still in Hebrew)`);
}

const [cmd, lang] = process.argv.slice(2);
if (!cmd || !lang) die('usage: node tools/i18n.js extract|check|build|stats <lang>');
Promise.resolve(({ extract: cmdExtract, check: (l) => cmdCheck(l, process.argv.includes('--strict')), build: cmdBuild, stats: cmdStats, todo: cmdTodo, set: cmdSet }[cmd] || (() => die('unknown command ' + cmd)))(lang))
  .catch(e => { console.error(e); process.exit(2); });
