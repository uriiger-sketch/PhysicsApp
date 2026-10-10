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
    // a real accelerometer's gravity-included reading carries the motion too
    for (let i = 1; i <= n; i++) { const a = A * Math.sin(2 * Math.PI * i * DT / T); S.push({ a: [0, a, 0], g: [0, a, G] }); }
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
    for (let i = 0; i < 20; i++) S.push({ a: [0, bias, 0], g: [0, bias, G] });
    for (let i = 1; i <= n; i++) { const a = A * Math.sin(2 * Math.PI * i * DT / T) + bias; S.push({ a: [0, a, 0], g: [0, a, G] }); }
    for (let i = 0; i < 80; i++) S.push({ a: [0, bias, 0], g: [0, bias, G] });
    await feed(p, key, S);
    const r = await p.evaluate(() => { const st = _sl.st; return { ph: st.ph, xc: st.res && st.res.xc, xr: st.res && st.res.xr,
      v: st.tr[1].d.slice(), x: st.tr[2].d.slice() }; });
    tb('the raw integral really did drift', r.xr - A / (2 * Math.PI) > 0.01, 'raw ' + (r.xr || 0).toFixed(4));
    t('corrected Δx', r.xc, A * T * T / (2 * Math.PI), 0.006);
    t('plotted v is the corrected one (ends at 0)', r.v[r.v.length - 1], 0, 0.01);
    t('plotted x is the corrected one', r.x[r.x.length - 1], r.xc, 0.002);
  }

  // ── 2b. the gravity-free channel is high-passed; the lab must not care ──
  console.log('\n2b) same slide, but the gravity-free channel is the reading minus a 0.5 s low-pass of itself');
  {
    const key = 'kinematics.acceleration', A = 1.5, T = 1.0, n = Math.round(T / DT), tau = 0.5;
    await open(p, key);
    const raw = [];
    for (let i = 0; i < 80; i++) raw.push(0);
    for (let i = 1; i <= n; i++) raw.push(A * Math.sin(2 * Math.PI * i * DT / T));
    for (let i = 0; i < 80; i++) raw.push(0);
    // what a phone without a fused linear-acceleration sensor reports as
    // 'acceleration': the reading minus its own low-pass -- a high-pass filter
    let lp = 0; const hp = raw.map(a => { lp += (DT / tau) * (a - lp); return a - lp; });
    // integrated twice, that channel brings x back toward zero once the phone stops
    let v = 0, x = 0; hp.forEach(a => { v += a * DT; x += v * DT; });
    await feed(p, key, raw.map((a, i) => ({ a: [0, hp[i], 0], g: [0, a, G] })));
    const r = await p.evaluate(() => _sl.st.res && _sl.st.res.xc);
    tb('the high-passed channel really would have lost most of Δx', x < 0.6 * A / (2 * Math.PI), 'HP x ' + x.toFixed(4));
    t('Δx from the raw axis, unharmed', r, A * T * T / (2 * Math.PI), 0.004);
  }

  // ── 2c. tilt: a hard push is not a tilt; a real tilt (gyroscope) is ─────
  console.log('\n2c) a 2 m/s² shove with the reading leaning toward it, and a 5° rock seen by the gyroscope');
  {
    const key = 'kinematics.acceleration';
    const run = async (rock) => {
      await open(p, key);
      const S = [];
      const pushS = (gy, n, rb) => { for (let i = 0; i < n; i++) S.push({ a: [0, gy, 0], g: [0, gy, G], r: [0, rb || 0, 0] }); };
      pushS(0, 80); pushS(2, 50, rock ? 10 : 0); pushS(-2, 50, rock ? -10 : 0); pushS(0, 80);
      await p.evaluate(([key, S, DT]) => {
        const impl = SL_IMPL[SENSOR_LABS[key].t], st = _sl.st;
        // the stream's own gravity estimate: a 0.5 s low-pass of the reading,
        // which leans toward the push -- the old tilt test read that lean
        let G = null;
        S.forEach((o, i) => { const k = Math.min(1, DT / 0.5);
          G = G ? G.map((q, j) => q + k * (o.g[j] - q)) : o.g.slice();
          impl.sample({ dt: DT, t: i * DT, exact: true, gyro: true, hz: 1 / DT,
            ax: o.a[0], ay: o.a[1], az: o.a[2], gx: o.g[0], gy: o.g[1], gz: o.g[2],
            Gx: G[0], Gy: G[1], Gz: G[2], ra: o.r[0], rb: o.r[1], rg: o.r[2] }, st); });
      }, [key, S, DT]);
      return p.evaluate(() => _sl.st.res && _sl.st.res.tilt);
    };
    t('a flat shove: no tilt reported (°)', await run(false), 0, 0.05);
    t('rocked 5° and back, as the gyroscope saw it (°)', await run(true), 5, 0.1);
  }

  // ── 2d. a real slip: slow, and the reading carries it ───────────────────
  console.log('\n2d) board raised 10°→27° over 3 s, then the phone slides off at g(sinθ − μk cosθ) = 0.78 m/s²');
  {
    const key = 'forces2.static-friction', th1 = 27 * Math.PI / 180, muk = 0.42;
    await open(p, key);
    const aS = G * (Math.sin(th1) - muk * Math.cos(th1));
    const S = [], at = (th, a) => {
      // in the phone's frame: x down the slope. At rest the reading's in-plane
      // part is -g sinθ (up the slope); sliding, it is that plus a.
      S.push({ a: [a, 0, 0], g: [-G * Math.sin(th) + a, 0, G * Math.cos(th)] });
    };
    for (let i = 0; i < 100; i++) at(10 * Math.PI / 180, 0);
    for (let i = 0; i < 300; i++) at((10 + 17 * i / 299) * Math.PI / 180, 0);
    for (let i = 0; i < 60; i++) at(th1, 0);                    // held there a moment
    at(th1, 0.3 * aS); at(th1, 0.7 * aS);                       // the onset takes two samples
    for (let i = 0; i < 40; i++) at(th1, aS);                   // and it slides
    await feed(p, key, S);
    const r = await p.evaluate(() => ({ n: _sl.st.pts.length, th: _sl.st.slip * 180 / Math.PI }));
    tb('the slip was caught although it never reached 1.2 m/s²', r.n === 1, 'readings ' + r.n);
    t('at the angle it let go (°), not the angle the sliding reading implies', r.th, 27, 0.2);
    // and when it lets go in the middle of a steady 5.7°/s lift, with no pause
    await open(p, key);
    S.length = 0;
    for (let i = 0; i < 100; i++) at(10 * Math.PI / 180, 0);
    for (let i = 0; i < 300; i++) at((10 + 17 * i / 299) * Math.PI / 180, 0);
    at(th1, 0.3 * aS); at(th1, 0.7 * aS);
    for (let i = 0; i < 40; i++) at(th1, aS);
    await feed(p, key, S);
    const r2 = await p.evaluate(() => ({ n: _sl.st.pts.length, th: _sl.st.slip * 180 / Math.PI }));
    tb('a slip during the lift is caught too', r2.n === 1, 'readings ' + r2.n);
    t('  within the lift of the last 60 ms (°)', r2.th, 27, 0.6);
  }

  // ── 2e. office chair spin-down with a noisy accelerometer ────────────────
  console.log('\n2e) chair spin-down, r = 0.25 m, ω 4.5 → 1 rad/s, accelerometer noise 0.03 m/s² per axis');
  {
    const key = 'planar.circular', r0 = 0.25, sig = 0.03;
    await open(p, key);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const spin = async (wOf, n, quiet) => {
      await open(p, key);
      const S = [];
      for (let i = 0; i < quiet; i++) S.push({ a: [0, 0, 0], g: [sig * gauss(), sig * gauss(), G + sig * gauss()], r: [0, 0, 0] });
      for (let i = 0; i < n; i++) {
        const w = wOf(i / n), ac = w * w * r0;
        S.push({ a: [0, 0, 0], g: [ac + sig * gauss(), sig * gauss(), G + sig * gauss()], r: [0, 0, w * 57.29578] });
      }
      await p.evaluate(([key, S, DT]) => {
        const impl = SL_IMPL[SENSOR_LABS[key].t], st = _sl.st;
        S.forEach((o, i) => impl.sample({ dt: DT, t: i * DT, exact: true, gyro: true, hz: 1 / DT,
          ax: o.a[0], ay: o.a[1], az: o.a[2], gx: o.g[0], gy: o.g[1], gz: o.g[2], Gx: o.g[0], Gy: o.g[1], Gz: o.g[2],
          ra: o.r[0], rb: o.r[1], rg: o.r[2] }, st));
      }, [key, S, DT]);
      return p.evaluate(() => ({ r: _sl.st.r, pts: _sl.st.pts }));
    };
    const r = await spin(f => 4.5 - 3.5 * f, Math.round(15 / DT), 300);
    tb('points collected across the spin-down', r.pts.length > 30, r.pts.length + ' points');
    t('r from the slope (m)', r.r, r0, 0.006);
    // a slow, steady turn, a_c = 0.29 m/s²: a difference of squares this small
    // is mostly noise, but the points must still scatter about the truth
    const w0 = Math.sqrt(0.29 / r0), q = await spin(() => w0, Math.round(30 / DT), 300);
    const mac = q.pts.reduce((a, p2) => a + p2[1], 0) / (q.pts.length || 1);
    tb('a slow steady turn still gives points', q.pts.length > 60, q.pts.length + ' points');
    t('  and they average to about its a_c (m/s²)', mac, 0.29, 0.07);
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

  // ── 4b. the phone tumbled 40° on the way down ───────────────────────────
  console.log('\n4b) same drop, but the phone lands turned 40° from how it was calibrated');
  {
    const key = 'momentum.momentum-def';
    await open(p, key);
    const S = rest(80), Tf = 0.25, vImp = G * Tf, tb2 = 0.10, aUp = vImp / tb2, c = Math.cos(0.698), sn = Math.sin(0.698);
    for (let i = 0; i < Math.round(Tf / DT); i++) S.push({ a: [0, 0, 0], g: [0, 0, 0] });
    // the cushion still pushes straight up; in the turned phone's frame that is
    // partly along y
    for (let i = 0; i < Math.round(tb2 / DT); i++) S.push({ a: [0, 0, 0], g: [0, (G + aUp) * sn, (G + aUp) * c] });
    for (let i = 0; i < 40; i++) S.push({ a: [0, 0, 0], g: [0, G * sn, G * c], G: [0, G * sn, G * c] });
    await p.evaluate(() => { document.getElementById('sl-pm').value = '0.2'; });
    await feed(p, key, S);
    const r = await p.evaluate(() => _sl.st.last);
    tb('a landing was recorded', !!r);
    if (r) {
      t('Δv over the contact = gT, however the phone turned', r.dv, vImp, 0.04);
      t('Δp = m·Δv (kg·m/s)', r.dp, 0.2 * vImp, 0.01);
      t('average net force = Δp/Δt (N)', r.F, 0.2 * vImp / r.dt, 0.01);
    }
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

  // ── 5b. the same ride, held in a trembling hand ──────────────────────────
  console.log('\n5b) the same ride in a hand that trembles at 9 Hz, ±0.3 m/s²');
  {
    const key = 'forces.tension';
    await open(p, key);
    const prof = [], ramp = 0.6, hold = 0.8, am = 0.7, coast = 2.0;
    const seg = (fn, dur) => { for (let i = 0; i < Math.round(dur / DT); i++) prof.push(fn((i + 1) * DT / dur)); };
    seg(() => 0, 1.0);
    seg(f => am * f, ramp); seg(() => am, hold); seg(f => am * (1 - f), ramp);
    seg(() => 0, coast);
    seg(f => -am * f, ramp); seg(() => -am, hold); seg(f => -am * (1 - f), ramp);
    seg(() => 0, 3.0);
    let v = 0, h = 0, ap = 0; prof.forEach(a => { const vp = v; v += (ap + a) / 2 * DT; ap = a; h += (vp + v) / 2 * DT; });
    // calibrated on the hand too: the tremor is there from the start
    const trem = i => 0.3 * Math.sin(2 * Math.PI * 9 * i * DT);
    const S = [];
    for (let i = 0; i < 80; i++) S.push({ a: [0, 0, trem(i)], g: [0, 0, G], G: [0, 0, G] });
    prof.forEach((a, i) => S.push({ a: [0, 0, 0], g: [0, 0, G + a + trem(i + 80)] }));
    await feed(p, key, S);
    const r = await p.evaluate(() => ({ ph: _sl.st.ph, cap: _sl.st.cap && { h: _sl.st.cap.h, tmx: _sl.st.cap.tmx, tmn: _sl.st.cap.tmn } }));
    tb('the ride closed although the hand never stops shaking', !!r.cap && r.ph === 'ready', r.ph);
    if (r.cap) {
      t('heaviest moment T/mg = 1 + a/g, not that plus the tremor', r.cap.tmx, 1 + am / G, 0.006);
      t('lightest moment', r.cap.tmn, 1 - am / G, 0.006);
      t('height', r.cap.h, h, 0.03 * h);
    }
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
