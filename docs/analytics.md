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

### הפיד — איפה האפליקציה נמדדת או נכשלת

| אירוע | פרמטרים |
|---|---|
| `story_opened` | how (scroll/tap), topic, section, outlets, right, left, shape |
| `story_dismissed` | how_opened, dwell_s |
| `bloc_side_opened` | side, outlets |
| `article_opened` | outlet_bloc, **crossed**, topic, section, outlets, mode |
| `returned_from_article` | away_s |
| `ai_summary_requested` | side |
| `citizen_card_opened` | outlets |
| `feed_depth` | stories (5 / 10 / 20 / 40) |
| `feed_refreshed` | — |
| `back_to_top` | — |

### שליטה בפיד

| אירוע | פרמטרים |
|---|---|
| `view_mode_changed` | mode |
| `bloc_filter_changed` | filter |
| `sort_changed` | sort |
| `section_filter_changed` | section |

### דירוגים והבנצ'מרק

| אירוע | פרמטרים |
|---|---|
| `rating_submitted` | topic, value, blind=false |
| `rating_dismissed` | topic |
| `blind_shown` | topic |
| `blind_submitted` | topic, value, placed_at |
| `blind_skipped` | topic |

### היכרות

| אירוע | פרמטרים |
|---|---|
| `tour_started` | — |
| `tour_step` | step, index |
| `tour_finished` | reached, steps |
| `questionnaire_opened` | from (welcome / reminder / analytics) |
| `questionnaire_completed` | bloc |
| `questionnaire_skipped` | from |
| `questionnaire_silenced` | — |

### המפה והאזור האישי

| אירוע | פרמטרים |
|---|---|
| `map_topics_opened` | chosen |
| `outlet_detail_opened` | how |
| `personal_area_opened` | — |
| `theme_changed` | theme |
| `accessibility_opened` | — |
| `accessibility_changed` | setting (text_size / contrast / stillness), value |
| `data_deleted` | — |
| `measurement_off` | — |

### תקלות

| אירוע | פרמטרים |
|---|---|
| `app_error` | where, message |
| `api_failed` | where, message |

| `screen_view` | screen_name — כל מסך, דרך הראוטר |

`first_open`, `session_start` ו-`user_engagement` מגיעים מ-GA4 מעצמה.

## מה שעוד לא חובר

- `install_prompt` / `install_accepted` — דורש חיווט של `beforeinstallprompt`, שלא נבנה.
- `blind_gap` — כמה הקורא העיוור רחוק מהעמדה שהאפליקציה מחזיקה לגוף. דורש
  להחזיר את העמדה יחד עם הגילוי.
- `watch_added` — סימון גוף למעקב.
- `story_shared` — אין כרגע כפתור שיתוף באפליקציה.

## הצד המשפטי

אין באנר הסכמה, ואין צורך בו: בלי מזהה אין מידע אישי לבקש עליו רשות. מדיניות
הפרטיות (`ui/content/legal.ts`) מתארת בפרק ״מדידת שימוש״ בדיוק מה נמדד, מה לא,
שהגוש לא נשלח, ואיפה המתג. המתג באזור האישי מכבה מיד, זורק את התור הפנימי וקורא
ל-`setAnalyticsCollectionEnabled(false)`.

ארבע ההגדרות שעושות את זה אנונימי: `client_storage: "none"` (העיקרית),
`anonymize_ip`, ‏`allow_google_signals: false`, ‏`allow_ad_personalization_signals:
false`.
