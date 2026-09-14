import { NewsItem, SitePosition } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    onOpenArticle: (item: NewsItem) => void;
}

/**
 * The same story without the blocs. Free horizontal scrolling on purpose - no
 * pagingEnabled, no snapToInterval - so it glides instead of clicking into slots.
 * Tapping a card opens its summary; tapping through opens the original article.
 */
const CitizenCarousel = ({ data, positions, onOpenArticle }: Props) => {
    const [openId, setOpenId] = useState<string | null>(null);

    // No labels here, but the order is not arbitrary: the rail runs along the
    // spectrum, so a right-leaning outlet sits on the right where the reader
    // expects it. Reading left to right is then a walk across the map.
    const ordered = useMemo(() => {
        const bias = (item: NewsItem) => positions[item.source]?.bias ?? 0;
        return [...data].sort((a, b) => bias(b) - bias(a));
    }, [data, positions]);

    return (
        <View style={styles.wrap}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="normal"
                contentContainerStyle={styles.rail}
            >
                {ordered.map((item) => {
                    const open = openId === item.id;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.9}
                            style={[styles.slide, open && styles.slideOpen]}
                            onPress={() => setOpenId(open ? null : item.id)}
                        >
                            <Text style={styles.outlet}>{item.source}</Text>
                            <Text style={styles.title} numberOfLines={open ? undefined : 3}>
                                {item.title}
                            </Text>

                            {open && (
                                <>
                                    {!!item.summary && <Text style={styles.summary}>{item.summary}</Text>}
                                    <TouchableOpacity onPress={() => onOpenArticle(item)}>
                                        <Text style={styles.go}>לכתבה המלאה ←</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <Text style={styles.note}>גלילה אופקית · ללא שיוך לגוש</Text>
        </View>
    );
};

export default CitizenCarousel;

const styles = StyleSheet.create({
    wrap: { gap: 6 },
    // row-reverse puts the first card - the most right-leaning - at the right edge
    rail: { flexDirection: "row-reverse", gap: 9, paddingHorizontal: 2 },
    slide: {
        width: 232, backgroundColor: "#F4F4F3", borderRadius: 12, padding: 11, gap: 5,
        borderWidth: 1.5, borderColor: "transparent",
    },
    slideOpen: { width: 282, backgroundColor: "#fff", borderColor: "#111827" },
    outlet: {
 fontFamily: "Heebo_800ExtraBold", fontSize: 11, fontWeight: "800", color: "#111827", textAlign: "right" },
    title: {
 fontFamily: "Heebo_700Bold", fontSize: 13.5, lineHeight: 19, fontWeight: "600", color: "#111827", textAlign: "right" },
    summary: {
        fontFamily: "Heebo_400Regular",
        fontSize: 11.5, lineHeight: 17, color: "#6B7280", textAlign: "right",
        borderTopWidth: 1, borderTopColor: "#E3E3E1", paddingTop: 6, marginTop: 2,
    },
    go: {
 fontFamily: "Heebo_800ExtraBold", fontSize: 11.5, fontWeight: "800", color: "#16A34A", textAlign: "right", marginTop: 2 },
    note: {
 fontFamily: "Heebo_400Regular", fontSize: 10.5, color: "#9CA3AF", textAlign: "center" },
});
