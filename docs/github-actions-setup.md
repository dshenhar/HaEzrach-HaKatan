# GitHub Actions — הגדרה חד‑פעמית

כל **push ל־`main`** מריץ את [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
שמפרסם את מה שהשתנה, עם אותו `./deploy.sh` שמריצים ביד:

- שינוי ב־`server/` → `./deploy.sh server`: בונה את ה־api ואת ה־ingest ב־Cloud Build ומעדכן את Cloud Run.
- שינוי ב־`ui/` → `./deploy.sh web`: בונה את האפליקציה ומפרסם ל־Firebase Hosting.
- שינוי ב־`deploy.sh`, ב־`scripts/` או ב־workflow עצמו, או הרצה ידנית → את שניהם.
- שינוי בתיעוד בלבד → כלום.

ה־workflow מפרסם **קוד בלבד**. המפתחות (OpenAI, Gemini, DEV_KEY) כבר נמצאים ב־Secret Manager
ונשארים שם, ותזמון ה־ingest והגדרות מסד הנתונים לא משתנים. אלה עדיין בתחום של
`server/deploy-gcp.sh`, שהבעלים מריץ ביד. לכן המפתחות לא נכנסים ל־GitHub, וחשבון השירות
של ה־workflow לא צריך הרשאה לשנות הרשאות בפרויקט.

## 1. חשבון שירות ב־Google Cloud

פותחים את [Cloud Shell](https://shell.cloud.google.com/?project=haezrach-hakatan) בפרויקט
`haezrach-hakatan`, עם משתמש שהוא Owner של הפרויקט, ומדביקים:

```bash
P=haezrach-hakatan
SA=github-actions-deploy@$P.iam.gserviceaccount.com
gcloud iam service-accounts create github-actions-deploy --project $P \
  --display-name "GitHub Actions deploy"
for r in cloudbuild.builds.editor run.developer iam.serviceAccountUser \
         firebasehosting.admin serviceusage.serviceUsageConsumer storage.admin viewer; do
  gcloud projects add-iam-policy-binding $P --member "serviceAccount:$SA" \
    --role "roles/$r" --condition=None --quiet >/dev/null && echo "✓ $r"
done
gcloud iam service-accounts keys create ~/gha-key.json --iam-account $SA \
  && cloudshell download ~/gha-key.json
```

בסוף, הדפדפן מוריד את `gha-key.json`.

| תפקיד | בשביל מה |
|-------|----------|
| Cloud Build Editor | `gcloud builds submit`, בניית שתי התמונות |
| Storage Admin | העלאת הקוד ל־bucket של Cloud Build |
| Service Usage Consumer | שימוש ב־APIs של הפרויקט (Cloud Build, Firebase) |
| Cloud Run Developer | עדכון התמונה של ה־api ושל ה־job |
| Service Account User | ה־api וה־job רצים בשם ה־compute service account |
| Firebase Hosting Admin | `firebase deploy --only hosting` |
| Viewer | הצגת לוג הבנייה ב־Actions וקריאת פרטי הפרויקט |

אין צורך ב־Editor, ב־Secret Manager, ב־Cloud Scheduler או ב־Project IAM Admin.

## 2. ה־secret ב־GitHub

ב־repo: **Settings → Secrets and variables → Actions → New repository secret**

- **Name:** `GCP_SERVICE_ACCOUNT_JSON`
- **Secret:** כל התוכן של `gha-key.json`, מהסוגר `{` הראשון עד `}` האחרון.

זה ה־secret היחיד שצריך. אם כבר הוספתם `OPENAI_API_KEY`, `GEMINI_API_KEY` או `DEV_KEY`,
ה־workflow לא משתמש בהם, ואפשר למחוק אותם.

אחרי ששמרתם, מוחקים את המפתח משני המקומות שבהם הוא נשאר: את הקובץ שהורד למחשב,
ואת העותק ב־Cloud Shell:

```bash
rm ~/gha-key.json
```

## 3. GitHub Actions פעיל

**Settings → Actions → General → Actions permissions**: אפשרות שמתירה את `actions/*`
ואת `google-github-actions/*`. ברירת המחדל, Allow all actions, מתאימה.

## 4. בדיקה

- **Actions → Deploy → Run workflow** (על `main`) מפרסם את שני החלקים. לחלופין, כל push ל־`main`.
- הלוג נמצא בלשונית **Actions**: לוחצים על ההרצה ואז על **Publish**.
  לוג הבנייה של השרת נמצא גם ב־[Cloud Build](https://console.cloud.google.com/cloud-build/builds?project=haezrach-hakatan).
- ריצה תקינה מסתיימת ב־`server: <תג> - the ingest picks it up at its next half hour`
  וב־`Deploy complete!` של Firebase. האתר: https://haezrach-hakatan.web.app

## תקלות

| הודעה | מה לעשות |
|-------|-----------|
| `The repository secret GCP_SERVICE_ACCOUNT_JSON is not set` | שלב 2 לא בוצע, או שה־secret נשמר בשם אחר |
| `must specify exactly one of "workload_identity_provider" or "credentials_json"` | אותו דבר: ה־secret ריק או חסר |
| `failed to parse service account key JSON` | לא הודבק כל הקובץ. מדביקים מחדש מ־`{` עד `}` |
| `PERMISSION_DENIED` / `does not have permission` ב־`builds submit` | חסרים Cloud Build Editor, Storage Admin או Service Usage Consumer |
| `forbidden from accessing the bucket` | חסר Storage Admin או Service Usage Consumer |
| `run.services.update` / `run.jobs.update` denied | חסר Cloud Run Developer |
| `iam.serviceaccounts.actAs` denied | חסר Service Account User |
| `firebase deploy` נכשל ב־`403` או `HTTP Error: 401` | חסרים Firebase Hosting Admin או Service Usage Consumer |
| `API ... has not been used in project ... or it is disabled` | ה־API כבוי. `server/deploy-gcp.sh` מדליק את כולם, או: **APIs & Services → Enable** |
| `billing account ... is disabled` / `FAILED_PRECONDITION` ב־Cloud Build | אין חשבון חיוב פעיל לפרויקט: **Billing** |
| `did not answer` אחרי `checking the API answers` | ה־api למטה, ולכן האתר לא נבנה נגדו. בודקים ב־Cloud Run |

רשימת התפקידים של החשבון:

```bash
gcloud projects get-iam-policy haezrach-hakatan --format=json \
  | python3 -c "import json,sys; print('\n'.join(b['role'] for b in json.load(sys.stdin)['bindings'] if 'serviceAccount:github-actions-deploy@haezrach-hakatan.iam.gserviceaccount.com' in b['members']))"
```

## אבטחה

- לא עושים commit לקובץ ה־JSON, ולא שומרים אותו בתוך התיקייה של ה־repo.
- לא מדביקים מפתחות ו־secrets בצ'אט, במייל או בהודעה. המקום היחיד שלהם הוא שדה ה־secret ב־GitHub.
- מפתח שדלף: מוחקים אותו ב־**IAM → Service Accounts → github-actions-deploy → Keys**,
  יוצרים חדש ומעדכנים את ה־secret.
- מי שיכול לדחוף ל־`main` מפרסם לפרודקשן. כדאי להגדיר הגנת branch על `main`
  (**Settings → Branches**), כך ששינוי נכנס רק דרך pull request.
