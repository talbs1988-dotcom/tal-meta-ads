---
name: ad-creative
description: When the user needs the IMAGE for a Facebook or Instagram ad — generating ad visuals, creating creatives, making variations to test, putting their own face into an ad, or adding Hebrew text over an image. Also use when the user says "תייצר קריאייטיב", "תמונה למודעה", "פרסומת עם התמונה שלי", "צריך ויזואל לקמפיין", "וריאציות למודעה", "creative for the ad", "ad image". For the ad text itself, see ad-copywriter. For creating the campaign in Meta, see meta-campaign-builder.
---

# קריאייטיב למודעות ממומנות

הקופי משכנע. **התמונה היא מה שגורם לאנשים לעצור כדי לקרוא אותו.**

## ⛔ ארבעה כללי ברזל — לא לשנות, לא לשאול

### 1. המודל: `gpt-image-2` דרך ה-API של OpenAI

לא DALL·E, לא Midjourney, לא כלי אחר. הקריאה היא ל-`api.openai.com`.

### 2. איכות: `low` — ועלות 0.006$ ליצירה

```js
QUALITY = "low"; // 0.006$ · כלל ברזל · אין לשנות
```

**ההבדל בין `low` ל-`high` לא נראה בפיד של מטא** — התמונה מוצגת קטנה. `high` עולה פי כמה על אותה תוצאה בפועל.

**לא לשאול את המשתמש על איכות.** זה נעול. אם מישהו מבקש `high` — להסביר שבפיד זה לא נראה, ולהמשיך ב-`low`.

**מה שאומרים למשתמש:** _"תמונה עולה 0.006 דולר. תעשו עשרים — זה פחות משקל. אין סיבה להתאהב בראשונה."_

### 3. גודל: `1024x1024`

ריבוע = פורמט הפיד הסטנדרטי במטא. אנכי `1024x1536` רק אם ביקשו במפורש סטורי או ריל.

### 4. `no text` בכל פרומפט — בלי יוצא מן הכלל

מודלי תמונה כותבים עברית שבורה: אותיות הפוכות, מילים קטועות, ג׳יבריש שנראה כמו עברית. **התמונה נוצרת נקייה, והטקסט מולבש אחריה ב-HTML.**

הסקריפט מזהיר אוטומטית אם `no text` חסר בפרומפט. לא להתעלם מהאזהרה.

---

## ⛔ שש הנחיות עיצוביות — חובה בכל קריאייטיב

אלה לא המלצות. **כל פרומפט חייב לייצר את כל השש**, אחרת התוצאה נראית כמו תמונת AI ולא כמו פרסומת.

| #     | הכלל                                                                                          | איך זה נכנס לפרומפט                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **הירו ויזואלי — צילום או תלת-ממד, לא איור.** תופס **40–55%** מהקנבס, עם תאורה וצללים אמיתיים | `hyper-realistic 3D render / professional photograph, occupying 45% of canvas, realistic studio lighting with true cast shadows` · ⛔ **לעולם לא** `illustration`, `flat design`, `cartoon`, `vector` |
| **2** | **רקע עם עומק** — כהה ועשיר, מעבר צבע או טקסטורה. **לא צבע שטוח**                             | `deep gradient background with subtle texture, rich and dark` · ⛔ לא `solid background`                                                                                                              |
| **3** | **טיפוגרפיה עברית כבדה** — כותרת במשקל שמן, עברית תקנית, היררכיה ברורה                        | **לא בפרומפט!** נכנס בשלב ה-overlay: Rubik 800 לכותרת, 600 ל-CTA                                                                                                                                      |
| **4** | **תגית מחיר או הצעה** — מדבקה מעוצבת בניגוד גבוה, לא מספר חופשי                               | `reserve a clean empty badge area in the upper corner for a price sticker` + המדבקה נבנית ב-overlay                                                                                                   |
| **5** | **כפתור CTA מעוגל** בתחתית, צבע מודגש, **חץ בסוף** · ולוגו בפינה                              | `leave the bottom 20% visually clear for a button` + הכפתור והלוגו ב-overlay                                                                                                                          |
| **6** | **פלטה של 2–3 צבעים בלבד** — רקע דומיננטי, מודגש אחד, נייטרלי                                 | `strict palette: <רקע>, <מודגש>, <נייטרלי>. no other colors`                                                                                                                                          |

**הכלל שמאחורי הכל:** 1, 2 ו-6 נוצרים במודל. 3, 4 ו-5 נבנים ב-overlay — כי טקסט, מדבקה וכפתור חייבים להיות חדים ומדויקים, וזה מה ש-AI הכי גרוע בו.

---

## 👤 מסלול הדמות — פרסומת עם הפנים של המשתמש

**חוק:** ⛔ **לעולם לא לבקש מהמודל לצייר את הפנים של המשתמש.** גם עם תמונת reference, AI מייצר דמיון — לא זהות. זה תמיד ייראה "כמעט", וזה גרוע מכלום בפרסומת אישית.

**השיטה שעובדת — שלושה שלבים:**

```
1. המודל מייצר את העיצוב עם אזור שמור ריק לדמות
2. הצילום האמיתי מודבק לתוך האזור  (composite-photo.py)
3. הטקסט, המדבקה והכפתור מולבשים   (overlay.html)
```

**הפנים לא עוברות דרך המודל אף פעם.** הן נשארות בדיוק מהצילום.

**מה מוסיפים לפרומפט:**

```
Reserve a clean circular area on the right side, approximately 380px
diameter, centered at x=700 y=520, as flat empty space with a subtle
glowing ring around it. Nothing inside the circle. No person, no face.
```

**ואז:**

```bash
python3 scripts/composite-photo.py circle design.png photo.jpg out.png 700 520 190 8
#                                   מצב    עיצוב      צילום    פלט    cx  cy   r  טבעת
```

יש גם מצב `rect` למלבן:

```bash
python3 scripts/composite-photo.py rect design.png photo.jpg out.png <x> <y> <w> <h> [רדיוס פינה]
```

**לשאול את המשתמש איפה תמונות התדמית שלו**, ולהעדיף צילום עם רקע נקי או מוסר. אם אין לו — לומר שזה השלב היחיד שדורש צילום אמיתי, ובלעדיו עדיף לוותר על הדמות מאשר לתת ל-AI לנחש פנים.

---

## הרצף

### שלב 1 — לשאול (הכל בהודעה אחת)

1. **מה מפרסמים?**
2. **איזה רגש?** (הקלה · דחיפות · סקרנות · אמון)
3. **שני-שלושה צבעי מותג?**
4. **דמות בפנים?** אם כן — איפה הצילום
5. **מחיר או הצעה למדבקה?**

### שלב 2 — לבנות פרומפט

תבנית מוכנה שמכילה את כל שש ההנחיות:

```
Square 1024x1024 premium advertisement.

HERO (45% of canvas, centered-left): hyper-realistic 3D render of
<האובייקט>, realistic studio lighting, true cast shadows, soft
reflections. Photographic quality — NOT an illustration.

BACKGROUND: deep <צבע> gradient with subtle texture and depth.
Not a flat color.

RESERVED SPACE: keep the bottom 20% visually calm for a button.
Keep the upper-right corner clear for a badge.
<אם יש דמות: + פסקת המעגל השמור>

PALETTE: strictly three colors — <רקע>, <מודגש>, <נייטרלי>.
No other colors.

NEGATIVE: no text, no letters, no words, no numbers, no logos,
no watermarks, no people, no illustration, no flat design.
```

### שלב 3 — לייצר 4–6 בבת אחת

```bash
node scripts/generate-images.mjs prompts.json ./out
```

`prompts.json` = `[{ "id": "v1-hero", "prompt": "..." }, ...]`

**תמיד 4–6 בסבב הראשון, לא אחת.** בעלות 0.006$ אין שום סיבה לחסוך, וההבדל בין הראשונה לרביעית הוא בדרך כלל גדול.

### שלב 4 — דמות (אם ביקשו)

`composite-photo.py` כמו למעלה. הקואורדינטות נמדדות מהעיצוב שנוצר.

### שלב 5 — overlay: טקסט, מדבקה, כפתור

`templates/overlay.html` — למלא ולרנדר ל-PNG.

- **כותרת:** 3–7 מילים. Rubik 800. `dir="rtl"`.
- **מדבקה:** ניגודיות גבוהה, פינה עליונה.
- **כפתור:** מעוגל, צבע מודגש, **חץ ←** בסוף, בתחתית.
- **לוגו:** פינה, קטן.
- **מקסימום שתי שכבות טקסט.** שלוש = עומס.
- **לבדוק ב-30% הגדלה** — ככה זה ייראה בפיד.

### שלב 6 — סבבים

**קריאייטיב טוב הוא לא הראשון.** לשנות **דבר אחד בכל פעם** — צבע, או גיבור, או זווית. לשמור בשמות: `v1-`, `v2-`, `regen-color`.

---

## הכנה — פעם אחת

```
OPENAI_API_KEY=sk-...
```

בקובץ `.env` בתיקיית העבודה, או כמשתנה סביבה.

## מלכודות

| מה קורה             | למה                                       | מה עושים                     |
| ------------------- | ----------------------------------------- | ---------------------------- |
| עברית שבורה בתמונה  | המודל ניסה לכתוב                          | `no text` — והטקסט ב-overlay |
| נראה כמו איור       | חסר `hyper-realistic` / יש `illustration` | הנחיה 1                      |
| נראה שטוח וזול      | רקע בצבע אחד                              | הנחיה 2 — gradient + texture |
| צעקני ולא מקצועי    | יותר מ-3 צבעים                            | הנחיה 6                      |
| הפנים "כמעט" נכונות | ביקשו מהמודל לצייר פנים                   | ⛔ אף פעם. composite בלבד    |
| החשבון נשרף         | איכות `high`                              | `low` — כלל ברזל             |

## הקבצים

- `scripts/generate-images.mjs` — יצירת התמונות
- `scripts/composite-photo.py` — הדבקת הצילום האמיתי
- `templates/overlay.html` — טקסט, מדבקה וכפתור

---

השלב הבא: `meta-campaign-builder` לוקח את הקריאייטיב ובונה איתו את הקמפיין.
