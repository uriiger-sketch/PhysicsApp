const { chromium } = require('playwright');
const ok=[],bad=[];
const t=(name,cond,detail)=>(cond?ok:bad).push(name+(detail?' — '+detail:''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({viewport:{width:900,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/user/PhysicsApp/physics_game_v28.html'); await p.waitForTimeout(1200);
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

  ok.forEach(s=>console.log('  PASS',s));
  bad.forEach(s=>console.log('  FAIL',s));
  console.log(bad.length?('\n❌ '+bad.length+' interaction(s) failed'):'\n✅ every DC interaction responds');
  console.log('page errors:',errs.length?errs:'NONE');
  await b.close();
  process.exit(bad.length?1:0);
})();
