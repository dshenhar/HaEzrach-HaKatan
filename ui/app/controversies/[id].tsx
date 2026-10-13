import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HotSide } from "@/state/hotTopics";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { outlets, useNews } from "@/site/news";
import { Go, Screen, SectionHead } from "@/site/page";
import { Skeleton } from "@/site/controls";

const PARTS: { key: keyof HotSide; label: string }[] = [
    { key: "coverage", label: "איך מסקרים" },
    { key: "view", label: "איך רואים את זה" },
    { key: "motives", label: "ולמה" },
];

/**
 * One affair, in its own colour: what it is, and then the two camps' media on
 * it, part by part - how each covers it, how each sees it, and why - the right's
 * and the left's one under the other, so each part is read as a pair. It speaks
 * of the camps' media and never names an outlet.
 */
export default function Controversy() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { c } = useSite();
    const { hotById, loading, hot, tileOf } = useNews();
    const t = hotById(String(id));

    if (!t) {
        return (
            <Screen back docTitle="מחלוקת">
                <View style={styles.missing}>
                    {loading || !hot ? <Skeleton tall cards={2} /> : (
                        <View style={[styles.card, styles.missingCard, { backgroundColor: c.card }]}>
                            <Text style={[TYPE.title, { color: c.ink, textAlign: "center" }]}>המחלוקת הזאת לא נמצאה</Text>
                            <Go href="/controversies" plain><Text style={[TYPE.uiStrong, { color: c.brand }]}>לכל המחלוקות</Text></Go>
                        </View>
                    )}
                </View>
            </Screen>
        );
    }

    const head = (
        <>
            <Text style={[TYPE.h1, { color: c.onColour }]} accessibilityRole="header">{t.title}</Text>
            <Text style={[TYPE.body, { color: c.onColourMuted }]}>{t.one_line}</Text>
            {!!t.status_date && (
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>נכון ל-{t.status_date.split("-").reverse().map(Number).join(".")}</Text>
            )}
        </>
    );

    return (
        <Screen back docTitle={t.title} colour={tileOf(t.id)} head={head}>
            <View style={[styles.card, { backgroundColor: c.card }]}>
                <Text style={[TYPE.label, { color: c.muted }]}>מה קרה</Text>
                <Text style={[TYPE.body, { color: c.ink }]}>{t.summary}</Text>
            </View>
            {PARTS.map((p) => (
                <View key={p.key}>
                    <SectionHead title={p.label} />
                    <View style={styles.pair}>
                        {(["right", "left"] as const).map((side) => (
                            <View key={side} style={[styles.side, { backgroundColor: c.card }]}>
                                <View style={[styles.sideHead, { backgroundColor: side === "right" ? c.rightTint : c.leftTint, flexDirection: ROW }]}>
                                    <View style={[styles.sideMark, { backgroundColor: side === "right" ? c.right : c.left }]} />
                                    <Text style={[styles.sideName, { color: side === "right" ? c.right : c.left }]}>
                                        {side === "right" ? "תקשורת הימין" : "תקשורת השמאל"}
                                    </Text>
                                </View>
                                <Text style={[TYPE.body, styles.sideText, { color: c.ink }]}>{t[side][p.key]}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ))}
            {t.links.length > 0 && (
                <>
                    <SectionHead title="בחדשות היום" count={t.links.length} />
                    <View style={[styles.links, { backgroundColor: c.card }]}>
                        {t.links.map((l, i) => (
                            <Go key={l.id} href={{ pathname: "/story/[id]", params: { id: l.id } }} label={l.title}
                                onPress={() => track("story_opened", { how: "hot_topic" })}>
                                <View style={[styles.link, { flexDirection: ROW, borderTopColor: c.rule, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                                    <View style={styles.linkWords}>
                                        <Text style={[TYPE.row, { color: c.ink }]}>{l.title}</Text>
                                        <Text style={[TYPE.meta, { color: c.muted }]}>{outlets(l.outlets)}</Text>
                                    </View>
                                    <Ionicons name="chevron-back" size={18} color={c.muted} />
                                </View>
                            </Go>
                        ))}
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    missing: { paddingTop: 8 },
    missingCard: { alignItems: "center", padding: 28 },
    card: { marginHorizontal: 12, marginTop: 12, borderRadius: RADIUS.card, padding: 16, gap: 8 },
    pair: { gap: 10, paddingHorizontal: 12 },
    side: { borderRadius: RADIUS.card, overflow: "hidden" },
    sideHead: { alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
    sideMark: { width: 10, height: 10, borderRadius: 3 },
    sideName: { fontFamily: FACE.bold, fontSize: 14.5, lineHeight: 19 },
    sideText: { paddingHorizontal: 16, paddingVertical: 13 },
    links: { marginHorizontal: 12, borderRadius: RADIUS.card, overflow: "hidden" },
    link: { alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
    linkWords: { flex: 1, gap: 4 },
});
