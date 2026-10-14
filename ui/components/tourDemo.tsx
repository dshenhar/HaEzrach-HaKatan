import { useStillness } from '@/state/access';
import { TYPE } from '@/state/craft';
import { sectionTint } from '@/state/sections';
import { useTheme } from '@/state/theme';
import CoverageRing from './coverageRing';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

// The pages as in the feed: the left's to the left of the story, the right's to its
// right, set left to right whatever direction the app runs in.
const LTR_ROW = { flexDirection: "row", direction: "ltr" } as const;
const RED = "#C0392F";
const BLUE = "#2B5EA7";
const EXAMPLE = "הכנסת אישרה את החוק בקריאה ראשונה";

/** a line of text, drawn as a bar: the demo shows the shape of a story, not one */
const Bar = ({ width, light }: { width: number | `${number}%`; light?: boolean }) => (
    <View style={[styles.bar, { width, backgroundColor: light ? "rgba(255,255,255,0.45)" : "#DCDBD7" }]} />
);

/** the closed story as the feed shows it: time, headline, the ring of who told it */
function Story({ title, plain }: { title: string; plain?: boolean }) {
    const t = useTheme();
    return (
        <View style={[styles.card, { backgroundColor: t.surfaceAlt }]}>
            <Text style={[styles.time, { color: t.textMuted }]}>09:41</Text>
            <View style={styles.titleRow}>
                <CoverageRing right={plain ? 0 : 3} left={plain ? 0 : 2} plain={plain}
                    rightInk={t.right} leftInk={t.left} text={plain ? "4" : "5"} />
                <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>{title}</Text>
            </View>
            <Bar width="55%" />
        </View>
    );
}

/** one side's page at the story's size: its name, its point of view, its outlets */
function SidePage({ side, width }: { side: "right" | "left"; width: number }) {
    const right = side === "right";
    return (
        <View style={[styles.page, { width, backgroundColor: right ? RED : BLUE }]}>
            <Text style={styles.pageLabel}>{right ? "ימין · 3 כותרות" : "שמאל · 2 כותרות"}</Text>
            <Text style={styles.pageText} numberOfLines={1}>
                <Text style={styles.pageMicro}>נקודת מבט · </Text>
                {right ? "איך הימין סיפר את הסיפור" : "איך השמאל סיפר את הסיפור"}
            </Text>
            <Bar width="80%" light />
            <Bar width="45%" light />
        </View>
    );
}

/**
 * The swipe, shown rather than told: a finger lands on a story and moves left, and
 * the right's page comes in from the right edge; it moves right and the story is
 * back; then the same the other way, for the left. Round again until the reader
 * moves on. Still, for a reader who asked for less motion, the story stands part
 * way to its right's page.
 */
export function SwipeDemo() {
    const t = useTheme();
    const still = useStillness();
    const tint = sectionTint("פוליטיקה", t.name === "negative");
    const [width, setWidth] = useState(0);
    // where the row stands: 0 the story, -1 the right's page, 1 the left's
    const [x] = useState(() => new Animated.Value(still ? -0.3 : 0));
    // the finger: where across the story, and whether it is down
    const [finger] = useState(() => new Animated.Value(0.25));
    const [down] = useState(() => new Animated.Value(0));

    useEffect(() => {
        if (!width || still) return;
        const ease = Easing.inOut(Easing.cubic);
        const slide = (to: number, ms: number) => Animated.parallel([
            Animated.timing(x, { toValue: to, duration: ms, easing: ease, useNativeDriver: false }),
        ]);
        const touch = (on: number) => Animated.timing(down, { toValue: on, duration: 160, useNativeDriver: false });
        const place = (at: number) => Animated.timing(finger, { toValue: at, duration: 0, useNativeDriver: false });
        const swipe = (rowTo: number, from: number, to: number) => Animated.sequence([
            place(from), touch(1),
            Animated.parallel([
                slide(rowTo, 650),
                Animated.timing(finger, { toValue: to, duration: 650, easing: ease, useNativeDriver: false }),
            ]),
            touch(0),
        ]);
        const loop = Animated.loop(Animated.sequence([
            Animated.delay(800),
            swipe(-1, 0.25, -0.25),     // finger left: the right's page, from the right
            Animated.delay(1400),
            swipe(0, -0.25, 0.25),      // and back to the story
            Animated.delay(700),
            swipe(1, -0.25, 0.25),      // finger right: the left's page, from the left
            Animated.delay(1400),
            swipe(0, 0.25, -0.25),      // and back
        ]));
        loop.start();
        return () => loop.stop();
    }, [width, still, x, finger, down]);

    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w && w !== width) setWidth(w);
    };

    return (
        <View>
            <View style={styles.tabRow}>
                <View style={[styles.tab, { backgroundColor: tint.fill }]}>
                    <Text style={[styles.tabText, { color: tint.label }]}>פוליטיקה</Text>
                </View>
            </View>
            <View style={styles.frame} onLayout={onLayout}>
                {width > 0 && (
                    <Animated.View style={[LTR_ROW, {
                        width: width * 3,
                        transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-2 * width, 0] }) }],
                    }]}>
                        <SidePage side="left" width={width} />
                        <View style={{ width }}><Story title={EXAMPLE} /></View>
                        <SidePage side="right" width={width} />
                    </Animated.View>
                )}
                {width > 0 && !still && (
                    <Animated.View pointerEvents="none" style={[styles.finger, {
                        borderColor: t.surface,
                        opacity: down.interpolate({ inputRange: [0, 1], outputRange: [0, 0.92] }),
                        transform: [
                            { translateX: finger.interpolate({ inputRange: [-1, 1], outputRange: [-width, width] }) },
                            { scale: down.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] }) },
                        ],
                        left: width / 2 - 17,
                    }]} />
                )}
            </View>
        </View>
    );
}

/**
 * The two kinds of story side by side: general news, with a grey ring and no sides,
 * which a touch opens as one list; and a story on one of the issues the country is
 * split on, with a red and blue ring, which swipes to its two sides - it nudges
 * either way to say so, its sides showing at its edges.
 */
export function KindsDemo() {
    const t = useTheme();
    const still = useStillness();
    const [nudge] = useState(() => new Animated.Value(0));
    useEffect(() => {
        if (still) return;
        const to = (v: number, ms: number) =>
            Animated.timing(nudge, { toValue: v, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: false });
        const loop = Animated.loop(Animated.sequence([
            Animated.delay(900), to(-1, 420), to(0, 380), Animated.delay(250), to(1, 420), to(0, 380),
        ]));
        loop.start();
        return () => loop.stop();
    }, [still, nudge]);

    return (
        <View style={styles.kinds}>
            <View style={styles.kind}>
                <Text style={[styles.kindTitle, { color: t.text }]}>חדשות כלליות</Text>
                <Story title="נבחרת ישראל עלתה לשלב הבא" plain />
                <Text style={[styles.kindNote, { color: t.textMuted }]}>בלי צדדים · לחיצה פותחת</Text>
            </View>
            <View style={styles.kind}>
                <Text style={[styles.kindTitle, { color: t.text }]}>סוגיה במחלוקת</Text>
                <View style={styles.nudgeFrame}>
                    <View style={[styles.edge, styles.edgeLeft, { backgroundColor: BLUE }]} />
                    <View style={[styles.edge, styles.edgeRight, { backgroundColor: RED }]} />
                    <Animated.View style={{ transform: [{ translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-16, 16] }) }] }}>
                        <Story title={EXAMPLE} />
                    </Animated.View>
                </View>
                <Text style={[styles.kindNote, { color: t.textMuted }]}>ימין ושמאל · מחליקים</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { overflow: "hidden", borderRadius: 11 },
    card: { borderRadius: 11, padding: 12, gap: 7 },
    time: { fontFamily: "Rubik_500Medium", fontSize: 11.5, textAlign: "right" },
    titleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
    title: { flex: 1, ...TYPE.headline, fontSize: 13.5, lineHeight: 19, textAlign: "right" },
    bar: { height: 7, borderRadius: 4, alignSelf: "flex-end" },
    page: { borderRadius: 11, padding: 12, gap: 7 },
    pageLabel: { ...TYPE.label, color: "#FFFFFF", textAlign: "right" },
    pageText: { ...TYPE.body, fontSize: 12.5, lineHeight: 17, color: "#FFFFFF", textAlign: "right" },
    pageMicro: { ...TYPE.micro, color: "rgba(255,255,255,0.8)" },
    finger: {
        position: "absolute", top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17,
        borderWidth: 3, backgroundColor: "rgba(17,24,39,0.55)",
    },
    tabRow: { flexDirection: "row", paddingHorizontal: 12 },
    tab: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 7, marginBottom: -4, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
    tabText: { ...TYPE.micro },
    kinds: { flexDirection: "row-reverse", gap: 10 },
    kind: { flex: 1, gap: 6 },
    kindTitle: { ...TYPE.label, textAlign: "right" },
    kindNote: { ...TYPE.caption, fontSize: 11, lineHeight: 15, textAlign: "right" },
    nudgeFrame: { borderRadius: 11, overflow: "hidden" },
    edge: { position: "absolute", top: 0, bottom: 0, width: 24 },
    edgeLeft: { left: 0 },
    edgeRight: { right: 0 },
});
