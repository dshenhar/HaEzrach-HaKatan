import AsyncStorage from "@react-native-async-storage/async-storage"

export type CompanyItem =  {
	source: string;
	text?: string;
	ranks?: number[];
}

export type NewsItem = {
	id: string;
	title: string;
	source: string;
	time: string;
	summary: string;
	biasScore: number; // -5 to 5 scale
	siteBiasScore: number;
	category: string;
	topic: string;
	link: string;
	groupId?: string;
	imageUrl?: string;
}

export type RatingEvent = {
	id: string;           // news item id
	source: string;       // source name
	topic: string;        // ideological topic key
	value: number;        // -5 .. 5
	createdAt: number;
};

export type WatchingEvent = {
	id: string;
	site: string;
	topic: string;
	date: number;
};

const RATINGS_KEY = "ratings_events";
interface companyRank {
	ranks: Record<string, Record<string, number>>
}

const WATCHES_KEY = "watching_events";
const AGG_KEY = "source_scores"; // { [source]: { [topic]: { sum, count, avg } } }
const EXPOSURE_KEY = "exposure-pref";
const NOTIFICATIN_KEY = "notification-pref";
export const URL_BASE = process.env.EXPO_PUBLIC_URL_BASE;

export const fetchArticles = async (setArticles: React.Dispatch<React.SetStateAction<Array<NewsItem[]>>>) => {
	try {
		const res = await fetch(`${URL_BASE}/feed`);
		const data: Array<NewsItem[]> = await res.json();
		setArticles(data);
	} catch (err) {
		console.error("Error fetching articles:", err);
		const temp = [
			[{
				id: "1",
				title: "FAILED TO LOAD ARTICLES\nrefresh to try again",
				source: "SERVER",
				time: "time",
				summary: "nothing to see here",
				biasScore: -1, // -5 to 5 scale
				siteBiasScore: 5,
				category: "fail",
				topic: "fail",
				link: "",
				groupId: "1"
			}]
		]
		setArticles(temp);
	}
}

export const fetchArticleBypass = async () => {

}

export const saveProfilePreference = async (key: string, value: string) => {
	try {
		await AsyncStorage.setItem(key, value);
	} catch (err) {
		console.log(err);
	}
}

export async function saveWatch(e: WatchingEvent) {
	try {
		const watches: WatchingEvent[] = JSON.parse(await AsyncStorage.getItem(WATCHES_KEY) || "[]");
		let found = false;
		for (let i = 0; i < watches.length; i++) {
			if (watches[i].id === e.id && watches[i].site === e.site) {
				found = true;
				break;
			}
		}
		if (found) {
			return;
		}
		watches.push(e);
		console.log("added new watch, watches: ", watches);
		await AsyncStorage.setItem(WATCHES_KEY, JSON.stringify(watches));
	} catch(err) {
		console.log(err);
	}
}

export async function saveRating(e: RatingEvent) {
	try {
		// const events: RatingEvent[] = JSON.parse(await AsyncStorage.getItem(RATINGS_KEY) || "[]");
		// console.log("rating before:", events);
		// let found = false;
		// let prevRate = 0;
		// for (let i = 0; i < events.length; i++) {
		// 	if (events[i].id === e.id) {
		// 		prevRate = events[i].value;
		// 		events[i] = e;
		// 		found = true;
		// 		break;
		// 	}
		// }
		// if (!found) {
		// 	events.push(e);
		// }
		// console.log("rating after:", events);
		// await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(events));

		// const agg = JSON.parse(await AsyncStorage.getItem(AGG_KEY) || "{}");
		// const bySource = agg[e.source] || {};
		// const curr = bySource[e.topic] || { sum: 0, count: 0, avg: 0 };
		// const sum = curr.sum + e.value - prevRate;
		// const count = found ? curr.count : curr.count + 1;
		// bySource[e.topic] = { sum, count, avg: sum / count };
		// agg[e.source] = bySource;
		// AsyncStorage.setItem(AGG_KEY, JSON.stringify(agg))
		// console.log("aggs:", agg)
		// // localStorage.clear()
		const id = e.id.split("-")[1];
		console.log("id:", id)
		const res = fetch(`${URL_BASE}/articles/${id}/vote`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ value: e.value })
		})
		console.log(res)
	} catch(err) {
		console.log(err)
	}
}

export const getProfilePreferences = async (key: string, setVal: (value: React.SetStateAction<boolean>) => void) => {
	try {
		const stored = await AsyncStorage.getItem(key);
		if (stored !== null) {
			setVal(stored === "true");
		}
	} catch (err) {
		console.log("Error reading AsyncStorage", err);
	}
};

export async function getRanks() {
	try {
		const res = await fetch(`${URL_BASE}/ranks`);
		const data: companyRank = await res.json()
		return data;
	} catch (err) {
		console.log("Error fetching ranks:", err);
		return {}
	}
}

export async function getAggs() {
	try {
		return JSON.parse(await AsyncStorage.getItem(AGG_KEY) || "{}");
	} catch {
		return {};
	}
}

export async function getWatches() {
	try {
		return JSON.parse(await AsyncStorage.getItem(WATCHES_KEY) || "[]")
	} catch {
		return [];
	}
}

export async function getEvents() {
	try {
		return JSON.parse(await AsyncStorage.getItem(RATINGS_KEY) || "[]");
	} catch {
		return [];
	}
}

export function clearAllRatings() {
	AsyncStorage.removeItem(RATINGS_KEY);
	AsyncStorage.removeItem(AGG_KEY);
	AsyncStorage.removeItem(WATCHES_KEY);
	// AsyncStorage.setItem(EXPOSURE_KEY, "true");
	// AsyncStorage.setItem(NOTIFICATIN_KEY, "false");
}
