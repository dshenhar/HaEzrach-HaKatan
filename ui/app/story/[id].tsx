import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getBlocSummary, getTopics, mergeClusters, NewsItem, setClusterTopic, GENERAL_TOPIC } from "@/state/engagement";
import { useDevMode } from "@/state/theme";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, sectionColour, TYPE, useSite } from "@/site/tokens";
import { byNewest, clock, outlets, Reading, Side, useNews, when } from "@/site/news";
import { Go, Screen, SectionHead } from "@/site/page";
import { BlindBadge, dekOf } from "@/site/stories";
import Meter from "@/site/meter";
import { Button, Skeleton } from "@/site/controls";
import { useOpenArticle } from "@/site/reading";

/**
 * One story, on its own screen, in its section's colour. What happened, how
 * many outlets told it and from which side; then each side's telling with the
 * outlets that told it; then every outlet's own headline, each one a way to its
 * article on its own site.
 */
export default function StoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { byId, loading, hot, tileOf } = useNews();
    const { c } = useSite();
    const r = byId(String(id));

    if (!r) {
        return (
            <Screen back docTitle="סיפור">
                <View style={styles.missing}>
                    {loading ? <Skeleton tall cards={2} /> : (
                        <View style={[styles.missingCard, { backgroundColor: c.card }]}>
                            <Ionicons name="time-outline" size={34} color={c.muted} />
                            <Text style={[TYPE.title, { color: c.ink, textAlign: "center" }]}>הסיפור הזה כבר לא בעיתון</Text>
                            <Text style={[TYPE.small, { color: c.ink2, textAlign: "center" }]}>
                                כתבות נשמרות כאן עד 30 שעות. מה שחדש עכשיו נמצא בעמוד הראשי.
                            </Text>
                            <Go href="/" plain><Text style={[TYPE.uiStrong, { color: c.brand }]}>לעמוד הראשי</Text></Go>
                        </View>
                    )}
                </View>
            </Screen>
        );
    }

    const affair = hot?.topics.find((t) => t.links.some((l) => l.id === r.id));

    return (
        <Screen back docTitle={r.lead.title} colour={sectionColour(r.section)} head={<Head r={r} />}>
            <Sides r={r} />
            {affair && (
                <Go href={{ pathname: "/controversies/[id]", params: { id: affair.id } }}
                    style={[styles.affair, { backgroundColor: tileOf(affair.id) }]}>
                    <Text style={[TYPE.label, { color: c.onColourMuted }]}>המחלוקת שמאחורי הסיפור</Text>
                    <Text style={[TYPE.title, { color: c.onColour }]}>{affair.title}</Text>
                    <Text style={[TYPE.small, { color: c.onColourMuted }]} numberOfLines={3}>{affair.one_line}</Text>
                    <View style={[styles.affairMore, { flexDirection: ROW }]}>
                        <Text style={[TYPE.uiStrong, { color: c.onColour }]}>איך כל צד רואה את זה</Text>
                        <Ionicons name="arrow-back" size={18} color={c.onColour} />
                    </View>
                </Go>
            )}
            <Articles r={r} />
            <DevTools r={r} />
        </Screen>
    );
}

/** the coloured head: the section, the headline, and the meter */
function Head({ r }: { r: Reading }) {
    const { c } = useSite();
    const dek = dekOf(r);
    const updated = r.last && r.first && r.last.getTime() - r.first.getTime() > 5 * 60000;
    return (
        <>
            <View style={[styles.headMeta, { flexDirection: ROW }]}>
                {!!r.section && (
                    <Go href={{ pathname: "/section/[name]", params: { name: r.section } }} plain label={`מדור ${r.section}`}>
                        <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                            <Text style={[styles.chipText, { color: c.onColour }]}>{r.section}</Text>
                        </View>
                    </Go>
                )}
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>
                    {when(r.first)}{updated ? `  ·  עודכן ${clock(r.last)}` : ""}
                </Text>
            </View>
            <Text style={[TYPE.h1, { color: c.onColour }]} accessibilityRole="header">{r.lead.title}</Text>
            {!!dek && <Text style={[TYPE.body, { color: c.onColourMuted }]}>{dek}</Text>}
            {!!r.topic && r.topic !== GENERAL_TOPIC && (
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>נושא: {r.topic}</Text>
            )}
            <View style={styles.meter}>
                <Meter right={r.right} left={r.left} other={r.other} size="lg" onColour grow />
            </View>
            <View style={[styles.counts, { flexDirection: ROW }]}>
                <Text style={[TYPE.uiStrong, { color: c.onColour }]}>{outlets(r.total)} סיקרו את הסיפור</Text>
                <BlindBadge r={r} />
            </View>
        </>
    );
}

/** the two tellings, each with the outlets that told it; a missing summary is fetched here at once */
function Sides({ r }: { r: Reading }) {
    const { c } = useSite();
    const [texts, setTexts] = useState<Partial<Record<Side, string | null>>>(() => ({
        right: r.summaries.right, left: r.summaries.left,
    }));
    useEffect(() => {
        let live = true;
        (["right", "left"] as Side[]).forEach((side) => {
            const n = side === "right" ? r.right : r.left;
            if (!n || r.summaries[side]) return;
            getBlocSummary(r.id, side).then((text) => { if (live) setTexts((t) => ({ ...t, [side]: text })); });
        });
        return () => { live = false; };
    }, [r.id, r.right, r.left, r.summaries]);

    return (
        <View>
            <SectionHead title="שני הצדדים" style={styles.sidesHead} />
            <View style={styles.sides}>
                <SidePanel r={r} side="right" text={texts.right} />
                <SidePanel r={r} side="left" text={texts.left} />
            </View>
            <Text style={[TYPE.meta, styles.aiNote, { color: c.muted }]}>
                הסיכומים נכתבים על ידי מודל שפה, על סמך הכותרות בלבד, ועשויים לטעות. במקרה של סתירה, הכתבה במקור היא הקובעת.
            </Text>
        </View>
    );
}

/** one side: how it told the story, and each of its outlets, each to its own article */
function SidePanel({ r, side, text }: { r: Reading; side: Side; text: string | null | undefined }) {
    const { c } = useSite();
    const { positions } = useNews();
    const openArticle = useOpenArticle();
    const items = side === "right" ? r.rightItems : r.leftItems;
    const ink = side === "right" ? c.right : c.left;
    const tint = side === "right" ? c.rightTint : c.leftTint;
    return (
        <View style={[styles.panel, { backgroundColor: c.card }]}>
            <View style={[styles.panelHead, { backgroundColor: tint, flexDirection: ROW }]}>
                <View style={[styles.panelMark, { backgroundColor: ink }]} />
                <Text style={[styles.panelName, { color: ink }]}>{side === "right" ? "ימין" : "שמאל"}</Text>
                <Text style={[TYPE.meta, { color: ink, fontFamily: FACE.semi }]}>
                    {items.length ? outlets(items.length) : "לא סיקרו"}
                </Text>
            </View>
            <View style={styles.panelBody}>
                {items.length === 0 ? (
                    <Text style={[TYPE.body, { color: c.muted }]}>אף גוף מהצד הזה לא סיקר</Text>
                ) : text ? (
                    <Text style={[TYPE.body, { color: c.ink }]}>{text}</Text>
                ) : text === undefined ? (
                    <Text style={[TYPE.small, { color: c.muted }]}>מכין סיכום…</Text>
                ) : null}
            </View>
            {items.map((item) => (
                <Pressable key={item.id} accessibilityRole="link"
                    accessibilityLabel={`${item.source}: ${item.title}. נפתח באתר ${item.source}`}
                    onPress={() => openArticle(item, { outlets: r.total, positions, from: "story_side" })}
                    style={({ pressed }) => [styles.item, { borderTopColor: c.rule, flexDirection: ROW }, pressed && { backgroundColor: c.pressed }]}>
                    <View style={styles.itemWords}>
                        <Text style={[TYPE.label, { color: ink }]}>{item.source}</Text>
                        <Text style={[TYPE.small, { color: c.ink }]} numberOfLines={3}>{item.title}</Text>
                    </View>
                    <Ionicons name="open-outline" size={17} color={c.muted} />
                </Pressable>
            ))}
        </View>
    );
}

/** every article in the story by the clock, whatever side it came from, one tap away */
function Articles({ r }: { r: Reading }) {
    const { c } = useSite();
    const { positions } = useNews();
    const openArticle = useOpenArticle();
    const [shown, setShown] = useState(false);
    const items = useMemo(() => [...r.story].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()), [r.story]);
    const side = (item: NewsItem) => positions[item.source]?.bloc;
    if (!shown) {
        return (
            <View style={styles.allButton}>
                <Button quiet wide label={`כל ${items.length} הכתבות לפי שעה`} onPress={() => setShown(true)} />
            </View>
        );
    }
    return (
        <View>
            <SectionHead title="כל הכתבות" count={items.length} />
            <View style={[styles.all, { backgroundColor: c.card }]}>
                {items.map((item, i) => {
                    const bloc = side(item);
                    const ink = bloc === "right" ? c.right : bloc === "left" ? c.left : c.muted;
                    const word = bloc === "right" ? "ימין" : bloc === "left" ? "שמאל" : "בלי שיוך";
                    const extra = item.summary && item.summary.trim() !== item.title.trim() ? item.summary : "";
                    return (
                        <Pressable key={item.id} accessibilityRole="link"
                            accessibilityLabel={`${item.source}, ${word}: ${item.title}. נפתח באתר ${item.source}`}
                            onPress={() => openArticle(item, { outlets: r.total, positions, from: "story_all" })}
                            style={({ pressed }) => [styles.article, { borderTopColor: c.rule, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 },
                                pressed && { backgroundColor: c.pressed }]}>
                            <View style={[styles.articleHead, { flexDirection: ROW }]}>
                                <View style={[styles.articleMark, { backgroundColor: ink }]} />
                                <Text style={[TYPE.label, { color: c.ink }]}>{item.source}</Text>
                                <Text style={[TYPE.meta, { color: ink }]}>{word}</Text>
                                <View style={styles.fill} />
                                <Text style={[TYPE.meta, { color: c.muted }]}>{clock(new Date(item.time))}</Text>
                            </View>
                            <Text style={[TYPE.row, { color: c.ink }]}>{item.title}</Text>
                            {!!extra && <Text style={[TYPE.small, { color: c.ink2 }]} numberOfLines={4}>{extra}</Text>}
                            <Text style={[TYPE.meta, { color: c.brand, fontFamily: FACE.semi }]}>לכתבה באתר {item.source} ←</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

/**
 * For the desk only: put a story under another issue, or fold another story into
 * this one when the grouping split what is one story.
 */
function DevTools({ r }: { r: Reading }) {
    const dev = useDevMode();
    const { c } = useSite();
    const { readings, refresh } = useNews();
    const router = useRouter();
    const [topics, setTopics] = useState<string[]>([]);
    const [merging, setMerging] = useState(false);
    useEffect(() => { if (dev) getTopics(true).then(setTopics); }, [dev]);
    if (!dev) return null;
    const others = readings.filter((o) => o.id !== r.id).sort(byNewest).slice(0, 40);
    return (
        <View style={[styles.dev, { backgroundColor: c.card, borderColor: c.brand }]}>
            <Text style={[TYPE.section, { color: c.ink }]}>מצב פיתוח</Text>
            <Text style={[TYPE.label, { color: c.muted }]}>נושא: {r.topic}</Text>
            <View style={[styles.devWrap, { flexDirection: ROW }]}>
                {topics.map((t) => (
                    <Pressable key={t} onPress={async () => { await setClusterTopic(r.id, t); refresh(); }}
                        style={[styles.devChip, { borderColor: t === r.topic ? c.brand : c.rule, backgroundColor: t === r.topic ? c.brand : c.card }]}>
                        <Text style={[TYPE.meta, { color: t === r.topic ? c.brandInk : c.ink }]}>{t}</Text>
                    </Pressable>
                ))}
            </View>
            <Button quiet label={merging ? "ביטול איחוד" : "איחוד סיפור אחר לתוך זה"} onPress={() => setMerging((m) => !m)} />
            {merging && others.map((o) => (
                <Pressable key={o.id} onPress={async () => {
                    const ok = await mergeClusters(r.id, o.id);
                    track("dev_merge", { ok });
                    if (ok) { await refresh(); router.replace({ pathname: "/story/[id]", params: { id: r.id } }); }
                }} style={({ pressed }) => [styles.devItem, { borderTopColor: c.rule }, pressed && { backgroundColor: c.pressed }]}>
                    <Text style={[TYPE.small, { color: c.ink }]}>{o.lead.title}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    missing: { paddingTop: 8 },
    missingCard: { marginHorizontal: 12, borderRadius: RADIUS.card, padding: 28, alignItems: "center", gap: 12 },

    headMeta: { alignItems: "center", gap: 10, flexWrap: "wrap" },
    chip: { borderRadius: RADIUS.chip, paddingHorizontal: 11, paddingVertical: 4 },
    chipText: { fontFamily: FACE.semi, fontSize: 13, lineHeight: 17 },
    meter: { marginTop: 6 },
    counts: { justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },

    sidesHead: { marginTop: 22 },
    sides: { gap: 12, paddingHorizontal: 12 },
    panel: { borderRadius: RADIUS.card, overflow: "hidden" },
    panelHead: { alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 11 },
    panelMark: { width: 12, height: 12, borderRadius: 3 },
    panelName: { fontFamily: FACE.heavy, fontSize: 17, lineHeight: 22, flex: 1, textAlign: "right", writingDirection: "rtl" },
    panelBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
    item: { alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
    itemWords: { flex: 1, gap: 3 },
    aiNote: { paddingHorizontal: 18, paddingTop: 12 },

    affair: { marginHorizontal: 12, marginTop: 24, borderRadius: 22, padding: 18, gap: 7 },
    affairMore: { alignItems: "center", justifyContent: "space-between", marginTop: 6 },

    allButton: { paddingHorizontal: 12, marginTop: 24 },
    all: { marginHorizontal: 12, borderRadius: RADIUS.card, overflow: "hidden" },
    article: { gap: 6, paddingHorizontal: 16, paddingVertical: 14 },
    articleHead: { alignItems: "center", gap: 8 },
    articleMark: { width: 9, height: 9, borderRadius: 3 },

    dev: { marginHorizontal: 12, marginTop: 30, borderRadius: RADIUS.card, borderWidth: 2, padding: 16, gap: 12 },
    devWrap: { flexWrap: "wrap", gap: 6 },
    devChip: { borderWidth: 1, borderRadius: RADIUS.chip, paddingHorizontal: 10, paddingVertical: 5 },
    devItem: { paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
});
