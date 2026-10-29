// Which Chromium a test drives: $CHROMIUM when set, else the pre-installed
// /opt/pw-browsers/chromium when it exists (the local setup), else
// Playwright's own browser (`npx playwright install chromium`, as in CI).
const fs = require('fs');
const LOCAL = '/opt/pw-browsers/chromium';
module.exports = process.env.CHROMIUM || (fs.existsSync(LOCAL) ? LOCAL : undefined);
