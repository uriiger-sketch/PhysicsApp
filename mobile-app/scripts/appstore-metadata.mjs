// The App Store listing in the layout fastlane's `deliver` uploads, made from
// the texts and pictures in store/ -- listing.md (each language's fields and
// the URLs), answers.md (the review notes) and the screenshots -- so the store
// shows exactly what is reviewed here, in Hebrew and English.
//
//   node scripts/appstore-metadata.mjs     → build/appstore/{metadata,screenshots}/
//
// The Store apps workflow (.github/workflows/store-apps.yml) runs it before
// uploading. Not uploaded, because the stores' own forms hold them: App
// Privacy, the age rating, the price, the review contact, the copyright.

import fs from 'node:fs';
import path from 'node:path';
import { APP } from './_tools.mjs';

const OUT = path.join(APP, 'build', 'appstore');
const fail = (m) => { console.error(`appstore-metadata: ${m}`); process.exit(1); };
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const listing = read('store/listing.md');
const section = (from, to) => {
  const a = listing.indexOf(from), b = listing.indexOf(to, a + 1);
  if (a < 0 || b < 0) fail(`listing.md: no section between "${from}" and "${to}"`);
  return listing.slice(a, b);
};
const field = (sec, heading) => {
  const m = new RegExp('^### ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\n```text\\n([\\s\\S]*?)\\n```', 'm').exec(sec);
  if (!m || !m[1].trim()) fail(`listing.md: no "${heading}" text`);
  return m[1].trim();
};
const url = (row) => {
  const m = new RegExp('^\\| ' + row + '[^|]*\\| `(https://[^`]+)`', 'm').exec(listing);
  if (!m) fail(`listing.md: no ${row}`);
  return m[1];
};

const LOCALES = {
  he: section('## Hebrew', '## English'),          // App Store Connect: Hebrew (the primary language)
  'en-US': section('## English', '## The other fields'),
};
const URLS = { privacy_url: url('Privacy policy URL'), support_url: url('Support URL'), marketing_url: url('Marketing URL') };

fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, text) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.endsWith('\n') ? text : text + '\n');
};

for (const [loc, sec] of Object.entries(LOCALES)) {
  write(`metadata/${loc}/name.txt`, field(sec, 'App name'));
  write(`metadata/${loc}/subtitle.txt`, field(sec, 'Subtitle'));
  write(`metadata/${loc}/promotional_text.txt`, field(sec, 'Promotional text'));
  write(`metadata/${loc}/keywords.txt`, field(sec, 'Keywords'));
  write(`metadata/${loc}/description.txt`, field(sec, 'Description'));
  for (const [k, v] of Object.entries(URLS)) write(`metadata/${loc}/${k}.txt`, v);
}
write('metadata/primary_category.txt', 'EDUCATION');
write('metadata/secondary_category.txt', 'REFERENCE');

const answers = read('store/answers.md');
const notes = /### App Review notes[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(answers);
if (!notes) fail('answers.md: no App Review notes');
write('metadata/review_information/notes.txt', notes[1].trim());

// screenshots: the iPhone and iPad sets of each language, checked for size
function jpegSize(buf) {
  for (let o = 2; o < buf.length;) {
    if (buf[o] !== 0xff) return null;
    const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xc3) return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5) };
    o += 2 + len;
  }
  return null;
}
const SIZES = { 'iphone-6.9': [1290, 2796], 'ipad-13': [2048, 2732] };
let shots = 0;
for (const [loc, lang] of [['he', 'he'], ['en-US', 'en']]) {
  const dir = path.join(APP, 'store', 'app-store', 'screenshots', lang);
  for (const [dev, [w, h]] of Object.entries(SIZES)) {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(dev + '-') && f.endsWith('.jpg')).sort();
    if (files.length < 3 || files.length > 10) fail(`${lang}/${dev}: ${files.length} screenshots (the App Store takes 3-10)`);
    for (const f of files) {
      const s = jpegSize(fs.readFileSync(path.join(dir, f)));
      if (!s || s.w !== w || s.h !== h) fail(`${lang}/${f} is ${s ? `${s.w}x${s.h}` : 'not a JPEG'}, not ${w}x${h}`);
      const to = path.join(OUT, 'screenshots', loc, f);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(dir, f), to);
      shots++;
    }
  }
}
console.log(`appstore-metadata: ${Object.keys(LOCALES).join(' + ')} -- names "${field(LOCALES.he, 'App name')}" / "${field(LOCALES['en-US'], 'App name')}", ${shots} screenshots → ${path.relative(APP, OUT)}/`);
