---
name: security-sweep
description: Full security and privacy sweep of the PhysicsApp pages, build and CI, run by a team of specialist reviewers. Use when asked for a security audit, review, hardening or "is this safe", before a release, and after any change that touches saved state or localStorage, HTML built from strings (innerHTML, template literals, inline handlers), the URL/hash, external resources (CDN, fonts), the loader in <head>, the CSP, tools/i18n.js or translations, tests/ or .github/.
---

# Security sweep

A repeatable sweep that keeps the app resilient to code injection, data
mining and supply-chain tampering **without losing a feature**. It is run
as a team: four specialists audit in parallel, you verify and fix, and every
class of finding becomes an invariant in `tests/check_security.js` so it
cannot come back.

## 1. What is being protected, from whom

Read `references/threat-model.md` once per session. In short:

- **Assets:** learners' privacy (the users are school students, many of them
  minors): their progress, typed answers and the fact that they use the app;
  the integrity of the page they learn from; the owner's accounts.
- **There is no backend.** Everything lives in the browser. The page is static
  on GitHub Pages at `uriiger-sketch.github.io`, an origin **shared by every
  Pages project of the account**, so `localStorage` is attacker-writable
  input, never trusted state.
- **Attackers:** a sibling page or an XSS anywhere on the shared origin; a
  person with DevTools on a shared school computer; a crafted link
  (`#/chapter/section/tab`); a compromised CDN; a careless or hostile
  translation or config in a PR; a compromised GitHub Action; anyone reading
  the public repository and its full history (credentials, endpoints).

## 2. Invariants (all enforced by `tests/check_security.js` and CI)

1. No credential, key, private endpoint or spreadsheet ID in any page or in the
   tree (`SECRET` regex in the test, the same in `.github/workflows/ci.yml`).
2. The page sends nothing anywhere: no `fetch`/XHR/beacon/socket, and CSP
   `connect-src 'none'`. The only other site is KaTeX's exact versioned path
   on jsDelivr, every file under SRI + `crossorigin=anonymous`.
3. A `<meta>` CSP is the first thing in `<head>` of every page:
   `default-src 'none'`, `object-src 'none'`, `base-uri 'none'`,
   `form-action 'none'`, no `'unsafe-eval'`, no wildcard or whole scheme.
   The page triggers **zero** CSP violations on a full walk.
4. `<meta name="referrer" content="no-referrer">` on every page; no Google
   Fonts (the fonts are embedded, see `fonts/README.md`).
5. The save (`phys_game_state_v2`) goes through `_cleanSave` before anything
   reads it: own keys only, never `__proto__`/`constructor`/`prototype`,
   exact types, bounded sizes; a bad field is dropped, never the whole save.
   A full honest save round-trips unchanged.
6. Text that is not authored content (anything from storage, the URL or the
   keyboard) reaches HTML only through `_escHtml`. `_ltSafe` is formatting
   for authored text, **not** a sanitiser.
7. Lookups by a stored or URL-supplied name use
   `Object.prototype.hasOwnProperty.call` (never `obj[name]` truthiness).
8. No `eval`, `new Function`, string timers, `document.domain`, `message`
   listeners or `javascript:` URLs in the app script.
9. "Reset all progress" leaves no record of the learner (`simtip_*` too).
10. A translation cannot add markup, handlers, URLs, quotes or bidi controls;
    a language config can change words only (`tools/i18n.js` guards; the
    build re-counts `<script>`/`<style>`/`<!--` and re-parses the code).
11. CI: `permissions: contents: read`, `persist-credentials: false`, every
    action pinned to a full SHA, `npm ci --ignore-scripts` from the lockfile,
    vendored `acorn.js` and KaTeX SRI hashes verified byte for byte.

## 3. Procedure

### Step 1: scope

```sh
git fetch origin main && git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- physics_game_v28.html | grep -nE 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|on[a-z]+="|_ls\.(get|set)|localStorage|location|window\.open|fetch|XMLHttpRequest|sendBeacon|https?://'
```

A first sweep, or one asked for "the whole app", covers everything. A sweep
before a release can focus on the diff, but always runs Step 2 in full.

### Step 2: the automated gate (fast, always)

```sh
node tests/check_security.js
APP_FILE=physics_game_en.html node tests/check_security.js
node tools/i18n.js check en              # 0 errors
git grep -nIE 'AKfyc|script\.google|openById|BEGIN [A-Z ]*PRIVATE KEY|ghp_|github_pat_|AIza' -- . ':(exclude)tests/check_security.js' ':(exclude).github/workflows/ci.yml' ':(exclude).claude/'
```

A failure here is a finding. Fix it before you do anything else.

### Step 3: assemble the team

Spawn the four specialists **in one message** with the Agent tool
(`subagent_type: general-purpose`, background). Use the briefs in
`references/team.md` exactly: each one names its scope, the files and line
regions, what was already ruled out, and the report format.

| Specialist | Scope |
|---|---|
| **DOM XSS & injection** | every HTML/JS sink; taint from storage, URL, keyboard, translations; dynamic PoCs |
| **Privacy & storage** | data inventory, every request and who receives it, save schema, sensors, the shared origin, minors |
| **CSP & browser platform** | CSP and referrer validated empirically (zero violations, same test results), noopener, framing, header plan |
| **Supply chain & CI** | secrets in tree and history, CI hardening, `tools/i18n.js` injection, SRI and vendored code verified, hygiene |

Every brief requires: audit only (no repo edits), scratch work in the
session's scratchpad, a finding is real only with a traced path (and a
dynamic PoC where practical), severity, `file:line`, and a fix that keeps
the feature. For a large change, add a fifth **adversarial verifier** who
gets the code and the claimed fixes, but not your conclusions.

### Step 4: triage (you, not the team)

- Re-read the cited lines and reproduce each finding before you accept it.
  Two specialists reporting the same path independently is strong evidence.
  A finding with no reachable path is "Info", not a fix.
- Rate it with the rubric in §4 and merge duplicates.
- Decide what only the owner can do (rotation, account settings, headers)
  and keep that list separate.

### Step 5: fix with the house patterns

| Problem | Pattern |
|---|---|
| Stored or typed text into HTML | `_escHtml(x)` at the sink; never `_ltSafe` for such text |
| A new field in the save | add it to `_cleanSave` with its exact type and bounds, then to the honest-save round trip in the test |
| Lookup by a name from storage or the URL | `Object.prototype.hasOwnProperty.call(map, name)` |
| `regex.test(x)` on a stored value | `typeof x==='string'&&re.test(x)`: an object with a broken `toString` throws and loses the whole save |
| A new external resource | prefer embedding it. If not: exact versioned path, SRI, `crossorigin`, add it to the CSP and to `staticChecks` in the test, and update `PRIVACY.md` |
| A new inline handler argument | only a built-in id, a number or a constant; never stored or typed text |
| A new storage key | add it to `PRIVACY.md`, to "reset" if it records the learner, and to the poisoned-save fuzz |
| Dead code with credentials or endpoints | delete it; the owner rotates; never "comment it out" |

Keep every fix minimal and in the style of the surrounding code (comments
say *why*). The master is `physics_game_v28.html`; never edit a generated
edition by hand.

### Step 6: make it an invariant

Add a check to `tests/check_security.js` for every new class of finding,
static (on the file text) or dynamic (a poisoned save, a hostile address, a
recorded request, a CSP violation). Run it on both editions.

### Step 7: release (the repository's own rules)

1. Bump `APP_VERSION` (MAJOR.MINOR) and add a Hebrew entry at the top of
   `APP_CHANGELOG` (`tests/check_version.js`).
2. `node tools/i18n.js extract en`, translate the new units in
   `i18n/en/*.json`, then `node tools/i18n.js check en` and
   `node tools/i18n.js build en`.
3. Run the full suite on the master, plus the edition tests (see
   `references/checklist.md` §Test lanes). Compare any failure with `HEAD`
   before you call it a regression.
4. Commit the master, the translations and the rebuilt edition together.

### Step 8: report

```
## Security sweep: <scope>, <date>
Verdict: <ship / ship after fixes / do not ship>
| ID | Severity | Area | file:line | Finding | Status (fixed in <sha> / owner action / accepted) |
Fixed: …   Invariants added: …   Tests: <suite results, both editions>
Owner-only actions: …   Accepted risks (with reason): …
```

## 4. Severity rubric (for this app)

- **Critical:** script runs from a link or from data another person controls,
  with no precondition; or learners' data leaves the device.
- **High:** a credential or write endpoint exposed; script runs from data
  planted by a sibling page on the shared origin; CI can be made to run
  attacker code with a write token.
- **Medium:** stored XSS that needs a planted save; permanent denial of
  service (blank app); a privacy disclosure to a third party (IP addresses)
  without need; a translation or config able to inject code.
- **Low:** defence-in-depth gaps (no CSP, no referrer policy), unbounded
  storage, unpinned CI tags, a known CVE in a dependency on a path the app
  does not reach.
- **Info:** hygiene, documentation, dead code with no reachable path.

## 5. Accepted risks and their reasons (re-check each sweep)

- `script-src 'unsafe-inline'`: the app runs from an inline block injected by
  the loader, and its HTML uses inline handlers, so no hash or nonce can cover
  it. The defence is invariants 5–7. To lift it, move the handlers to
  delegated listeners and the app to an external file under a hash.
- KaTeX 0.16.9 has advisories (fixed by 0.16.10 to 0.18.2). They need `trust`
  or attacker-controlled TeX, and the app passes only authored TeX with the
  default `trust:false`. To upgrade: the loader URL and three SRI hashes, the
  CSP path, `tests/_katex.js`, `package.json`, rebuild, and visual checks in
  `KATEX=local` mode.
- jsDelivr sees visitors' IP addresses (for KaTeX). To remove it, embed
  KaTeX like the fonts.
- GitHub Pages sets no custom headers, so there is no `frame-ancestors`,
  HSTS preload or `report-to`. `references/threat-model.md` gives the header
  set for a host that has them.
- The origin is shared with the account's other Pages projects. A custom
  domain for this app removes that, but progress is per origin, so it needs a
  one-time migration.

## 6. Owner-only actions (outside the code)

See `SECURITY.md` §Owner checklist: undeploy or rotate any once-published
endpoint and credential (git history keeps them), Actions read-only default
token, branch ruleset on `main`, secret scanning with push protection,
private vulnerability reporting, Dependabot alerts, Pages "Enforce HTTPS",
"Keep my email addresses private".
