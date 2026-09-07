// Phone sensor labs.
//
// Physics is driven by handing SL_IMPL[...].sample() constructed samples, so dt
// is exact and "one second at 1 m/s²" really integrates one second. The event
// stream, its clock and its gravity handling are tested separately, with real
// dispatched DeviceMotionEvents.
//
//   node tests/check_sensors.js
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0;
const t = (name, got, want, tol) => {
  const ok = tol === undefined ? String(got) === String(want)
                               : (isFinite(got) && Math.abs(got - want) <= tol);
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${got}` +
              (tol !== undefined ? ` want ${want}±${tol}` : ` want ${want}`));
};

const phone = async (b) => {
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(F);
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
  p._errs = errs;
  return p;
};

// Open a lab through the same path a learner takes, and start it.
const openLab = async (p, key, start = true) => {
  const [ch, se] = key.split('.');
  await p.evaluate(([c, x]) => {
    state.subject = c.startsWith('opt-') ? 'optics' : c.startsWith('elc-') ? 'electro' : 'mechanics';
    state.chapter = c; state.section = x; state.tab = 'theory'; render();
  }, [ch, se]);
  // buildTheory writes the markup, but initSensorLab runs later behind the
  // KaTeX retry loop -- so wait on the lab state, not on the DOM.
  await p.waitForFunction(() => _sl.st !== null, null, { timeout: 8000 });
  if (start) {
    await p.evaluate(() => document.getElementById('sl-start').click());
    await p.waitForTimeout(120);
  }
};

// Feed constructed samples straight into one lab's sample().
const push = (p, key, n, src) => p.evaluate(([key, n, src]) => {
  const f = eval(src), type = SENSOR_LABS[key].t, impl = SL_IMPL[type], st = _sl.st;
  for (let i = 0; i < n; i++) {
    const o = f(i), g = o.g, a = o.a || [0, 0, 0], r = o.r || [0, 0, 0];
    impl.sample({ dt: 0.02, t: i * 0.02, exact: true, hz: 50,
      ax: a[0], ay: a[1], az: a[2],
      gx: g[0], gy: g[1], gz: g[2],
      Gx: g[0], Gy: g[1], Gz: g[2],
      ra: r[0], rb: r[1], rg: r[2] }, st);
  }
}, [key, n, src]);

const S = p => p.evaluate(() => JSON.parse(JSON.stringify(_sl.st, (k, v) =>
  (k === 'tr' || k === 'trR' || k === 'reset' || k === 'buf' || k === 'rec') ? undefined : v)));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let p = await phone(b), s;

  console.log('\n1) the registry itself');
  const reg = await p.evaluate(() => {
    const out = { keys: [], bad: [] };
    for (const k of Object.keys(SENSOR_LABS)) {
      const L = SENSOR_LABS[k];
      out.keys.push(k);
      const [ch, se] = k.split('.');
      const chap = getChapters().find(c => c.id === ch) ||
        [].concat(MECH_CHAPTERS, OPTICS_CHAPTERS, ELECTRO_CHAPTERS).find(c => c.id === ch);
      if (!chap) out.bad.push(k + ': no such chapter');
      else if (!chap.sections.find(x => x.id === se)) out.bad.push(k + ': no such section');
      if (!SL_IMPL[L.t]) out.bad.push(k + ': no implementation ' + L.t);
      for (const f of ['ttl', 'how', 'pred', 'note', 'chips']) if (!L[f]) out.bad.push(k + ': missing ' + f);
      if (L.chips && L.chips.length !== 4) out.bad.push(k + ': ' + L.chips.length + ' chips');
      const im = SL_IMPL[L.t] || {};
      for (const f of ['init', 'reset', 'sample', 'draw']) if (!im[f]) out.bad.push(k + ': impl missing ' + f);
    }
    return out;
  });
  t('lab count', reg.keys.length, 12);
  t('every lab points at a real section and a complete implementation', reg.bad.join(' | '), '');

  console.log('\n2) forces2.gravity-force — g, and the honesty of its error bar');
  await openLab(p, 'forces2.gravity-force');
  await push(p, 'forces2.gravity-force', 200, 'i=>({g:[0,0,9.807+0.01*Math.sin(i)]})');
  s = await S(p);
  t('g recovered from a noisy rest', s.mean, 9.807, 0.005);
  t('the uncertainty of the mean is small but not zero', s.se > 0 && s.se < 0.01, true);
  t('noise is reported as spread, not as a wrong g', s.sd < 0.02, true);

  console.log('\n3) vectors.vec-components — the decomposition, through a full turn');
  await openLab(p, 'vectors.vec-components');
  for (const deg of [30, 150, -120]) {
    const r = deg / 57.29578;
    await push(p, 'vectors.vec-components', 6,
      `()=>({g:[9.81*Math.sin(${r}),9.81*Math.cos(${r}),0]})`);
    s = await S(p);
    const want = Math.abs(deg) > 90 ? 180 - Math.abs(deg) : Math.abs(deg);
    t(`|θ| at ${deg}°`, Math.abs(s.th * 57.29578), want, 0.6);
    t(`  Pythagoras still closes`, Math.hypot(s.gx, s.gy), 9.81, 0.02);
  }

  console.log('\n4) forces.normal-force — N and F∥ on a real incline');
  await openLab(p, 'forces.normal-force');
  await p.evaluate(() => { const e = document.getElementById('sl-m'); if (e) e.value = '2'; });
  await push(p, 'forces.normal-force', 8, '()=>({g:[9.81*Math.sin(0.5236),0,9.81*Math.cos(0.5236)]})');
  s = await S(p);
  t('θ = 30°', s.th * 57.29578, 30, 0.5);
  t('N = mg·cos30', s.N, 2 * 9.81 * Math.cos(0.5236), 0.2);
  t('F∥ = mg·sin30', s.Fp, 2 * 9.81 * 0.5, 0.2);
  t('and N is smaller than the weight at every non-zero angle', s.N < 2 * 9.81, true);

  console.log('\n5) forces2.static-friction — μs from the angle it lets go at');
  await openLab(p, 'forces2.static-friction');
  for (const deg of [18, 25, 34]) {
    const r = deg / 57.29578;
    // at rest on the slope the in-plane reading is -g*sin(theta), so down-slope
    // is +x here, and that is where the slipping phone accelerates
    await push(p, 'forces2.static-friction', 60,
      `()=>({g:[-9.81*Math.sin(${r}),0,9.81*Math.cos(${r})],a:[0,0,0.05]})`);
    await push(p, 'forces2.static-friction', 6,
      `()=>({g:[-9.81*Math.sin(${r}),0,9.81*Math.cos(${r})],a:[3,0,0]})`);
    s = await S(p);
    t(`slip captured at ${deg}°`, s.slip * 57.29578, deg, 0.6);
    t(`  μs = tan(${deg}°)`, Math.tan(s.slip), Math.tan(r), 0.02);
    await push(p, 'forces2.static-friction', 30, '()=>({g:[0,0,9.81],a:[0,0,0.05]})');
  }
  t('one reading per slip, all kept', (await S(p)).pts.length, 3);
  const knock = (lin, deg = 23) => p.evaluate(([lin, deg]) => {
    const st = _sl.st, impl = SL_IMPL['slip-angle'], n0 = st.pts.length, r = deg / 57.29578;
    const S3 = a => ({ dt: 0.02, t: 0, exact: true, hz: 50, ax: a, ay: 0, az: 0,
      gx: -9.81 * Math.sin(r), gy: 0, gz: 9.81 * Math.cos(r),
      Gx: 0, Gy: 0, Gz: 9.81, ra: 0, rb: 0, rg: 0 });
    for (let i = 0; i < 40; i++) impl.sample(S3(0.05), st);   // held quiet at the tilt
    for (let i = 0; i < 4; i++) impl.sample(S3(lin), st);     // then the burst
    return st.pts.length - n0;
  }, [lin, deg]);
  t('a knock UP the slope is not a slip', await knock(-2.0), 0);
  t('a lift, a pause, then a real slip IS caught', await knock(2.0), 1);

  console.log('\n6) forces2.kinetic-friction — μk straight off the reading');
  await openLab(p, 'forces2.kinetic-friction');
  await push(p, 'forces2.kinetic-friction', 60, '()=>({g:[0,0,9.81]})');
  t('calibrated', (await S(p)).ph, 'run');
  for (const MU of [0.35, 0.22]) {
    await push(p, 'forces2.kinetic-friction', 40, `()=>({g:[${MU * 9.81},0,9.81]})`);
    t(`instantaneous μ during a ${MU} slide`, (await S(p)).mu, MU, 0.005);
    await push(p, 'forces2.kinetic-friction', 25, '()=>({g:[0,0,9.81]})');
  }
  s = await S(p);
  t('two slides recorded', s.pts.length, 2);
  t('  first averaged', s.pts[0], 0.35, 0.01);
  t('  second averaged', s.pts[1], 0.22, 0.01);
  t('a tilted phone is flagged, not measured', await p.evaluate(() => {
    const st = _sl.st, impl = SL_IMPL['slide-mu'];
    const S2 = g => ({ dt: 0.02, t: 0, exact: true, hz: 50, ax: 0, ay: 0, az: 0,
      gx: g[0], gy: g[1], gz: g[2], Gx: g[0], Gy: g[1], Gz: g[2], ra: 0, rb: 0, rg: 0 });
    for (let i = 0; i < 20; i++) impl.sample(S2([9.81 * Math.sin(0.5), 0, 9.81 * Math.cos(0.5)]), st);
    return st.flatOK;
  }), false);
  const nB = (await S(p)).pts.length;
  await push(p, 'forces2.kinetic-friction', 60, '()=>({g:[0,0,9.81]})');   // settle back
  await push(p, 'forces2.kinetic-friction', 6, '()=>({g:[3.4,0,9.81]})');  // too brief
  await push(p, 'forces2.kinetic-friction', 20, '()=>({g:[0,0,9.81]})');
  t('a slide too short to be steady is not recorded', (await S(p)).pts.length, nB);

  console.log('\n7) momentum.momentum-def — same Δv, different Δt, different force');
  await openLab(p, 'momentum.momentum-def');
  await push(p, 'momentum.momentum-def', 60, '()=>({g:[0,0,9.81]})');
  t('calibrated', (await S(p)).ph, 'run');
  for (const [DT, N] of [[0.10, 5], [0.20, 10]]) {
    const brake = 9.81 * 0.5 / DT;
    await push(p, 'momentum.momentum-def', 25, '()=>({g:[0,0,0.05]})');           // 0.5 s of fall
    await push(p, 'momentum.momentum-def', N, `()=>({g:[0,0,${9.81 + brake}]})`); // the landing
    await push(p, 'momentum.momentum-def', 30, '()=>({g:[0,0,9.81]})');
    const r = (await S(p)).last;
    t(`Δv for the ${(DT * 1000).toFixed(0)} ms landing`, r.dv, 4.905, 0.05);
    t(`  duration measured`, r.dt, DT, 0.005);
    t(`  agrees with g·T from the fall`, r.vf, 4.905, 0.05);
  }
  s = await S(p);
  t('two landings recorded', s.pts.length, 2);
  t('Δv is the SAME for both — that is the invariant', Math.abs(s.pts[0].dv - s.pts[1].dv) < 0.05, true);
  t('but doubling the time halves the force', s.pts[0].ag / s.pts[1].ag, 2.0, 0.08);

  console.log('\n8) planar.circular — a_c immune to the gravity filter');
  await openLab(p, 'planar.circular');
  await push(p, 'planar.circular', 60, '()=>({g:[0,0,9.81]})');
  // steady spin: |G| grows, and the gravity-free channel reads nothing at all
  await push(p, 'planar.circular', 120,
    '()=>({g:[1.2,0,9.81],a:[0,0,0],r:[0,0,2*57.29578]})');
  s = await S(p);
  t('a_c found from |G| even with a dead linear channel', s.ac, 1.2, 0.05);
  t('ω from the gyroscope', s.w, 2.0, 0.05);

  console.log('\n9) shm.pendulum — T, and g from the slope');
  await openLab(p, 'shm.pendulum');
  const rec = async (L, T) => {
    await p.evaluate(L2 => { const e = document.getElementById('sl-L'); if (e) e.value = String(L2); }, L);
    // the period detector reads the LINEAR channel, so the swing goes there
    await push(p, 'shm.pendulum', 500, `i=>({g:[0,0,9.81],a:[0.8*Math.sin(2*Math.PI*i*0.02/${T}),0,0]})`);
    return p.evaluate(() => SL_IMPL['pendulum-fit'].record(_sl.st));
  };
  const g = 9.81;
  for (const L of [0.4, 0.8, 1.2]) await rec(L, 2 * Math.PI * Math.sqrt(L / g));
  s = await S(p);
  t('three lengths recorded', s.pts.length, 3);
  t('g from the slope of T² against L', s.g, 9.81, 0.4);
  t('and the fit is a straight line', s.r2 > 0.99, true);

  console.log('\n10) kinematics.freefall — the toss');
  await openLab(p, 'kinematics.freefall');
  await push(p, 'kinematics.freefall', 60, '()=>({g:[0,0,9.81]})');
  await push(p, 'kinematics.freefall', 5, '()=>({g:[0,0,30]})');     // the throw
  await push(p, 'kinematics.freefall', 25, '()=>({g:[0,0,0.02]})');  // 0.5 s airborne
  await push(p, 'kinematics.freefall', 60, '()=>({g:[0,0,9.81]})');  // caught
  s = await S(p);
  t('flight time', s.T, 0.50, 0.03);
  t('acceleration during the flight is g, downward positive', s.aFall, 9.81, 0.1);
  const sl = await p.evaluate(() => {
    const st = _sl.st, I = SL_IMPL['freefall-toss'];
    st.m1 = st.cap.fs / st.cap.dur + 0.02; st.m2 = st.cap.fe / st.cap.dur - 0.02;
    return I.slope(st).g;
  });
  t('slope of v(t) between the markers', sl, 9.81, 0.3);
  t('a jolt too short to be a toss is ignored', await p.evaluate(() => {
    const st = _sl.st, impl = SL_IMPL['freefall-toss'], T0 = st.T;
    const S5 = m => ({ dt: 0.02, t: 0, exact: true, hz: 50, ax: 0, ay: 0, az: 0,
      gx: 0, gy: 0, gz: m, Gx: 0, Gy: 0, Gz: 9.81, ra: 0, rb: 0, rg: 0 });
    for (let i = 0; i < 3; i++) impl.sample(S5(0.02), st);
    for (let i = 0; i < 10; i++) impl.sample(S5(9.81), st);
    return st.T === T0;
  }), true);

  console.log('\n11) kinematics.acceleration — a → v → x, and the drift it admits to');
  await openLab(p, 'kinematics.acceleration');
  await push(p, 'kinematics.acceleration', 70, '()=>({g:[0,0,9.81],a:[0,0,0]})');
  t('armed', (await S(p)).ph, 'armed');
  await push(p, 'kinematics.acceleration', 25, '()=>({g:[0,1,9.81],a:[0,1,0]})');
  await push(p, 'kinematics.acceleration', 25, '()=>({g:[0,-1,9.81],a:[0,-1,0]})');
  await push(p, 'kinematics.acceleration', 60, '()=>({g:[0,0,9.81],a:[0,0,0]})');
  s = await S(p);
  t('trial closed', s.ph, 'done');
  // 0.5 s at +1 then 0.5 s at -1: v peaks at 0.5, x ends at 0.25 m
  t('Δx from the double integral', s.res.xc, 0.25, 0.02);
  t('peak velocity', s.res.vmax, 0.5, 0.03);

  console.log('\n12) kinematics.avg-instant-vel — chord vs tangent');
  await openLab(p, 'kinematics.avg-instant-vel');
  await push(p, 'kinematics.avg-instant-vel', 70, '()=>({g:[0,0,9.81],a:[0,0,0]})');
  t('armed after calibration', (await S(p)).ph, 'armed');
  // the lab reads Y by default, so the push has to be along it
  const leg = (ay, n) => push(p, 'kinematics.avg-instant-vel', n,
    `()=>({g:[0,${ay},9.81],a:[0,${ay},0]})`);
  await leg(1.0, 20); await leg(0, 30); await leg(-1.0, 20);   // out, coast, stop
  await push(p, 'kinematics.avg-instant-vel', 80, '()=>({g:[0,0,9.81],a:[0,0,0]})');
  s = await S(p);
  t('trial closed by the long stillness', s.ph, 'done');
  t('  and not at the pause in the middle', s.cap.dur > 1.2, true);
  const cd = await p.evaluate(() => {
    const st = _sl.st, I = SL_IMPL['avg-inst'], P = st.cap.p, d = st.cap.dur;
    st.m1 = 0; st.m2 = 1; const whole = I.chord(st);
    const vmax = Math.max(...P.map(q => q.v));
    const fast = P.filter(q => q.v > 0.95 * vmax);
    st.m1 = fast[0].t / d; st.m2 = fast[fast.length - 1].t / d;
    const coast = I.chord(st);
    return { va: whole.va, wa: whole.A.v, wb: whole.B.v,
             cv: coast.va, ca: coast.A.v, xend: P[P.length - 1].x, d };
  });
  t('the dead tail is trimmed off the capture', cd.d, 1.65, 0.12);
  t('endpoints are at rest', Math.abs(cd.wa) + Math.abs(cd.wb) < 0.05, true);
  t('yet the average over the trial is not zero', cd.va, 0.4 / cd.d, 0.02);
  t('  and it is exactly Δx/Δt', cd.va, cd.xend / cd.d, 0.01);
  t('inside the coast the chord matches the tangents', Math.abs(cd.cv - cd.ca) < 0.02, true);
  t('  where the phone moved at ~0.4 m/s', cd.cv, 0.4, 0.06);
  t('dragging marker 2 leaves marker 1 alone', await p.evaluate(() => {
    const st = _sl.st, r = st.xr, I = SL_IMPL['avg-inst'];
    st.m1 = 0.2; st.m2 = 0.8;
    I.pointer(st, r.x + r.w * 0.78, r.y + 5, 'down');
    I.pointer(st, r.x + r.w * 0.60, r.y + 5, 'move');
    I.pointer(st, 0, 0, 'up');
    I.pointer(st, -9999, -9999, 'move');       // a stray move after release
    return [st.m1.toFixed(2), st.m2.toFixed(2)].join(',');
  }), '0.20,0.60');

  console.log('\n13) statics.center-mass — the accelerometer as a spirit level');
  await openLab(p, 'statics.center-mass');
  await push(p, 'statics.center-mass', 50, '()=>({g:[0,9.81*Math.sin(0.09),9.81*Math.cos(0.09)]})');
  s = await S(p);
  t('a 5° list is read as a tilt', s.th, 5.16, 0.15);
  t('  and is NOT called balanced', s.ok, false);
  t('recording is refused while tilted', await p.evaluate(() => SL_IMPL['com-balance'].record(_sl.st)), false);
  await push(p, 'statics.center-mass', 60,
    'i=>({g:[0,9.81*Math.sin(0.004*Math.sin(i/3)),9.81*Math.cos(0.004)]})');
  s = await S(p);
  t('level is recognised', s.ok, true);
  t('  with the wobble reported, not hidden', s.sd > 0 && s.sd < 0.3, true);
  const cm = await p.evaluate(() => {
    document.getElementById('sl-len').value = '15.0';
    document.getElementById('sl-d').value = '7.0';
    const a = SL_IMPL['com-balance'].record(_sl.st);
    document.getElementById('sl-d').value = '7.2';
    const b = SL_IMPL['com-balance'].record(_sl.st);
    return { a, b, m: SL_IMPL['com-balance'].mean(_sl.st), n: _sl.st.pts.length };
  });
  t('two balance points recorded', cm.n, 2);
  t('x_cm lands where the ruler said, as a fraction of L', cm.m.f, 7.1 / 15, 0.002);
  t('and the spread between attempts is kept', cm.m.hi - cm.m.lo, 0.2 / 15, 0.002);
  t('face down is rejected outright', await p.evaluate(() => {
    const st = _sl.st, impl = SL_IMPL['com-balance'];
    const S4 = () => ({ dt: 0.02, t: 0, exact: true, hz: 50, ax: 0, ay: 0, az: 0,
      gx: 0, gy: 0, gz: -9.81, Gx: 0, Gy: 0, Gz: -9.81, ra: 0, rb: 0, rg: 0 });
    for (let i = 0; i < 60; i++) impl.sample(S4(), st);
    return [st.up, st.ok, impl.record(st)].join(',');
  }), 'false,false,false');
  await p.evaluate(() => document.getElementById('sl-clr').click());
  t('clear empties the record', (await S(p)).pts.length, 0);

  console.log('\n14) the freeze control');
  await openLab(p, 'forces2.gravity-force');
  const fz = await p.evaluate(async () => {
    const fire = n => { for (let i = 0; i < n; i++) window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
      acceleration: { x: 0, y: 0, z: 0 }, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
      rotationRate: null, interval: 20 })); };
    document.getElementById('sl-hold').click();
    const paused = _sl.paused, n0 = _sl.st.n;
    fire(12); await new Promise(r => setTimeout(r, 60));
    const held = _sl.st.n - n0;
    document.getElementById('sl-hold').click();
    fire(12); await new Promise(r => setTimeout(r, 60));
    return { paused, held, resumed: _sl.st.n - n0, nowPaused: _sl.paused };
  });
  t('the button freezes', fz.paused, true);
  t('no samples land while frozen', fz.held, 0);
  t('they resume afterwards', fz.resumed, 12);
  t('and it is released', fz.nowPaused, false);

  console.log('\n15) the event stream itself (real events, real time)');
  const st2 = await p.evaluate(async () => {
    let n = 0;
    _sensor.got = 0; _sensor.bad = 0;
    sensorStart(() => n++);
    const fire = (o) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', o));
    for (let i = 0; i < 60; i++) {
      // interval claims 5 ms (200 Hz) while the events really arrive at ~50 Hz
      fire({ acceleration: { x: 0, y: 0, z: 0 },
             accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
             rotationRate: null, interval: 5 });
      await new Promise(r => setTimeout(r, 20));
    }
    const hz = _sensor.hz, n0 = n, bad0 = _sensor.bad;
    for (let i = 0; i < 20; i++) fire({ acceleration: null, accelerationIncludingGravity: null, rotationRate: null });
    const out = { valid: n, got: _sensor.got, bad: _sensor.bad, hz,
                  reached: n - n0, rejected: _sensor.bad - bad0 };
    sensorStop();
    return out;
  });
  t('accounting balances (received − rejected = valid)', st2.got - st2.bad, st2.valid);
  t('rate follows the wall clock, not the claimed interval', st2.hz, 50, 15);
  t('  and is NOT the 200 Hz the interval claimed', st2.hz < 120, true);
  t('every empty event is rejected', st2.rejected, 20);
  t('  and not one of them reaches a lab as data', st2.reached, 0);

  console.log('\n16) lifecycle');
  await openLab(p, 'planar.circular');
  const life = await p.evaluate(() => {
    const before = { run: _sl.run, resize: !!_sl.onResize, stop: !!_sensor.stop };
    state.tab = 'sim'; render();
    return { before, after: { run: _sl.run, raf: _sl.raf, resize: !!_sl.onResize, stop: !!_sensor.stop } };
  });
  t('a lab runs while it is open', life.before.run, true);
  t('  with a resize handler registered', life.before.resize, true);
  t('the stream stops on navigation', life.after.stop, false);
  t('the animation frame is cancelled', life.after.raf, null);
  t('not running', life.after.run, false);
  t('the resize handler is released', life.after.resize, false);

  console.log('\n17) every lab renders on a phone');
  const painted = await p.evaluate(async () => {
    let n = 0;
    for (const k of Object.keys(SENSOR_LABS)) {
      const [ch, se] = k.split('.');
      state.subject = 'mechanics'; state.chapter = ch; state.section = se; state.tab = 'theory';
      render();
      await new Promise(r => setTimeout(r, 60));
      const cv = document.getElementById('sl-canvas');
      if (cv && cv.width > 0 && document.getElementById('sl-start')) n++;
    }
    return n;
  });
  t('all twelve painted', painted, 12);
  console.log('   phone page errors:', p._errs.length ? p._errs.join(' | ') : 'NONE');
  if (p._errs.length) fail++;

  console.log('\n18) desktop degrades to a note');
  const dc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await dc.newPage();
  const derr = [];
  dp.on('pageerror', e => derr.push(e.message));
  await dp.goto(F);
  await dp.waitForTimeout(900);
  await dp.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });
  const desk = await dp.evaluate(async () => {
    let note = 0, canvas = 0;
    for (const k of Object.keys(SENSOR_LABS)) {
      const [ch, se] = k.split('.');
      state.subject = 'mechanics'; state.chapter = ch; state.section = se; state.tab = 'theory';
      render();
      await new Promise(r => setTimeout(r, 40));
      if (document.querySelector('.sl-desk')) note++;
      if (document.getElementById('sl-canvas')) canvas++;
    }
    return { note, canvas, phone: phoneHasMotion(), live: _sl.run };
  });
  t('phoneHasMotion() is false on a desktop', desk.phone, false);
  t('no live lab', desk.live, false);
  t('all twelve show the note instead', desk.note, 12);
  t('and none of them opens a canvas', desk.canvas, 0);
  console.log('   desktop page errors:', derr.length ? derr.join(' | ') : 'NONE');
  if (derr.length) fail++;

  await b.close();
  console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ ALL SENSOR TESTS PASS');
  process.exit(fail ? 1 : 0);
})();
