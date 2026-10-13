import { isRatable, NewsItem, saveWatch, setClusterTopic, SitePosition } from '@/state/engagement';
import { blindLabel, blindTo } from '@/state/blindspot';
import { elevation, SETTLE, SWELL } from '@/state/craft';
import Press from './press';
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStillness } from '@/state/access';
import { useSkin } from '@/state/direction';
import StoryFace from './storyFace';
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
    const skin = useSkin();
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
        lift.value = still ? 0 : withTiming(want, { duration: SWELL.ms, easing: Easing.out(Easing.quad) });
    }, [focused, open, still, lift]);
    const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * SWELL.scale }] }));

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

    const sourcesOf = (side: "right" | "left") =>
        data.filter((d) => positions[d.source]?.bloc === side).map((d) => d.source);

    // The object the story is printed on: a slip lying on the booth's tray, a
    // passage between the page's rules, or a panel on the concourse. Open, a slip
    // and a panel lift; a passage stays on its page and the page makes room.
    const box3 = skin.name === "daf"
        ? [styles.passage, { borderTopColor: t.text }, open && { backgroundColor: t.surfaceAlt }]
        : skin.name === "sign"
            ? [styles.panel, { backgroundColor: t.surface, borderColor: open ? t.text : t.line,
                borderRadius: skin.radius.card }]
            : [styles.slip, { backgroundColor: t.surface, borderColor: t.line, borderRadius: skin.radius.card,
                boxShadow: open ? light.raised : light.rest }];

    return (
        <Animated.View ref={box} layout={glide} style={[styles.wrap, skin.name === "daf" && styles.wrapPage]}
            onLayout={(e) => onMeasure?.(e.nativeEvent.layout.height)}>
        <Animated.View style={swell}>
            <View style={box3}>
            <Press onPress={onToggle} scale={0.985}>
                <StoryFace skin={skin} t={t} open={open} time={firstPublished}
                    section={section} topic={shownTopic} dev={dev} onTopic={() => setPickerOpen(true)}
                    missing={missing} mine={mine}
                    blindText={missing ? blindLabel(missing, readerBloc) : ""}
                    title={lead.title} right={rightCount} left={leftCount} total={data.length}
                    sources={sources} rightSources={sourcesOf("right")} leftSources={sourcesOf("left")} />

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
                    exiting={still ? undefined : FADE_OUT} style={styles.opened}>
                    {/* the story's own headline above, the blocs' telling of it below */}
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
    wrap: { width: "100%", paddingBottom: 10 },
    // on the page the passages sit edge to edge, divided by their rules
    wrapPage: { paddingBottom: 0 },
    slip: { width: "100%", padding: 13, borderWidth: StyleSheet.hairlineWidth },
    passage: { width: "100%", paddingHorizontal: 16, paddingTop: 13, paddingBottom: 15, borderTopWidth: 1 },
    panel: { width: "100%", padding: 13, borderWidth: 1 },
    opened: { marginTop: 12 },
    mergeBtn: {
        borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
        paddingVertical: 6, alignItems: "center", marginTop: 8,
    },
    mergeText: { fontFamily: "Heebo_500Medium", fontSize: 11 },
});
