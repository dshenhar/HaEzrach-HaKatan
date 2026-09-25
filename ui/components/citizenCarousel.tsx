import { getBlocSummary, NewsItem, SitePosition } from '@/state/engagement';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, LayoutChangeEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GOLD = "#DDA01E";
const RAIL_PAD = 2;
// The rail reads right to left: its first card - the most right-leaning outlet -
// sits at the right edge and the rest follow leftwards. The phone runs the app in
// RTL layout and the web build does not, so each needs its own flex direction.
const RTL_ROW = I18nManager.isRTL ? "row" : "row-reverse";
// a stripe on the physical right; RTL layout on the phone swaps left and right styles
const STRIPE = I18nManager.isRTL
    ? { borderLeftWidth: 3, borderLeftColor: GOLD }
    : { borderRightWidth: 3, borderRightColor: GOLD };

/** some feeds send their standfirst as HTML - show it as plain text */
const plain = (text: string) =>
    text
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

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

    // In RTL layout a horizontal list already starts from the right. Without it the
    // list opens scrolled to its left end, so it is moved to the right end once -
    // only once, so opening a card later does not throw the reader back.
    const rail = useRef<ScrollView>(null);
    const started = useRef(false);
    const startAtRight = () => {
        if (started.current || I18nManager.isRTL) return;
        started.current = true;
        rail.current?.scrollToEnd({ animated: false });
    };

    // A card that opens grows, and in a list laid out from the right that growth
    // pushed it past the right edge, cutting its text off. So the card just opened
    // or closed is brought back flush with the right edge, and the rest move left.
    const railWidth = useRef(0);
    const anchor = useRef<string | null>(null);
    const onSlideLayout = (id: string) => (e: LayoutChangeEvent) => {
        if (I18nManager.isRTL || anchor.current !== id) return;
        anchor.current = null;
        const { x, width } = e.nativeEvent.layout;
        rail.current?.scrollTo({ x: Math.max(0, x + width + RAIL_PAD - railWidth.current), animated: true });
    };

    // one summary of the whole story across every outlet, since this view has no blocs
    const clusterId = data[0]?.groupId;
    const [summary, setSummary] = useState<string | null>(null);
    useEffect(() => {
        if (clusterId === undefined) return;
        let live = true;
        getBlocSummary(clusterId, "all").then((text) => live && setSummary(text));
        return () => { live = false; };
    }, [clusterId]);

    // No labels here, but the order is not arbitrary: the rail runs along the
    // spectrum, so a right-leaning outlet sits on the right where the reader
    // expects it. Reading left to right is then a walk across the map.
    const ordered = useMemo(() => {
        const bias = (item: NewsItem) => positions[item.source]?.bias ?? 0;
        return [...data].sort((a, b) => bias(b) - bias(a));
    }, [data, positions]);

    return (
        <View style={styles.wrap} onLayout={(e) => { railWidth.current = e.nativeEvent.layout.width; }}>
            {!!summary && (
                <View style={[styles.ai, STRIPE]}>
                    <Text style={styles.aiLabel}>סיכום AI</Text>
                    <Text style={styles.aiText}>{summary}</Text>
                </View>
            )}
            <ScrollView
                ref={rail}
                onContentSizeChange={startAtRight}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="normal"
                contentContainerStyle={styles.rail}
            >
                {ordered.map((item) => {
                    const open = openId === item.id;
                    return (
                        <View key={item.id} onLayout={onSlideLayout(item.id)}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={[styles.slide, open && styles.slideOpen]}
                            onPress={() => {
                                anchor.current = item.id;
                                setOpenId(open ? null : item.id);
                            }}
                        >
                            <Text style={styles.outlet}>{item.source}</Text>
                            <Text style={styles.title} numberOfLines={open ? undefined : 3}>
                                {item.title}
                            </Text>

                            {open && (
                                <>
                                    {!!item.summary && <Text style={styles.summary}>{plain(item.summary)}</Text>}
                                    <TouchableOpacity onPress={() => onOpenArticle(item)}>
                                        <Text style={styles.go}>לכתבה המלאה ←</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>
            <Text style={styles.note}>גלילה אופקית לצפייה בעוד כותרות</Text>
        </View>
    );
};

export default CitizenCarousel;

const styles = StyleSheet.create({
    wrap: { gap: 6 },
    // the bloc view's summary box, its stripe in the selection gold instead of a
    // bloc's colour; the soft shadow keeps a white box visible on the white card
    ai: {
        backgroundColor: "#fff", borderRadius: 7, padding: 8, gap: 3, marginBottom: 2,
        boxShadow: "0 1px 5px rgba(0,0,0,0.10)",
    },
    aiLabel: {
        fontFamily: "Heebo_800ExtraBold", fontSize: 9.5, color: "#6B7280",
        letterSpacing: 0.4, textAlign: "right",
    },
    aiText: {
        fontFamily: "Heebo_400Regular", fontSize: 12, lineHeight: 17,
        color: "#111827", textAlign: "right",
    },
    // at least as wide as the box, so a story with one or two outlets still starts
    // at the right edge instead of hugging the left
    rail: { flexDirection: RTL_ROW, flexGrow: 1, gap: 9, paddingHorizontal: RAIL_PAD },
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
