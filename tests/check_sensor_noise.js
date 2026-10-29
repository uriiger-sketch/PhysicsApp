// Sensor labs fed the signals a real phone sends: noise on every axis, the
// vibration of a phone sliding over a table, the tremor of the hand raising a
// board. check_sensor_physics.js proves the labs right on clean motions; this
// proves they still see the motion when it is buried in what a phone adds.
// Every scenario here failed on the labs as they were at v28.13:
//   kinetic friction recorded no slide at all with 0.1 m/s² of jitter (its
//   tilt test is second order in the angle and read vibration as tilt), the
//   slip-angle lab never caught a slip under a 0.3 m/s² tremor, and the slide
//   labs never left 'calibrating' with 0.05 m/s² of noise per axis.
//
//   node tests/check_sensor_noise.js
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(process.env.SL_FILE || process.env.APP_FILE || path.resolve(__dirname, '..', 'physics_game_v28.html'));

let fail = 0, checks = 0;
const t = (name, got, want, tol) => {
  checks++; const ok = isFinite(got) && Math.abs(got - want) <= tol; if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${(+got).toFixed(4)} want ${want}±${tol}`);
};
const tb = (name, cond, detail) => { checks++; if (!cond) fail++; console.log(`   ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: require('./_browser'), args: ['--no-sandbox'] });
  const p = await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(F); await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
  const open = async key => {
    const [ch, se] = key.split('.');
    await p.evaluate(([c, x]) => { state.subject = 'mechanics'; state.chapter = c; state.section = x; state.tab = 'theory'; render(); }, [ch, se]);
    await p.waitForFunction(() => _sl.st !== null, null, { timeout: 8000 });
  };
  // Feed n samples from gen(i, gauss) -> {a, g, r?, dt?}. a is the gravity-free
  // channel, g the reading with gravity, r the rotation rate (α, β, γ) in °/s.
  // The noise is seeded, so a run is repeatable.
  const run = (key, n, genSrc, seed) => p.evaluate(([key, n, genSrc, seed]) => {
    let s = seed; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const gen = eval(genSrc), impl = SL_IMPL[SENSOR_LABS[key].t], st = _sl.st; let tt = 0;
    for (let i = 0; i < n; i++) {
      const o = gen(i, gauss), dt = o.dt || 0.01, r = o.r || [0, 0, 0]; tt += dt;
      impl.sample({ dt, t: tt, exact: true, gyro: true, hz: 1 / dt, ax: o.a[0], ay: o.a[1], az: o.a[2],
        gx: o.g[0], gy: o.g[1], gz: o.g[2], Gx: o.g[0], Gy: o.g[1], Gz: o.g[2], ra: r[0], rb: r[1], rg: r[2] }, st);
    }
    const st2 = _sl.st;
    return { ph: st2.ph, pts: st2.pts, flatOK: st2.flatOK, res: st2.res || null };
  }, [key, n, genSrc, seed]);

  console.log('\n1) kinetic friction, μk = 0.30, on a table that vibrates while the phone slides');
  // 1 s at rest (0.03 m/s² of noise), a 0.08 s shove, a 0.5 s free slide with
  // vibration σ on every axis, and rest again
  for (const sig of [0.3, 0.6]) {
    await open('forces2.kinetic-friction');
    const src = `(i,g)=>{const G=9.81,s=(i>=100&&i<158)?${sig}:0.03,n=()=>s*g();let h=0;
      if(i>=100&&i<108)h=-4;else if(i>=108&&i<158)h=0.30*G;
      const raw=[h+n(),n(),G+n()];return {a:[raw[0],raw[1],raw[2]-G],g:raw};}`;
    const r = await run('forces2.kinetic-friction', 260, src, 7);
    tb(`vibration σ = ${sig} m/s²: the slide is recorded`, r.pts.length === 1, r.pts.length + ' slides');
    // the slide gives ~30 samples in its middle, so one slide knows μk to σ/(g√30)
    if (r.pts.length) t(`  and μk, within three standard errors`, r.pts[0], 0.30, 3 * sig / 9.81 / Math.sqrt(30) + 0.005);
  }
  for (const seed of [3, 5, 11]) {
    await open('forces2.kinetic-friction');
    const src = `(i,g)=>{const G=9.81,s=(i>=100&&i<158)?0.5:0.03,n=()=>s*g();let h=0;
      if(i>=100&&i<108)h=-4;else if(i>=108&&i<158)h=0.30*G;
      const raw=[h+n(),n(),G+n()];return {a:[raw[0],raw[1],raw[2]-G],g:raw};}`;
    const r = await run('forces2.kinetic-friction', 260, src, seed);
    t(`  σ = 0.5, noise seed ${seed}: μk (the component against the push carries no noise bias)`, r.pts[0], 0.30, 3 * 0.5 / 9.81 / Math.sqrt(30) + 0.005);
  }
  {
    await open('forces2.kinetic-friction');
    // a phone on a surface 5° off level, at rest with ordinary noise
    const src = `(i,g)=>{const G=9.81,th=i<60?0:5*Math.PI/180,n=()=>0.03*g();
      const raw=[G*Math.sin(th)+n(),n(),G*Math.cos(th)+n()];return {a:[n(),n(),n()],g:raw};}`;
    const r = await run('forces2.kinetic-friction', 200, src, 2);
    tb('a phone left 5° off level is flagged as tilted', r.flatOK === false);
  }
  {
    await open('forces2.kinetic-friction');
    // the same table, level, phone rocking 4° up on one edge during a vibrating slide (gyroscope sees it)
    const src = `(i,g)=>{const G=9.81,s=(i>=100&&i<158)?0.3:0.03,n=()=>s*g();let h=0,rb=0;
      if(i>=100&&i<108)h=-4;else if(i>=108&&i<158){h=0.30*G;if(i<118)rb=40;}
      const raw=[h+n(),n(),G+n()];return {a:[raw[0],raw[1],raw[2]-G],g:raw,r:[0,rb,0]};}`;
    const r = await run('forces2.kinetic-friction', 260, src, 4);
    tb('a slide in which the phone rocks 4° is not recorded', r.pts.length === 0, r.pts.length + ' slides');
  }

  console.log('\n2) static friction: the board raised 10° → 27° over 3 s by a hand that trembles');
  for (const trem of [0.15, 0.3]) {
    await open('forces2.static-friction');
    const src = `(i,g)=>{const G=9.81,t=i*0.01;let th=t<1?10:(t<4?10+17*(t-1)/3:27);th*=Math.PI/180;
      const tr=${trem}*Math.sin(2*Math.PI*9*t)+0.05*g();
      const a=(t>=4&&t<4.6)?G*(Math.sin(th)-0.4*Math.cos(th)):0;
      return {a:[0,-a+0.3*tr,tr],g:[0,G*Math.sin(th)-a+0.3*tr,G*Math.cos(th)+tr]};}`;
    const r = await run('forces2.static-friction', 600, src, 3);
    tb(`tremor ${trem} m/s²: the slip is caught`, r.pts.length === 1, r.pts.length + ' slips');
    if (r.pts.length) t('  at the angle it let go', r.pts[0][0], 27, 1.2);
  }

  console.log('\n3) slide labs: calibration and Δx with 0.05 m/s² of noise per axis and a bursty clock');
  for (const burst of [0, 1]) {
    await open('kinematics.acceleration');
    const src = `(i,g)=>{const G=9.81,t=i*0.01,dt=${burst}?((i%10<5)?0.002:0.018):0.01;
      const a=(t>=1&&t<2)?1.5*Math.sin(2*Math.PI*(t-1)):0,n1=0.05*g(),n2=0.05*g(),n3=0.05*g();
      return {dt,a:[n1,a+n2,n3],g:[n1,a+n2,G+n3],r:[0.5*g(),0.5*g()+0.3,0.5*g()-0.2]};}`;
    const r = await run('kinematics.acceleration', 700, src, 11);
    tb(`burst ${burst}: calibrated, triggered and closed`, r.ph === 'done', r.ph);
    if (r.res) t('  Δx (1.5/2π m)', r.res.xc, 1.5 / (2 * Math.PI), 0.008);
  }
  {
    await open('kinematics.avg-instant-vel');
    const src = `(i,g)=>{const G=9.81,n=()=>0.05*g();const raw=[n(),n(),G+n()];return {a:[raw[0],raw[1],raw[2]-G],g:raw,r:[0.4*g(),0.4*g(),0.4*g()]};}`;
    const r = await run('kinematics.avg-instant-vel', 300, src, 9);
    tb('chord vs tangent lab leaves calibration within 3 s at 0.05 m/s² noise', r.ph === 'armed', r.ph);
  }

  tb('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${fail ? '❌ ' + fail + ' FAILED' : '✅ sensor labs see the motion through a real phone\'s noise'} (${checks - fail}/${checks})`);
  process.exit(fail ? 1 : 0);
})();
