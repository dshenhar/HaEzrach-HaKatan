# אפיון המדידה

ספירה אנונימית, בלי באנר ובלי בקשה. Firebase Analytics ‏(GA4) עם
`client_storage: none` — המדידה לא כותבת ולא קוראת שום מזהה, ולכן אי אפשר לחבר בין
שתי כניסות. נכתב מול הקוד ב-`ui/state/analytics.ts`.

**מה זה עולה לנו:** אין משתמשים חוזרים, אין שימור, אין מסע לאורך ימים. יודעים כמה
אנשים עשו משהו, לא מי חזר. זה המחיר של לא לעצור אדם בדלת.

## העיקרון

שלוש שאלות שהאפליקציה קיימת כדי לענות עליהן, וכל אירוע כאן נמדד כי הוא עונה על
אחת מהן:

1. **האם קוראים חוצים את המפה?** האם מי שהצהיר על עצמו כימין פותח כתבות של גופי
   שמאל, וההפך.
2. **האם הגילוי עובד?** האם אייטם שנפתח מביא לפתיחת צד, והאם צד שנפתח מביא לקריאה.
3. **האם המדידה שלנו משתפרת?** כמה דירוגים עיוורים נאספים, ובאילו נושאים.

## מה לא נאסף, לעולם

כותרות, קישורים, טקסט של כתבות, כתובת IP, מזהה מכשיר, **והגוש שהקורא הצהיר עליו**.

הגוש הוא הדבר הכי רגיש שהאפליקציה יודעת על אדם, והוא לא עוזב את המכשיר. הוא יושב
בזיכרון ב-`analytics.ts` ומשמש לדבר אחד: ברגע שנפתחת כתבה, לחשב אם היא מהצד השני.
מה שנשלח הוא `crossed: yes/no` — עובדה על קריאה, לא על אדם. זו התשובה לשאלה 1 בלי
שדעה פוליטית של מישהו תצא החוצה.

## אירועים מיושמים

| אירוע | פרמטרים | מאיפה |
|---|---|---|
| `screen_view` | screen_name | כל מסך, דרך הראוטר |
| `story_opened` | how (scroll/tap), topic, section, outlets, right, left, shape | `newsFeed` |
| `bloc_side_opened` | side, outlets | `blocView` |
| `article_opened` | outlet_bloc, **crossed**, topic, section, outlets, mode | `storyCard` |
| `ai_summary_requested` | side | `blocView` |
| `view_mode_changed` | mode | `newsFeed` |
| `bloc_filter_changed` | filter | `newsFeed` |
| `sort_changed` | sort | `newsFeed` |
| `section_filter_changed` | section | `newsFeed` |
| `back_to_top` | — | `newsFeed` |
| `rating_submitted` | topic, value, blind=false | `ratingSheet` |
| `blind_shown` | topic | `app/blind` |
| `blind_submitted` | topic, value, placed_at | `app/blind` |
| `tour_started` | — | `newsFeed` |
| `questionnaire_opened` | from | `_layout` |
| `questionnaire_completed` | bloc | `_layout` |
| `questionnaire_skipped` | from | `_layout` |
| `questionnaire_silenced` | — | `_layout` |
| `app_error` | where, message | `_layout`, חלון הדפדפן |

`first_open`, `session_start` ו-`user_engagement` מגיעים מ-GA4 מעצמו.

## מה שעוד לא חובר

כל אלה נבדקו ונמצאו שווים מדידה, ולא יושמו כדי לא לפזר אירועים לפני שרואים מה
הראשונים מחזירים:

- `story_dwell` — כמה זמן אייטם היה פתוח. דורש מדידת זמן בכרטיס.
- `feed_loaded` — כמה אייטמים ומה אחוז שני הצדדים בכל טעינה. מודד את הצינור, לא
  את הקורא, וכבר נמדד בשרת.
- `tour_completed` / `tour_step` — איפה אנשים נוטשים את הסיור.
- `install_prompt` / `install_accepted` — האם מתקינים למסך הבית.
- `outlet_detail_opened`, `map_topics_changed` — השימוש במפה.
- `theme_changed`, `stillness_toggled` — מי משתמש בנגישות ובמצב הנגטיב.
- `data_deleted` — כמה אנשים מוחקים את עצמם. חשוב, ועדיף למדוד בשרת.

## הצד המשפטי

אין באנר הסכמה, ואין צורך בו: בלי מזהה אין מידע אישי לבקש עליו רשות. מדיניות
הפרטיות (`ui/content/legal.ts`) מתארת בפרק ״מדידת שימוש״ בדיוק מה נמדד, מה לא,
שהגוש לא נשלח, ואיפה המתג. המתג באזור האישי מכבה מיד, זורק את התור הפנימי וקורא
ל-`setAnalyticsCollectionEnabled(false)`.

ארבע ההגדרות שעושות את זה אנונימי: `client_storage: "none"` (העיקרית),
`anonymize_ip`, ‏`allow_google_signals: false`, ‏`allow_ad_personalization_signals:
false`.
