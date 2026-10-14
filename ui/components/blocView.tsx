import { NewsItem, SitePosition, getBlocSummary, sideOf, storySummaries } from '@/state/engagement';
import { track } from '@/state/analytics';
import { BLIND_INK, blindLabel } from '@/state/blindspot';
import { TYPE } from '@/state/craft';
import { useTheme } from '@/state/theme';
import BlocSwipe, { firstSide } from './blocSwipe';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Side = "right" | "left";
type Which = Side | "all";

/**
 * A story's summaries. The feed carries them; a story that changed after the last
 * pass can arrive without one, and then it is fetched at once, as the story opens -
 * the server writes it and keeps it for the next reader.
 *
 * undefined: on its way. null: none came back.
 */
function useSummaries(data: NewsItem[], wanted: Which[]) {
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
    positions: Record<string, SitePosition>;
    onOpenArticle: (item: NewsItem) => void;
    /** the side that did not tell the story at all, when one side told it loudly */
    missing?: Side | null;
    /** the reader's own side, which turns that into their side's blindspot */
    readerBloc?: string | null;
}

/**
 * A story on one of the issues the country argues over, as its two sides: the
 * headlines that fell on the right and those that fell on the left, each a page of
 * its own colour, swiped between. It opens on the side with more of them, and on a
 * coin when they are level. A headline is on the side its own words put it on -
 * the model's reading, and the readers' - whatever its outlet usually is.
 *
 * Each page leads with a line on how that side told it - written by the server
 * before anyone asked - and under it every outlet of that side with its own
 * headline, which opens the article.
 */
const BlocView = ({ data, positions, onOpenArticle, missing, readerBloc }: Props) => {
    const t = useTheme();
    const { right, left, unaligned } = useMemo(() => {
        const buckets: Record<string, NewsItem[]> = { right: [], left: [], unaligned: [] };
        // each headline on the side it fell on, not its outlet's
        data.forEach((item) => buckets[sideOf(item, positions) ?? "unaligned"].push(item));
        return { right: buckets.right, left: buckets.left, unaligned: buckets.unaligned };
    }, [data, positions]);
    const wanted = useMemo(() => (["right", "left"] as Side[])
        .filter((side) => (side === "right" ? right : left).length > 0), [right, left]);
    const summary = useSummaries(data, wanted);
    const [start] = useState(() => firstSide(right.length, left.length));

    const page = (items: NewsItem[], side: Side) => {
        if (items.length === 0) {
            return <Text style={styles.empty}>אף גוף מהצד הזה לא סיקר את הסיפור</Text>;
        }
        const line = summary(side);
        return (
            <View style={styles.page}>
                {line ? (
                    <View style={styles.summary}>
                        <Text style={styles.summaryLabel}>סיכום AI</Text>
                        <Text style={styles.summaryText}>{line}</Text>
                    </View>
                ) : line === undefined ? (
                    <Text style={styles.waiting}>מכין סיכום…</Text>
                ) : null}
                {items.map((item) => (
                    <Press key={item.id} onPress={() => onOpenArticle(item)} scale={0.98}
                        style={styles.outlet} accessibilityRole="link"
                        accessibilityLabel={`${item.source}: ${item.title}`}>
                        <Text style={styles.outletName} numberOfLines={1}>{item.source}</Text>
                        <Text style={styles.outletTitle} numberOfLines={3}>{item.title}</Text>
                    </Press>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.wrap}>
            {/* one side told it and the other did not: a count, said in plain words */}
            {!!missing && (
                <View style={styles.blind}>
                    <View style={[styles.blindDot, { backgroundColor: BLIND_INK[missing] }]} />
                    <Text style={[styles.blindText, { color: BLIND_INK[missing] }]}>
                        {blindLabel(missing, readerBloc)}
                    </Text>
                </View>
            )}
            <BlocSwipe
                start={start}
                right={page(right, "right")}
                left={page(left, "left")}
                rightNote={String(right.length)}
                leftNote={String(left.length)}
                onSide={(side) => track("bloc_side_opened", {
                    side, outlets: (side === "right" ? right : left).length,
                })}
            />

            {unaligned.length > 0 && (
                <View style={[styles.unaligned, { backgroundColor: t.surface }]}>
                    <Text style={[styles.unalignedTitle, { color: t.text }]}>
                        {unaligned.length === 1 ? "כותרת אחת שלא נוטה לאף צד"
                            : `${unaligned.length} כותרות שלא נוטות לאף צד`}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {unaligned.map((item) => (
                            <Press key={item.id} style={[styles.pill, { backgroundColor: t.surfaceAlt }]}
                                onPress={() => onOpenArticle(item)}>
                                <Text style={[styles.pillText, { color: t.text }]}>{item.source}</Text>
                            </Press>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

/**
 * General news - a storm, a road accident, a rescued dog - has no two sides to be
 * told from, so it is not split into any: one line on the story as every outlet
 * told it, and under it each outlet with its own headline.
 */
export const AllView = ({ data, onOpenArticle }: Omit<Props, "positions">) => {
    const t = useTheme();
    const summary = useSummaries(data, ["all"]);
    const line = summary("all");
    return (
        <View style={[styles.wrap, styles.page]}>
            {line ? (
                <View style={[styles.summary, styles.summaryPlain, { backgroundColor: t.surface }]}>
                    <Text style={[styles.summaryLabel, { color: t.textMuted }]}>סיכום AI</Text>
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

export default BlocView;

// on a side's page the words are white on its colour; general news is set on the
// card's own ground, its slips white
const styles = StyleSheet.create({
    wrap: { marginTop: 10, gap: 8 },
    page: { gap: 8 },
    summary: { gap: 3, paddingBottom: 4 },
    summaryPlain: { borderRadius: 10, padding: 11, paddingBottom: 11 },
    summaryLabel: { ...TYPE.micro, color: "rgba(255,255,255,0.78)", textAlign: "right" },
    summaryText: { ...TYPE.body, fontSize: 14, lineHeight: 21, color: "#FFFFFF", textAlign: "right" },
    waiting: { ...TYPE.caption, color: "rgba(255,255,255,0.8)", textAlign: "right" },
    outlet: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, padding: 10, gap: 2 },
    outletName: { ...TYPE.label, color: "#FFFFFF", textAlign: "right" },
    outletTitle: { ...TYPE.body, color: "#FFFFFF", textAlign: "right" },
    empty: { ...TYPE.body, color: "#FFFFFF", textAlign: "right" },

    blind: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    blindDot: { width: 7, height: 7, borderRadius: 4 },
    blindText: { ...TYPE.label },
    unaligned: { borderRadius: 10, padding: 11, gap: 7 },
    unalignedTitle: { ...TYPE.label, textAlign: "right" },
    pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginLeft: 6 },
    pillText: { fontFamily: "Rubik_700Bold", fontSize: 11 },
});
