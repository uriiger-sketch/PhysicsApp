// Sensor labs against motions with a known answer.
//
// check_sensors.js proves the labs run. This proves they are RIGHT: each lab
// is fed a motion whose displacement, velocity curve or impulse is known in
// closed form, and both the reported numbers and the plotted curves are
// compared with it. A lab that integrates correctly but plots the uncorrected
// integral, or that pins v = 0 at the wrong instant, fails here.
//
//   node tests/check_sensor_physics.js
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

let fail = 0;
const t = (name, got, want, tol) => {
  const ok = isFinite(got) && Math.abs(got - want) <= tol;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'} ${name}: got ${(+got).toFixed(4)} want ${want}±${tol}`);
};
const tb = (name, cond, detail) => { if (!cond) fail++; console.log(`   ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const G = 9.81, DT = 0.01;              // 100 Hz, so short events are resolved

const open = async (p, key) => {
  const [ch, se] = key.split('.');
  await p.evaluate(([c, x]) => { state.subject = 'mechanics'; state.chapter = c; state.section = x;
    state.tab = 'theory'; render(); }, [ch, se]);
  await p.waitForFunction(() => _sl.st !== null, null, { timeout: 8000 });
};
// feed an array of {a:[3], g:[3]} samples into the lab that is open
const feed = (p, key, S) => p.evaluate(([key, S, DT]) => {
  const impl = SL_IMPL[SENSOR_LABS[key].t], st = _sl.st;
  S.forEach((o, i) => impl.sample({ dt: DT, t: i * DT, exact: true, hz: 1 / DT,
    ax: o.a[0], ay: o.a[1], az: o.a[2], gx: o.g[0], gy: o.g[1], gz: o.g[2],
    Gx: o.G ? o.G[0] : o.g[0], Gy: o.G ? o.G[1] : o.g[1], Gz: o.G ? o.G[2] : o.g[2],
    ra: 0, rb: 0, rg: 0 }, st));
}, [key, S, DT]);
const rest = n => Array.from({ length: n }, () => ({ a: [0, 0, 0], g: [0, 0, G], G: [0, 0, G] }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(F); await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  // ── 1. a push-pull slide: a = A sin(2πt/T), so Δx = A T²/2π exactly ────────
  console.log('\n1) slide on a table: a = 1.5 sin(2πt/1s)  →  Δx = 1.5/2π = 0.2387 m');
  {
    const key = 'kinematics.acceleration', A = 1.5, T = 1.0, n = Math.round(T / DT);
    await open(p, key);
    const S = rest(80);
    for (let i = 1; i <= n; i++) { const a = A * Math.sin(2 * Math.PI * i * DT / T); S.push({ a: [0, a, 0], g: [0, 0, G] }); }
    S.push(...rest(80));
    await feed(p, key, S);
    const r = await p.evaluate(() => { const st = _sl.st; return { ph: st.ph, xc: st.res && st.res.xc,
      drift: st.res && st.res.drift, v: st.tr[1].d.slice(), x: st.tr[2].d.slice(), T: st.res && st.res.T }; });
    tb('the trial closed by itself', r.ph === 'done', r.ph);
    t('reported Δx', r.xc, A * T * T / (2 * Math.PI), 0.004);
    t('plotted x ends at the reported Δx', r.x[r.x.length - 1], r.xc, 0.002);
    t('plotted v ends at rest', r.v[r.v.length - 1], 0, 0.01);
    t('plotted v peaks at A·T/π', Math.max(...r.v), A * T / Math.PI, 0.02);
    t('plotted x starts at 0', r.x[0], 0, 0.001);
  }

  // ── 2. the same slide with a bias that appears only once it is moving ──────
  console.log('\n2) same slide + a 0.05 m/s² bias after calibration (the drift the lab removes)');
  {
    const key = 'kinematics.acceleration', A = 1.5, T = 1.0, n = Math.round(T / DT), bias = 0.05;
    await open(p, key);
    const S = rest(60);                              // calibration ends after 55 of these
    for (let i = 0; i < 20; i++) S.push({ a: [0, bias, 0], g: [0, 0, G] });
    for (let i = 1; i <= n; i++) { const a = A * Math.sin(2 * Math.PI * i * DT / T) + bias; S.push({ a: [0, a, 0], g: [0, 0, G] }); }
    for (let i = 0; i < 80; i++) S.push({ a: [0, bias, 0], g: [0, 0, G] });
    await feed(p, key, S);
    const r = await p.evaluate(() => { const st = _sl.st; return { ph: st.ph, xc: st.res && st.res.xc, xr: st.res && st.res.xr,
      v: st.tr[1].d.slice(), x: st.tr[2].d.slice() }; });
    tb('the raw integral really did drift', r.xr - A / (2 * Math.PI) > 0.01, 'raw ' + (r.xr || 0).toFixed(4));
    t('corrected Δx', r.xc, A * T * T / (2 * Math.PI), 0.006);
    t('plotted v is the corrected one (ends at 0)', r.v[r.v.length - 1], 0, 0.01);
    t('plotted x is the corrected one', r.x[r.x.length - 1], r.xc, 0.002);
  }

  // ── 3. toss and catch: v must cross 0 at the top of the flight ────────────
  console.log('\n3) toss: 0.15 s at +g, free flight 0.30 s, catch at the same height');
  {
    const key = 'kinematics.freefall';
    await open(p, key);
    // a self-consistent toss: throw at +g for 0.15 s, so the flight back to the
    // same height lasts exactly 2v/g = 0.30 s — a whole number of samples — and
    // the catch at +g for 0.15 s really does bring the phone to rest
    const up = [0, 0, 1], S = rest(80);
    const push = (acc, n) => { for (let i = 0; i < n; i++) S.push({ a: [0, 0, 0], g: up.map(u => u * (G + acc)) }); };
    push(G, 15);
    const vRel = G * 0.15, Tf = 2 * vRel / G;
    for (let i = 0; i < Math.round(Tf / DT); i++) S.push({ a: [0, 0, 0], g: [0, 0, 0] });
    push(G, 15);
    S.push(...rest(60));
    await feed(p, key, S);
    const r = await p.evaluate(() => { const c = _sl.st.cap; if (!c) return null;
      const at = t => { const P = c.p; for (let i = 1; i < P.length; i++) if (P[i].t >= t) {
        const f = (t - P[i - 1].t) / ((P[i].t - P[i - 1].t) || 1); return P[i - 1].v + f * (P[i].v - P[i - 1].v); } return P[P.length - 1].v; };
      let zc = null; for (let i = 1; i < c.p.length; i++) if (c.p[i - 1].t >= c.fs && c.p[i - 1].v < 0 && c.p[i].v >= 0) {
        const f = -c.p[i - 1].v / (c.p[i].v - c.p[i - 1].v); zc = c.p[i - 1].t + f * (c.p[i].t - c.p[i - 1].t); break; }
      const s = SL_IMPL['freefall-toss'].slope(_sl.st);
      return { anchored: c.anchored, v0: c.p[0].v, vend: c.p[c.p.length - 1].v, vfs: at(c.fs), vfe: at(c.fe),
               zc, mid: (c.fs + c.fe) / 2, g: s && s.g }; });
    tb('a toss was captured', !!r);
    if (r) {
      tb('v is pinned at the rest before the throw', r.anchored);
      t('v = 0 at the start (at rest)', r.v0, 0, 1e-9);
      t('v at release = −1.47 m/s (upward; down is +)', r.vfs, -vRel, 0.08);
      t('v at the catch = +1.47 m/s', r.vfe, vRel, 0.08);
      t('v crosses 0 at the middle of the flight (the top)', r.zc, r.mid, 0.02);
      t('v back at 0 after the catch', r.vend, 0, 0.03);
      t('slope between the markers = g', r.g, G, 0.05);
    }
  }

  // ── 4. landing: Δv over the whole contact equals the impact speed gT ──────
  console.log('\n4) drop 0.25 s onto a cushion whose force starts BELOW the weight');
  {
    const key = 'momentum.momentum-def';
    await open(p, key);
    const S = rest(80), Tf = 0.25, vImp = G * Tf;
    for (let i = 0; i < Math.round(Tf / DT); i++) S.push({ a: [0, 0, 0], g: [0, 0, 0] });
    // soft start: surface force 0.5 mg for 30 ms — the phone is still speeding up
    for (let i = 0; i < 3; i++) S.push({ a: [0, 0, 0], g: [0, 0, 0.5 * G] });
    const v1 = vImp + 0.5 * G * 0.03, tb2 = 0.10, aUp = v1 / tb2;      // then brake to rest
    for (let i = 0; i < Math.round(tb2 / DT); i++) S.push({ a: [0, 0, 0], g: [0, 0, G + aUp] });
    S.push(...rest(40));
    await feed(p, key, S);
    const r = await p.evaluate(() => _sl.st.last);
    tb('a landing was recorded', !!r);
    if (r) { t('Δv over the contact = gT', r.dv, vImp, 0.04); t('reference v = gT', r.vf, vImp, 0.03); }
  }

  // ── 5. lift ride: a jerk-limited profile with a gentle ramp ───────────────
  console.log('\n5) lift: ramps of 0.6 s up to 0.7 m/s², coast, and back — height known exactly');
  {
    const key = 'forces.tension';
    await open(p, key);
    const prof = [];                                            // upward acceleration, per sample
    const ramp = 0.6, hold = 0.8, am = 0.7, coast = 2.0;
    const seg = (fn, dur) => { for (let i = 0; i < Math.round(dur / DT); i++) prof.push(fn((i + 1) * DT / dur)); };
    seg(f => am * f, ramp); seg(() => am, hold); seg(f => am * (1 - f), ramp);
    seg(() => 0, coast);
    seg(f => -am * f, ramp); seg(() => -am, hold); seg(f => -am * (1 - f), ramp);
    let v = 0, h = 0, ap = 0; prof.forEach(a => { const vp = v; v += (ap + a) / 2 * DT; ap = a; h += (vp + v) / 2 * DT; });
    const S = rest(80);
    prof.forEach(a => S.push({ a: [0, 0, 0], g: [0, 0, G + a] }));
    S.push(...rest(200));
    await feed(p, key, S);
    const r = await p.evaluate(() => _sl.st.cap && { h: _sl.st.cap.h, vend: _sl.st.cap.p[_sl.st.cap.p.length - 1].v });
    tb('the ride was captured', !!r);
    if (r) { t('height', r.h, h, 0.03 * h); t('v back at 0', r.vend, 0, 0.02); }
  }

  // ── 7. pendulum, on a phone WITHOUT a gravity-free acceleration ─────────
  console.log('\n7) pendulum L = 0.5 m, θ₀ = 10°, accelerometer reading only along the string');
  {
    const key = 'shm.pendulum', L = 0.5, th0 = 10 * Math.PI / 180, w0 = Math.sqrt(G / L);
    const T = 2 * Math.PI / w0 * (1 + th0 * th0 / 16);
    await open(p, key);
    await p.evaluate(L => { const e = document.getElementById('sl-L'); if (e) e.value = L; }, L);
    const w = 2 * Math.PI / T, S = [];
    for (let i = 0; i < Math.round(9 / DT); i++) {
      const tt = i * DT, th = th0 * Math.cos(w * tt), thd = -th0 * w * Math.sin(w * tt);
      const along = G * Math.cos(th) + L * thd * thd;          // what the string pulls with, per kg
      S.push({ a: [0, along - G * (1 - th0 * th0 / 4), 0], g: [0, along, 0], r: [0, thd * 180 / Math.PI, 0] });
    }
    await p.evaluate(([key, S, DT]) => {
      const impl = SL_IMPL[SENSOR_LABS[key].t], st = _sl.st;
      S.forEach((o, i) => impl.sample({ dt: DT, t: i * DT, exact: false, hz: 1 / DT,
        ax: o.a[0], ay: o.a[1], az: o.a[2], gx: o.g[0], gy: o.g[1], gz: o.g[2], Gx: o.g[0], Gy: o.g[1], Gz: o.g[2],
        ra: o.r[0], rb: o.r[1], rg: o.r[2] }, st));
    }, [key, S, DT]);
    const r = await p.evaluate(() => ({ T: _sl.st.T, amp: _sl.st.amp * 180 / Math.PI, gyro: _sl.st.gyro }));
    tb('the swing is timed from the gyroscope', r.gyro);
    t('period', r.T, T, 0.02);
    t('amplitude (°)', r.amp, 10, 1.5);
  }

  // ── 6. iPhone sign: Safari reports gravity itself, not its reaction ───────
  console.log('\n6) iPhone: Safari reports z = −9.81 flat face-up; the labs must see +9.81');
  {
    const ip = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
    await ip.goto(F); await ip.waitForTimeout(900);
    const got = await ip.evaluate(() => new Promise(res => {
      const out = []; _sensor.sign = 0;
      sensorStart(s => { out.push(s); if (out.length === 3) { sensorStop(); res(out[2]); } });
      for (let i = 0; i < 3; i++) window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        acceleration: { x: -0.5, y: 0, z: 0 }, accelerationIncludingGravity: { x: -0.5, y: 0, z: -9.81 },
        rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16 }));
    }));
    t('including-gravity z (face up)', got.gz, 9.81, 1e-6);
    t('linear x flipped with it', got.ax, 0.5, 1e-6);
    const an = await p.evaluate(() => new Promise(res => {
      const out = []; _sensor.sign = 0;
      sensorStart(s => { out.push(s); if (out.length === 3) { sensorStop(); res(out[2]); } });
      for (let i = 0; i < 3; i++) window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        acceleration: { x: 0.5, y: 0, z: 0 }, accelerationIncludingGravity: { x: 0.5, y: 0, z: 9.81 },
        rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16 }));
    }));
    t('Android left untouched', an.gz, 9.81, 1e-6);
  }

  console.log('\npage errors:', errs.length ? errs : 'NONE');
  console.log(fail ? `\n❌ ${fail} sensor physics check(s) failed` : '\n✅ EVERY SENSOR LAB AGREES WITH THE PHYSICS');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
