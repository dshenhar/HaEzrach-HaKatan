import { getWatches, NewsItem, SitePosition, WatchingEvent } from "./engagement";
import { ReaderProfile } from "./profile";

export type Insights = {
	totalRead: number;
	/** share of reading that came from the reader's own bloc, 0..1 */
	captive: number;
	inOwnBloc: number;
	inOtherBloc: number;
	/** how many articles came from each bloc */
	byBloc: { right: number; left: number };
	topicsRead: { topic: string; count: number }[];
	/** outlets the reader has not opened in over a month, from the other bloc first */
	unreadOutlets: string[];
	/** topics read only from one side */
	oneSidedTopics: { topic: string; onlyBloc: "right" | "left"; count: number }[];
	/** topics that exist in the feed but the reader never opened */
	untouchedTopics: string[];
	/** stories the reader never opened, the other bloc's first */
	missedStories: { title: string; source: string; topic: string; bloc: string }[];
};

const MONTH = 30 * 24 * 60 * 60 * 1000;

export async function buildInsights(
	profile: ReaderProfile,
	positions: Record<string, SitePosition>,
	feed: NewsItem[][] = [],
): Promise<Insights> {
	const watches: WatchingEvent[] = await getWatches();

	const byBloc = { right: 0, left: 0 };
	const topicCounts = new Map<string, number>();
	const topicBlocs = new Map<string, Set<string>>();
	const seenSites = new Map<string, number>();

	watches.forEach((w) => {
		const bloc = positions[w.site]?.bloc;
		if (bloc === "right" || bloc === "left") byBloc[bloc] += 1;

		topicCounts.set(w.topic, (topicCounts.get(w.topic) || 0) + 1);
		if (bloc === "right" || bloc === "left") {
			if (!topicBlocs.has(w.topic)) topicBlocs.set(w.topic, new Set());
			topicBlocs.get(w.topic)!.add(bloc);
		}
		seenSites.set(w.site, Math.max(seenSites.get(w.site) || 0, w.date));
	});

	const totalBlocced = byBloc.right + byBloc.left;
	const inOwnBloc = byBloc[profile.bloc];
	const inOtherBloc = totalBlocced - inOwnBloc;

	const cutoff = Date.now() - MONTH;
	const unreadOutlets = Object.values(positions)
		.filter((p) => {
			const last = seenSites.get(p.source);
			return last === undefined || last < cutoff;
		})
		// the other bloc first: those are the ones worth surfacing
		.sort((a, b) => Number(a.bloc === profile.bloc) - Number(b.bloc === profile.bloc))
		.map((p) => p.source);

	const oneSidedTopics = Array.from(topicBlocs.entries())
		.filter(([, blocs]) => blocs.size === 1)
		.map(([topic, blocs]) => ({
			topic,
			onlyBloc: Array.from(blocs)[0] as "right" | "left",
			count: topicCounts.get(topic) || 0,
		}))
		.sort((a, b) => b.count - a.count);

	// a story counts as read if any of its articles was opened
	const readIds = new Set(watches.map((w) => w.id));
	const otherBloc = profile.bloc === "right" ? "left" : "right";
	const missedStories = feed
		.filter((cluster) => cluster.every((a) => !readIds.has(a.id)))
		.map((cluster) => {
			// show it through an outlet from the bloc the reader avoids, when one covered it
			const fromOther = cluster.find((a) => positions[a.source]?.bloc === otherBloc);
			const pick = fromOther ?? cluster[0];
			return {
				title: pick.title,
				source: pick.source,
				topic: pick.topic,
				bloc: positions[pick.source]?.bloc ?? "unknown",
			};
		})
		// the other bloc's stories first: those are the ones worth surfacing
		.sort((a, b) => Number(a.bloc !== otherBloc) - Number(b.bloc !== otherBloc));

	const feedTopics = new Set(feed.flatMap((c) => c.map((a) => a.topic)).filter(Boolean));
	const untouchedTopics = Array.from(feedTopics).filter((t) => !topicCounts.has(t));

	return {
		untouchedTopics,
		missedStories,
		totalRead: watches.length,
		captive: totalBlocced ? inOwnBloc / totalBlocced : 0,
		inOwnBloc,
		inOtherBloc,
		byBloc,
		topicsRead: Array.from(topicCounts.entries())
			.map(([topic, count]) => ({ topic, count }))
			.sort((a, b) => b.count - a.count),
		unreadOutlets,
		oneSidedTopics,
	};
}
