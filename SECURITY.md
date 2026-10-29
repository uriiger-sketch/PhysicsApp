# Security

## Reporting a vulnerability

Please report it **privately**: Security → *Report a vulnerability* on
this repository. Do not open a public issue. You will get an
acknowledgement within 7 days. A fix for anything that lets script run, or
that lets a learner's data leave their device, is a priority.

**In scope:**
- the pages: `index.html`, `physics_game_v28.html` and every generated
  edition;
- the build (`tools/i18n.js`);
- the tests;
- the GitHub workflows.

**Third-party code:**
- KaTeX: loaded from jsDelivr at an exact version under Subresource
  Integrity;
- acorn: vendored, byte-identical to its npm release;
- Heebo and Rubik: embedded fonts, see `fonts/README.md`.

## How the app is secured

The app is static and runs entirely in the browser. It has no backend, no
accounts and no analytics, and it makes no network calls of its own. In
summary:
- **Content-Security-Policy:**
  - nothing loads except KaTeX's versioned path and what the page carries;
  - nothing is sent (`connect-src 'none'`);
  - no plugins, base URL or form targets.
- **Saved progress is untrusted input.** It is rebuilt field by field, with
  exact types and bounds, before anything reads it. Stored or typed text
  reaches HTML only escaped.
- **No requests to Google.** No page address is sent to any site
  (`no-referrer`).
- **The build:** a translation cannot add markup or code to a generated
  edition.
- **CI:**
  - a read-only token;
  - actions pinned to commit SHAs;
  - tools installed from a lockfile with install scripts off;
  - vendored code and SRI hashes verified;
  - a secret scan of the tree.

Every one of these is an invariant checked by `tests/check_security.js`
(on both editions) and by CI. The repeatable review procedure is the
`security-sweep` skill in `.claude/skills/security-sweep/`.

## Owner checklist (settings outside the code)

- [ ] **Credentials and endpoints ever committed are public forever**, in the
      git history, in forks and in the copies Pages served.
      - Undeploy or rotate any such Apps Script deployment.
      - Restrict and clean any spreadsheet it wrote to.
      - Change any password that appeared, wherever it is reused.
      - Rewriting history is optional and cannot replace rotation.
- [ ] Settings → Actions → General:
      - workflow permissions **Read**;
      - "Allow GitHub Actions to create and approve pull requests" **off**;
      - require approval for outside contributors;
      - allow only GitHub-owned and selected actions.
- [ ] A branch ruleset on `main`: require a PR and the CI checks, and block
      force-pushes and deletion.
- [ ] Code security: private vulnerability reporting, Dependabot alerts and
      security updates, secret scanning with push protection.
- [ ] Pages: "Enforce HTTPS" on, source `main` / root.
- [ ] Account: "Keep my email addresses private".
- [ ] Consider a custom domain for the app. Its storage would then no
      longer be shared with the account's other Pages projects, and it
      could send real security headers (see the skill's threat model).
