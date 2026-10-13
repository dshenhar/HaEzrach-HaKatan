import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { track } from "@/state/analytics";
import { blindLabel } from "@/state/blindspot";
import { useQuestionnaire } from "@/state/questionnaire";
import { FACE, RADIUS, ROW, sectionColour, sectionWash, TYPE, useSite } from "./tokens";
import Meter from "./meter";
import { outlets, Reading, Side, when } from "./news";
import { Card } from "./page";

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

/** a story's section, as a chip in its colour: washed on white, or white on its colour */
export function SectionChip({ name, onColour }: { name: string; onColour?: boolean }) {
    const { dark } = useSite();
    if (!name) return null;
    const ink = sectionColour(name);
    return (
        <View style={[styles.chip, { backgroundColor: onColour ? "rgba(255,255,255,0.22)" : sectionWash(name, dark) }]}>
            <Text style={[styles.chipText, { color: onColour ? "#FFFFFF" : dark ? "#FFFFFF" : ink }]} numberOfLines={1}>{name}</Text>
        </View>
    );
}

/**
 * Which side left the story out, on the highlighter: the one finding the app
 * makes, so the one thing in yellow. A count, so it can stand on a headline;
 * when the reader has told us their side and it is theirs, it says so.
 */
export function BlindBadge({ r }: { r: Reading }) {
    const { c } = useSite();
    const { profile } = useQuestionnaire();
    if (!r.missing) return null;
    return (
        <View style={[styles.badge, { backgroundColor: c.hi, flexDirection: ROW }]}>
            <View style={[styles.badgeMark, { backgroundColor: r.missing === "right" ? c.right : c.left }]} />
            <Text style={[styles.badgeText, { color: c.hiInk }]}>{blindLabel(r.missing, profile?.bloc)}</Text>
        </View>
    );
}

/** a story's summary when no bloc is asked: the one across both, or the lead's own standfirst */
export const dekOf = (r: Reading) => {
    if (r.summaries.all) return r.summaries.all;
    const s = r.lead.summary?.trim();
    return s && s !== r.lead.title.trim() ? s : "";
};

/**
 * The day's lead, as the screen's big card in its section's colour: the
 * headline, the meter, and how each side told it in two white cards of the same
 * size - the whole idea of the app before the first scroll.
 */
export function Hero({ r }: { r: Reading }) {
    const { c } = useSite();
    const open = useOpenStory();
    return (
        <Pressable onPress={() => open(r, "lead")} accessibilityRole="link" accessibilityLabel={r.lead.title}
            style={({ pressed }) => [styles.hero, { backgroundColor: sectionColour(r.section) }, pressed && styles.pressed]}>
            <View style={[styles.heroTop, { flexDirection: ROW }]}>
                <SectionChip name={r.section} onColour />
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>{when(r.first)}  ·  {outlets(r.total)}</Text>
            </View>
            <Text style={[TYPE.hero, { color: c.onColour }]}>{r.lead.title}</Text>
            {r.missing && <View style={styles.heroBadge}><BlindBadge r={r} /></View>}
            <Meter right={r.right} left={r.left} other={r.other} size="md" onColour />
            <View style={[styles.heroTwin, { flexDirection: ROW }]}>
                {(["right", "left"] as Side[]).map((side) => (
                    <SideCard key={side} r={r} side={side} lines={5} />
                ))}
            </View>
            <View style={[styles.heroMore, { flexDirection: ROW }]}>
                <Text style={[TYPE.uiStrong, { color: c.onColour }]}>לשני הצדדים ולכל הכתבות</Text>
                <Text style={[TYPE.uiStrong, { color: c.onColour }]}>←</Text>
            </View>
        </Pressable>
    );
}

/**
 * One side's telling of a story, as a white card headed in that side's ink.
 * A side that told none of it keeps its card, and the card says so.
 */
export function SideCard({ r, side, lines, text, big }: {
    r: Reading; side: Side; lines?: number;
    /** given by the story screen, which fetches a missing summary; undefined there is "on its way" */
    text?: string | null;
    big?: boolean;
}) {
    const { c } = useSite();
    const n = side === "right" ? r.right : r.left;
    const ink = side === "right" ? c.right : c.left;
    const tint = side === "right" ? c.rightTint : c.leftTint;
    const said = text !== undefined ? text : r.summaries[side];
    const fallback = (side === "right" ? r.rightItems : r.leftItems).map((i) => i.source).join(", ");
    return (
        <View style={[styles.side, { backgroundColor: c.card }]}>
            <View style={[styles.sideHead, { backgroundColor: tint, flexDirection: ROW }]}>
                <Text style={[styles.sideLabel, { color: ink }]}>{side === "right" ? "ימין" : "שמאל"}</Text>
                <Text style={[styles.sideCount, { color: ink }]}>{n}</Text>
            </View>
            <View style={styles.sideBody}>
                {n === 0 ? (
                    <Text style={[big ? TYPE.body : TYPE.small, { color: c.muted }]}>אף גוף מהצד הזה לא סיקר</Text>
                ) : said ? (
                    <Text style={[big ? TYPE.body : TYPE.small, { color: c.ink }]} numberOfLines={lines}>{said}</Text>
                ) : said === undefined && text === undefined && big ? (
                    <Text style={[TYPE.small, { color: c.muted }]}>מכין סיכום…</Text>
                ) : (
                    <Text style={[TYPE.small, { color: c.ink2 }]} numberOfLines={lines}>{fallback}</Text>
                )}
            </View>
        </View>
    );
}

/** a story on a shelf: its section's colour, the headline, the meter */
export function ShelfCard({ r, how }: { r: Reading; how: string }) {
    const { c } = useSite();
    const open = useOpenStory();
    return (
        <Pressable onPress={() => open(r, how)} accessibilityRole="link" accessibilityLabel={r.lead.title}
            style={({ pressed }) => [styles.shelfCard, { backgroundColor: sectionColour(r.section) }, pressed && styles.pressed]}>
            <View style={[styles.heroTop, { flexDirection: ROW }]}>
                <SectionChip name={r.section} onColour />
                <Text style={[TYPE.meta, { color: c.onColourMuted }]}>{when(r.first)}</Text>
            </View>
            <Text style={[TYPE.title, { color: c.onColour }]} numberOfLines={4}>{r.lead.title}</Text>
            <View style={styles.fill} />
            <Meter right={r.right} left={r.left} other={r.other} size="sm" onColour />
        </Pressable>
    );
}

/** a story in the day's list: a white card with its section, its headline and its meter */
export function StoryCard({ r, how, showSection = true, showBlind = true }: {
    r: Reading; how: string; showSection?: boolean; showBlind?: boolean;
}) {
    const { c } = useSite();
    const open = useOpenStory();
    return (
        <Card onPress={() => open(r, how)} label={r.lead.title} style={styles.storyCard}>
            <View style={[styles.cardTop, { flexDirection: ROW }]}>
                {showSection && <SectionChip name={r.section} />}
                <Text style={[TYPE.meta, { color: c.muted }]}>{when(r.first)}</Text>
                <View style={styles.fill} />
                <Text style={[TYPE.meta, { color: c.muted }]}>{outlets(r.total)}</Text>
            </View>
            <Text style={[TYPE.row, { color: c.ink }]}>{r.lead.title}</Text>
            {showBlind && r.missing && <BlindBadge r={r} />}
            <Meter right={r.right} left={r.left} other={r.other} size="sm" />
        </Card>
    );
}

const styles = StyleSheet.create({
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
    fill: { flex: 1 },
    chip: { borderRadius: RADIUS.chip, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 170 },
    chipText: { fontFamily: FACE.semi, fontSize: 12.5, lineHeight: 16 },
    badge: { alignSelf: "flex-end", alignItems: "center", gap: 6, borderRadius: RADIUS.chip, paddingHorizontal: 10, paddingVertical: 4 },
    badgeMark: { width: 8, height: 8, borderRadius: 2 },
    badgeText: { fontFamily: FACE.bold, fontSize: 12.5, lineHeight: 16 },

    hero: { marginHorizontal: 12, borderRadius: 26, padding: 18, gap: 14 },
    heroTop: { justifyContent: "space-between", alignItems: "center", gap: 10 },
    heroBadge: { marginTop: -4 },
    heroTwin: { gap: 8, alignItems: "stretch" },
    heroMore: { justifyContent: "space-between", alignItems: "center", paddingTop: 2 },

    side: { flex: 1, borderRadius: RADIUS.inner, overflow: "hidden" },
    sideHead: { justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
    sideLabel: { fontFamily: FACE.heavy, fontSize: 15, lineHeight: 19 },
    sideCount: { fontFamily: FACE.heavy, fontSize: 16, fontVariant: ["tabular-nums"] },
    sideBody: { padding: 12 },

    shelfCard: { width: 264, minHeight: 210, borderRadius: 22, padding: 16, gap: 12 },
    storyCard: { marginHorizontal: 12, marginBottom: 10, gap: 10 },
    cardTop: { alignItems: "center", gap: 8 },
});
