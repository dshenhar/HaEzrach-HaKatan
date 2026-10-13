import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { track } from "@/state/analytics";
import { useQuestionnaire } from "@/state/questionnaire";
import { ROW, useSite } from "./tokens";
import { byNewest, Reading } from "./news";
import { Row } from "./stories";
import { Button, Tabs } from "./controls";

type Who = "all" | "both" | "right" | "left" | "blind";
type Order = "newest" | "covered" | "outside" | "oldest";

const WHO: { key: Who; label: string }[] = [
    { key: "all", label: "הכל" },
    { key: "both", label: "שני הצדדים" },
    { key: "right", label: "רק ימין" },
    { key: "left", label: "רק שמאל" },
    { key: "blind", label: "נקודות עיוורות" },
];

const STEP = 20;

/**
 * The day, story by story, by the clock. Over it, who told them - both sides,
 * one, or the blindspots - and in what order: newest, most told, or, for a reader
 * who has said where they stand, the ones that came most from the other side.
 */
export default function River({ readings, how, showSection = true }: { readings: Reading[]; how: string; showSection?: boolean }) {
    const { c, type } = useSite();
    const { profile } = useQuestionnaire();
    const [who, setWho] = useState<Who>("all");
    const [order, setOrder] = useState<Order>("newest");
    const [shown, setShown] = useState(STEP);

    const orders: { key: Order; label: string }[] = [
        { key: "newest", label: "חדש קודם" },
        { key: "covered", label: "הכי מסוקר" },
        ...(profile ? [{ key: "outside" as Order, label: "מחוץ לתיבת התהודה שלי" }] : []),
        { key: "oldest", label: "ישן קודם" },
    ];

    const list = useMemo(() => {
        const other = profile?.bloc === "right" ? "left" : "right";
        const fromOther = (r: Reading) => {
            const known = r.right + r.left;
            if (!known) return 0;
            return (other === "right" ? r.right : r.left) / known;
        };
        const kept = readings.filter((r) => {
            if (who === "both") return r.right > 0 && r.left > 0;
            if (who === "right") return r.right > 0 && r.left === 0;
            if (who === "left") return r.left > 0 && r.right === 0;
            if (who === "blind") return profile ? r.missing === profile.bloc : r.missing !== null;
            return true;
        });
        const sorted = [...kept];
        if (order === "covered") sorted.sort((a, b) => b.total - a.total || byNewest(a, b));
        else if (order === "oldest") sorted.sort((a, b) => -byNewest(a, b));
        else if (order === "outside") sorted.sort((a, b) => fromOther(b) - fromOther(a) || byNewest(a, b));
        else sorted.sort(byNewest);
        return sorted;
    }, [readings, who, order, profile]);

    return (
        <View>
            <Tabs label="מי סיקר" items={WHO} value={who}
                onChange={(next) => { track("bloc_filter_changed", { filter: next }); setWho(next); setShown(STEP); }} />
            <View style={[styles.orders, { flexDirection: ROW }]}>
                <Text style={[type.meta, { color: c.muted }]}>סדר:</Text>
                {orders.map((o) => (
                    <Text key={o.key} accessibilityRole="button" accessibilityState={{ selected: o.key === order }}
                        onPress={() => { track("sort_changed", { sort: o.key }); setOrder(o.key); }}
                        style={[type.meta, { color: o.key === order ? c.ink : c.ink2,
                            textDecorationLine: o.key === order ? "underline" : "none" }]}>
                        {o.label}
                    </Text>
                ))}
            </View>
            {who === "blind" && (
                <Text style={[type.small, styles.note, { color: c.ink2 }]}>
                    {profile
                        ? "סיפורים שהצד שלכם לא סיקר: שני גופים או יותר מהצד השני, ואפס משלכם."
                        : "סיפורים שצד אחד סיקר והשני לא. מלאו את שאלון העמדות כדי לראות דווקא את אלה שהצד שלכם פספס."}
                </Text>
            )}
            {list.length === 0 ? (
                <Text style={[type.small, styles.empty, { color: c.muted }]}>אין כרגע סיפורים כאלה.</Text>
            ) : (
                list.slice(0, shown).map((r) => <Row key={r.id} r={r} how={how} showSection={showSection} />)
            )}
            {list.length > shown && (
                <View style={styles.more}>
                    <Button quiet label={`עוד ${Math.min(STEP, list.length - shown)} סיפורים`}
                        onPress={() => { track("river_more", { shown }); setShown((n) => n + STEP); }} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    orders: { alignItems: "center", gap: 14, paddingVertical: 12, flexWrap: "wrap" },
    note: { paddingBottom: 10 },
    empty: { paddingVertical: 28, textAlign: "center" },
    more: { paddingTop: 18, alignItems: "center" },
});
