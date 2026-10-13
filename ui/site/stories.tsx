import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { track } from "@/state/analytics";
import { blindLabel } from "@/state/blindspot";
import { useQuestionnaire } from "@/state/questionnaire";
import { FACE, ROW, useSite } from "./tokens";
import Meter from "./meter";
import { clock, outlets, Reading, Side, when } from "./news";
import { pressTint } from "./page";

/** what the measurement learns about a story being opened, and nothing else */
const shape = (r: Reading) => ({
    topic: r.topic, section: r.section, outlets: r.total, right: r.right, left: r.left,
    shape: r.right && r.left ? "both" : r.right ? "right only" : "left only",
    blind_to: r.missing ?? undefined,
});

export function useOpenStory() {
    const router = useRouter();
    return (r: Reading, how: string) => {
        track("story_opened", { how, ...shape(r) });
        router.push({ pathname: "/story/[id]", params: { id: r.id } });
    };
}

/** the line under a headline: its section, when it broke, how many told it */
export function Meta({ r, onBand, showSection = true }: { r: Reading; onBand?: boolean; showSection?: boolean }) {
    const { c, type } = useSite();
    const ink = onBand ? c.bandInk : c.ink;
    const quiet = onBand ? c.bandMuted : c.muted;
    const sep = <View style={[styles.sep, { backgroundColor: onBand ? c.bandRule : c.rule }]} />;
    return (
        <View style={[styles.meta, { flexDirection: ROW }]}>
            {showSection && !!r.section && <Text style={[type.meta, { color: ink, fontFamily: FACE.sansBold }]}>{r.section}</Text>}
            {showSection && !!r.section && sep}
            <Text style={[type.meta, { color: quiet }]}>{when(r.first)}</Text>
            {sep}
            <Text style={[type.meta, { color: quiet }]}>{outlets(r.total)}</Text>
        </View>
    );
}

/**
 * Which side left the story out, said in plain words: a count, so it can stand
 * on a headline where a label could not. When the reader has told us their side
 * and it is theirs, it says so.
 */
export function BlindNote({ r, onBand }: { r: Reading; onBand?: boolean }) {
    const { c, type } = useSite();
    const { profile } = useQuestionnaire();
    if (!r.missing) return null;
    const ink = r.missing === "right" ? (onBand ? c.bandRight : c.right) : (onBand ? c.bandLeft : c.left);
    const mine = profile?.bloc === r.missing;
    return (
        <View style={[styles.blind, { flexDirection: ROW }]}>
            <View style={[styles.blindMark, { borderColor: ink }, mine && { backgroundColor: ink }]} />
            <Text style={[type.label, { color: ink }]}>{blindLabel(r.missing, profile?.bloc)}</Text>
        </View>
    );
}

/** a story's summary when no bloc is asked: the one across both, or the lead's own standfirst */
const dekOf = (r: Reading) => {
    if (r.summaries.all) return r.summaries.all;
    const s = r.lead.summary?.trim();
    return s && s !== r.lead.title.trim() ? s : "";
};

/**
 * The day's lead. The headline at the paper's largest, what happened in a line,
 * the meter at full width, and how each side told it in two equal columns - the
 * whole idea of the site before the first scroll.
 */
export function Lead({ r }: { r: Reading }) {
    const { c, type, desk } = useSite();
    const open = useOpenStory();
    const dek = dekOf(r);
    return (
        <View style={styles.lead}>
            <Pressable onPress={() => open(r, "lead")} accessibilityRole="link"
                style={(s) => [styles.pressable, pressTint(c)(s)]}>
                <Text style={[type.lead, { color: c.ink }]}>{r.lead.title}</Text>
            </Pressable>
            {!!dek && <Text style={[type.dek, { color: c.ink2 }]}>{dek}</Text>}
            <Meta r={r} />
            <BlindNote r={r} />
            <View style={styles.leadMeter}><Meter right={r.right} left={r.left} other={r.other} size="md" /></View>
            <Twin r={r} lines={desk ? 7 : 5} big={desk} />
            <Pressable onPress={() => open(r, "lead_more")} accessibilityRole="link" style={styles.more}>
                {({ hovered }: any) => (
                    <Text style={[type.uiStrong, { color: c.ink, textDecorationLine: hovered ? "underline" : "none" }]}>
                        שני הצדדים, וכל הכתבות ←
                    </Text>
                )}
            </Pressable>
        </View>
    );
}

/**
 * The two sides of one story, in two columns of the same width: the right's on
 * the right, the left's on the left. A side that told none of it keeps its column,
 * and the column says so.
 */
export function Twin({ r, lines, full, texts, big }: {
    r: Reading;
    lines?: number;
    /** the reading size, without the story page's waiting state */
    big?: boolean;
    /** on the story's own page: the texts may arrive late, and are set larger */
    full?: boolean;
    texts?: Partial<Record<Side, string | null>>;
}) {
    const { c, type } = useSite();
    const col = (side: Side) => {
        const n = side === "right" ? r.right : r.left;
        const ink = side === "right" ? c.right : c.left;
        const text = texts ? texts[side] : r.summaries[side];
        return (
            <View style={styles.col}>
                <View style={[styles.colHead, { flexDirection: ROW, borderBottomColor: ink }]}>
                    <Text style={[type.label, { color: ink, fontSize: full ? 16 : 14 }]}>
                        {side === "right" ? "כך סופר בימין" : "כך סופר בשמאל"}
                    </Text>
                    <Text style={[type.meta, { color: c.muted }]}>{outlets(n)}</Text>
                </View>
                {n === 0 ? (
                    <Text style={[full ? type.body : type.small, { color: c.muted }]}>אף גוף מהצד הזה לא סיקר</Text>
                ) : text ? (
                    <Text style={[full || big ? type.body : type.small, { color: c.ink }]} numberOfLines={lines}>{text}</Text>
                ) : text === undefined && full ? (
                    <Text style={[type.small, { color: c.muted }]}>מכין סיכום…</Text>
                ) : (
                    <Text style={[type.small, { color: c.ink2 }]} numberOfLines={3}>
                        {(side === "right" ? r.rightItems : r.leftItems).map((i) => i.source).join(", ")}
                    </Text>
                )}
            </View>
        );
    };
    return (
        <View style={[styles.twin, { flexDirection: ROW }]}>
            {col("right")}
            <View style={[styles.spine, { backgroundColor: c.rule }]} />
            {col("left")}
        </View>
    );
}

/** a story given room, under the lead or beside it */
export function Major({ r, how }: { r: Reading; how: string }) {
    const { c, type } = useSite();
    const open = useOpenStory();
    return (
        <Pressable onPress={() => open(r, how)} accessibilityRole="link"
            style={(s) => [styles.major, { borderTopColor: c.rule }, pressTint(c)(s)]}>
            <Text style={[type.major, { color: c.ink }]}>{r.lead.title}</Text>
            <Meta r={r} />
            <BlindNote r={r} />
            <Meter right={r.right} left={r.left} other={r.other} size="sm" />
        </Pressable>
    );
}

/**
 * One line of the day: when it broke in its own column, the headline, and the
 * meter at its thinnest. A list a reader can run down by the clock.
 */
export function Row({ r, how, onBand, showSection = true, showBlind = true }: {
    r: Reading; how: string; onBand?: boolean; showSection?: boolean; showBlind?: boolean;
}) {
    const { c, type } = useSite();
    const open = useOpenStory();
    const ink = onBand ? c.bandInk : c.ink;
    return (
        <Pressable onPress={() => open(r, how)} accessibilityRole="link"
            style={(s) => [styles.row, { borderTopColor: onBand ? c.bandRule : c.rule, flexDirection: ROW },
                !onBand && pressTint(c)(s)]}>
            <Text style={[styles.time, { color: onBand ? c.bandMuted : c.ink }]}>{clock(r.first)}</Text>
            <View style={styles.rowBody}>
                <Text style={[type.row, { color: ink }]}>{r.lead.title}</Text>
                <View style={[styles.rowMeta, { flexDirection: ROW }]}>
                    {showSection && !!r.section && (
                        <Text style={[type.meta, { color: ink, fontFamily: FACE.sansBold }]}>{r.section}</Text>
                    )}
                    <Text style={[type.meta, { color: onBand ? c.bandMuted : c.muted }]}>{outlets(r.total)}</Text>
                    {!onBand && showBlind && <BlindNote r={r} />}
                </View>
                <View style={styles.rowMeter}>
                    <Meter right={r.right} left={r.left} other={r.other} size="sm" onBand={onBand} />
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pressable: { marginHorizontal: -6, paddingHorizontal: 6, paddingVertical: 2 },
    meta: { alignItems: "center", gap: 10, flexWrap: "wrap" },
    sep: { width: 1, height: 12 },
    blind: { alignItems: "center", gap: 7 },
    blindMark: { width: 10, height: 10, borderWidth: 2 },
    lead: { gap: 14 },
    leadMeter: { marginTop: 2 },
    twin: { gap: 16, alignItems: "stretch", marginTop: 4 },
    col: { flex: 1, gap: 8 },
    colHead: { justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 2, paddingBottom: 6, gap: 6, flexWrap: "wrap" },
    spine: { width: 1 },
    more: { alignSelf: "flex-end", paddingVertical: 6 },
    major: { gap: 10, paddingVertical: 16, borderTopWidth: 1, marginHorizontal: -6, paddingHorizontal: 6 },
    row: { gap: 14, paddingVertical: 15, borderTopWidth: 1, alignItems: "flex-start", marginHorizontal: -6, paddingHorizontal: 6 },
    time: { fontFamily: FACE.sansHeavy, fontSize: 15, lineHeight: 25, width: 44, textAlign: "right", fontVariant: ["tabular-nums"] },
    rowBody: { flex: 1, gap: 7 },
    rowMeta: { alignItems: "center", gap: 12, flexWrap: "wrap" },
    rowMeter: { marginTop: 2 },
});
