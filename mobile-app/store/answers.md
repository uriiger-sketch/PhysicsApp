# Store questionnaires: the answers

What to answer in Play Console's *App content* and in App Store Connect, for
this app as built here. Every answer follows from how the app works:

- it is a course bundled inside the app;
- it makes no network connection, and its pages forbid one (CSP `connect-src
  'none'`; nothing remote is loaded);
- it has no account, no ads, no analytics and no third-party SDK;
- progress stays on the device;
- the motion sensor is read only on the learner's tap, and only into memory.

If any of that changes, so do these answers.

## Google Play Console → App content

| Section | Answer |
|---|---|
| Privacy policy | `https://uriiger-sketch.github.io/PhysicsApp/mobile-app/store/privacy-policy.html` |
| App access | **All functionality is available without special access** (no login) |
| Ads | **No**, the app does not contain ads |
| Content rating | Category **Reference, News, or Educational**. **No** to every question: violence, fear, sexuality, language, controlled substances, gambling or simulated gambling, users interacting or sharing content, sharing the user's location, digital purchases. Expected ratings: Everyone · PEGI 3 · USK 0 |
| Target audience | Age groups **13–15, 16–17, 18 and over** (a Bagrut course). “Could your store listing unintentionally appeal to children?” **No**. (Choosing *under 13* brings in the Families policy; leave it out unless you mean to target children.) |
| News app | **No** |
| Data safety | “Does your app collect or share any of the required user data types?” **No**. Nothing is collected and nothing is shared, so the rest of the form falls away. |
| Advertising ID | **No**: the app does not use it (it declares no `AD_ID` permission) |
| Government app | **No** |
| Financial features | **My app doesn't provide any financial features** |
| Health | **My app does not have any health features** |

**Store settings:**
- category **Education**;
- tags, up to five, e.g. *Education, Physics, Science, Exam prep*;
- contact email: yours. It is shown on the listing.

**Two things reviewers sometimes ask about:**
- **The `INTERNET` permission.** It is Capacitor's standard web-view setup. The
  pages load nothing remote and their CSP forbids any connection.
- **Android backup.** If the user has device backup on, Android may include the
  app's local storage in the user's own Google-account backup. That is the
  system's backup, not data the developer receives, so it is not "collected"
  for Data safety.

## App Store Connect

| Item | Answer |
|---|---|
| App Privacy | **Data Not Collected** (“Do you or your third-party partners collect data from this app?” → No) |
| Age rating | **None / No** to every content and capability question: no unrestricted web access, no user-generated content, no messaging, no ads, no gambling or contests, no in-app purchases, not made for kids specifically. Result: **4+** |
| Category | Primary **Education**; secondary, optional, **Reference** |
| Content rights | **No**, it does not contain, show or access third-party content. The open-source code and fonts it includes are licensed for this: `www/licenses/NOTICE.txt` |
| Export compliance | Answered by the build: `ITSAppUsesNonExemptEncryption = NO` in Info.plist (the app uses no encryption of its own), so App Store Connect asks nothing |
| Sign-in required | **No** |
| Pricing | Free, all countries (your choice) |
| Accessibility labels (optional) | Declare only what you have checked on a device. **Dark Interface** is true: the app opens in a dark theme and has a light one |

### App Review notes (paste into *App Review Information → Notes*)

```text
Physfun is a complete, offline physics course for high-school students: 107 topics in five subjects (mechanics, optics, electrostatics, DC circuits, magnetism), in Hebrew and English. Everything is bundled in the app; it makes no network requests and needs no account.

How to try it:
- The app opens in Hebrew in Israel and in English elsewhere, and after that always in the language of the last session; the 🌐 button at the top switches between Hebrew and English (progress is kept).
- The topic list is at the side of the screen (on iPhone, behind ☰). Every topic has four tabs: Theory, Simulation (interactive: drag the objects on the diagram), Quiz, and Problem (a guided, multi-step problem that unlocks once the quiz is done).
- 📐 opens the formula sheet.

Device feature: 14 mechanics topics include a sensor lab that reads the accelerometer after the user taps "▶ Start sensor" (for example Mechanics → Chapter 10: Harmonic motion → Simple pendulum → Simulation). Readings are drawn on screen and never stored or sent.
```

The same notes in Hebrew, if you prefer them (reviewers read English):

```text
״פיזיכיף״ הוא קורס פיזיקה מלא לתיכון שפועל בלי אינטרנט: 107 סעיפים בחמישה נושאים, בעברית ובאנגלית. הכול נמצא בתוך האפליקציה; היא אינה פונה לרשת ואין בה חשבון.
```
