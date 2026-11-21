// The enrichment labs: the list, every lab, the way in and the way out --
// on whichever edition this is run.
//
//   node tests/check_labs.js                                   (the Hebrew master)
//   APP_FILE=physics_game_en.html node tests/check_labs.js     (an edition)
//   node tests/check_labs.js cherenkov                         (one lab)
//
// The host: the entry in the topic list opens the list of labs, a card opens a
// lab on its own address (#/labs/<id>), "back" and Escape step out, ✕ returns
// to the course, the browser's back button does the same, a link to a lab
// opens it, a link to no lab opens nothing; the card in a section leads to its
// lab and back to that section; the course behind an open lab is inert.
// Every lab, at a desktop's width and a narrow phone's: it draws, throws nothing,
// breaks no rule of the page's CSP, asks no other site for anything, fits the
// screen, follows the theme (or keeps its one dark look), and once closed runs
// nothing. Its language: on the Hebrew master the lab reads right to left and
// every number, unit and formula inside its Hebrew reads left to right, on
// screen; on an edition no Hebrew is left in it -- page text, labels, canvas.
// Its physics: a few numbers of each lab against the textbook.
// The one lab that keeps something (the circuit on the bench): a poisoned
// record runs no script and leaves the lab working; "reset" erases it.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.join(ROOT, 'physics_game_v28.html');
const URL = 'file://' + FILE;
const ONLY = process.argv[2] || '';

let fail = 0, checks = 0;
const t = (name, ok, info) => {
  checks++;
  if (!ok) { fail++; console.log(`   FAIL ${name}${info !== undefined && info !== '' ? ': ' + String(info).slice(0, 300) : ''}`); }
  else if (process.env.VERBOSE) console.log(`   PASS ${name}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// the number a readout opens with: a true minus sign, a no-break space before the unit
const num = x => parseFloat(String(x).replace(/\u2212/g, '-').replace(/\u00A0/g, ' ').trim());
// a quantity with an SI prefix ("−48.0 mW", "2.500 mJ", "0 J") in its base unit
const SI = { f: 1e-15, p: 1e-12, n: 1e-9, '\u00B5': 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9 };
const qty = x => { const m = /^([+-]?[\d.]+)\s*([fpn\u00B5mkMG]?)[A-Za-z\u03A9]\b/.exec(String(x).replace(/\u2212/g, '-').replace(/\u00A0/g, ' ').trim()); return m ? parseFloat(m[1]) * SI[m[2]] : NaN; };

// what every page gets: the welcome tour off, CSP violations and canvas text recorded,
// animation frames counted
const INIT = () => {
  try { localStorage.setItem('phys_onboarded', '1'); } catch (e) {}
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '').slice(0, 40)));
  window.__cv = [];
  for (const m of ['fillText', 'strokeText']) {
    const o = CanvasRenderingContext2D.prototype[m];
    CanvasRenderingContext2D.prototype[m] = function (s, ...a) { try { if (window.__cv.length < 50000) window.__cv.push(String(s)); } catch (e) {} return o.call(this, s, ...a); };
  }
  window.__raf = 0;
  const r = window.requestAnimationFrame;
  window.requestAnimationFrame = function (f) { window.__raf++; return r.call(window, f); };
};

// ── in the page ────────────────────────────────────────────────────────────
// the open lab: Hebrew and placeholders in its text, attributes and canvases
const SCAN = () => {
  const HEB = /[֐-׿]/, host = document.getElementById('xlab-host'), root = host && host.shadowRoot;
  const out = { heb: [], ph: [], words: 0 };
  const scan = (r) => {
    if (!r) return;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue; if (!s || !s.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('style,script')) continue;
      if (HEB.test(s)) out.heb.push('text: ' + s.trim().slice(0, 60));
      if (/⟦\d+⟧/.test(s)) out.ph.push(s.trim().slice(0, 60));
      out.words += (s.match(/[A-Za-z֐-׿]{3,}/g) || []).length;
    }
    r.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el => {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && HEB.test(v)) out.heb.push(a + ': ' + v.slice(0, 60)); if (v && /⟦\d+⟧/.test(v)) out.ph.push(v.slice(0, 60)); }
    });
  };
  scan(document.getElementById('xlab-overlay')); scan(root);
  (window.__cv || []).forEach(s => { if (HEB.test(s)) out.heb.push('canvas: ' + s.slice(0, 60)); if (/⟦\d+⟧/.test(s)) out.ph.push('canvas: ' + s.slice(0, 60)); });
  out.heb = [...new Set(out.heb)]; out.ph = [...new Set(out.ph)];
  return out;
};
// the open lab: every left-to-right island inside right-to-left text (a
// number with its unit, a formula, a Latin name) must read left to right on
// screen, and a short number-and-unit must not be torn across two lines
const BIDI = () => {
  const host = document.getElementById('xlab-host'), root = host && host.shadowRoot;
  const HEB = /[\u0590-\u05FF]/;
  const A = 'A-Za-z0-9\\u00B5\\u0370-\\u03FF\\u2070-\\u209F\\u00B2\\u00B3\\u00B9\\u00B0%\\u2032\\u2033\\u210F\\u2609\\u2295\\u263E';
  const OPS = '=\\u2248\\u2260<>\\u2264\\u2265\\u00B1\\u00D7\\u00B7*/^_|\\u221A\\u221D\\u2192+\\-\\u2212\\u2013\\u223C~';
  const SEQ = new RegExp('[' + A + '(\\[|<>\\u2264\\u2265\\u2248\\u2212\\u00B1\\u221A][' + A + ' \\u00A0()\\[\\]{}.,:;' + OPS + '\\u2019\']*[' + A + ')\\]|]', 'g');
  const JOINED = new RegExp('[ \\u00A0(' + OPS + ']'), core = new RegExp('[' + A + ']'), out = [];
  document.querySelectorAll('#xlab-overlay details').forEach(d => { d.open = true; });
  if (root) root.querySelectorAll('details').forEach(d => { d.open = true; });
  const scan = (r, where) => {
    if (!r) return;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const s0 = n.nodeValue; if (!s0 || !s0.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('style,script,canvas,svg,option')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let blk = el; while (blk && getComputedStyle(blk).display.indexOf('inline') === 0) blk = blk.parentElement;
      if (!(HEB.test(s0) || (blk && HEB.test(blk.textContent)) || cs.direction === 'rtl')) continue;
      SEQ.lastIndex = 0; let m;
      while ((m = SEQ.exec(s0))) {
        const s = m[0].replace(/[ .,:;]+$/, ''); if (s.length < 3) continue;
        // one word cannot be put out of order; a run that opens with a sign or a comparison can
        if (!JOINED.test(s.slice(1)) && !/^[<>\u2264\u2265\u2248\u2212\u00B1]/.test(s)) continue;
        const rg = document.createRange(), pts = [];
        for (let i = 0; i < s.length; i++) {
          if (!core.test(s[i])) continue;
          rg.setStart(n, m.index + i); rg.setEnd(n, m.index + i + 1);
          const b = rg.getClientRects()[0]; if (b && b.width) pts.push([b.left, b.top]);
        }
        if (pts.length < 2) continue;
        let torn = false, rev = false;
        for (let i = 1; i < pts.length; i++) { if (Math.abs(pts[i][1] - pts[i - 1][1]) > 4) { torn = true; continue; } if (pts[i][0] < pts[i - 1][0] - 0.5) rev = true; }
        if (rev) out.push(where + ' reversed «' + s + '» in «' + s0.trim().slice(0, 50) + '»');
        else if (torn && s.length <= 14 && /^[\d.,\u2212-]+[ \u00A0]*[\u00B0\u00B5A-Za-z\u03A9%]/.test(s)) out.push(where + ' torn «' + s + '»');
      }
    }
  };
  scan(root, 'lab'); scan(document.querySelector('#xlab-overlay .xlab-tasks'), 'tasks'); scan(document.querySelector('#xlab-overlay .xlab-hub'), 'list');
  // the tasks and the list are isolated by the page's own detector: a formula it cut in two
  // ("1 kΩ · 100" + "µ" + "F = 0.1 s") is laid out piece by piece, right to left
  document.querySelectorAll('#xlab-overlay .xlab-tasks .ltr-run, #xlab-overlay .xlab-hub .ltr-run').forEach(a => {
    const tx = a.nextSibling, b = tx && tx.nodeType === 3 ? tx.nextSibling : null;
    if (b && b.nodeType === 1 && b.classList.contains('ltr-run') && !HEB.test(tx.nodeValue) && /[A-Za-z0-9\u00B5\u0370-\u03FF=+\u2212\u00D7\u00B7\/^]/.test(tx.nodeValue))
      out.push('tasks cut «' + a.textContent.slice(-24) + '» [' + tx.nodeValue + '] «' + b.textContent.slice(0, 24) + '»');
  });
  return [...new Set(out)];
};
// the open lab: is anything drawn? (a 2D canvas with more than one colour, or a WebGL canvas with a context)
const PAINTED = () => {
  const root = document.getElementById('xlab-host').shadowRoot; let n = 0, painted = 0, gl = 0;
  root.querySelectorAll('canvas').forEach(c => {
    if (!c.width || !c.height || !c.getClientRects().length) return; n++;
    let g = null; try { g = c.getContext('2d'); } catch (e) {}
    if (!g) { gl++; return; }
    try { const w = Math.min(c.width, 400), h = Math.min(c.height, 300), d = g.getImageData(0, 0, w, h).data, seen = new Set();
      for (let i = 0; i < d.length && seen.size < 3; i += 4 * 37) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]);
      if (seen.size > 1) painted++; } catch (e) {}
  });
  return { n, painted, gl };
};
const STATE = () => {
  const ov = document.getElementById('xlab-overlay'), host = document.getElementById('xlab-host'), body = document.getElementById('xlab-body');
  const app = document.getElementById('app'), root = host && host.shadowRoot, wrap = root && root.querySelector('[dir]');
  return { open: !!(ov && ov.classList.contains('open')), hash: location.hash, lab: host ? host.getAttribute('data-lab') : null,
    title: (document.getElementById('xlab-h') || {}).textContent || '', inert: !!(app && app.hasAttribute('inert')),
    theme: host ? host.getAttribute('data-theme') : null, dir: wrap ? wrap.getAttribute('dir') : null,
    children: root ? root.children.length : 0, cards: document.querySelectorAll('#xlab-overlay .xlab-card').length,
    overflow: body ? body.scrollWidth - body.clientWidth : 0, backHidden: (document.getElementById('xlab-back') || {}).hidden,
    themeHidden: (document.getElementById('xlab-theme') || {}).hidden, tasks: document.querySelectorAll('#xlab-overlay .xlab-tasks li').length,
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : '' };
};

// ── physics: a few numbers of each lab against the textbook ────────────────────
// Each gets the page with its lab open at a desktop's width, and returns [name, ok, info] rows.
const PHYSICS = {
  async cherenkov(p) {
    const rows = [];
    const read = () => p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, g = i => r.getElementById(i).textContent;
      return { light: g('cmpC'), part: g('cmpP'), op: g('cmpOp'), th: g('rTh'), phi: g('rPh'), nb: g('rNB'), max: g('nThMax'), ke: g('rKE'), y: g('rN'), tbl: r.getElementById('tbl').textContent }; });
    const set = (medium, mode, betaU, frac) => p.evaluate(([m, md, u, f]) => { const r = document.getElementById('xlab-host').shadowRoot;
      const s = r.getElementById('medium'); s.value = m; s.dispatchEvent(new Event('change', { bubbles: true }));
      r.querySelector('#segMode [data-v="' + md + '"]').click();
      const b = r.getElementById('beta'); b.value = u; b.dispatchEvent(new Event('input', { bubbles: true }));
      const sc = r.getElementById('scrub'); sc.value = Math.round(f * 1000); sc.dispatchEvent(new Event('input', { bubbles: true })); }, [medium, mode, betaU, frac]);
    // water, constant β = 0.95 (the slider's default position)
    await set('water', 'const', 237, 0.9); await p.waitForTimeout(150);
    let v = await read();
    const n = 1.33335, b = parseFloat(v.part);
    rows.push(['cherenkov: light in water moves at c/n = 0.750c', v.light === '0.750c', v.light]);
    rows.push(['cherenkov: β = 0.95 is past the threshold (">")', near(b, 0.95, 0.002) && v.op === '>', v.part + ' ' + v.op]);
    rows.push(['cherenkov: photon angle obeys cos θc = 1/(nβ)', near(parseFloat(v.th), Math.acos(1 / (n * b)) * 180 / Math.PI, 0.05), v.th]);
    rows.push(['cherenkov: cone half-angle is 90° − θc', near(parseFloat(v.phi) + parseFloat(v.th), 90, 0.02), v.phi + ' + ' + v.th]);
    rows.push(['cherenkov: the widest cone in water is arccos(1/n) = 41.4°', v.max === '41.4°', v.max]);
    rows.push(['cherenkov: about 300 photons per cm in 300–600 nm at β = 0.95 (Frank–Tamm)', near(parseFloat(v.y), 296, 6), v.y]);
    rows.push(['cherenkov: electron threshold in water is 262 keV, proton 480 MeV', /26[1-3]\s*keV/.test(v.tbl) && /48\d(\.\d)?\s*MeV/.test(v.tbl), v.tbl.slice(0, 120)]);
    // below threshold: no cone, no photons
    await set('water', 'const', 0, 0.9); await p.waitForTimeout(150);
    v = await read();
    rows.push(['cherenkov: at β = 0.3 nothing is emitted ("<", no angle, no photons)', v.op === '<' && v.th === '—' && v.y === '0', `${v.op} ${v.th} ${v.y}`]);
    // diamond: a lower threshold, a wider cone
    await set('diamond', 'const', 237, 0.9); await p.waitForTimeout(150);
    v = await read();
    rows.push(['cherenkov: diamond, light at 0.414c and a cone up to 65.6°', v.light === '0.414c' && v.max === '65.6°', v.light + ' ' + v.max]);
    // every motion, every medium: no error (page errors are collected by the caller)
    for (const m of ['water', 'd2o', 'ice', 'silica', 'sf6', 'diamond', 'aerogel', 'air'])
      for (const md of ['accel', 'const', 'stop']) { await set(m, md, 600, 0.5); await p.waitForTimeout(40); }
    await set('water', 'accel', 237, 0.8);
    return rows;
  },

  // The bench is driven the way a learner drives it: a circuit is loaded as text ("Load a circuit
  // from text"), and the numbers are read from the circuit's own summary -- the power of every part
  // and the energy since the reset.
  async 'circuit-bench'(p) {
    const rows = [];
    const load = async (text, wait) => {
      await p.evaluate(tx => { const r = document.getElementById('xlab-host').shadowRoot;
        r.querySelector('#btn-more').click(); r.querySelector('#menu-paste').click();
        r.querySelector('#paste-text').value = tx; r.querySelector('#paste-do').click(); }, text);
      await p.waitForTimeout(wait || 450);
    };
    const read = () => p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, o = { pw: {}, led: [] };
      const bc = r.querySelector('#btn-circuit'); o.bad = bc.classList.contains('bad'); o.loaded = r.querySelector('#modal').hidden;
      r.querySelectorAll('.pw .pwrow').forEach(e => { o.pw[e.querySelector('b').textContent] = e.querySelector('em').textContent; });
      r.querySelectorAll('dl.ledger dd').forEach(e => o.led.push(e.textContent));
      o.sum = [...r.querySelectorAll('.pwsum b')].map(e => e.textContent); return o; });
    const P = (v, id) => qty(v.pw[id]);
    const DIV = c => `battery B1 0,0 0,6 emf=12 r=0\nresistor R1 0,0 5,0 R=1k\nresistor R2 5,0 5,6 R=2k\nwire W1 5,6 0,6\nswitch S1 5,0 9,0 closed=${c}\nresistor R3 9,0 9,6 R=1k\nwire W2 9,6 5,6`;
    // a voltage divider: 12 V across 1 kΩ + 2 kΩ
    await load(DIV(0)); let v = await read();
    rows.push(['circuit bench: a circuit loads from text', v.loaded && Object.keys(v.pw).length === 3, JSON.stringify(v.pw)]);
    rows.push(['circuit bench: divider, 12 V over 1 kΩ + 2 kΩ gives 4 V and 8 V (16 mW and 32 mW)', near(P(v, 'R1'), 0.016, 1e-4) && near(P(v, 'R2'), 0.032, 1e-4) && near(P(v, 'B1'), -0.048, 1e-4), JSON.stringify(v.pw)]);
    rows.push(['circuit bench: what the source delivers is what the parts absorb (Σp = 0)', qty(v.sum[0]) === qty(v.sum[1]) && near(qty(v.sum[0]), 0.048, 1e-5), v.sum.join(' = ')]);
    // the same divider under a 1 kΩ load: Thévenin 8 V behind 667 Ω, so 4.8 V on the load
    await load(DIV(1)); v = await read();
    rows.push(['circuit bench: loaded divider sags to 4.8 V (23.0 mW in the 1 kΩ load)', near(P(v, 'R3'), 4.8 * 4.8 / 1000, 1e-4) && near(P(v, 'R2'), 4.8 * 4.8 / 2000, 1e-4) && near(P(v, 'R1'), 7.2 * 7.2 / 1000, 1e-4), JSON.stringify(v.pw)]);
    // a real battery: ε = 9 V, r = 2.2 Ω; the load's power peaks at R = r, where it is ε²/4r
    const BAT = R => `battery B1 0,0 0,6 emf=9 r=2.2\nwire W1 0,0 8,0\nresistor R1 8,0 8,6 R=${R}\nwire W2 8,6 0,6`;
    const pr = {}; for (const R of [15, 2.2, 1, 5]) { await load(BAT(R), 300); pr[R] = P(await read(), 'R1'); }
    rows.push(['circuit bench: real battery, I = ε/(R + r): 4.11 W in 15 Ω', near(pr[15], 15 * Math.pow(9 / 17.2, 2), 0.006), pr[15]]);
    rows.push(['circuit bench: the load takes the most power when R = r, ε²/4r = 9.20 W', near(pr[2.2], 81 / 8.8, 0.006) && pr[1] < pr[2.2] && pr[5] < pr[2.2], JSON.stringify(pr)]);
    // two ideal batteries of different emf on the same two points: no finite solution, and the bench says so
    const TWO = r => `battery B1 0,0 0,6 emf=9 r=0\nwire W4 0,0 4,0\nbattery B2 4,0 4,6 emf=6 r=${r}\nwire W1 4,6 0,6\nwire W2 4,0 8,0\nresistor R1 8,0 8,6 R=100\nwire W3 8,6 4,6`;
    await load(TWO(0)); v = await read();
    rows.push(['circuit bench: two unequal ideal batteries in parallel are reported as a fault, not solved', v.bad && !Object.keys(v.pw).length, JSON.stringify(v.pw)]);
    await load(TWO(0.5)); v = await read();
    rows.push(['circuit bench: with r = 0.5 Ω in the 6 V battery, 6 A flows backwards through it (54 W absorbed)', !v.bad && near(P(v, 'B2'), 54, 0.06) && near(P(v, 'R1'), 0.81, 0.002) && near(P(v, 'B1'), -54.81, 0.06), JSON.stringify(v.pw)]);
    // a Wheatstone bridge: balanced when R1/R3 = R2/R4, and then nothing flows in the middle
    const BR = R4 => `battery B1 -3,0 -3,8 emf=10 r=0\nwire W1 -3,0 4,0\nwire W2 4,8 -3,8\nresistor R1 4,0 0,4 R=1k\nresistor R2 4,0 8,4 R=1.5k\nresistor R3 0,4 4,8 R=2.2k\nresistor R4 8,4 4,8 R=${R4}\nresistor R5 0,4 8,4 R=100`;
    await load(BR('3.3k')); v = await read(); const balanced = !('R5' in v.pw) && Object.keys(v.pw).length === 5;
    await load(BR('2.2k')); v = await read();
    rows.push(['circuit bench: Wheatstone bridge, no power in the middle arm at R4 = 3.3 kΩ, some at 2.2 kΩ', balanced && P(v, 'R5') > 1e-6, JSON.stringify(v.pw)]);
    // a diode and a resistor: the operating point of the Shockley law on the load line
    await load('battery B1 0,0 0,6 emf=5 r=0\nresistor R1 0,0 4,0 R=220\nwire W1 4,0 8,0\ndiode D1 8,0 8,6 Is=1p n=1 T=300\nwire W2 8,6 0,6'); v = await read();
    let vd = 0.6; for (let k = 0; k < 60; k++) vd = 0.025852 * Math.log((5 - vd) / 220 / 1e-12 + 1);
    rows.push(['circuit bench: diode operating point, i = Is(e^(v/VT) − 1) on the line i = (5 V − v)/R', near(P(v, 'D1'), vd * (5 - vd) / 220, 1e-4) && near(P(v, 'R1'), Math.pow(5 - vd, 2) / 220, 5e-4), JSON.stringify(v.pw) + ' v = ' + vd.toFixed(4)]);
    await load('battery B1 0,0 0,6 emf=5 r=0\nresistor R1 0,0 4,0 R=220\nwire W1 4,0 8,0\ndiode D1 8,6 8,0 Is=1p n=1 T=300\nwire W2 8,6 0,6'); v = await read();
    rows.push(['circuit bench: reversed, the diode passes only its saturation current (5 V × 1 pA)', near(P(v, 'D1'), 5e-12, 1e-13), JSON.stringify(v.pw)]);
    // two capacitors joined by an ideal wire: charge is conserved, half of the energy is not
    await load('capacitor C1 0,0 0,6 C=100u V0=10\nwire W3 0,0 4,0\nwire W1 4,0 8,0\ncapacitor C2 8,0 8,6 C=100u V0=0\nwire W2 8,6 0,6', 700); v = await read();
    rows.push(['circuit bench: two 100 µF capacitors, 10 V and 0 V, share to 5 V: 5 mJ → 2.5 mJ, and 2.5 mJ is accounted for', near(qty(v.led[2]), -2.5e-3, 1e-6) && near(qty(v.led[3]), 2.5e-3, 1e-6), JSON.stringify(v.led)]);
    // charging a capacitor to the end: of the work Cε² done by the battery, half is stored and half is heat, whatever R is
    await load('battery B1 0,0 0,6 emf=9 r=0\nresistor R1 0,0 8,0 R=1k\ncapacitor C1 8,0 8,6 C=100u V0=0\nwire W1 8,6 0,6', 200);
    await p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot; for (let k = 0; k < 6; k++) r.querySelector('#btn-faster').click(); });
    await p.waitForFunction(() => { const d = document.getElementById('xlab-host').shadowRoot.querySelectorAll('dl.ledger dd'); return d.length > 2 && /^8\.100\s*mJ/.test(d[0].textContent.replace(/\u00A0/g, ' ')); }, null, { timeout: 15000 }).catch(() => {});
    v = await read();
    rows.push(['circuit bench: charging through R, the battery does Cε² = 8.1 mJ of work; half is stored, half is heat', near(qty(v.led[0]), 8.1e-3, 2e-6) && near(qty(v.led[1]), 4.05e-3, 2e-6) && near(qty(v.led[2]), 4.05e-3, 2e-6), JSON.stringify(v.led)]);
    // a switch of the "More" menu changes the bench's own setting, in every language (its key is not a word to translate)
    const opt = await p.evaluate(async () => { const r = document.getElementById('xlab-host').shadowRoot;
      r.querySelector('#btn-more').click(); const b = r.querySelector('#opt-potential'), before = b.getAttribute('aria-checked'); b.click();
      await new Promise(f => setTimeout(f, 700));
      let saved = null; try { saved = JSON.parse(localStorage.getItem('phys_lab_circuit-bench')).opts; } catch (e) {}
      const after = b.getAttribute('aria-checked'); b.click(); await new Promise(f => setTimeout(f, 500));
      let back = null; try { back = JSON.parse(localStorage.getItem('phys_lab_circuit-bench')).opts; } catch (e) {}
      r.querySelector('#modal [aria-label], #modal button').closest('#modal') && r.querySelectorAll('#modal button')[0].click();
      return { before, after, saved, back, keys: saved ? Object.keys(saved).sort().join(',') : '' }; });
    rows.push(['circuit bench: "potential as wire color" switches the bench\u2019s own setting off and on again', opt.before === 'true' && opt.after === 'false' && opt.saved && opt.saved.potential === false && opt.back && opt.back.potential === true && opt.keys === 'flow,iec,nodeV,potential,values', JSON.stringify(opt)]);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    if (!(await p.evaluate(() => _xlabOpen()))) { await p.evaluate(() => openLab('circuit-bench')); await p.waitForTimeout(900); }
    // a part's name is text: markup in it is not HTML
    await load('resistor <img/src=x/onerror=window.__pwn=1> 0,0 4,0 R=1k\nbattery B1 0,0 0,4 emf=9 r=0\nwire W1 0,4 4,4\nwire W9 4,4 4,0');
    const h = await p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot; return { pwn: window.__pwn, img: r.querySelectorAll('img').length }; });
    rows.push(['circuit bench: markup in a pasted name runs nothing and builds no element', h.pwn === undefined && h.img === 0, JSON.stringify(h)]);
    return rows;
  },

  async merger(p) {
    const rows = [];
    const pick = async k => { await p.evaluate(x => { const r = document.getElementById('xlab-host').shadowRoot, s = r.getElementById('preset'); s.value = x; s.dispatchEvent(new Event('change', { bubbles: true })); }, k); await p.waitForTimeout(550); };
    const scrub = async f => { await p.evaluate(x => { const s = document.getElementById('xlab-host').shadowRoot.getElementById('scrub'); s.value = Math.round(+s.min + x * (s.max - s.min)); s.dispatchEvent(new Event('input', { bubbles: true })); }, f); await p.waitForTimeout(160); };
    const read = () => p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, o = {};
      for (const i of ['fM', 'fS', 'fE', 'fK', 'f220', 'sMc', 'sZ', 'areaTxt', 'rF', 'rR', 'rV', 'rE']) o[i] = r.getElementById(i).textContent;
      o.m1 = +r.getElementById('m1').value; o.m2 = +r.getElementById('m2').value; return o; });
    await pick('gw250114'); let v = await read();
    const Mf = num(v.fM), af = num(v.fS), E = num(v.fE), z = num(v.sZ), M = v.m1 + v.m2, TS = 4.925491e-6;   // GM☉/c³ in seconds
    rows.push(['merger: GW250114 leaves a 62.6 M☉ black hole of spin 0.69', near(Mf, 62.63, 0.05) && near(af, 0.686, 0.003), v.fM + ', ' + v.fS]);
    rows.push(['merger: mass–energy balance, M_f + E/c² = m₁ + m₂', near(Mf + E, M, 0.02), `${Mf} + ${E} against ${M}`]);
    rows.push(['merger: E = Δm·c²: 3.17 M☉ is 5.67×10⁴⁷ J', near(E * 1.98841e30 * Math.pow(299792458, 2), 5.67e47, 0.02e47) && /5\.6[67]×10⁴⁷ J/.test(v.fE), v.fE]);
    const Mc = Math.pow(v.m1 * v.m2, 0.6) / Math.pow(M, 0.2), mc = v.sMc.split('/').map(num);
    rows.push(['merger: chirp mass (m₁m₂)^(3/5)/(m₁+m₂)^(1/5), and (1+z) times that at the detector', near(mc[0], Mc, 0.01) && near(mc[1], Mc * (1 + z), 0.02), v.sMc + ' against ' + Mc.toFixed(2)]);
    // the area of a Kerr horizon is 8π(GM/c²)²(1 + √(1 − χ²)): the remnant's against the sum of the two
    const A = (m, c) => m * m * (1 + Math.sqrt(1 - c * c)), ar = A(Mf, af) / (A(v.m1, 0) + A(v.m2, 0)), shown = num(v.areaTxt.split('=')[1]);
    rows.push(['merger: the horizon area grows (Hawking’s area theorem): A_f/(A₁+A₂) = 1.56', near(shown, ar, 0.003) && shown > 1, v.areaTxt + ' against ' + ar.toFixed(4)]);
    // the ringdown's fundamental tone is the (2,2,0) mode of the remnant (Berti–Cardoso–Will fit), redshifted
    const f220 = (1.5251 - 1.1568 * Math.pow(1 - af, 0.1292)) / (2 * Math.PI * Mf * TS) / (1 + z);
    rows.push(['merger: the ringdown tone is the Kerr (2,2,0) mode of the remnant, 251 Hz at the detector', near(num(v.f220), f220, 0.005 * f220), v.f220 + ' against ' + f220.toFixed(1)]);
    // the inspiral: a Keplerian orbit, radiating at twice its frequency
    await scrub(0.3); v = await read();
    const vc = num(v.rV), rg = num(v.rR.split('·')[1]), f = num(v.rF);
    rows.push(['merger: the orbit is Keplerian, (v/c)² = GM/(rc²)', near(vc * vc * rg, 1, 0.012), v.rV + ', ' + v.rR]);
    rows.push(['merger: the wave is at twice the orbital frequency, (v/c)³ = πGMf(1+z)/c³', near(Math.PI * M * TS * (1 + z) * f / Math.pow(vc, 3), 1, 0.03), v.rV + ', ' + v.rF]);
    const fs = []; for (const x of [0, 0.2, 0.4, 0.6]) { await scrub(x); fs.push(num((await read()).rF)); }
    rows.push(['merger: the frequency chirps upward as the orbit shrinks', fs[0] < fs[1] && fs[1] < fs[2] && fs[2] < fs[3], fs.join(' < ')]);
    await scrub(1); v = await read();
    rows.push(['merger: the energy radiated by the end is the mass deficit of the remnant', near(num(v.rE), E, 0.011), v.rE + ' against ' + v.fE]);
    // GW150914 against the catalogue (GWTC-1: 63.1 M☉, spin 0.69, 3.1 M☉c² radiated)
    await pick('gw150914'); v = await read();
    rows.push(['merger: GW150914 → 63 M☉, spin 0.68–0.69, about 3 M☉c² radiated (GWTC-1)', near(num(v.fM), 63.1, 0.4) && near(num(v.fS), 0.69, 0.02) && near(num(v.fE), 3.1, 0.2), `${v.fM}, ${v.fS}, ${v.fE}`]);
    // symmetry: equal masses with equal spins have no preferred direction to recoil in
    await pick('aligned'); v = await read();
    rows.push(['merger: equal masses with equal spins do not recoil', num(v.fK) === 0, v.fK]);
    for (const k of ['gw231123', 'gw190814', 'gw190521', 'anti', 'gw250114']) await pick(k);
    return rows;
  },

  // A place and an instant are typed in, and the lab's own table is read: every motion with its speed
  // and its direction in Galactic coordinates (l, b). The numbers are the same in every language.
  async whichway(p) {
    const rows = [], D = Math.PI / 180;
    const at = async (lat, lon, date, time) => {
      await p.evaluate(([la, lo, d, tm]) => { const r = document.getElementById('xlab-host').shadowRoot, $ = id => r.getElementById(id);
        if ($('live').checked) $('live').click();
        const f = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
        f('lat', la); f('lon', lo); f('date', d); f('time', tm); }, [lat, lon, date, time]);
      await p.waitForTimeout(350);
      return p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot;
        return { place: r.getElementById('place').value, when: r.getElementById('when').textContent, legend: r.getElementById('annualLegend').textContent,
          // a direction's cell: its value (the cell also holds the column's short name, shown on a phone)
          t: [...r.getElementById('ledger').querySelectorAll('tr')].map(tr => [...tr.children].map(c => (c.querySelector('.v') || c).textContent.trim().replace(/\s+/g, ' '))).filter(c => c.length > 1 && /\d/.test(c[1])) }; });
    };
    const vec = c => { const lb = c[2].split(',').map(num), v = num(c[1]); return [v * Math.cos(lb[1] * D) * Math.cos(lb[0] * D), v * Math.cos(lb[1] * D) * Math.sin(lb[0] * D), v * Math.sin(lb[1] * D)]; };
    const add = (...a) => a.reduce((x, y) => [x[0] + y[0], x[1] + y[1], x[2] + y[2]]), len = v => Math.hypot(v[0], v[1], v[2]);
    const sep = (u, w) => Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (len(u) * len(w))))) / D;
    const opened = await p.evaluate(() => document.getElementById('xlab-host').shadowRoot.getElementById('place').value);
    rows.push(['which way: on a device in Israel the lab opens on Tel Aviv', opened === 'telaviv', opened]);
    // Tel Aviv, 19 November 2026 at noon
    let v = await at('32.0853', '34.7818', '2026-11-19', '12:00'), T = v.t;
    rows.push(['which way: the table has the five motions, their total and the sum of speeds', T.length === 7 && /10:00 UTC/.test(v.when), `${T.length} rows, ${v.when}`]);
    // 1. the spin: v = ωρ, ρ the distance from the axis on the WGS-84 ellipsoid
    const rho = lat => { const a = 6378.137, e2 = 0.00669437999, s = Math.sin(lat * D); return a / Math.sqrt(1 - e2 * s * s) * Math.cos(lat * D); }, OM = 7.2921150e-5;
    rows.push(['which way: spin at Tel Aviv is ωρ = 0.394 km/s, due east on the horizon', near(num(T[0][1]), OM * rho(32.0853), 0.0006) && /90°/.test(T[0][4]), T[0].join(' ; ')]);
    // 2. the orbit: faster than the mean 29.78 km/s in November, when the Sun is nearer
    const vNov = num(T[1][1]);
    // 3. the Sun among the stars: (U, V, W) = (11.1, 12.24, 7.25) km/s, toward Hercules
    rows.push(['which way: the Sun moves at |(U,V,W)| = 18.04 km/s relative to the stars around it', near(num(T[2][1]), Math.hypot(11.1, 12.24, 7.25), 0.01), T[2].join(' ; ')]);
    // 4. around the Galaxy: the proper motion of Sgr A* times the distance to it, less the Sun's own V
    rows.push(['which way: the Galaxy carries us at 4.74 μR₀ − V = 236.3 km/s, toward l = 90°', near(num(T[3][1]), 4.74047 * 6.411 * 8.178 - 12.24, 0.15) && /^90\.0°, [+−]0\.0°$/.test(T[3][2]), T[3].join(' ; ')]);
    // 5. the three motions of the Sun add up to the dipole Planck measured: 369.82 km/s toward (264.02°, +48.25°)
    const sun = add(vec(T[2]), vec(T[3]), vec(T[4])), pl = [Math.cos(48.253 * D) * Math.cos(264.021 * D), Math.cos(48.253 * D) * Math.sin(264.021 * D), Math.sin(48.253 * D)];
    rows.push(['which way: the Sun’s three motions add, as vectors, to Planck’s dipole: 369.82 km/s toward (264.0°, +48.3°)', near(len(sun), 369.82, 1.5) && sep(sun, pl) < 0.3, `${len(sun).toFixed(2)} km/s, ${sep(sun, pl).toFixed(2)}° away`]);
    // 6. all five add to the total of the table; the speeds do not
    const all = add(sun, vec(T[0]), vec(T[1])), tot = num(T[5][1]), sum = T.slice(0, 5).reduce((a, c) => a + num(c[1]), 0);
    rows.push(['which way: the five arrows add to the total of the table (396.6 km/s)', near(len(all), tot, 1.5) && sep(all, vec(T[5])) < 0.3 && near(tot, 396.61, 0.02), `${len(all).toFixed(2)} against ${T[5][1]}`]);
    rows.push(['which way: adding the speeds instead gives 848 km/s, more than twice too much', near(num(T[6][1]), sum, 0.06) && num(T[6][1]) > 2 * tot, `${T[6][1]} against ${sum.toFixed(2)}`]);
    // 7. through the year: fastest in mid-December, slowest in mid-June, by about twice the part of the orbital speed along the apex
    const mm = (v.legend.replace(/−/g, '-').match(/([\d.]+)\s*km\/s/g) || []).map(num);
    rows.push(['which way: through the year the speed swings between 341 and 399 km/s (December and June)', near(mm[0], 399.15, 0.02) && near(mm[1], 341.46, 0.02) && near((mm[0] + mm[1]) / 2, 370.3, 0.6), v.legend.slice(0, 110)]);
    // Quito, 21 June: on the equator the spin is fastest; near aphelion the orbit is slowest
    v = await at('-0.1807', '-78.4678', '2026-06-21', '12:00'); T = v.t;
    rows.push(['which way: on the equator the spin is ωa = 0.465 km/s', near(num(T[0][1]), OM * rho(-0.1807), 0.0006), T[0].join(' ; ')]);
    rows.push(['which way: Earth is faster near the Sun: 30.1 km/s in November, 29.3 km/s in June (the mean is 29.78)', vNov > 29.9 && vNov < 30.3 && num(T[1][1]) < 29.5 && num(T[1][1]) > 29.2, `${vNov} and ${T[1][1]}`]);
    // the pole: no spin at all
    await p.evaluate(() => { const s = document.getElementById('xlab-host').shadowRoot.getElementById('place'); s.value = 'pole'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(350);
    const pole = await p.evaluate(() => [...document.getElementById('xlab-host').shadowRoot.getElementById('ledger').querySelectorAll('tr')].map(tr => [...tr.children].map(c => (c.querySelector('.v') || c).textContent.trim())).filter(c => c.length > 1 && /\d/.test(c[1]))[0]);
    rows.push(['which way: on the rotation axis the spin is zero', num(pole[1]) < 0.0006, pole.join(' ; ')]);
    await p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, s = r.getElementById('place'); s.value = 'telaviv'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    return rows;
  },

  // The star's clock is set with the slider (0 to 100000), and the lab's readouts are read:
  // the time left, the star's age, and the centre's temperature, density and electron fraction.
  async collapse(p) {
    const rows = [];
    const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
    // "7.2 × 10⁶", "1.7 × 10⁴", "6.8 × 10⁻²", "35.0 MK", "1.89 GK", "5.9"
    const val = x => { const t = String(x).replace(/ /g, ' ').trim(), m = /^([\d.]+)(?:\s*×\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))?\s*(MK|GK)?/.exec(t); if (!m) return NaN;
      let e = 0; if (m[2]) { const neg = m[2][0] === '⁻'; e = +[...m[2].replace('⁻', '')].map(c => SUP[c]).join(''); if (neg) e = -e; }
      return parseFloat(m[1]) * Math.pow(10, e) * (m[3] === 'MK' ? 1e6 : m[3] === 'GK' ? 1e9 : 1); };
    // a time with its unit, in the words of either edition, in seconds
    const YR = 3.15576e7, UNITS = [['Myr', 1e6 * YR], ['מיליון שנה', 1e6 * YR], ['kyr', 1e3 * YR], ['אלף שנה', 1e3 * YR], ['yr', YR], ['שנים', YR], ['ימים', 86400], ['שעות', 3600], ['דקות', 60], ['min', 60], ['ms', 1e-3], ['µs', 1e-6], ['d', 86400], ['h', 3600], ['s', 1]];
    const secs = x => { const t = String(x).replace(/ /g, ' '), m = /([\d.]+)\s*(.*)$/.exec(t); if (!m) return NaN; const u = UNITS.find(q => m[2].trim().indexOf(q[0]) === 0); return u ? parseFloat(m[1]) * u[1] : NaN; };
    const mass = async m => { await p.evaluate(x => document.getElementById('xlab-host').shadowRoot.querySelector('label[for=m' + x + ']').click(), m); await p.waitForTimeout(450); };
    const at = async u => {
      await p.evaluate(x => { const s = document.getElementById('xlab-host').shadowRoot.getElementById('scrub'); s.value = x; s.dispatchEvent(new Event('input', { bubbles: true })); }, u);
      await p.waitForTimeout(300);
      return p.evaluate(() => { const r = document.getElementById('xlab-host').shadowRoot, g = i => r.getElementById(i).innerText;
        const c = g('hRead').split('\n').map(x => x.trim()).filter(Boolean);
        return { clock: g('hClock'), age: g('hAge'), T: c[1], rho: c[3], Ye: c[5], Lk: c[6], L: c[7], star: g('hStar'), card: r.getElementById('stagecard').innerText }; });
    };
    if (await p.evaluate(() => { const b = document.getElementById('xlab-host').shadowRoot.getElementById('play'); return b.getAttribute('aria-pressed') === 'true'; })) await p.evaluate(() => document.getElementById('xlab-host').shadowRoot.getElementById('play').click());
    await mass('15');
    const H = await at(5000), He = await at(20000), C = await at(33000), O = await at(45000), Si = await at(55000);
    const life = (secs(H.clock) + secs(H.age)) / (1e6 * YR);
    rows.push(['collapse: a 15 M☉ star lives 13.1 million years (time left + age)', near(life, 13.107, 0.01), `${H.clock} + ${H.age}`]);
    rows.push(['collapse: hydrogen burns by the CNO cycle near 35 MK', near(val(H.T), 35e6, 2e6) && /¹⁴N\(p,γ\)¹⁵O/.test(H.card), H.T]);
    rows.push(['collapse: each fuel burns hotter: H < He < C < O < Si, up to 3 GK', val(H.T) < val(He.T) && val(He.T) < val(C.T) && val(C.T) < val(O.T) && val(O.T) < val(Si.T) && near(val(Si.T), 3.3e9, 0.2e9), [H.T, He.T, C.T, O.T, Si.T].join(' < ')]);
    rows.push(['collapse: …and denser, from a few g cm⁻³ to tens of millions', val(H.rho) < 10 && val(He.rho) > 500 && val(C.rho) > 1e5 && val(O.rho) > 5e6 && val(Si.rho) > 3e7, [H.rho, He.rho, C.rho, O.rho, Si.rho].join(' < ')]);
    const left = [H, He, C, O, Si].map(x => secs(x.clock));
    rows.push(['collapse: …and faster: millions of years, then centuries, years, days', left.every((x, i) => i === 0 || x < left[i - 1]) && left[0] > 1e6 * YR && left[2] < 1e3 * YR && left[4] < 30 * 86400, [H, He, C, O, Si].map(x => x.clock).join(' | ')]);
    rows.push(['collapse: once hydrogen is gone the centre has one electron per two nucleons (Yₑ ≈ 0.5)', num(H.Ye) > 0.6 && near(num(He.Ye), 0.4994, 0.001) && near(num(O.Ye), 0.4987, 0.001), [H.Ye, He.Ye, O.Ye].join(', ')]);
    rows.push(['collapse: electron captures in silicon burning lower Yₑ to 0.46', near(num(Si.Ye), 0.4634, 0.003), Si.Ye]);
    rows.push(['collapse: neutrinos carry more than light once carbon burns: L_ν/L_γ from 0.07 to 10⁴ and more', val(H.L) < 0.1 && val(He.L) < 0.1 && val(C.L) > 5 && near(val(O.L), 1.7e4, 0.1e4) && val(Si.L) > 1e5, [H.L, He.L, C.L, O.L, Si.L].join(', ')]);
    rows.push(['collapse: at oxygen burning 2 years are left, at 1.9 GK and 7×10⁶ g cm⁻³', near(secs(O.clock) / YR, 2.07, 0.01) && near(val(O.T), 1.89e9, 0.01e9) && near(val(O.rho), 7.2e6, 0.1e6) && /¹⁶O \+ ¹⁶O/.test(O.card), `${O.clock}, ${O.T}, ${O.rho}`]);
    // the collapse: iron is photodisintegrated, and the centre passes the density of a nucleus
    const col = await at(66000), bo = await at(72000);
    rows.push(['collapse: iron is torn apart, ⁵⁶Fe + γ → 13 α + 4 n, at 124 MeV a nucleus', /⁵⁶Fe \+ γ → 13 α \+ 4 n \(−124\.4 MeV\)/.test(col.card) && val(col.rho) > 1e10, col.rho]);
    rows.push(['collapse: the centre overshoots the density of a nucleus (2.7×10¹⁴ g cm⁻³) by about 30% and bounces', near(val(bo.rho) / 2.7e14, 1.3, 0.06) && near(val(bo.T), 111.5e9, 1e9) && near(num(bo.Ye), 0.249, 0.002), `${bo.rho}, ${bo.T}, ${bo.Ye}`]);
    rows.push(['collapse: the neutrino burst at bounce shines at over 10⁵² erg s⁻¹', val(bo.L) > 1e52 && val(bo.L) < 1e54, bo.L]);
    // what is left: a neutron star lighter than the matter that made it, by its binding energy
    const end = await at(99000), mg = num((/M_g ≈ ([\d.]+)/.exec(end.card) || [])[1]), mb = num((/M_b ([\d.]+)/.exec(end.card) || [])[1]);
    rows.push(['collapse: a 1.40 M☉ neutron star is left of 1.55 M☉ of matter: M_g = M_b − 0.075 M_g²', near(mg, 1.40, 0.005) && near(mb - 0.075 * mg * mg, mg, 0.01) && /M_NS 1\.40/.test(end.star), `${mg} of ${mb}; ${end.star}`]);
    // its binding energy, 0.6β/(1 − β/2)·Mc² with β = GM/Rc², is the 3×10⁵³ erg the neutrinos carry (R = 12 km)
    const beta = 1.4766 * mg / 12, Eb = 0.6 * beta / (1 - beta / 2) * mg * 1.98841e33 * Math.pow(2.99792458e10, 2);
    rows.push(['collapse: the binding energy of that neutron star is about 3×10⁵³ erg, a hundred times the explosion', Eb > 2.4e53 && Eb < 3.4e53 && /E 0\.9\d? B|E 0\.90 B/.test(end.star), `${Eb.toExponential(2)} erg; ${end.star}`]);
    // a heavier star lives a shorter life and leaves a heavier neutron star
    await mass('25'); const H25 = await at(5000), end25 = await at(99000);
    const life25 = (secs(H25.clock) + secs(H25.age)) / (1e6 * YR);
    rows.push(['collapse: a 25 M☉ star lives 7.6 million years and leaves a 1.73 M☉ neutron star', near(life25, 7.559, 0.01) && /M_NS 1\.73/.test(end25.star), `${life25.toFixed(3)} Myr; ${end25.star}`]);
    for (const tb of ['kip', 'lum', 'hr', 'rt']) { await p.evaluate(x => document.getElementById('xlab-host').shadowRoot.querySelector('.tabs button[data-tab=' + x + ']').click(), tb); await p.waitForTimeout(150); }
    await mass('20'); await at(60000); await mass('15'); await at(6238);
    return rows;
  },
};

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const errs = [], away = [];
  const newPage = async (w, h) => {
    // the tests' device is in Israel: "Which Way" opens on the place of the device's time zone
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, timezoneId: 'Asia/Jerusalem' });
    await ctx.addInitScript(INIT);
    await ctx.route(/^(https?|wss?):/, r => { away.push(r.request().url()); r.abort(); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    return { ctx, p };
  };
  const ready = p => p.waitForFunction(() => typeof render === 'function' && typeof _xlabList === 'function' && document.querySelector('#app .tabs'), null, { timeout: 30000 });
  const st = p => p.evaluate(STATE);

  // ── 1. the host, at a desktop's width ────────────────────────────────
  let { ctx, p } = await newPage(1280, 860);
  await p.goto(URL); await ready(p); await p.waitForTimeout(400);
  const meta = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', labs: _xlabList().map(L => ({ id: L.id, dark: !!L.dark, fill: !!L.fill, store: !!L.store, tasks: (L.tasks || []).length, title: L.title })), all: XLABS.length }));
  const HE = meta.lang === 'he';
  t('every lab of the list has its page', meta.labs.length === meta.all && meta.all >= 1, `${meta.labs.length} of ${meta.all}`);
  const LABS = meta.labs.filter(L => !ONLY || L.id === ONLY);
  const first = meta.labs[0].id, course = await p.evaluate(() => location.hash);

  // the entry in the topic list
  t('the topic list has the entry to the labs', await p.locator('#sidebar-nav .xlab-btn').count() === 1);
  await p.locator('#sidebar-nav .xlab-btn').click(); await p.waitForTimeout(250);
  let s = await st(p);
  t('the entry opens the list of labs, on #/labs', s.open && s.hash === '#/labs' && s.cards === meta.labs.length && !s.lab, JSON.stringify(s));
  t('the course behind the list is inert', s.inert);
  t('the list has no "back" (only ✕)', s.backHidden === true);
  // a card opens its lab
  await p.locator(`#xlab-overlay .xlab-card[data-lab="${first}"]`).click(); await p.waitForTimeout(500);
  s = await st(p);
  t('a card opens its lab on #/labs/<id>', s.open && s.hash === '#/labs/' + first && s.lab === first && s.children >= 2, JSON.stringify(s));
  t('the bar carries the lab\'s name and "back"', s.title.length > 3 && s.backHidden === false, s.title);
  // back -> the list; Escape -> the course
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(300);
  s = await st(p);
  t('"back" in a lab returns to the list', s.open && s.hash === '#/labs' && !s.lab, JSON.stringify(s));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  s = await st(p);
  t('Escape on the list returns to the course', !s.open && s.hash === course && !s.inert, JSON.stringify(s));
  t('the keyboard is back on the entry in the topic list', /xlab-btn/.test(s.focus), s.focus);
  // the browser's own back and forward
  await p.evaluate(id => openLab(id), first); await p.waitForTimeout(400);
  await p.goBack(); await p.waitForTimeout(400);
  s = await st(p);
  t('the browser\'s back button closes a lab opened from the course', !s.open && s.hash === course, JSON.stringify(s));
  await p.goForward(); await p.waitForTimeout(500);
  s = await st(p);
  t('…and its forward button opens it again', s.open && s.lab === first, JSON.stringify(s));
  // ✕ from a lab opened through the list: straight to the course
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  await p.evaluate(() => openLabs()); await p.waitForTimeout(200);
  await p.evaluate(id => openLab(id), first); await p.waitForTimeout(400);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(500);
  s = await st(p);
  t('✕ in a lab returns to the course in one step', !s.open && s.hash === course && !s.inert, JSON.stringify(s));
  // the keyboard shortcut, and the course's own shortcuts while a lab is open
  await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await p.keyboard.press('Shift+L'); await p.waitForTimeout(300);
  s = await st(p);
  t('Shift+L opens the list of labs', s.open && s.hash === '#/labs', JSON.stringify(s));
  const tabBefore = await p.evaluate(() => state.tab);
  await p.keyboard.press('2'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  t('the course takes no shortcut while the labs are open', await p.evaluate(() => state.tab) === tabBefore && (await st(p)).open);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);

  // a link to a lab, to the list, to no lab
  await p.goto('about:blank'); await p.goto(URL + '#/labs/' + first); await ready(p); await p.waitForTimeout(600);
  s = await st(p);
  t('a link to a lab opens it', s.open && s.lab === first && s.hash === '#/labs/' + first, JSON.stringify(s));
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(300);
  s = await st(p);
  t('…"back" there shows the list (there is no step to go back to)', s.open && !s.lab && s.hash === '#/labs', JSON.stringify(s));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  s = await st(p);
  t('…and ✕ returns to the course, whose address replaces the lab\'s', !s.open && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(s.hash) && !s.inert, JSON.stringify(s));
  await p.goto('about:blank'); await p.goto(URL + '#/labs/' + first); await ready(p); await p.waitForTimeout(600);
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  s = await st(p);
  t('✕ on a lab opened by a link returns to the course', !s.open && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(s.hash), JSON.stringify(s));
  for (const h of ['#/labs/no-such-lab', '#/labs/constructor']) {
    await p.goto('about:blank'); await p.goto(URL + h); await ready(p); await p.waitForTimeout(400);
    s = await st(p);
    t(`a link to no lab (${h}) shows the list`, s.open && !s.lab && s.hash === '#/labs', JSON.stringify(s));
  }
  for (const h of ['#/labs/__proto__', '#/labs/%3Cimg%20src=x%20onerror=window.__pwn=1%3E', '#/labs/a/b', '#/labs/' + 'a'.repeat(300), '#/labs/"><svg onload=window.__pwn=1>']) {
    await p.goto('about:blank'); await p.goto(URL + h); await ready(p); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ pwn: window.__pwn || null, open: _xlabOpen(), app: document.getElementById('app').textContent.length, hash: location.hash }));
    t(`a hostile lab address opens nothing and runs nothing (${h.slice(0, 30)})`, !r.pwn && !r.open && r.app > 50 && /^#\/[\w-]+\/[\w-]+\/(theory|sim|quiz|problem)$/.test(r.hash), JSON.stringify(r));
  }

  // the card in a section leads to its lab, and back to that section
  const ties = await p.evaluate(() => Object.keys(XLAB_TIES).map(k => ({ k, lab: XLAB_TIES[k][0], ok: !!CONTENT[k] && !!_xlabById(XLAB_TIES[k][0]) })));
  t('every section that leads to a lab exists, and so does its lab', ties.length > 0 && ties.every(x => x.ok), ties.filter(x => !x.ok).map(x => x.k + '→' + x.lab).join(' '));
  const tie = ties.find(x => x.ok && (!ONLY || x.lab === ONLY)) || ties[0];
  await p.goto('about:blank'); await p.goto(URL + '#/' + tie.k.replace('.', '/') + '/theory'); await ready(p); await p.waitForTimeout(500);
  t('a section that leads to a lab shows its card', await p.locator('#app .xlab-tiecard').count() === 1, tie.k);
  await p.locator('#app .xlab-tiecard .btn').click(); await p.waitForTimeout(600);
  s = await st(p);
  t('the card opens its lab', s.open && s.lab === tie.lab, JSON.stringify(s));
  await p.evaluate(() => xlabBack()); await p.waitForTimeout(600);
  s = await st(p);
  const where = await p.evaluate(() => state.chapter + '.' + state.section + '/' + state.tab);
  t('"back" returns to that very section', !s.open && where === tie.k + '/theory', where);
  t('…with the keyboard on the card that was used', await p.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.xlab-tiecard'))));

  // the search finds every lab by its name, and a result opens it
  const found = await p.evaluate(() => _xlabList().map(L => { const d = document.createElement('div'); d.innerHTML = L.title;
    const w = d.textContent.split(/[\s?]+/).filter(x => x.length > 2).slice(0, 2).join(' '), r = _searchFind(w);
    return { id: L.id, w, ok: !!r && r.lab.some(x => x.e.id === L.id) }; }));
  t('the search finds every lab by its name', found.every(x => x.ok), found.filter(x => !x.ok).map(x => x.id + ' «' + x.w + '»').join(' '));
  await p.locator('#sidebar-nav .ts-inp').fill(found[0].w); await p.waitForTimeout(300);
  t('…in a group of its own, after the course\'s results', await p.locator('#sidebar-nav .search-results .sr-lab').count() >= 1);
  await p.locator('#sidebar-nav .search-results .sr-lab').first().click(); await p.waitForTimeout(600);
  s = await st(p);
  t('…and a result opens the lab', s.open && s.lab === found[0].id, JSON.stringify(s));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = document.querySelector('#sidebar-nav .ts-clear'); if (c) c.click(); }); await p.waitForTimeout(200);

  // the list itself: its language and its layout
  await p.evaluate(() => openLabs()); await p.waitForTimeout(300);
  let sc = await p.evaluate(SCAN);
  if (!HE) t('the list of labs shows no Hebrew', !sc.heb.length, sc.heb.slice(0, 4).join(' | '));
  t('the list of labs leaks no placeholder', !sc.ph.length, sc.ph.join(' | '));
  if (HE) t('the list of labs: formulas inside Hebrew read left to right', !(await p.evaluate(BIDI)).length, (await p.evaluate(BIDI)).slice(0, 4).join(' | '));
  await p.evaluate(() => closeLabs()); await p.waitForTimeout(300);
  await ctx.close();

  // ── 2. every lab, at a desktop's width and a phone's ─────────────────────
  // 360 px: the narrowest phone in common use (anything that fits it fits the wider ones)
  for (const [w, h] of [[1280, 860], [360, 740]]) {
    ({ ctx, p } = await newPage(w, h));
    // on the quiz tab the course itself animates nothing: what runs is the lab's
    await p.goto(URL); await ready(p);
    await p.evaluate(() => { state.tab = 'quiz'; render(); }); await p.waitForTimeout(700);
    const idle = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 600)); return window.__raf - a; });
    for (const L of LABS) {
      const W = `[${L.id} ${w}px]`, e0 = errs.length;
      await p.evaluate(() => { window.__cv = []; });
      await p.evaluate(id => openLab(id), L.id); await p.waitForTimeout(1500);
      s = await st(p);
      t(`${W} opens`, s.open && s.lab === L.id && s.children >= 2, JSON.stringify(s));
      t(`${W} reads ${meta.dir}`, s.dir === meta.dir, s.dir);
      t(`${W} fits the width of the screen`, s.overflow <= 1, s.overflow + ' px wider');
      const pt = await p.evaluate(PAINTED);
      t(`${W} draws`, pt.n > 0 && (pt.painted > 0 || pt.gl > 0), JSON.stringify(pt));
      sc = await p.evaluate(SCAN);
      t(`${W} has its text`, sc.words > 40, sc.words + ' words');
      t(`${W} leaks no placeholder`, !sc.ph.length, sc.ph.slice(0, 3).join(' | '));
      if (!HE) t(`${W} shows no Hebrew (text, labels, canvas)`, !sc.heb.length, sc.heb.slice(0, 5).join(' | '));
      else {
        t(`${W} is in Hebrew`, sc.heb.length > 10, sc.heb.length + ' Hebrew texts');
        const bd = await p.evaluate(BIDI);
        t(`${W} numbers, units and formulas inside Hebrew read left to right`, !bd.length, bd.slice(0, 5).join(' | '));
      }
      t(`${W} its inquiry tasks are listed`, s.tasks === L.tasks, `${s.tasks} of ${L.tasks}`);
      // the theme: followed, or one deliberate dark look
      const th0 = s.theme;
      await p.evaluate(() => toggleTheme()); await p.waitForTimeout(350);
      const s2 = await st(p), app2 = await p.evaluate(() => state.theme);
      if (L.dark) t(`${W} keeps its dark look in the light theme, and offers no theme button`, s2.theme === 'dark' && s2.themeHidden === true, s2.theme);
      else {
        t(`${W} follows the theme`, s2.theme === app2 && s2.theme !== th0 && s2.themeHidden === false, th0 + ' → ' + s2.theme);
        const pt2 = await p.evaluate(PAINTED);
        t(`${W} draws in the other theme too`, pt2.painted > 0 || pt2.gl > 0, JSON.stringify(pt2));
      }
      await p.evaluate(() => toggleTheme()); await p.waitForTimeout(250);
      // its physics, once
      if (w > 700 && PHYSICS[L.id]) for (const [name, ok, info] of await PHYSICS[L.id](p)) t(name, ok, info);
      // closed, it runs nothing
      const running = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 400)); return window.__raf - a; });
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(600);
      const after = await p.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 600)); return window.__raf - a; });
      s = await st(p);
      t(`${W} closes`, !s.open && !s.inert && !s.lab, JSON.stringify(s));
      t(`${W} once closed, asks for no more animation frames`, after <= idle + 2, `${running} while open, ${after} after, ${idle} before`);
      t(`${W} no page error`, errs.length === e0, errs.slice(e0, e0 + 3).join(' | '));
      // again: a second opening starts clean
      await p.evaluate(id => openLab(id), L.id); await p.waitForTimeout(700);
      t(`${W} opens a second time`, (await st(p)).lab === L.id && errs.length === e0, errs.slice(e0).join(' | '));
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
    }
    const viol = await p.evaluate(() => window.__csp);
    t(`[${w}px] no lab broke a rule of the page's CSP`, !viol.length, viol.slice(0, 4).join(' | '));
    await ctx.close();
  }

  // ── 3. the lab that keeps something on the device ───────────────────────
  const keeper = meta.labs.find(L => L.store);
  if (keeper && (!ONLY || ONLY === keeper.id)) {
    ({ ctx, p } = await newPage(1280, 860));
    await p.goto(URL); await ready(p);
    const KEY = 'phys_lab_' + keeper.id, e0 = errs.length;
    const X = n => `<img src=x onerror="window.__pwn=(window.__pwn||[]).concat('${n}')">`;
    const poison = [X('raw'), '{"__proto__":{"polluted":"yes"},"v":1,"text":' + JSON.stringify(X('text') + '\n' + '"><svg onload=window.__pwn=1>') + ',"probes":[' + JSON.stringify(X('probe')) + '],"opts":{"potential":' + JSON.stringify(X('opt')) + '},"speed":"1e400","example":' + JSON.stringify(X('ex')) + '}',
      '[]', 'null', '{"v":999,"text":12345}', 'x'.repeat(70000)];
    for (const [i, v] of poison.entries()) {
      await p.evaluate(([k, val]) => localStorage.setItem(k, val), [KEY, v]);
      await p.evaluate(id => openLab(id), keeper.id); await p.waitForTimeout(900);
      const r = await p.evaluate(() => ({ pwn: window.__pwn || null, polluted: ({}).polluted || null, open: _xlabOpen(), kids: document.getElementById('xlab-host').shadowRoot.children.length,
        imgs: document.getElementById('xlab-host').shadowRoot.querySelectorAll('img[src="x"]').length }));
      t(`a poisoned record of the ${keeper.id} lab (#${i + 1}): no script, nothing polluted, the lab works`, !r.pwn && !r.polluted && r.open && r.kids >= 2 && !r.imgs && errs.length === e0, JSON.stringify(r) + ' ' + errs.slice(e0).join(' | '));
      await p.evaluate(() => closeLabs()); await p.waitForTimeout(400);
    }
    // what the lab writes back is its own, bounded, and without markup
    const back = await p.evaluate(k => localStorage.getItem(k), KEY);
    t('what the lab keeps is bounded and holds no markup', back === null || (back.length <= 60000 && !/<|onerror|onload/.test(back)), (back || '').slice(0, 100));
    await p.evaluate(k => { localStorage.setItem(k, '{"v":1}'); window.confirm = () => true; resetAllProgress(); }, KEY); await p.waitForTimeout(300);
    t('"reset" erases what the lab kept', await p.evaluate(k => localStorage.getItem(k), KEY) === null);
    await ctx.close();
  }

  await b.close();
  const other = away.filter(u => !u.startsWith('https://cdn.jsdelivr.net/npm/katex@'));
  t('no request to any site but KaTeX\'s', !other.length, other.slice(0, 4).join(' '));
  t('no page error anywhere', !errs.length, [...new Set(errs)].slice(0, 5).join(' | '));
  console.log(`check_labs (${path.basename(FILE)}, ${meta.lang}, ${LABS.length} lab${LABS.length === 1 ? '' : 's'}): ${checks - fail}/${checks} passed`);
  process.exit(fail ? 1 : 0);
})();
