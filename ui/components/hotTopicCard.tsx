import { useStillness } from '@/state/access';
import { HotTopic } from '@/state/hotTopics';
import { ELEVATION, SETTLE, SWELL, TYPE } from '@/state/craft';
import Ionicons from '@expo/vector-icons/Ionicons';
import Press from './press';
import React, { useEffect, useRef } from 'react';
import { I18nManager, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle,
    useSharedValue, withTiming } from 'react-native-reanimated';

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

// the feed's story card opens the same way
const GLIDE = LinearTransition.springify()
    .mass(SETTLE.mass).stiffness(SETTLE.stiffness).damping(SETTLE.damping);
const FADE_IN = FadeIn.duration(200);
const FADE_OUT = FadeOut.duration(130);

type Props = {
    topic: HotTopic;
    /** one of today's: it says so beside its name */
    today?: boolean;
    open: boolean;
    /** under the reader's thumb while the page moves */
    focused?: boolean;
    onToggle: () => void;
    onOpenStory: (storyId: string) => void;
}

/**
 * One affair the right and the left are split on, in a box of its own. Folded, it
 * is the name and the one line that says what the dispute is; a touch opens the
 * rest and another folds it: what happened, as facts, then the two sides row by
 * row - how each covers it, sees it, and what drives it - and the stories in
 * today's feed that are about it. Touching one of those opens it in the feed.
 */
export default function HotTopicCard({ topic, today, open, focused, onToggle, onOpenStory }: Props) {
    const still = useStillness();
    const strip = useRef<ScrollView>(null);
    // A horizontal scroller opens at its left on the web, and the first link is at
    // the right, so it is sent to its end once the links are in.
    const startAtFirst = () => {
        if (!I18nManager.isRTL) strip.current?.scrollToEnd({ animated: false });
    };

    // the swell under the scroll, as the feed's stories have it; an open box is
    // being read, and stays still
    const lift = useSharedValue(0);
    useEffect(() => {
        const want = focused && !open ? 1 : 0;
        lift.value = still ? 0 : withTiming(want, { duration: SWELL.ms, easing: Easing.out(Easing.quad) });
    }, [focused, open, still, lift]);
    const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * SWELL.scale }] }));
    // the web's layout animation measures the open box wrong, as the feed found
    const glide = still || Platform.OS === "web" ? undefined : GLIDE;

    return (
        <Animated.View style={swell} layout={glide}>
            <Press
                style={[styles.card, open && styles.cardOpen]}
                scale={0.99}
                onPress={onToggle}
                accessibilityRole="button"
                aria-expanded={open}
                accessibilityLabel={`${topic.title}. ${topic.one_line}`}
            >
                <View style={[styles.head, { flexDirection: FROM_RIGHT }]}>
                    <View style={styles.headText}>
                        {today && (
                            <View style={[styles.badge, { flexDirection: FROM_RIGHT }]}>
                                <Ionicons name="flame" size={12} color="#B45309" />
                                <Text style={styles.badgeText}>היום בפיד</Text>
                            </View>
                        )}
                        <Text style={styles.title}>{topic.title}</Text>
                        {!!topic.one_line && <Text style={styles.oneLine}>{topic.one_line}</Text>}
                    </View>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={22} color="#9CA3AF" />
                </View>

                {open && (
                    <Animated.View style={styles.body}
                        entering={still ? undefined : FADE_IN} exiting={still ? undefined : FADE_OUT}>
                        <View style={styles.rule} />
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
                    </Animated.View>
                )}
            </Press>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // folded, a box is a name and a line - so it is given room to be a box and not
    // a list row: a thumb-sized target with air around the words
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 18,
        paddingHorizontal: 18, paddingVertical: 20, minHeight: 104, justifyContent: "center",
        borderWidth: 1, borderColor: "#E3E3E1", boxShadow: ELEVATION.rest,
    },
    cardOpen: { boxShadow: ELEVATION.raised },
    head: { alignItems: "center", gap: 12 },
    headText: { flex: 1, gap: 6 },
    title: { ...TYPE.title, fontSize: 20, lineHeight: 26, color: "#111827", textAlign: "right" },
    badge: {
        alignSelf: "flex-end", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7",
        borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeText: { ...TYPE.micro, color: "#B45309" },
    oneLine: { ...TYPE.body, fontSize: 14.5, lineHeight: 22, color: "#4B5563", textAlign: "right" },
    body: { gap: 10, marginTop: 14 },
    rule: { height: 1, backgroundColor: "#E3E3E1" },
    label: { ...TYPE.micro, color: "#9CA3AF", textAlign: "right", marginTop: 2 },
    summary: { ...TYPE.body, fontSize: 14.5, lineHeight: 23, color: "#1F2937", textAlign: "right" },
    row: { gap: 6 },
    side: { flex: 1, borderRadius: 8, paddingVertical: 5, alignItems: "center", marginTop: 4 },
    sideText: { ...TYPE.label, color: "#FFFFFF" },
    aspect: { gap: 4 },
    aspectLabel: { ...TYPE.micro, color: "#6B7280", textAlign: "center" },
    cell: {
        ...TYPE.body, fontSize: 13, lineHeight: 20, color: "#1F2937", textAlign: "right",
        flex: 1, borderRadius: 8, padding: 9,
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
