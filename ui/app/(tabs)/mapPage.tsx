import SwipeTabs from '@/components/swipeTabs';
import HotTopicCard from '@/components/hotTopicCard';
import Press from '@/components/press';
import RtlCarousel from '@/components/rtlCarousel';
import SearchOverlay, { SearchField } from '@/components/searchOverlay';
import TopicSheet from '@/components/topicSheet';
import { track } from '@/state/analytics';
import { loadFeed, NewsItem } from '@/state/engagement';
import { onTopicRequest, requestStory, takeTopicRequest } from '@/state/feedFocus';
import { HotPage, HotTopic, loadHot, MORE_STEP, polarFive, polarRest } from '@/state/hotTopics';
import { MIN_QUERY, normalise, queryWords } from '@/state/search';
import { TYPE } from '@/state/craft';
import { useStable } from '@/state/useStable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, I18nManager, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity,
    View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";

/**
 * The affairs the country is split on. At its head the search, over the whole app;
 * under it two rows of cards, each swiped sideways:
 *
 *   on today's agenda  the affairs today's feed has stories on, the most covered
 *                      first - and a quiet line on a day that has none
 *   core issues        five from the pool: three of the burning ones and two
 *                      quieter, drawn again on every visit, and at the row's far end
 *                      "more issues", which adds five more each time until the pool
 *                      is all there. Leaving the page puts the row back to its five.
 *
 * A card opens its affair whole in a sheet from the foot of the screen.
 *
 * The tab keeps the route the map had (mapPage): the swipe between tabs uses it.
 */
export default function MapPage() {
    const router = useRouter();
    const [page, setPage] = useState<HotPage | null>(null);
    const [failed, setFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // the affair the sheet shows, kept while it slides away, and whether it is up
    const [sheet, setSheet] = useState<HotTopic | null>(null);
    const [sheetUp, setSheetUp] = useState(false);

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

    // the search: what is typed, whether its results are open, and today's feed,
    // which it searches along with the affairs
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [stories, setStories] = useState<NewsItem[][]>([]);
    useEffect(() => {
        let live = true;
        loadFeed().then((feed) => { if (live && feed) setStories(feed); });
        return () => { live = false; };
    }, []);
    // what was searched is not sent anywhere, only how long it was
    const runSearch = () => {
        if (normalise(query).length < MIN_QUERY) return;
        track("search", { words: queryWords(query).length });
        setSearching(true);
    };

    // how many of the rest "more issues" has opened; the tab stays mounted when the
    // reader goes elsewhere, so it is put back to none as they leave
    const [more, setMore] = useState(0);
    useFocusEffect(useCallback(() => () => {
        setMore(0);
        setSheetUp(false);
    }, []));

    const today = useMemo(() => {
        if (!page) return [];
        const byId = new Map(page.topics.map((t) => [t.id, t]));
        return page.today.map((id) => byId.get(id)).filter(Boolean) as HotTopic[];
    }, [page]);
    const polar = useMemo(() => (page ? polarFive(page) : []), [page]);
    const rest = useMemo(() => (page ? polarRest(page, polar) : []), [page, polar]);
    const core = useMemo(() => [...polar, ...rest.slice(0, more)], [polar, rest, more]);

    const open = (topic: HotTopic, from: string) => {
        track("hot_topic_opened", { topic: topic.id, section: from });
        setSheet(topic);
        setSheetUp(true);
    };
    const showMore = () => {
        const next = Math.min(more + MORE_STEP, rest.length);
        setMore(next);
        track("hot_topics_more", { shown: polar.length + next });
    };
    const openStory = (topic: HotTopic, storyId: string) => {
        track("hot_topic_link_opened", { topic: topic.id });
        setSheetUp(false);
        requestStory(storyId);
        router.navigate("/");
    };

    // a search elsewhere may ask for an affair: it opens here, once the page is in
    const [asked, setAsked] = useState(() => takeTopicRequest());
    useEffect(() => onTopicRequest(() => setAsked(takeTopicRequest())), []);
    const serveRequest = useStable(() => {
        if (!asked || !page) return;
        const topic = page.topics.find((t) => t.id === asked.id);
        setAsked(null);
        if (topic) open(topic, asked.how);
    });
    useEffect(() => { serveRequest(); }, [asked, page, serveRequest]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const divider = (label: string) => (
        <View style={[styles.divider, { flexDirection: FROM_RIGHT }]}>
            <Text style={styles.dividerText}>{label}</Text>
            <View style={styles.rule} />
        </View>
    );
    const renderCard = (topic: HotTopic, from: string) => (
        <HotTopicCard topic={topic} onOpen={() => open(topic, from)} />
    );

    return (
        <SwipeTabs>
            <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={[styles.searchRow, { flexDirection: FROM_RIGHT }]}>
                        <View style={styles.searchField}>
                            <SearchField value={query} onChange={setQuery} onSubmit={runSearch} />
                        </View>
                        <Press style={styles.go} onPress={runSearch}
                            accessibilityRole="button" accessibilityLabel="הצגת התוצאות">
                            <Text style={styles.goText}>חיפוש</Text>
                        </Press>
                    </View>

                    {!page ? (
                        failed ? (
                            <TouchableOpacity onPress={load} style={styles.retry} accessibilityRole="button">
                                <Text style={styles.muted}>לא הצלחנו לטעון. לנסות שוב</Text>
                            </TouchableOpacity>
                        ) : <ActivityIndicator style={{ marginTop: 40 }} />
                    ) : (
                        <>
                            <View style={styles.section}>
                                {divider("סוגיות על סדר היום")}
                                {today.length === 0 ? (
                                    <Text style={[styles.muted, styles.inset]}>
                                        היום עוד לא עלתה בפיד סוגיה מהמחלוקות הגדולות
                                    </Text>
                                ) : (
                                    <RtlCarousel items={today} keyOf={(t) => t.id} render={(t) => renderCard(t, "today")} />
                                )}
                            </View>

                            <View style={styles.section}>
                                {divider("סוגיות ליבה")}
                                <Text style={[styles.note, styles.inset]}>מחלוקות שמפלגות את המדינה</Text>
                                <RtlCarousel
                                    items={core}
                                    keyOf={(t) => t.id}
                                    render={(t) => renderCard(t, "core")}
                                    end={more < rest.length ? () => (
                                        <Press style={styles.more} onPress={showMore}
                                            accessibilityRole="button" accessibilityLabel="עוד סוגיות">
                                            <View style={styles.moreDisc}>
                                                <Ionicons name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
                                                    size={22} color="#111827" />
                                            </View>
                                            <Text style={styles.moreText}>עוד סוגיות</Text>
                                        </Press>
                                    ) : undefined}
                                />
                            </View>
                        </>
                    )}
                </ScrollView>

                <SearchOverlay
                    open={searching}
                    query={query}
                    onQuery={setQuery}
                    onClose={() => setSearching(false)}
                    stories={stories}
                    onStory={(story, rank) => {
                        track("search_result_opened", { kind: "story", rank });
                        setSearching(false);
                        requestStory(String(story[0].groupId), "search");
                        router.navigate("/");
                    }}
                    onTopic={(topic, rank) => {
                        track("search_result_opened", { kind: "hot_topic", rank });
                        setSearching(false);
                        // after the results window has gone, or the two would cross
                        setTimeout(() => open(topic, "search"), 350);
                    }}
                />
                <TopicSheet topic={sheet} visible={sheetUp} onClose={() => setSheetUp(false)} onOpenStory={openStory} />
            </SafeAreaView>
        </SwipeTabs>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    scroll: { flex: 1, width: "100%" },
    // the floating tab bar stands on the foot of every screen
    body: { paddingTop: 12, paddingBottom: 110, gap: 22 },
    inset: { paddingHorizontal: 16 },
    searchRow: { alignItems: "center", gap: 8, paddingHorizontal: 16 },
    searchField: { flex: 1 },
    go: {
        height: 40, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
        backgroundColor: "#111827",
    },
    goText: { fontFamily: "Rubik_700Bold", fontSize: 14, color: "#FFFFFF" },
    section: { gap: 12 },
    divider: { alignItems: "center", gap: 10, paddingHorizontal: 16 },
    dividerText: { ...TYPE.label, fontSize: 15, color: "#111827" },
    rule: { flex: 1, height: 1, backgroundColor: "#E4E3DF" },
    note: { ...TYPE.caption, color: "#6B7280", textAlign: "right", marginTop: -6 },
    muted: { ...TYPE.body, color: "#9CA3AF", textAlign: "right" },
    retry: { paddingVertical: 20, paddingHorizontal: 16 },
    // the row's far end: a round arrow and its words, as tall as the cards beside it
    more: { width: 110, flex: 1, alignItems: "center", justifyContent: "center", gap: 8, minHeight: 150 },
    moreDisc: {
        width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
        backgroundColor: "#F4F4F3",
    },
    moreText: { ...TYPE.label, fontSize: 13.5, color: "#111827" },
});
