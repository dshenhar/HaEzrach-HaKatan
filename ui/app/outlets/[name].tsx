import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CompanyDetailType, getRanksByCompany, getTopicPoles, GENERAL_TOPIC, TopicPoles } from "@/state/engagement";
import { DEEP, FACE, RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { byNewest, useNews } from "@/site/news";
import { Screen, SectionHead } from "@/site/page";
import { StoryCard } from "@/site/stories";
import { Skeleton } from "@/site/controls";
import Axis from "@/site/axis";

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : `⁦${v > 0 ? "+" : ""}${v.toFixed(1)}⁩`);

/**
 * One outlet, issue by issue, in its bloc's colour. A single number per outlet
 * hides the whole point: a paper can sit far right on religion and state and
 * left of centre on welfare. Each issue carries the two positions it is really
 * between, and how many readers have rated the outlet on it.
 */
export default function Outlet() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const source = String(name ?? "");
    const { c } = useSite();
    const { positions, readings } = useNews();
    const [ranks, setRanks] = useState<CompanyDetailType[] | null>(null);
    const [poles, setPoles] = useState<TopicPoles>({});

    useEffect(() => {
        let live = true;
        getRanksByCompany(source).then((r) => { if (live) setRanks(r); });
        getTopicPoles().then((p) => { if (live) setPoles(p); });
        return () => { live = false; };
    }, [source]);

    const p = positions[source];
    const bloc = p?.bloc === "right" ? "ימין" : p?.bloc === "left" ? "שמאל" : "בלי שיוך לגוש";
    const colour = DEEP[p?.bloc === "right" || p?.bloc === "left" ? p.bloc : "none"];
    const today = readings.filter((r) => r.story.some((i) => i.source === source)).sort(byNewest).slice(0, 8);
    const issues = (ranks ?? []).filter((r) => r.topic !== GENERAL_TOPIC).sort((a, b) => b.bias - a.bias);

    const head = (
        <>
            <Text style={[TYPE.label, { color: c.onColourMuted }]}>{bloc}</Text>
            <Text style={[styles.name, { color: c.onColour }]} accessibilityRole="header">{source}</Text>
            {p?.bias !== null && p?.bias !== undefined && (
                <View style={[styles.overallLine, { flexDirection: ROW }]}>
                    <Text style={[TYPE.uiStrong, { color: c.onColourMuted }]}>מיקום כללי</Text>
                    <Text style={[styles.overall, { color: c.onColour }]}>{fmt(p.bias)}</Text>
                </View>
            )}
            <View style={[styles.poles, { flexDirection: ROW }]}>
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>ימין 5+</Text>
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>שמאל 5-</Text>
            </View>
            <Axis value={p?.bias ?? null} height={18} onColour />
        </>
    );

    return (
        <Screen back docTitle={source} colour={colour} head={head}>
            <SectionHead title="נושא אחר נושא" />
            {ranks === null ? <Skeleton cards={3} /> : issues.length === 0 ? (
                <Text style={[TYPE.body, styles.empty, { color: c.muted }]}>אין עדיין עמדות לגוף הזה.</Text>
            ) : (
                <View style={[styles.card, { backgroundColor: c.card }]}>
                    {issues.map((r, i) => {
                        const pole = poles[r.topic];
                        return (
                            <View key={r.topic} style={[styles.issue, { borderTopColor: c.rule, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                                accessible accessibilityLabel={`${r.topic}: ${fmt(r.bias)}`}>
                                <View style={[styles.issueHead, { flexDirection: ROW }]}>
                                    <Text style={[TYPE.uiStrong, { color: c.ink, flex: 1 }]}>{r.topic}</Text>
                                    <Text style={[TYPE.meta, { color: r.bias > 0.25 ? c.right : r.bias < -0.25 ? c.left : c.ink, fontFamily: FACE.bold }]}>{fmt(r.bias)}</Text>
                                </View>
                                <Axis value={r.bias} />
                                <View style={[styles.issuePoles, { flexDirection: ROW }]}>
                                    <Text style={[TYPE.meta, styles.pole, { color: c.right }]}>{pole?.right ?? "ימין"}</Text>
                                    <Text style={[TYPE.meta, { color: c.muted }]}>
                                        {r.rated_count ? `${r.rated_count} דירוגים` : "הערכה עריכתית, טרם דורג"}
                                    </Text>
                                    <Text style={[TYPE.meta, styles.pole, { color: c.left, textAlign: "left" }]}>{pole?.left ?? "שמאל"}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {today.length > 0 && (
                <>
                    <SectionHead title={`${source} בחדשות היום`} count={today.length} />
                    {today.map((r) => <StoryCard key={r.id} r={r} how="outlet" />)}
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    name: { fontFamily: FACE.black, fontSize: 34, lineHeight: 40, textAlign: "right", writingDirection: "rtl", letterSpacing: -0.5 },
    overallLine: { alignItems: "baseline", gap: 10 },
    overall: { fontFamily: FACE.black, fontSize: 30, lineHeight: 36, fontVariant: ["tabular-nums"] },
    poles: { justifyContent: "space-between", marginTop: 4 },
    empty: { paddingHorizontal: 18 },
    card: { marginHorizontal: 12, borderRadius: RADIUS.card, overflow: "hidden" },
    issue: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
    issueHead: { alignItems: "baseline", gap: 10 },
    issuePoles: { justifyContent: "space-between", gap: 8 },
    pole: { flex: 1 },
});
