// Shared by art.mjs, screenshots.mjs and check.mjs: Playwright and Chromium
// (the repository's own dev tools when installed, else a global Playwright),
// a PNG re-encoder that drops the alpha channel (the App Store refuses an icon
// that has one, and Play's feature graphic must be 24-bit), the fonts the game
// carries inside its page, and the app's web bundle served at the app's origin.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(APP, '..');
export const WWW = path.join(APP, 'www');
export const ORIGIN = 'https://localhost';   // Capacitor's Android origin

export function playwright() {
  for (const from of [path.join(ROOT, 'package.json'), path.join(APP, 'package.json')]) {
    try { return createRequire(from)('playwright'); } catch (e) { /* next */ }
  }
  try { return createRequire(import.meta.url)('playwright'); } catch (e) {
    throw new Error('Playwright not found: run `npm ci` at the repository root (its dev tools include it)');
  }
}

export async function launch() {
  const { chromium } = playwright();
  const exe = createRequire(path.join(ROOT, 'package.json'))(path.join(ROOT, 'tests', '_browser.js'));
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
}

// ── PNG: RGBA in, RGB (colour type 2) out, adaptive filters ───────────────
function chunks(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  const out = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8);
    out.push({ type, data: buf.subarray(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

function decode(buf) {
  const cs = chunks(buf), h = cs.find((c) => c.type === 'IHDR').data;
  const w = h.readUInt32BE(0), ht = h.readUInt32BE(4), depth = h[8], ctype = h[9], interlace = h[12];
  if (depth !== 8 || (ctype !== 6 && ctype !== 2) || interlace) throw new Error(`unsupported PNG (depth ${depth}, type ${ctype}, interlace ${interlace})`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const px = Buffer.alloc(stride * ht);
  for (let y = 0; y < ht; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      const v = src[i];
      row[i] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  return { w, h: ht, bpp, px };
}

function crcChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

export function toRGB(buf) {
  const { w, h, bpp, px } = decode(buf);
  const stride = w * 3, out = Buffer.alloc((stride + 1) * h), rgb = Buffer.alloc(stride * h);
  for (let i = 0, j = 0; i < px.length; i += bpp, j += 3) {
    if (bpp === 4 && px[i + 3] !== 255) throw new Error('the image is not opaque: it would change colour without its alpha');
    rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2];
  }
  const cand = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = rgb.subarray(y * stride, (y + 1) * stride), up = y ? rgb.subarray((y - 1) * stride, y * stride) : null;
    let best = null, bestSum = Infinity, bestF = 0;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? row[i - 3] : 0, b = up ? up[i] : 0, c = up && i >= 3 ? up[i - 3] : 0;
        const v = (row[i] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? ((a + b) >> 1) : paeth(a, b, c))) & 255;
        cand[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; bestF = f; best = Buffer.from(cand); }
    }
    out[y * (stride + 1)] = bestF; best.copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    crcChunk('IHDR', ihdr), crcChunk('IDAT', zlib.deflateSync(out, { level: 9 })), crcChunk('IEND', Buffer.alloc(0))]);
}

export function pngInfo(buf) {
  const h = chunks(buf).find((c) => c.type === 'IHDR').data;
  return { width: h.readUInt32BE(0), height: h.readUInt32BE(4), colorType: h[9], alpha: h[9] === 6 || h[9] === 4 };
}

// the @font-face rules for Heebo and Rubik that the master carries inline
export function gameFonts() {
  const s = fs.readFileSync(path.join(ROOT, 'physics_game_v28.html'), 'utf8');
  const i = s.indexOf('<style>', s.indexOf('<meta name="referrer"')), j = s.indexOf('</style>', i);
  const css = s.slice(i + 7, j);
  if ((css.match(/@font-face\{/g) || []).length < 6) throw new Error('the master no longer carries its fonts inline');
  return css;
}

// the app's web bundle, served at the app's own origin -- what Capacitor's
// local server does on Android -- and nothing else: every other request fails
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
export async function serveApp(context, away = []) {
  await context.route(/^(https?|wss?):/, (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== ORIGIN) { away.push(r.request().url()); return r.abort(); }
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
    const file = path.join(WWW, path.normalize(rel));
    if (!file.startsWith(WWW + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  return away;
}
