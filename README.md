# מספרה — מערכת הזמנת תורים

מערכת הזמנת תורים למספרה, בנויה עם Next.js, React, TypeScript, Tailwind CSS ו-SQLite.

---

## דרישות מקדימות

- Node.js 18 ומעלה
- npm

---

## התקנה והרצה מקומית

```bash
# 1. התקנת תלויות
npm install

# 2. הגדרת משתני סביבה
cp .env.example .env.local
# ערכו את .env.local והגדירו סיסמת מנהל

# 3. הרצת שרת פיתוח
npm run dev
```

האפליקציה תהיה זמינה בכתובת [http://localhost:3000](http://localhost:3000).

---

## משתני סביבה

| משתנה | תיאור | חובה |
|-------|-------|------|
| `ADMIN_PASSWORD` | סיסמת כניסה ראשונית לממשק הניהול | כן |

ניתן לשנות את הסיסמה לאחר הכניסה דרך ממשק הניהול (הגדרות → שינוי סיסמה).

---

## בסיס הנתונים

- הנתונים נשמרים בקובץ SQLite בנתיב `data/appointments.db`
- הקובץ נוצר אוטומטית בהרצה הראשונה — אין צורך בהגדרה ידנית
- כל הטבלאות נוצרות אוטומטית אם הן חסרות
- קובץ ה-DB **אינו** מתועד ב-Git (מוגדר ב-`.gitignore`)

**גיבוי:** העתיקו את הקובץ `data/appointments.db` לגיבוי ידני.

---

## מבנה האפליקציה

```
app/
  page.tsx              # דף הזמנת תורים ללקוחות
  admin/
    page.tsx            # ממשק ניהול
    login/page.tsx      # דף כניסת מנהל
  api/
    appointments/       # ניהול תורים
    availability/       # בדיקת זמינות
    services/           # ניהול שירותים
    settings/           # הגדרות עסק
    days-off/           # ימי חופש
    blocked-ranges/     # טווחי זמן חסומים
    admin/              # כניסה, יציאה, שינוי סיסמה
lib/
  db.ts                 # חיבור SQLite ואתחול טבלאות
  services.ts           # פונקציות עזר ווולידציה
  auth.ts               # אימות מנהל
proxy.ts                # הגנה על נתיבי /admin
```

---

## פריסה לייצור

### Vercel (מומלץ)

1. דחפו את הקוד ל-GitHub
2. חברו את הריפו ב-[vercel.com](https://vercel.com)
3. הגדירו `ADMIN_PASSWORD` תחת Project Settings → Environment Variables
4. פרסו

> **שימו לב:** Vercel משתמש ב-serverless functions — SQLite שמור בתיקייה זמנית ולא קבועה. לפריסת ייצור עם שמירת נתונים, השתמשו ב-VPS (Railway, Render, DigitalOcean) עם persistent storage.

### VPS / שרת עצמאי

```bash
npm run build
npm start
```

הגדירו משתני סביבה בשרת ווודאו שתיקיית `data/` כתיבה ניתנת על-ידי תהליך Node.

---

## ממשק הניהול

כתובת: [http://localhost:3000/admin](http://localhost:3000/admin)

- **תורים** — צפייה, סינון, ביטול, סימון כהושלם, הוספת הערות
- **שירותים** — הוספה, עריכה, הפעלה/השבתה
- **הגדרות** — שעות עבודה, ימי עבודה, ימי חופש, שעות חסומות, שינוי סיסמה
