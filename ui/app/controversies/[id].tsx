import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { HotSide } from "@/state/hotTopics";
import { track } from "@/state/analytics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { outlets, useNews } from "@/site/news";
import { Page, pressTint, SectionHead, Wrap } from "@/site/page";
import { Skeleton } from "@/site/controls";

const PARTS: { key: keyof HotSide; label: string }[] = [
    { key: "coverage", label: "איך מסקרים" },
    { key: "view", label: "איך רואים את זה" },
    { key: "motives", label: "ולמה" },
];

/**
 * One affair: what it is, and then the two camps' media on it in two columns,
 * part by part - how each covers it, how each sees it, and why. It speaks of the
 * camps' media and never names an outlet.
 */
export default function Controversy() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { c, type, wide } = useSite();
    const { hotById, loading, hot } = useNews();
    const router = useRouter();
    const t = hotById(String(id));

    if (!t) {
        return (
            <Page back title="מחלוקת" nav="controversies">
                <Wrap style={styles.page}>
                    {loading || !hot ? <Skeleton lines={4} big /> : (
                        <>
                            <Text style={[type.h1, { color: c.ink }]}>המחלוקת הזאת לא נמצאה</Text>
                            <Link href="/controversies" style={StyleSheet.flatten([type.uiStrong, { color: c.ink, textDecorationLine: "underline" }])}>לכל המחלוקות</Link>
                        </>
                    )}
                </Wrap>
            </Page>
        );
    }

    const side = (which: "right" | "left") => {
        const ink = which === "right" ? c.right : c.left;
        return (
            <View style={styles.col}>
                <Text style={[type.section, styles.colHead, { color: ink, borderTopColor: ink }]}>
                    {which === "right" ? "תקשורת הימין" : "תקשורת השמאל"}
                </Text>
                {PARTS.map((p) => (
                    <View key={p.key} style={styles.part}>
                        <Text style={[type.label, { color: c.ink }]}>{p.label}</Text>
                        <Text style={[type.body, { color: c.ink }]}>{t[which][p.key]}</Text>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <Page back title={t.title} nav="controversies">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">{t.title}</Text>
                    <Text style={[type.dek, { color: c.ink2 }]}>{t.one_line}</Text>
                    {!!t.status_date && <Text style={[type.meta, { color: c.muted }]}>נכון ל-{t.status_date.split("-").reverse().map(Number).join(".")}</Text>}
                    <Text style={[type.body, styles.summary, { color: c.ink, borderTopColor: c.ruleStrong }]}>{t.summary}</Text>
                </View>
                <View style={[styles.sides, { flexDirection: wide ? ROW : "column" }]}>
                    {side("right")}
                    {wide && <View style={[styles.spine, { backgroundColor: c.rule }]} />}
                    {side("left")}
                </View>
                {t.links.length > 0 && (
                    <View style={[styles.column, styles.links]}>
                        <SectionHead title="בחדשות היום" />
                        {t.links.map((l) => (
                            <Pressable key={l.id} accessibilityRole="link"
                                onPress={() => { track("story_opened", { how: "hot_topic" }); router.push({ pathname: "/story/[id]", params: { id: l.id } }); }}
                                style={(s) => [styles.link, { borderTopColor: c.rule }, pressTint(c)(s)]}>
                                <Text style={[type.row, { color: c.ink }]}>{l.title}</Text>
                                <Text style={[type.meta, { color: c.muted }]}>{outlets(l.outlets)}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    column: { maxWidth: 760, width: "100%", alignSelf: "flex-end", gap: 12 },
    summary: { borderTopWidth: 3, paddingTop: 16, marginTop: 6 },
    sides: { marginTop: 34, gap: 28, alignItems: "stretch" },
    spine: { width: 1 },
    col: { flex: 1, gap: 16 },
    colHead: { borderTopWidth: 4, paddingTop: 10, fontFamily: FACE.serifBlack },
    part: { gap: 6 },
    links: { marginTop: 36 },
    link: { gap: 5, paddingVertical: 14, borderTopWidth: 1, paddingHorizontal: 6, marginHorizontal: -6 },
});
