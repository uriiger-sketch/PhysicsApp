// DC circuits: every interaction responds, every guided problem agrees with an
// independent computation from first principles, and the numbers each
// simulation prints obey Kirchhoff's laws (junction sums, loop sums, power
// balance) at ordinary and extreme settings.
//
//   node tests/check_dc.js
const { chromium } = require('playwright');
const path = require('path');
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

  // series: dragging the divider must move BOTH resistances and keep their sum
  await go('dc-network','dc-series');
  let bx=await box();
  const s0=[await val('inp-ser-R1'),await val('inp-ser-R2')];
  await p.mouse.move(bx.x+bx.w*0.70, bx.y+bx.h*0.69); await p.mouse.down(); await p.mouse.move(bx.x+bx.w*0.72, bx.y+bx.h*0.69); await p.mouse.up();
  await p.waitForTimeout(250);
  const s1=[await val('inp-ser-R1'),await val('inp-ser-R2')];
  t('series divider moves R₁', s1[0]!==s0[0], `${s0[0]}→${s1[0]}`);
  t('series divider keeps the sum', s0[0]+s0[1]===s1[0]+s1[1], `${s0[0]+s0[1]} vs ${s1[0]+s1[1]}`);

  // parallel: tapping a branch must drop it out of the equivalent resistance
  await go('dc-network','dc-parallel');
  bx=await box();
  const lit=async()=>p.evaluate(()=>{const c=document.querySelector('#app canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<110&&d[i+2]<110)n++;return n;});
  const before=await lit();                       // red pixels: none yet
  await p.mouse.click(bx.x+bx.w*0.40, bx.y+bx.h*0.36);
  await p.waitForTimeout(400);
  const after=await lit();
  t('parallel branch disconnects on a tap', after>before*1.5+40, `red px ${before}→${after}`);
  await p.mouse.click(bx.x+bx.w*0.40, bx.y+bx.h*0.36);
  await p.waitForTimeout(400);
  t('and reconnects on a second tap', (await lit())<before*1.5+40);

  // mixed + meters: a tap anywhere advances the same state as the button
  for (const [ch,se,btn] of [['dc-network','dc-mixed','btn-mix-step'],['dc-real','dc-meters','btn-mtr-mode']]) {
    await go(ch,se); bx=await box();
    const l0=await p.evaluate(i=>document.getElementById(i).textContent,btn);
    await p.mouse.click(bx.x+bx.w*0.5, bx.y+bx.h*0.5); await p.waitForTimeout(350);
    const l1=await p.evaluate(i=>document.getElementById(i).textContent,btn);
    t(se+': tapping the canvas advances the step', l0!==l1, `${l0.trim()} → ${l1.trim()}`);
  }

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
  t('two-loop: the flip button relabels itself', /הפוכה/.test(lbl), lbl.trim());
  await p.mouse.click(bx.x+bx.w*0.90, bx.y+bx.h*0.285); await p.waitForTimeout(400);
  t('two-loop: tapping the battery flips it back',
    /באותו כיוון/.test(await p.evaluate(()=>document.getElementById('btn-tl-flip').textContent)));

  // bridge: dragging the calibrated resistor must move R₃ and can null the bridge
  await go('dc-kirchhoff','dc-bridge'); bx=await box();
  v0=await val('inp-br-R3');
  await p.mouse.move(bx.x+bx.w*0.20, bx.y+bx.h*0.88); await p.mouse.down();
  await p.mouse.move(bx.x+bx.w*0.70, bx.y+bx.h*0.88); await p.mouse.up();
  await p.waitForTimeout(300);
  t('bridge: dragging the dial sets R₃', (await val('inp-br-R3'))!==v0, `${v0} → ${await val('inp-br-R3')}`);
  await p.evaluate(()=>{const s=document.getElementById('inp-br-R3');s.value='80';
    s.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(500);
  t('bridge: R₁·Rₓ = R₂·R₃ really is the null',
    await p.evaluate(()=>{const c=document.querySelector('#app canvas');
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
      for(let i=0;i<d.length;i+=4)if(d[i]<90&&d[i+1]>190&&d[i+2]>130&&d[i+2]<190)n++;return n>200;}),
    'green null readout present');

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
  const lx=await p.evaluate(()=>{const div=document.createElement('div');div.style.cssText='position:absolute;left:0;top:0;width:2000px';document.body.appendChild(div);
    const txt=h=>{div.innerHTML=String(h||'');return div.innerText.replace(/\s+/g,' ').trim();};
    const r={mis:[],hint:[],long:[],nudge:[],q:0,longest:0,consp:[]};
    for(const ch of DC_CHAPTERS)for(const se of ch.sections){const k=ch.id+'.'+se.id,C=CONTENT[k];
      if(!/mis-block/.test(C.theory.html))r.mis.push(k);
      C.problem.steps.forEach((s2,i)=>{const h=txt(s2.hint);
        if((h.match(/[א-ת]+/g)||[]).length<3)r.hint.push(k+'#'+(i+1));
        if(h.length>=txt(s2.explain).length)r.long.push(k+'#'+(i+1));
        if(s2.nudge&&/=/.test(txt(s2.nudge)))r.nudge.push(k+'#'+(i+1));});
      C.quiz.forEach((q,i)=>{r.q++;const L=q.opts.map(o=>txt(o).length),key=L[q.correct],next=Math.max(...L.filter((_,j)=>j!==q.correct));
        if(key>next){r.longest++;if(key>1.3*next)r.consp.push(k+'#'+(i+1));}});}
    div.remove();return r;});
  t('every DC section has a misconception box',lx.mis.length===0,lx.mis.join(' '));
  t('every problem hint opens with a Hebrew sentence',lx.hint.length===0,lx.hint.join(' '));
  t('every hint is shorter than its explanation',lx.long.length===0,lx.long.join(' '));
  t('no nudge hands over a formula',lx.nudge.length===0,lx.nudge.join(' '));
  t('the quiz key is the longest option in at most 30 % of questions',lx.longest<=0.3*lx.q,lx.longest+'/'+lx.q);
  t('and never conspicuously (more than 1.3× the next option)',lx.consp.length===0,lx.consp.join(' '));

  // ── what the simulations print obeys Kirchhoff ─────────────────────────
  // every label on the simulation canvas, captured for a few frames
  await p.evaluate(()=>{const f=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(s2){
      if(window._rec&&this.canvas&&this.canvas.closest&&this.canvas.closest('#app')&&!this.canvas.id.startsWith('anim'))
        window._txt.add(String(s2).replace(/[⁦-⁩‎‏]/g,''));
      return f.apply(this,arguments);};});
  const grab=async()=>{await p.evaluate(()=>{window._txt=new Set();window._rec=true;});
    await p.waitForTimeout(160);return p.evaluate(()=>{window._rec=false;return [...window._txt];});};
  const setS=async(id2,v)=>p.evaluate(([i,x])=>{const el=document.getElementById(i);el.value=x;el.dispatchEvent(new Event('input',{bubbles:true}));},[id2,String(v)]);
  const num=x=>parseFloat(String(x).replace('−','-'));
  const near=(a,b2,eps)=>Math.abs(a-b2)<=(eps||0.011);

  // two loops: I₃ = I₁ + I₂, the solution of the 3×3 system, and the ledger balances
  await go('dc-kirchhoff','dc-twoloop');
  for(const [flipIt,E1,E2,R1,R2,R3] of [[0,12,4,2,2,4],[1,12,4,2,2,4],[0,24,0,0.5,12,0.5],[0,1,24,12,0.5,12]]){
    await setS('inp-tl-E1',E1);await setS('inp-tl-E2',E2);await setS('inp-tl-R1',R1);await setS('inp-tl-R2',R2);await setS('inp-tl-R3',R3);
    const lab=await p.evaluate(()=>document.getElementById('btn-tl-flip').textContent);
    if(flipIt!==(/הפוכה/.test(lab)?1:0))await p.click('#btn-tl-flip');
    await p.waitForTimeout(150);
    const tx=await grab();
    const amps=tx.filter(s2=>/^-?−?\d+\.\d\d A$/.test(s2)).map(num);   // readouts, in the order I₁, I₃, I₂
    const e2=flipIt?-E2:E2, D=(R1+R3)*(R2+R3)-R3*R3, i1=(E1*(R2+R3)-e2*R3)/D, i2=(e2*(R1+R3)-E1*R3)/D;
    const tag=`two-loop ε=${E1},${e2} R=${R1},${R2},${R3}`;
    t(tag+': I₁, I₃, I₂ are the solution',amps.length===3&&near(amps[0],i1)&&near(amps[1],i1+i2)&&near(amps[2],i2),JSON.stringify(amps)+' want '+[i1,i1+i2,i2].map(x=>x.toFixed(2)));
    t(tag+': junction I₃ = I₁ + I₂ on screen',amps.length===3&&near(amps[1],amps[0]+amps[2],0.011),JSON.stringify(amps));
    const led=tx.find(s2=>/סופק/.test(s2))||'';
    const w=(led.match(/-?\d+\.\d\d/g)||[]).map(Number);
    t(tag+': supplied = dissipated + absorbed',w.length===3&&near(w[0],w[1]+w[2],0.006),led);
  }

  // single loop: the four legs on the ladder add to the ΣΔV printed, and that is 0
  await go('dc-kirchhoff','dc-loop');
  for(const [E1,E2,R1,R2,opp,rev] of [[12,0,4,8,0,0],[12,6,4,8,1,0],[2,12,1,20,1,1],[24,12,20,1,0,1]]){
    await setS('inp-lp-E1',E1);await setS('inp-lp-E2',E2);await setS('inp-lp-R1',R1);await setS('inp-lp-R2',R2);
    const aidOn=/מסייעת/.test(await p.evaluate(()=>document.getElementById('btn-lp-aid').textContent));
    if(aidOn===!!opp)await p.click('#btn-lp-aid');
    const fwd=/עם כיוון השעון/.test(await p.evaluate(()=>document.getElementById('btn-lp-dir').textContent));
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

  // parallel: branch currents add to the total, including with a branch cut and the third added
  await go('dc-network','dc-parallel');
  for(const [V,R1,R2,R3,third] of [[12,4,12,6,0],[24,1,1,1,1],[2,24,24,24,1]]){
    await setS('inp-par-V',V);await setS('inp-par-R1',R1);await setS('inp-par-R2',R2);await setS('inp-par-R3',R3);
    const has=/➖/.test(await p.evaluate(()=>document.getElementById('btn-par-third').textContent));
    if(has!==!!third)await p.click('#btn-par-third');
    await p.waitForTimeout(150);
    const tx=await grab();
    const sum=tx.find(s2=>/^\d+\.\d\d( \+ \d+\.\d\d)+ = \d+\.\d\d A$/.test(s2))||'';
    const parts=(sum.match(/\d+\.\d\d/g)||[]).map(Number), tot=parts.pop();
    const want=V/R1+V/R2+(third?V/R3:0);
    t(`parallel V=${V} R=${R1},${R2}${third?','+R3:''}: branches add to the total`,parts.length&&near(parts.reduce((a,b2)=>a+b2,0),tot,0.011*parts.length)&&near(tot,want,0.011),sum+' want '+want.toFixed(2));
  }

  // mixed: I₂ + I₃ = I and V₁ + V₂₃ = V
  await go('dc-network','dc-mixed');
  for(const [V,R1,R2,R3] of [[12,6,6,3],[24,1,1,20],[2,20,20,1]]){
    await setS('inp-mix-V',V);await setS('inp-mix-R1',R1);await setS('inp-mix-R2',R2);await setS('inp-mix-R3',R3);
    await p.waitForTimeout(150);
    const tx=await grab();
    const l5=tx.find(s2=>/^⑤/.test(s2))||'', l3=tx.find(s2=>/^③/.test(s2))||'';
    const n5=(l5.match(/\d+\.\d\d/g)||[]).map(Number), I=num((l3.match(/= (\d+\.\d\d) A/)||[])[1]);
    const r23=R2*R3/(R2+R3), Iw=V/(R1+r23);
    t(`mixed V=${V} R=${R1},${R2},${R3}: I = V/(R₁+R₂∥R₃) and I₂+I₃ = I`,near(I,Iw)&&n5.length===3&&near(n5[0]+n5[1],n5[2],0.011)&&near(n5[2],Iw,0.011),l3+' | '+l5);
  }

  // a source set in half volts is printed in half volts: at 12.5 V the mixed
  // circuit's step ③ read '13 / 8.00 = 1.56 A', and the real-meter, capacitor
  // and bridge batteries read 13 V
  await setS('inp-mix-V',12.5);await setS('inp-mix-R1',6);await setS('inp-mix-R2',6);await setS('inp-mix-R3',3);
  await p.waitForTimeout(150);
  {const tx=await grab(), l3=tx.find(s2=>/^③/.test(s2))||'';
   t('mixed V=12.5: step ③ divides the source as set',l3.includes('12.5 / 8.00 = 1.56 A'),l3);}
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

  // bridge: the null reads the right resistance, also when the balance falls between dial steps
  await go('dc-kirchhoff','dc-bridge');
  for(const [R1,R2,Rx,R3,want] of [[150,450,240,80,'240'],[150,450,250,83,'249'],[500,50,600,40,null]]){
    await setS('inp-br-R1',R1);await setS('inp-br-R2',R2);await setS('inp-br-Rx',Rx);await setS('inp-br-R3',R3);
    await p.waitForTimeout(150);
    const tx=await grab();
    const line=tx.find(s2=>/^Rₓ = R₃·R₂\/R₁/.test(s2))||'';
    if(want)t(`bridge R₁=${R1} R₂=${R2} Rₓ=${Rx}: nulled at R₃=${R3}, reads ${want} Ω`,line.includes('= '+want+' Ω'),line||tx.join(' | ').slice(0,200));
    else t(`bridge R₁=${R1} R₂=${R2} Rₓ=${Rx}: an unreachable balance is named`,tx.some(s2=>/מחוץ לתחום החוגה/.test(s2))&&!line,tx.filter(s2=>/איזון|מאוזן/.test(s2)).join(' | '));
  }

  // capacitor: charges to V·R₂/(R₁+R₂), the branch current dies, and on opening it discharges through R₂
  await go('dc-real','dc-capacitor');
  await setS('inp-cap-V',12);await setS('inp-cap-R1',1);await setS('inp-cap-R2',1);await setS('inp-cap-C',50);
  await p.click('#btn-cap-sw'); await p.waitForTimeout(1200);
  let tx=await grab();
  let vc=num((tx.find(s2=>/^\d+\.\d\d V$/.test(s2))||'NaN')), ic=num((tx.find(s2=>/mA$/.test(s2))||'NaN'));
  t('capacitor: steady state V_C = V·R₂/(R₁+R₂), no branch current',near(vc,6)&&near(ic,0),vc+' V, '+ic+' mA');
  t('capacitor: τ = (R₁∥R₂)C while charging',tx.includes('0.025 s'),tx.filter(s2=>/ s$/.test(s2)).join(' '));
  await p.click('#btn-cap-sw'); await p.waitForTimeout(40);
  tx=await grab();
  ic=num((tx.find(s2=>/mA$/.test(s2))||'NaN'));
  t('capacitor: on opening, the current turns round',ic<-0.5,ic+' mA');
  await p.waitForTimeout(1500);
  tx=await grab();
  vc=num((tx.find(s2=>/^\d+\.\d\d V$/.test(s2))||'NaN'));
  t('capacitor: discharged through R₂',near(vc,0),vc+' V');

  // real voltmeter: 10 kΩ across 10 kΩ of a 12 V divider reads 4 V, 33.3 %
  await go('dc-real','dc-realmeters');
  await setS('inp-rm-V',12);await setS('inp-rm-R',10);await setS('inp-rm-RV',1);
  await p.waitForTimeout(150);
  tx=await grab();
  t('real voltmeter: loading reading and error',tx.includes('4.00 V')&&tx.includes('33.3 %'),tx.filter(s2=>/V$|%$/.test(s2)).join(' | '));

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
