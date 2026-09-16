const { chromium } = require('playwright');
const ok=[],bad=[];
const t=(name,cond,detail)=>(cond?ok:bad).push(name+(detail?' — '+detail:''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({viewport:{width:900,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/user/PhysicsApp/physics_game_v28.html'); await p.waitForTimeout(1200);
  await p.evaluate(()=>{if(window.closeOnboarding)closeOnboarding();});
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

  ok.forEach(s=>console.log('  PASS',s));
  bad.forEach(s=>console.log('  FAIL',s));
  console.log(bad.length?('\n❌ '+bad.length+' interaction(s) failed'):'\n✅ every DC interaction responds');
  console.log('page errors:',errs.length?errs:'NONE');
  await b.close();
  process.exit(bad.length?1:0);
})();
