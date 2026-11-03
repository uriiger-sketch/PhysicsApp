# Working on this repository

The app is **Physfun · פיזיכיף**: a physics course for the Bagrut, one page per
language (`physics_game_v28.html` is the Hebrew master, `physics_game_en.html`
is generated from it), the landing page `index.html`, and the store apps in
`mobile-app/`.

## The rule: every change in Hebrew and English, on the site and in the apps

Every change to the app is made in both languages and in both places:

1. **The master** (`physics_game_v28.html`): code, physics and Hebrew text.
   Bump `APP_VERSION` and add a changelog entry (`tests/check_version.js`).
2. **English:**
   1. `node tools/i18n.js extract en`.
   2. Translate the new units in `i18n/en/*.json`, following
      `i18n/en/glossary.md`.
   3. `node tools/i18n.js check en`.
   4. `node tools/i18n.js build en`.

   Never edit `physics_game_en.html` by hand (`i18n/README.md`).
3. **The landing page** (`index.html`), when its text or behaviour is touched.
   Recompute its CSP hashes (`tests/check_security.js` checks them). The app
   uses this same page as its start page.
4. **The store apps:**
   - `cd mobile-app && npm run build`;
   - and, when what the stores show changes, `mobile-app/store/` in both
     languages: `listing.md`, `answers.md`, `privacy-policy.html`, and the
     graphics (`npm run art`, `npm run screenshots`).

   See `mobile-app/README.md`.

Before pushing, run the checks of `.github/workflows/ci.yml` (fast tier, the
security invariants on both editions, the i18n guards and `check_i18n en`) and,
for the app, `cd mobile-app && npm run check`.
