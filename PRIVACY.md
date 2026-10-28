# Privacy

The app keeps nothing about learners on any server: there is no account, no
sign-in, no analytics, and the page sends no data anywhere.

## What stays on the device

The browser's `localStorage` for the site holds the following. It never
leaves the device.

| Key | What it holds |
|---|---|
| `phys_game_state_v2` | The place in the course, XP, completed and visited sections, quiz answers and hints, problem steps with the answers typed, sim missions, theme |
| `phys_lang` | The language chosen in the 🌐 menu |
| `phys_onboarded` | That the welcome tour was seen |
| `simtip_<chapter>.<section>` | That a simulation's tip was shown |

**To erase it:**
- **↺ Reset progress** (״איפוס ההתקדמות״), at the foot of the topics list,
  erases progress, typed answers and the tip record.
- Clearing the site's data in the browser erases everything.

On a shared computer, use reset before leaving, or use a private window.

## Who sees a visit

- **GitHub Pages** (the host) receives each visitor's IP address and user
  agent, as every web host does.
- **jsDelivr** serves the formula renderer, KaTeX. It receives the IP
  address and user agent.
  - No page address is sent (`no-referrer`).
  - The files are checked against fixed hashes.
  - If jsDelivr is blocked, the app uses its own built-in formula renderer.
- **Nobody else.** The fonts are inside the page, so nothing is requested
  from Google.

## Device sensors

The sensor lab reads the phone's motion sensor only after the learner presses
its start button (iOS asks for permission at that moment). Samples are drawn
on the screen and kept only in memory. They are never stored or sent.
