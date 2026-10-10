import { useStillness } from '@/state/access';
import { HotTopic } from '@/state/hotTopics';
import { ELEVATION, SETTLE, SWELL, TYPE } from '@/state/craft';
import Ionicons from '@expo/vector-icons/Ionicons';
import Press from './press';
import React, { useEffect, useRef, useState } from 'react';
import { I18nManager, Image, Platform, ScrollView, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle,
    useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";
// The phone lays the app out right to left and the web build does not, so "first
// child on the right" is "row" on one and "row-reverse" on the other.
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
const FROM_LEFT = I18nManager.isRTL ? "row-reverse" : "row";

// Every affair in the pool has a picture of its own, public/topics/<id>.webp,
// served with the site; a new affair is given one when it is added.
const PICTURES = Platform.OS === "web" ? "/topics" : "https://haezrach-hakatan.web.app/topics";
// beside the name while folded, and a little larger once the box is open
const PICTURE = { folded: 88, open: 124 } as const;
// between the dispute's line and the facts
const FACTS_GAP = 12;

// The web sets an open box the way a page is set: the picture floated to the left
// of one block, and the words running beside it and then on under it, which a row
// of two columns cannot do. React Native's types know nothing of floats and block
// boxes, and the web build hands them to the browser as written, so they are cast.
// A block's align-content is set back to normal: the web build gives every view
// flex-start, and a block with any other value is closed to the float beside it.
const WEB = Platform.OS === "web";
const css = <T,>(style: object) => (WEB ? (style as T) : undefined);
const FLOW = css<ViewStyle>({ display: "flow-root" });
const FLOAT = css<ViewStyle>({ float: "left", clear: "left", marginRight: 14, marginBottom: 6 });
// A float cannot be told how far down to start, so an empty one of no width stands
// before the picture, and the picture clears it: as tall as the spacer is, the
// picture is that far down, and the lines above it run the full width of the box.
const SPACER = css<ViewStyle>({ float: "left", width: 0 });
const BLOCK = css<ViewStyle>({ display: "block", alignContent: "normal" });
const LINE = css<TextStyle>({ display: "block" });
const SNUG = css<ViewStyle>({ width: "fit-content", marginLeft: "auto" });

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
 * is the name and the one line that says what the dispute is, with its picture on
 * the left; a touch opens the rest and another folds it. Open, the name and the
 * line run across the box, and the picture grows a little and moves down to stand
 * beside what happened, as facts, which are set to its right and run on under it;
 * then the two sides row by row - how each covers it, sees it, and what drives it -
 * and the stories in today's feed that are about it. Touching one of those opens
 * it in the feed.
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

    const size = useSharedValue<number>(open ? PICTURE.open : PICTURE.folded);
    useEffect(() => {
        const want = open ? PICTURE.open : PICTURE.folded;
        size.value = still ? want : withSpring(want, SETTLE);
    }, [open, still, size]);
    const grow = useAnimatedStyle(() => ({ width: size.value, height: size.value }));
    // how far the picture moves down: past the name and its line, set across the
    // whole box, whose height is read from a copy of them that is never seen
    const [nameHeight, setNameHeight] = useState(0);
    const drop = useSharedValue(0);
    useEffect(() => {
        const want = open && nameHeight ? nameHeight + FACTS_GAP : 0;
        drop.value = still ? want : withSpring(want, SETTLE);
    }, [open, nameHeight, still, drop]);
    const lower = useAnimatedStyle(() => ({ height: drop.value }));
    // an affair whose picture is not there yet keeps the empty frame
    const [missing, setMissing] = useState(false);

    const name = (
        <>
            {today && (
                <View style={[styles.badge, SNUG, { flexDirection: FROM_RIGHT }]}>
                    <Ionicons name="flame" size={12} color="#B45309" />
                    <Text style={styles.badgeText}>היום בפיד</Text>
                </View>
            )}
            <Text style={[styles.title, LINE]}>{topic.title}</Text>
            {!!topic.one_line && <Text style={[styles.oneLine, LINE]}>{topic.one_line}</Text>}
        </>
    );

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
                <View style={[styles.lead, FLOW ?? { flexDirection: FROM_LEFT }]}>
                    {WEB && <Animated.View style={[SPACER, lower]} />}
                    <Animated.View style={[styles.picture, FLOAT, grow]}>
                        {!missing && (
                            <Image
                                source={{ uri: `${PICTURES}/${topic.id}.webp` }}
                                style={styles.pictureImage}
                                resizeMode="cover"
                                accessible={false}
                                onError={() => setMissing(true)}
                            />
                        )}
                        <View style={styles.fold}>
                            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={15} color="#4B5563" />
                        </View>
                    </Animated.View>

                    {/* folded, the words stand as a column beside the picture; open, they
                        are one block that runs around it */}
                    <View style={open ? [styles.words, BLOCK] : [styles.words, styles.wordsFolded]}>
                        {name}
                        {open && (
                            <Animated.View style={[styles.facts, BLOCK]}
                                entering={still ? undefined : FADE_IN} exiting={still ? undefined : FADE_OUT}>
                                <Text style={[styles.label, LINE]}>הפרטים</Text>
                                <Text style={[styles.summary, LINE]}>{topic.summary}</Text>
                            </Animated.View>
                        )}
                    </View>
                    {WEB && (
                        <View style={styles.measure} aria-hidden pointerEvents="none"
                            onLayout={(e) => setNameHeight(Math.ceil(e.nativeEvent.layout.height))}>
                            {name}
                        </View>
                    )}
                </View>

                {open && (
                    <Animated.View style={styles.body}
                        entering={still ? undefined : FADE_IN} exiting={still ? undefined : FADE_OUT}>
                        <View style={styles.rule} />
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
        backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16,
        borderWidth: 1, borderColor: "#E3E3E1", boxShadow: ELEVATION.rest,
    },
    cardOpen: { boxShadow: ELEVATION.raised },
    lead: { alignItems: "flex-start", gap: 14 },
    picture: { borderRadius: 14, overflow: "hidden", backgroundColor: "#EFEEEA" },
    pictureImage: { width: "100%", height: "100%" },
    // the sign that the box opens, in the picture's corner
    fold: {
        position: "absolute", left: 6, bottom: 6, width: 24, height: 24, borderRadius: 12,
        alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)",
    },
    words: { flex: 1 },
    measure: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
    wordsFolded: { minHeight: PICTURE.folded, justifyContent: "center" },
    title: { ...TYPE.title, fontSize: 20, lineHeight: 26, color: "#111827", textAlign: "right" },
    badge: {
        alignSelf: "flex-end", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7",
        borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6,
    },
    badgeText: { ...TYPE.micro, color: "#B45309" },
    // the running text is set justified, flush on both sides, as a page is
    oneLine: { ...TYPE.body, fontSize: 14.5, lineHeight: 22, color: "#4B5563", textAlign: "justify", marginTop: 6 },
    facts: { marginTop: FACTS_GAP },
    body: { gap: 10, marginTop: 14 },
    rule: { height: 1, backgroundColor: "#E3E3E1" },
    label: { ...TYPE.micro, color: "#9CA3AF", textAlign: "right", marginTop: 2, marginBottom: 4 },
    summary: { ...TYPE.body, fontSize: 14.5, lineHeight: 23, color: "#1F2937", textAlign: "justify" },
    row: { gap: 6 },
    side: { flex: 1, borderRadius: 8, paddingVertical: 5, alignItems: "center", marginTop: 4 },
    sideText: { ...TYPE.label, color: "#FFFFFF" },
    aspect: { gap: 4 },
    aspectLabel: { ...TYPE.micro, color: "#6B7280", textAlign: "center" },
    cell: {
        ...TYPE.body, fontSize: 13, lineHeight: 20, color: "#1F2937", textAlign: "justify",
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
