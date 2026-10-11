import { NewsItem } from "./engagement";
import { HotTopic } from "./hotTopics";

/**
 * Searching the app: today's feed and the hot topics, in the reader's own phone -
 * both are already loaded, so there is nothing to ask a server.
 *
 * Every word of the query has to be found somewhere in what is searched, and a word
 * found in the name counts for more than one found in the text under it. An affair
 * whose name has none of the words only mentions them, and is told apart from one
 * that is about them: the pool's texts are long, and a name like Netanyahu's is in
 * a third of them. Hebrew
 * glues ו, ה, ב, ל, מ, ש and כ to the front of a word, so "בגיוס" also finds
 * "גיוס"; niqqud and the gershayim are taken out, so צה"ל finds צה״ל and צהל.
 */

export const MIN_QUERY = 2;
const STORIES_SHOWN = 40;

const PREFIXES = "ובהלמשכ";

export function normalise(text: string): string {
	return text
		.toLowerCase()
		.replace(/[֑-ׇ]/g, "")
		.replace(/["'`״׳]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

/** the query's words, each with the forms it may be found in */
export function queryWords(query: string): string[][] {
	return normalise(query).split(" ").filter(Boolean).map((word) =>
		word.length > 3 && PREFIXES.includes(word[0]) ? [word, word.slice(1)] : [word]);
}

/** how well a name and a body answer the query, 0 when a word is in neither, and
 *  whether any of the words is in the name */
function score(words: string[][], name: string, body: string): { score: number; named: boolean } {
	let total = 0;
	let named = false;
	for (const forms of words) {
		if (forms.some((form) => name.includes(form))) { total += 3; named = true; }
		else if (forms.some((form) => body.includes(form))) total += 1;
		else return { score: 0, named: false };
	}
	return { score: total, named };
}

export type Indexed<T> = { item: T; name: string; body: string };

/** a story is found by any outlet's headline, its lead, and its AI summaries */
export function indexStories(stories: NewsItem[][]): Indexed<NewsItem[]>[] {
	return stories.filter((story) => story.length > 0).map((story) => ({
		item: story,
		name: normalise(story[0].title ?? ""),
		body: normalise([
			...story.map((item) => `${item.title ?? ""} ${item.summary ?? ""}`),
			...Object.values(story[0].summaries ?? {}),
		].join(" ")),
	}));
}

export function indexTopics(topics: HotTopic[]): Indexed<HotTopic>[] {
	return topics.map((topic) => ({
		item: topic,
		name: normalise(topic.title),
		body: normalise([
			topic.one_line, topic.summary,
			...Object.values(topic.right ?? {}), ...Object.values(topic.left ?? {}),
		].join(" ")),
	}));
}

export type Results = {
	/** affairs with a word of the query in their name */
	topics: HotTopic[];
	stories: NewsItem[][];
	/** affairs that only mention the words */
	mentions: HotTopic[];
};

export function search(query: string, stories: Indexed<NewsItem[]>[], topics: Indexed<HotTopic>[]): Results {
	const words = queryWords(query);
	if (normalise(query).length < MIN_QUERY || words.length === 0) return { topics: [], stories: [], mentions: [] };
	const found = <T,>(list: Indexed<T>[], tie: (item: T) => number) => list
		.map((entry) => ({ item: entry.item, ...score(words, entry.name, entry.body) }))
		.filter((hit) => hit.score > 0)
		.sort((a, b) => b.score - a.score || tie(b.item) - tie(a.item));
	// the more burning affair first, and the story more outlets told
	const affairs = found(topics, (topic) => topic.relevance);
	return {
		topics: affairs.filter((hit) => hit.named).map((hit) => hit.item),
		stories: found(stories, (story) => story.length).slice(0, STORIES_SHOWN).map((hit) => hit.item),
		mentions: affairs.filter((hit) => !hit.named).map((hit) => hit.item),
	};
}

/**
 * A text cut where the query's words are found in it, so they can be set apart.
 * It looks for the words as typed, which is enough for a headline: a word that only
 * matched with its quotes or prefix taken off is found and not marked.
 */
export function marked(text: string, query: string): { text: string; hit: boolean }[] {
	const words = query.trim().split(/\s+/).filter((word) => word.length >= MIN_QUERY);
	if (words.length === 0) return [{ text, hit: false }];
	const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
	return text.split(pattern).filter(Boolean).map((part) => ({
		text: part,
		hit: words.some((word) => word.toLowerCase() === part.toLowerCase()),
	}));
}
