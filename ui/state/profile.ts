import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_KEY = "reader_profile";

export type ReaderProfile = {
	/** declared score per topic, -5 (left) .. +5 (right) */
	positions: Record<string, number>;
	/** mean of the above */
	overall: number;
	bloc: "right" | "left";
	completedAt: number;
};

export type Question = {
	topic: string;        // must match a topic name in the database
	statement: string;
	/** +1 when agreeing is the right-bloc position, -1 when it is the left one */
	direction: 1 | -1;
};

/**
 * Eight statements, one per topic family, rather than all 22 topics. The point is
 * to place the reader on the same axes the outlets sit on - and a family profile
 * is what makes "you never read the other side on גיוס חרדים" possible to say.
 */
export const QUESTIONS: Question[] = [
	{ topic: "בנייה בהתנחלויות", direction: 1,
	  statement: "יש להרחיב את הבנייה בהתנחלויות ביהודה ושומרון" },
	{ topic: "שתי מדינות", direction: -1,
	  statement: "על ישראל להסכים להקמת מדינה פלסטינית לצדה" },
	{ topic: "כלכלה", direction: 1,
	  statement: "המדינה צריכה לצמצם את מעורבותה בכלכלה ולהפריט שירותים" },
	{ topic: "קצבאות לחלשים", direction: -1,
	  statement: "יש להרחיב משמעותית את קצבאות הרווחה" },
	{ topic: "לימודי ליבה", direction: -1,
	  statement: "יש לחייב לימודי ליבה בכל מוסדות החינוך, כולל החרדיים" },
	{ topic: "נישואים אזרחיים", direction: -1,
	  statement: "יש לאפשר נישואים אזרחיים בישראל" },
	{ topic: "עצמאות שיפוטית", direction: 1,
	  statement: "יש לצמצם את סמכות בית המשפט העליון לבטל חוקים" },
	{ topic: "נישואים חד מיניים", direction: -1,
	  statement: "המדינה צריכה להכיר בנישואים חד-מיניים" },
];

/** 5-point scale, in the order it is drawn on screen */
export const SCALE = [
	{ label: "מתנגד\nבתוקף", value: -5 },
	{ label: "נוטה\nלהתנגד", value: -2.5 },
	{ label: "אין לי\nעמדה", value: 0 },
	{ label: "נוטה\nלתמוך", value: 2.5 },
	{ label: "תומך\nבתוקף", value: 5 },
];

export function buildProfile(answers: Record<string, number>): ReaderProfile {
	const positions: Record<string, number> = {};
	QUESTIONS.forEach((q) => {
		const raw = answers[q.topic];
		if (raw !== undefined) positions[q.topic] = raw * q.direction;
	});
	const values = Object.values(positions);
	const overall = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
	return {
		positions,
		overall: Math.round(overall * 100) / 100,
		bloc: overall >= 0 ? "right" : "left",   // same zero breaking point as the server
		completedAt: Date.now(),
	};
}

export async function saveProfile(profile: ReaderProfile) {
	try {
		await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
	} catch (err) {
		console.log("Error saving profile:", err);
	}
}

export async function getProfile(): Promise<ReaderProfile | null> {
	try {
		const raw = await AsyncStorage.getItem(PROFILE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export async function clearProfile() {
	await AsyncStorage.removeItem(PROFILE_KEY);
}
