import { NewsItem, Bloc, SitePosition, getBlocSummary } from '@/state/engagement';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Data encoding for the bloc mode only. These two are deliberately absent from
// every other screen: the point of "האזרח הקטן" is that the colours go away.
const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    onOpenArticle: (item: NewsItem) => void;
}

const BlocView = ({ data, positions, onOpenArticle }: Props) => {
    const { right, left, unaligned } = useMemo(() => {
        const buckets: Record<string, NewsItem[]> = { right: [], left: [], unaligned: [] };
        data.forEach((item) => {
            const bloc: Bloc = positions[item.source]?.bloc ?? "unknown";
            buckets[bloc === "right" || bloc === "left" ? bloc : "unaligned"].push(item);
        });
        return { right: buckets.right, left: buckets.left, unaligned: buckets.unaligned };
    }, [data, positions]);

    const clusterId = data[0]?.groupId;
    const [summaries, setSummaries] = useState<{ right: string | null; left: string | null }>({
        right: null, left: null,
    });

    useEffect(() => {
        if (clusterId === undefined) return;
        let live = true;
        Promise.all([
            right.length ? getBlocSummary(clusterId, "right") : Promise.resolve(null),
            left.length ? getBlocSummary(clusterId, "left") : Promise.resolve(null),
        ]).then(([r, l]) => live && setSummaries({ right: r, left: l }));
        return () => { live = false; };
    }, [clusterId, right.length, left.length]);

    const side = (items: NewsItem[], label: string, colour: string, soft: string, summary: string | null) => (
        <View style={[styles.side, { backgroundColor: soft }]}>
            <View style={styles.sideHead}>
                <Text style={[styles.sideLabel, { color: colour }]}>{label}</Text>
                <Text style={styles.sideCount}>{items.length}</Text>
            </View>
            {!!summary && (
                <View style={[styles.ai, { borderRightColor: colour }]}>
                    <Text style={styles.aiLabel}>סיכום AI</Text>
                    <Text style={styles.aiText}>{summary}</Text>
                </View>
            )}
            {items.length === 0 ? (
                <Text style={styles.empty}>אף גוף מהגוש הזה לא סיקר</Text>
            ) : (
                items.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.headline} onPress={() => onOpenArticle(item)}>
                        <Text style={[styles.outlet, { color: colour }]}>{item.source}</Text>
                        <Text style={styles.headlineText} numberOfLines={3}>{item.title}</Text>
                    </TouchableOpacity>
                ))
            )}
        </View>
    );

    return (
        <View>
            <View style={styles.split}>
                {side(right, "ימין", RIGHT, RIGHT_SOFT, summaries.right)}
                {side(left, "שמאל", LEFT, LEFT_SOFT, summaries.left)}
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
    split: { flexDirection: "row-reverse", gap: 8 },
    side: { flex: 1, borderRadius: 10, padding: 10, gap: 8 },
    sideHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    sideLabel: {
 fontFamily: "Heebo_800ExtraBold", fontSize: 14, fontWeight: "800" },
    sideCount: {
 fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280", fontWeight: "600" },
    ai: {
        backgroundColor: "rgba(255,255,255,0.75)", borderRadius: 7, padding: 7,
        borderRightWidth: 3, gap: 3,
    },
    aiLabel: {
        fontFamily: "Heebo_800ExtraBold", fontSize: 9.5, color: "#6B7280",
        letterSpacing: 0.4, textAlign: "right",
    },
    aiText: {
        fontFamily: "Heebo_400Regular", fontSize: 11, lineHeight: 16,
        color: "#111827", textAlign: "right",
    },
    empty: {
 fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", lineHeight: 16 },
    headline: { gap: 2 },
    outlet: {
 fontFamily: "Heebo_800ExtraBold", fontSize: 10, fontWeight: "800" },
    headlineText: {
 fontFamily: "Heebo_400Regular", fontSize: 12.5, lineHeight: 17, color: "#111827", textAlign: "right" },
    unaligned: { backgroundColor: "#F4F4F3", borderRadius: 10, padding: 10, marginTop: 8, gap: 7 },
    unalignedTitle: {
 fontFamily: "Heebo_700Bold", fontSize: 12, fontWeight: "700", color: "#111827", textAlign: "right" },
    unalignedNote: {
 fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", textAlign: "right" },
    pill: {
        backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#E3E3E1",
        paddingHorizontal: 11, paddingVertical: 5, marginLeft: 6,
    },
    pillText: {
 fontFamily: "Heebo_700Bold", fontSize: 11, fontWeight: "600", color: "#111827" },
});
