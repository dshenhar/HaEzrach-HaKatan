# GitHub Actions — הגדרה חד‑פעמית

כל **push ל־`main`** מריץ [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **Server** — `server/deploy-gcp.sh` (Cloud Run, Secret Manager, Scheduler)
2. **Web** — `expo export` + `firebase deploy --only hosting`

## Secrets ב-GitHub

ב־**Settings → Secrets and variables → Actions → New repository secret**:

| שם Secret | מה לשים |
|-----------|---------|
| `GCP_SERVICE_ACCOUNT_JSON` | תוכן קובץ JSON של Service Account (ראו למטה) |
| `OPENAI_API_KEY` | אותו ערך כמו ב־`server/src/.env` |
| `GEMINI_API_KEY` | אותו ערך כמו ב־`server/src/.env` |
| `DEV_KEY` | אותו ערך כמו ב־`server/src/.env` |

אין צורך ב־Firebase CLI login או ב־`gcloud auth login` על המחשב — רק ה-secrets האלה.

## Service Account ב-Google Cloud

פרויקט: **`haezrach-hakatan`**

1. [IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=haezrach-hakatan) → **Create**
   - שם למשל: `github-actions-deploy`
2. **Keys → Add key → JSON** — שמרו את הקובץ; **כל התוכן** הולך ל-secret `GCP_SERVICE_ACCOUNT_JSON` ב-GitHub.
3. **Grant access** — הוסיפו לחשבון את התפקידים (או תפקיד אחד רחב לפרויקט קטן):

   | תפקיד | למה |
   |--------|-----|
   | `Cloud Run Admin` | deploy ל-api ול-job |
   | `Cloud Build Editor` | `gcloud builds submit` |
   | `Artifact Registry Administrator` | דחיפת Docker images |
   | `Secret Manager Admin` | עדכון מפתחות מ-deploy |
   | `Cloud Scheduler Admin` | ingest / ping timers |
   | `Service Account User` | הרצה בשם compute SA |
   | `Firebase Hosting Admin` | `firebase deploy --only hosting` |
   | `Datastore Owner` או `Cloud Datastore User` + הרשאות Firestore לפי הצורך | Firestore / TTL |

   לחלופין, לניסוי: **`Editor`** על הפרויקט + **`Firebase Hosting Admin`** — פחות מדויק אבל לעיתים מספיק.

4. ודאו ש-GitHub Actions מופעל: **Settings → Actions → General → Allow all actions** (או allowlist של actions רשמיים).

## אחרי ההגדרה

- דחיפה ל־`main` → tab **Actions** ב-repo.
- האתר: https://haezrach-hakatan.web.app  
- ה-workflow **לא** משנה את מצב ה-ingest (`SCHEDULE=on/off`) — כמו deploy מקומי בלי משתנה `SCHEDULE`.

## בעיות נפוצות

- **`missing OPENAI_API_KEY in src/.env`** — secret חסר או ריק ב-GitHub.
- **`Permission denied` ב-gcloud** — חסר תפקיד ל-Service Account.
- **`firebase deploy` נכשל** — הוסיפו `Firebase Hosting Admin` (או Firebase Admin).
- **Build ארוך** — Cloud Build + שני Docker images; זה נורמלי (כמה דקות).
