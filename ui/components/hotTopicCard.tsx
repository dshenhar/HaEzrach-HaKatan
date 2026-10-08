import { HotTopic } from '@/state/hotTopics';
import { ELEVATION, TYPE } from '@/state/craft';
import Ionicons from '@expo/vector-icons/Ionicons';
import Press from './press';
import React, { useRef } from 'react';
import { I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";
// The phone lays the app out right to left and the web build does not, so "first
// child on the right" is "row" on one and "row-reverse" on the other.
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";

const ASPECTS = [
    ["coverage", "איך מסקרים"],
    ["view", "איך רואים את זה"],
    ["motives", "מה מניע אותם"],
] as const;

type Props = {
    topic: HotTopic;
    /** one of today's: it says so beside its name */
    today?: boolean;
    onOpenStory: (storyId: string) => void;
}

/**
 * One affair the right and the left are split on, in a box of its own: what
 * happened, as facts, and under it the two sides row by row - how each covers
 * it, sees it, and what drives it - so the reader compares like with like. At
 * its foot, the stories in today's feed that are about it; touching one opens
 * it in the feed.
 */
export default function HotTopicCard({ topic, today, onOpenStory }: Props) {
    const strip = useRef<ScrollView>(null);
    // A horizontal scroller opens at its left on the web, and the first link is at
    // the right, so it is sent to its end once the links are in.
    const startAtFirst = () => {
        if (!I18nManager.isRTL) strip.current?.scrollToEnd({ animated: false });
    };

    return (
        <View style={styles.card}>
            <View style={[styles.head, { flexDirection: FROM_RIGHT }]}>
                <Text style={styles.title}>{topic.title}</Text>
                {today && (
                    <View style={[styles.badge, { flexDirection: FROM_RIGHT }]}>
                        <Ionicons name="flame" size={12} color="#B45309" />
                        <Text style={styles.badgeText}>היום בפיד</Text>
                    </View>
                )}
            </View>
            {!!topic.one_line && <Text style={styles.oneLine}>{topic.one_line}</Text>}

            <Text style={styles.label}>הפרטים</Text>
            <Text style={styles.summary}>{topic.summary}</Text>

            <View style={[styles.row, { flexDirection: FROM_RIGHT }]}>
                <View style={[styles.side, { backgroundColor: RIGHT }]}>
                    <Text style={styles.sideText}>ימין</Text>
                </View>
                <View style={[styles.side, { backgroundColor: LEFT }]}>
                    <Text style={styles.sideText}>שמאל</Text>
                </View>
            </View>
            {ASPECTS.map(([key, label]) => (
                <View key={key} style={styles.aspect}>
                    <Text style={styles.aspectLabel}>{label}</Text>
                    <View style={[styles.row, { flexDirection: FROM_RIGHT }]}>
                        <Text style={[styles.cell, { backgroundColor: RIGHT_SOFT }]}>{topic.right?.[key]}</Text>
                        <Text style={[styles.cell, { backgroundColor: LEFT_SOFT }]}>{topic.left?.[key]}</Text>
                    </View>
                </View>
            ))}

            {topic.links.length > 0 && (
                <View style={styles.links}>
                    <Text style={styles.label}>בפיד היום</Text>
                    <ScrollView
                        ref={strip}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onContentSizeChange={startAtFirst}
                        contentContainerStyle={[styles.strip, { flexDirection: FROM_RIGHT }]}
                    >
                        {topic.links.map((link) => (
                            <Press
                                key={link.id}
                                style={styles.link}
                                onPress={() => onOpenStory(link.id)}
                                accessibilityRole="link"
                                accessibilityLabel={`פתיחה בפיד: ${link.title}`}
                            >
                                <Text style={styles.linkTitle} numberOfLines={2}>{link.title}</Text>
                                <View style={[styles.linkMeta, { flexDirection: FROM_RIGHT }]}>
                                    <Text style={styles.linkMetaText}>{link.outlets} גופים</Text>
                                    <Ionicons name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
                                        size={12} color="#6B7280" />
                                </View>
                            </Press>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, gap: 8,
        borderWidth: 1, borderColor: "#E3E3E1", boxShadow: ELEVATION.rest,
    },
    head: { alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { ...TYPE.title, fontSize: 18, lineHeight: 24, color: "#111827", textAlign: "right", flexShrink: 1 },
    badge: {
        alignItems: "center", gap: 3, backgroundColor: "#FEF3C7",
        borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeText: { ...TYPE.micro, color: "#B45309" },
    oneLine: { ...TYPE.body, color: "#6B7280", textAlign: "right", marginTop: -4 },
    label: { ...TYPE.micro, color: "#9CA3AF", textAlign: "right", marginTop: 2 },
    summary: { ...TYPE.body, fontSize: 14, lineHeight: 22, color: "#1F2937", textAlign: "right" },
    row: { gap: 6 },
    side: { flex: 1, borderRadius: 8, paddingVertical: 4, alignItems: "center", marginTop: 4 },
    sideText: { ...TYPE.label, color: "#FFFFFF" },
    aspect: { gap: 4 },
    aspectLabel: { ...TYPE.micro, color: "#6B7280", textAlign: "center" },
    cell: {
        ...TYPE.body, fontSize: 12.5, lineHeight: 19, color: "#1F2937", textAlign: "right",
        flex: 1, borderRadius: 8, padding: 8,
    },
    links: { gap: 6, marginTop: 4 },
    strip: { gap: 8 },
    link: {
        width: 210, backgroundColor: "#F4F4F3", borderRadius: 10,
        borderWidth: 1, borderColor: "#E3E3E1", padding: 9, gap: 4,
    },
    linkTitle: { ...TYPE.label, color: "#111827", textAlign: "right" },
    linkMeta: { alignItems: "center", gap: 4 },
    linkMetaText: { ...TYPE.caption, color: "#6B7280" },
});
