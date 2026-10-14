import { track } from '@/state/analytics';
import { useStillness } from '@/state/access';
import { blindLabel } from '@/state/blindspot';
import { TYPE } from '@/state/craft';
import { NewsItem } from '@/state/engagement';
import { useTheme } from '@/state/theme';
import { firstSide, Side } from './blocSwipe';
import { useSummaries, Which } from './blocView';
import Press from './press';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, Platform, StyleSheet, Text, View,
    ViewStyle } from 'react-native';

type Page = Side | "card";

// Left to right on the screen: the left's page to the left of the story and the
// right's to its right, as the reader asked - the right's red page comes in from
// the right edge, when the finger moves left, and the left's blue page from the
// left edge, when it moves right. The row is set left to right whatever direction
// the app runs in, so the pages land in the same places on the phone and the web.
const PHYS: Page[] = ["left", "card", "right"];
const LTR_ROW = { flexDirection: "row", direction: "ltr" } as const;

// The finger moves the row itself, with no scrolling in between - the browser's
// snapping ran on past the story and back again, and stopped half way on some
// phones. Each page is one stop: from a side a swipe reaches the story and no
// further, and past the end of where it may go the row gives a little, more
// stiffly the further it is pulled, and comes back.
const GIVE = 80;                 // how far, at most, the row gives past a stop
const CLAIM = 8;                 // a sideways move this long, and mostly sideways, is a swipe
const SIDEWAYS = 1.4;
const TURN_SHARE = 0.25;         // a quarter of the way, or a flick, turns the page
const TURN_SPEED = 0.35;         // px per ms

// how long the story rests on a side before the page opens - long enough for the
// opening to be seen happening - and how it opens and closes
const OPEN_AFTER_MS = 1000;
const GROW_MS = 420;
const SHRINK_MS = 160;
const LABEL: Record<Side, string> = { right: "ימין", left: "שמאל" };
// At the story's size a page holds its head, the summary and the outlets' names: the
// summary gets the lines that are left (SUMMARY_LINE each) once the rest is set.
const SUMMARY_LINE = 18;
const PAGE_FRAME = 75;
// the dark theme's inks are light, for a dark page; white words need the deep ones
const DEEP: Record<Side, string> = { right: "#C0392F", left: "#2B5EA7" };
// The browser keeps the vertical scroll of the feed and leaves the sideways moves
// to the story; the words on a page are not selected by a drag with a mouse.
const WEB_TOUCH = (Platform.OS === "web" ? { touchAction: "pan-y", userSelect: "none" } : {}) as ViewStyle;

/** where the row stands with a page in view: the story's own place is one page in */
const restOf = (page: Page, width: number) => -PHYS.indexOf(page) * width;
/** how far the row gives when it is pulled `over` past where it may go */
const give = (over: number) => Math.sign(over) * GIVE * (1 - 1 / (Math.abs(over) / (GIVE * 2) + 1));

type Props = {
    /** the story, every outlet's headline */
    data: NewsItem[];
    /** its headlines by the side each fell on - every one on one or the other */
    right: NewsItem[];
    left: NewsItem[];
    /** the side whose outlets did not cover it at all, when the other side's did */
    missing: Side | null;
    readerBloc?: string | null;
    /** the feed's one open story: true asks for a side, false for the story itself */
    open: boolean;
    /** the reader came to rest on a side, or back on the story */
    onOpened?: () => void;
    onClosed?: () => void;
    onOpenArticle: (item: NewsItem) => void;
    /** the story's own card, in the middle */
    children: React.ReactNode;
};

/**
 * A story on one of the issues, with its two sides beside it. The card is as it
 * always was; a finger moving left brings in the right's page from the right edge,
 * in red - how the right told the story, in the AI's summary of its headlines, and
 * which outlets they came from - and a finger moving right brings in the left's,
 * in blue, from the left edge. While it moves, a page is the story's own size. A
 * second after it comes to rest on one, the page opens to the headlines
 * themselves, each of them a way into the article.
 *
 * A touch on the card goes to the side more of its headlines fell on, and a coin
 * when they are level - so neither side is the one always met first - and the next
 * touch, back on the card, to the other side.
 */
export default function StorySwipe({ data, right, left, missing, readerBloc, open,
    onOpened, onClosed, onOpenArticle, children }: Props) {
    const t = useTheme();
    const still = useStillness();
    const ground = t.name === "negative" ? DEEP : { right: t.right, left: t.left };
    const items: Record<Side, NewsItem[]> = { right, left };

    const [width, setWidth] = useState(0);
    const [cardH, setCardH] = useState(0);
    const [fullH, setFullH] = useState<Record<Side, number>>({ right: 0, left: 0 });
    // the page in view, for drawing: resting on a side, the other side is not shown
    const [at, setAt] = useState<Page>("card");
    // the side that is open, grown to its headlines
    const [grown, setGrown] = useState<Side | null>(null);
    // made once and kept: values the finger and the openings drive, read as drawn
    const [shift] = useState(() => new Animated.Value(0));
    const [grow] = useState(() => new Animated.Value(0));
    // the summaries are asked for once a side is looked at, not for every story
    const [looked, setLooked] = useState(false);
    const wanted: Which[] = looked ? (["right", "left"] as Side[]).filter((s) => items[s].length > 0) : [];
    const summary = useSummaries(data, wanted);

    // What the handlers need between renders. They are kept up to date in an effect
    // after every render, and read only when a finger moves or a timer fires.
    const live = useRef({
        width: 0, page: "card" as Page, grown: null as Side | null, shrinking: false,
        lastSide: null as Side | null, how: "swipe" as "swipe" | "tap",
        opening: null as ReturnType<typeof setTimeout> | null, from: 0,
        items, onOpened, onClosed, still,
    });
    useEffect(() => {
        Object.assign(live.current, { width, items, onOpened, onClosed, still });
    });
    useEffect(() => () => {
        const l = live.current;
        if (l.opening) clearTimeout(l.opening);
    }, []);

    // the row stands on the story once its width is known, and wherever it was put
    // when the width changes
    useEffect(() => {
        if (width) shift.setValue(restOf(live.current.page, width));
    }, [width, shift]);

    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w && w !== width) setWidth(w);
    };

    const shrink = (then?: () => void) => {
        const l = live.current;
        l.shrinking = true;
        Animated.timing(grow, {
            toValue: 0, duration: l.still ? 0 : SHRINK_MS, easing: Easing.in(Easing.quad), useNativeDriver: false,
        }).start(({ finished }) => {
            l.shrinking = false;
            // a side opened meanwhile cut it short, and is the one open now
            if (!finished) return;
            l.grown = null;
            setGrown(null);
            then?.();
        });
    };
    const openSide = (side: Side) => {
        const l = live.current;
        grow.stopAnimation();
        l.grown = side;
        setGrown(side);
        grow.setValue(0);
        Animated.timing(grow, {
            toValue: 1, duration: l.still ? 0 : GROW_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
        track("story_side_opened", { side, headlines: l.items[side].length, how: l.how });
    };
    const holdOpening = () => {
        const l = live.current;
        if (l.opening) clearTimeout(l.opening);
        l.opening = null;
    };

    // the row has come to rest on a page
    const arrived = (page: Page) => {
        const l = live.current;
        const was = l.page;
        l.page = page;
        setAt(page);
        if (page === "card") {
            if (was !== "card") l.onClosed?.();
            return;
        }
        if (was !== page) {
            l.lastSide = page;
            if (was === "card") l.onOpened?.();
        }
        // a second later the page opens - or opens again, after a nudge that came
        // back to the same side
        const shut = l.grown !== page || l.shrinking;
        if (shut && !l.opening && l.items[page].length > 0) {
            l.opening = setTimeout(() => {
                l.opening = null;
                if (l.page === page) openSide(page);
            }, OPEN_AFTER_MS);
        }
        l.how = "swipe";
    };
    const go = (page: Page) => {
        const l = live.current;
        if (!l.width) return;
        holdOpening();
        if (page !== "card") setLooked(true);
        const move = () => Animated.spring(shift, {
            toValue: restOf(page, l.width), useNativeDriver: false,
            tension: 70, friction: 12, restDisplacementThreshold: 0.5, restSpeedThreshold: 0.5,
        }).start(({ finished }) => { if (finished) arrived(page); });
        if (l.still) {
            shift.setValue(restOf(page, l.width));
            arrived(page);
        } else if (l.grown && l.grown !== page) {
            shrink(move);
        } else {
            move();
        }
    };
    // the latest go, for the handlers made once
    const goNow = useRef(go);
    useEffect(() => { goNow.current = go; });

    // Made once. Its handlers read `live` and `goNow` when a finger moves, never while
    // drawing; the compiler's rule cannot tell a handler from the render around it.
    // eslint-disable-next-line react-hooks/refs
    const [pan] = useState(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > CLAIM && Math.abs(g.dx) > Math.abs(g.dy) * SIDEWAYS,
        // once the story is moving under the finger, it keeps it
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
            const l = live.current;
            holdOpening();
            shift.stopAnimation((value) => { l.from = value; });
            setLooked(true);
            // on the move, an open page goes back to the story's size
            if (l.grown && !l.shrinking) shrink();
        },
        onPanResponderMove: (_, g) => {
            const l = live.current;
            const w = l.width;
            // from the story the row may go a page either way; from a side, only back
            // to the story - past that it only gives
            const lo = l.page === "left" ? restOf("card", w) : restOf("right", w);
            const hi = l.page === "right" ? restOf("card", w) : restOf("left", w);
            const want = l.from + g.dx;
            shift.setValue(want > hi ? hi + give(want - hi) : want < lo ? lo + give(want - lo) : want);
        },
        onPanResponderRelease: (_, g) => {
            const l = live.current;
            const turn = l.width * TURN_SHARE;
            const toLeft = g.dx > turn || g.vx > TURN_SPEED;      // finger right: the left's page
            const toRight = g.dx < -turn || g.vx < -TURN_SPEED;   // finger left: the right's page
            let next: Page = l.page;
            if (l.page === "card") next = toRight ? "right" : toLeft ? "left" : "card";
            else if (l.page === "right" && toLeft) next = "card";
            else if (l.page === "left" && toRight) next = "card";
            l.how = "swipe";
            goNow.current(next);
        },
        onPanResponderTerminate: () => goNow.current(live.current.page),
    }));

    // the feed opens a story when it is touched, or asked for from elsewhere, and
    // closes it when another one opens
    useEffect(() => {
        const l = live.current;
        if (!width) return;
        if (open && l.page === "card") {
            l.how = "tap";
            // the side not seen last, or, the first time, the side more headlines
            // fell on - and an empty side only if there is nothing on the other
            const counts = { right: right.length, left: left.length };
            const other = (s: Side): Side => (s === "right" ? "left" : "right");
            const side = l.lastSide ? other(l.lastSide) : firstSide(counts.right, counts.left);
            go(counts[side] > 0 || counts[other(side)] === 0 ? side : other(side));
        } else if (!open && l.page !== "card") {
            go("card");
        }
        // only the request itself moves it, not the pages it causes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, width]);

    const names = (list: NewsItem[]) => Array.from(new Set(list.map((item) => item.source))).join(" · ");

    const panel = (side: Side) => {
        const list = items[side];
        const other: Side = side === "right" ? "left" : "right";
        const line = summary(side);
        const full = grown === side;
        const lines = Math.max(1, Math.floor((cardH - PAGE_FRAME) / SUMMARY_LINE));
        const height = !cardH ? undefined : grown === side
            ? grow.interpolate({ inputRange: [0, 1], outputRange: [cardH, Math.max(cardH, fullH[side])] })
            : cardH;
        // resting on one side, the other is not there to be glimpsed
        const hidden = at !== "card" && at !== side;
        return (
            <Animated.View key={side}
                style={[styles.panel, { width, height, backgroundColor: ground[side], opacity: hidden ? 0 : 1 }]}
                accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
                accessibilityLabel={`${LABEL[side]}, ${list.length} כותרות`}>
                <View style={styles.body} onLayout={(e) => {
                    const h = Math.ceil(e.nativeEvent.layout.height);
                    if (h !== fullH[side]) setFullH((current) => ({ ...current, [side]: h }));
                }}>
                    <View style={styles.head}>
                        <Text style={styles.label}>
                            {LABEL[side]} · {list.length === 1 ? "כותרת אחת" : `${list.length} כותרות`}
                        </Text>
                        <View style={styles.moves}>
                            <Press onPress={() => go(other)} style={styles.move} hitSlop={6}
                                accessibilityRole="button" accessibilityLabel={`לצד של ה${LABEL[other]}`}>
                                <Text style={styles.moveText}>ל{LABEL[other]}</Text>
                            </Press>
                            <Press onPress={() => go("card")} style={styles.move} hitSlop={6}
                                accessibilityRole="button" accessibilityLabel="חזרה לכתבה">
                                <Text style={styles.moveText}>✕</Text>
                            </Press>
                        </View>
                    </View>

                    {list.length === 0 ? (
                        <Text style={styles.text}>
                            {missing === side ? blindLabel(side, readerBloc) : "אף כותרת לא נפלה בצד הזה"}
                        </Text>
                    ) : (
                        <>
                            {line ? (
                                <Text style={styles.summary} numberOfLines={full ? undefined : lines}>
                                    <Text style={styles.ai}>נקודת מבט · </Text>{line}
                                </Text>
                            ) : line === undefined && looked ? (
                                <Text style={styles.waiting}>מכין סיכום…</Text>
                            ) : null}
                            <Text style={styles.names} numberOfLines={full ? 2 : 1}>{names(list)}</Text>

                            {/* what the page opens to: the headlines themselves */}
                            <View style={styles.headlines}>
                                {list.map((item) => (
                                    <Press key={item.id} onPress={() => onOpenArticle(item)} scale={0.98}
                                        style={styles.headline} accessibilityRole="link"
                                        accessibilityLabel={`${item.source}: ${item.title}`}>
                                        <Text style={styles.outlet} numberOfLines={1}>{item.source}</Text>
                                        <Text style={styles.text} numberOfLines={3}>{item.title}</Text>
                                    </Press>
                                ))}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <View onLayout={onLayout} style={[styles.frame, WEB_TOUCH]} {...(width ? pan.panHandlers : {})}>
            {!width ? children : (
                <Animated.View
                    style={[styles.row, LTR_ROW, { width: width * PHYS.length, transform: [{ translateX: shift }] }]}>
                    {PHYS.map((p) => p === "card" ? (
                        <View key="card" style={{ width }}
                            onLayout={(e) => {
                                const h = Math.round(e.nativeEvent.layout.height);
                                if (h && h !== cardH) setCardH(h);
                            }}>
                            {children}
                        </View>
                    ) : panel(p))}
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // one page wide: the row slides beneath it, and what is beside the page is out of sight
    frame: { overflow: "hidden", borderRadius: 11 },
    row: { alignItems: "flex-start" },
    // the same corners as the card it stands in for, and nothing it holds spills out
    panel: { borderRadius: 11, overflow: "hidden" },
    body: { padding: 12, gap: 6 },
    head: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
    label: { ...TYPE.label, color: "#FFFFFF" },
    moves: { flexDirection: "row", gap: 6 },
    move: {
        borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
        backgroundColor: "rgba(255,255,255,0.18)",
    },
    moveText: { ...TYPE.micro, color: "#FFFFFF" },
    summary: { ...TYPE.body, fontSize: 13, lineHeight: SUMMARY_LINE, color: "#FFFFFF", textAlign: "right" },
    ai: { ...TYPE.micro, color: "rgba(255,255,255,0.78)" },
    text: { ...TYPE.body, fontSize: 13.5, lineHeight: 20, color: "#FFFFFF", textAlign: "right" },
    waiting: { ...TYPE.caption, color: "rgba(255,255,255,0.8)", textAlign: "right" },
    names: { ...TYPE.label, fontSize: 12, color: "rgba(255,255,255,0.92)", textAlign: "right" },
    headlines: { gap: 7, marginTop: 4 },
    headline: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, padding: 10, gap: 2 },
    outlet: { ...TYPE.label, color: "#FFFFFF", textAlign: "right" },
});
