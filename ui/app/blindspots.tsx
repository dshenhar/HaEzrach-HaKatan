import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useQuestionnaire } from "@/state/questionnaire";
import { ROW, useSite } from "@/site/tokens";
import { byNewest, Reading, useNews } from "@/site/news";
import { Page, Wrap } from "@/site/page";
import { Row } from "@/site/stories";
import { Skeleton } from "@/site/controls";

/**
 * Everything one side ran and the other did not, today. It is the one thing on
 * the site that needs no judgement at all - who covered a story is a count - and
 * the one thing that names something a reader could not have known was missing.
 */
export default function Blindspots() {
    const { c, type, wide } = useSite();
    const { readings, loading } = useNews();
    const { profile } = useQuestionnaire();
    const onlyRight = readings.filter((r) => r.missing === "left").sort(byNewest);
    const onlyLeft = readings.filter((r) => r.missing === "right").sort(byNewest);

    const column = (side: "right" | "left", list: Reading[]) => {
        const ink = side === "right" ? c.right : c.left;
        const yours = profile && profile.bloc !== side;
        return (
            <View style={styles.col}>
                <View style={[styles.colHead, { borderTopColor: ink }]}>
                    <Text style={[type.section, { color: ink }]}>{side === "right" ? "רק הימין סיקר" : "רק השמאל סיקר"}</Text>
                    <Text style={[type.small, { color: c.ink2 }]}>
                        {side === "right" ? "שני גופים או יותר מהימין, ואף אחד מהשמאל." : "שני גופים או יותר מהשמאל, ואף אחד מהימין."}
                        {yours ? " את אלה הצד שלכם פספס." : ""}
                    </Text>
                    <Text style={[type.meta, { color: c.muted }]}>{list.length} סיפורים</Text>
                </View>
                {list.length === 0
                    ? <Text style={[type.small, styles.empty, { color: c.muted }]}>אין היום.</Text>
                    : list.map((r) => <Row key={r.id} r={r} how="blindspots" showBlind={false} />)}
            </View>
        );
    };

    // the reader's own blindspot first, when they have told us where they stand
    const order: ("right" | "left")[] = profile?.bloc === "right" ? ["left", "right"] : ["right", "left"];

    return (
        <Page back title="נקודות עיוורות" nav="blindspots">
            <Wrap style={styles.page}>
                <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">נקודות עיוורות</Text>
                <Text style={[type.dek, styles.dek, { color: c.ink2, borderBottomColor: c.ruleStrong }]}>
                    סיפור הוא נקודה עיוורת כששני גופים או יותר מצד אחד של המפה סיקרו אותו, ואף גוף מהצד השני לא.
                    שניים ולא אחד: גוף בודד שסיקר משהו הוא דסק שעבד מאוחר, שניים הם כבר בחירה.
                </Text>
                {!profile && (
                    <Text style={[type.small, { color: c.ink2 }]}>
                        <Link href="/questionnaire" style={{ textDecorationLine: "underline", color: c.ink }}>מלאו את שאלון העמדות</Link>
                        {" "}כדי לראות קודם את מה שהצד שלכם פספס.
                    </Text>
                )}
                {loading && !readings.length ? <Skeleton lines={5} /> : (
                    <View style={[styles.cols, { flexDirection: wide ? ROW : "column" }]}>
                        {(wide ? ["right", "left"] as const : order).map((side) =>
                            <React.Fragment key={side}>{column(side, side === "right" ? onlyRight : onlyLeft)}</React.Fragment>)}
                    </View>
                )}
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22, gap: 14 },
    dek: { borderBottomWidth: 3, paddingBottom: 18 },
    cols: { gap: 32, marginTop: 14 },
    col: { flex: 1 },
    colHead: { borderTopWidth: 4, paddingTop: 10, gap: 6, paddingBottom: 6 },
    empty: { paddingVertical: 18 },
});
