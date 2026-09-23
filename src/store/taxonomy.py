"""What the app sorts the news by: a section for every article, an issue for some.

Two different questions were being answered by one field, and most of the news lost
by it. A car crash is not about a political issue, so it was filed under "general
news" and vanished; the war, which is most of what Israel publishes, had no issue to
belong to at all.

  SECTIONS   every article gets exactly one. This is what the feed filters by and
             what the coloured tab on a story shows.
  TOPICS     only an article that is really about a public dispute gets one, and
             with it the two ends of that dispute. This is what the map draws, what
             readers rate, and what the benchmark measures. +5 is always the
             position of the right bloc.

The list was not invented: it came out of a pass over 1,200 headlines from our own
archive, asking which disputes the coverage actually splits on (worker/discover_topics.py).
"""

GENERAL_TOPIC = "חדשות כלליות"
GENERAL_SECTION = "חברה"

# id -> name. The id is what documents store, so a name can be reworded later.
SECTIONS = {
    "security": "מלחמה וביטחון",
    "politics": "פוליטיקה",
    "law": "משפט",
    "crime": "פלילים ותאונות",
    "economy": "כלכלה",
    "religion": "דת ומדינה",
    "society": "חברה",
    "world": "עולם",
    "nature": "מזג אוויר וטבע",
    "culture": "ספורט ותרבות",
}

SECTION_HINTS = {
    "security": "הלחימה, צה\"ל, פיגועים, חטופים, איראן ושלוחיה, מערכת הביטחון",
    "politics": "הממשלה והכנסת, מפלגות, בחירות, סקרים, מינויים, קואליציה ואופוזיציה",
    "law": "בתי משפט, היועצת המשפטית, חקיקה, משפט נתניהו, ועדות חקירה",
    "crime": "פשיעה, תאונות דרכים, שריפות, חקירות משטרה, כתבי אישום פליליים",
    "economy": "משק, מחירים, תקציב, שוק ההון, נדל\"ן, תעסוקה",
    "religion": "יהדות, החברה החרדית והדתית, רבנות, כשרות, חגים, בתי כנסת",
    "society": "בריאות, חינוך, רווחה, קהילות, סיפורי אנוש, תחבורה",
    "world": "חדשות מחוץ לישראל שאינן נוגעות ישירות לביטחון ישראל",
    "nature": "מזג אוויר, רעידות אדמה, שיטפונות, סביבה ואקלים",
    "culture": "ספורט, תרבות, מוזיקה, טלוויזיה, בידור",
}

# id -> (name, what it covers, the right bloc's position, the left bloc's position)
TOPICS = {
    "war": ("מלחמה וטרור",
            "ניהול הלחימה בעזה ובזירות נוספות, המאבק בטרור והיקף השימוש בכוח",
            "המשך המערכה", "הסדר והפסקת אש"),
    "iran": ("איראן והזירה האזורית",
             "העימות עם איראן ושלוחיה, הגרעין והמערכה האזורית",
             "פעולה ולחץ", "דיפלומטיה והסכמים"),
    "world-ties": ("יחסי ישראל והעולם",
                   "היחסים עם ארה\"ב ועם הקהילה הבינלאומית, ביקורת חוץ וסנקציות",
                   "עצמאות מול לחץ", "תיאום והתחשבות"),
    "army-review": ("אחריות חיילים וחקירת מחדלים",
                    "אחריות של חיילים ומפקדים, ביקורת על צה\"ל וחקירת מחדלי 7 באוקטובר",
                    "גיבוי ללוחמים", "אחריות ובדיקה"),
    "palestinian-state": ("מדינה פלסטינית",
                          "הסדר מדיני והקמת מדינה פלסטינית לצד ישראל",
                          "נגד", "בעד הסדר מדיני"),
    "sovereignty": ("ריבונות וסיפוח",
                    "החלת ריבונות וסיפוח שטחים ביהודה ושומרון, ומעמד ירושלים",
                    "בעד ריבונות", "נגד סיפוח"),
    # the Hebrew gershayim, not an ASCII quote: a name is an enum value in the
    # tagging schema, and OpenAI rejects a double quote inside one
    "settlements": ("התיישבות ובנייה ביו\u05f4ש",
                    "בנייה והרחבה של יישובים, מאחזים, הסדרה ופינוי",
                    "בעד הרחבה", "נגד הרחבה"),
    "judiciary": ("עצמאות שיפוטית ושלטון החוק",
                  "סמכויות בג\"ץ והיועצת המשפטית, הרפורמה המשפטית ומשפט נתניהו",
                  "ריסון בג\"ץ", "משפט עצמאי"),
    "representation": ("פסילת מפלגות והייצוג הערבי",
                       "פסילת מועמדים ורשימות, גבולות ההשתתפות בבחירות ומעמד ערביי ישראל",
                       "מניעת השתתפות", "הכרעה בקלפי"),
    "press": ("תקשורת וחופש ביטוי",
              "טענות להטיה תקשורתית, חופש העיתונות והשידור הציבורי",
              "חשיפת הטיה", "חופש העיתונות"),
    # Not a policy position but a reading of the coverage: a story about the
    # coalition has no left or right answer, only a side it helps.
    "politics-coverage": ("סיקור פוליטי",
                          "סיקור המאבק הפוליטי עצמו: קואליציה ואופוזיציה, סקרים, מינויים ומהלכי מפלגות",
                          "מחזק את הקואליציה", "מחזק את האופוזיציה"),
    "haredi-draft": ("גיוס חרדים",
                     "גיוס בני ישיבות, חוק הגיוס ופטורים",
                     "מסלולים מותאמים", "שוויון בנטל"),
    "yeshiva-funding": ("מימון ישיבות",
                        "תקציבי ישיבות ומוסדות תורניים וכספים סקטוריאליים",
                        "בעד מימון", "נגד כספים סקטוריאליים"),
    "core-curriculum": ("לימודי ליבה",
                        "לימודי ליבה בחינוך החרדי ופיקוח על מוסדות החינוך",
                        "נגד כפייה", "ליבה כתנאי למימון"),
    "religion-public": ("דת במרחב הציבורי",
                        "תפילות והפרדה מגדרית במרחב הציבורי, הר הבית, חגים ואירועים דתיים",
                        "אופי יהודי", "מרחב משותף"),
    "marriage": ("נישואים ומעמד אישי",
                 "נישואים אזרחיים, גיור ומעמד אישי",
                 "רבנות", "נישואים אזרחיים"),
    "cost-of-living": ("יוקר המחיה ומעורבות המדינה",
                       "מחירים, רגולציה, מסים, דיור ומדיניות כלכלית",
                       "שוק חופשי", "פיקוח והתערבות"),
    "welfare": ("קצבאות ורווחה",
                "קצבאות, ביטוח לאומי ותמיכה בשכבות חלשות",
                "צמצום קצבאות", "הרחבת קצבאות"),
    "lgbt": ("זכויות הקהילה הגאה",
             "זכויות הקהילה הגאה, הורות, נישואים חד מיניים וטיפולי המרה",
             "נגד הכרה ממסדית", "בעד שוויון זכויות"),
}

# Where each new issue takes its opening benchmark from. An issue with no ancestor
# starts from the outlet's average across everything, at low confidence, so the
# readers and the measured benchmark can move it freely - see learning.py.
PRIOR_FROM = {
    "palestinian-state": (["שתי מדינות"], "high"),
    "sovereignty": (["סיפוח שטחי C", "חלוקת ירושלים"], "high"),
    "settlements": (["בנייה בהתנחלויות", "מאחזים", "פינוי ההתנחלויות"], "high"),
    "judiciary": (["עצמאות שיפוטית"], "high"),
    "representation": (["חוק הלאום"], "med"),
    "haredi-draft": (["גיוס חרדים"], "low"),
    "yeshiva-funding": (["מימון ישיבות"], "high"),
    "core-curriculum": (["לימודי ליבה"], "high"),
    "religion-public": (["מימון ישיבות", "לימודי ליבה", "נישואים אזרחיים"], "low"),
    "marriage": (["נישואים אזרחיים"], "high"),
    "cost-of-living": (["כלכלה", "דיור ציבורי"], "high"),
    "welfare": (["קצבאות לחלשים"], "high"),
    "lgbt": (["נישואים חד מיניים", "טיפולי המרה"], "high"),
}
