import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { isNudgeOff, stopNudging } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { track } from "@/state/analytics";
import { HotTopic } from "@/state/hotTopics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { ago, byNewest, hebrewDate, longDate, pickLead, Reading, useNews } from "@/site/news";
import { Page, pressTint, Rule, SectionHead, Wrap } from "@/site/page";
import { Lead, Major, Row } from "@/site/stories";
import { Mark } from "@/site/meter";
import { Button, Skeleton } from "@/site/controls";
import River from "@/site/river";

/**
 * The front page. Read from the top it is a day's paper: the masthead and the
 * date; the story the most outlets told, with both its tellings; the next
 * biggest; then, on a black band, what one side ran and the other did not; the
 * day's controversies; and every story of the day by the clock.
 */
export default function Front() {
    const { c, desk, wide } = useSite();
    const { readings, loading, failed, refresh } = useNews();

    const { lead, top, under } = useMemo(() => {
        const first = pickLead(readings);
        const rest = readings.filter((r) => r !== first)
            .sort((a, b) => b.total - a.total || byNewest(a, b));
        return { lead: first, top: rest.slice(0, desk ? 5 : 4), under: desk ? rest.slice(5, 7) : [] };
    }, [readings, desk]);

    return (
        <Page masthead nav="home">
            <Masthead />
            <Wrap>
                {loading && !readings.length ? (
                    <View style={styles.loading}>
                        <Skeleton lines={3} big />
                        <Skeleton lines={4} />
                    </View>
                ) : failed && !readings.length ? (
                    <View style={styles.failed}>
                        <Text style={[styles.failedText, { color: c.ink }]}>החדשות לא נטענו.</Text>
                        <Button label="לנסות שוב" onPress={refresh} />
                    </View>
                ) : lead ? (
                    <View style={[styles.top, { flexDirection: desk ? ROW : "column" }]}>
                        <View style={[styles.leadCol, desk && styles.leadColDesk]}>
                            <Lead r={lead} />
                            {/* on a desk the lead's column carries two more, side by side */}
                            {under.length > 0 && (
                                <View style={[styles.under, { flexDirection: ROW }]}>
                                    {under.map((r) => <View key={r.id} style={styles.underItem}><Major r={r} how="top" /></View>)}
                                </View>
                            )}
                        </View>
                        {desk && <View style={[styles.vrule, { backgroundColor: c.rule }]} />}
                        <View style={[styles.sideCol, desk && styles.sideColDesk]}>
                            {!desk && <Rule strong style={styles.topRule} />}
                            {desk && <Text style={[styles.asideHead, { color: c.ink }]}>עוד בראש החדשות</Text>}
                            {top.map((r) => <Major key={r.id} r={r} how="top" />)}
                        </View>
                    </View>
                ) : null}
            </Wrap>

            {readings.length > 0 && <BlindBand readings={readings} />}

            <Wrap>
                <Controversies />
                <QuestionnaireOffer />
                {readings.length > 0 && (
                    <View style={[styles.river, wide && styles.riverWide]}>
                        <SectionHead title="כל מה שקרה היום" />
                        <River readings={readings} how="river" />
                    </View>
                )}
            </Wrap>
        </Page>
    );
}

/** the paper's name, the day, and how fresh it is */
function Masthead() {
    const { c, type, wide } = useSite();
    const { updated } = useNews();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60 * 1000);
        return () => clearInterval(t);
    }, []);
    const hebrew = hebrewDate(now);
    return (
        <Wrap style={styles.masthead}>
            <View style={[styles.dateline, { flexDirection: ROW, borderBottomColor: c.rule }]}>
                <Text style={[type.meta, { color: c.ink }]}>
                    {longDate(now)}{hebrew ? <Text style={{ color: c.muted }}>{"   "}{hebrew}</Text> : null}
                </Text>
                {!!updated && <Text style={[type.meta, { color: c.muted }]}>עודכן {ago(updated)}</Text>}
            </View>
            <View style={[styles.nameplate, { flexDirection: ROW }]} accessibilityRole="header" accessibilityLabel="האזרח הקטן">
                <Mark size={wide ? 62 : 36} />
                <Text style={[type.masthead, { color: c.ink }]}>האזרח הקטן</Text>
            </View>
            <Text style={[styles.motto, { color: c.ink2 }]}>כל החדשות, משני צדי המפה</Text>
            <View style={[styles.double, { borderTopColor: c.ruleStrong, borderBottomColor: c.ruleStrong }]} />
        </Wrap>
    );
}

/**
 * The band: what two or more outlets on one side ran and no outlet on the other
 * did, in two columns, one for each side. It is the only thing on the page that
 * is not a story but a finding, and it is set apart in black for that.
 */
function BlindBand({ readings }: { readings: Reading[] }) {
    const { c, type, wide } = useSite();
    const { profile } = useQuestionnaire();
    const onlyRight = readings.filter((r) => r.missing === "left").sort(byNewest);
    const onlyLeft = readings.filter((r) => r.missing === "right").sort(byNewest);
    if (!onlyRight.length && !onlyLeft.length) return null;

    const column = (side: "right" | "left", list: Reading[]) => {
        const ink = side === "right" ? c.bandRight : c.bandLeft;
        // which side is the reader's, when they have said
        const yours = profile && profile.bloc !== side ? "  ·  הצד שלכם פספס" : "";
        return (
            <View style={styles.bandCol}>
                <View style={[styles.bandColHead, { flexDirection: ROW, borderBottomColor: ink }]}>
                    <Text style={[type.label, { color: ink, fontSize: 15 }]}>
                        {side === "right" ? "רק הימין סיקר" : "רק השמאל סיקר"}{yours}
                    </Text>
                    <Text style={[type.meta, { color: c.bandMuted }]}>{list.length}</Text>
                </View>
                {list.length === 0
                    ? <Text style={[type.small, { color: c.bandMuted, paddingVertical: 14 }]}>אין היום.</Text>
                    : list.slice(0, 4).map((r) => <Row key={r.id} r={r} how="blindspot_band" onBand />)}
            </View>
        );
    };

    return (
        <View style={[styles.band, { backgroundColor: c.band }]}>
            <Wrap>
                <SectionHead title="נקודות עיוורות" onBand more={{ href: "/blindspots", label: "לכל הנקודות העיוורות" }} />
                <Text style={[type.small, styles.bandLede, { color: c.bandMuted }]}>
                    סיפורים ששני גופים או יותר מצד אחד של המפה סיקרו, ואף גוף מהצד השני לא.
                </Text>
                <View style={[styles.bandCols, { flexDirection: wide ? ROW : "column" }]}>
                    {column("right", onlyRight)}
                    {column("left", onlyLeft)}
                </View>
            </Wrap>
        </View>
    );
}

/** the affairs the right and the left are split on, the ones in today's news first */
function Controversies() {
    const { c, type, wide, desk } = useSite();
    const { hot } = useNews();
    const router = useRouter();
    if (!hot || !hot.topics.length) return null;
    const today = hot.today.map((id) => hot.topics.find((t) => t.id === id)).filter(Boolean) as HotTopic[];
    const rest = hot.topics.filter((t) => !hot.today.includes(t.id)).sort((a, b) => b.relevance - a.relevance);
    const shown = [...today, ...rest].slice(0, desk ? 3 : wide ? 4 : 3);
    return (
        <View style={styles.controversies}>
            <SectionHead title="מחלוקות" more={{ href: "/controversies", label: "כל המחלוקות" }} />
            <View style={[styles.contGrid, { flexDirection: desk ? ROW : wide ? ROW : "column" }]}>
                {shown.map((t) => (
                    <Pressable key={t.id} accessibilityRole="link"
                        onPress={() => { track("hot_topic_opened", { id: t.id, from: "front" }); router.push({ pathname: "/controversies/[id]", params: { id: t.id } }); }}
                        style={(s) => [styles.contItem, { borderTopColor: c.rule, width: desk ? "31.5%" : wide ? "48%" : "100%" }, pressTint(c)(s)]}>
                        <Text style={[type.major, { color: c.ink }]}>{t.title}</Text>
                        <Text style={[type.small, { color: c.ink2 }]} numberOfLines={3}>{t.one_line}</Text>
                        {hot.today.includes(t.id) && (
                            <Text style={[type.meta, { color: c.ink, fontFamily: FACE.sansHeavy }]}>בחדשות היום</Text>
                        )}
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

/**
 * The one thing the site asks of a reader, offered and not demanded: a minute of
 * answers, so that "the other side" can mean their other side. Once declined it
 * stays declined.
 */
function QuestionnaireOffer() {
    const { c, type, wide } = useSite();
    const { filled, open } = useQuestionnaire();
    const [quiet, setQuiet] = useState(true);
    useEffect(() => { isNudgeOff().then(setQuiet); }, []);
    if (filled || quiet) return null;
    return (
        <View style={[styles.offer, { backgroundColor: c.paperAlt, borderTopColor: c.ruleStrong, flexDirection: wide ? ROW : "column" }]}>
            <View style={styles.offerWords}>
                <Text style={[type.major, { color: c.ink }]}>ומה איתכם?</Text>
                <Text style={[type.small, { color: c.ink2 }]}>
                    שאלון עמדות קצר, כדקה, מאפשר להשוות בין מה שאתם חושבים לבין מה שאתם קוראים בפועל,
                    ולהראות לכם כמה מהחדשות הגיעו דווקא מהצד השני. התשובות נשארות במכשיר שלכם.
                </Text>
            </View>
            <View style={[styles.offerActions, { flexDirection: ROW }]}>
                <Button label="למילוי השאלון" onPress={() => { track("questionnaire_opened", { from: "front" }); open(); }} />
                <Pressable onPress={() => { track("questionnaire_silenced"); stopNudging(); setQuiet(true); }} accessibilityRole="button">
                    <Text style={[type.ui, { color: c.ink2, textDecorationLine: "underline" }]}>לא עכשיו</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    masthead: { paddingTop: 10 },
    dateline: { justifyContent: "space-between", alignItems: "center", paddingBottom: 9, borderBottomWidth: 1, flexWrap: "wrap", gap: 6 },
    nameplate: { alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 18 },
    motto: { fontFamily: FACE.serifMedium, fontSize: 16, lineHeight: 22, textAlign: "center", paddingTop: 2, paddingBottom: 14 },
    double: { height: 6, borderTopWidth: 3, borderBottomWidth: 1, marginBottom: 22 },

    loading: { gap: 28, paddingVertical: 10 },
    failed: { alignItems: "center", gap: 16, paddingVertical: 48 },
    failedText: { fontFamily: FACE.serifBold, fontSize: 22 },

    top: { gap: 24 },
    leadCol: {},
    leadColDesk: { flex: 2 },
    under: { gap: 24, marginTop: 18 },
    underItem: { flex: 1 },
    vrule: { width: 1 },
    sideCol: {},
    sideColDesk: { flex: 1 },
    topRule: { marginTop: 18 },
    asideHead: { fontFamily: FACE.sansHeavy, fontSize: 14, textAlign: "right", paddingBottom: 6 },

    band: { marginTop: 40, paddingTop: 28, paddingBottom: 30 },
    bandLede: { marginTop: -6, marginBottom: 12 },
    bandCols: { gap: 28 },
    bandCol: { flex: 1 },
    bandColHead: { justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 2, paddingBottom: 7, marginBottom: 2 },

    controversies: { marginTop: 40 },
    contGrid: { flexWrap: "wrap", justifyContent: "space-between", rowGap: 4 },
    contItem: { gap: 7, borderTopWidth: 1, paddingVertical: 16, paddingHorizontal: 6, marginHorizontal: -6 },

    offer: { marginTop: 40, borderTopWidth: 3, padding: 20, gap: 18, alignItems: "center" },
    offerWords: { flex: 1, gap: 6, alignSelf: "stretch" },
    offerActions: { alignItems: "center", gap: 18, alignSelf: "stretch", justifyContent: "flex-start" },

    river: { marginTop: 44 },
    riverWide: { maxWidth: 820, width: "100%", alignSelf: "flex-end" },
});
