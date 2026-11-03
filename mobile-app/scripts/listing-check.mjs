// Counts every field of store/listing.md against the store's limit in its
// heading -- "(App Store 30, Google Play 80)" -- and fails when one is over.
// Keywords: no spaces after commas (App Store counts them).
//
//   node scripts/listing-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { APP } from './_tools.mjs';

const md = fs.readFileSync(path.join(APP, 'store', 'listing.md'), 'utf8');
let fail = 0, n = 0;
for (const m of md.matchAll(/^### (.+)\n```text\n([\s\S]*?)\n```/gm)) {
  const [, head, text] = m, len = [...text].length;   // characters, not bytes
  const limits = [...head.matchAll(/(App Store|Google Play(?: release notes)?) (\d+)/g)].map((x) => [x[1], Number(x[2])]);
  const over = limits.filter(([, l]) => len > l);
  const kw = /Keywords/.test(head) && /, /.test(text);
  n++;
  console.log(`${over.length || kw ? 'FAIL' : '  ok'}  ${String(len).padStart(4)}  ${head}`);
  if (over.length || kw) fail++;
}
console.log(`listing-check: ${n - fail}/${n} fields within their limits`);
process.exit(fail || !n ? 1 : 0);
