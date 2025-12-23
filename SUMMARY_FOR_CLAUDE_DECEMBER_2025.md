# PrimingToolbox - Summary for Claude (December 6, 2025)

supabase APIs:
Anon:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1aGdkbXprc2l0ZGtieXNkZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjU0MDMsImV4cCI6MjA4MDEwMTQwM30.kxiMmJE4N5U5pM-3d81URKCwZ5PSsE-19AIr5KWOMlQ"   
service:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1aGdkbXprc2l0ZGtieXNkZmJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNTQwMywiZXhwIjoyMDgwMTAxNDAzfQ.YL_yOcAu69uSHuHTjamtjDrNH0e3Ni-OmfuFl8eb_tI   

This is the project ID: luhgdmzksitdkbysdfbr   the name: shir-openu's Project     
This is my password: Cc918273645*   So thie is the correct postgress:    
postgresql://postgres:Cc918273645*@db.luhgdmzksitdkbysdfbr.supabase.co:5432/postgres

## Project Overview
**PrimingToolbox** - web-based tool for priming experiments based on **ABCD Framework** (Sivroni & Stark, 2025).

- **Developer:** Shir Sivroni, The Open University of Israel
- **Platform:** Online-only, free hosting (GitHub Pages + Supabase)
- **Live URL:** https://shir-openu.github.io/PrimingToolbox/
- **Current version:** v30 (v31 has bugs)

---

## ABCD Framework מהמאמר (Sivroni & Stark, 2025):

**שלושת המאפיינים של הטרמה (Priming):**
1. **Association** - קשר בין A (prime) ל-B (target)
2. **Secondariness** - A לא נדרש למשימה (משני/לא רלוונטי)
3. **Modulation** - A משנה את התוצאה מ-C ל-D

**הסימון:**
- **A** = גירוי ההטרמה (Prime) - המידע המשפיע
- **B** = המטרה (Target) - מה שצריך לעבד
- **C** = תוצאה בסיסית (בלי A)
- **D** = תוצאה נמדדת (עם A)

---

## ההשלכה על המערכת החדשה:

אפשרי יותר מגירוי הטרמה אחד בכל ניסיון. זה אומר:

**במקום:**
```
A → B → תגובה
```

**אפשר גם:**
```
A1, A2, A3 → B → תגובה
```

למשל: שלוש מילים מוצגות ברצף לפני ה-target, כל אחת יכולה להיות prime.

---

## תשובות לשאלות התכנון (מהמאמר):

### שאלה 1: האם A ו-B תמיד רצפיים או יכולים להיות סימולטניים?

**תשובה: שניהם אפשריים.**

מהמאמר (עמוד 3):
> "A and B may be experienced simultaneously or sequentially"

- **Stroop** = סימולטני (מילה וצבע יחד)
- **Semantic Priming** = רצפי (prime לפני target)

שניהם הטרמה כי שניהם עונים על 3 המאפיינים.

### שאלה 2: האם הניסויים השונים שונים רק בתוכן או גם במבנה?

**תשובה: שונים רק בתוכן.**

המאמר מראה שכל הפרדיגמות (semantic, affective, social, syntactic, goal, moral, money, racial, naturalistic, advertising) עונות על **אותה הגדרה בדיוק** - 3 המאפיינים.

ההבדל הוא רק **מה** A ו-B:
- Semantic: מילים עם קשר סמנטי
- Affective: גירויים עם ערכיות רגשית
- Social: מילים הקשורות לסטריאוטיפ

המבנה (ABCD) זהה.

### שאלה 3: מה המדדים האפשריים ל-D?

**תשובה: כל מדד התנהגותי.**

מהמאמר:
- **RT** (זמן תגובה) - semantic, affective priming
- **Error rate** (אחוז שגיאות) - semantic priming
- **Walking speed** - social priming (Bargh et al.)
- **Choice probability** - advertising priming
- **Persistence** - goal priming

---

## המסקנה המרכזית לארכיטקטורה:

ההגדרה המטא-דיסציפלינרית מאפשרת **מנוע אחד** לכל סוגי ההטרמה:

- **Semantic priming** (קוגניטיבי)
- **Affective priming** (רגשי)
- **Social priming** (חברתי)
- **Syntactic priming** (לשוני)
- **Goal priming** (מוטיבציוני)
- **Money priming** (כלכלי)
- **Short-term** וגם **Long-term**

כולם עונים על אותם 3 מאפיינים (Association, Secondariness, Modulation), אז כולם יכולים לרוץ על אותו מנוע.

---

## מנוע הטרמה גנרי:

במקום לכתוב קוד נפרד לכל סוג ניסוי, יש **מנוע אחד** שמריץ ניסויי הטרמה, והניסויים השונים הם רק **הגדרות שונות** שמוזנות למנוע הזה.

**המנוע יודע:**
- להציג גירוי A (או כמה)
- להציג גירוי B
- למדוד תגובה
- לשמור נתונים

**הקונפיגורציה אומרת לו:**
- מה A? (מילה? תמונה? צליל?)
- מה B? (מילה? צבע? תמונה?)
- איך להציג? (רצפי? סימולטני?)
- מה למדוד? (RT? דיוק?)
- מה מקשי התגובה?

### דוגמאות קונפיגורציה:

**Stroop:**
```json
{
  "A": "word meaning",
  "B": "ink color",
  "presentation": "simultaneous",
  "measure": "RT",
  "response_keys": {"red": "R", "blue": "B", ...}
}
```

**Semantic Priming:**
```json
{
  "A": "prime word",
  "B": "target word",
  "presentation": "sequential",
  "measure": "RT",
  "response_keys": {"word": "J", "nonword": "F"}
}
```

**אותו מנוע** מריץ את שניהם - רק ההגדרות שונות.

---

## מצב נוכחי (December 6, 2025):

### גרסאות:
- **v30** (1 December 2025) - גרסה עובדת אחרונה
- **v31** (6 December 2025) - נוסף External ID system, אבל יש באג בכפתור Generate Link

### Supabase:
- טבלה: `experiment_results`
- עמודות קיימות: `experiment_id`, `participant_id`, `trial_number`, `language`, `ink_color`, `word_meaning`, `congruent`, `response`, `correct`, `rt`, `experimenter_email`, `user_experiment_id`, `external_id`

### בעיות שזוהו:
1. כפתור "Generate Shareable Link" לא עובד (גם ב-v30)
2. הקובץ HTML גדול מדי (~130KB) - צריך פיצול
3. אין שמירת Settings לנסיין
4. אין מעבר דרך "Try it yourself" לפני Generate Link

---

## What We Built on December 1, 2025

### 1. Experimenter Identity System (v27-v29)
**Problem:** Multiple experimenters share ONE Supabase database. How to separate data?

**Solution:** Email + Experiment ID
```
FLOW:
1. Experimenter enters email + experiment ID in Template Builder
2. Clicks "Generate Link" → gets URL with encoded config
3. Sends link to participants
4. Data saved with experimenter_email + user_experiment_id
5. Later: "Get My Data" → enters BOTH fields → downloads merged CSV
```

### 2. Custom Stimuli Pass-Through (v30)
**Problem:** Changes in Template Builder (colors, words, response keys) weren't passed to participants.

**Solution:** `builderStimuli` array now included in URL config and applied when participant opens link.

### 3. External ID System (v31 - has bugs)
**Problem:** Researchers need to prevent duplicate participation for paid studies.

**Solution:**
- Toggle in Template Builder: "Require External ID from participants"
- Participant must enter Prolific/MTurk/SONA ID before starting
- Check against Supabase - if ID already participated, block them
- Save `external_id` with trial data

---

## File Structure

**Location:** `D:\Dropbox\...\PrimingToolbox-App\6_DECEMBER_2025\`

| File | Description |
|------|-------------|
| PTA-main-v30-1_DECEMBER_2025.html | Custom stimuli pass-through (LAST WORKING) |
| PTA-main-v31-6_DECEMBER_2025.html | External ID system (HAS BUGS) |

---

## Development Rules

1. **ALWAYS create new versioned file** before changes
2. **NEVER OVERWRITE existing files** - This is CRITICAL!
   - Always copy existing file to new version FIRST
   - Then modify the NEW file only
   - Reason: Existing files contain work that took significant time - we cannot start from scratch each time
3. **Local folder is source of truth** → then push to GitHub
4. No emojis unless requested
5. **CRITICAL: Preserve the existing visual appearance** - glassmorphism design, background waves, colors (teal #169999, pink #ff4db8, wine #990f23), dark theme

### File Safety Protocol (Added 23 Dec 2025)
**Before ANY file modification:**
1. Check if file exists
2. If exists → Copy to new version (e.g., file.html → file_v2.html or file_23_DEC_2025.html)
3. Only then modify the NEW copy
4. NEVER modify the original directly

**Why this matters:**
- Each file represents hours of work
- Claude cannot "remember" everything from previous sessions
- Overwriting destroys context that took time to build
- Versioned copies allow rollback and comparison

---

## Next Steps

1. Fix the Generate Link bug
2. Plan and implement the generic priming engine with modular architecture
3. Keep the existing visual design (appearance)

Updates to reorganise later in main text -- SSi:
Good questions. Let me suggest: 1. File naming:
Drop "main" - it was useful when we had one file, but now we'll have multiple files
For the modular structure, versioning works differently - we version the whole project, not individual files
Suggestion: PTA-v1.0 as the project version, individual files keep descriptive names (index.html, engine.js, etc.)
2. Folder structure: I'd recommend not creating date subfolders within each type folder. Here's why:
PRIMING_TOOLBOX/
├── docs/                    # Documentation, summaries, proposals
├── src/                     # Source code (the actual project)
│   ├── css/
│   ├── js/
│   ├── experiments/         # JSON configs
│   └── index.html
├── archive/                 # Old versions by date if needed
│   ├── 6_DECEMBER_2025/
│   └── ...
└── README.md
This way:
src/ is always the current working version
archive/ keeps dated snapshots when needed
No mixing of dates within code folders
The alternative (date folders everywhere) makes it hard to see what's current and creates duplicate structures. Does this make sense? Should I create this structure?


Setup complete! Summary:
Updated your app to use the correct Supabase project (luhgdmzksitdkbysdfbr)
I now have permanent direct access to your database via PostgreSQL
193 rows already in the database from experiments: test_001 and stroop_lang_en_he
What I can do now:
Query your experiment data anytime
Generate statistics and reports
Export data to any format
Monitor new participant submissions
Your app will now save data to the correct database. Want me to show you a summary of the existing data?

PrimingToolbox Session Summary
Goal achieved: Claude now has permanent direct access to Supabase database via PostgreSQL. Database credentials:
Host: db.luhgdmzksitdkbysdfbr.supabase.co
Database: postgres | User: postgres | Password: Cc918273645*
Project URL: https://luhgdmzksitdkbysdfbr.supabase.co
What was done:
Fixed project ID confusion (app had wrong ID bgbhvvaykmkeoniagfap → corrected to luhgdmzksitdkbysdfbr)
Updated js/core.js with correct Supabase config
Created credential files: SUPABASE_CREDENTIALS.txt and CLAUDE_DATABASE_ACCESS.txt
Verified today's data saved: participant p_mivf2obu_pmlrgqzda (2025-12-07 09:44:22) with 48 trials
Database state: 193 trials, 5 participants, experiments: test_001, stroop_lang_en_he Table columns: experiment_id, participant_id, trial_number, language, ink_color, word_meaning, congruent, response, correct, rt, experimenter_email, user_experiment_id, external_id

סיכום המאמרים
Sivroni et al. 2023 (iScience) - פורסם
Short-term auditory priming in freely-moving mice
פרדיגמה חדשה להטרמה שמיעתית קצרת-טווח בעכברים
4 עכברים הראו אפקט הטרמה ב-success rates (לא ב-RT)
3 שלבים: Discrimination → Validation → Priming
מנגנון: differential interference (IPTs מפריעים יותר מ-CPTs)
Sivroni & Stark 2025 (טרם פורסם) - הבסיס התיאורטי
A meta-disciplinary definition of priming ההגדרה המרכזית - 3 מאפיינים:
Association - קשר בין A (prime) ל-B (target)
Secondariness - A לא נדרש למשימה (משני/לא רלוונטי)
Modulation - A משנה את התוצאה מ-C ל-D
סימון ABCD:
A = גירוי ההטרמה (Prime)
B = המטרה (Target)
C = תוצאה בסיסית (בלי A)
D = תוצאה נמדדת (עם A)
הגדרה זו מאחדת:
Semantic priming (קוגניטיבי)
Affective priming (רגשי)
Social priming (חברתי)
Syntactic, Goal, Money, Racial, Naturalistic, Advertising priming
הקשר הקריטי להצעה:
ההגדרה החדשה (sivroni2025) מאפשרת את ה-Toolbox כי:
מנוע גנרי אחד - כל סוגי ההטרמה עונים על אותם 3 מאפיינים → אפשר לבנות כלי אחד שמריץ את כולם
סימון ABCD סטנדרטי - מאפשר להגדיר כל ניסוי הטרמה בקונפיגורציה אחידה
קריטריונים דיאגנוסטיים - הכלי יכול לוודא שניסוי מוגדר נכון כהטרמה
לגבי ההדגמה שציינת - נגדיר איזה ניסוי להראות? האפשרויות:
Stroop (כבר עובד)
Semantic priming (prime-target מילים)
Affective priming (תמונות/מילים רגשיות)
מה את מעדיפה להדגים?
stroop. אל תניחי שעובד כראוי עדיין כי הוא לא. אבל את כן יכולה להניח בניסוח ההצעה שהוא עובד. האם הדגמת stroop תספיק לדעתך? אם תעבוד תקין?