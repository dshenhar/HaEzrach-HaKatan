import { track } from '@/state/analytics';
import { useStillness } from '@/state/access';
import { blindLabel } from '@/state/blindspot';
import { TYPE } from '@/state/craft';
import { NewsItem } from '@/state/engagement';
import { useTheme } from '@/state/theme';
import { firstSide, Side } from './blocSwipe';
import { useSummaries, Which } from './blocView';
import Press from './press';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform,
    ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';

type Page = Side | "card";

// Left to right on the screen: the right's page to the left of the story and the
// left's to its right, so a finger moving right brings in the right and a finger
// moving left the left. The phone lays a row out right to left, so there they are
// put down the other way round to land in the same places.
const PHYS: Page[] = ["right", "card", "left"];
const ORDER: Page[] = I18nManager.isRTL ? [...PHYS].reverse() : PHYS;
const xIndex = (page: Page) => PHYS.indexOf(page);

// One page at a time. The web build snaps with the browser's own scroll snapping,
// and every page is a stop, so a quick flick from one side goes back to the story
// instead of flying on to the other side; the phone pages natively.
const WEB = Platform.OS === "web";
const SNAP_ROW = (WEB ? { scrollSnapType: "x mandatory" } : {}) as ViewStyle;
const SNAP_PAGE = (WEB ? { scrollSnapAlign: "start", scrollSnapStop: "always" } : {}) as ViewStyle;

// how long the story rests on a side before it opens, and how it opens and closes
const SETTLE_MS = 100;
const GROW_MS = 280;
const SHRINK_MS = 150;
const LABEL: Record<Side, string> = { right: "ימין", left: "שמאל" };
// At the story's size a page holds its head, the summary and the outlets' names: the
// summary gets the lines that are left (SUMMARY_LINE each) once the rest is set.
const SUMMARY_LINE = 18;
const PAGE_FRAME = 75;
// the dark theme's inks are light, for a dark page; white words need the deep ones
const DEEP: Record<Side, string> = { right: "#C0392F", left: "#2B5EA7" };

type Props = {
    /** the story, every outlet's headline */
    data: NewsItem[];
    /** its headlines by the side each fell on, and those that lean to neither */
    right: NewsItem[];
    left: NewsItem[];
    neutral: NewsItem[];
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
 * always was; swiped right it gives way to the right's page, in red - how the right
 * told the story, in the AI's summary of its headlines, and which outlets they came
 * from - and swiped left to the left's, in blue. While it moves, a page is the
 * story's own size. A tenth of a second after it comes to rest on one, the page
 * opens to the headlines themselves, each of them a way into the article.
 *
 * A touch on the card goes to the side more of its headlines fell on, and a coin
 * when they are level - so neither side is the one always met first.
 */
export default function StorySwipe({ data, right, left, neutral, missing, readerBloc, open,
    onOpened, onClosed, onOpenArticle, children }: Props) {
    const t = useTheme();
    const still = useStillness();
    const ground = t.name === "negative" ? DEEP : { right: t.right, left: t.left };
    const items: Record<Side, NewsItem[]> = { right, left };

    const [width, setWidth] = useState(0);
    const [cardH, setCardH] = useState(0);
    const [fullH, setFullH] = useState<Record<Side, number>>({ right: 0, left: 0 });
    // the side that is open, grown to its headlines - for drawing, and for the
    // handlers, which run between renders
    const [grown, setGrown] = useState<Side | null>(null);
    const grownNow = useRef<Side | null>(null);
    const shrinking = useRef(false);
    // made once and kept: a value the opening drives, read as the page is drawn
    const [grow] = useState(() => new Animated.Value(0));
    const scroller = useRef<ScrollView>(null);
    const placed = useRef(false);
    const page = useRef<Page>("card");
    const x = useRef(0);
    const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
    const how = useRef<"swipe" | "tap">("swipe");
    useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

    // the summaries are asked for once a side is looked at, not for every story
    const [looked, setLooked] = useState(false);
    const wanted: Which[] = looked ? (["right", "left"] as Side[]).filter((s) => items[s].length > 0) : [];
    const summary = useSummaries(data, wanted);

    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w && w !== width) setWidth(w);
    };
    const xOf = (p: Page) => xIndex(p) * width;
    const go = (p: Page, animated = true) => scroller.current?.scrollTo({ x: xOf(p), animated });

    // the story starts in the middle, before it is first painted
    const place = () => {
        if (placed.current || !width) return;
        placed.current = true;
        go("card", false);
    };
    useLayoutEffect(place);

    const shrink = (then?: () => void) => {
        shrinking.current = true;
        Animated.timing(grow, {
            toValue: 0, duration: still ? 0 : SHRINK_MS, easing: Easing.in(Easing.quad), useNativeDriver: false,
        }).start(({ finished }) => {
            shrinking.current = false;
            // a side opened meanwhile cut it short, and is the one open now
            if (!finished) return;
            grownNow.current = null;
            setGrown(null);
            then?.();
        });
    };
    const open_ = (side: Side) => {
        grow.stopAnimation();
        grownNow.current = side;
        setGrown(side);
        grow.setValue(0);
        Animated.timing(grow, {
            toValue: 1, duration: still ? 0 : GROW_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }).start();
        track("story_side_opened", { side, headlines: items[side].length, how: how.current });
    };

    // where the scroll came to rest
    const rested = () => {
        const nearest = PHYS.reduce((a, b) => (Math.abs(x.current - xOf(b)) < Math.abs(x.current - xOf(a)) ? b : a));
        if (Math.abs(x.current - xOf(nearest)) > 3) return;      // still on its way
        const was = page.current;
        page.current = nearest;
        if (nearest === "card") {
            if (was !== "card") onClosed?.();
            return;
        }
        if (grownNow.current !== nearest && items[nearest].length > 0) open_(nearest);
        if (was === "card") onOpened?.();
        how.current = "swipe";
    };

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        x.current = e.nativeEvent.contentOffset.x;
        if (!placed.current) return;
        if (!looked && Math.abs(x.current - xOf("card")) > 4) setLooked(true);
        // on the move, an open page goes back to the story's size
        const opened = grownNow.current;
        if (opened && !shrinking.current && Math.abs(x.current - xOf(opened)) > 6) shrink();
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(rested, SETTLE_MS);
    };

    // the feed opens a story when it is touched, or asked for from elsewhere, and
    // closes it when another one opens
    useEffect(() => {
        if (!width) return;
        if (open && page.current === "card") {
            how.current = "tap";
            setLooked(true);
            const counts = { right: right.length, left: left.length };
            const side = firstSide(counts.right, counts.left);
            go(counts[side] > 0 ? side : side === "right" ? "left" : "right");
        } else if (!open && page.current !== "card") {
            if (grownNow.current) shrink(() => go("card")); else go("card");
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
        return (
            <Animated.View key={side} style={[styles.panel, { width, height, backgroundColor: ground[side] }, SNAP_PAGE]}
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
                                    <Text style={styles.ai}>סיכום AI · </Text>{line}
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
                                {neutral.length > 0 && (
                                    <>
                                        <Text style={styles.summaryLabel}>וגם, בלי לנטות לאף צד</Text>
                                        {neutral.map((item) => (
                                            <Press key={item.id} onPress={() => onOpenArticle(item)} scale={0.98}
                                                style={[styles.headline, styles.level]} accessibilityRole="link"
                                                accessibilityLabel={`${item.source}: ${item.title}`}>
                                                <Text style={styles.outlet} numberOfLines={1}>{item.source}</Text>
                                                <Text style={styles.text} numberOfLines={3}>{item.title}</Text>
                                            </Press>
                                        ))}
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <View onLayout={onLayout}>
            {!width ? children : (
                <ScrollView
                    ref={scroller}
                    horizontal
                    pagingEnabled={!WEB}
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={place}
                    style={[styles.scroller, SNAP_ROW]}
                >
                    {ORDER.map((p) => p === "card" ? (
                        <View key="card" style={[styles.card, { width }, SNAP_PAGE]}
                            onLayout={(e) => {
                                const h = Math.round(e.nativeEvent.layout.height);
                                if (h && h !== cardH) setCardH(h);
                            }}>
                            {children}
                        </View>
                    ) : panel(p))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    scroller: { borderRadius: 11 },
    // the story's own height, whatever its pages are doing
    card: { alignSelf: "flex-start" },
    // the same corners as the card it stands in for, and nothing it holds spills out
    panel: { borderRadius: 11, overflow: "hidden", alignSelf: "flex-start" },
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
    summaryLabel: { ...TYPE.micro, color: "rgba(255,255,255,0.78)", textAlign: "right" },
    text: { ...TYPE.body, fontSize: 13.5, lineHeight: 20, color: "#FFFFFF", textAlign: "right" },
    waiting: { ...TYPE.caption, color: "rgba(255,255,255,0.8)", textAlign: "right" },
    names: { ...TYPE.label, fontSize: 12, color: "rgba(255,255,255,0.92)", textAlign: "right" },
    headlines: { gap: 7, marginTop: 4 },
    headline: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, padding: 10, gap: 2 },
    level: { backgroundColor: "rgba(255,255,255,0.08)" },
    outlet: { ...TYPE.label, color: "#FFFFFF", textAlign: "right" },
});
