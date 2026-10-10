import { URL_BASE } from "./engagement";

/** how one bloc covers an affair, sees it, and why */
export type HotSide = { coverage: string; view: string; motives: string };
/** a story in today's feed that is about the affair */
export type HotLink = { id: string; title: string; outlets: number };

export type HotTopic = {
	id: string;
	title: string;
	one_line: string;
	summary: string;
	right: HotSide;
	left: HotSide;
	/** 1-10, how burning it is now */
	relevance: number;
	/** "high" when the score is high or the affair is in today's feed */
	tier: "high" | "low";
	status_date: string;
	links: HotLink[];
};

export type HotPage = { today: string[]; topics: HotTopic[] };

export async function loadHot(): Promise<HotPage | null> {
	try {
		const res = await fetch(`${URL_BASE}/hot`);
		if (!res.ok) return null;
		const data = await res.json();
		return { today: data.today ?? [], topics: data.topics ?? [] };
	} catch {
		return null;
	}
}

const HIGH_SHOWN = 3;
const LOW_SHOWN = 2;

const shuffled = <T,>(list: T[]): T[] => {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

// Drawn once a visit and kept: the page changes between visits, not between two
// looks at the tab, or a reader would lose the one they were in the middle of.
let drawn: string[] | null = null;

/**
 * The polarized five for this visit: three burning affairs and two quieter ones,
 * none of them already among today's. A tier too short to give its share is made
 * up from the other.
 */
export function polarFive(page: HotPage): HotTopic[] {
	const today = new Set(page.today);
	const rest = page.topics.filter((t) => !today.has(t.id));
	const byId = new Map(rest.map((t) => [t.id, t]));
	if (drawn && drawn.length && drawn.every((id) => byId.has(id))) {
		return drawn.map((id) => byId.get(id)!);
	}
	const high = shuffled(rest.filter((t) => t.tier === "high"));
	const low = shuffled(rest.filter((t) => t.tier !== "high"));
	let takeHigh = Math.min(HIGH_SHOWN, high.length);
	const takeLow = Math.min(HIGH_SHOWN + LOW_SHOWN - takeHigh, low.length);
	takeHigh = Math.min(HIGH_SHOWN + LOW_SHOWN - takeLow, high.length);
	const five = [...high.slice(0, takeHigh), ...low.slice(0, takeLow)];
	drawn = five.map((t) => t.id);
	return five;
}

/** how many more affairs one touch on "more topics" opens */
export const MORE_STEP = 5;

/**
 * The rest of the pool after the five, the most burning first: what "more topics"
 * opens, five at a time, until every affair is on the page.
 */
export function polarRest(page: HotPage, five: HotTopic[]): HotTopic[] {
	const shown = new Set([...page.today, ...five.map((t) => t.id)]);
	return page.topics.filter((t) => !shown.has(t.id)).sort((a, b) => b.relevance - a.relevance);
}
