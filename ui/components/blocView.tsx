import { NewsItem, getBlocSummary, storySummaries } from '@/state/engagement';
import { TYPE } from '@/state/craft';
import { useTheme } from '@/state/theme';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

type Props = {
    data: NewsItem[];
    onOpenArticle: (item: NewsItem) => void;
}

/**
 * General news - a storm, a road accident, a rescued dog - has no two sides to be
 * told from, so it is not split into any: one line on the story as every outlet
 * told it, and under it each outlet with its own headline.
 */
export const AllView = ({ data, onOpenArticle }: Props) => {
    const t = useTheme();
    const summary = useSummaries(data, ["all"]);
    const line = summary("all");
    return (
        <View style={[styles.wrap, styles.page]}>
            {line ? (
                <View style={[styles.summary, styles.summaryPlain, { backgroundColor: t.surface }]}>
                    <Text style={[styles.summaryLabel, { color: t.textMuted }]}>נקודת מבט</Text>
                    <Text style={[styles.summaryText, { color: t.text }]}>{line}</Text>
                </View>
            ) : line === undefined ? (
                <Text style={[styles.waiting, { color: t.textMuted }]}>מכין סיכום…</Text>
            ) : null}
            {data.map((item) => (
                <Press key={item.id} onPress={() => onOpenArticle(item)} scale={0.98}
                    style={[styles.outlet, { backgroundColor: t.surface }]} accessibilityRole="link"
                    accessibilityLabel={`${item.source}: ${item.title}`}>
                    <Text style={[styles.outletName, { color: t.text }]} numberOfLines={1}>{item.source}</Text>
                    <Text style={[styles.outletTitle, { color: t.text }]} numberOfLines={3}>{item.title}</Text>
                </Press>
            ))}
        </View>
    );
};


// general news is set on the card's own ground, its slips white
const styles = StyleSheet.create({
    wrap: { marginTop: 10, gap: 8 },
    page: { gap: 8 },
    summary: { gap: 3 },
    summaryPlain: { borderRadius: 10, padding: 11 },
    summaryLabel: { ...TYPE.micro, textAlign: "right" },
    summaryText: { ...TYPE.body, fontSize: 14, lineHeight: 21, textAlign: "right" },
    waiting: { ...TYPE.caption, textAlign: "right" },
    outlet: { borderRadius: 10, padding: 10, gap: 2 },
    outletName: { ...TYPE.label, textAlign: "right" },
    outletTitle: { ...TYPE.body, textAlign: "right" },
});
