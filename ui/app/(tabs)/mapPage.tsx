import SwipeTabs from '@/components/swipeTabs';
import HotTopicCard from '@/components/hotTopicCard';
import { track } from '@/state/analytics';
import { requestStory } from '@/state/feedFocus';
import { HotPage, HotTopic, loadHot, polarFive } from '@/state/hotTopics';
import { TYPE } from '@/state/craft';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, I18nManager, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";

/**
 * Hot topics. Two sections, each a box per affair:
 *
 *   today      at most three affairs that today's feed has stories on, the most
 *              covered first - and none at all on a day that has none
 *   polarized  five from the pool of affairs the country is split on: three of
 *              the burning ones and two quieter, drawn again on every visit
 *
 * The tab keeps the route the map had (mapPage): the swipe between tabs uses it.
 */
export default function MapPage() {
    const router = useRouter();
    const [page, setPage] = useState<HotPage | null>(null);
    const [failed, setFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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

    return (
        <SwipeTabs>
            <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <Text style={styles.title}>נושאים חמים</Text>

                    {!page ? (
                        failed ? (
                            <TouchableOpacity onPress={load} style={styles.retry} accessibilityRole="button">
                                <Text style={styles.muted}>לא הצלחנו לטעון. לנסות שוב</Text>
                            </TouchableOpacity>
                        ) : (
                            <ActivityIndicator style={{ marginTop: 40 }} />
                        )
                    ) : (
                        <>
                            {divider("הנושאים החמים היום")}
                            {today.length === 0 ? (
                                <Text style={styles.muted}>היום עוד לא עלה בפיד נושא מהמחלוקות הגדולות</Text>
                            ) : today.map((topic) => (
                                <HotTopicCard key={topic.id} topic={topic} today
                                    onOpenStory={(id) => openStory(topic, id)} />
                            ))}

                            {divider("מקוטבים")}
                            <Text style={styles.note}>
                                מחלוקות שמפלגות את המדינה - מתחלפות בכל כניסה
                            </Text>
                            {polar.map((topic) => (
                                <HotTopicCard key={topic.id} topic={topic}
                                    onOpenStory={(id) => openStory(topic, id)} />
                            ))}
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </SwipeTabs>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8F8F8" },
    scroll: { flex: 1, width: "100%" },
    // the floating tab bar stands on the foot of every screen
    body: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 110, gap: 12 },
    // the same title the feed and the analytics page start with
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 23, color: "#111827", textAlign: "right" },
    divider: { alignItems: "center", gap: 10, marginTop: 8 },
    dividerText: { ...TYPE.label, fontSize: 14, color: "#111827" },
    rule: { flex: 1, height: 1, backgroundColor: "#D9D8D4" },
    note: { ...TYPE.caption, color: "#6B7280", textAlign: "right", marginTop: -6 },
    muted: { ...TYPE.body, color: "#9CA3AF", textAlign: "right" },
    retry: { paddingVertical: 20 },
});
