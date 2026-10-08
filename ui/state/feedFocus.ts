/**
 * Another screen asking the feed to open one story and bring it into view - a hot
 * topic's link, today. The request waits here until the feed takes it, so it holds
 * even when the feed has not been mounted yet or has not loaded its stories.
 */
type Listener = (storyId: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function requestStory(storyId: string) {
	pending = storyId;
	listeners.forEach((listener) => listener(storyId));
}

/** the story asked for, if any; asking clears it */
export function takeStoryRequest(): string | null {
	const storyId = pending;
	pending = null;
	return storyId;
}

export function onStoryRequest(listener: Listener): () => void {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}
