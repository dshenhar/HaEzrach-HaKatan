/**
 * Names the search treats as one: a search for any of a group finds all of it.
 * Written by hand - no model is asked - and meant to be read and changed by hand.
 *
 * A term is one word or a few; a word ending in * is a stem, which also catches the
 * words that start with it ("התנחל*" is התנחלות, התנחלויות, להתנחל). Gershayim and
 * apostrophes may be written either way, and the search takes them out anyway.
 *
 * The last part holds the pairs each side names the same thing by - the right's
 * word and the left's - so a search in one camp's words finds the other's too.
 */
export const ALIASES: string[][] = [
	// people, by nickname or by another spelling
	["ביבי", "נתניהו"],
	["בוז'י", "הרצוג"],
	["איווט", "ליברמן"],
	["בוגי", "יעלון"],
	["אבו מאזן", "עבאס"],
	["נסראללה", "נסרללה", "נצראללה"],
	["סינוואר", "סנוואר"],
	["חמינאי", "חאמנאי"],
	["ארדואן", "ארדוגן"],

	// institutions and titles, by their initials
	['בג"ץ', "בית המשפט העליון", "בית המשפט הגבוה לצדק"],
	['שב"כ', "שירות הביטחון הכללי", "שין בית"],
	['צה"ל', "צבא הגנה לישראל"],
	['רמטכ"ל', "ראש המטה הכללי"],
	['יועמ"ש*', "היועץ המשפטי לממשלה", "היועצת המשפטית לממשלה"],
	['רה"מ', "ראש הממשלה"],
	['שהב"ט', "שר הביטחון"],
	['ח"כ', "חבר הכנסת", "חברת הכנסת"],
	['או"ם', "האומות המאוחדות"],
	['ארה"ב', "ארצות הברית"],
	['רש"פ', "הרשות הפלסטינית"],
	['אש"ף', "ארגון השחרור הפלסטיני"],
	['פצ"ר*', "הפרקליט הצבאי הראשי", "הפרקליטה הצבאית הראשית"],
	['מח"ש', "המחלקה לחקירות שוטרים"],
	['מל"ל', "המטה לביטחון לאומי"],
	['ת"א', "תל אביב"],
	['ב"ש', "באר שבע"],
	["7 באוקטובר", "שבעה באוקטובר"],

	// one thing, each camp's name for it
	['יו"ש', "יהודה ושומרון", "הגדה המערבית", "השטחים"],
	["הר הבית", "אל אקצא"],
	["רפורמה משפטית", "הפיכה משטרית", "מהפכה משפטית"],
	["התנחל*", "התיישב*"],
	["מתנחל*", "מתיישב*"],
	["סיפוח", "החלת ריבונות"],
	["חוק הגיוס", "חוק ההשתמטות", "חוק הפטור"],
];
