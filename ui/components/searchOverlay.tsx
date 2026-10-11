import { NewsItem } from '@/state/engagement';
import { HotTopic, keptHot, topicPicture } from '@/state/hotTopics';
import { indexStories, indexTopics, marked, MIN_QUERY, normalise, search } from '@/state/search';
import { sectionColour } from '@/state/sections';
import { useTheme } from '@/state/theme';
import { ELEVATION, TYPE } from '@/state/craft';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { I18nManager, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
    TextStyle, View } from 'react-native';

// the phone lays the app out right to left and the web build does not
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
// a field's focus ring is the browser's, drawn square around a round field
const NO_RING = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as TextStyle;

type FieldProps = {
    value: string;
    onChange: (text: string) => void;
    onSubmit?: () => void;
    autoFocus?: boolean;
};

/** The search field: the feed's search row has it, and so does the results window. */
export function SearchField({ value, onChange, onSubmit, autoFocus }: FieldProps) {
    const t = useTheme();
    return (
        <View style={[styles.field, { flexDirection: FROM_RIGHT, borderColor: t.line, backgroundColor: t.surface }]}>
            <Ionicons name="search" size={16} color={t.textMuted} />
            <TextInput
                value={value}
                onChangeText={onChange}
                onSubmitEditing={onSubmit}
                autoFocus={autoFocus}
                returnKeyType="search"
                placeholder="חיפוש בפיד ובנושאים החמים"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="מה לחפש"
                style={[styles.input, NO_RING, { color: t.text }]}
            />
            {!!value && (
                <Press onPress={() => onChange("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש">
                    <Ionicons name="close-circle" size={17} color={t.textMuted} />
                </Press>
            )}
        </View>
    );
}

type Props = {
    open: boolean;
    query: string;
    onQuery: (text: string) => void;
    onClose: () => void;
    /** today's feed, all of it and not only what its filters let through */
    stories: NewsItem[][];
    onStory: (story: NewsItem[], rank: number) => void;
    onTopic: (topic: HotTopic, rank: number) => void;
};

/**
 * The results of a search, in a window that floats over the whole app - most of the
 * screen, with the rest blurred behind it, and a touch there closes it. Today's
 * stories come first, then today's hot topics, then the rest of the pool; a touch
 * on any takes the reader to it, open: the story in the feed, the affair on its page.
 *
 * The query can be changed in the window itself, and the results follow as it is
 * typed.
 */
export default function SearchOverlay({ open, query, onQuery, onClose, stories, onStory, onTopic }: Props) {
    const t = useTheme();
    const dark = t.name === "negative";
    const [topics, setTopics] = useState<HotTopic[]>([]);
    const [todayIds, setTodayIds] = useState<ReadonlySet<string>>(() => new Set());
    useEffect(() => {
        if (!open) return;
        let live = true;
        keptHot().then((page) => {
            if (!live || !page) return;
            setTopics(page.topics);
            setTodayIds(new Set(page.today));
        });
        return () => { live = false; };
    }, [open]);

    const storyIndex = useMemo(() => indexStories(stories), [stories]);
    const topicIndex = useMemo(() => indexTopics(topics), [topics]);
    const found = useMemo(() => search(query, storyIndex, topicIndex, todayIds),
        [query, storyIndex, topicIndex, todayIds]);
    const count = found.stories.length + found.today.length + found.others.length;
    const short = normalise(query).length < MIN_QUERY;

    const words = (text: string, style: TextStyle | TextStyle[], lines: number) => (
        <Text style={style} numberOfLines={lines}>
            {marked(text, query).map((part, i) => (
                <Text key={i} style={part.hit ? [styles.hit, { color: t.text }] : undefined}>{part.text}</Text>
            ))}
        </Text>
    );

    const affair = (topic: HotTopic, rank: number) => (
        <Press key={topic.id} scale={0.985}
            style={[styles.row, { flexDirection: FROM_RIGHT, backgroundColor: t.surface, borderColor: t.line }]}
            onPress={() => onTopic(topic, rank)}
            accessibilityRole="button" accessibilityLabel={`נושא חם: ${topic.title}`}>
            <View style={styles.rowText}>
                {words(topic.title, [styles.title, { color: t.text }], 2)}
                {!!topic.one_line && words(topic.one_line, [styles.sub, { color: t.textMuted }], 2)}
            </View>
            <Image source={{ uri: topicPicture(topic.id) }} style={styles.thumb}
                accessible={false} resizeMode="cover" />
        </Press>
    );

    return (
        <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.screen}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}
                    accessibilityRole="button" accessibilityLabel="סגירת החיפוש">
                    <BlurView intensity={30} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(0,0,0,0.35)" : "rgba(17,24,39,0.16)" }]} />
                </Pressable>

                <View style={[styles.window, { backgroundColor: t.bg, borderColor: t.line }]}
                    accessibilityViewIsModal>
                    <View style={[styles.head, { flexDirection: FROM_RIGHT }]}>
                        <View style={styles.headField}>
                            <SearchField value={query} onChange={onQuery} />
                        </View>
                        <Press style={[styles.close, { backgroundColor: t.surface, borderColor: t.line }]}
                            onPress={onClose} hitSlop={6} accessibilityRole="button" accessibilityLabel="סגירה">
                            <Ionicons name="close" size={18} color={t.text} />
                        </Press>
                    </View>
                    <Text style={[styles.count, { color: t.textMuted }]}>
                        {short ? `כתבו לפחות ${MIN_QUERY} אותיות`
                            : count === 0 ? "לא נמצא דבר בפיד של היום ובנושאים החמים"
                            : count === 1 ? "תוצאה אחת" : `${count} תוצאות`}
                    </Text>

                    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {found.stories.length > 0 && (
                            <Text style={[styles.label, { color: t.textMuted }]}>מהפיד</Text>
                        )}
                        {found.stories.map((story, i) => {
                            const first = story[0];
                            return (
                                <Press key={String(first.groupId ?? first.id)} scale={0.985}
                                    style={[styles.row, styles.storyRow, { backgroundColor: t.surface, borderColor: t.line }]}
                                    onPress={() => onStory(story, i)}
                                    accessibilityRole="button" accessibilityLabel={`בפיד: ${first.title}`}>
                                    <View style={[styles.meta, { flexDirection: FROM_RIGHT }]}>
                                        {!!first.section && (
                                            <Text style={[styles.section, { color: sectionColour(first.section, dark) }]}>
                                                {first.section}
                                            </Text>
                                        )}
                                        <Text style={[styles.outlets, { color: t.textMuted }]}>
                                            {story.length === 1 ? "גוף אחד" : `${story.length} גופים`}
                                        </Text>
                                    </View>
                                    {words(first.title, [styles.title, { color: t.text }], 3)}
                                </Press>
                            );
                        })}

                        {found.today.length > 0 && (
                            <Text style={[styles.label, { color: t.textMuted }]}>נושאים חמים מהיום</Text>
                        )}
                        {found.today.map((topic, i) => affair(topic, i))}

                        {found.others.length > 0 && (
                            <Text style={[styles.label, { color: t.textMuted }]}>בעוד נושאים חמים</Text>
                        )}
                        {found.others.map((topic, i) => affair(topic, found.today.length + i))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, alignItems: "center", justifyContent: "center" },
    // most of the screen, and the blurred app around it says it is still there
    window: {
        width: "92%", maxWidth: 640, height: "80%", borderRadius: 22, borderWidth: 1,
        overflow: "hidden", boxShadow: ELEVATION.raised,
    },
    head: { alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 14 },
    headField: { flex: 1 },
    close: {
        width: 38, height: 38, borderRadius: 19, borderWidth: 1,
        alignItems: "center", justifyContent: "center",
    },
    field: {
        alignItems: "center", gap: 8, height: 40, borderRadius: 999, borderWidth: 1,
        paddingHorizontal: 14,
    },
    // 16 and not less: iPhone's Safari zooms into a field set smaller, and stays
    // zoomed in after it, with the results under the reader's thumb half off screen
    input: {
        flex: 1, height: "100%", fontFamily: "Heebo_500Medium", fontSize: 16,
        textAlign: "right", writingDirection: "rtl", paddingVertical: 0,
    },
    count: { ...TYPE.caption, textAlign: "right", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
    scroll: { flex: 1 },
    list: { paddingHorizontal: 14, paddingBottom: 18, gap: 8 },
    label: { fontFamily: "Heebo_700Bold", fontSize: 11, textAlign: "right", marginTop: 8, marginBottom: -2 },
    row: { alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
    storyRow: { alignItems: "stretch", gap: 4 },
    rowText: { flex: 1, gap: 3 },
    title: { ...TYPE.label, fontSize: 15, lineHeight: 21, textAlign: "right" },
    sub: { ...TYPE.caption, lineHeight: 18, textAlign: "right" },
    hit: { fontFamily: "Heebo_800ExtraBold", textDecorationLine: "underline" },
    thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: "#EFEEEA" },
    meta: { alignItems: "center", gap: 8 },
    section: { fontFamily: "Heebo_700Bold", fontSize: 11 },
    outlets: { ...TYPE.caption, fontSize: 11 },
});
