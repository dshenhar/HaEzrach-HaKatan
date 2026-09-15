# -*- coding: utf-8 -*-
"""Generate the seed prior-bias benchmark: every outlet, every topic.

Writes initial_ranks.json in the shape add_initial_site_ranks.py already expects:
    [{"category": <topic>, "ranks": {<site>: <score>}}, ...]

Scale matches the rest of the system: prior_bias runs -5 (left) to +5 (right).
companyCard renders it as (bias * 10) + 50, and analyticsPage buckets at +-2.5.

WHAT THIS IS
    An informed editorial estimate, not measurement. Each outlet gets a baseline
    from its publicly documented identity - ownership, founding purpose, stated
    editorial line - and then per-family offsets, because outlets are not flat:
    the haredi papers sit far right on religion-and-state and to the LEFT of
    centre on welfare, and TheMarker is left on civil issues while pro-market on
    the economy. Those splits are the whole point of a per-topic map; a single
    left-right number would hide them.

WHAT IT IS NOT
    Per-topic evidence. No outlet was coded against a sample of its articles.
    Offsets are reasoning from a known ideological family, which is why every
    family carries a confidence level. Treat low-confidence cells as placeholders.

    This file is a SEED. site_topic_prior_bias is weighted against user votes
    (see /articles/{id}/vote), so the priors matter most on day one and decay in
    influence as real ratings arrive. It should get an editorial review pass
    before it is shown to users as fact.
"""
import json
import os

# ---------------------------------------------------------------- topics
# "+5" always means the position associated with the Israeli right bloc.
# Stating the positive pole per topic is what makes a score auditable.
# "+5" always means the position associated with the Israeli right bloc - which
# for half these topics is AGAINST the thing the topic is named after. Labelling
# an axis end generically "בעד" therefore lies: it showed the religious-right
# outlets as supporters of civil marriage. Each topic carries the two end labels
# it actually means, and the app draws those.
# (family, what +5 means, confidence, right-end label, left-end label)
TOPICS = {
    "שתי מדינות":        ("TERRITORY",  "נגד הקמת מדינה פלסטינית", "high", "נגד", "בעד"),
    "סיפוח שטחי C":      ("TERRITORY",  "בעד סיפוח וריבונות", "high", "בעד", "נגד"),
    "חלוקת ירושלים":     ("TERRITORY",  "נגד חלוקת העיר", "high", "נגד", "בעד"),
    "סיכולים ממוקדים":   ("TERRITORY",  "בעד סיכולים ממוקדים", "med", "בעד", "נגד"),
    "בנייה בהתנחלויות":  ("TERRITORY",  "בעד בנייה והרחבה", "high", "בעד", "נגד"),
    "מאחזים":            ("TERRITORY",  "בעד הסדרה והכשרה", "high", "בעד הסדרה", "נגד הסדרה"),
    "פינוי ההתנחלויות":  ("TERRITORY",  "נגד פינוי", "high", "נגד פינוי", "בעד פינוי"),
    "עסקת המאה":         ("TERRITORY",  "בעד התוכנית", "med", "בעד", "נגד"),
    "חוק הלאום":         ("IDENTITY",   "בעד החוק", "high", "בעד החוק", "נגד החוק"),
    "כלכלה":             ("ECONOMY",    "שוק חופשי והפרטה", "high", "שוק חופשי", "מעורבות המדינה"),
    "קצבאות לחלשים":     ("WELFARE",    "צמצום קצבאות", "high", "צמצום קצבאות", "הרחבת קצבאות"),
    "דיור ציבורי":       ("WELFARE",    "פתרונות שוק", "med", "פתרונות שוק", "דיור ציבורי"),
    "מימון ישיבות":      ("RELIGION",   "בעד מימון מוסדות תורניים", "high", "בעד מימון", "נגד מימון"),
    "לימודי ליבה":       ("RELIGION",   "נגד כפיית לימודי ליבה", "high", "נגד כפייה", "בעד חובה"),
    "גיוס חרדים":        ("RELIGION",   "נגד גיוס חובה · מפצל את הימין", "low", "נגד גיוס חובה", "בעד גיוס שוויוני"),
    "נישואים אזרחיים":   ("RELIGION",   "נגד נישואים אזרחיים", "high", "נגד", "בעד"),
    "נישואים חד מיניים": ("CIVIL",      "נגד הכרה", "high", "נגד הכרה", "בעד הכרה"),
    "טיפולי המרה":       ("CIVIL",      "נגד איסור על טיפולי המרה", "med", "נגד איסור", "בעד איסור"),
    "מהגרי עבודה":       ("CIVIL",      "מדיניות הגירה מחמירה", "med", "הגירה מחמירה", "הגירה מקלה"),
    "עצמאות שיפוטית":    ("GOVERNANCE", "בעד ריסון בג\"ץ", "high", "ריסון בג\"ץ", "בית משפט חזק"),
    "סביבה":             ("ENV",        "פחות רגולציה סביבתית", "low", "פחות רגולציה", "יותר רגולציה"),
    "ליגליזציה":         ("LIBERAL",    "נגד לגליזציה · לא ציר נקי", "low", "נגד", "בעד"),
}

# ---------------------------------------------------------------- outlets
# (db name, hebrew name, baseline, {family: offset}, one-line basis)
OUTLETS = [
    # ---------------- right ----------------
    ("i24News", "i24news", 1.0, {"TERRITORY": .5, "RELIGION": -1.0, "CIVIL": -.5},
     "ערוץ בינלאומי בבעלות פטריק דרהי; מסגור ישראלי מיינסטרימי הנוטה ימינה, חילוני"),
    ("ישראל היום", "ישראל היום", 3.0, {"TERRITORY": .5, "GOVERNANCE": 1.0, "ECONOMY": .5},
     "נוסד במימון שלדון אדלסון בקו פרו־נתניהו מוצהר"),
    ("ערוץ 14", "ערוץ 14", 4.5, {"RELIGION": -1.0, "GOVERNANCE": .5, "CIVIL": -.5},
     "ערוץ ימני מוצהר ופרו־נתניהו; קהל ימני־חילוני ולא דתי"),
    ("בשבע", "בשבע", 4.5, {"TERRITORY": .5, "RELIGION": .5, "CIVIL": .5, "ECONOMY": -.5},
     "שבועון ציוני־דתי מבית ערוץ 7; זהות מתנחלית מובהקת"),
    ("סרוגים", "סרוגים", 4.0, {"TERRITORY": .5, "RELIGION": .5, "CIVIL": .5, "ECONOMY": -.5},
     "אתר ציוני־דתי; סדר יום דתי־לאומי"),
    ("מידה", "מידה", 4.0, {"ECONOMY": 1.0, "WELFARE": 1.5, "GOVERNANCE": 1.0, "RELIGION": -.5},
     "כתב עת שמרני־ליברטריאני; שוק חופשי וריסון הרשות השופטת"),
    ("מקור ראשון", "מקור ראשון", 3.5, {"TERRITORY": .5, "RELIGION": .5, "GOVERNANCE": .5},
     "יומון ציוני־דתי שמרני, קו מתון ועיוני יותר מהאתרים הסקטוריאליים"),
    ("כיכר השבת", "כיכר השבת", 3.0,
     {"RELIGION": 2.0, "WELFARE": -4.5, "ECONOMY": -2.0, "TERRITORY": -.5, "CIVIL": 1.5, "ENV": -.5},
     "עיתונות חרדית: ימין מובהק בדת ומדינה, אך שמאל כלכלי - הציבור החרדי נשען על קצבאות ודיור"),
    ("בחדרי חרדים", "בחדרי חרדים", 3.0,
     {"RELIGION": 2.0, "WELFARE": -4.5, "ECONOMY": -2.0, "TERRITORY": -.5, "CIVIL": 1.5, "ENV": -.5},
     "עיתונות חרדית; אותה חלוקה - ימין דתי, שמאל כלכלי"),

    # ---------------- left ----------------
    ("ערוץ 13", "ערוץ 13", -1.5, {"GOVERNANCE": -.5},
     "חדשות מסחריות מיינסטרים; מחלקת חדשות ביקורתית כלפי השלטון"),
    ("מעריב", "מעריב", -0.5, {},
     "יומון מיינסטרים; קו מעורב וקרוב למרכז"),
    ("הארץ", "הארץ", -4.0, {"GOVERNANCE": -1.0, "CIVIL": -.5, "ECONOMY": .5},
     "יומון ליברלי־שמאלי מובהק; עמוד השדרה של המחנה"),
    ("דה מרקר", "דה מרקר", -2.5, {"ECONOMY": 1.0, "WELFARE": -.5},
     "יומון כלכלי מבית הארץ: ליברלי חברתית, אך פרו־תחרות ופרו־שוק בכלכלה"),
    ("שקוף", "שקוף", -3.5, {"CIVIL": -1.0, "WELFARE": -1.0},
     "עיתונות חוקרת מוכוונת אג'נדה חברתית"),
    ("Ynet", "ynet", -1.0, {},
     "האתר הגדול בישראל; מיינסטרים רחב, נוטה קלות שמאלה"),
    ("וואלה", "וואלה", -1.0, {},
     "פורטל מיינסטרים; מרכז"),
    ("כאן 11", "כאן 11", -1.0, {"CIVIL": -.5},
     "השידור הציבורי; מרכז, נתפס כשמאלי בעיני הימין"),
    ("N12", "N12", -1.5, {"GOVERNANCE": -.5},
     "ערוץ החדשות המסחרי הגדול; מיינסטרים רחב, מחלקת חדשות ביקורתית"),

    # ---- the rest of the roster: nobody may be left without a score, because
    # ---- the breaking point is now zero and every outlet has to land in a bloc
    ("ערוץ 7", "ערוץ 7", 4.5, {"TERRITORY": .5, "RELIGION": .5, "CIVIL": .5, "ECONOMY": -.5},
     "אותו מו\"ל ואותה מערכת של בשבע; ציוני־דתי מתנחלי"),
    ("חדשות JDN", "חדשות JDN", 3.0,
     {"RELIGION": 2.0, "WELFARE": -4.5, "ECONOMY": -2.0, "TERRITORY": -.5, "CIVIL": 1.5, "ENV": -.5},
     "עיתונות חרדית; אותה חלוקה - ימין דתי, שמאל כלכלי"),
    ("חרדים 10", "חרדים 10", 3.0,
     {"RELIGION": 2.0, "WELFARE": -4.5, "ECONOMY": -2.0, "TERRITORY": -.5, "CIVIL": 1.5, "ENV": -.5},
     "עיתונות חרדית"),
    ("כל הזמן", "כל הזמן", 3.0,
     {"RELIGION": 2.0, "WELFARE": -4.5, "ECONOMY": -2.0, "TERRITORY": -.5, "CIVIL": 1.5, "ENV": -.5},
     "עיתונות חרדית"),
    ("גלובס", "גלובס", 0.5, {"ECONOMY": 1.5, "WELFARE": 1.0, "TERRITORY": -.5, "RELIGION": -1.0},
     "יומון כלכלי; ליברלי כלכלית, מרכז פוליטית"),
    ("כלכליסט", "כלכליסט", -0.3, {"ECONOMY": 1.5, "WELFARE": .5, "RELIGION": -1.0},
     "יומון כלכלי מבית ידיעות; פרו־שוק אך ליברלי חברתית"),
    ("שיחה מקומית", "שיחה מקומית", -4.5, {"TERRITORY": -.5, "CIVIL": -.5, "WELFARE": -.5},
     "עיתונות פרוגרסיבית מובהקת; שותפות עם 972+"),
    ("972+", "972+", -4.5, {"TERRITORY": -.5, "CIVIL": -.5},
     "מגזין שמאל באנגלית; מוקד בכיבוש ובזכויות אדם"),
    ("זמן ישראל", "זמן ישראל", -1.5, {"GOVERNANCE": -.5},
     "המהדורה העברית של טיימס אוף ישראל; מרכז־שמאל"),
    ("דבר", "דבר", -2.5, {"WELFARE": -1.5, "ECONOMY": -1.0},
     "אתר מיסודה של ההסתדרות; סוציאל־דמוקרטי, מוקד בעבודה וברווחה"),
    ("ערב 48", "عرب 48", -4.0, {"TERRITORY": -1.0, "CIVIL": .5},
     "עיתונות ערבית־ישראלית; שמאל מדיני מובהק, שמרני יותר בסוגיות חברתיות"),
    ("חיפה נט", "حيفا نت", -3.0, {"TERRITORY": -.5, "CIVIL": .5},
     "אתר ערבי מקומי בחיפה"),
]


# Per-topic corrections on top of baseline + family. A family offset alone made 8
# of the 22 topics interchangeable - the whole territory block ranked the outlets
# identically - so any two topics from one family drew a straight diagonal instead
# of a plane. These are the places where an outlet genuinely departs from its
# family, and they are what make the map two-dimensional.
TOPIC_DELTAS = {
    # security consensus: the centre is broadly supportive, unlike on settlements
    "סיכולים ממוקדים": {
        "Ynet": 1.8, "N12": 1.8, "וואלה": 1.8, "כאן 11": 1.5, "ערוץ 13": 1.5,
        "מעריב": 1.5, "i24News": 1.5, "גלובס": 1.0, "כלכליסט": 1.0,
        "דה מרקר": 1.0, "זמן ישראל": 1.0, "הארץ": .5,
    },
    # near-consensus in Jewish Israeli media, left included
    "חלוקת ירושלים": {
        "Ynet": 1.5, "N12": 1.5, "וואלה": 1.5, "כאן 11": 1.2, "ערוץ 13": 1.2,
        "מעריב": 1.2, "דה מרקר": 1.0, "זמן ישראל": 1.0, "דבר": .8,
    },
    # the settler press's rawest nerve; the secular right is cooler
    "פינוי ההתנחלויות": {
        "בשבע": .5, "סרוגים": .5, "ערוץ 7": .5, "מקור ראשון": .5,
        "ערוץ 14": -.5, "i24News": -.5, "גלובס": -.5, "כלכליסט": -.5,
    },
    # even much of the right is uneasy about unauthorised outposts
    "מאחזים": {
        "ישראל היום": -.8, "i24News": -.8, "ערוץ 14": -.5,
        "גלובס": -.8, "כלכליסט": -.8, "כיכר השבת": -.8, "בחדרי חרדים": -.8,
    },
    # Likud-adjacent outlets were more cautious than the settler press; business
    # press wary of the economic fallout
    "סיפוח שטחי C": {
        "ישראל היום": -.5, "i24News": -.5, "גלובס": -1.0, "כלכליסט": -1.0,
        "כיכר השבת": -.5, "בחדרי חרדים": -.5, "חדשות JDN": -.5,
    },
    "עסקת המאה": {"גלובס": .5, "כלכליסט": .5, "הארץ": .5, "דה מרקר": .5},

    # --- religion splits the right harder than anything else ---
    # a libertarian journal opposes state funding on principle
    "מימון ישיבות": {
        "מידה": -3.0, "ערוץ 14": -2.5, "i24News": -1.5,
        "גלובס": -1.0, "כלכליסט": -1.0,
    },
    # the secular AND religious-zionist right both want core curriculum
    "לימודי ליבה": {
        "ערוץ 14": -4.0, "מידה": -3.0, "i24News": -2.5, "ישראל היום": -2.0,
        "סרוגים": -2.0, "בשבע": -1.5, "מקור ראשון": -2.0, "ערוץ 7": -1.5,
    },
    "גיוס חרדים": {
        "ערוץ 14": -4.5, "מידה": -3.5, "i24News": -3.0, "ישראל היום": -2.5,
        "סרוגים": -2.5, "בשבע": -1.5, "מקור ראשון": -2.5, "ערוץ 7": -1.5,
    },
    "נישואים אזרחיים": {
        "ערוץ 14": -3.0, "מידה": -2.0, "i24News": -2.0, "ישראל היום": -1.0,
    },

    # --- civil rights ---
    "נישואים חד מיניים": {"ערוץ 14": -2.0, "i24News": -2.0, "מידה": -1.0},
    # banning conversion therapy has broad support; only the religious core objects
    "טיפולי המרה": {
        "ערוץ 14": -2.5, "i24News": -2.5, "ישראל היום": -1.5, "מידה": -1.5,
        "Ynet": -1.0, "N12": -1.0, "וואלה": -1.0,
    },
    # where the secular right is harshest and the haredi press least engaged
    "מהגרי עבודה": {
        "ערוץ 14": 1.0, "ישראל היום": .8, "i24News": .5,
        "כיכר השבת": -1.5, "בחדרי חרדים": -1.5, "חדשות JDN": -1.5,
        "חרדים 10": -1.5, "כל הזמן": -1.5,
    },

    # --- economy and welfare ---
    "כלכלה": {"גלובס": 1.5, "כלכליסט": 1.5, "דה מרקר": .5, "דבר": -1.5},
    "קצבאות לחלשים": {"גלובס": .8, "כלכליסט": .5, "דבר": -1.5},
    # the haredi housing crunch makes this their most left-wing position
    "דיור ציבורי": {
        "כיכר השבת": -1.0, "בחדרי חרדים": -1.0, "חדשות JDN": -1.0,
        "חרדים 10": -1.0, "כל הזמן": -1.0, "דבר": -1.0,
    },

    # the business press opposed the judicial overhaul
    "עצמאות שיפוטית": {
        "גלובס": -2.0, "כלכליסט": -2.0, "דה מרקר": -1.5,
        "ערוץ 14": .5, "מידה": .5,
    },

    # barely a left-right axis in Israel: compress everyone but the campaigners
    "סביבה": {
        "ערוץ 14": -2.0, "בשבע": -2.0, "סרוגים": -2.0, "ערוץ 7": -2.0,
        "מקור ראשון": -1.5, "ישראל היום": -1.5, "מידה": -1.0, "i24News": -1.0,
        "כיכר השבת": -1.5, "בחדרי חרדים": -1.5, "חדשות JDN": -1.5,
        "חרדים 10": -1.5, "כל הזמן": -1.5,
    },
    # genuinely scrambled: Likud figures championed it, the haredi parties fought it
    "ליגליזציה": {
        "ערוץ 14": -3.5, "ישראל היום": -2.5, "i24News": -2.0, "מידה": -3.0,
        "Ynet": -1.0, "N12": -1.0,
        "כיכר השבת": 1.5, "בחדרי חרדים": 1.5, "חדשות JDN": 1.5,
        "חרדים 10": 1.5, "כל הזמן": 1.5, "בשבע": .5, "סרוגים": .5,
    },
}


def score(baseline, offsets, family, topic=None, outlet=None):
    value = baseline + offsets.get(family, 0.0)
    if topic and outlet:
        value += TOPIC_DELTAS.get(topic, {}).get(outlet, 0.0)
    return max(-5.0, min(5.0, round(value, 2)))


def main():
    out = []
    for topic, (family, pole, confidence, pole_right, pole_left) in TOPICS.items():
        out.append({
            "category": topic,
            "positive_pole": pole,
            "confidence": confidence,
            "family": family,
            "pole_right": pole_right,
            "pole_left": pole_left,
            "ranks": {db: score(base, off, family, topic, db)
                      for db, _he, base, off, _why in OUTLETS},
        })

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "initial_ranks.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"{len(out)} topics x {len(OUTLETS)} outlets -> {path}\n")
    print(f"{'גוף':<16}{'כללי':>7}  {'טריטוריה':>9}{'כלכלה':>8}{'רווחה':>8}{'דת':>7}{'משפט':>7}")
    for db, he, base, off, _why in OUTLETS:
        fams = ["TERRITORY", "ECONOMY", "WELFARE", "RELIGION", "GOVERNANCE"]
        vals = [score(base, off, f) for f in fams]
        overall = round(sum(score(base, off, v[0], name, db)
                            for name, v in TOPICS.items()) / len(TOPICS), 2)
        print(f"{he:<16}{overall:>7.2f}  " + "".join(f"{v:>8.1f}" for v in vals))


if __name__ == "__main__":
    main()
