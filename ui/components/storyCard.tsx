import { GENERAL_TOPIC, isRatable, NewsItem, saveWatch, setClusterTopic, SitePosition } from '@/state/engagement';
import { BLIND_INK, blindLabel, blindTo } from '@/state/blindspot';
import { elevation, SETTLE, TYPE } from '@/state/craft';
import Press from './press';
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStillness } from '@/state/access';
import { sectionTint } from '@/state/sections';
import CoverageRing from './coverageRing';
import { useDevMode, useTheme } from '@/state/theme';
import { track } from '@/state/analytics';
import TopicPicker from './topicPicker';
import { ArticleViewer } from './articleViewer';
import BlocView from './blocView';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle,
    useSharedValue, withTiming } from 'react-native-reanimated';

// A story's change of size glides instead of jumping, the stories below it glide
// with it, and its expanded part fades in and out. Reanimated's layout animations
// run natively on the phone's new architecture, where LayoutAnimation did nothing,
// and through the Web Animations API in the browser.
/**
 * An issue's name breaks where a person would break it. Left alone, "אחריות חיילים
 * וחקירת מחדלים" wrapped its last word onto a line of its own; from four words up
 * the name is split down the middle so no line is left holding one word.
 */
const balance = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length < 4) return name;
    const half = Math.ceil(words.length / 2);
    return `${words.slice(0, half).join(" ")}\n${words.slice(half).join(" ")}`;
};

const GLIDE = LinearTransition.springify()
    .mass(SETTLE.mass).stiffness(SETTLE.stiffness).damping(SETTLE.damping);
/** how much the story under the reader's thumb swells while the feed moves, and how quickly -
 *  3% of a phone-wide card is about 11 points, which reads as a lift and not a jump */
const LIFT = 0.03;
const LIFT_MS = 170;
const FADE_IN = FadeIn.duration(200);
const FADE_OUT = FadeOut.duration(130);

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    setRatingOpen: Dispatch<SetStateAction<boolean>>;
    setRatingTarget: Dispatch<SetStateAction<NewsItem | null>>;
    topics?: string[];
    /** dev mode: this story is waiting to be merged into another */
    mergeArmed?: boolean;
    onArmMerge?: (clusterId: string | number, title: string) => void;
    /** the feed keeps one story open at a time, so it decides which */
    open: boolean;
    onToggle: () => void;
    /** the feed is moving and this is the story under the reader's thumb */
    focused?: boolean;
    /** the feed adds the stories' heights up to know where each one sits */
    onMeasure?: (height: number) => void;
    /** the reader's own side, which turns a blindspot into their blindspot */
    readerBloc?: string | null;
}

/**
 * One story in the feed. Collapsed it is a single row: headline, who covered it,
 * how many. Opening it is what reveals the two ways of reading the same story.
 */
const StoryCard = ({ data, positions, setRatingOpen, setRatingTarget,
                    topics = [], mergeArmed, onArmMerge, open, onToggle,
                    focused = false, onMeasure, readerBloc }: Props) => {
    const [viewerItem, setViewerItem] = useState<NewsItem | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [topic, setTopic] = useState<string>("");
    const t = useTheme();
    const dev = useDevMode();
    const still = useStillness();

    // In the browser Reanimated animates a change of size by scaling the box, which
    // smeared the text of the story being opened or closed. There the story that is
    // changing size - and an open one, whose content keeps settling - simply resizes
    // while its expanded part fades, and the stories around it still glide. The phone
    // animates real sizes, so there everything glides.
    // The story under the reader's thumb swells a little while the feed moves and
    // settles when it stops. It is the scroll's feel only - opening is a touch.
    const lift = useSharedValue(0);
    useEffect(() => {
        const want = focused && !open ? 1 : 0;
        lift.value = still ? 0 : withTiming(want, { duration: LIFT_MS, easing: Easing.out(Easing.quad) });
    }, [focused, open, still, lift]);
    const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * LIFT }] }));

    const wasOpen = useRef(open);
    useEffect(() => { wasOpen.current = open; });

    // react-native-web reports a layout through a ResizeObserver, which came back
    // the best part of a second late - long enough for the feed's map of where each
    // story starts to be wrong about the one the scroll is resting on. Opening or
    // folding is the moment that map has to be right, so the card measures itself
    // there and then instead of waiting to be told.
    const box = useRef<any>(null);
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            box.current?.measure?.((_x: number, _y: number, _w: number, h: number) => {
                if (h) onMeasure?.(h);
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);
    const glide = still ? undefined
        : Platform.OS !== "web" || (!open && !wasOpen.current) ? GLIDE : undefined;

    // when the story broke, not when this particular outlet got to it.
    // stays above the early return: a hook may not be skipped on some renders
    const firstPublished = useMemo(() => {
        const times = (data || [])
            .map((d) => new Date(d.time).getTime())
            .filter((t) => !Number.isNaN(t));
        if (times.length === 0) return null;
        const d = new Date(Math.min(...times));
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }, [data]);

    // General news has no two sides to be on, so a reader who has just read one is
    // not asked to place it. The read is still counted - what they saw is theirs
    // to see on the analytics page either way. It lives up here with the other
    // hooks: a hook below the line that follows runs on some renders and not
    // others, and React counts them.
    const asking = useRef(false);

    if (!data || data.length === 0) return null;

    const lead = data[0];
    const sources = data.map((d) => d.source);
    const shownTopic = topic || lead.topic || "";
    const section = lead.section || "";
    // how the coverage split, which is what the ring draws
    const rightCount = data.filter((d) => positions[d.source]?.bloc === "right").length;
    const leftCount = data.filter((d) => positions[d.source]?.bloc === "left").length;
    // Who did not tell this story. It is a count rather than a judgement, which is
    // why it can sit on a closed card in plain words: four outlets on one side ran
    // it and nobody on the other did, and a reader can check that in a minute.
    const missing = blindTo({ right: rightCount, left: leftCount });
    const mine = !!missing && missing === readerBloc;
    const dark = t.name === "negative";
    const tint = sectionTint(section, dark);
    // A folded story sits on the feed; an open one is lifted off it, and is the only
    // card at that height. Two shadows each, because one blurred drop reads as a
    // sticker and a hard offset reads as a drawing of a shadow.
    const light = elevation(dark);

    const applyTopic = async (next: string) => {
        setPickerOpen(false);
        setTopic(next);                       // optimistic: the sheet closes on the new value
        const ok = await setClusterTopic(lead.groupId ?? "", next);
        if (!ok) setTopic(lead.topic || "");
    };

    const handleOpenArticle = (item: NewsItem) => {
        setRatingTarget(item);
        asking.current = isRatable(item);
        // The reading itself, with the one comparison the app is for: whose side the
        // outlet is on. Whether that is the reader's own side is joined up later
        // from the user property, so no two facts about a person travel together.
        track("article_opened", {
            outlet_bloc: positions[item.source]?.bloc ?? "unknown",
            topic: item.topic, section: item.section,
            outlets: data.length, mode: "bloc",
        });

        // react-native-webview has no web build - on web the in-app viewer renders
        // "does not support this platform". Open the real site in a tab instead,
        // straight from the press handler so the popup blocker allows it.
        if (Platform.OS === "web") {
            Linking.openURL(item.link);
            saveWatch({ id: item.id, site: item.source, topic: item.topic, date: Date.now() });
            // The article opens in a tab of its own, so this tab goes hidden. When
            // it comes back the reader has returned to us, and how long they were
            // gone is the closest thing the web build has to "did they read it".
            if (typeof document !== "undefined") {
                const left = Date.now();
                const back = () => {
                    if (document.visibilityState !== "visible") return;
                    document.removeEventListener("visibilitychange", back);
                    track("returned_from_article", {
                        away_s: Math.min(3600, Math.round((Date.now() - left) / 1000)),
                    });
                };
                document.addEventListener("visibilitychange", back);
            }
            if (asking.current) setRatingOpen(true);
            return;
        }

        setViewerItem(item);
    };

    const handleViewerChange = (isOpen: boolean) => {
        if (!isOpen) setViewerItem(null);
    };

    // iOS presents one modal at a time, so the rating sheet waits for the viewer
    // to finish dismissing. Opening it immediately deadlocked both and left the
    // card unable to open any further article.
    const handleViewerClosed = () => { if (asking.current) setRatingOpen(true); };

    return (
        <Animated.View ref={box} layout={glide} style={styles.wrap}
            onLayout={(e) => onMeasure?.(e.nativeEvent.layout.height)}>
        <Animated.View style={swell}>
            {/* The story wears its section as a tab at its top left corner - the same
                colour the filter strip uses, so the feed can be read by colour before it
                is read by word. Closed the tab is tucked behind the card and points up;
                opening the card flips the same tab inside it, hanging down off the top
                edge, so it reads as the one label following the story it belongs to. */}
            {!open && !!section && (
                <View style={styles.tabRow}>
                    <View style={[styles.tab, { backgroundColor: tint.fill, borderColor: tint.edge }]}>
                        <Text style={[styles.tabText, { color: tint.label }]} numberOfLines={1}>{section}</Text>
                    </View>
                </View>
            )}
            <View style={[styles.card,
                { backgroundColor: t.surfaceAlt, boxShadow: light.rest, borderColor: t.line },
                open && [styles.cardOpen,
                    { backgroundColor: t.surface, borderColor: t.line, boxShadow: light.raised }]]}>
            {open && !!section && (
                <Animated.View style={styles.tabRowIn}
                    entering={still ? undefined : FADE_IN} exiting={still ? undefined : FADE_OUT}>
                    <View style={[styles.tab, styles.tabDown,
                        { backgroundColor: tint.fill, borderColor: tint.edge }]}>
                        <Text style={[styles.tabText, { color: tint.label }]} numberOfLines={1}>{section}</Text>
                    </View>
                </Animated.View>
            )}
            <Press onPress={onToggle} scale={0.985}>
                <View style={styles.head}>
                    {/* the time on top, the issue to its left; under them the ring sits
                        on the headline's own line rather than above it */}
                    <View style={styles.metaLine}>
                        {!!firstPublished && (
                            <Text style={[styles.time, { color: t.textMuted }]}>{firstPublished}</Text>
                        )}
                        {!!shownTopic && shownTopic !== GENERAL_TOPIC && (
                            <TouchableOpacity
                                disabled={!dev}
                                onPress={() => setPickerOpen(true)}
                                style={[styles.topicPill, { borderColor: t.line, backgroundColor: t.surface },
                                    dev && { borderColor: t.brand, borderStyle: "dashed" }]}
                            >
                                <Text style={[styles.topicText, { color: dev ? t.brand : t.textMuted }]}
                                    numberOfLines={1}>
                                    {shownTopic}{dev ? "  ✎" : ""}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {!!missing && (
                        // loud when it is the reader's own side that missed it, quiet
                        // when it is a fact about somebody else's
                        <View style={[styles.blind, mine && { backgroundColor: BLIND_INK[missing] }]}>
                            {!mine && <View style={[styles.blindDot, { backgroundColor: BLIND_INK[missing] }]} />}
                            <Text style={[styles.blindText,
                                { color: mine ? "#FFFFFF" : BLIND_INK[missing] }]} numberOfLines={1}>
                                {blindLabel(missing, readerBloc)}
                            </Text>
                        </View>
                    )}

                    <View style={styles.titleRow}>
                        {/* who told it, as a ring: right and left, and how many in all */}
                        <CoverageRing right={rightCount} left={leftCount}
                            rightInk={t.right} leftInk={t.left} text={String(data.length)} />
                        <Text style={[styles.title, { color: t.text }]}
                            numberOfLines={open ? undefined : 3}>{lead.title}</Text>
                    </View>
                </View>
                {!open && (
                    <View style={styles.metaRow}>
                        <Text style={[styles.sources, { color: t.textMuted }]} numberOfLines={1}>{sources.join(" · ")}</Text>
                    </View>
                )}

                {dev && !open && (
                    <TouchableOpacity
                        style={[styles.mergeBtn, { borderColor: mergeArmed ? t.right : t.line }]}
                        onPress={() => onArmMerge?.(lead.groupId ?? "", lead.title)}
                    >
                        <Text style={[styles.mergeText, { color: mergeArmed ? t.right : t.textMuted }]}>
                            {mergeArmed ? "בחר אייטם לאיחוד איתו · לחץ לביטול" : "אחד עם אייטם אחר"}
                        </Text>
                    </TouchableOpacity>
                )}
            </Press>

            {open && (
                <Animated.View entering={still ? undefined : FADE_IN}
                    exiting={still ? undefined : FADE_OUT}>
                    {/* the story's own headline above, the blocs' telling of it below */}
                    <View style={[styles.rule, { backgroundColor: t.line }]} />
                    <BlocView data={data} positions={positions} onOpenArticle={handleOpenArticle} />
                </Animated.View>
            )}

            <TopicPicker
                open={pickerOpen}
                topics={topics}
                current={shownTopic}
                headline={lead.title}
                onPick={applyTopic}
                onClose={() => setPickerOpen(false)}
            />

            <ArticleViewer
                open={viewerItem !== null}
                onOpenChange={handleViewerChange}
                onClosed={handleViewerClosed}
                url={viewerItem?.link || ''}
                title={viewerItem?.title}
                source={viewerItem?.source || ''}
                id={viewerItem?.id || ''}
                topic={viewerItem?.topic || ''}
            />
            </View>
        </Animated.View>
        </Animated.View>
    );
};

export default React.memo(StoryCard);

const styles = StyleSheet.create({
    // the space below a story is padding rather than margin, so the height the feed
    // measures is the room the story actually takes up in the list
    wrap: { width: "100%", paddingBottom: 13, paddingRight: 3 },
    // the tab sits at the left edge, opposite the headline's own side
    tabRow: { flexDirection: I18nManager.isRTL ? "row-reverse" : "row", paddingHorizontal: 12 },
    // half way between the app's original rounding and a printed page's cut corner
    tab: {
        paddingHorizontal: 10, paddingTop: 3, paddingBottom: 7, marginBottom: -4,
        borderTopLeftRadius: 7, borderTopRightRadius: 7,
        borderWidth: 1, borderBottomWidth: 0,
    },
    // open, the same tab hangs from the inside of the card's top edge: the card's own
    // padding is cancelled so it starts exactly where the closed one ended, and the
    // half pixel makes up the difference between the card's border and the tab row's
    tabRowIn: {
        flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
        marginTop: -11, marginHorizontal: -0.5, zIndex: 2,
    },
    // The tab hangs into the line below it rather than standing on top of it: it
    // costs the open story 8 points of room instead of 23, and the headline starts
    // where it does on a folded one. The line it hangs into holds the time at the
    // far right and the issue beside it, neither of which reaches this far left.
    tabDown: {
        paddingTop: 6, paddingBottom: 3, marginBottom: -15,
        borderTopLeftRadius: 0, borderTopRightRadius: 0,
        borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
        borderWidth: 1, borderTopWidth: 0,
    },
    tabText: { ...TYPE.micro },
    // The border is a hairline the same colour as the page's rules, not a 1.5px
    // outline: at this size an outline draws the box, a hairline draws the edge.
    card: {
        width: "100%", backgroundColor: "#F4F4F3", borderRadius: 11,
        padding: 12, gap: 8,
        borderWidth: 1, borderColor: "#E3E3E1",
    },
    cardOpen: { backgroundColor: "#fff" },
    rule: { height: 1, backgroundColor: "#E3E3E1", marginBottom: 9, marginTop: 1 },
    head: { gap: 6 },
    // row-reverse: the time at the right edge, the issue to its left
    metaLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    // and the ring beside the headline, on its first line
    titleRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
    // the one line in the app that states a finding rather than showing a number
    blind: {
        flexDirection: "row-reverse", alignItems: "center", gap: 5,
        alignSelf: "flex-end", borderRadius: 5,
        paddingHorizontal: 7, paddingVertical: 2, marginTop: -1, marginBottom: 1,
    },
    blindDot: { width: 6, height: 6, borderRadius: 3 },
    blindText: { fontFamily: "Heebo_700Bold", fontSize: 10.5, letterSpacing: 0.1 },
    title: { flex: 1, ...TYPE.headline, color: "#111827", textAlign: "right" },
    time: {
        fontFamily: "Heebo_500Medium", fontSize: 11.5, letterSpacing: 0.1,
        color: "#9CA3AF", lineHeight: 20, fontVariant: ["tabular-nums"],
    },
    metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 6 },
    // the issue sits at the far end of the headline's own row, so the two read as
    // one line even when the headline runs to three
    topicPill: {
        borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
        maxWidth: 132, flexShrink: 0, marginTop: 1,
    },
    topicText: {
        fontFamily: "Heebo_500Medium", fontSize: 10.5, lineHeight: 14,
        letterSpacing: 0.08, textAlign: "center",
    },
    mergeBtn: {
        borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
        paddingVertical: 6, alignItems: "center", marginTop: 8,
    },
    mergeText: { fontFamily: "Heebo_500Medium", fontSize: 11 },
    sources: { ...TYPE.caption, flex: 1, color: "#6B7280", textAlign: "right" },
    count: {
 fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280", fontWeight: "600" },
});
