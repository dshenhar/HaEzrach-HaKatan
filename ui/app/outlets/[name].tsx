import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CompanyDetailType, getRanksByCompany, getTopicPoles, GENERAL_TOPIC, TopicPoles } from "@/state/engagement";
import { ROW, useSite } from "@/site/tokens";
import { byNewest, useNews } from "@/site/news";
import { Page, SectionHead, Wrap } from "@/site/page";
import { Row } from "@/site/stories";
import { Skeleton } from "@/site/controls";
import Axis from "@/site/axis";

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : `\u2066${v > 0 ? "+" : ""}${v.toFixed(1)}\u2069`);

/**
 * One outlet, issue by issue. A single number per outlet hides the whole point:
 * a paper can sit far right on religion and state and left of centre on welfare.
 * Each issue carries the two positions it is really between, and how many
 * readers have rated the outlet on it.
 */
export default function Outlet() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const source = String(name ?? "");
    const { c, type } = useSite();
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
    const ink = p?.bloc === "right" ? c.right : p?.bloc === "left" ? c.left : c.muted;
    const today = readings.filter((r) => r.story.some((i) => i.source === source)).sort(byNewest).slice(0, 8);
    const issues = (ranks ?? []).filter((r) => r.topic !== GENERAL_TOPIC).sort((a, b) => b.bias - a.bias);

    return (
        <Page back title={source} nav="outlets">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">{source}</Text>
                    <View style={[styles.summary, { flexDirection: ROW, borderBottomColor: c.ruleStrong }]}>
                        <Text style={[type.label, { color: ink, fontSize: 16 }]}>{bloc}</Text>
                        {p?.bias !== null && p?.bias !== undefined && (
                            <Text style={[type.meta, { color: c.ink }]}>מיקום כללי {fmt(p.bias)}</Text>
                        )}
                    </View>
                    <View style={styles.overall}><Axis value={p?.bias ?? null} height={16} /></View>

                    <SectionHead title="נושא אחר נושא" />
                    {ranks === null ? <Skeleton lines={6} /> : issues.length === 0 ? (
                        <Text style={[type.body, { color: c.muted }]}>אין עדיין עמדות לגוף הזה.</Text>
                    ) : issues.map((r) => {
                        const pole = poles[r.topic];
                        return (
                            <View key={r.topic} style={[styles.issue, { borderTopColor: c.rule }]}
                                accessible accessibilityLabel={`${r.topic}: ${fmt(r.bias)}`}>
                                <View style={[styles.issueHead, { flexDirection: ROW }]}>
                                    <Text style={[type.row, { color: c.ink, flex: 1 }]}>{r.topic}</Text>
                                    <Text style={[type.meta, { color: c.ink }]}>{fmt(r.bias)}</Text>
                                </View>
                                <Axis value={r.bias} />
                                <View style={[styles.poles, { flexDirection: ROW }]}>
                                    <Text style={[type.meta, { color: c.right }]}>{pole?.right ?? "ימין"}</Text>
                                    <Text style={[type.meta, { color: c.muted }]}>
                                        {r.rated_count ? `${r.rated_count} דירוגים` : "הערכה עריכתית, טרם דורג"}
                                    </Text>
                                    <Text style={[type.meta, { color: c.left }]}>{pole?.left ?? "שמאל"}</Text>
                                </View>
                            </View>
                        );
                    })}

                    {today.length > 0 && (
                        <View style={styles.today}>
                            <SectionHead title={`${source} בחדשות היום`} />
                            {today.map((r) => <Row key={r.id} r={r} how="outlet" />)}
                        </View>
                    )}
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    column: { maxWidth: 820, width: "100%", alignSelf: "center", gap: 12 },
    summary: { justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 3, paddingBottom: 10 },
    overall: { marginBottom: 28, marginTop: 4 },
    issue: { gap: 8, paddingVertical: 14, borderTopWidth: 1 },
    issueHead: { alignItems: "baseline", gap: 10 },
    poles: { justifyContent: "space-between", gap: 8 },
    today: { marginTop: 32 },
});
