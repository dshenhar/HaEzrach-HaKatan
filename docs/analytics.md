# אפיון המדידה

מדידה מלאה, מאחורי הסכמה. Firebase Analytics ‏(GA4), מזהה מכשיר קבוע, ואפס מדידה
עד שהקורא אישר. נכתב מול הקוד ב-`ui/state/analytics.ts`.

## העיקרון

שלוש שאלות שהאפליקציה קיימת כדי לענות עליהן, וכל אירוע כאן נמדד כי הוא עונה על
אחת מהן:

1. **האם קוראים חוצים את המפה?** האם מי שהצהיר על עצמו כימין פותח כתבות של גופי
   שמאל, וההפך.
2. **האם הגילוי עובד?** האם אייטם שנפתח מביא לפתיחת צד, והאם צד שנפתח מביא לקריאה.
3. **האם המדידה שלנו משתפרת?** כמה דירוגים עיוורים נאספים, ובאילו נושאים.

## מה לא נאסף, לעולם

כותרות, קישורים, טקסט של כתבות, כתובת IP, והתשובות לשאלון העמדות. השאלון נשאר על
המכשיר. מה שכן נשלח ממנו הוא **הגוש** בלבד, כמאפיין משתמש — בלי זה אי אפשר לענות
על שאלה 1, ואיתו אי אפשר לזהות אדם.

## מאפייני משתמש

| מאפיין | ערכים | למה |
|---|---|---|
| `reader_bloc` | right / left / none | חציית המפה — השאלה המרכזית |
| `answered_questionnaire` | yes / no | כמה מהמדידה בכלל ניתנת להשוואה |

## אירועים מיושמים

| אירוע | פרמטרים | מאיפה |
|---|---|---|
| `screen_view` | screen_name | כל מסך, דרך הראוטר |
| `story_opened` | how (scroll/tap), topic, section, outlets, right, left, shape | `newsFeed` |
| `bloc_side_opened` | side, outlets | `blocView` |
| `article_opened` | outlet_bloc, topic, section, outlets, mode | `storyCard` |
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

מדיניות הפרטיות (`ui/content/legal.ts`) מתארת את כל מה שלמעלה בפרק ״מדידת שימוש״,
כולל המזהה, מה נמדד, מה לא, ואיך לכבות. הבאנר (`ui/components/consentBanner.tsx`)
מציג שתי אפשרויות שוות גודל ואינו חוזר אחרי תשובה. הכיבוי באזור האישי מפסיק מיד
וגם זורק את התור הפנימי, כך ששום דבר שקרה לפני הכיבוי לא נשלח אחריו.
