import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { HotTopic } from "@/state/hotTopics";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Screen, SectionHead } from "@/site/page";
import { Skeleton } from "@/site/controls";

/**
 * The affairs the right and the left are split on: the ones in today's news
 * first, large, then the rest of them, the most burning first, two to a row.
 * Each wears its own colour, the same one wherever it appears.
 */
export default function Controversies() {
    const { c } = useSite();
    const { hot, loading, hotOrdered, tileOf } = useNews();
    const router = useRouter();
    const today = hotOrdered.filter((t) => hot?.today.includes(t.id));
    const rest = hotOrdered.filter((t) => !hot?.today.includes(t.id));
    const go = (t: HotTopic) => {
        track("hot_topic_opened", { id: t.id, from: "index" });
        router.push({ pathname: "/controversies/[id]", params: { id: t.id } });
    };
    const stories = (t: HotTopic) => t.links.length === 1 ? "סיפור אחד בחדשות היום" : `${t.links.length} סיפורים בחדשות היום`;

    return (
        <Screen title="מחלוקות" docTitle="מחלוקות">
            <Text style={[TYPE.small, styles.lede, { color: c.ink2 }]}>
                הנושאים שהימין והשמאל חלוקים עליהם: מה קרה, איך כל צד מסקר את זה, איך הוא רואה את זה, ולמה.
            </Text>
            {loading && !hot ? <Skeleton cards={4} /> : (
                <>
                    {today.length > 0 && (
                        <>
                            <SectionHead title="בחדשות היום" count={today.length} />
                            <View style={styles.big}>
                                {today.map((t) => (
                                    <Pressable key={t.id} onPress={() => go(t)} accessibilityRole="link" accessibilityLabel={t.title}
                                        style={({ pressed }) => [styles.bigTile, { backgroundColor: tileOf(t.id) }, pressed && styles.pressed]}>
                                        <Text style={[TYPE.h1, { color: c.onColour }]}>{t.title}</Text>
                                        <Text style={[TYPE.body, { color: c.onColourMuted }]} numberOfLines={4}>{t.one_line}</Text>
                                        {t.links.length > 0 && (
                                            <View style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                                                <Text style={[styles.pillText, { color: c.onColour }]}>{stories(t)}</Text>
                                            </View>
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}
                    <SectionHead title="כל המחלוקות" count={rest.length} />
                    <View style={[styles.grid, { flexDirection: ROW }]}>
                        {rest.map((t) => (
                            <Pressable key={t.id} onPress={() => go(t)} accessibilityRole="link" accessibilityLabel={t.title}
                                style={({ pressed }) => [styles.tile, { backgroundColor: tileOf(t.id) }, pressed && styles.pressed]}>
                                <Text style={[TYPE.row, { color: c.onColour }]} numberOfLines={4}>{t.title}</Text>
                                <Text style={[TYPE.meta, { color: c.onColourMuted }]} numberOfLines={3}>{t.one_line}</Text>
                            </Pressable>
                        ))}
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
    lede: { paddingHorizontal: 18, paddingBottom: 4 },
    big: { gap: 12, paddingHorizontal: 12 },
    bigTile: { borderRadius: 24, padding: 18, gap: 10, minHeight: 180, justifyContent: "flex-end" },
    pill: { alignSelf: "flex-end", borderRadius: RADIUS.chip, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
    pillText: { fontFamily: FACE.semi, fontSize: 12.5, lineHeight: 16 },
    grid: { flexWrap: "wrap", gap: 10, paddingHorizontal: 12 },
    tile: { width: "48.4%", borderRadius: 20, padding: 14, gap: 7, minHeight: 150, justifyContent: "flex-end" },
});
