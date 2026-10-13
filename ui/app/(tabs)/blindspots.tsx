import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuestionnaire } from "@/state/questionnaire";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { byNewest, Side, useNews } from "@/site/news";
import { Go, Screen } from "@/site/page";
import { StoryCard } from "@/site/stories";
import { Skeleton } from "@/site/controls";

/**
 * Everything one side ran and the other did not, today. It is the one thing in
 * the app that needs no judgement at all - who covered a story is a count - and
 * the one thing that names something a reader could not have known was missing.
 * So it has the app's highlighter for its colour.
 */
export default function Blindspots() {
    const { c } = useSite();
    const { readings, loading } = useNews();
    const { profile } = useQuestionnaire();
    // a side here is the side that left the story out
    const lists = {
        left: readings.filter((r) => r.missing === "left").sort(byNewest),
        right: readings.filter((r) => r.missing === "right").sort(byNewest),
    };
    const [picked, setPicked] = useState<Side | null>(null);
    const side: Side = picked ?? profile?.bloc ?? (lists.left.length >= lists.right.length ? "left" : "right");
    const list = lists[side];

    const head = (
        <>
            <Text style={[TYPE.body, { color: c.hiInk }]}>
                סיפור הוא נקודה עיוורת כששני גופים או יותר מצד אחד של המפה סיקרו אותו, ואף גוף מהצד השני לא.
                שניים ולא אחד: גוף בודד שסיקר משהו הוא דסק שעבד מאוחר, שניים הם כבר בחירה.
            </Text>
            <View style={[styles.sides, { flexDirection: ROW }]} accessibilityRole="tablist">
                {(["left", "right"] as Side[]).map((missing) => {
                    const on = side === missing;
                    const covered = missing === "left" ? "right" : "left";
                    return (
                        <Pressable key={missing} onPress={() => { track("blindspot_side", { side: missing }); setPicked(missing); }}
                            accessibilityRole="tab" accessibilityState={{ selected: on }}
                            style={[styles.side, { backgroundColor: on ? c.card : "rgba(0,0,0,0.07)" }]}>
                            <View style={[styles.sideTop, { flexDirection: ROW }]}>
                                <View style={[styles.sideMark, { backgroundColor: covered === "right" ? c.right : c.left }]} />
                                <Text style={[styles.sideName, { color: on ? c.ink : c.hiInk }]}>
                                    {covered === "right" ? "רק הימין סיקר" : "רק השמאל סיקר"}
                                </Text>
                            </View>
                            <Text style={[styles.sideCount, { color: on ? c.ink : c.hiInk }]}>{lists[missing].length}</Text>
                            <Text style={[TYPE.meta, { color: on ? c.muted : c.hiInk }]}>
                                {profile?.bloc === missing ? "הצד שלכם פספס" : "סיפורים היום"}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </>
    );

    return (
        <Screen title="נקודות עיוורות" docTitle="נקודות עיוורות" colour={c.hi} tone="dark" head={head}>
            {!profile && (
                <Go href="/questionnaire" style={[styles.nudge, { backgroundColor: c.brandTint, flexDirection: ROW }]}>
                    <Text style={[TYPE.small, { color: c.ink, flex: 1 }]}>
                        מלאו את שאלון העמדות כדי לראות קודם את מה שהצד שלכם פספס.
                    </Text>
                    <Text style={[TYPE.uiStrong, { color: c.brand }]}>לשאלון</Text>
                </Go>
            )}
            <Text style={[TYPE.small, styles.lede, { color: c.ink2 }]}>
                {side === "left" ? "שני גופים או יותר מהימין, ואף אחד מהשמאל." : "שני גופים או יותר מהשמאל, ואף אחד מהימין."}
            </Text>
            {loading && !readings.length ? <Skeleton cards={4} /> : list.length === 0 ? (
                <Text style={[TYPE.small, styles.empty, { color: c.muted }]}>אין היום.</Text>
            ) : list.map((r) => <StoryCard key={r.id} r={r} how="blindspots" showBlind={false} />)}
        </Screen>
    );
}

const styles = StyleSheet.create({
    sides: { gap: 10, marginTop: 4 },
    side: { flex: 1, borderRadius: 18, padding: 14, gap: 2 },
    sideTop: { alignItems: "center", gap: 7 },
    sideMark: { width: 10, height: 10, borderRadius: 3 },
    sideName: { fontFamily: FACE.bold, fontSize: 14.5, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
    sideCount: { fontFamily: FACE.black, fontSize: 40, lineHeight: 46, textAlign: "right", fontVariant: ["tabular-nums"] },
    nudge: { marginHorizontal: 12, marginTop: 14, borderRadius: RADIUS.inner, padding: 14, alignItems: "center", gap: 12 },
    lede: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
    empty: { paddingVertical: 28, textAlign: "center" },
});
