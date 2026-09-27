// Can every piece of text be read — in the dark theme AND the light one — and
// does every mixed Hebrew/maths string come out in the right order?
//
//   node tests/check_readable.js            (everything)
//   node tests/check_readable.js dom        (page text only)
//   node tests/check_readable.js canvas     (canvas labels only)
//   node tests/check_readable.js <mode> <subject>   (one subject)
//
// Page text: every visible text node's colour (with opacity) is composited
// against the backgrounds actually behind it and must reach 4.5:1 (3:1 for
// large or bold-large type). Canvas text: each fillText is intercepted, the
// pixels under the label are read BEFORE it is drawn, and the label colour
// must reach 3.5:1 against them. Bidi: every string mixing Hebrew with Latin,
// digits or symbols is laid out by the browser (for canvas labels, in an
// identical DOM span) and checked for reversed formulas, signs cut off their
// numbers, and brackets that do not enclose their contents.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');
const MODE = process.argv[2] || 'all', ONLY = process.argv[3] || '';
const OUT = process.env.READABLE_OUT || '';

const LINT = `(function(){
  var HEB=/[\\u0590-\\u05FF]/;
  var ATOM='[A-Za-z0-9\\u2080-\\u209F\\u2070-\\u207F\\u00B2\\u00B3\\u00B9\\u0370-\\u03FF()\\\\[\\\\]{}.,^_|\\u221A\\u00B0%\\u221E\\u2032\\u2033]';
  var MATH=new RegExp(ATOM+'+(?:[ \\\\t]*(?:[=\\u2248\\u2260<>\\u2264\\u2265+\\\\-\\u2212\\u00D7\\u00B7*/^\\u21D2\\u2192\\u221D\\u2225]|[ \\\\t])[ \\\\t]*'+ATOM+'+)*','g');
  function box(n,a,b){var r=document.createRange();r.setStart(n,a);r.setEnd(n,b);var q=r.getClientRects();return q.length?q[0]:r.getBoundingClientRect();}
  return function(n){
    var s=n.nodeValue,out=[];
    if(!s||!HEB.test(s)&&!HEB.test((n.parentElement||{}).textContent||''))return out;
    // 1) formula runs (the app's own definition) must read left to right
    (window._mathRuns?_mathRuns(s):[]).forEach(function(r){
      var run=s.slice(r[0],r[1]);if(run.replace(/[^A-Za-z0-9\u0370-\u03FF]/g,'').length<2)return;
      var A=box(n,r[0],r[0]+1),B=box(n,r[1]-1,r[1]);
      if(!A.width||!B.width||Math.abs(A.top-B.top)>4)return;
      if(A.left>B.left+1)out.push(['reversed',run]);
    });
    var m;
    // 2) a sign must sit immediately to the left of its number
    var re=/(^|[^A-Za-z0-9\\u0370-\\u03FF\\u0590-\\u05FF)\\]])([\\u2212\\-])(?=[0-9])/g;   // not a Hebrew prefix hyphen (ב-45°)
    while((m=re.exec(s))){
      var i=m.index+m[1].length,S=box(n,i,i+1),D=box(n,i+1,i+2);
      if(!S.width||!D.width||Math.abs(S.top-D.top)>4)continue;
      if(!(S.right<=D.left+2&&D.left-S.right<7))out.push(['sign',s.slice(Math.max(0,i-8),i+8)]);
    }
    // 3) brackets must enclose what is inside them
    var st=[];
    for(var k=0;k<s.length;k++){var c=s[k];
      if(c==='(')st.push(k);
      else if(c===')'&&st.length){var a=st.pop();if(k-a<3)continue;
        var P=box(n,a,a+1),Q=box(n,k,k+1);if(!P.width||!Q.width||Math.abs(P.top-Q.top)>4)continue;
        var lo=Math.min(P.left,Q.left),hi=Math.max(P.right,Q.right),bad=false;
        for(var j=a+1;j<k;j++){if(/\\s/.test(s[j]))continue;var C=box(n,j,j+1);
          if(C.width&&Math.abs(C.top-P.top)<4&&(C.left<lo-1||C.right>hi+1)){bad=true;break;}}
        if(bad)out.push(['bracket',s.slice(a,k+1)]);}}
    return out;
  };
})()`;

const LUM = `function _lum(c){var f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);}
function _cr(a,b){var x=_lum(a),y=_lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function _parse(str){var m=String(str).match(/rgba?\\(([^)]+)\\)/);if(m){var p=m[1].split(',').map(parseFloat);return [p[0],p[1],p[2],p.length>3?p[3]:1];}
  m=String(str).match(/^#([0-9a-f]{3,8})$/i);if(m){var h=m[1];if(h.length===3)h=h.split('').map(function(x){return x+x;}).join('');
    return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16),h.length===8?parseInt(h.substr(6,2),16)/255:1];}
  return null;}
function _over(top,bot){var a=top[3];return [top[0]*a+bot[0]*(1-a),top[1]*a+bot[1]*(1-a),top[2]*a+bot[2]*(1-a),1];}`;

const DOMSCAN = `(function(){
  ${LUM}
  var lint=${LINT},res=[],seen=new Set();
  function bgOf(el){var chain=[];for(var e=el;e&&e.nodeType===1;e=e.parentElement)chain.push(e);
    var c=_parse(getComputedStyle(document.body).backgroundColor)||[255,255,255,1];if(c[3]<1)c=[255,255,255,1];
    for(var i=chain.length-1;i>=0;i--){var cs=getComputedStyle(chain[i]);
      var g=cs.backgroundImage;if(g&&g!=='none'){var st=g.match(/rgba?\\([^)]+\\)/g);if(st){var acc=[0,0,0,0];st.forEach(function(x){var q=_parse(x);for(var k=0;k<4;k++)acc[k]+=q[k]/st.length;});c=_over(acc,c);}}
      var b=_parse(cs.backgroundColor);if(b&&b[3]>0)c=_over(b,c);}
    return c;}
  function visible(el){for(var e=el;e&&e!==document.documentElement;e=e.parentElement){var cs=getComputedStyle(e);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05)return false;}
    var r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
  function opac(el){var o=1;for(var e=el;e&&e!==document.documentElement;e=e.parentElement)o*=parseFloat(getComputedStyle(e).opacity);return o;}
  var roots=[document.getElementById('app')].concat([].slice.call(document.querySelectorAll('.drawer-panel.open,.formula-panel.open,#onboard-overlay,.onboard,.chapter-summary,.modal,.summary-overlay')));
  roots.forEach(function(root){if(!root)return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n;
    while((n=w.nextNode())){var t=n.nodeValue;if(!t||!t.trim())continue;var el=n.parentElement;
      if(!/[A-Za-z0-9\\u0590-\\u05FF\\u0370-\\u03FF]/.test(t))continue;   // emoji and symbols carry their own colours
      if(!el||el.closest('script,style,canvas,.katex-mathml,option'))continue;
      if(!visible(el))continue;
      var cs=getComputedStyle(el),fg=_parse(cs.color);if(!fg)continue;
      var clip=cs.webkitBackgroundClip==='text'||cs.backgroundClip==='text';
      if(clip){var gs=(cs.backgroundImage.match(/rgba?\\([^)]+\\)/g)||[]);if(gs.length){var ac=[0,0,0,0];gs.forEach(function(x){var q=_parse(x);for(var k=0;k<4;k++)ac[k]+=q[k]/gs.length;});fg=ac;}}
      var bg=clip?bgOf(el.parentElement):bgOf(el),a=fg[3]*opac(el),col=_over([fg[0],fg[1],fg[2],a],bg);
      var cr=_cr(col,bg),sz=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=600;
      var need=(sz>=24||(bold&&sz>=18.6))?3:4.5;
      var key=t.trim().slice(0,40)+'|'+cs.color;
      if(cr<need&&!seen.has(key)){seen.add(key);res.push({kind:'contrast',txt:t.trim().slice(0,60),cr:+cr.toFixed(2),need:need,fg:cs.color,bg:'rgb('+bg.slice(0,3).map(Math.round).join(',')+')',cls:(el.className||el.tagName).toString().slice(0,40),style:(el.getAttribute('style')||'').slice(0,80)});}
      lint(n).forEach(function(h){res.push({kind:'bidi-'+h[0],txt:h[1],ctx:t.trim().slice(0,80)});});
    }});
  return res;})()`;

// runs in the page before any script: intercept canvas text
const HOOK = () => {
  window.__cv = []; window.__cvSeen = new Set();
  const P = CanvasRenderingContext2D.prototype, o = P.fillText;
  P.fillText = function (s, x, y, ...r) {
    try {
      const str = String(s), cv = this.canvas, key = (cv.id || '?') + '|' + str + '|' + this.fillStyle;
      if (window.__cvRec && !window.__cvSeen.has(key) && str.trim()) {
        window.__cvSeen.add(key);
        const m = this.getTransform(), dpr = m.a || 1, w = this.measureText(str).width;
        const al = this.textAlign, x0 = al === 'center' ? x - w / 2 : (al === 'right' || (al === 'end' && this.direction !== 'ltr')) ? x - w : x;
        const fs = parseFloat((this.font.match(/([\d.]+)px/) || [0, 11])[1]);
        const bl = this.textBaseline, ytop = bl === 'middle' ? y - fs / 2 : bl === 'top' ? y : y - fs * 0.8;
        const px = Math.round(m.a * x0 + m.e), py = Math.round(m.d * ytop + m.f), pw = Math.max(1, Math.round(w * m.a)), ph = Math.max(1, Math.round(fs * 1.05 * m.d));
        let samples = [];
        const X0 = Math.max(0, px), Y0 = Math.max(0, py), X1 = Math.min(cv.width, px + pw), Y1 = Math.min(cv.height, py + ph);
        if (X1 > X0 && Y1 > Y0) {
          const d = this.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data, W2 = X1 - X0, H2 = Y1 - Y0;
          for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
            const xi = Math.min(W2 - 1, Math.round((i + 0.5) / 9 * W2)), yi = Math.min(H2 - 1, Math.round((j + 0.5) / 5 * H2)), q = (yi * W2 + xi) * 4;
            samples.push([d[q], d[q + 1], d[q + 2], d[q + 3] / 255]);
          }
        }
        // what shows through transparent pixels: the canvas's own CSS
        // background, or the first painted ancestor -- not always the page
        if (!cv.__back) {
          let e = cv, c = null;
          while (e && e.nodeType === 1) {
            const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
            if (m && (m.length < 4 || +m[3] > 0.5)) { c = [+m[0], +m[1], +m[2], 1]; break; }
            e = e.parentElement;
          }
          cv.__back = c;
        }
        window.__cv.push({ id: cv.id, s: str, fill: String(this.fillStyle), alpha: this.globalAlpha, fs, dir: this.direction, font: this.font,
          samples, back: cv.__back, rot: Math.abs(m.b) + Math.abs(m.c) > 0.01, halo: this.shadowBlur >= 2 ? String(this.shadowColor) : '', off: X1 <= X0 || Y1 <= Y0 });
      }
    } catch (e) {}
    return o.call(this, s, x, y, ...r);
  };
};

const CVEVAL = `(function(rows,pageBg){
  ${LUM}
  var lint=${LINT},res=[];
  var host=document.getElementById('__bidi_host');
  if(!host){host=document.createElement('div');host.id='__bidi_host';host.style.cssText='position:fixed;left:0;top:0;width:3000px;visibility:hidden;white-space:pre';document.body.appendChild(host);}
  rows.forEach(function(r){
    var fg=_parse(r.fill);
    // not judged: emoji paint their own colours; a label mid-fade (globalAlpha
    // below one half) is meant to be faint; rotated text is not sampled
    // where it really sits
    var skip=/^[\s\u200e\u200f]*(?:[\u2600-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])+[\s\uFE0F]*$/.test(r.s)||r.alpha<0.5||r.rot;
    if(fg&&r.samples.length&&!skip){
      // the label sits on whatever is under it; alpha-less pixels show the page
      var back=r.back||pageBg;
      var bgs=r.samples.map(function(q){return q[3]<0.02?back:_over(q,back);});
      var lum=bgs.map(_lum).sort(function(a,b){return a-b;});var med=lum[Math.floor(lum.length/2)];
      var bg=bgs.reduce(function(best,q){return Math.abs(_lum(q)-med)<Math.abs(_lum(best)-med)?q:best;},bgs[0]);
      var col=_over([fg[0],fg[1],fg[2],fg[3]*r.alpha],bg),cr=_cr(col,bg);
      // a dark halo drawn round a light label is the label's own backdrop
      var hc=r.halo?_parse(r.halo):null;
      if(hc&&hc[3]>=0.6&&_lum(col)>0.3){var hb=_over(hc,bg);cr=Math.max(cr,_cr(col,hb));}
      if(cr<3.5)res.push({kind:'canvas-contrast',id:r.id,txt:r.s.slice(0,60),cr:+cr.toFixed(2),fg:r.fill,bg:'rgb('+bg.slice(0,3).map(Math.round).join(',')+')',fs:r.fs});
    }
    if(/[\\u0590-\\u05FF]/.test(r.s)&&/[A-Za-z0-9\\u0370-\\u03FF=+\\u2212\\-()]/.test(r.s)){
      var sp=document.createElement('span');sp.style.font=r.font;sp.dir=r.dir==='ltr'?'ltr':'rtl';sp.textContent=r.s;
      host.dir=sp.dir;host.appendChild(sp);
      lint(sp.firstChild).forEach(function(h){res.push({kind:'canvas-bidi-'+h[0],id:r.id,txt:h[1],ctx:r.s.slice(0,80)});});
      host.removeChild(sp);
    }
  });
  return res;})`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const found = [];
  for (const theme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(HOOK);
    await p.goto(F); await p.waitForTimeout(900);
    await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await p.evaluate(th => { if (window.closeOnboarding) closeOnboarding(); window.showSimTooltip = function () {}; applyTheme(th); }, theme);
    const subjects = await p.evaluate(() => [['mechanics', MECH_CHAPTERS], ['optics', OPTICS_CHAPTERS], ['electro', ELECTRO_CHAPTERS], ['circuits', DC_CHAPTERS], ['magnetism', MAG_CHAPTERS]]
      .map(q => ({ s: q[0], ch: q[1].map(c => ({ id: c.id, se: c.sections.map(x => x.id) })) })));
    const pageBg = await p.evaluate(() => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return [m[0], m[1], m[2], 1]; });
    for (const S of subjects) {
      if (ONLY && S.s !== ONLY) continue;
      for (const ch of S.ch) for (const se of ch.se) {
        const where = `${theme}:${S.s}/${ch.id}.${se}`;
        const tabs = MODE === 'canvas' ? ['theory', 'sim'] : ['theory', 'quiz', 'problem', 'sim'];
        for (const tab of tabs) {
          const nq = tab === 'quiz' ? await p.evaluate(([c, x]) => (CONTENT[c + '.' + x].quiz || []).length, [ch.id, se]) : 1;
          for (let qi = 0; qi < nq; qi++) {
            await p.evaluate(([sub, c, x, tb, i]) => {
              state.subject = sub; state.chapter = c; state.section = x; state.tab = tb;
              markCompleted(c, x, 'quiz', 0); markCompleted(c, x, 'theory', 0);
              if (tb === 'quiz') { const qs = getQS(c, x); qs.done = false; qs.cur = i; qs.ans = []; for (let k = 0; k < i; k++) qs.ans[k] = 0; qs.ans[i] = 0; }
              if (tb === 'problem') { const ps = getPS(c, x), n = (CONTENT[c + '.' + x].problem || { steps: [] }).steps.length;
                ps.done = false; ps.idx = n; ps.solved = []; for (let k = 0; k < n - 1; k++) ps.solved[k] = true; }
              window.__cv = []; window.__cvRec = true; render();
            }, [S.s, ch.id, se, tab, qi]);
            await p.waitForTimeout(tab === 'sim' ? 1300 : tab === 'theory' ? (MODE === 'dom' ? 150 : 1300) : 60);
            if (tab === 'theory') await p.evaluate(() => document.querySelectorAll('.fold-btn').forEach(b2 => { if (!b2.closest('.open')) b2.click(); }));
            if (tab === 'problem') await p.evaluate(() => { document.querySelectorAll('.hint-btn').forEach(h => { h.click(); }); document.querySelectorAll('.hint-btn').forEach(h => { h.click(); }); });
            if (MODE !== 'canvas' && !(tab === 'sim' && MODE === 'dom' && false)) {
              const r = await p.evaluate(DOMSCAN);
              r.forEach(x => found.push(Object.assign({ where: where + '/' + tab + (tab === 'quiz' ? '#' + qi : '') }, x)));
            }
            if (MODE !== 'dom' && (tab === 'theory' || tab === 'sim')) {
              const rows = await p.evaluate(() => { window.__cvRec = false; return window.__cv.splice(0); });
              const r = await p.evaluate(`${CVEVAL}(${JSON.stringify(rows)},${JSON.stringify(pageBg)})`);
              r.forEach(x => found.push(Object.assign({ where: where + '/' + tab }, x)));
            }
          }
        }
      }
    }
    if (MODE !== 'canvas' && !ONLY) {
      // chrome around the content: header, drawer, formula panel, changelog
      for (const act of ['', 'openDrawer()', 'openFormulaPanel()', 'openChangelog()']) {
        await p.evaluate(a => { closeDrawer(); closeFormulaPanel(); closeChangelog(); state.subject = 'mechanics'; state.chapter = 'kinematics'; state.section = 'distance-time'; state.tab = 'theory'; render(); if (a) eval(a); }, act);
        await p.waitForTimeout(150);
        const r = await p.evaluate(DOMSCAN.replace("[document.getElementById('app')]", "[document.body]"));
        r.forEach(x => found.push(Object.assign({ where: theme + ':chrome/' + (act || 'page') }, x)));
      }
    }
    if (errs.length) found.push({ where: theme, kind: 'page-error', txt: errs.slice(0, 3).join(' | ') });
    await ctx.close();
  }
  await b.close();
  // de-duplicate: the same string with the same problem in many places
  const agg = {};
  found.forEach(f => { const k = f.kind + '|' + (f.txt || '') + '|' + (f.fg || '') + '|' + (f.bg || '') + '|' + (f.id || '');
    (agg[k] = agg[k] || Object.assign({ n: 0, places: [] }, f)).n++; if (agg[k].places.length < 3) agg[k].places.push(f.where); });
  const list = Object.values(agg);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(list, null, 1));
  const kinds = {};
  list.forEach(f => { kinds[f.kind] = (kinds[f.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log(`   ${k}: ${kinds[k]} distinct`));
  list.slice(0, 40).forEach(f => console.log('   · ' + f.kind + ' ' + JSON.stringify(f.txt) + (f.cr ? ' ' + f.cr + ':1 ' + f.fg + ' on ' + f.bg : '') + (f.ctx ? ' in ' + JSON.stringify(f.ctx) : '') + ' @' + f.places[0]));
  console.log(list.length ? `\n❌ ${list.length} READABILITY PROBLEMS` : '\n✅ EVERY TEXT READABLE, EVERY FORMULA IN ORDER — BOTH THEMES');
  process.exit(list.length ? 1 : 0);
})();
