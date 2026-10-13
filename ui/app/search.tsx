import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { indexStories, indexTopics, marked, MIN_QUERY, normalise, queryWords, search } from "@/state/search";
import { track } from "@/state/analytics";
import { HotTopic } from "@/state/hotTopics";
import { FACE, RADIUS, ROW, sectionColour, TYPE, useSite } from "@/site/tokens";
import { outlets, Reading, read, useNews, when } from "@/site/news";
import { Screen, SectionHead } from "@/site/page";

/** a headline with what was searched for set off in it, on the highlighter */
function Marked({ text, query, style }: { text: string; query: string; style: any }) {
    const { c } = useSite();
    return (
        <Text style={style}>
            {marked(text, query).map((part, i) => part.hit
                ? <Text key={i} style={{ backgroundColor: c.hi, color: c.hiInk }}>{part.text}</Text>
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
    const [focused, setFocused] = useState(false);
    const { c } = useSite();
    const { readings, hot, positions, tileOf } = useNews();
    const router = useRouter();

    const stories = useMemo(() => indexStories(readings.map((r) => r.story)), [readings]);
    const topics = useMemo(() => indexTopics(hot?.topics ?? []), [hot]);
    const results = useMemo(() => search(sent, stories, topics, new Set(hot?.today ?? [])), [sent, stories, topics, hot]);

    const run = () => {
        if (normalise(query).length < MIN_QUERY) return;
        track("search", { words: queryWords(query).length });
        setSent(query);
    };

    const story = (r: Reading, rank: number, first: boolean) => (
        <Pressable key={r.id} accessibilityRole="link"
            onPress={() => { track("search_result_opened", { kind: "story", rank }); router.push({ pathname: "/story/[id]", params: { id: r.id } }); }}
            style={({ pressed }) => [styles.result, { borderTopColor: c.rule, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }, pressed && { backgroundColor: c.pressed }]}>
            <View style={[styles.resultMeta, { flexDirection: ROW }]}>
                <View style={[styles.dot, { backgroundColor: sectionColour(r.section) }]} />
                <Text style={[TYPE.meta, { color: c.muted }]}>{[r.section, when(r.first), outlets(r.total)].filter(Boolean).join("  ·  ")}</Text>
            </View>
            <Marked text={r.lead.title} query={sent} style={[TYPE.row, { color: c.ink }]} />
        </Pressable>
    );
    const affair = (t: HotTopic, rank: number, first: boolean) => (
        <Pressable key={t.id} accessibilityRole="link"
            onPress={() => { track("search_result_opened", { kind: "hot_topic", rank }); router.push({ pathname: "/controversies/[id]", params: { id: t.id } }); }}
            style={({ pressed }) => [styles.result, { borderTopColor: c.rule, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }, pressed && { backgroundColor: c.pressed }]}>
            <View style={[styles.resultMeta, { flexDirection: ROW }]}>
                <View style={[styles.dot, { backgroundColor: tileOf(t.id) }]} />
                <Text style={[TYPE.meta, { color: c.muted }]}>מחלוקת</Text>
            </View>
            <Marked text={t.title} query={sent} style={[TYPE.row, { color: c.ink }]} />
            <Text style={[TYPE.small, { color: c.ink2 }]} numberOfLines={2}>{t.one_line}</Text>
        </Pressable>
    );

    const searched = normalise(sent).length >= MIN_QUERY;
    const none = searched && !results.stories.length && !results.today.length && !results.others.length;
    const affairs = [...results.today, ...results.others];

    return (
        <Screen back title="חיפוש" docTitle="חיפוש">
            <View style={[styles.field, { backgroundColor: c.card, flexDirection: ROW, borderColor: focused ? c.brand : c.rule }]}>
                <Ionicons name="search" size={22} color={c.muted} />
                <TextInput value={query} onChangeText={setQuery} onSubmitEditing={run} autoFocus
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    returnKeyType="search" placeholder="חיפוש בחדשות היום ובמחלוקות"
                    placeholderTextColor={c.muted} accessibilityLabel="חיפוש"
                    style={[styles.input, { color: c.ink }]} />
                {!!query && (
                    <Pressable onPress={() => { setQuery(""); setSent(""); }} accessibilityRole="button" accessibilityLabel="ניקוי" hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={c.muted} />
                    </Pressable>
                )}
            </View>
            {!searched && (
                <Text style={[TYPE.small, styles.hint, { color: c.ink2 }]}>
                    שם, מקום או נושא. החיפוש מכיר גם כינויים וקיצורים: ביבי ונתניהו, בג״ץ ובית המשפט העליון.
                </Text>
            )}
            {none && <Text style={[TYPE.body, styles.hint, { color: c.muted }]}>לא נמצא דבר על &quot;{sent}&quot; בחדשות היום.</Text>}
            {results.stories.length > 0 && (
                <>
                    <SectionHead title="בחדשות היום" count={results.stories.length} />
                    <View style={[styles.card, { backgroundColor: c.card }]}>
                        {results.stories.map((s, i) => story(read(s, positions), i + 1, i === 0))}
                    </View>
                </>
            )}
            {affairs.length > 0 && (
                <>
                    <SectionHead title="מחלוקות" count={affairs.length} />
                    <View style={[styles.card, { backgroundColor: c.card }]}>
                        {affairs.map((t, i) => affair(t, i + 1, i === 0))}
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    field: { marginHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 2, alignItems: "center", gap: 10, paddingHorizontal: 16, height: 52 },
    input: { flex: 1, fontFamily: FACE.medium, fontSize: 17, height: 48, textAlign: "right", writingDirection: "rtl", outlineStyle: "none" } as any,
    hint: { paddingHorizontal: 18, paddingTop: 14 },
    card: { marginHorizontal: 12, borderRadius: RADIUS.card, overflow: "hidden" },
    result: { gap: 6, paddingHorizontal: 16, paddingVertical: 13 },
    resultMeta: { alignItems: "center", gap: 7 },
    dot: { width: 8, height: 8, borderRadius: 4 },
});
