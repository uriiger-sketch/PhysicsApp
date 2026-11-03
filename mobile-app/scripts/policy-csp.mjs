// store/privacy-policy.html allows its one <style> by SHA-256: after editing
// the style, run this to write the new hash into the page's CSP.
//
//   node scripts/policy-csp.mjs          (--check: fail instead of writing)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP } from './_tools.mjs';

const file = path.join(APP, 'store', 'privacy-policy.html');
const src = fs.readFileSync(file, 'utf8');
const styles = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)];
if (styles.length !== 1 || /<script/i.test(src)) throw new Error('the policy page must have exactly one <style> and no script');
const hash = crypto.createHash('sha256').update(styles[0][1], 'utf8').digest('base64');
const out = src.replace(/style-src 'sha256-[^']*'/, `style-src 'sha256-${hash}'`);
if (process.argv.includes('--check')) {
  if (out !== src) { console.error('policy-csp: the CSP hash is stale -- run node scripts/policy-csp.mjs'); process.exit(1); }
  console.log('policy-csp: hash current');
} else {
  fs.writeFileSync(file, out);
  console.log(`policy-csp: style-src 'sha256-${hash}'`);
}
