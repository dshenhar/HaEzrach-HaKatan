import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { track } from "@/state/analytics";
import { useQuestionnaire } from "@/state/questionnaire";
import { TYPE, useSite } from "./tokens";
import { byNewest, Reading } from "./news";
import { StoryCard } from "./stories";
import { Button, Chips } from "./controls";

type Who = "all" | "both" | "right" | "left" | "blind";
type Order = "newest" | "covered" | "outside" | "oldest";

const STEP = 20;

/**
 * The day, story by story. Over it, who told them - both sides, one, or the
 * blindspots - and in what order: newest, most told, or, for a reader who has
 * said where they stand, the ones that came most from the other side.
 */
export default function River({ readings, how, showSection = true }: { readings: Reading[]; how: string; showSection?: boolean }) {
    const { c } = useSite();
    const { profile } = useQuestionnaire();
    const [who, setWho] = useState<Who>("all");
    const [order, setOrder] = useState<Order>("newest");
    const [shown, setShown] = useState(STEP);

    const counts = useMemo(() => ({
        all: readings.length,
        both: readings.filter((r) => r.right > 0 && r.left > 0).length,
        right: readings.filter((r) => r.right > 0 && r.left === 0).length,
        left: readings.filter((r) => r.left > 0 && r.right === 0).length,
        blind: readings.filter((r) => (profile ? r.missing === profile.bloc : r.missing !== null)).length,
    }), [readings, profile]);

    const whos: { key: Who; label: string; count: number }[] = [
        { key: "all", label: "הכל", count: counts.all },
        { key: "both", label: "שני הצדדים", count: counts.both },
        { key: "right", label: "רק ימין", count: counts.right },
        { key: "left", label: "רק שמאל", count: counts.left },
        { key: "blind", label: "נקודות עיוורות", count: counts.blind },
    ];
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
            <Chips label="מי סיקר" items={whos} value={who}
                onChange={(next) => { track("bloc_filter_changed", { filter: next }); setWho(next); setShown(STEP); }} />
            <View style={styles.orders}>
                <Chips small label="סדר" items={orders} value={order}
                    onChange={(next) => { track("sort_changed", { sort: next }); setOrder(next); }} />
            </View>
            {who === "blind" && (
                <Text style={[TYPE.small, styles.note, { color: c.ink2 }]}>
                    {profile
                        ? "סיפורים שהצד שלכם לא סיקר: שני גופים או יותר מהצד השני, ואפס משלכם."
                        : "סיפורים שצד אחד סיקר והשני לא. מלאו את שאלון העמדות כדי לראות דווקא את אלה שהצד שלכם פספס."}
                </Text>
            )}
            <View style={styles.list}>
                {list.length === 0 ? (
                    <Text style={[TYPE.small, styles.empty, { color: c.muted }]}>אין כרגע סיפורים כאלה.</Text>
                ) : (
                    list.slice(0, shown).map((r) => <StoryCard key={r.id} r={r} how={how} showSection={showSection} />)
                )}
            </View>
            {list.length > shown && (
                <View style={styles.more}>
                    <Button quiet wide label={`עוד ${Math.min(STEP, list.length - shown)} סיפורים`}
                        onPress={() => { track("river_more", { shown }); setShown((n) => n + STEP); }} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    orders: { marginTop: 8 },
    note: { paddingHorizontal: 18, paddingTop: 12 },
    list: { marginTop: 14 },
    empty: { paddingVertical: 28, textAlign: "center" },
    more: { paddingHorizontal: 12, paddingTop: 6 },
});
