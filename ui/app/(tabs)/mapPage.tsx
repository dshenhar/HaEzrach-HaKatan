import SwipeTabs from '@/components/swipeTabs';
import HotTopicCard from '@/components/hotTopicCard';
import { track } from '@/state/analytics';
import { requestStory } from '@/state/feedFocus';
import { HotPage, HotTopic, loadHot, polarFive } from '@/state/hotTopics';
import { SWELL, TYPE } from '@/state/craft';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, I18nManager, NativeScrollEvent, NativeSyntheticEvent, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
/** the page's top padding and the room between its blocks - the scroll's map of
 *  where each box starts is added up from these */
const PAD_TOP = 10;
const GAP = 16;
/** where on the screen the page asks "which box is the reader on", as the feed does */
const ANCHOR = 0.32;

type Block = { key: string; node: React.ReactNode };

/**
 * Hot topics. Two sections, each a box per affair:
 *
 *   today      at most three affairs that today's feed has stories on, the most
 *              covered first - and none at all on a day that has none
 *   polarized  five from the pool of affairs the country is split on: three of
 *              the burning ones and two quieter, drawn again on every visit
 *
 * A box is folded until it is touched. While the page moves, the box under the
 * reader's thumb swells a little, as a story does in the feed.
 *
 * The tab keeps the route the map had (mapPage): the swipe between tabs uses it.
 */
export default function MapPage() {
    const router = useRouter();
    const [page, setPage] = useState<HotPage | null>(null);
    const [failed, setFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [open, setOpen] = useState<Set<string>>(() => new Set());

    const take = (next: HotPage | null) => {
        if (next) setPage(next);
        setFailed(!next);
    };
    const load = async () => take(await loadHot());
    useEffect(() => {
        let live = true;
        loadHot().then((next) => { if (live) take(next); });
        return () => { live = false; };
    }, []);

    const today = useMemo(() => {
        if (!page) return [];
        const byId = new Map(page.topics.map((t) => [t.id, t]));
        return page.today.map((id) => byId.get(id)).filter(Boolean) as HotTopic[];
    }, [page]);
    const polar = useMemo(() => (page ? polarFive(page) : []), [page]);

    const openStory = (topic: HotTopic, storyId: string) => {
        track("hot_topic_link_opened", { topic: topic.id });
        requestStory(storyId);
        router.replace("/");
    };

    const toggle = (key: string, topic: HotTopic, section: string) => {
        setOpen((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
                track("hot_topic_opened", { topic: topic.id, section });
            }
            return next;
        });
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    // The swell under the scroll. Which box the reader is on is worked out from the
    // boxes' heights added up in order, as the feed does it: react-native-web reports
    // a layout when a view changes size, never when it merely moves - and a box above
    // that opens moves every box under it.
    const heights = useRef<Record<string, number>>({});
    const viewportH = useRef(0);
    const focusRef = useRef<string | null>(null);
    const moving = useRef(false);
    const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [focusKey, setFocusKey] = useState<string | null>(null);
    const [scrolling, setScrolling] = useState(false);
    useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

    const divider = (label: string) => (
        <View style={[styles.divider, { flexDirection: FROM_RIGHT }]}>
            <Text style={styles.dividerText}>{label}</Text>
            <View style={styles.rule} />
        </View>
    );
    const card = (topic: HotTopic, section: "today" | "polar") => {
        const key = `${section}:${topic.id}`;
        return {
            key,
            node: (
                <HotTopicCard topic={topic} today={section === "today"}
                    open={open.has(key)}
                    focused={scrolling && focusKey === key}
                    onToggle={() => toggle(key, topic, section)}
                    onOpenStory={(id) => openStory(topic, id)} />
            ),
        };
    };

    const blocks: Block[] = [{ key: "title", node: <Text style={styles.title}>נושאים חמים</Text> }];
    if (!page) {
        blocks.push({
            key: "loading",
            node: failed ? (
                <TouchableOpacity onPress={load} style={styles.retry} accessibilityRole="button">
                    <Text style={styles.muted}>לא הצלחנו לטעון. לנסות שוב</Text>
                </TouchableOpacity>
            ) : <ActivityIndicator style={{ marginTop: 40 }} />,
        });
    } else {
        blocks.push({ key: "today-head", node: divider("הנושאים החמים היום") });
        if (today.length === 0) {
            blocks.push({ key: "today-none",
                node: <Text style={styles.muted}>היום עוד לא עלה בפיד נושא מהמחלוקות הגדולות</Text> });
        }
        today.forEach((topic) => blocks.push(card(topic, "today")));
        blocks.push({ key: "polar-head", node: divider("מקוטבים") });
        blocks.push({ key: "polar-note", node: <Text style={styles.note}>מחלוקות שמפלגות את המדינה</Text> });
        polar.forEach((topic) => blocks.push(card(topic, "polar")));
    }
    const order = blocks.map((block) => block.key);

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const line = e.nativeEvent.contentOffset.y + viewportH.current * ANCHOR;
        let top = PAD_TOP;
        let key: string | null = null;
        for (const k of order) {
            const h = heights.current[k] ?? 0;
            if (line >= top && line < top + h) { key = k; break; }
            top += h + GAP;
        }
        if (key !== focusRef.current) {
            focusRef.current = key;
            setFocusKey(key);
        }
        if (!moving.current) { moving.current = true; setScrolling(true); }
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => { moving.current = false; setScrolling(false); }, SWELL.lingerMs);
    };

    return (
        <SwipeTabs>
            <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {blocks.map(({ key, node }) => (
                        <View key={key} onLayout={(e) => { heights.current[key] = e.nativeEvent.layout.height; }}>
                            {node}
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </SwipeTabs>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8F8F8" },
    scroll: { flex: 1, width: "100%" },
    // the floating tab bar stands on the foot of every screen
    body: { paddingHorizontal: 16, paddingTop: PAD_TOP, paddingBottom: 110, gap: GAP },
    // the same title the feed and the analytics page start with
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 23, color: "#111827", textAlign: "right" },
    divider: { alignItems: "center", gap: 10, marginTop: 8 },
    dividerText: { ...TYPE.label, fontSize: 14, color: "#111827" },
    rule: { flex: 1, height: 1, backgroundColor: "#D9D8D4" },
    note: { ...TYPE.caption, color: "#6B7280", textAlign: "right", marginTop: -8 },
    muted: { ...TYPE.body, color: "#9CA3AF", textAlign: "right" },
    retry: { paddingVertical: 20 },
});
