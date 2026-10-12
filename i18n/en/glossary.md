# English glossary and style guide

The binding reference for everyone translating or reviewing the English
edition. When a Hebrew term is below, use its English term — everywhere, in
every subject, in text, quiz options, hints, canvas labels and buttons. If you
need a term that is not here, choose the standard term of English-language
high-school physics (OpenStax *College Physics* / *University Physics*,
Halliday–Resnick, AP and IB usage) and list it in your report so the glossary
can grow.

## Style

- **US English**: color, center, meter, analyze, fiber, behavior. SI units and
  symbols, decimal point, a space between number and unit (`9.8 m/s²`).
- **Register**: a clear, warm, rigorous high-school textbook (OpenStax tone).
  Short sentences. Address the student as *you*, in the imperative for
  instructions ("Drag the block…", "Compute…"). Hebrew plural imperatives
  (גררו, חשבו) are simply English imperatives.
- **Headings and titles**: sentence case ("Constant-velocity motion"), except
  proper names ("Newton's second law", "Snell's law").
- **Chapters**: "פרק א: קינמטיקה" → "Chapter 1: Kinematics" (Hebrew letters
  א ב ג ד … are numbers 1 2 3 4 …). Quiz option letters א ב ג ד → A B C D.
- **Quotation marks**: curly “…” and ‘…’ in text. Never put a straight `"`
  inside reading text (it can end an HTML attribute). Apostrophes: ’ or '.
- **Dashes**: em dash — for asides, en dash – for ranges (380–700 nm).
- **Numbers and formulas are not yours to change.** Formulas, numbers and
  values computed by the code are placeholders ⟦0⟧ ⟦1⟧ …; move them where
  English word order needs them, never drop or duplicate one. Numbers written
  in the text must stay the same numbers (the checker compares them).
- **HTML**: keep every tag and attribute exactly; translate only the reading
  text (and `title`/`aria-label`/`alt`/`placeholder` values).
- **Canvas labels and buttons** (the `sims-*` files, button labels in `ui`):
  English is ~30 % longer than Hebrew and the canvas does not grow. Stay within
  about the Hebrew length; abbreviate the way a textbook figure would
  ("vel.", "accel.") only when a full word cannot fit.
- **Hebrew-specific remarks** — a note about Hebrew wording, the maqaf, the
  plural address, two Hebrew synonyms — are adapted, not translated literally:
  "בבגרות אומרים גם מקדם השבירה" → "also called the index of refraction".
- **Bagrut** (the Israeli matriculation exam): where the text speaks of it,
  write "the Bagrut exam" (first mention in a unit: "the Bagrut (Israeli
  matriculation) exam"). The app's title becomes neutral (see `ui`).
- **Units written in Hebrew** (rare, e.g. in a problem's `unit` field): use the
  SI symbol (ק״מ → km, מ׳ → m, ש׳ → s).

## Terms

| Hebrew | English |
|---|---|
| קינמטיקה | kinematics |
| מיקום · ציר מקום · ראשית | position · position axis · origin |
| העתק | displacement |
| דרך (שעבר הגוף) | distance traveled (path length) |
| מהירות | velocity (vector); **speed** when only the magnitude is meant |
| גודל המהירות | speed |
| מהירות ממוצעת · רגעית | average velocity · instantaneous velocity |
| תאוצה | acceleration |
| תנועה שוות-מהירות · שוות-תאוצה | uniform motion (constant velocity) · uniformly accelerated motion |
| נפילה חופשית · תאוצת הנפילה החופשית | free fall · acceleration due to gravity (g) |
| וקטור · סקלר · רכיבים · גודל וכיוון | vector · scalar · components · magnitude and direction |
| כוח · כוח שקול | force · net force |
| כוח נורמלי | normal force |
| כוח הכובד · משקל · מסה | gravitational force · weight · mass |
| חיכוך סטטי · קינטי · מקדם חיכוך | static friction · kinetic friction · coefficient of friction |
| מתיחות | tension |
| כוח הקפיץ · קבוע הקפיץ · חוק הוק | spring force · spring constant · Hooke's law |
| התמדה · מערכת ייחוס אינרציאלית | inertia · inertial reference frame |
| החוק הראשון/השני/השלישי של ניוטון | Newton's first/second/third law |
| פעולה ותגובה | action and reaction (an action–reaction pair) |
| מישור משופע · מדרון | inclined plane · incline |
| מכונת אטווד | Atwood machine |
| תרשים כוחות | free-body diagram |
| מד-כוח | spring scale |
| מומנט כוח · זרוע המומנט | torque · lever arm |
| שיווי משקל · מרכז מסה · כוח משען | equilibrium · center of mass · support (reaction) force |
| צוג כוחות | couple |
| תנועה בליסטית · זריקה אופקית/משופעת | projectile motion · horizontal/angled launch |
| טווח · גובה מרבי · זמן מעוף | range · maximum height · time of flight |
| תנועה מעגלית · תאוצה צנטריפטלית · כוח צנטריפטלי | circular motion · centripetal acceleration · centripetal force |
| מהירות זוויתית · זמן מחזור · תדירות | angular velocity · period · frequency |
| תנע · מתקף · שימור תנע | momentum · impulse · conservation of momentum |
| התנגשות אלסטית · פלסטית | elastic collision · perfectly inelastic collision |
| מקדם התקומה | coefficient of restitution |
| עבודה · הספק · אנרגיה קינטית · פוטנציאלית | work · power · kinetic energy · potential energy |
| אנרגיה פוטנציאלית כובדית · אלסטית | gravitational · elastic potential energy |
| משפט עבודה-אנרגיה · כוח משמר | work–energy theorem · conservative force |
| תנועה הרמונית פשוטה · משרעת (אמפליטודה) | simple harmonic motion · amplitude |
| מטוטלת פשוטה · ריסון | simple pendulum · damping |
| אורך גל · ספקטרום · גל אלקטרומגנטי | wavelength · spectrum · electromagnetic wave |
| מדד שבירה (מקדם השבירה) | refractive index (index of refraction) |
| החזרה · שבירה · הניצב | reflection · refraction · the normal |
| זווית פגיעה · החזרה · שבירה | angle of incidence · reflection · refraction |
| מראה מישורית · קעורה · קמורה | plane · concave · convex mirror |
| מוקד · מרחק מוקד · מרכז העקמומיות | focal point · focal length · center of curvature |
| תמונה ממשית · מדומה · ישרה · הפוכה | real · virtual · upright · inverted image |
| הגדלה | magnification |
| חוק סנל | Snell's law |
| החזרה פנימית מלאה (גמורה) · זווית קריטית (זווית הגבול) | total internal reflection · critical angle |
| סיב אופטי · מפתח נומרי | optical fiber · numerical aperture |
| פריזמה · נפיצה (פיזור) | prism · dispersion |
| עדשה מרכזת · מפזרת · עוצמה (דיופטר) | converging · diverging lens · optical power (diopter) |
| קרנית · רשתית · אישון · הסתגלות | cornea · retina · pupil · accommodation |
| קוצר ראייה · רוחק ראייה · נקודה קרובה | nearsightedness (myopia) · farsightedness (hyperopia) · near point |
| עינית · עדשת אובייקטיב | eyepiece · objective |
| התאבכות בונה · הורסת | constructive · destructive interference |
| עקיפה · סדק יחיד · סדקים כפולים · סריג עקיפה | diffraction · single slit · double slit · diffraction grating |
| קרום דק · הפרש דרכים · מופע (פאזה) | thin film · path difference · phase |
| קיטוב · מקטב · מנתח · חוק מאלוס | polarization · polarizer · analyzer · Malus's law |
| אפקט דופלר · הסחה לאדום · לכחול | Doppler effect · redshift · blueshift |
| פליטה מאולצת (מעוררת) · היפוך אוכלוסין | stimulated emission · population inversion |
| פוטון · אפקט פוטואלקטרי · קרינה מייננת | photon · photoelectric effect · ionizing radiation |
| מטען חשמלי · חוק קולון · קולון | electric charge · Coulomb's law · coulomb |
| שדה חשמלי · קווי שדה | electric field · field lines |
| פוטנציאל חשמלי · הפרש פוטנציאלים · מתח | electric potential · potential difference · voltage |
| אנרגיה פוטנציאלית חשמלית · משטח שווה-פוטנציאל | electric potential energy · equipotential surface |
| מוליך · מבודד · הארקה | conductor · insulator · grounding |
| טעינה במגע · בהשראה · אלקטרוסקופ | charging by contact · by induction · electroscope |
| כלוב פאראדיי · חוק גאוס · צפיפות מטען משטחית | Faraday cage · Gauss's law · surface charge density |
| קבל · קיבול · חומר דיאלקטרי | capacitor · capacitance · dielectric |
| ניסוי מיליקן · מהירות סופית · חוק סטוקס | Millikan oil-drop experiment · terminal velocity · Stokes' law |
| זרם חשמלי · התנגדות · נגד · חוק אוהם | electric current · resistance · resistor · Ohm's law |
| התנגדות סגולית | resistivity |
| כא״מ · התנגדות פנימית · מתח הדקים | emf · internal resistance · terminal voltage |
| חיבור בטור · במקביל · התנגדות שקולה | series · parallel connection · equivalent resistance |
| חוקי קירכהוף · חוק הצמתים · חוק הלולאות | Kirchhoff's laws · junction rule · loop rule |
| אמפרמטר · וולטמטר · גלוונומטר · גשר ויטסטון | ammeter · voltmeter · galvanometer · Wheatstone bridge |
| מפסק · מעגל פתוח · סגור · קצר | switch · open · closed · short circuit |
| טעינה ופריקה של קבל · קבוע זמן | charging and discharging a capacitor · time constant |
| נורת להט · קילוואט-שעה | incandescent bulb · kilowatt-hour (kWh) |
| שדה מגנטי · קוטב צפוני · דרומי · מצפן | magnetic field · north pole · south pole · compass |
| תיל נושא זרם · כריכה · סליל · סולנואיד | current-carrying wire · loop · coil · solenoid |
| כלל יד ימין | right-hand rule |
| כוח לורנץ · ספקטרומטר מסות · בורר מהירויות · ציקלוטרון | Lorentz force · mass spectrometer · velocity selector · cyclotron |
| מנוע חשמלי · מחליף כיוון (קומוטטור) · טבעות החלקה | electric motor · commutator · slip rings |
| שטף מגנטי · חוק פאראדיי · חוק לנץ | magnetic flux · Faraday's law · Lenz's law |
| כא״מ מושרה · זרם מושרה · זרמי מערבולת · כא״מ תנועתי | induced emf · induced current · eddy currents · motional emf |
| גנרטור · זרם חילופין · שנאי · ליפוף ראשוני · משני | generator · alternating current (AC) · transformer · primary · secondary coil |

## Interface

| Hebrew | English |
|---|---|
| תיאוריה · סימולציה · חידון · בעיה | Theory · Simulation · Quiz · Problem |
| דוגמה פתורה · נתון · שלב · הלקח | Worked example · Given · Step · Takeaway |
| העשרה · קראו עוד | Going further · Read more |
| טעות נפוצה | Common misconception |
| רמז · רמז נוסף · פתרון מודרך | Hint · Another hint · Worked solution |
| בדקו · הבא · סיימתי · התחילו מחדש | Check · Next · Done · Start over |
| ↺ איפוס | ↺ Reset |
| ⏸ עצרו · ▶ הפעילו · המשיכו | ⏸ Pause (Stop) · ▶ Start · Continue |
| גררו על התרשים · הקישו על התרשים | Drag on the diagram · Tap the diagram |
| ניסיון | attempt |
| דף נוסחאות · יומן גרסאות · מה חדש | Formula sheet · Changelog · What's new |
| נושאים · פרק · סעיף | Topics · Chapter · Section |
| עיצוב כהה · בהיר | Dark theme · Light theme |
| טעות נפוצה / הסבר / תשובה נכונה | Common misconception / Explanation / Correct answer |
