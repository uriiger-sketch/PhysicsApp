# Checklist and commands

## Recon (run from the repo root)

```sh
F=physics_game_v28.html
# sinks, and where storage, the URL and the network appear
grep -nE 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|window\.open|location\.(href|hash|replace)' $F | wc -l
grep -nE '_ls\.(get|set|del)|localStorage|sessionStorage|indexedDB' $F
grep -nE 'fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|postMessage' $F
grep -oE 'https?://[A-Za-z0-9.-]+[^"'"'"' )<>`\\]*' $F index.html | sort | uniq -c
# no code from text
grep -nE '\beval\(|new Function|set(Timeout|Interval)\(\s*["'"'"'`]|document\.domain' $F
# inline handlers built in strings: every argument must be a constant, an id or a number
grep -oE 'on[a-z]+="[^"]*\$\{[^}]*\}[^"]*"' $F | sort | uniq -c | sort -rn | head -40
```

## Area checklists

### Injection
- [ ] Every `${…}` inside HTML is authored content, a number, a built-in id,
      or `_escHtml(…)`.
- [ ] No stored or typed text goes through `_ltSafe`.
- [ ] Inline handler arguments are never stored or typed text.
- [ ] `_applyHash` still applies its regex and the catalogue lookup.
- [ ] KaTeX is never given `trust:true` or user TeX.

### Storage and privacy
- [ ] Every new save field is in `_cleanSave`, with its type and bound.
- [ ] The honest-save round trip in the test still passes.
- [ ] Every new storage key is in `PRIVACY.md` and, if it records the
      learner, is cleared by "reset".
- [ ] No new third-party request. If one is unavoidable: SRI, CSP,
      `PRIVACY.md`.
- [ ] Sensors: only after a gesture; nothing stored or sent.

### Platform
- [ ] The CSP is the first element of `<head>` in every page.
- [ ] Zero violations on a full walk.
- [ ] `no-referrer` is set.
- [ ] Every `target=_blank` link has `rel="noopener noreferrer"` (there are
      none today).

### Supply chain and CI
- [ ] Every action is pinned to a full SHA.
- [ ] `permissions: contents: read` and `persist-credentials: false`.
- [ ] No `pull_request_target`.
- [ ] `npm ci --ignore-scripts`; the lockfile is committed.
- [ ] The acorn sha256 and the KaTeX SRI hashes are verified in CI.
- [ ] `node tools/i18n.js check en` reports 0 errors.
- [ ] The committed edition equals a fresh build.

## Test lanes (the full suite, about 30 to 45 minutes on 4 cores)

Run the lanes in parallel, each test with a timeout. Then compare every
failure against `git stash` / `HEAD` before calling it a regression.

```
A: check_flow · check_numbers · check_examples · check_sensors · check_sensor_physics · check_sensor_noise · check_simkit
B: check_mech1 · check_mech2 · check_optics · check_quizstate · smoke · check_answers · check_bidi · check_dir · check_kit_bidi
C: check_electro · check_mag · check_dc · check_sims · check_anims · check_ltr_islands · check_readable · check_frame · mech_learning
D (edition): check_i18n en · check_i18n_badges · check_i18n_labels · check_i18n_progress · APP_FILE=physics_game_en.html smoke · check_security (both editions)
```

`KATEX=local KATEX_DIR=node_modules/katex/dist node tests/smoke.js` runs the
page with KaTeX loaded under its SRI. It needs `npm ci` first.
