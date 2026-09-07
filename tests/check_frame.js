// Frame audit for the sensor labs: instrument every 2D drawing call, push the
// coordinates through the live transform, and report anything that lands
// outside the canvas. Text is reported separately from geometry, because a
// stroked guide line running to the edge is usually deliberate and a clipped
// label never is.
//
//   node tests/check_frame.js
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'physics_game_v28.html');

const INSTRUMENT = () => {
  const P = CanvasRenderingContext2D.prototype;
  window.__hits = [];
  const T = (ctx, x, y) => {
    const m = ctx.getTransform();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  };
  const note = (ctx, kind, x, y, extra) => {
    const cv = ctx.canvas, p = T(ctx, x, y);
    const pad = 1.5;
    if (p.x < -pad || p.y < -pad || p.x > cv.width + pad || p.y > cv.height + pad)
      window.__hits.push({ kind, x: Math.round(p.x), y: Math.round(p.y),
                           w: cv.width, h: cv.height, extra: extra || '' });
  };
  const wrapText = (name) => {
    const o = P[name];
    P[name] = function (t, x, y, ...r) {
      // a label is judged by its box, not by its anchor
      let w = 0; try { w = this.measureText(t).width; } catch (e) {}
      const a = this.textAlign, x0 = a === 'center' ? x - w / 2 : a === 'right' ? x - w : x;
      note(this, 'text', x0, y - 8, String(t).slice(0, 24));
      note(this, 'text', x0 + w, y + 3, String(t).slice(0, 24));
      return o.call(this, t, x, y, ...r);
    };
  };
  ['fillText', 'strokeText'].forEach(wrapText);
  for (const n of ['fillRect', 'strokeRect']) {
    const o = P[n];
    P[n] = function (x, y, w, h) { note(this, 'rect', x, y); note(this, 'rect', x + w, y + h); return o.call(this, x, y, w, h); };
  }
  const oa = P.arc;
  // Sample the arc PATH, not its bounding box: a wedge of a large circle is a
  // legitimate drawing whose box sticks far out of the canvas.
  P.arc = function (x, y, r, a0, a1, ccw, ...rest) {
    const tag = `c=(${Math.round(x)},${Math.round(y)}) r=${Math.round(r)}`;
    let s0 = a0 || 0, s1 = (a1 === undefined) ? Math.PI * 2 : a1;
    if (ccw) { const t = s0; s0 = s1; s1 = t; }
    if (s1 < s0) s1 += Math.PI * 2;
    const n = Math.max(4, Math.min(24, Math.ceil((s1 - s0) / 0.3)));
    for (let i = 0; i <= n; i++) {
      const a = s0 + (s1 - s0) * i / n;
      note(this, 'arc', x + r * Math.cos(a), y + r * Math.sin(a), tag);
    }
    return oa.call(this, x, y, r, a0, a1, ccw, ...rest); };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
  await p.addInitScript(INSTRUMENT);
  await p.goto(F);
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.closeOnboarding) closeOnboarding(); });

  let bad = 0;
  const keys = await p.evaluate(() => Object.keys(SENSOR_LABS));
  for (const k of keys) {
    const [ch, se] = k.split('.');
    await p.evaluate(([c, x]) => {
      state.subject = 'mechanics'; state.chapter = c; state.section = x; state.tab = 'theory'; render();
    }, [ch, se]);
    await p.waitForFunction(() => _sl.st !== null, null, { timeout: 9000 });
    await p.evaluate(() => document.getElementById('sl-start').click());
    await p.waitForTimeout(150);

    // drive it into its most crowded state, then measure the steady frame
    const r = await p.evaluate(async (key) => {
      const type = SENSOR_LABS[key].t, impl = SL_IMPL[type], st = _sl.st;
      const smp = (g, a, rr) => ({ dt: 0.02, t: 0, exact: true, hz: 50,
        ax: a[0], ay: a[1], az: a[2], gx: g[0], gy: g[1], gz: g[2],
        Gx: g[0], Gy: g[1], Gz: g[2], ra: rr[0], rb: rr[1], rg: rr[2] });
      // a generic workout: rest, tilt, a burst, a spin, a swing
      for (let i = 0; i < 90; i++) impl.sample(smp([0, 0, 9.81], [0, 0, 0], [0, 0, 0]), st);
      for (let i = 0; i < 60; i++) {
        const th = 0.5 * Math.sin(i / 8);
        impl.sample(smp([9.81 * Math.sin(th), 3 * Math.sin(i / 3), 9.81 * Math.cos(th)],
                        [Math.sin(i / 4), Math.cos(i / 5), 0], [60 * Math.sin(i / 7), 10, 5]), st);
      }
      for (let i = 0; i < 40; i++) impl.sample(smp([0, 0, 0.05], [0, 0, 0], [0, 0, 0]), st);
      for (let i = 0; i < 40; i++) impl.sample(smp([0, 0, 40], [0, 0, 0], [0, 0, 0]), st);
      for (let i = 0; i < 90; i++) impl.sample(smp([0, 0, 9.81], [0, 0, 0], [0, 0, 0]), st);
      // measured at rest AND zoomed in, where a shrunken axis range can throw
      // recorded points outside the plot box
      const out = [];
      for (const z of [1, 2.56, 0.39]) {
        slZoomSet(z);
        window.__hits = [];
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 120));
        out.push(...window.__hits.map(x => ({ ...x, extra: `×${z} ` + x.extra })));
      }
      slZoomSet(1);
      window.__hits = [];
      return out;
    }, k);

    const text = r.filter(x => x.kind === 'text');
    const geom = r.filter(x => x.kind !== 'text');
    if (text.length || geom.length) {
      bad++;
      console.log(`   ${k}`);
      const show = (list, label) => {
        const uniq = [...new Map(list.map(x => [x.kind + x.extra + x.x + x.y, x])).values()].slice(0, 6);
        uniq.forEach(x => console.log(`      ${label} ${x.kind} at (${x.x},${x.y}) in ${x.w}×${x.h}` +
          (x.extra ? `  "${x.extra}"` : '')));
      };
      show(text, 'CLIPPED'); show(geom, 'OUT');
    }
  }
  await b.close();
  console.log(bad ? `\n❌ ${bad} lab(s) paint outside their canvas` : `\n✅ all ${keys.length} lab canvases stay in frame`);
  process.exit(bad ? 1 : 0);
})();
