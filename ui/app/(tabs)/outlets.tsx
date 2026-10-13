import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { track } from "@/state/analytics";
import { RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Go, Screen } from "@/site/page";
import { Skeleton } from "@/site/controls";
import Axis from "@/site/axis";

const fmt = (v: number | null) => (v === null ? "" : `⁦${v > 0 ? "+" : ""}${v.toFixed(1)}⁩`);

/**
 * Every outlet the app reads, placed on one line from the right to the left,
 * the most right-leaning on top. It is a reading of coverage tendency - not a
 * score for reliability or quality - and each outlet opens to its position on
 * every issue, which is where the number is really made.
 */
export default function Outlets() {
    const { c } = useSite();
    const { positions, loading } = useNews();
    const list = useMemo(() => Object.values(positions)
        .sort((a, b) => (b.bias ?? -99) - (a.bias ?? -99)), [positions]);

    return (
        <Screen title="גופים" docTitle="גופי התקשורת">
            <Text style={[TYPE.small, styles.lede, { color: c.ink2 }]}>
                כל גוף שהאפליקציה קוראת, על ציר אחד שבין 5+ לימין ל-5- לשמאל. זו הערכה של נטיית הסיקור. היא לא טענה
                על אמינות ולא ציון איכות. כל גוף נפתח לעמדתו בכל נושא בנפרד.
            </Text>
            <Go href="/methodology" plain label="איך נקבעת העמדה">
                <View style={[styles.how, { flexDirection: ROW }]}>
                    <Ionicons name="help-circle" size={18} color={c.brand} />
                    <Text style={[TYPE.uiStrong, { color: c.brand }]}>איך נקבעת העמדה</Text>
                </View>
            </Go>

            {loading && !list.length ? <Skeleton cards={4} /> : (
                <View style={[styles.card, { backgroundColor: c.card }]}>
                    <View style={[styles.scale, { flexDirection: ROW, borderBottomColor: c.rule }]}>
                        <View style={styles.nameCol} />
                        <View style={[styles.scaleLabels, { flexDirection: ROW }]}>
                            <Text style={[TYPE.label, { color: c.right }]}>ימין 5+</Text>
                            <Text style={[TYPE.label, { color: c.muted }]}>0</Text>
                            <Text style={[TYPE.label, { color: c.left }]}>שמאל 5-</Text>
                        </View>
                    </View>
                    {list.map((p, i) => (
                        <Go key={p.source} href={{ pathname: "/outlets/[name]", params: { name: p.source } }}
                            label={`${p.source}, ${fmt(p.bias)}`} onPress={() => track("outlet_opened", { from: "outlets" })}>
                            <View style={[styles.row, { flexDirection: ROW, borderTopColor: c.rule, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                                <View style={styles.nameCol}>
                                    <Text style={[TYPE.uiStrong, { color: c.ink }]} numberOfLines={1}>{p.source}</Text>
                                    <Text style={[TYPE.meta, { color: p.bloc === "right" ? c.right : p.bloc === "left" ? c.left : c.muted }]}>
                                        {fmt(p.bias)}
                                    </Text>
                                </View>
                                <View style={styles.axis}><Axis value={p.bias} /></View>
                            </View>
                        </Go>
                    ))}
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    lede: { paddingHorizontal: 18 },
    how: { alignItems: "center", gap: 6, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16 },
    card: { marginHorizontal: 12, borderRadius: RADIUS.card, overflow: "hidden" },
    scale: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    scaleLabels: { flex: 1, justifyContent: "space-between" },
    row: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    nameCol: { width: 112, gap: 1 },
    axis: { flex: 1 },
});
