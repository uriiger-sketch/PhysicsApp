// Opt-in test mode with KaTeX loaded -- the page real students get.
//
// By default every test runs with the CDN out of reach, so the app typesets
// with its own offline renderer. With KATEX=local the page's jsDelivr
// requests for katex@0.16.9 are answered from a local copy of that npm
// package's dist/ folder instead (the page's Subresource Integrity hashes
// still apply, so a copy that is not the published one fails to load, and
// the test stops saying so):
//
//   KATEX=local KATEX_DIR=/path/to/katex/dist node tests/check_bidi.js
//
// KATEX_DIR defaults to the dist/ of an installed `katex` package (NODE_PATH).
// Without KATEX=local both functions do nothing: the default mode is unchanged.
const fs = require('fs');
const path = require('path');

const ON = process.env.KATEX === 'local';
const CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/';
const TYPES = { '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

function dir() {
  if (process.env.KATEX_DIR) return path.resolve(process.env.KATEX_DIR);
  try { return path.dirname(require.resolve('katex/dist/katex.min.js')); } catch (e) {}
  console.error('KATEX=local: set KATEX_DIR to the dist/ folder of the katex@0.16.9 npm package');
  process.exit(2);
}

// call on a Page or a BrowserContext before the first goto
async function route(target) {
  if (!ON) return false;
  const D = dir();
  if (!fs.existsSync(path.join(D, 'katex.min.js'))) {
    console.error(`KATEX=local: no katex.min.js in ${D}`);
    process.exit(2);
  }
  if (!route.said) { route.said = true; console.log(`   [KaTeX mode: katex@0.16.9 served from ${D}]`); }
  await target.route(CDN + '**', r => {
    const rel = new URL(r.request().url()).pathname.replace(/^\/npm\/katex@0\.16\.9\/dist\//, '');
    const fp = path.resolve(D, decodeURIComponent(rel));
    if (!fp.startsWith(D + path.sep) || !fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: fs.readFileSync(fp),
      headers: { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  return true;
}

// call after the goto: waits until the app has started WITH KaTeX, and stops
// the test if it started without (a mode that silently fell back to the
// offline renderer would test nothing new)
async function ready(page) {
  if (!ON) return false;
  const ok = await page.waitForFunction(() => window._kxDone === true && window.katex && katex.version === '0.16.9'
    && !!window.renderMathInElement && typeof tex === 'function' && tex('x').indexOf('class="katex"') >= 0, null, { timeout: 8000 })
    .then(() => true, () => false);
  if (!ok) {
    console.error('KATEX=local: the app started without KaTeX (wrong files, SRI mismatch or a load error)');
    process.exit(2);
  }
  return true;
}

module.exports = { ON, route, ready };
