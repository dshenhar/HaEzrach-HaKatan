import { NewsItem, Bloc, SitePosition, getBlocSummary, storySummaries } from '@/state/engagement';
import { track } from '@/state/analytics';
import { ELEVATION, TYPE } from '@/state/craft';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Data encoding for the bloc mode only. These two are deliberately absent from
// every other screen: the point of "האזרח הקטן" is that the colours go away.
const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";

type Side = "right" | "left";

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    onOpenArticle: (item: NewsItem) => void;
}

/**
 * The story as two blocs, side by side: who told it on the right, who on the left.
 *
 * Each side leads with a line on how that side told it - written by the server
 * before anyone asked, and there for every reader without a touch. Under it, closed,
 * a side is a list of names: enough to see the shape of the coverage, and short
 * enough that nine outlets no longer run the card off the screen. Touch a side and
 * every outlet's own headline opens under the summary, which stays where it was.
 */
const BlocView = ({ data, positions, onOpenArticle }: Props) => {
    const { right, left, unaligned } = useMemo(() => {
        const buckets: Record<string, NewsItem[]> = { right: [], left: [], unaligned: [] };
        data.forEach((item) => {
            const bloc: Bloc = positions[item.source]?.bloc ?? "unknown";
            buckets[bloc === "right" || bloc === "left" ? bloc : "unaligned"].push(item);
        });
        return { right: buckets.right, left: buckets.left, unaligned: buckets.unaligned };
    }, [data, positions]);

    const storyId = data[0]?.groupId;
    const [openSide, setOpenSide] = useState<Side | null>(null);
    // The feed carries the summaries. A story that changed after the last pass can
    // arrive without one, and then it is fetched here at once, as the side shows -
    // the server writes it and keeps it for the next reader.
    const carried = useMemo(() => storySummaries(data), [data]);
    // undefined: on its way. null: none came back.
    const [fetched, setFetched] = useState<Partial<Record<Side, string | null>>>({});
    const needs = (side: Side) => (side === "right" ? right : left).length > 0 && !carried[side];
    const wantRight = needs("right");
    const wantLeft = needs("left");
    useEffect(() => {
        if (storyId === undefined) return;
        let live = true;
        (["right", "left"] as Side[]).forEach((side) => {
            if (side === "right" ? !wantRight : !wantLeft) return;
            getBlocSummary(storyId, side).then((text) => {
                if (live) setFetched((current) => ({ ...current, [side]: text }));
            });
        });
        return () => { live = false; };
    }, [storyId, wantRight, wantLeft]);

    const column = (items: NewsItem[], side: Side, label: string, ink: string, soft: string) => {
        const open = openSide === side;
        const summary = carried[side] ?? fetched[side];
        return (
            <Pressable
                style={[styles.col, { backgroundColor: soft }, open && styles.colOpen]}
                onPress={() => {
                    if (!open) track("bloc_side_opened", { side, outlets: items.length });
                    setOpenSide(open ? null : side);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${items.length} גופים`}
            >
                <View style={styles.colHead}>
                    <Text style={[styles.colLabel, { color: ink }]}>{label}</Text>
                    <Text style={styles.colCount}>{items.length}</Text>
                </View>

                {items.length === 0 ? (
                    <Text style={styles.empty}>אף גוף מהצד הזה לא סיקר</Text>
                ) : (
                    <>
                        {summary ? (
                            <View style={styles.aiBox}>
                                <Text style={styles.aiLabel}>סיכום AI</Text>
                                <Text style={styles.aiText}>{summary}</Text>
                            </View>
                        ) : summary === undefined ? (
                            <Text style={styles.aiWaiting}>מכין סיכום…</Text>
                        ) : null}

                        {items.map((item) => (
                            <Press
                                key={item.id}
                                onPress={() => (open ? onOpenArticle(item) : setOpenSide(side))}
                                style={styles.outletBlock}
                            >
                                <View style={styles.outletRow}>
                                    <View style={[styles.dot, { backgroundColor: ink }]} />
                                    <Text style={[styles.outlet, { color: ink }]} numberOfLines={1}>
                                        {item.source}
                                    </Text>
                                </View>
                                {open && (
                                    <Text style={styles.headline} numberOfLines={3}>{item.title}</Text>
                                )}
                            </Press>
                        ))}
                    </>
                )}
            </Pressable>
        );
    };

    return (
        <View>
            <View style={styles.split}>
                {column(right, "right", "ימין", RIGHT, RIGHT_SOFT)}
                {column(left, "left", "שמאל", LEFT, LEFT_SOFT)}
            </View>

            {unaligned.length > 0 && (
                <View style={styles.unaligned}>
                    <Text style={styles.unalignedTitle}>
                        {unaligned.length} גופי חדשות לא נכנסו לאף גוש
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {unaligned.map((item) => (
                            <Press key={item.id} style={styles.pill} onPress={() => onOpenArticle(item)}>
                                <Text style={styles.pillText}>{item.source}</Text>
                            </Press>
                        ))}
                    </ScrollView>
                    <Text style={styles.unalignedNote}>
                        בתצוגה הגושית הם לא מופיעים. זו הנקודה.
                    </Text>
                </View>
            )}
        </View>
    );
};

export default BlocView;

const styles = StyleSheet.create({
    // row-reverse puts the first column - the right bloc - on the right
    split: { flexDirection: "row-reverse", gap: 8, alignItems: "flex-start" },
    col: { flex: 1, borderRadius: 10, padding: 11, gap: 7 },
    colOpen: { borderWidth: 1, borderColor: "rgba(17,24,39,0.10)" },
    colHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "baseline" },
    colLabel: { fontFamily: "Heebo_800ExtraBold", fontSize: 13.5, letterSpacing: -0.1 },
    colCount: {
        fontFamily: "Heebo_700Bold", fontSize: 11, letterSpacing: 0.1, color: "#6B7280",
        fontVariant: ["tabular-nums"],
    },

    // the summary sits on the side's own colour as a white slip, the first thing in
    // the box: it is how that side told the story, before who told it
    aiBox: {
        backgroundColor: "#FFFFFF", borderRadius: 8, padding: 9, gap: 3,
        boxShadow: ELEVATION.rest,
    },
    aiLabel: {
        fontFamily: "Heebo_700Bold", fontSize: 9.5, letterSpacing: 0.3,
        color: "#9A9A95", textAlign: "right",
    },
    aiText: {
        fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 17,
        color: "#111827", textAlign: "right",
    },
    aiWaiting: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#9A9A95", textAlign: "right" },

    outletBlock: { gap: 2 },
    outletRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    outlet: {
        fontFamily: "Heebo_700Bold", fontSize: 11.5, letterSpacing: 0.05,
        flex: 1, textAlign: "right",
    },
    headline: {
        fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 17,
        letterSpacing: 0.05, color: "#111827", textAlign: "right", paddingRight: 13,
    },
    empty: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", lineHeight: 16 },

    unaligned: { backgroundColor: "#F4F4F3", borderRadius: 10, padding: 11, marginTop: 8, gap: 7 },
    unalignedTitle: {
        fontFamily: "Heebo_700Bold", fontSize: 12, color: "#111827", textAlign: "right",
    },
    unalignedNote: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", textAlign: "right" },
    pill: {
        backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#E3E3E1",
        paddingHorizontal: 11, paddingVertical: 5, marginLeft: 6,
    },
    pillText: { fontFamily: "Heebo_700Bold", fontSize: 11, color: "#111827" },
});
