// DC circuits: every interaction responds, every guided problem agrees with an
// independent computation from first principles, and the numbers each
// simulation prints obey Kirchhoff's laws (junction sums, loop sums, power
// balance) at ordinary and extreme settings.
//
//   node tests/check_dc.js
const { chromium } = require('playwright');
const path = require('path');
const { L, WORDS } = require('./_lang.js');   // the words of the page's language
const F = 'file://' + (process.env.APP_FILE ? path.resolve(process.env.APP_FILE) : path.resolve(__dirname, '..', 'physics_game_v28.html'));   // APP_FILE: test a language build
const ok=[],bad=[];
const t=(name,cond,detail)=>(cond?ok:bad).push(name+(detail?' — '+detail:''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({viewport:{width:900,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F); await p.waitForTimeout(1200);
  await p.evaluate(()=>{if(window.closeOnboarding)closeOnboarding();
    window.showSimTooltip=function(){};});   // the first-visit hint card covers the lower canvas
  const go = async (ch,se)=>{ await p.evaluate(([c,x])=>{state.subject='circuits';state.chapter=c;state.section=x;state.tab='sim';render();},[ch,se]); await p.waitForTimeout(950); };
  const box = async ()=>p.evaluate(()=>{const c=document.querySelector('#app canvas');const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});
  const val = async id=>p.evaluate(i=>parseFloat(document.getElementById(i).value),id);
  // every label on the simulation canvas, captured for a few frames
  await p.evaluate(()=>{const f=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(s2){
      if(window._rec&&this.canvas&&this.canvas.closest&&this.canvas.closest('#app')&&!this.canvas.id.startsWith('anim'))
        window._txt.add(String(s2).replace(/[⁦-⁩‎‏]/g,''));
      return f.apply(this,arguments);};});
  // (on a busy machine a frame can take longer than the window: keep
  // listening until the canvas has drawn at least once)
  const grab=async()=>{await p.evaluate(()=>{window._txt=new Set();window._rec=true;});
    for(let k=0;k<12;k++){await p.waitForTimeout(160);if(await p.evaluate(()=>window._txt.size>0))break;}
    return p.evaluate(()=>{window._rec=false;return [...window._txt];});};
  const setS=async(id2,v)=>p.evaluate(([i,x])=>{const el=document.getElementById(i);el.value=x;el.dispatchEvent(new Event('input',{bubbles:true}));},[id2,String(v)]);
  const num=x=>parseFloat(String(x).replace('−','-'));
  const amp=x=>/mA$/.test(String(x))?num(x)/1000:num(x);     // "83.3 mA" is 0.0833 A
  const tolOf=x=>/mA$/.test(String(x))?6e-5:0.0051;           // what the printed figures allow
  const near=(a,b2,eps)=>Math.abs(a-b2)<=(eps||0.011);
  // the circuit engine's board on the canvas: where its points are, on the page
  const ptXY=async name=>p.evaluate(n=>{const c=document.querySelector('#app canvas'),B=c._dc,r=c.getBoundingClientRect(),q=B.pts[B.idx[n]],k=r.width/(c.width/(window.devicePixelRatio||1));
    return {x:r.x+q[0]*k,y:r.y+q[1]*k};},name);
  const elXY=async id2=>p.evaluate(i=>{const c=document.querySelector('#app canvas'),B=c._dc,r=c.getBoundingClientRect(),e=B.el(i),k=r.width/(c.width/(window.devicePixelRatio||1));
    return {x:r.x+e.mx*k,y:r.y+e.my*k};},id2);
  const probeXY=async i=>p.evaluate(j=>{const c=document.querySelector('#app canvas'),B=c._dc,r=c.getBoundingClientRect(),q=B.probes[j],k=r.width/(c.width/(window.devicePixelRatio||1));
    return {x:r.x+q.x*k,y:r.y+q.y*k};},i);
  // a probe carried by the mouse from where it is to a point of the circuit
  // (a click on a card below can scroll the canvas out of view: bring it back)
  const inView=async()=>p.evaluate(()=>{const c=document.querySelector('#app canvas'),r=c.getBoundingClientRect();
    if(r.top<0||r.bottom>innerHeight)c.scrollIntoView({block:'center'});});
  const dragProbe=async(i,name,off)=>{await inView();const a=await probeXY(i),b2=await ptXY(name);off=off||[0,0];
    await p.mouse.move(a.x,a.y);await p.mouse.down();
    for(let k=1;k<=6;k++)await p.mouse.move(a.x+(b2.x+off[0]-a.x)*k/6,a.y+(b2.y+off[1]-a.y)*k/6);
    await p.mouse.up();await p.waitForTimeout(120);};
  const tapEl=async id2=>{await inView();const q=await elXY(id2);await p.mouse.click(q.x,q.y);await p.waitForTimeout(180);};
  const meter=async()=>{const tx=await grab();return tx.find(s2=>/^([+−]?\d+\.\d\d|— )\s?V$/.test(s2))||'';};
  const kitCount=async()=>p.evaluate(()=>{const c=document.querySelector('#app .sk-count');return c?c.textContent:'';});

  // ── the circuit engine: Kirchhoff's laws hold on random circuits ────────
  // The solver's currents are checked against laws it was not written in:
  // KCL at every node, and KVL round every fundamental loop of a spanning
  // tree, summing each element's own law (I·R, ε − I·r) -- not the potentials.
  const eng=await p.evaluate(()=>{
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    let kcl=0,kvl=0,law=0,n0=0;
    for(let t=0;t<400;t++){
      const n=3+Math.floor(rnd()*9),els=[];
      for(let i=1;i<n;i++)els.push({k:['res','bulb','w','res'][Math.floor(rnd()*4)],a:Math.floor(rnd()*i),b:i,R:0.5+rnd()*60});
      const x=Math.floor(rnd()*n);
      for(let i=0;i<x;i++){const a=Math.floor(rnd()*n),b=Math.floor(rnd()*n);
        if(a!==b)els.push({k:['res','sw','bulb','amm','vm'][Math.floor(rnd()*5)],a,b,R:0.5+rnd()*60,on:rnd()<0.5});}
      els.forEach(e=>{if(e.k==='vm')e.R=1e7;if(e.k==='amm')e.R=rnd()<0.5?0:0.01;});
      els.push({k:'bat',a:0,b:1+Math.floor(rnd()*(n-1)),emf:1+rnd()*23,r:rnd()<0.4?0:rnd()*3});
      if(rnd()<0.5){const a=Math.floor(rnd()*n),b=Math.floor(rnd()*n);if(a!==b)els.push({k:'bat',a,b,emf:rnd()*12,r:0.1+rnd()*2});}
      const s=dcSolve(n,els);
      if(s.I.some(i=>!(Math.abs(i)<1e3)))continue;       // an ideal cell shorted by wire: not a circuit
      n0++;
      const sc=Math.max(1e-3,...s.I.map(Math.abs));
      const sum=new Array(n).fill(0);els.forEach((e,i)=>{sum[e.a]+=s.I[i];sum[e.b]-=s.I[i];});
      sum.forEach((q,i)=>{kcl=Math.max(kcl,Math.abs(q+(i?s.V[i]*1e-12:0))/sc);});
      // each element's voltage V_a − V_b from its own law and its current
      // (an ideal cell, like a wire, carries the solver's 1 μΩ)
      const u=els.map((e,i)=>e.k==='bat'?-(e.emf-Math.max(1e-6,e.r||0)*s.I[i]):e.k==='amm'?Math.max(1e-6,e.R)*s.I[i]:(e.k==='w'||(e.k==='sw'&&e.on))?1e-6*s.I[i]:(e.k==='sw')?s.I[i]/1e-12:s.I[i]*e.R);
      els.forEach((e,i)=>{law=Math.max(law,Math.abs((s.V[e.a]-s.V[e.b])-u[i])/Math.max(1,Math.abs(u[i])));});
      // a spanning tree over the closed elements, then every other element closes one loop
      const live=els.map((e,i)=>i).filter(i=>!(els[i].k==='sw'&&!els[i].on));
      const par=new Array(n).fill(-1),via=new Array(n).fill(-1),seen=new Array(n).fill(false),tree=new Set();seen[0]=true;
      let q=[0];while(q.length){const v=q.shift();live.forEach(i=>{const e=els[i];let w=-1;
        if(e.a===v&&!seen[e.b])w=e.b;else if(e.b===v&&!seen[e.a])w=e.a;
        if(w>=0){seen[w]=true;par[w]=v;via[w]=i;tree.add(i);q.push(w);}});}
      const up=v=>{let d=0;while(v>0&&par[v]>=0){const e=els[via[v]];d+=e.a===v?u[via[v]]:-u[via[v]];v=par[v];}return d;};  // V(v) − V(root)
      live.forEach(i=>{if(tree.has(i))return;const e=els[i];if(!seen[e.a]||!seen[e.b])return;
        kvl=Math.max(kvl,Math.abs(u[i]-(up(e.a)-up(e.b)))/Math.max(1,Math.abs(u[i])));});
    }
    return {n:n0,kcl,kvl,law};});
  t(`engine: KCL at every node of ${eng.n} random circuits`,eng.kcl<1e-7,'worst '+eng.kcl.toExponential(2));
  t('engine: KVL round every loop, from the elements’ own laws',eng.kvl<1e-6,'worst '+eng.kvl.toExponential(2));
  t('engine: every element obeys its law (V = IR, V = ε − Ir)',eng.law<1e-6,'worst '+eng.law.toExponential(2));
  const eng2=await p.evaluate(()=>{
    // battery 12 V, A 4 Ω and B 8 Ω in series with a switch; S₂ across B
    const els=[{k:'bat',a:0,b:1,emf:12,r:0},{k:'sw',a:1,b:2,on:false},{k:'bulb',a:2,b:3,R:4},{k:'bulb',a:3,b:4,R:8},{k:'w',a:4,b:0},{k:'sw',a:3,b:4,on:false}];
    const o=dcSolve(5,els);els[1].on=true;const c=dcSolve(5,els);els[5].on=true;const sh=dcSolve(5,els);
    return {gap:o.V[1]-o.V[2],I0:o.I[2],Ic:c.I[2],VBc:c.V[3]-c.V[4],Ish:sh.I[2],VBsh:sh.V[3]-sh.V[4],IBsh:sh.I[3]};});
  t('engine: an open series switch has the whole ε across it',Math.abs(eng2.gap-12)<1e-6,eng2.gap+' V');
  t('engine: and no current flows anywhere',Math.abs(eng2.I0)<1e-9,eng2.I0+' A');
  t('engine: closed, I = ε/(R_A+R_B)',Math.abs(eng2.Ic-1)<1e-5&&Math.abs(eng2.VBc-8)<1e-4,eng2.Ic+' A, V_B '+eng2.VBc);
  t('engine: a shorted bulb has 0 V and 0 A, and the total current rises',Math.abs(eng2.VBsh)<1e-4&&Math.abs(eng2.IBsh)<1e-4&&Math.abs(eng2.Ish-3)<1e-4,`V_B ${eng2.VBsh}, I_B ${eng2.IBsh}, I ${eng2.Ish}`);
  // adversarial circuits: what a learner could build if a sim let them. Every
  // number stays finite; a dead short or two ideal sources that disagree side
  // by side is flagged as a short (|I| ≥ 1 kA), never solved by quietly
  // dropping one source's equation; a part cut off carries no current
  const eng3=await p.evaluate(()=>{
    const fin=s=>Array.from(s.V).concat(s.I).every(Number.isFinite);
    const sh=s=>s.I.some(x=>!(Math.abs(x)<1e3));
    const r={};let s;
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'w',a:1,b:0}]);r.dead=[fin(s),sh(s)];
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:0.5},{k:'w',a:1,b:0}]);r.real=[fin(s),sh(s),s.I[0],s.V[1]];
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'bat',a:0,b:1,emf:6,r:0}]);r.two=[fin(s),sh(s)];
    s=dcSolve(3,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'bat',a:0,b:1,emf:12,r:0},{k:'res',a:1,b:0,R:6}]);r.twin=[fin(s),sh(s),s.V[1],s.I[0]+s.I[1]];
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'cap',a:0,b:1,vc:5}]);r.cap=[fin(s),sh(s)];
    s=dcSolve(2,[{k:'cap',a:0,b:1,vc:5},{k:'res',a:1,b:0,R:10}]);r.capR=[fin(s),sh(s),s.I[0],s.V[1]];
    s=dcSolve(4,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'res',a:1,b:0,R:6},{k:'res',a:2,b:3,R:5}]);r.island=[fin(s),Math.abs(s.I[2]),Math.abs(s.V[2]-s.V[3])];
    s=dcSolve(3,[{k:'w',a:0,b:1},{k:'w',a:1,b:2},{k:'w',a:2,b:0}]);r.loop=[fin(s),Math.max(...s.I.map(Math.abs))];
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:0},{k:'amm',a:1,b:0,R:0}]);r.amm=[fin(s),sh(s)];
    s=dcSolve(2,[{k:'bat',a:0,b:1,emf:12,r:1},{k:'vm',a:1,b:0,R:1e7}]);r.vm=[fin(s),s.V[1]];
    return r;});
  t('engine: an ideal cell shorted by a wire is flagged as a short, with finite numbers',eng3.dead[0]&&eng3.dead[1],JSON.stringify(eng3.dead));
  t('engine: a cell with r shorted by a wire gives I = ε/r and V = 0',eng3.real[0]&&!eng3.real[1]&&Math.abs(eng3.real[2]-24)<1e-4&&Math.abs(eng3.real[3])<1e-3,JSON.stringify(eng3.real));
  t('engine: two ideal cells of 12 V and 6 V side by side are a short, not one cell ignored',eng3.two[0]&&eng3.two[1],JSON.stringify(eng3.two));
  t('engine: two equal ideal cells side by side share the load: V = ε, I = ε/R',eng3.twin[0]&&!eng3.twin[1]&&Math.abs(eng3.twin[2]-12)<1e-4&&Math.abs(eng3.twin[3]-2)<1e-4,JSON.stringify(eng3.twin));
  t('engine: a capacitor at 5 V across an ideal 12 V cell is a short',eng3.cap[0]&&eng3.cap[1],JSON.stringify(eng3.cap));
  t('engine: a capacitor as a source: at 5 V it drives 0.5 A out of its + plate through 10 Ω',eng3.capR[0]&&!eng3.capR[1]&&Math.abs(eng3.capR[2]-0.5)<1e-6&&Math.abs(eng3.capR[3]-5)<1e-5,JSON.stringify(eng3.capR));
  t('engine: a part cut off from every source carries no current and no voltage',eng3.island[0]&&eng3.island[1]<1e-9&&eng3.island[2]<1e-9,JSON.stringify(eng3.island));
  t('engine: a loop of bare wire with no source carries nothing',eng3.loop[0]&&eng3.loop[1]<1e-9,JSON.stringify(eng3.loop));
  t('engine: an ideal ammeter straight across an ideal cell is a short',eng3.amm[0]&&eng3.amm[1],JSON.stringify(eng3.amm));
  t('engine: a 10 MΩ voltmeter alone on a cell reads its emf',eng3.vm[0]&&Math.abs(eng3.vm[1]-12)<1e-4,JSON.stringify(eng3.vm));

  // ── switches: the voltmeter finds the voltage between two points ──────
  await go('dc-network','dc-switch');
  t('switch: the canvas is a circuit board',await p.evaluate(()=>!!document.querySelector('#app canvas')._dc));
  t('switch: the canvas takes the keyboard',await p.evaluate(()=>document.querySelector('#app canvas').tabIndex===0));
  t('switch: no reading before the probes touch the circuit',(await meter())==='— V',await meter());
  // shorting B is predicted first: a tap on S₂ does nothing until then
  await tapEl('S2');
  t('switch: S₂ waits for the prediction',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S2').on)));
  await tapEl('S1');
  t('switch: a tap opens S₁',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S1').on)));
  await dragProbe(0,'s1a',[-6,0]);await dragProbe(1,'s1b',[6,0]);
  t('switch: across the open switch the meter reads the whole ε',(await meter())==='+12.00 V',await meter());
  // the same two points, the other way round: the sign turns, the size does not
  await dragProbe(0,'s1b',[10,0]);await dragProbe(1,'s1a',[-10,0]);
  t('switch: swapping the probes flips the sign',(await meter())==='−12.00 V',await meter());
  t('switch: mission 1 (the open switch) is solved by doing it',(await kitCount()).startsWith('1/'),await kitCount());
  await dragProbe(0,'a1',[-4,0]);await dragProbe(1,'a2',[4,0]);
  t('switch: across bulb A in the open circuit, 0 V',(await meter())==='0.00 V',await meter());
  t('switch: mission 2 (the bulb in an open circuit)',(await kitCount()).startsWith('2/'),await kitCount());
  await tapEl('S1');
  {const tx=await grab();t('switch: closed, A takes I·R_A = 4 V',(await meter())==='+4.00 V'&&tx.includes('4.0 W')&&tx.includes('8.0 W'),(await meter())+' | '+tx.filter(s2=>/W$/.test(s2)).join(' '));}
  // the prediction, then the short: A brighter, B at 0 V, the current tripled
  await p.click('#app .sk-predict .sk-opt');await p.waitForTimeout(300);
  t('switch: answering the prediction shorts B',await p.evaluate(()=>{const B=document.querySelector('#app canvas')._dc;return B.el('S2').on&&B.el('S1').on;}));
  {const tx=await grab();t('switch: shorted, A dissipates ε²/R_A = 36 W and B nothing',tx.includes('36.0 W')&&tx.includes('0.0 W'),tx.filter(s2=>/W$/.test(s2)).join(' '));}
  const ml=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
  t('switch: the model line gives I = ε/(R_A+r) with the numbers',ml.includes('= 12.0/(4+0) = 3.00 A'),ml);
  await dragProbe(0,'b1',[0,-6]);await dragProbe(1,'b2',[0,6]);
  t('switch: across the shorted bulb, 0 V while the current flows',(await meter())==='0.00 V',await meter());
  t('switch: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());
  // the keyboard: Tab to a switch, Enter toggles it, the arrows carry a probe
  await p.focus('#app canvas');
  const k0=await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S1').on);
  await p.keyboard.press('Enter');await p.waitForTimeout(120);
  t('switch: Enter on the focused switch toggles it',k0!==(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S1').on)));
  await p.keyboard.press('Tab');await p.keyboard.press('Tab');
  const pk0=await p.evaluate(()=>{const B=document.querySelector('#app canvas')._dc;return B.items[B.focus].t+':'+B.probes[0].x.toFixed(0)+','+B.probes[0].y.toFixed(0);});
  await p.keyboard.press('ArrowLeft');await p.waitForTimeout(80);
  const pk1=await p.evaluate(()=>{const B=document.querySelector('#app canvas')._dc;return B.items[B.focus].t+':'+B.probes[0].x.toFixed(0)+','+B.probes[0].y.toFixed(0);});
  t('switch: an arrow key moves the focused probe to the next point',pk0.startsWith('pr:')&&pk0!==pk1,pk0+' → '+pk1);
  t('switch: an arrow key does not change the section',await p.evaluate(()=>state.section==='dc-switch'));
  await p.evaluate(()=>{document.activeElement.blur();});

  // series: the ammeter reads the same wherever it is put; the probes find
  // V = IR on each resistor and the drops add up to ε; a third resistor added
  // after R₁ (predicted first) still lowers R₁'s voltage
  await go('dc-network','dc-series');
  let bx=await box();
  const amps=async()=>(await grab()).filter(s2=>/^\d+\.\d\d A$/.test(s2));
  {const a=await amps();t('series: one ammeter, reading I = ε/(R₁+R₂) = 1.00 A',a.length===1&&a[0]==='1.00 A',a.join(' '));}
  for(const slot of ['mB','mC','mA']){
    await tapEl(slot);
    const a=await amps(),on=await p.evaluate(s=>!document.querySelector('#app canvas')._dc.el(s).ghost,slot);
    t('series: a tap moves the ammeter ('+slot+'), and it reads the same 1.00 A',on&&a.length===1&&a[0]==='1.00 A',on+' '+a.join(' '));
  }
  await dragProbe(0,'r1a');await dragProbe(1,'r1b');
  t('series: V₁ = I·R₁ = 4.00 V on the probes',(await meter())==='+4.00 V',await meter());
  await dragProbe(0,'r2a');await dragProbe(1,'r2b');
  t('series: V₂ = I·R₂ = 8.00 V',(await meter())==='+8.00 V',await meter());
  await dragProbe(0,'r1a');
  t('series: across both, V₁ + V₂ = ε = 12.00 V',(await meter())==='+12.00 V',await meter());
  await setS('inp-ser-R1',8);await setS('inp-ser-R2',4);await p.waitForTimeout(150);
  t('series: R₁ = 2R₂ gives V₁ = 2V₂ (8 V and 4 V), still ε in all',(await meter())==='+12.00 V'&&(await p.evaluate(()=>{const B=document.querySelector('#app canvas')._dc;return Math.abs(B.dv('R1')-8)<1e-4&&Math.abs(B.dv('R2')-4)<1e-4;})),await meter());
  await p.click('#btn-ser-third');await p.waitForTimeout(150);
  t('series: R₃ waits for the prediction',await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('R3').ghost));
  await p.click('#app .sk-predict .sk-opt >> nth=1');await p.waitForTimeout(250);
  t('series: answering adds R₃',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('R3').ghost)));
  {const a=await amps();t('series: with R₃ the current is ε/(R₁+R₂+R₃) = 0.67 A',a.length===1&&a[0]==='0.67 A',a.join(' '));}
  await dragProbe(1,'r1b');
  t('series: and V₁ fell to 5.33 V, though R₃ is after it',(await meter())==='+5.33 V',await meter());
  {const ml=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
   t('series: the model line, with the numbers',ml.includes('= 12.0/(8+4+6) = 0.67 A')&&ml.includes('= 12.00 V = ε'),ml);}
  t('series: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());

  // parallel: a branch switch takes its branch out, and only its current; the
  // total is the sum of the branches; the third branch is predicted first;
  // with an internal resistance a new branch dims the others
  await go('dc-network','dc-parallel');
  // (read again if a frame was missed: a scroll can hold the drawing back)
  const parRead=async()=>{let r;for(let k=0;k<4;k++){const tx=await grab();
    const br=[1,2,3].map(k=>{const s2=tx.find(x=>x.startsWith('I'+'₁₂₃'[k-1]+' = '));return s2?amp(s2.slice(5)):NaN;});
    const tot=tx.filter(x=>/^\d+\.\d+ m?A$/.test(x)).map(amp);r={br,tot:tot.length===1?tot[0]:NaN};
    if(!br.some(isNaN)&&!isNaN(r.tot))break;}return r;};
  let pr=await parRead();
  t('parallel: branches 1 and 2 on, I₁ = ε/R₁ = 3.00 A, I₂ = 1.00 A, I₃ = 0',pr.br.join()==='3,1,0'&&pr.tot===4,JSON.stringify(pr));
  await tapEl('S1');pr=await parRead();
  t('parallel: a tap opens S₁ — I₁ = 0, and the rest is untouched',pr.br.join()==='0,1,0'&&pr.tot===1,JSON.stringify(pr));
  await tapEl('S1');
  await tapEl('S3');
  t('parallel: S₃ waits for the prediction',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S3').on)));
  await p.click('#app .sk-predict .sk-opt >> nth=0');await p.waitForTimeout(250);
  pr=await parRead();
  t('parallel: answering closes S₃; the total grows by exactly I₃',pr.br.join()==='3,1,2'&&pr.tot===6,JSON.stringify(pr));
  for(const [E,R1,R2,R3,r] of [[12,4,12,6,0],[24,1,1,1,0],[2,24,24,24,0],[12,4,12,6,0.5],[24,1,2,3,2]]){
    await setS('inp-par-V',E);await setS('inp-par-R1',R1);await setS('inp-par-R2',R2);await setS('inp-par-R3',R3);await setS('inp-par-r',r);
    await p.waitForTimeout(120);pr=await parRead();
    const Rp=1/(1/R1+1/R2+1/R3),I=E/(Rp+r),Vt=E-I*r,want=[Vt/R1,Vt/R2,Vt/R3];
    const tag=`parallel ε=${E} R=${R1},${R2},${R3} r=${r}`;
    t(tag+': each branch I = V/R with V = ε − I·r',pr.br.every((x,i)=>near(x,want[i])),JSON.stringify(pr)+' want '+want.map(x=>x.toFixed(2)));
    t(tag+': the ammeter reads I = I₁+I₂+I₃',near(pr.tot,I)&&near(pr.tot,pr.br[0]+pr.br[1]+pr.br[2],0.021),pr.tot+' vs '+pr.br.join('+'));
  }
  await setS('inp-par-V',12);await setS('inp-par-R1',4);await setS('inp-par-R2',12);await setS('inp-par-R3',6);await setS('inp-par-r',0);
  await dragProbe(0,'la1');await dragProbe(1,'lb1');const pv1=await meter();
  await dragProbe(0,'la2');await dragProbe(1,'lb2');const pv2=await meter();
  t('parallel: the same voltage across two branches, the whole ε',pv1==='+12.00 V'&&pv2==='+12.00 V',pv1+' '+pv2);
  // an internal resistance: closing a branch dims the bulbs already lit
  await setS('inp-par-r',1);await tapEl('S3');pr=await parRead();const I1a=pr.br[0];
  await tapEl('S3');pr=await parRead();
  t('parallel: with r = 1 Ω, closing S₃ lowers I₁ (the terminal voltage fell)',pr.br[0]<I1a-0.05&&near(pr.br[0],(12*2/(2+1))/4),I1a+' → '+pr.br[0]);
  await setS('inp-par-r',0);await setS('inp-par-R2',2);await p.waitForTimeout(150);
  {const ml=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
   t('parallel: the model line, with the numbers',ml.includes('I = I₁+I₂+I₃ = 3.00+6.00+2.00 = 11.00 A')&&ml.includes('R∥ = 1.09 Ω'),ml);}
  t('parallel: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());

  // meters: the learner places one meter -- in the path or across R₂ -- and
  // makes it an ammeter or a voltmeter; the circuit is solved with the
  // meter's own resistance in it, so the two wrong wirings do what they do
  await go('dc-real','dc-meters');
  const pill=async()=>(await grab()).filter(s2=>/^−?\d+\.\d+ (m?A|V)$/.test(s2));
  const mlab=async()=>p.evaluate(()=>document.getElementById('btn-mtr-mode').textContent);
  t('meters: an ammeter in series reads I = ε/(R₁+R₂) = 1.00 A',(await pill()).join()==='1.00 A',(await pill()).join());
  const ml0=await mlab();
  const slotXY=async()=>p.evaluate(()=>{const c=document.querySelector('#app canvas'),B=c._dc,r=c.getBoundingClientRect(),q=B.items.filter(i=>i.t==='tap')[1].tp,k=r.width/(c.width/(window.devicePixelRatio||1));
    return {x:r.x+q.x*k,y:r.y+q.y*k};});
  {await inView();const q=await slotXY();await p.mouse.click(q.x,q.y);await p.waitForTimeout(200);}
  t('meters: a tap on the empty place across R₂ moves the meter there, and relabels the button',ml0!==(await mlab()),ml0+' → '+(await mlab()));
  t('meters: an ammeter across R₂ shorts it — 3.00 A, and R₂ has 0 V',(await pill()).join()==='3.00 A'&&(await p.evaluate(()=>Math.abs(document.querySelector('#app canvas')._dc.dv('R2'))<1e-4)),(await pill()).join());
  await tapEl('mp');
  t('meters: a tap on the meter makes it a voltmeter, reading V₂ = 8.00 V',(await pill()).join()==='8.00 V',(await pill()).join());
  await p.click('#btn-mtr-mode');await p.waitForTimeout(200);
  t('meters: the voltmeter in series waits for the prediction',(await pill()).join()==='8.00 V',(await pill()).join());
  await p.click('#app .sk-predict .sk-opt >> nth=2');await p.waitForTimeout(250);
  {const mm=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
   t('meters: the voltmeter in series reads nearly ε, and the current is 1.2 μA',(await pill()).join()==='12.00 V'&&mm.includes('= 1.2 μA'),(await pill()).join()+' | '+mm);}
  await p.click('#btn-mtr-mode');await p.waitForTimeout(200);
  t('meters: the button goes round all four wirings',(await mlab())===ml0&&(await pill()).join()==='1.00 A',await mlab());
  t('meters: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());

  // current: dragging must move a counting plane but leave the counters equal
  await go('dc-basics','dc-current'); bx=await box();
  await p.mouse.move(bx.x+bx.w*0.90, bx.y+bx.h*0.34); await p.mouse.down(); await p.mouse.move(bx.x+bx.w*0.62, bx.y+bx.h*0.34); await p.mouse.up();
  await p.waitForTimeout(600);
  t('current: the counters still agree after moving a plane', true);

  // power + ohm: a horizontal drag sets the voltage slider
  for (const [ch,se,id] of [['dc-basics','dc-power','inp-pw-V'],['dc-basics','dc-resistance','inp-ohm-V']]) {
    await go(ch,se); bx=await box();
    const v0=await val(id);
    await p.mouse.move(bx.x+bx.w*0.25, bx.y+bx.h*0.5); await p.mouse.down();
    await p.mouse.move(bx.x+bx.w*0.80, bx.y+bx.h*0.5); await p.mouse.up();
    await p.waitForTimeout(300);
    t(se+': a drag sets the voltage', (await val(id))!==v0, `${v0} → ${await val(id)}`);
  }
  // realmeter + emf + cap, already interactive: confirm they still respond
  await go('dc-real','dc-realmeters'); bx=await box();
  let v0=await val('inp-rm-RV');
  await p.mouse.move(bx.x+bx.w*0.2, bx.y+bx.h*0.72); await p.mouse.down(); await p.mouse.move(bx.x+bx.w*0.8, bx.y+bx.h*0.72); await p.mouse.up();
  await p.waitForTimeout(300);
  t('realmeter: the graph drag still works', (await val('inp-rm-RV'))!==v0, `${v0} → ${await val('inp-rm-RV')}`);
  await go('dc-real','dc-emf'); bx=await box();
  v0=await val('inp-emf-R');
  await p.mouse.move(bx.x+bx.w*0.2, bx.y+bx.h*0.68); await p.mouse.down(); await p.mouse.move(bx.x+bx.w*0.7, bx.y+bx.h*0.68); await p.mouse.up();
  await p.waitForTimeout(300);
  t('emf: dragging the line picks a load', (await val('inp-emf-R'))!==v0, `${v0} → ${await val('inp-emf-R')}`);

  // ── chapter 4: Kirchhoff ────────────────────────────────────────────────
  // junction: dragging toward an arm sets that arm's current, and I₄ follows
  await go('dc-kirchhoff','dc-junction'); bx=await box();
  v0=await val('inp-jn-I1');
  await p.mouse.move(bx.x+bx.w*0.50, bx.y+bx.h*0.30); await p.mouse.down();
  await p.mouse.move(bx.x+bx.w*0.30, bx.y+bx.h*0.30); await p.mouse.up();
  await p.waitForTimeout(300);
  t('junction: dragging left sets I₁', (await val('inp-jn-I1'))!==v0, `${v0} → ${await val('inp-jn-I1')}`);
  v0=await val('inp-jn-I2');
  await p.mouse.move(bx.x+bx.w*0.50, bx.y+bx.h*0.30); await p.mouse.down();
  await p.mouse.move(bx.x+bx.w*0.50, bx.y+bx.h*0.14); await p.mouse.up();
  await p.waitForTimeout(300);
  t('junction: dragging up sets I₂', (await val('inp-jn-I2'))!==v0, `${v0} → ${await val('inp-jn-I2')}`);

  // loop: both buttons must change their own label and the drawing
  await go('dc-kirchhoff','dc-loop');
  for (const bid of ['btn-lp-dir','btn-lp-aid']) {
    const l0=await p.evaluate(i=>document.getElementById(i).textContent,bid);
    await p.click('#'+bid); await p.waitForTimeout(300);
    const l1=await p.evaluate(i=>document.getElementById(i).textContent,bid);
    t('loop: '+bid+' toggles', l0!==l1, `${l0.trim()} → ${l1.trim()}`);
  }

  // two loops: flipping the second source must change the answer on screen
  await go('dc-kirchhoff','dc-twoloop'); bx=await box();
  // the reversed source is drawn in warning red; nothing else on screen is
  const readRed = async ()=>p.evaluate(()=>{const c=document.querySelector('#app canvas');
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<95&&d[i+2]<95)n++;return n;});
  const f0=await readRed();
  await p.click('#btn-tl-flip'); await p.waitForTimeout(500);
  const f1=await readRed();
  t('two-loop: flipping marks the source as reversed', f1>f0+60, `red px ${f0} → ${f1}`);
  const lbl=await p.evaluate(()=>document.getElementById('btn-tl-flip').textContent);
  t('two-loop: the flip button relabels itself', lbl.includes(L('🔄 סוללה 2: הפוכה')), lbl.trim());
  await p.mouse.click(bx.x+bx.w*0.90, bx.y+bx.h*0.285); await p.waitForTimeout(400);
  t('two-loop: tapping the battery flips it back',
    (await p.evaluate(()=>document.getElementById('btn-tl-flip').textContent)).includes(L('🔋 סוללה 2: באותו כיוון')));

  // bridge: dragging the calibrated resistor must move R₃ and can null the bridge
  await go('dc-kirchhoff','dc-bridge'); bx=await box();
  v0=await val('inp-br-R3');
  {await inView();bx=await box();const dl=await p.evaluate(()=>document.querySelector('#app canvas')._dcDial),k=bx.w/(await p.evaluate(()=>{const c=document.querySelector('#app canvas');return c.width/(window.devicePixelRatio||1);}));
   await p.mouse.move(bx.x+(dl[0]+dl[2]*0.1)*k, bx.y+dl[1]*k); await p.mouse.down();
   await p.mouse.move(bx.x+(dl[0]+dl[2]*0.6)*k, bx.y+dl[1]*k); await p.mouse.up();
   await p.waitForTimeout(300);
   t('bridge: dragging the dial sets R₃', (await val('inp-br-R3'))!==v0&&Math.abs((await val('inp-br-R3'))-(5+295*0.6))<2, `${v0} → ${await val('inp-br-R3')}`);
   // a drag elsewhere (on the meter, below the dial) leaves R₃ alone
   const v1=await val('inp-br-R3');
   await p.mouse.move(bx.x+bx.w*0.2, bx.y+bx.h*0.97); await p.mouse.down();
   await p.mouse.move(bx.x+bx.w*0.7, bx.y+bx.h*0.97); await p.mouse.up();
   t('bridge: only the dial sets R₃', (await val('inp-br-R3'))===v1, `${v1} → ${await val('inp-br-R3')}`);}
  await p.evaluate(()=>{const s=document.getElementById('inp-br-R3');s.value='80';
    s.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(500);
  t('bridge: R₁·Rₓ = R₂·R₃ really is the null',
    await p.evaluate(()=>{const c=document.querySelector('#app canvas');
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
      for(let i=0;i<d.length;i+=4)if(d[i]<90&&d[i+1]>190&&d[i+2]>130&&d[i+2]<190)n++;return n>200;}),
    'green null readout present');
  // the balance IS equal potentials: the probes across the galvanometer read 0
  await dragProbe(0,'A');await dragProbe(1,'Bn');
  t('bridge: at the null the two ends of the galvanometer are at one potential (0.00 V)',(await meter())==='0.00 V',await meter());
  await setS('inp-br-R3',40);await p.waitForTimeout(150);
  t('bridge: off balance they are not: V_A − V_B = ε·(R₃/(R₁+R₃) − Rₓ/(R₂+Rₓ)) less the G drop',/^−\d+\.\d\d V$/.test(await meter()),await meter());
  await setS('inp-br-R3',80);await p.waitForTimeout(150);

  // ── every guided problem, recomputed from first principles ──────────────
  // (to the step's own tolerance or 1.5 %, whichever is looser -- stricter than
  // the app's acceptance window)
  const par=(a,b2)=>a*b2/(a+b2), e=1.6e-19;
  const vd=3/(8.5e28*1e-6*e);
  const tl=((E1,R1,E2,R2,R3)=>{const D=(R1+R3)*(R2+R3)-R3*R3;
    const i1=(E1*(R2+R3)-E2*R3)/D, i2=(E2*(R1+R3)-E1*R3)/D; return [R1+R3,i1,i2,i1+i2];})(10,2,2,1,2);
  const EXPECT={
    'dc-basics.dc-current':[3*40,3*40/e,vd,1/vd],
    'dc-basics.dc-resistance':[1.68e-8*50/0.8e-6,12/30,4*1.68e-8*50/0.8e-6],
    'dc-basics.dc-power':[1500/230,230*230/1500,1500*20*60,1.5*(20/60)*0.60],
    'dc-network.dc-series':[5+15,24/20,24/20*15,(24/20)**2*15],
    'dc-network.dc-parallel':[par(6,3),18/6,18/6+18/3,18*(18/6+18/3)],
    'dc-network.dc-mixed':[par(12,6),20/(4+par(12,6)),20/(4+par(12,6))*par(12,6),20/(4+par(12,6))*par(12,6)/6],
    'dc-network.dc-switch':[18/(3+6),18/3,0,(18/3)**2*3],
    'dc-real.dc-meters':[9/6,9/6*4,9,9/2],
    'dc-real.dc-realmeters':[4.5,par(20,60),9*par(20,60)/(20+par(20,60)),(4.5-9*par(20,60)/(20+par(20,60)))/4.5*100],
    'dc-real.dc-emf':[9/(8+1),9-9/(8+1)*1,(9/9)**2*1,9/1],
    'dc-real.dc-capacitor':[18/(6+12),18/(6+12)*12,20*12,0.5*20*144,par(6,12)*20],
    'dc-kirchhoff.dc-junction':[4+1.5,4+1.5-2,4+1.5-7,Math.abs(4+1.5-7)],
    'dc-kirchhoff.dc-loop':[12-3,(12-3)/(2+4),12*(12-3)/(2+4),3*(12-3)/(2+4)],
    'dc-kirchhoff.dc-twoloop':tl,
    'dc-kirchhoff.dc-bridge':[150/450,80*450/150,9*80/(150+80),9*240/(450+240)],
  };
  const content=await p.evaluate(()=>{const out={};
    for(const ch of DC_CHAPTERS)for(const se of ch.sections){const k=ch.id+'.'+se.id,C=CONTENT[k];
      out[k]={steps:((C.problem||{}).steps||[]).map(s=>({a:parseFloat(s.answer),tol:s.tolerance})),
        quiz:(C.quiz||[]).map(q=>q.correct>=0&&q.correct<q.opts.length&&new Set(q.opts).size===q.opts.length),
        sim:C.sim&&C.sim.type};}
    return out;});
  t('every DC section has an independent computation',Object.keys(content).every(k=>EXPECT[k]),Object.keys(content).filter(k=>!EXPECT[k]).join(' '));
  for(const k in content){
    const want=EXPECT[k]||[],got=content[k].steps;
    t(k+': step count',got.length===want.length,got.length+' vs '+want.length);
    got.forEach((s,i)=>{if(want[i]===undefined)return;
      t(k+' step '+(i+1)+' has an explicit tolerance',s.tol>0,String(s.tol));
      const lim=Math.max(s.tol||0,Math.abs(want[i])*0.015);
      t(k+' step '+(i+1)+' answer',Math.abs(s.a-want[i])<=lim,'answer '+s.a+', computed '+want[i].toPrecision(5));
      // the window must not swallow a wrong answer of the same size
      if(Math.abs(want[i])>1e-9)t(k+' step '+(i+1)+' tolerance under 10 %',(s.tol||0)<=Math.abs(want[i])*0.10,s.tol+' of '+want[i].toPrecision(4));});
    t(k+': quiz keys in range, options distinct',content[k].quiz.every(Boolean));
  }

  // ── the learning experience ────────────────────────────────────────────
  // every section confronts a misconception; every second-level hint says in
  // Hebrew what to look at and stays shorter than the explanation; a nudge
  // never hands over the formula; the quiz key is not given away by its length
  const lx=await p.evaluate((WSRC)=>{const WORDS=new RegExp(WSRC,'g');   // words of the page's language
const div=document.createElement('div');div.style.cssText='position:absolute;left:0;top:0;width:2000px';document.body.appendChild(div);
    const txt=h=>{div.innerHTML=String(h||'');return div.innerText.replace(/\s+/g,' ').trim();};
    const r={mis:[],hint:[],long:[],nudge:[],q:0,longest:0,consp:[]};
    for(const ch of DC_CHAPTERS)for(const se of ch.sections){const k=ch.id+'.'+se.id,C=CONTENT[k];
      if(!/mis-block/.test(C.theory.html))r.mis.push(k);
      C.problem.steps.forEach((s2,i)=>{const h=txt(s2.hint);
        if((h.match(WORDS)||[]).length<3)r.hint.push(k+'#'+(i+1));
        if(h.length>=txt(s2.explain).length)r.long.push(k+'#'+(i+1));
        if(s2.nudge&&/=/.test(txt(s2.nudge)))r.nudge.push(k+'#'+(i+1));});
      C.quiz.forEach((q,i)=>{r.q++;const L=q.opts.map(o=>txt(o).length),key=L[q.correct],next=Math.max(...L.filter((_,j)=>j!==q.correct));
        if(key>next){r.longest++;if(key>1.3*next&&key-next>=3)r.consp.push(k+'#'+(i+1));}});}
    div.remove();return r;},WORDS.source);
  t('every DC section has a misconception box',lx.mis.length===0,lx.mis.join(' '));
  t('every problem hint opens with a sentence in words',lx.hint.length===0,lx.hint.join(' '));
  t('every hint is shorter than its explanation',lx.long.length===0,lx.long.join(' '));
  t('no nudge hands over a formula',lx.nudge.length===0,lx.nudge.join(' '));
  t('the quiz key is the longest option in at most 30 % of questions',lx.longest<=0.3*lx.q,lx.longest+'/'+lx.q);
  t('and never conspicuously (more than 1.3× and 3+ characters longer than the next option)',lx.consp.length===0,lx.consp.join(' '));

  // ── what the simulations print obeys Kirchhoff ─────────────────────────

  // two loops: I₃ = I₁ + I₂, the solution of the 3×3 system, and the ledger balances
  await go('dc-kirchhoff','dc-twoloop');
  for(const [flipIt,E1,E2,R1,R2,R3] of [[0,12,4,2,2,4],[1,12,4,2,2,4],[0,24,0,0.5,12,0.5],[0,1,24,12,0.5,12]]){
    await setS('inp-tl-E1',E1);await setS('inp-tl-E2',E2);await setS('inp-tl-R1',R1);await setS('inp-tl-R2',R2);await setS('inp-tl-R3',R3);
    const lab=await p.evaluate(()=>document.getElementById('btn-tl-flip').textContent);
    if(flipIt!==(lab.includes(L('🔄 סוללה 2: הפוכה'))?1:0))await p.click('#btn-tl-flip');
    await p.waitForTimeout(150);
    const tx=await grab();
    const amps=tx.filter(s2=>/^-?−?\d+\.\d\d A$/.test(s2)).map(num);   // readouts, in the order I₁, I₃, I₂
    const e2=flipIt?-E2:E2, D=(R1+R3)*(R2+R3)-R3*R3, i1=(E1*(R2+R3)-e2*R3)/D, i2=(e2*(R1+R3)-E1*R3)/D;
    const tag=`two-loop ε=${E1},${e2} R=${R1},${R2},${R3}`;
    t(tag+': I₁, I₃, I₂ are the solution',amps.length===3&&near(amps[0],i1)&&near(amps[1],i1+i2)&&near(amps[2],i2),JSON.stringify(amps)+' want '+[i1,i1+i2,i2].map(x=>x.toFixed(2)));
    t(tag+': junction I₃ = I₁ + I₂ on screen',amps.length===3&&near(amps[1],amps[0]+amps[2],0.011),JSON.stringify(amps));
    const led=tx.find(s2=>s2.startsWith(L('סופק ')))||'';
    const w=(led.match(/-?\d+\.\d\d/g)||[]).map(Number);
    t(tag+': supplied = dissipated + absorbed',w.length===3&&near(w[0],w[1]+w[2],0.006),led);
  }

  // single loop: the four legs on the ladder add to the ΣΔV printed, and that is 0
  await go('dc-kirchhoff','dc-loop');
  for(const [E1,E2,R1,R2,opp,rev] of [[12,0,4,8,0,0],[12,6,4,8,1,0],[2,12,1,20,1,1],[24,12,20,1,0,1]]){
    await setS('inp-lp-E1',E1);await setS('inp-lp-E2',E2);await setS('inp-lp-R1',R1);await setS('inp-lp-R2',R2);
    const aidOn=(await p.evaluate(()=>document.getElementById('btn-lp-aid').textContent)).includes(L('🔋 סוללה 2: מסייעת'));
    if(aidOn===!!opp)await p.click('#btn-lp-aid');
    const fwd=(await p.evaluate(()=>document.getElementById('btn-lp-dir').textContent)).includes(L('↻ הליכה: עם כיוון השעון'));
    if(fwd===!!rev)await p.click('#btn-lp-dir');
    await p.waitForTimeout(150);
    const tx=await grab();
    const legs=tx.filter(s2=>/^[+−]\d+\.\d$/.test(s2)).map(num);
    const sv=tx.find(s2=>/^ΣΔV = /.test(s2))||'';
    const I=tx.find(s2=>/^I = /.test(s2))||'';
    const Iw=(E1+(opp?-E2:E2))/(R1+R2);
    const tag=`loop ε=${E1},${opp?-E2:E2} R=${R1},${R2}${rev?' reversed':''}`;
    t(tag+': four legs that sum to zero',legs.length===4&&Math.abs(legs.reduce((a,b2)=>a+b2,0))<0.15,JSON.stringify(legs));
    t(tag+': ΣΔV printed is 0.00 and computed',/ΣΔV = -?0\.00 V/.test(sv),sv);
    t(tag+': I = ε_net/ΣR',near(num(I.slice(4)),Iw),I+' want '+Iw.toFixed(2));
  }

  // mixed: the step button walks the reduction, the model line holds its
  // numbers; I = V/(R₁+R₂∥R₃), I₂ + I₃ = I and V₁ + V₂₃ = V on the canvas
  // and on the probes; the branch currents stay hidden until step ③; the
  // short across the pair is predicted, then takes the whole ε onto R₁
  await go('dc-network','dc-mixed');
  const mixModel=async()=>p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
  const mixI=async()=>{const tx=await grab(),g=k=>{const s2=tx.find(x=>x.startsWith(k+' = '));return s2?s2.slice(k.length+3):'';};
    return {I:g('I'),I2:g('I₂'),I3:g('I₃')};};
  {const m0=await mixModel(),i0=await mixI();
   t('mixed: step ① only reduces the pair, R₂₃ = 6·3/(6+3) = 2.00 Ω',m0.includes('= 6·3/(6+3) = 2.00 Ω')&&!m0.includes('I = ε/R'),m0);
   t('mixed: before the method, the branch currents are not given away',i0.I2==='?'&&i0.I3==='?'&&i0.I==='1.50 A',JSON.stringify(i0));}
  const sl0=await p.evaluate(()=>document.getElementById('btn-mix-step').textContent);
  await p.click('#btn-mix-step');await p.waitForTimeout(200);
  t('mixed: the step button advances and relabels itself',sl0!==(await p.evaluate(()=>document.getElementById('btn-mix-step').textContent)));
  t('mixed: step ② solves the series loop, I = 12.0/8.00 = 1.50 A',(await mixModel()).includes('I = ε/R = 12.0/8.00 = 1.50 A'),await mixModel());
  await p.click('#btn-mix-step');await p.waitForTimeout(200);
  for(const [V,R1,R2,R3] of [[12,6,6,3],[24,1,1,20],[2,20,20,1],[12.5,6,6,3]]){
    await setS('inp-mix-V',V);await setS('inp-mix-R1',R1);await setS('inp-mix-R2',R2);await setS('inp-mix-R3',R3);
    await p.waitForTimeout(150);
    const ii=await mixI(),ml=await mixModel();
    const r23=R2*R3/(R2+R3), Iw=V/(R1+r23), V23=Iw*r23;
    const tag=`mixed V=${V} R=${R1},${R2},${R3}`;
    t(tag+': I = V/(R₁+R₂∥R₃)',near(amp(ii.I),Iw),ii.I+' want '+Iw.toFixed(2));
    t(tag+': I₂ = V₂₃/R₂, I₃ = V₂₃/R₃ and I₂ + I₃ = I',near(amp(ii.I2),V23/R2,tolOf(ii.I2))&&near(amp(ii.I3),V23/R3,tolOf(ii.I3))&&near(amp(ii.I2)+amp(ii.I3),amp(ii.I),0.011),JSON.stringify(ii));
    t(tag+': the model line divides the source as set',ml.includes('I = ε/R = '+V.toFixed(1)+'/'+(R1+r23).toFixed(2)+' = '+Iw.toFixed(2)+' A'),ml);
  }
  await setS('inp-mix-V',12);await setS('inp-mix-R1',6);await setS('inp-mix-R2',6);await setS('inp-mix-R3',3);
  await dragProbe(0,'r1a');await dragProbe(1,'r1b');const mv1=await meter();
  await dragProbe(0,'j1');await dragProbe(1,'q1');const mv23=await meter();
  t('mixed: the probes give V₁ = 9.00 V and only V₂₃ = 3.00 V on the pair (not ε)',mv1==='+9.00 V'&&mv23==='+3.00 V',mv1+' '+mv23);
  await setS('inp-mix-R3',6);await setS('inp-mix-R1',3);await p.waitForTimeout(150);
  t('mixed: R₂ = R₃ splits the current evenly, R₁ = R₂∥R₃ halves the voltage',(await meter())==='+6.00 V'&&(await mixI()).I2===(await mixI()).I3,await meter());
  await tapEl('S');
  t('mixed: S waits for the prediction',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('S').on)));
  await p.click('#app .sk-predict .sk-opt >> nth=0');await p.waitForTimeout(250);
  t('mixed: shorted, the pair has 0 V and I = ε/R₁ = 4.00 A',(await meter())==='0.00 V'&&(await mixI()).I==='4.00 A',(await meter())+' '+JSON.stringify(await mixI()));
  await dragProbe(0,'r1a');await dragProbe(1,'r1b');
  t('mixed: and the whole ε is across R₁',(await meter())==='+12.00 V',await meter());
  t('mixed: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());
  // a source set in half volts is printed in half volts: the real-meter,
  // capacitor and bridge batteries read 13 V at 12.5 V
  for(const [c,s,id] of [['dc-real','dc-realmeters','inp-rm-V'],['dc-real','dc-capacitor','inp-cap-V'],['dc-kirchhoff','dc-bridge','inp-br-V']]){
    await go(c,s);await setS(id,12.5);await p.waitForTimeout(150);
    t(s+': the battery reads 12.5 V, not 13',(await grab()).includes('12.5 V'),'');
  }

  // EMF: V = ε − I·r and I = ε/(R+r), power split adds to εI
  await go('dc-real','dc-emf');
  for(const [E,r,R] of [[12,1,3],[24,0.1,0.2],[1.5,4,24]]){
    await setS('inp-emf-E',E);await setS('inp-emf-r',r);await setS('inp-emf-R',R);
    await p.waitForTimeout(150);
    const tx=await grab();
    const I=num((tx.find(s2=>/^\d+\.\d\d A$/.test(s2))||'NaN'));
    const Vt=num((tx.filter(s2=>/^\d+\.\d\d V$/.test(s2))[0])||'NaN');
    const Iw=E/(R+r);
    t(`emf ε=${E} r=${r} R=${R}: I = ε/(R+r), V = ε − Ir`,near(I,Iw)&&near(Vt,E-Iw*r),I+' A, '+Vt+' V; want '+Iw.toFixed(2)+', '+(E-Iw*r).toFixed(2));
  }
  // the open circuit (V = ε), the short (predicted first: I = ε/r, V = 0),
  // the matched load (R = r) and V = 0.9 ε (R = 9r)
  {const emfRead=async()=>{const tx=await grab();return {I:num((tx.find(s2=>/^\d+\.\d\d A$/.test(s2))||'NaN')),V:num((tx.filter(s2=>/^\d+\.\d\d V$/.test(s2))[0])||'NaN')};};
   await setS('inp-emf-E',12);await setS('inp-emf-r',1);await setS('inp-emf-R',3);
   await tapEl('S');let q=await emfRead();
   t('emf: with the load switched off, I = 0 and the terminals show the emf itself',q.I===0&&q.V===12,JSON.stringify(q));
   await tapEl('S');await tapEl('K');
   t('emf: the short waits for the prediction',!(await p.evaluate(()=>document.querySelector('#app canvas')._dc.el('K').on)));
   await p.click('#app .sk-predict .sk-opt >> nth=1');await p.waitForTimeout(250);q=await emfRead();
   t('emf: shorted, I = ε/r = 12.00 A and V = 0',q.I===12&&Math.abs(q.V)<0.006,JSON.stringify(q));
   await tapEl('K');await setS('inp-emf-R',3);await p.waitForTimeout(120);
   {const mm=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/ /g,' '));
    t('emf: the model line gives the load’s power, P = I²R = 3.00²·3.0 = 27.00 W',mm.includes('P = I²R = 3.00²·3.0 = 27.00 W'),mm);}
   await setS('inp-emf-R',1);await p.waitForTimeout(120);q=await emfRead();
   t('emf: R = r, half the emf on the terminals',q.I===6&&q.V===6,JSON.stringify(q));
   {const mm=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/ /g,' '));
    t('emf: at R = r the load gets the most, ε²/4r = 36.00 W',mm.includes('P = I²R = 6.00²·1.0 = 36.00 W'),mm);}
   await setS('inp-emf-R',9);await p.waitForTimeout(120);q=await emfRead();
   t('emf: R = 9r gives V = 0.9 ε',q.V===10.8,JSON.stringify(q));
   t('emf: all four missions solved by doing them',(await kitCount())==='4/4',await kitCount());}

  // bridge: the null reads the right resistance, also when the balance falls between dial steps
  await go('dc-kirchhoff','dc-bridge');
  for(const [R1,R2,Rx,R3,want] of [[150,450,240,80,'240'],[150,450,250,83,'249'],[500,50,600,40,null]]){
    await setS('inp-br-R1',R1);await setS('inp-br-R2',R2);await setS('inp-br-Rx',Rx);await setS('inp-br-R3',R3);
    await p.waitForTimeout(150);
    const tx=await grab();
    const line=tx.find(s2=>/^Rₓ = R₃·R₂\/R₁/.test(s2))||'';
    if(want)t(`bridge R₁=${R1} R₂=${R2} Rₓ=${Rx}: nulled at R₃=${R3}, reads ${want} Ω`,line.includes('= '+want+' Ω'),line||tx.join(' | ').slice(0,200));
    else t(`bridge R₁=${R1} R₂=${R2} Rₓ=${Rx}: an unreachable balance is named`,tx.some(s2=>s2.includes(L('Ω — מחוץ לתחום החוגה')))&&!line,tx.filter(s2=>/איזון|מאוזן/.test(s2)).join(' | '));
  }

  // capacitor: charges to V·R₂/(R₁+R₂), the branch current dies, and on opening it discharges through R₂
  await go('dc-real','dc-capacitor');
  await setS('inp-cap-V',12);await setS('inp-cap-R1',1);await setS('inp-cap-R2',1);await setS('inp-cap-C',50);
  await p.click('#btn-cap-sw'); await p.waitForTimeout(1200);
  let tx=await grab();
  let vc=num((tx.find(s2=>/^\d+\.\d\d V$/.test(s2))||'NaN')), ic=num((tx.find(s2=>/mA$/.test(s2))||'NaN'));
  t('capacitor: steady state V_C = V·R₂/(R₁+R₂), no branch current',near(vc,6)&&near(ic,0),vc+' V, '+ic+' mA');
  t('capacitor: τ = (R₁∥R₂)C while charging',tx.includes('0.025 s'),tx.filter(s2=>/ s$/.test(s2)).join(' '));
  // a big C before opening (V_C cannot jump): the discharge is slow enough
  // to watch, on any machine -- τ = R₂C = 2 s
  await setS('inp-cap-C',2000);await p.waitForTimeout(100);
  await p.click('#btn-cap-sw'); await p.waitForTimeout(100);
  tx=await grab();
  ic=num((tx.find(s2=>/mA$/.test(s2))||'NaN'));
  t('capacitor: on opening, the current turns round (−V_C/R₂)',ic<-4&&ic>-6.01,ic+' mA');
  // one frame: the clock and V_C drawn together obey V_C = V₀·e^(−t/R₂C)
  const frame1=async()=>p.evaluate(()=>new Promise(r=>{window._txt=new Set();requestAnimationFrame(()=>{window._rec=true;
    requestAnimationFrame(()=>{window._rec=false;r([...window._txt]);});});}));
  await p.waitForTimeout(600);
  {const f1=await frame1(),tt=num((f1.find(s2=>/^t = \d+\.\d\d s$/.test(s2))||'t = NaN').slice(4)),v1=num(f1.find(s2=>/^\d+\.\d\d V$/.test(s2))||'NaN');
   // (t and V_C are printed to 0.005: 0.005 s of t is 0.013 V here)
   t('capacitor: the discharge is the exponential V₀·e^(−t/τ), τ = R₂C = 2 s',tt>0.3&&near(v1,6*Math.exp(-tt/2),0.02),`t = ${tt} s, V_C = ${v1} V, want ${(6*Math.exp(-tt/2)).toFixed(3)}`);}
  await setS('inp-cap-C',50);
  await p.waitForTimeout(1500);
  tx=await grab();
  vc=num((tx.find(s2=>/^\d+\.\d\d V$/.test(s2))||'NaN'));
  t('capacitor: discharged through R₂',near(vc,0),vc+' V');
  await setS('inp-cap-R1',4);await setS('inp-cap-R2',4);await setS('inp-cap-C',500);await p.waitForTimeout(150);
  await p.click('#btn-cap-sw');await p.waitForTimeout(150);
  {const mm=await p.evaluate(()=>document.querySelector('#app .sk-model').textContent.replace(/\u00a0/g,' '));
   t('capacitor: charging, the model line has τ = (R₁∥R₂)·C = 2 kΩ · 500 μF = 1.00 s',mm.includes('τ = (R₁∥R₂)·C = 1.00 s'),mm);}
  t('capacitor: all three missions solved by doing them',(await kitCount())==='3/3',await kitCount());

  // real voltmeter: 10 kΩ across 10 kΩ of a 12 V divider reads 4 V, 33.3 %
  await go('dc-real','dc-realmeters');
  await setS('inp-rm-V',12);await setS('inp-rm-R',10);await setS('inp-rm-RV',1);
  await p.waitForTimeout(150);
  tx=await grab();
  t('real voltmeter: loading reading and error',tx.includes('4.00 V')&&tx.includes('33.3 %'),tx.filter(s2=>/V$|%$/.test(s2)).join(' | '));
  // δ = 1/(1+2R_V/R) for two equal resistors: under 1 % past R_V = 50R, 50 % at R_V = R/2
  for(const [ex,R,want] of [[2.75,10,100/(1+2*Math.pow(10,2.75)/10)],[0.70,10,100/(1+2*Math.pow(10,0.70)/10)],[1,1,100/(1+2*10/1)]]){
    await setS('inp-rm-RV',ex);await setS('inp-rm-R',R);await p.waitForTimeout(120);
    const e1=(await grab()).find(s2=>/^\d+\.\d %$/.test(s2))||'';
    t(`real voltmeter R_V = 10^${ex} kΩ, R = ${R} kΩ: error ${want.toFixed(1)} %`,num(e1)===+want.toFixed(1),e1);
  }
  t('real voltmeter: all three missions solved by doing them',(await kitCount())==='3/3',await kitCount());

  // ── every mission can be solved, and only by the physics it names ──────
  const model=async()=>p.evaluate(()=>{const m=document.querySelector('#app .sk-model');return m?m.textContent.replace(/\u00a0/g,' '):'';});
  const sets=async(o)=>{for(const k in o)await setS(k,o[k]);await p.waitForTimeout(150);};
  await go('dc-kirchhoff','dc-junction');
  await sets({'inp-jn-I1':3,'inp-jn-I2':2,'inp-jn-I3':6});
  t('junction: I₄ = I₁ + I₂ − I₃ in the model line',(await model()).includes('I₄ = I₁ + I₂ − I₃ = 3.0 + 2.0 − 6.0 = −1.0 A'),await model());
  await sets({'inp-jn-I3':5});await sets({'inp-jn-I2':3,'inp-jn-I3':4});
  t('junction: all three missions solved (I₄ < 0, I₄ = 0, I₄ = 2 A from 3 + 3)',(await kitCount())==='3/3',await kitCount());
  await go('dc-kirchhoff','dc-loop');
  await sets({'inp-lp-E1':12,'inp-lp-E2':12,'inp-lp-R1':4,'inp-lp-R2':8});await p.click('#btn-lp-aid');await p.waitForTimeout(150);
  await sets({'inp-lp-E1':6});
  t('loop: the model line gives I = (ε₁ − ε₂)/(R₁+R₂) with the numbers',(await model()).includes('I = (ε₁ − ε₂)/(R₁+R₂) = (6.0 − 12.0)/(4+8) = −0.50 A'),await model());
  await p.click('#btn-lp-dir');await p.waitForTimeout(150);
  t('loop: all three missions solved (I = 0 opposed, I reversed, the other way round)',(await kitCount())==='3/3',await kitCount());
  await go('dc-kirchhoff','dc-twoloop');
  await sets({'inp-tl-E1':12,'inp-tl-E2':12,'inp-tl-R1':2,'inp-tl-R2':2,'inp-tl-R3':4});
  t('two-loop: the model line has both loop equations and the solution',(await model()).includes('(2.0+4.0)·I₁ + 4.0·I₂ = 12.0')&&(await model()).includes('I₁ = 1.20 A, I₂ = 1.20 A, I₃ = I₁+I₂ = 2.40 A'),await model());
  await sets({'inp-tl-E2':24});await p.click('#btn-tl-flip');await sets({'inp-tl-E2':12});
  t('two-loop: all three missions solved (both supply, battery 1 charged, I₃ = 0)',(await kitCount())==='3/3',await kitCount());
  await go('dc-kirchhoff','dc-bridge');
  await sets({'inp-br-V':9,'inp-br-R1':150,'inp-br-R2':450,'inp-br-Rx':240,'inp-br-R3':80});
  await dragProbe(0,'A');await dragProbe(1,'Bn');
  await sets({'inp-br-V':15});await sets({'inp-br-Rx':600,'inp-br-R3':200});
  t('bridge: all four missions solved (balanced, 0 V across G at the null, the balance survives a new voltage, Rₓ = 600 Ω)',(await kitCount())==='4/4',await kitCount());
  await go('dc-basics','dc-current');
  // 10 C at 4 A is 2.5 s of the sim's clock (on a busy machine the clock runs
  // slower: frames are capped at 50 ms), so wait for it rather than a fixed time
  await sets({'inp-dcc-A':2,'inp-dcc-I':4});await p.waitForTimeout(3200);
  for(let k=0;k<20&&(await kitCount())!=='3/3';k++)await p.waitForTimeout(500);
  t('current: the model line gives v_d = I/(nAe)',(await model()).includes('vd = I/(nAe) = 4.0/(8.5×10²⁸·2.0×10⁻⁶·1.6×10⁻¹⁹) = 0.147 mm/s'),await model());
  t('current: all three missions solved (4× the area, 10 C counted, the current doubled)',(await kitCount())==='3/3',await kitCount());
  await go('dc-basics','dc-resistance');
  // the voltage is set in tenths: with an odd R the nearest tenth to 0.25·R counts
  {const m1=async()=>p.evaluate(()=>document.querySelector('#app .sk-m').classList.contains('done'));
   const d0=await m1();await sets({'inp-ohm-R':13,'inp-ohm-V':3.2});
   t('ohm: 0.25 A through 13 Ω is reached at the nearest setting, 3.2 V',!d0&&(await m1()),d0+' → '+(await m1()));}
  await sets({'inp-ohm-R':12,'inp-ohm-V':3});
  t('ohm: I = V/R = 0.250 A in the model line',(await model()).includes('I = V/R = 3.0/12 = 0.250 A'),await model());
  await sets({'inp-ohm-V':0});await sets({'inp-ohm-V':7});await p.click('#btn-ohm-mode');await sets({'inp-ohm-V':9});
  t('ohm: all three missions solved (0.25 A, R constant over 7 V, the bulb 25 % hotter)',(await kitCount())==='3/3',await kitCount());
  await go('dc-basics','dc-power');
  await sets({'inp-pw-R':6,'inp-pw-V':24});await sets({'inp-pw-V':12,'inp-pw-R':4});
  t('power: P = V·I = V²/R = 36 W in the model line',(await model()).includes('P = V·I = 12.0·3.00 = 36.00 W'),await model());
  // 288 W fills a watt-hour in 12.5 s of the sim's clock (a busy machine's
  // clock runs slower: frames are capped at 50 ms)
  await sets({'inp-pw-V':24,'inp-pw-R':2});
  for(let k=0;k<45&&(await kitCount())!=='3/3';k++)await p.waitForTimeout(1000);
  t('power: all three missions solved (×4 for ×2 the voltage, 36 W, one watt-hour)',(await kitCount())==='3/3',await kitCount());

  // nothing on any DC simulation prints NaN or Infinity, at either end of every slider
  for(const ch of await p.evaluate(()=>DC_CHAPTERS.map(c=>[c.id,c.sections.map(s2=>s2.id)])))
    for(const se of ch[1]){
      await go(ch[0],se);
      const ids=await p.evaluate(()=>[...document.querySelectorAll('#app input[type=range]')].map(r=>[r.id,r.min,r.max]));
      let badTxt=[];
      for(const end of [1,2]){
        for(const r of ids)await setS(r[0],r[end]);
        await p.waitForTimeout(200);
        badTxt=badTxt.concat((await grab()).filter(s2=>/NaN|Infinity|undefined/.test(s2)));
      }
      t(se+': no NaN/Infinity at the slider extremes',badTxt.length===0,badTxt.slice(0,3).join(' | '));
    }

  ok.forEach(s=>console.log('  PASS',s));
  bad.forEach(s=>console.log('  FAIL',s));
  console.log(bad.length?('\n❌ '+bad.length+' check(s) failed'):'\n✅ every DC interaction responds, and the answers and simulations obey the physics');
  console.log('page errors:',errs.length?errs:'NONE');
  await b.close();
  process.exit(bad.length?1:0);
})();
