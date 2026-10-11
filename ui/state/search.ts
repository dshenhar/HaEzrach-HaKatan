import { NewsItem } from "./engagement";
import { HotTopic } from "./hotTopics";
import { ALIASES } from "./searchAliases";

/**
 * Searching the app: today's feed and the hot topics, in the reader's own phone -
 * both are already loaded, so there is nothing to ask a server.
 *
 * Every word of the query has to be found somewhere in what is searched, and a word
 * found in the name counts for more than one found in the text under it. An affair
 * whose name has none of the words only mentions them, and is told apart from one
 * that is about them: the pool's texts are long, and a name like Netanyahu's is in
 * a third of them.
 *
 * A word is looked for where a word starts, after any of the letters Hebrew glues
 * to its front - ו, ה, ב, ל, מ, ש, כ - so "גיוס" finds "הגיוס" and "גיוסים" and
 * not the middle of another word. A query word that starts with one of those
 * letters is also tried without it, but then only as a word standing on its own or
 * after ה: "בעזה" finds "עזה" and "בגיוס" finds "הגיוס", while "ביבי" finds neither
 * "יבי" in "תקציבי" nor the heart in "מדם ליבי". Niqqud and the gershayim are taken
 * out, so צה"ל finds צה״ל and צהל.
 *
 * A name in the list of aliases (searchAliases.ts) finds the rest of its group as
 * well: "ביבי" finds "נתניהו", בג"ץ finds "בית המשפט העליון", "התנחלויות" finds
 * "התיישבות". The others are found as whole words, so ת"א does not find "תאונה".
 */

export const MIN_QUERY = 2;
const STORIES_SHOWN = 40;

const PREFIXES = "ובהלמשכ";

export function normalise(text: string): string {
	return text
		.toLowerCase()
		.replace(/[\u0591-\u05C7]/g, "")
		.replace(/["'`״׳]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const START = "(?:^| )";
const PREFIXED = `[${PREFIXES}]{0,3}`;

/** a word of a term, where a word starts, after any prefixes - and when it starts
 *  with the article, also without it, as after ב, ל or כ Hebrew drops it: "בגדה" */
const termWord = (word: string) => PREFIXED +
	(word.length > 2 && word[0] === "ה" ? `ה?${escape(word.slice(1))}` : escape(word));

/** a term as a pattern; a stem then goes on into whatever word it starts, and
 *  anything else ends where the term does */
const termPattern = (term: string, stem: boolean) => new RegExp(
	START + term.split(" ").map(termWord).join(" ") + (stem ? "" : "(?: |$)"));

const GROUPS = ALIASES.map((group) => group.map((raw) => {
	const stem = raw.endsWith("*");
	const text = normalise(raw);
	return { raw: raw.replace(/\*$/, ""), text, stem, pattern: termPattern(text, stem) };
}));
// the terms of more than one word, the longest first: in a query, "בית המשפט העליון"
// is one thing and not three words
const PHRASES = GROUPS.flatMap((terms, group) => terms
	.filter((term) => term.text.includes(" "))
	.map((term) => ({ group, words: term.text.split(" ").length, pattern: termPattern(term.text, false) })))
	.sort((a, b) => b.words - a.words);

/** the alias group a single query word belongs to, if any, and whether the word is
 *  itself one of the group's whole words */
function aliasOf(word: string): { group: number; exact: boolean } | null {
	for (let group = 0; group < GROUPS.length; group++) {
		for (const term of GROUPS[group]) {
			if (term.text.includes(" ")) continue;
			if (term.stem ? word.startsWith(term.text) : word === term.text) {
				return { group, exact: !term.stem };
			}
		}
	}
	return null;
}

/** the query's words, each as the patterns it may be found by in a normalised text,
 *  and the alias groups the query called up */
function parse(query: string): { words: RegExp[][]; groups: number[] } {
	const words: RegExp[][] = [];
	const groups: number[] = [];
	const called = (group: number) => {
		groups.push(group);
		return GROUPS[group].map((term) => term.pattern);
	};
	let rest = normalise(query);
	for (const phrase of PHRASES) {
		if (!groups.includes(phrase.group) && phrase.pattern.test(rest)) {
			words.push(called(phrase.group));
			rest = rest.replace(phrase.pattern, " ");
		}
	}
	for (const word of rest.split(" ").filter(Boolean)) {
		const alias = aliasOf(word);
		// a name of the list is a whole word: ת"א is Tel Aviv and not the start of "תאונה"
		const forms = alias?.exact ? [] : [new RegExp(START + PREFIXED + escape(word))];
		// tried without its first letter as if that were a prefix, it must stand as a
		// word on its own: after the article if the letter was another prefix, after any
		// prefix if it was the article ("הגיוס" finds "בגיוס")
		const bare = word.length > 3 && PREFIXES.includes(word[0]) ? word.slice(1) : null;
		if (bare) {
			const before = word[0] === "ה" ? PREFIXED : "ה?";
			forms.push(new RegExp(`${START}${before}${escape(bare)}(?: |$)`));
		}
		const group = alias ?? (bare ? aliasOf(bare) : null);
		if (group) forms.push(...called(group.group));
		words.push(forms);
	}
	return { words, groups };
}

export const queryWords = (query: string): RegExp[][] => parse(query).words;

/** how well a name and a body answer the query, 0 when a word is in neither, and
 *  whether any of the words is in the name */
function score(words: RegExp[][], name: string, body: string): { score: number; named: boolean } {
	let total = 0;
	let named = false;
	for (const forms of words) {
		if (forms.some((form) => form.test(name))) { total += 3; named = true; }
		else if (forms.some((form) => form.test(body))) total += 1;
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
 * A text cut where the query's words are found in it, so they can be set apart -
 * the words as typed, and the aliases they called up, a gershayim or an apostrophe
 * written either way. It is enough for a headline: a word that only matched with its
 * prefix taken off is found and not marked.
 */
export function marked(text: string, query: string): { text: string; hit: boolean }[] {
	const aliases = parse(query).groups.flatMap((group) => GROUPS[group].map((term) => term.raw));
	const words = [...query.trim().split(/\s+/), ...aliases].filter((word) => word.length >= MIN_QUERY);
	if (words.length === 0) return [{ text, hit: false }];
	const escaped = words.map((word) => escape(word).replace(/["״]/g, '["״]').replace(/['׳]/g, "['׳]"));
	// split by a pattern that captures, every second part is what it matched
	const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
	return text.split(pattern)
		.map((part, i) => ({ text: part, hit: i % 2 === 1 }))
		.filter((part) => part.text);
}
