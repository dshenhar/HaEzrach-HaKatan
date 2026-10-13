import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { HotTopic } from "@/state/hotTopics";
import { track } from "@/state/analytics";
import { ROW, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Page, pressTint, SectionHead, Wrap } from "@/site/page";
import { Skeleton } from "@/site/controls";

/**
 * The affairs the right and the left are split on: the ones in today's news
 * first, then the rest of them, the most burning first.
 */
export default function Controversies() {
    const { c, type, wide } = useSite();
    const { hot, loading } = useNews();
    const router = useRouter();
    const today = (hot?.today ?? []).map((id) => hot?.topics.find((t) => t.id === id)).filter(Boolean) as HotTopic[];
    const rest = (hot?.topics ?? []).filter((t) => !hot?.today.includes(t.id)).sort((a, b) => b.relevance - a.relevance);

    const item = (t: HotTopic, big: boolean) => (
        <Pressable key={t.id} accessibilityRole="link"
            onPress={() => { track("hot_topic_opened", { id: t.id, from: "index" }); router.push({ pathname: "/controversies/[id]", params: { id: t.id } }); }}
            style={(s) => [styles.item, { borderTopColor: c.rule, width: wide ? "48.5%" : "100%" }, pressTint(c)(s)]}>
            <Text style={[big ? type.major : type.row, { color: c.ink }]}>{t.title}</Text>
            <Text style={[type.small, { color: c.ink2 }]} numberOfLines={big ? 4 : 2}>{t.one_line}</Text>
            {t.links.length > 0 && (
                <Text style={[type.meta, { color: c.muted }]}>
                    {t.links.length === 1 ? "סיפור אחד בחדשות היום" : `${t.links.length} סיפורים בחדשות היום`}
                </Text>
            )}
        </Pressable>
    );

    return (
        <Page back title="מחלוקות" nav="controversies">
            <Wrap style={styles.page}>
                <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">מחלוקות</Text>
                <Text style={[type.dek, styles.dek, { color: c.ink2, borderBottomColor: c.ruleStrong }]}>
                    הנושאים שהימין והשמאל חלוקים עליהם: מה קרה, איך כל צד מסקר את זה, איך הוא רואה את זה, ולמה.
                </Text>
                {loading && !hot ? <Skeleton lines={5} /> : (
                    <>
                        {today.length > 0 && (
                            <View style={styles.block}>
                                <SectionHead title="בחדשות היום" />
                                <View style={[styles.grid, { flexDirection: wide ? ROW : "column" }]}>{today.map((t) => item(t, true))}</View>
                            </View>
                        )}
                        <View style={styles.block}>
                            <SectionHead title="כל המחלוקות" />
                            <View style={[styles.grid, { flexDirection: wide ? ROW : "column" }]}>{rest.map((t) => item(t, false))}</View>
                        </View>
                    </>
                )}
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22, gap: 14 },
    dek: { borderBottomWidth: 3, paddingBottom: 18 },
    block: { marginTop: 22 },
    grid: { flexWrap: "wrap", justifyContent: "space-between" },
    item: { gap: 6, paddingVertical: 15, borderTopWidth: 1, paddingHorizontal: 6, marginHorizontal: -6 },
});
