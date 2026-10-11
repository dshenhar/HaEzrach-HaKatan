/**
 * One screen asking another to open something and bring it into view: a story in
 * the feed (a hot topic's link, a search result) or an affair on the hot topics
 * page (a search result). A request waits here until its screen takes it, so it
 * holds even when that screen has not been mounted yet or has not loaded.
 */
export type FocusRequest = {
	id: string;
	/** what asked, for the analytics: "hot_topic", "search" */
	how: string;
};
type Listener = () => void;

function channel() {
	let pending: FocusRequest | null = null;
	const listeners = new Set<Listener>();
	return {
		ask(request: FocusRequest) {
			pending = request;
			listeners.forEach((listener) => listener());
		},
		/** the request waiting, if any; taking it clears it */
		take(): FocusRequest | null {
			const request = pending;
			pending = null;
			return request;
		},
		on(listener: Listener): () => void {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
	};
}

const stories = channel();
export const requestStory = (id: string, how = "hot_topic") => stories.ask({ id, how });
export const takeStoryRequest = stories.take;
export const onStoryRequest = stories.on;

const topics = channel();
export const requestTopic = (id: string, how = "search") => topics.ask({ id, how });
export const takeTopicRequest = topics.take;
export const onTopicRequest = topics.on;
