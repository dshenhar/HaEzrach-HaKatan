import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBlocSummary, getTopics, mergeClusters, NewsItem, setClusterTopic, GENERAL_TOPIC } from "@/state/engagement";
import { useDevMode } from "@/state/theme";
import { track } from "@/state/analytics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { byNewest, clock, outlets, Reading, Side, useNews, when } from "@/site/news";
import { Go, Page, pressTint, Rule, SectionHead, Wrap } from "@/site/page";
import { BlindNote, Twin } from "@/site/stories";
import Meter from "@/site/meter";
import { Button, Skeleton } from "@/site/controls";
import { useOpenArticle } from "@/site/reading";

/**
 * One story, on its own page. What happened, how many outlets told it and from
 * which side; then the two tellings side by side; then every outlet's own
 * headline, each one a way to its article on its own site.
 */
export default function StoryPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { byId, loading, hot } = useNews();
    const { c, type, desk } = useSite();
    const r = byId(String(id));

    if (!r) {
        return (
            <Page back title="סיפור">
                <Wrap style={styles.missing}>
                    {loading ? <Skeleton lines={3} big /> : (
                        <>
                            <Text style={[type.h1, { color: c.ink }]}>הסיפור הזה כבר לא בעיתון</Text>
                            <Text style={[type.dek, { color: c.ink2 }]}>
                                כתבות נשמרות כאן עד 30 שעות. מה שחדש עכשיו נמצא בעמוד הראשי.
                            </Text>
                            <Go href="/" plain><Text style={[type.uiStrong, { color: c.ink, textDecorationLine: "underline" }]}>לעמוד הראשי</Text></Go>
                        </>
                    )}
                </Wrap>
            </Page>
        );
    }

    const affair = hot?.topics.find((t) => t.links.some((l) => l.id === r.id));

    return (
        <Page back title={r.lead.title} nav={r.section ? `section:${r.section}` : null}>
            <Wrap style={styles.page}>
                <View style={[styles.cols, { flexDirection: desk ? ROW : "column" }]}>
                    <View style={[styles.main, desk && styles.mainDesk]}>
                        <Headline r={r} />
                        <Sides r={r} />
                        {affair && (
                            <Go href={{ pathname: "/controversies/[id]", params: { id: affair.id } }}
                                style={[styles.affair, { borderColor: c.ruleStrong }]}>
                                <Text style={[type.major, { color: c.ink }]}>{affair.title}</Text>
                                <Text style={[type.small, { color: c.ink2 }]}>{affair.one_line}</Text>
                                <Text style={[type.meta, { color: c.ink, fontFamily: FACE.sansHeavy }]}>המחלוקת שמאחורי הסיפור ←</Text>
                            </Go>
                        )}
                    </View>
                    {desk && <View style={[styles.vrule, { backgroundColor: c.rule }]} />}
                    <View style={[styles.aside, desk && styles.asideDesk]}>
                        <Articles r={r} />
                    </View>
                </View>
                <DevTools r={r} />
            </Wrap>
        </Page>
    );
}

function Headline({ r }: { r: Reading }) {
    const { c, type } = useSite();
    const dek = r.summaries.all || (r.lead.summary?.trim() !== r.lead.title.trim() ? r.lead.summary : "");
    const sep = <View style={[styles.sep, { backgroundColor: c.rule }]} />;
    return (
        <View style={styles.headline}>
            <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">{r.lead.title}</Text>
            {!!dek && <Text style={[type.dek, { color: c.ink2 }]}>{dek}</Text>}
            <View style={[styles.meta, { flexDirection: ROW }]}>
                {!!r.section && (
                    <Go href={{ pathname: "/section/[name]", params: { name: r.section } }} plain>
                        <Text style={[type.meta, { color: c.ink, fontFamily: FACE.sansHeavy }]}>{r.section}</Text>
                    </Go>
                )}
                {!!r.section && sep}
                <Text style={[type.meta, { color: c.muted }]}>פורסם לראשונה {when(r.first)}</Text>
                {r.last && r.first && r.last.getTime() - r.first.getTime() > 5 * 60000 && (
                    <>{sep}<Text style={[type.meta, { color: c.muted }]}>עודכן {clock(r.last)}</Text></>
                )}
                {!!r.topic && r.topic !== GENERAL_TOPIC && <>{sep}<Text style={[type.meta, { color: c.muted }]}>{r.topic}</Text></>}
            </View>
            <View style={styles.meter}>
                <Meter right={r.right} left={r.left} other={r.other} size="lg" grow />
            </View>
            <View style={[styles.counts, { flexDirection: ROW }]}>
                <Text style={[type.meta, { color: c.ink }]}>{outlets(r.total)} סיקרו את הסיפור</Text>
                <BlindNote r={r} />
            </View>
        </View>
    );
}

/** the two tellings, fetched here at once when the feed came without them */
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
        <View style={styles.sides}>
            <SectionHead title="שני הצדדים" />
            <Twin r={r} full texts={texts} />
            <SideLists r={r} />
            <Text style={[styles.aiNote, { color: c.muted }]}>
                הסיכומים נכתבים על ידי מודל שפה, על סמך הכותרות בלבד, ועשויים לטעות. במקרה של סתירה, הכתבה במקור היא הקובעת.
            </Text>
        </View>
    );
}

/** under each side's telling: the outlets that told it, each to its own article */
function SideLists({ r }: { r: Reading }) {
    const { c, type } = useSite();
    const { positions } = useNews();
    const openArticle = useOpenArticle();
    const col = (side: Side) => {
        const items = side === "right" ? r.rightItems : r.leftItems;
        const ink = side === "right" ? c.right : c.left;
        return (
            <View style={styles.sideList}>
                {items.map((item) => (
                    <Pressable key={item.id} accessibilityRole="link"
                        onPress={() => openArticle(item, { outlets: r.total, positions, from: "story_side" })}
                        style={(s) => [styles.sideItem, { borderTopColor: c.rule }, pressTint(c)(s)]}>
                        <Text style={[type.label, { color: ink }]}>{item.source}</Text>
                        <Text style={[type.small, { color: c.ink }]} numberOfLines={3}>{item.title}</Text>
                    </Pressable>
                ))}
            </View>
        );
    };
    if (!r.right && !r.left) return null;
    return (
        <View style={[styles.sideLists, { flexDirection: ROW }]}>
            {col("right")}
            <View style={styles.sideGap} />
            {col("left")}
        </View>
    );
}

/** every article in the story by the clock, whatever side it came from */
function Articles({ r }: { r: Reading }) {
    const { c, type, desk } = useSite();
    const { positions } = useNews();
    const openArticle = useOpenArticle();
    const [shown, setShown] = useState(false);
    const items = useMemo(() => [...r.story].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()), [r.story]);
    const side = (item: NewsItem) => positions[item.source]?.bloc;
    // on a phone the two sides above already list every outlet; by the clock is one tap away
    if (!desk && !shown) {
        return (
            <View style={styles.allButton}>
                <Button quiet label={`כל ${items.length} הכתבות לפי שעה`} onPress={() => setShown(true)} />
            </View>
        );
    }
    return (
        <View>
            <SectionHead title="כל הכתבות" />
            {items.map((item) => {
                const bloc = side(item);
                const ink = bloc === "right" ? c.right : bloc === "left" ? c.left : c.muted;
                const word = bloc === "right" ? "ימין" : bloc === "left" ? "שמאל" : "בלי שיוך";
                const extra = item.summary && item.summary.trim() !== item.title.trim() ? item.summary : "";
                return (
                    <Pressable key={item.id} accessibilityRole="link"
                        accessibilityLabel={`${item.source}, ${word}: ${item.title}. נפתח באתר ${item.source}`}
                        onPress={() => openArticle(item, { outlets: r.total, positions, from: "story_all" })}
                        style={(s) => [styles.article, { borderTopColor: c.rule }, pressTint(c)(s)]}>
                        <View style={[styles.articleHead, { flexDirection: ROW }]}>
                            <View style={[styles.articleMark, { backgroundColor: ink }]} />
                            <Text style={[type.label, { color: c.ink }]}>{item.source}</Text>
                            <Text style={[type.meta, { color: ink }]}>{word}</Text>
                            <Text style={[type.meta, { color: c.muted }]}>{clock(new Date(item.time))}</Text>
                        </View>
                        <Text style={[type.row, { color: c.ink }]}>{item.title}</Text>
                        {!!extra && <Text style={[type.small, { color: c.ink2 }]} numberOfLines={4}>{extra}</Text>}
                        <Text style={[type.meta, { color: c.muted }]}>לכתבה באתר {item.source} ←</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/**
 * For the desk only: put a story under another issue, or fold another story into
 * this one when the grouping split what is one story.
 */
function DevTools({ r }: { r: Reading }) {
    const dev = useDevMode();
    const { c, type } = useSite();
    const { readings, refresh } = useNews();
    const router = useRouter();
    const [topics, setTopics] = useState<string[]>([]);
    const [merging, setMerging] = useState(false);
    useEffect(() => { if (dev) getTopics(true).then(setTopics); }, [dev]);
    if (!dev) return null;
    const others = readings.filter((o) => o.id !== r.id).sort(byNewest).slice(0, 40);
    return (
        <View style={[styles.dev, { borderColor: c.ink }]}>
            <Rule strong />
            <Text style={[type.section, { color: c.ink }]}>מצב פיתוח</Text>
            <Text style={[type.label, { color: c.muted }]}>נושא: {r.topic}</Text>
            <View style={[styles.devWrap, { flexDirection: ROW }]}>
                {topics.map((t) => (
                    <Pressable key={t} onPress={async () => { await setClusterTopic(r.id, t); refresh(); }}
                        style={[styles.devChip, { borderColor: t === r.topic ? c.ink : c.rule, backgroundColor: t === r.topic ? c.ink : c.paper }]}>
                        <Text style={[type.meta, { color: t === r.topic ? c.paper : c.ink }]}>{t}</Text>
                    </Pressable>
                ))}
            </View>
            <Button quiet label={merging ? "ביטול איחוד" : "איחוד סיפור אחר לתוך זה"} onPress={() => setMerging((m) => !m)} />
            {merging && others.map((o) => (
                <Pressable key={o.id} onPress={async () => {
                    const ok = await mergeClusters(r.id, o.id);
                    track("dev_merge", { ok });
                    if (ok) { await refresh(); router.replace({ pathname: "/story/[id]", params: { id: r.id } }); }
                }} style={(s) => [styles.article, { borderTopColor: c.rule }, pressTint(c)(s)]}>
                    <Text style={[type.small, { color: c.ink }]}>{o.lead.title}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    missing: { paddingVertical: 40, gap: 16 },
    cols: { gap: 28 },
    main: { gap: 8 },
    mainDesk: { flex: 2 },
    vrule: { width: 1 },
    aside: {},
    asideDesk: { flex: 1 },
    headline: { gap: 14 },
    meta: { alignItems: "center", gap: 10, flexWrap: "wrap" },
    sep: { width: 1, height: 12 },
    meter: { marginTop: 8 },
    counts: { justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
    sides: { marginTop: 34 },
    sideLists: { marginTop: 14, alignItems: "flex-start" },
    sideList: { flex: 1 },
    sideGap: { width: 16 },
    sideItem: { gap: 4, paddingVertical: 11, borderTopWidth: 1, marginHorizontal: -4, paddingHorizontal: 4 },
    aiNote: { fontFamily: FACE.sansSemi, fontSize: 12.5, lineHeight: 17, textAlign: "right", writingDirection: "rtl", marginTop: 14 },
    affair: { marginTop: 32, borderWidth: 1.5, padding: 16, gap: 6 },
    allButton: { marginTop: 28 },
    article: { gap: 6, paddingVertical: 14, borderTopWidth: 1, marginHorizontal: -6, paddingHorizontal: 6 },
    articleHead: { alignItems: "center", gap: 8, flexWrap: "wrap" },
    articleMark: { width: 9, height: 9 },
    dev: { marginTop: 40, gap: 12 },
    devWrap: { flexWrap: "wrap", gap: 6 },
    devChip: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
});
