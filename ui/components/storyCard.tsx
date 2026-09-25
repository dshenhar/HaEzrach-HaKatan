import { GENERAL_TOPIC, isRatable, NewsItem, saveWatch, setClusterTopic, SitePosition } from '@/state/engagement';
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStillness } from '@/state/access';
import { sectionColour } from '@/state/sections';
import CoverageRing from './coverageRing';
import { useDevMode, useTheme } from '@/state/theme';
import TopicPicker from './topicPicker';
import { ViewMode } from './viewModeToggle';
import { ArticleViewer } from './articleViewer';
import BlocView from './blocView';
import CitizenCarousel from './citizenCarousel';
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

const GLIDE = LinearTransition.duration(240);
/** how much the story the scroll has settled on swells, and how quickly */
const LIFT = 0.022;
const LIFT_MS = 170;
const FADE_IN = FadeIn.duration(220);
const FADE_OUT = FadeOut.duration(140);

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    setRatingOpen: Dispatch<SetStateAction<boolean>>;
    setRatingTarget: Dispatch<SetStateAction<NewsItem | null>>;
    mode: ViewMode;
    topics?: string[];
    /** dev mode: this story is waiting to be merged into another */
    mergeArmed?: boolean;
    onArmMerge?: (clusterId: string | number, title: string) => void;
    /** the feed keeps one story open at a time, so it decides which */
    open: boolean;
    onToggle: () => void;
    /** the scroll is resting on this story and is about to open it */
    focused?: boolean;
    /** the feed adds the stories' heights up to know where each one sits */
    onMeasure?: (height: number) => void;
    /** the scroll opened this one, so the fold that pays for it happens at once */
    instant?: boolean;
}

/**
 * One story in the feed. Collapsed it is a single row: headline, who covered it,
 * how many. Opening it is what reveals the two ways of reading the same story.
 */
const StoryCard = ({ data, positions, setRatingOpen, setRatingTarget, mode,
                    topics = [], mergeArmed, onArmMerge, open, onToggle,
                    focused = false, onMeasure, instant = false }: Props) => {
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
    // A story under the reader's thumb swells a little while the feed is moving, so
    // that the scroll coming to rest on it and the story opening read as one gesture
    // rather than as something the app decided on its own.
    const lift = useSharedValue(0);
    useEffect(() => {
        const want = focused && !open ? 1 : 0;
        lift.value = still ? want : withTiming(want, { duration: LIFT_MS, easing: Easing.out(Easing.quad) });
    }, [focused, open, still]);
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
    const glide = still || instant ? undefined
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

    if (!data || data.length === 0) return null;

    const lead = data[0];
    const sources = data.map((d) => d.source);
    const shownTopic = topic || lead.topic || "";
    const section = lead.section || "";
    // how the coverage split, which is what the ring draws
    const rightCount = data.filter((d) => positions[d.source]?.bloc === "right").length;
    const leftCount = data.filter((d) => positions[d.source]?.bloc === "left").length;
    const dark = t.name === "negative";
    const sectionInk = sectionColour(section, dark);
    // a hard offset shadow, no blur - tab and card read as paper lifted off the page
    const hardShadow = dark ? "3px 3px 0 rgba(0,0,0,0.5)" : "3px 3px 0 rgba(17,24,39,0.18)";

    const applyTopic = async (next: string) => {
        setPickerOpen(false);
        setTopic(next);                       // optimistic: the sheet closes on the new value
        const ok = await setClusterTopic(lead.groupId ?? "", next);
        if (!ok) setTopic(lead.topic || "");
    };

    // General news has no two sides to be on, so a reader who has just read one is
    // not asked to place it. The read is still counted - what they saw is theirs
    // to see on the analytics page either way.
    const asking = useRef(false);

    const handleOpenArticle = (item: NewsItem) => {
        setRatingTarget(item);
        asking.current = isRatable(item);

        // react-native-webview has no web build - on web the in-app viewer renders
        // "does not support this platform". Open the real site in a tab instead,
        // straight from the press handler so the popup blocker allows it.
        if (Platform.OS === "web") {
            Linking.openURL(item.link);
            saveWatch({ id: item.id, site: item.source, topic: item.topic, date: Date.now() });
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
                    <View style={[styles.tab, { backgroundColor: sectionInk, boxShadow: hardShadow }]}>
                        <Text style={styles.tabText} numberOfLines={1}>{section}</Text>
                    </View>
                </View>
            )}
            <View style={[styles.card, { backgroundColor: t.surfaceAlt, boxShadow: hardShadow },
                open && [styles.cardOpen, { backgroundColor: t.surface, borderColor: t.text }]]}>
            {open && !!section && (
                <Animated.View style={styles.tabRowIn}
                    entering={still ? undefined : FADE_IN} exiting={still ? undefined : FADE_OUT}>
                    <View style={[styles.tab, styles.tabDown, { backgroundColor: sectionInk, boxShadow: hardShadow }]}>
                        <Text style={styles.tabText} numberOfLines={1}>{section}</Text>
                    </View>
                </Animated.View>
            )}
            <TouchableOpacity activeOpacity={0.8} onPress={onToggle}>
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

                    <View style={styles.titleRow}>
                        {/* only the bloc view is about who told it, so only it wears the ring */}
                        {mode === "bloc" && (
                            <CoverageRing right={rightCount} left={leftCount}
                                rightInk={t.right} leftInk={t.left} text={String(data.length)} />
                        )}
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
            </TouchableOpacity>

            {open && (
                <Animated.View entering={still ? undefined : FADE_IN}
                    exiting={still || instant ? undefined : FADE_OUT}>
                    {/* the story's own headline above, the blocs' telling of it below */}
                    <View style={[styles.rule, { backgroundColor: t.line }]} />
                    {mode === "bloc" ? (
                        <BlocView data={data} positions={positions} onOpenArticle={handleOpenArticle} />
                    ) : (
                        <CitizenCarousel data={data} positions={positions} onOpenArticle={handleOpenArticle} />
                    )}
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
        paddingHorizontal: 11, paddingTop: 3, paddingBottom: 6, marginBottom: -4,
        borderTopLeftRadius: 6, borderTopRightRadius: 6,
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
        paddingTop: 5, paddingBottom: 3, marginBottom: -15,
        borderTopLeftRadius: 0, borderTopRightRadius: 0,
        borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    },
    tabText: {
        fontFamily: "Heebo_700Bold", fontSize: 10.5, color: "#FFFFFF", letterSpacing: 0.2,
    },
    card: {
        width: "100%", backgroundColor: "#F4F4F3", borderRadius: 8,
        padding: 11, gap: 8,
        borderWidth: 1.5, borderColor: "transparent",
    },
    cardOpen: { backgroundColor: "#fff", borderColor: "#111827" },
    rule: { height: 1, backgroundColor: "#E3E3E1", marginBottom: 9, marginTop: 1 },
    head: { gap: 6 },
    // row-reverse: the time at the right edge, the issue to its left
    metaLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    // and the ring beside the headline, on its first line
    titleRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
    title: {
        flex: 1, fontFamily: "Heebo_700Bold", fontSize: 14.5, fontWeight: "700",
        lineHeight: 20, color: "#111827", textAlign: "right",
    },
    time: {
        fontFamily: "Heebo_500Medium", fontSize: 12, color: "#9CA3AF",
        lineHeight: 20, fontVariant: ["tabular-nums"],
    },
    metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 6 },
    // the issue sits at the far end of the headline's own row, so the two read as
    // one line even when the headline runs to three
    topicPill: {
        borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 3,
        maxWidth: 132, flexShrink: 0, marginTop: 1,
    },
    topicText: {
        fontFamily: "Heebo_500Medium", fontSize: 10.5, lineHeight: 14, textAlign: "center",
    },
    mergeBtn: {
        borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
        paddingVertical: 6, alignItems: "center", marginTop: 8,
    },
    mergeText: { fontFamily: "Heebo_500Medium", fontSize: 11 },
    sources: {
        fontFamily: "Heebo_400Regular", flex: 1, fontSize: 11, color: "#6B7280", textAlign: "right" },
    count: {
 fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280", fontWeight: "600" },
});
