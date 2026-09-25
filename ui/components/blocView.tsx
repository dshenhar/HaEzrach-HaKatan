import { NewsItem, Bloc, SitePosition, getBlocSummary } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
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
 * Closed, each side is a list of names - enough to see the shape of the coverage,
 * and short enough that nine outlets no longer run the card off the screen. Touch
 * a side and it opens: every outlet's own headline, and, if it is asked for, a
 * summary of how that side told it.
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
    // undefined: never asked for. null: asked, and none came back.
    const [summaries, setSummaries] = useState<Partial<Record<Side, string | null>>>({});
    const [asking, setAsking] = useState<Side | null>(null);

    const askSummary = async (side: Side) => {
        if (storyId === undefined || asking) return;
        setAsking(side);
        const text = await getBlocSummary(storyId, side);
        setSummaries((current) => ({ ...current, [side]: text }));
        setAsking(null);
    };

    const column = (items: NewsItem[], side: Side, label: string, ink: string, soft: string) => {
        const open = openSide === side;
        const summary = summaries[side];
        return (
            <Pressable
                style={[styles.col, { backgroundColor: soft }, open && styles.colOpen]}
                onPress={() => setOpenSide(open ? null : side)}
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
                        {open && (
                            summary === undefined ? (
                                <TouchableOpacity onPress={() => askSummary(side)} accessibilityRole="button">
                                    <Text style={styles.aiLink}>
                                        {asking === side ? "מייצר סיכום…" : "ייצר סיכום AI"}
                                    </Text>
                                </TouchableOpacity>
                            ) : summary ? (
                                <View style={styles.aiBox}>
                                    <Text style={styles.aiText}>{summary}</Text>
                                </View>
                            ) : (
                                <Text style={styles.aiNone}>אין סיכום לצד הזה כרגע</Text>
                            )
                        )}

                        {items.map((item) => (
                            <TouchableOpacity
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
                                    <Text style={styles.headline}>
                                        {item.title}
                                        <Text style={styles.jump}>{"  \u2196"}</Text>
                                    </Text>
                                )}
                            </TouchableOpacity>
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
                            <TouchableOpacity key={item.id} style={styles.pill} onPress={() => onOpenArticle(item)}>
                                <Text style={styles.pillText}>{item.source}</Text>
                            </TouchableOpacity>
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
    col: { flex: 1, borderRadius: 7, padding: 10, gap: 7 },
    colOpen: { borderWidth: 1, borderColor: "rgba(17,24,39,0.12)" },
    colHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "baseline" },
    colLabel: { fontFamily: "Heebo_800ExtraBold", fontSize: 13.5 },
    colCount: { fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280" },

    aiLink: {
        fontFamily: "Heebo_500Medium", fontSize: 11.5, color: "#6B7280",
        textDecorationLine: "underline", textAlign: "right",
    },
    aiBox: {
        backgroundColor: "#FFFFFF", borderRadius: 5, padding: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
    },
    aiText: {
        fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 17,
        color: "#111827", textAlign: "right",
    },
    aiNone: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#9A9A95", textAlign: "right" },

    outletBlock: { gap: 2 },
    outletRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    outlet: { fontFamily: "Heebo_700Bold", fontSize: 11.5, flex: 1, textAlign: "right" },
    headline: {
        fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 16,
        color: "#111827", textAlign: "right", paddingRight: 13,
    },
    // an arrow out of the page, at the end of the one line in the app that leads
    // off it: this headline is the outlet's own, and touching it goes and reads it
    jump: { fontSize: 12.5, color: "#9A9A95" },
    empty: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", lineHeight: 16 },

    unaligned: { backgroundColor: "#F4F4F3", borderRadius: 7, padding: 10, marginTop: 8, gap: 7 },
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
