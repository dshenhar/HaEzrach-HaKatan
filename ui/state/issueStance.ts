/**
 * What "for" and "against" mean on each issue, and which side is which.
 *
 * The question after an article asks whether it was for or against - not right or
 * left - because that is a question about the article rather than about a camp.
 * The scale still runs the way every scale in the app runs, the left's end on the
 * left and the right's on the right; what changes is the words at its ends, which
 * are the right's and the left's position on the issue: on soldiers' accountability
 * the left is for and the right against, on disqualifying parties the right is for
 * and the left against.
 *
 * `about` is what one is for or against, said as the issue's own proposition where
 * its name is not one ("מלחמה וטרור" is a field, "המשך הלחימה" a position); `pro`
 * is the side that is for it. Political coverage has no proposition - it is a
 * reading of which camp a story helps - and keeps right and left.
 */
type IssueStance = { about: string; pro: "right" | "left" };

const ISSUES: Record<string, IssueStance> = {
    "מלחמה וטרור": { about: "המשך הלחימה", pro: "right" },
    "איראן והזירה האזורית": { about: "פעולה צבאית ולחץ על איראן", pro: "right" },
    "יחסי ישראל והעולם": { about: "התחשבות בעמדת העולם", pro: "left" },
    "אחריות חיילים וחקירת מחדלים": { about: "חקירת המחדלים ואחריות החיילים", pro: "left" },
    "מדינה פלסטינית": { about: "מדינה פלסטינית", pro: "left" },
    "ריבונות וסיפוח": { about: "החלת ריבונות", pro: "right" },
    "התיישבות ובנייה ביו״ש": { about: "הרחבת ההתיישבות", pro: "right" },
    "עצמאות שיפוטית ושלטון החוק": { about: "עצמאות מערכת המשפט", pro: "left" },
    "פסילת מפלגות והייצוג הערבי": { about: "פסילת מפלגות ומועמדים", pro: "right" },
    "תקשורת וחופש ביטוי": { about: "פיקוח על התקשורת", pro: "right" },
    "גיוס חרדים": { about: "גיוס חרדים", pro: "left" },
    "מימון ישיבות": { about: "מימון ישיבות", pro: "right" },
    "לימודי ליבה": { about: "חיוב לימודי ליבה", pro: "left" },
    "דת במרחב הציבורי": { about: "דת במרחב הציבורי", pro: "right" },
    "נישואים ומעמד אישי": { about: "נישואים אזרחיים", pro: "left" },
    "יוקר המחיה ומעורבות המדינה": { about: "מעורבות המדינה בכלכלה", pro: "left" },
    "קצבאות ורווחה": { about: "הרחבת הקצבאות", pro: "left" },
    "זכויות הקהילה הגאה": { about: "שוויון זכויות לקהילה הגאה", pro: "left" },
};

export type Scale = {
    /** the question over the scale */
    question: string;
    /** what the question is about, under it */
    about: string;
    /** the words at the scale's ends, the left's end and the right's */
    leftEnd: string;
    rightEnd: string;
    /** a place on the scale in words: -5 the left's end .. 5 the right's */
    reading: (value: number) => string;
    /** the scale's name for a screen reader */
    spoken: string;
};

const degree = (value: number) => (Math.abs(value) >= 5 ? "מאוד" : Math.abs(value) >= 3 ? "די" : "קצת");

/** the scale an article on this issue is placed on */
export function scaleFor(topic: string): Scale {
    const issue = ISSUES[topic];
    if (!issue) {
        return {
            question: "איך הכתבה הרגישה לך?",
            about: topic,
            leftEnd: "שמאל",
            rightEnd: "ימין",
            reading: (v) => (v === 0 ? "באמצע" : `נוטה ${degree(v)} ${v > 0 ? "ימינה" : "שמאלה"}`),
            spoken: "משמאל לימין",
        };
    }
    const word = (side: "right" | "left") => (issue.pro === side ? "בעד" : "נגד");
    return {
        question: "הכתבה בעד או נגד?",
        about: issue.about,
        leftEnd: word("left"),
        rightEnd: word("right"),
        reading: (v) => {
            if (v === 0) return "לא בעד ולא נגד";
            const stance = word(v > 0 ? "right" : "left");
            const how = degree(v);
            return how === "מאוד" ? `${stance} מאוד` : `${how} ${stance}`;
        },
        spoken: `${issue.about}: ${word("left")} משמאל, ${word("right")} מימין`,
    };
}
