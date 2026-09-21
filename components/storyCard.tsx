import { NewsItem, saveWatch, setClusterTopic, SitePosition } from '@/state/engagement';
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDevMode, useTheme } from '@/state/theme';
import TopicPicker from './topicPicker';
import { ViewMode } from './viewModeToggle';
import { ArticleViewer } from './articleViewer';
import BlocView from './blocView';
import CitizenCarousel from './citizenCarousel';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

// A story's change of size glides instead of jumping, the stories below it glide
// with it, and its expanded part fades in and out. Reanimated's layout animations
// run natively on the phone's new architecture, where LayoutAnimation did nothing,
// and through the Web Animations API in the browser.
const GLIDE = LinearTransition.duration(240);
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
}

/**
 * One story in the feed. Collapsed it is a single row: headline, who covered it,
 * how many. Opening it is what reveals the two ways of reading the same story.
 */
const StoryCard = ({ data, positions, setRatingOpen, setRatingTarget, mode,
                    topics = [], mergeArmed, onArmMerge, open, onToggle }: Props) => {
    const [viewerItem, setViewerItem] = useState<NewsItem | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [topic, setTopic] = useState<string>("");
    const t = useTheme();
    const dev = useDevMode();

    // In the browser Reanimated animates a change of size by scaling the box, which
    // smeared the text of the story being opened or closed. There the story that is
    // changing size - and an open one, whose content keeps settling - simply resizes
    // while its expanded part fades, and the stories around it still glide. The phone
    // animates real sizes, so there everything glides.
    const wasOpen = useRef(open);
    useEffect(() => { wasOpen.current = open; });
    const glide = Platform.OS !== "web" || (!open && !wasOpen.current) ? GLIDE : undefined;

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

    const applyTopic = async (next: string) => {
        setPickerOpen(false);
        setTopic(next);                       // optimistic: the sheet closes on the new value
        const ok = await setClusterTopic(lead.groupId ?? "", next);
        if (!ok) setTopic(lead.topic || "");
    };

    const handleOpenArticle = (item: NewsItem) => {
        setRatingTarget(item);

        // react-native-webview has no web build - on web the in-app viewer renders
        // "does not support this platform". Open the real site in a tab instead,
        // straight from the press handler so the popup blocker allows it.
        if (Platform.OS === "web") {
            Linking.openURL(item.link);
            saveWatch({ id: item.id, site: item.source, topic: item.topic, date: Date.now() });
            setRatingOpen(true);
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
    const handleViewerClosed = () => setRatingOpen(true);

    return (
        <Animated.View layout={glide} style={[styles.card, { backgroundColor: t.surfaceAlt },
            open && [styles.cardOpen, { backgroundColor: t.surface, borderColor: t.text }]]}>
            <TouchableOpacity activeOpacity={0.8} onPress={onToggle}>
                <View style={styles.titleRow}>
                    {!!firstPublished && <Text style={[styles.time, { color: t.textMuted }]}>{firstPublished}</Text>}
                    <Text style={[styles.title, { color: t.text }]} numberOfLines={open ? undefined : 2}>{lead.title}</Text>
                </View>
                {!open && (
                    <View style={styles.metaRow}>
                        <Text style={[styles.sources, { color: t.textMuted }]} numberOfLines={1}>{sources.join(" · ")}</Text>
                        {!!shownTopic && (
                            <TouchableOpacity
                                disabled={!dev}
                                onPress={() => setPickerOpen(true)}
                                style={[styles.topicPill, { borderColor: t.line, backgroundColor: t.surface },
                                    dev && { borderColor: t.brand, borderStyle: "dashed" }]}
                            >
                                <Text style={[styles.topicText, { color: dev ? t.brand : t.textMuted }]} numberOfLines={1}>
                                    {shownTopic}{dev ? "  ✎" : ""}
                                </Text>
                            </TouchableOpacity>
                        )}
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
                <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
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
        </Animated.View>
    );
};

export default StoryCard;

const styles = StyleSheet.create({
    card: {
        width: "100%", backgroundColor: "#F4F4F3", borderRadius: 12,
        padding: 11, marginBottom: 10, gap: 8,
        borderWidth: 1.5, borderColor: "transparent",
    },
    cardOpen: { backgroundColor: "#fff", borderColor: "#111827" },
    titleRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 9 },
    title: {
        flex: 1, fontFamily: "Heebo_700Bold", fontSize: 14.5, fontWeight: "700",
        lineHeight: 20, color: "#111827", textAlign: "right",
    },
    time: {
        fontFamily: "Heebo_500Medium", fontSize: 12, color: "#9CA3AF",
        lineHeight: 20, fontVariant: ["tabular-nums"],
    },
    // row-reverse puts the first child on the right: outlets there, topic pill left
    metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 6 },
    topicPill: {
        borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, maxWidth: 150,
    },
    topicText: { fontFamily: "Heebo_500Medium", fontSize: 10.5 },
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
