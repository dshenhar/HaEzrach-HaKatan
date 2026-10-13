import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { track } from "@/state/analytics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Page, pressTint, Wrap } from "@/site/page";
import { Skeleton } from "@/site/controls";
import Axis from "@/site/axis";

const fmt = (v: number | null) => (v === null ? "" : `\u2066${v > 0 ? "+" : ""}${v.toFixed(1)}\u2069`);

/**
 * Every outlet the site reads, placed on one line from the right to the left,
 * the most right-leaning on top. It is a reading of coverage tendency - not a
 * score for reliability or quality - and each outlet opens to its position on
 * every issue, which is where the number is really made.
 */
export default function Outlets() {
    const { c, type, wide } = useSite();
    const { positions, loading } = useNews();
    const router = useRouter();
    const list = useMemo(() => Object.values(positions)
        .sort((a, b) => (b.bias ?? -99) - (a.bias ?? -99)), [positions]);

    return (
        <Page back title="גופי התקשורת" nav="outlets">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">גופי התקשורת</Text>
                    <Text style={[type.dek, { color: c.ink2 }]}>
                        כל גוף שהאתר קורא, על ציר אחד שבין 5+ לימין ל-5- לשמאל. זו הערכה של נטיית הסיקור. היא לא טענה
                        על אמינות ולא ציון איכות. כל גוף נפתח לעמדתו בכל נושא בנפרד.
                    </Text>
                    <Link href="/methodology" style={StyleSheet.flatten([type.uiStrong, styles.how, { color: c.ink }])}>איך נקבעת העמדה ←</Link>

                    <View style={[styles.scaleHead, { flexDirection: ROW, borderBottomColor: c.ruleStrong }]}>
                        <Text style={[type.label, { color: c.ink, width: wide ? 170 : 118 }]}>גוף</Text>
                        <View style={[styles.scaleLabels, { flexDirection: ROW }]}>
                            <Text style={[type.label, { color: c.right }]}>ימין 5+</Text>
                            <Text style={[type.label, { color: c.muted }]}>0</Text>
                            <Text style={[type.label, { color: c.left }]}>שמאל 5-</Text>
                        </View>
                    </View>
                    {loading && !list.length ? <Skeleton lines={8} /> : list.map((p) => (
                        <Pressable key={p.source} accessibilityRole="link"
                            accessibilityLabel={`${p.source}, ${fmt(p.bias)}`}
                            onPress={() => { track("outlet_opened", { from: "outlets" }); router.push({ pathname: "/outlets/[name]", params: { name: p.source } }); }}
                            style={(s) => [styles.row, { flexDirection: ROW, borderBottomColor: c.rule }, pressTint(c)(s)]}>
                            <View style={[styles.name, { width: wide ? 170 : 118, flexDirection: ROW }]}>
                                <Text style={[type.uiStrong, { color: c.ink, fontFamily: FACE.sansHeavy }]} numberOfLines={1}>{p.source}</Text>
                                <Text style={[type.meta, { color: c.muted }]}>{fmt(p.bias)}</Text>
                            </View>
                            <View style={styles.axis}><Axis value={p.bias} /></View>
                        </Pressable>
                    ))}
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    column: { maxWidth: 860, width: "100%", alignSelf: "center", gap: 12 },
    how: { textDecorationLine: "underline", textAlign: "right", writingDirection: "rtl" },
    scaleHead: { alignItems: "flex-end", gap: 14, borderBottomWidth: 3, paddingBottom: 8, marginTop: 14 },
    scaleLabels: { flex: 1, justifyContent: "space-between" },
    row: { alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 6, marginHorizontal: -6 },
    name: { alignItems: "baseline", justifyContent: "space-between", gap: 6 },
    axis: { flex: 1 },
});
