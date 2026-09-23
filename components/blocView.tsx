import { NewsItem, Bloc, SitePosition, getBlocSummary } from '@/state/engagement';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useScrollLock } from '@/state/scrollLock';
import { initials } from './outletDot';

// Data encoding for the bloc mode only. These two are deliberately absent from
// every other screen: the point of "האזרח הקטן" is that the colours go away.
const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";

// The outlets sit in a column of initials rather than a list of headlines: a story
// covered by nine papers used to run the card off the screen, and the bloc's shape
// - who covered it, and how many - is what the mode is actually about.
const DOT = 16;
const DOT_ON = 21;
const RAIL_GAP = 4;
const FADE = 13;
/** one outlet's slot in the column, and so one step of a drag */
const STEP = DOT_ON + RAIL_GAP;

/**
 * The outlets of one bloc, as a column of initials running the full height of the
 * summary and headline beside it.
 *
 * It works like the alphabet rail in a contacts list: hold anywhere on the column
 * and slide, and whichever outlet is under the finger becomes the one being read,
 * with a tick of haptic feedback at every change. Let go on the one you want. A
 * plain tap is the same gesture, finished where it started.
 */
const Rail = ({ items, colour, soft, at, onPick }: {
    items: NewsItem[]; colour: string; soft: string; at: number;
    onPick: (index: number) => void;
}) => {
    const [view, setView] = useState(0);
    const [content, setContent] = useState(0);
    const [dragging, setDragging] = useState(false);
    const lockFeed = useScrollLock();
    const scroller = useRef<ScrollView>(null);
    const column = useRef<View>(null);
    const overflows = content > view + 1;

    // The responder is built once, so everything it reads at gesture time lives in
    // a ref: the current choice, how many there are, where the column sits on the
    // screen, and how far it has been scrolled.
    const now = useRef({ at, count: items.length, onPick, top: 0, scrolled: 0 });
    useEffect(() => {
        now.current.at = at;
        now.current.count = items.length;
        now.current.onPick = onPick;
    });

    // the responder is built once, so it reaches the current lock through a ref
    const hold = useRef(lockFeed);
    useEffect(() => { hold.current = lockFeed; }, [lockFeed]);
    // a story that closes mid-drag must not leave the feed frozen
    useEffect(() => () => hold.current(false), []);

    const measure = () => column.current?.measureInWindow((_x, y) => { now.current.top = y; });

    // follows the finger: the outlet under it is the one being read
    const pickAt = (pageY: number) => {
        const { top, scrolled, count, at: current, onPick: pick } = now.current;
        const index = Math.floor((pageY - top + scrolled) / STEP);
        const next = Math.max(0, Math.min(count - 1, index));
        if (next === current) return;
        Haptics.selectionAsync().catch(() => {});
        pick(next);
    };

    const drag = useRef(PanResponder.create({
        // a scroller takes any vertical gesture it can reach, so the column claims
        // the touch as it lands and refuses to hand it back until the finger lifts
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (_e, g) => {
            setDragging(true);
            hold.current(true);       // the feed stands still while the finger works
            measure();
            pickAt(g.y0);
        },
        onPanResponderMove: (_e, g) => pickAt(g.moveY),
        onPanResponderRelease: () => { setDragging(false); hold.current(false); },
        onPanResponderTerminate: () => { setDragging(false); hold.current(false); },
    })).current;

    // keep the choice in view when it changed on its own - a new story, a new bloc
    useEffect(() => {
        if (!view || dragging) return;
        const centre = at * STEP + STEP / 2 - view / 2;
        scroller.current?.scrollTo({ y: Math.max(0, centre), animated: true });
    }, [at, view]);

    return (
        <View style={styles.railWrap} ref={column} onLayout={() => { measure(); }}
            {...drag.panHandlers}>
            <ScrollView
                ref={scroller}
                style={styles.rail}
                contentContainerStyle={styles.railInner}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!dragging}
                onScroll={(e) => { now.current.scrolled = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
                onLayout={(e) => setView(e.nativeEvent.layout.height)}
                onContentSizeChange={(_w, h) => setContent(h)}
            >
                {items.map((item, index) => {
                    const on = index === at;
                    const size = on ? DOT_ON : DOT;
                    // every outlet owns a slot of the same height, whatever the size of
                    // the disc inside it, so the finger's place maps to one of them exactly
                    return (
                        <View key={item.id} style={styles.slot} accessibilityLabel={item.source}>
                            <View style={[styles.dot, {
                                width: size, height: size, borderRadius: size / 2,
                                borderColor: colour,
                                backgroundColor: on ? colour : "#FFFFFF",
                            }, on && dragging && styles.dotHeld]}>
                                <Text style={[styles.dotText, {
                                    color: on ? "#FFFFFF" : colour, fontSize: on ? 9.5 : 7.5,
                                }]}>
                                    {initials(item.source)}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
            {overflows && (
                <>
                    <LinearGradient colors={[soft, `${soft}00`]} style={[styles.fade, { top: 0 }]}
                        pointerEvents="none" />
                    <LinearGradient colors={[`${soft}00`, soft]} style={[styles.fade, { bottom: 0 }]}
                        pointerEvents="none" />
                </>
            )}
        </View>
    );
};

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
    // which headline each side shows. It opens on one at random on purpose: the
    // first outlet in the list would otherwise always speak for its bloc.
    const [shown, setShown] = useState({ right: 0, left: 0 });

    useEffect(() => {
        setShown({
            right: Math.floor(Math.random() * Math.max(right.length, 1)),
            left: Math.floor(Math.random() * Math.max(left.length, 1)),
        });
    }, [clusterId, right.length, left.length]);

    useEffect(() => {
        if (clusterId === undefined) return;
        let live = true;
        Promise.all([
            right.length ? getBlocSummary(clusterId, "right") : Promise.resolve(null),
            left.length ? getBlocSummary(clusterId, "left") : Promise.resolve(null),
        ]).then(([r, l]) => live && setSummaries({ right: r, left: l }));
        return () => { live = false; };
    }, [clusterId, right.length, left.length]);

    const side = (items: NewsItem[], label: string, colour: string, soft: string,
                  summary: string | null, at: number, onPick: (index: number) => void) => {
        const chosen = items[Math.min(at, items.length - 1)];
        return (
            <View style={[styles.side, { backgroundColor: soft }]}>
                <View style={styles.sideHead}>
                    <Text style={[styles.sideLabel, { color: colour }]}>{label}</Text>
                    <Text style={styles.sideCount}>{items.length}</Text>
                </View>

                {items.length === 0 ? (
                    <Text style={styles.empty}>אף גוף מהגוש הזה לא סיקר</Text>
                ) : (
                    <View style={styles.body}>
                        {items.length > 1 && (
                            <Rail items={items} colour={colour} soft={soft} at={at} onPick={onPick} />
                        )}
                        <View style={styles.content}>
                            {!!summary && (
                                <View style={[styles.ai, { borderRightColor: colour }]}>
                                    <Text style={styles.aiLabel}>סיכום AI</Text>
                                    <Text style={styles.aiText}>{summary}</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.headline} onPress={() => onOpenArticle(chosen)}>
                                <Text style={[styles.outlet, { color: colour }]}>{chosen.source}</Text>
                                <Text style={styles.headlineText} numberOfLines={4}>{chosen.title}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View>
            <View style={styles.split}>
                {side(right, "ימין", RIGHT, RIGHT_SOFT, summaries.right, shown.right,
                      (index) => setShown((s) => ({ ...s, right: index })))}
                {side(left, "שמאל", LEFT, LEFT_SOFT, summaries.left, shown.left,
                      (index) => setShown((s) => ({ ...s, left: index })))}
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
    sideLabel: { fontFamily: "Heebo_800ExtraBold", fontSize: 14, fontWeight: "800" },
    sideCount: { fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280", fontWeight: "600" },

    // the initials on the right, the words they belong to on their left
    // stretch, not flex-start: the column of initials runs the whole height of the
    // summary and the headline it stands beside
    body: { flexDirection: "row-reverse", gap: 7, alignItems: "stretch" },
    railWrap: { width: DOT_ON, alignSelf: "stretch" },
    rail: { flex: 1 },
    railInner: { alignItems: "center" },
    slot: { height: STEP, alignItems: "center", justifyContent: "center" },
    dot: { alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
    // held, the chosen one lifts off the column so the finger has something to follow
    dotHeld: { boxShadow: "0 1px 7px rgba(0,0,0,0.4)" },
    dotText: { fontFamily: "Heebo_800ExtraBold", includeFontPadding: false },
    fade: { position: "absolute", left: 0, right: 0, height: FADE },

    content: { flex: 1, gap: 8 },
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
    empty: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", lineHeight: 16 },
    headline: { gap: 2 },
    outlet: { fontFamily: "Heebo_800ExtraBold", fontSize: 10, fontWeight: "800", textAlign: "right" },
    headlineText: {
        fontFamily: "Heebo_400Regular", fontSize: 12.5, lineHeight: 17,
        color: "#111827", textAlign: "right",
    },
    unaligned: { backgroundColor: "#F4F4F3", borderRadius: 10, padding: 10, marginTop: 8, gap: 7 },
    unalignedTitle: {
        fontFamily: "Heebo_700Bold", fontSize: 12, fontWeight: "700", color: "#111827", textAlign: "right",
    },
    unalignedNote: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#6B7280", textAlign: "right" },
    pill: {
        backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#E3E3E1",
        paddingHorizontal: 11, paddingVertical: 5, marginLeft: 6,
    },
    pillText: { fontFamily: "Heebo_700Bold", fontSize: 11, fontWeight: "600", color: "#111827" },
});
