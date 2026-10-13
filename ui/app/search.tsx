import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { indexStories, indexTopics, marked, MIN_QUERY, normalise, queryWords, search } from "@/state/search";
import { track } from "@/state/analytics";
import { HotTopic } from "@/state/hotTopics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { outlets, Reading, read, useNews, when } from "@/site/news";
import { Page, pressTint, SectionHead, Wrap } from "@/site/page";

/** a headline with what was searched for set off in it */
function Marked({ text, query, style }: { text: string; query: string; style: any }) {
    const { c } = useSite();
    return (
        <Text style={style}>
            {marked(text, query).map((part, i) => part.hit
                ? <Text key={i} style={{ backgroundColor: c.mark }}>{part.text}</Text>
                : <Text key={i}>{part.text}</Text>)}
        </Text>
    );
}

/**
 * Search the day: today's stories and every controversy, by any word of a
 * headline or a summary. What was searched is never sent anywhere - only how
 * many words it had.
 */
export default function Search() {
    const params = useLocalSearchParams<{ q?: string }>();
    const [query, setQuery] = useState(String(params.q ?? ""));
    const [sent, setSent] = useState(String(params.q ?? ""));
    const { c, type } = useSite();
    const { readings, hot, positions } = useNews();
    const router = useRouter();

    const stories = useMemo(() => indexStories(readings.map((r) => r.story)), [readings]);
    const topics = useMemo(() => indexTopics(hot?.topics ?? []), [hot]);
    const results = useMemo(() => search(sent, stories, topics, new Set(hot?.today ?? [])), [sent, stories, topics, hot]);

    const run = () => {
        if (normalise(query).length < MIN_QUERY) return;
        track("search", { words: queryWords(query).length });
        setSent(query);
    };

    const story = (r: Reading, rank: number) => (
        <Pressable key={r.id} accessibilityRole="link"
            onPress={() => { track("search_result_opened", { kind: "story", rank }); router.push({ pathname: "/story/[id]", params: { id: r.id } }); }}
            style={(s) => [styles.result, { borderTopColor: c.rule }, pressTint(c)(s)]}>
            <Marked text={r.lead.title} query={sent} style={[type.row, { color: c.ink }]} />
            <Text style={[type.meta, { color: c.muted }]}>{[r.section, when(r.first), outlets(r.total)].filter(Boolean).join("  ·  ")}</Text>
        </Pressable>
    );
    const affair = (t: HotTopic, rank: number) => (
        <Pressable key={t.id} accessibilityRole="link"
            onPress={() => { track("search_result_opened", { kind: "hot_topic", rank }); router.push({ pathname: "/controversies/[id]", params: { id: t.id } }); }}
            style={(s) => [styles.result, { borderTopColor: c.rule }, pressTint(c)(s)]}>
            <Marked text={t.title} query={sent} style={[type.row, { color: c.ink }]} />
            <Text style={[type.small, { color: c.ink2 }]} numberOfLines={2}>{t.one_line}</Text>
        </Pressable>
    );

    const searched = normalise(sent).length >= MIN_QUERY;
    const none = searched && !results.stories.length && !results.today.length && !results.others.length;

    return (
        <Page back title="חיפוש">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <View style={[styles.field, { flexDirection: ROW, borderBottomColor: c.ruleStrong }]}>
                        <Ionicons name="search" size={26} color={c.ink} />
                        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={run} autoFocus
                            returnKeyType="search" placeholder="חיפוש בחדשות היום ובמחלוקות"
                            placeholderTextColor={c.muted} accessibilityLabel="חיפוש"
                            style={[styles.input, { color: c.ink }]} />
                        {!!query && (
                            <Pressable onPress={() => { setQuery(""); setSent(""); }} accessibilityRole="button" accessibilityLabel="ניקוי" hitSlop={8}>
                                <Ionicons name="close" size={24} color={c.muted} />
                            </Pressable>
                        )}
                    </View>
                    {!searched && (
                        <Text style={[type.small, { color: c.ink2 }]}>
                            שם, מקום או נושא. החיפוש מכיר גם כינויים וקיצורים: ביבי ונתניהו, בג״ץ ובית המשפט העליון.
                        </Text>
                    )}
                    {none && <Text style={[type.body, { color: c.muted }]}>לא נמצא דבר על &quot;{sent}&quot; בחדשות היום.</Text>}
                    {results.stories.length > 0 && (
                        <View style={styles.block}>
                            <SectionHead title="בחדשות היום" />
                            {results.stories.map((s, i) => story(read(s, positions), i + 1))}
                        </View>
                    )}
                    {results.today.length + results.others.length > 0 && (
                        <View style={styles.block}>
                            <SectionHead title="מחלוקות" />
                            {[...results.today, ...results.others].map((t, i) => affair(t, i + 1))}
                        </View>
                    )}
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 18 },
    column: { maxWidth: 760, width: "100%", alignSelf: "center", gap: 14 },
    field: { alignItems: "center", gap: 10, borderBottomWidth: 3, paddingBottom: 6 },
    input: { flex: 1, fontFamily: FACE.serifBold, fontSize: 24, lineHeight: 32, paddingVertical: 6, textAlign: "right", writingDirection: "rtl" },
    block: { marginTop: 16 },
    result: { gap: 5, paddingVertical: 13, borderTopWidth: 1, paddingHorizontal: 6, marginHorizontal: -6 },
});
