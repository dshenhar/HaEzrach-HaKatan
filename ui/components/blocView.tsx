import { NewsItem, getBlocSummary, storySummaries } from '@/state/engagement';
import { useEffect, useMemo, useState } from 'react';

export type Which = "right" | "left" | "all";

/**
 * A story's summaries. The feed carries them; a story that changed after the last
 * pass can arrive without one, and then it is fetched at once, as the story opens -
 * the server writes it and keeps it for the next reader.
 *
 * undefined: on its way. null: none came back.
 */
export function useSummaries(data: NewsItem[], wanted: Which[]) {
    const storyId = data[0]?.groupId;
    const carried = useMemo(() => storySummaries(data), [data]);
    const [fetched, setFetched] = useState<Partial<Record<Which, string | null>>>({});
    const missing = wanted.filter((which) => !carried[which]).join(",");
    useEffect(() => {
        if (storyId === undefined || !missing) return;
        let live = true;
        (missing.split(",") as Which[]).forEach((which) => {
            getBlocSummary(storyId, which).then((text) => {
                if (live) setFetched((current) => ({ ...current, [which]: text }));
            });
        });
        return () => { live = false; };
    }, [storyId, missing]);
    return (which: Which) => carried[which] ?? fetched[which];
}
