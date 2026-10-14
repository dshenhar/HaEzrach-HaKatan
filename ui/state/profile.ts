import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_KEY = "reader_profile";

/** where readers put themselves: -2 the left .. 2 the right, 0 the middle */
export type Placement = -2 | -1 | 0 | 1 | 2;

export type ReaderProfile = {
	/** where the reader put themselves; null when they would rather not say.
	 *  Absent from a profile made by the old questionnaire. */
	placement?: Placement | null;
	/** the outlets the reader says they read - what "your outlets did not cover
	 *  this" is measured against. Absent until they were asked. */
	outlets?: string[];
	/** right or left - from where they put themselves, or else from the outlets
	 *  they read; null when neither says */
	bloc: "right" | "left" | null;
	/** the old questionnaire's answers, per topic, -5 (left) .. +5 (right), kept for
	 *  a reader who filled that one */
	positions?: Record<string, number>;
	overall?: number;
	completedAt: number;
};

/**
 * One question, five answers and a way out. The point is only to put the reader
 * on one side or the other, however roughly: every number on the analytics page is
 * "compared with your side", and a long questionnaire is one most people leave
 * half way. In the order it is drawn, the right first, as the app reads.
 */
export const PLACEMENTS: { value: Placement; label: string }[] = [
	{ value: 2, label: "ימין" },
	{ value: 1, label: "נוטה ימינה" },
	{ value: 0, label: "באמצע" },
	{ value: -1, label: "נוטה שמאלה" },
	{ value: -2, label: "שמאל" },
];

export const placementLabel = (placement?: Placement | null) =>
	PLACEMENTS.find((p) => p.value === placement)?.label ?? null;

/**
 * The reader's side: where they put themselves, and for one in the middle or who
 * would rather not say, where the outlets they read stand on average - what a
 * person reads says something about where they are. null when neither says.
 */
export function blocOf(placement: Placement | null | undefined, outlets: string[],
	positions: Record<string, { bias: number | null }>): "right" | "left" | null {
	if (placement) return placement > 0 ? "right" : "left";
	const biases = outlets.map((o) => positions[o]?.bias).filter((b): b is number => typeof b === "number");
	if (biases.length === 0) return null;
	const mean = biases.reduce((a, b) => a + b, 0) / biases.length;
	return mean > 0 ? "right" : mean < 0 ? "left" : null;
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


// The questionnaire is an offer, not a gate: the app opens without it. These
// remember whether the offer was already made once, whether the reader asked not
// to be asked again, and - for a reader who answered the old questionnaire, which
// had no outlets in it - whether they were asked once for the outlets they read.
const WELCOMED_KEY = "questionnaire_welcomed";
const NUDGE_OFF_KEY = "questionnaire_nudge_off";
const OUTLETS_ASKED_KEY = "outlets_asked";

const flag = async (key: string) => (await AsyncStorage.getItem(key).catch(() => null)) === "1";
const raise = (key: string) => { AsyncStorage.setItem(key, "1").catch(() => {}); };

export const wasWelcomed = () => flag(WELCOMED_KEY);
export const markWelcomed = () => raise(WELCOMED_KEY);
export const isNudgeOff = () => flag(NUDGE_OFF_KEY);
export const stopNudging = () => raise(NUDGE_OFF_KEY);
export const wereOutletsAsked = () => flag(OUTLETS_ASKED_KEY);
export const markOutletsAsked = () => raise(OUTLETS_ASKED_KEY);
