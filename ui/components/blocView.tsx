import { NewsItem, Bloc, SitePosition, getBlocSummary, storySummaries } from '@/state/engagement';
import { track } from '@/state/analytics';
import { useSkin } from '@/state/direction';
import { useTheme } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Side = "right" | "left";

type Props = {
    data: NewsItem[];
    positions: Record<string, SitePosition>;
    onOpenArticle: (item: NewsItem) => void;
}

/**
 * The story as two blocs, side by side: who told it on the right, who on the left.
 *
 * Each side leads with a line on how that side told it - written by the server
 * before anyone asked, and there for every reader without a touch. Under it, closed,
 * a side is a list of names: enough to see the shape of the coverage, and short
 * enough that nine outlets no longer run the card off the screen. Touch a side and
 * every outlet's own headline opens under the summary, which stays where it was.
 */
const BlocView = ({ data, positions, onOpenArticle }: Props) => {
    const { right, left, unaligned } = useMemo(() => {
        const buckets: Record<string, NewsItem[]> = { right: [], left: [], unaligned: [] };
        data.forEach((item) => {
            const bloc: Bloc = positions[item.source]?.bloc ?? "unknown";
            buckets[bloc === "right" || bloc === "left" ? bloc : "unaligned"].push(item);
        });
        return { right: buckets.right, left: buckets.left, unaligned: buckets.unaligned };
    }, [data, positions]);

    const storyId = data[0]?.groupId;
    const [openSide, setOpenSide] = useState<Side | null>(null);
    // The feed carries the summaries. A story that changed after the last pass can
    // arrive without one, and then it is fetched here at once, as the side shows -
    // the server writes it and keeps it for the next reader.
    const carried = useMemo(() => storySummaries(data), [data]);
    // undefined: on its way. null: none came back.
    const [fetched, setFetched] = useState<Partial<Record<Side, string | null>>>({});
    const needs = (side: Side) => (side === "right" ? right : left).length > 0 && !carried[side];
    const wantRight = needs("right");
    const wantLeft = needs("left");
    useEffect(() => {
        if (storyId === undefined) return;
        let live = true;
        (["right", "left"] as Side[]).forEach((side) => {
            if (side === "right" ? !wantRight : !wantLeft) return;
            getBlocSummary(storyId, side).then((text) => {
                if (live) setFetched((current) => ({ ...current, [side]: text }));
            });
        });
        return () => { live = false; };
    }, [storyId, wantRight, wantLeft]);

    const t = useTheme();
    const skin = useSkin();
    const f = skin.faces;
    const look = LOOKS[skin.name];

    const column = (items: NewsItem[], side: Side, label: string) => {
        const open = openSide === side;
        const summary = carried[side] ?? fetched[side];
        const ink = side === "right" ? t.right : t.left;
        const empty = items.length === 0;
        // the world decides what a side is: a slip in the tray, a commentary on the
        // page, a panel with its own header band
        const box = skin.name === "ballot"
            ? [look.col, { backgroundColor: t.surface, borderColor: empty ? ink : t.line,
                borderRadius: skin.radius.card, borderTopColor: ink },
                empty && { borderStyle: "dashed" as const, borderTopWidth: 1.5, borderWidth: 1.5 }]
            : skin.name === "sign"
                ? [look.col, { backgroundColor: t.surface, borderColor: open ? t.text : t.line,
                    borderRadius: skin.radius.card }]
                : [look.col];
        return (
            <Pressable
                style={box}
                onPress={() => {
                    if (!open) track("bloc_side_opened", { side, outlets: items.length });
                    setOpenSide(open ? null : side);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${items.length} גופים`}
            >
                {skin.name === "sign" ? (
                    <View style={[look.colHead, { backgroundColor: t.name === "negative" ? "#000000" : "#0F0F0F" }]}>
                        <View style={[look.swatch, { backgroundColor: ink }]} />
                        <Text style={[look.colLabel, { color: "#FFFFFF", fontFamily: f.uiStrong }]}>{label}</Text>
                        <Text style={[look.colCount, { color: "#FFFFFF", fontFamily: f.figure }]}>{items.length}</Text>
                    </View>
                ) : (
                    <View style={look.colHead}>
                        <Text style={[look.colLabel, { color: ink,
                            fontFamily: skin.name === "ballot" ? f.display : f.bodyStrong }]}>{label}</Text>
                        <Text style={[look.colCount, { color: empty ? ink : t.text, fontFamily: f.figure }]}>
                            {items.length}
                        </Text>
                    </View>
                )}

                <View style={look.colBody}>
                {empty ? (
                    <Text style={[look.empty, { color: t.textMuted, fontFamily: f.body }]}>אף גוף מהצד הזה לא סיקר</Text>
                ) : (
                    <>
                        {summary ? (
                            <View style={[look.aiBox, skin.name === "daf" && { borderColor: t.line }]}>
                                <Text style={[look.aiLabel, { color: t.textMuted, fontFamily: f.uiStrong }]}>סיכום AI</Text>
                                <Text style={[look.aiText, { color: t.text, fontFamily: f.body }]}>{summary}</Text>
                            </View>
                        ) : summary === undefined ? (
                            <Text style={[look.aiWaiting, { color: t.textMuted, fontFamily: f.body }]}>מכין סיכום…</Text>
                        ) : null}

                        <View style={look.outlets}>
                        {items.map((item) => (
                            <Press
                                key={item.id}
                                onPress={() => (open ? onOpenArticle(item) : setOpenSide(side))}
                                style={[look.outletBlock, skin.name === "sign" && { borderTopColor: t.line }]}
                            >
                                <View style={look.outletRow}>
                                    {skin.name !== "daf" && (
                                        <View style={[look.dot, { backgroundColor: ink }]} />
                                    )}
                                    <Text style={[look.outlet, { color: skin.name === "daf" ? ink : t.text,
                                        fontFamily: f.uiStrong }]} numberOfLines={1}>
                                        {item.source}
                                    </Text>
                                    {/* the way to the article, on the sign: an arrow to the panel's edge */}
                                    {skin.name === "sign" && open && (
                                        <Ionicons name="arrow-back" size={15} color={t.text} />
                                    )}
                                </View>
                                {open && (
                                    <Text style={[look.headline, { color: t.text, fontFamily: f.body }]}
                                        numberOfLines={3}>{item.title}</Text>
                                )}
                            </Press>
                        ))}
                        </View>
                    </>
                )}
                </View>
            </Pressable>
        );
    };

    return (
        <View>
            <View style={[look.split, skin.name === "ballot" && { backgroundColor: t.bg, borderRadius: skin.radius.card }]}>
                {column(right, "right", "ימין")}
                {skin.name === "daf" && <View style={[look.spine, { backgroundColor: t.line }]} />}
                {column(left, "left", "שמאל")}
            </View>

            {unaligned.length > 0 && (
                <View style={[look.unaligned, { backgroundColor: skin.name === "daf" ? "transparent" : t.surfaceAlt,
                    borderColor: t.line, borderRadius: skin.radius.card }]}>
                    <Text style={[look.unalignedTitle, { color: t.text, fontFamily: f.uiStrong }]}>
                        {unaligned.length} גופי חדשות לא נכנסו לאף גוש
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {unaligned.map((item) => (
                            <Press key={item.id} style={[look.pill, { backgroundColor: t.surface, borderColor: t.line,
                                borderRadius: skin.radius.chip }]} onPress={() => onOpenArticle(item)}>
                                <Text style={[look.pillText, { color: t.text, fontFamily: f.uiStrong }]}>{item.source}</Text>
                            </Press>
                        ))}
                    </ScrollView>
                    <Text style={[look.unalignedNote, { color: t.textMuted, fontFamily: f.body }]}>
                        בתצוגה הגושית הם לא מופיעים. זו הנקודה.
                    </Text>
                </View>
            )}
        </View>
    );
};

export default BlocView;

// The parts every world draws - the split, a side, its head, the summary, the
// outlets - in each world's own measure.
const base = {
    // row-reverse puts the first column - the right bloc - on the right
    split: { flexDirection: "row-reverse", gap: 8, alignItems: "flex-start" },
    col: { flex: 1 },
    colHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "baseline" },
    colBody: { gap: 9 },
    aiBox: { gap: 3 },
    outlets: { gap: 7 },
    outletBlock: { gap: 2 },
    outletRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7 },
    unaligned: { padding: 11, marginTop: 10, gap: 7 },
    pill: { borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5, marginLeft: 6 },
} as const;

const LOOKS = {
    // two slips, the same size, lying in the tray side by side
    ballot: StyleSheet.create({
        ...base,
        split: { ...base.split, padding: 8 },
        col: { ...base.col, padding: 11, gap: 9, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 4 },
        colLabel: { fontSize: 22, lineHeight: 26 },
        colCount: { fontSize: 22, lineHeight: 26, fontVariant: ["tabular-nums"] },
        aiLabel: { fontSize: 10.5, letterSpacing: 0.2, textAlign: "right" },
        aiText: { fontSize: 13.5, lineHeight: 20, textAlign: "right" },
        aiWaiting: { fontSize: 12.5, textAlign: "right" },
        dot: { ...base.dot },
        outlet: { fontSize: 13, letterSpacing: 0.05, flex: 1, textAlign: "right" },
        headline: { fontSize: 12.5, lineHeight: 18, textAlign: "right", paddingRight: 13 },
        empty: { fontSize: 12.5, lineHeight: 18, textAlign: "right" },
        spine: {},
        swatch: {},
        unalignedTitle: { fontSize: 13, textAlign: "right" },
        unalignedNote: { fontSize: 12, textAlign: "right" },
        pillText: { fontSize: 12 },
    }),
    // the two commentaries either side of the page's rule, no boxes at all
    daf: StyleSheet.create({
        ...base,
        split: { ...base.split, gap: 12, alignItems: "stretch" },
        col: { ...base.col, gap: 8 },
        colLabel: { fontSize: 19, lineHeight: 24 },
        colCount: { fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
        aiBox: { ...base.aiBox, borderBottomWidth: 1, paddingBottom: 9 },
        aiLabel: { fontSize: 10.5, letterSpacing: 0.2, textAlign: "right" },
        aiText: { fontSize: 14.5, lineHeight: 23, textAlign: "right" },
        aiWaiting: { fontSize: 13, textAlign: "right" },
        outlet: { fontSize: 12.5, letterSpacing: 0.05, flex: 1, textAlign: "right" },
        headline: { fontSize: 13.5, lineHeight: 20, textAlign: "right" },
        empty: { fontSize: 13.5, lineHeight: 20, textAlign: "right" },
        spine: { width: 1 },
        swatch: {},
        unaligned: { ...base.unaligned, paddingHorizontal: 0, borderTopWidth: 1 },
        unalignedTitle: { fontSize: 13, textAlign: "right" },
        unalignedNote: { fontSize: 12.5, textAlign: "right" },
        pillText: { fontSize: 12 },
    }),
    // two panels, each under its own black header band
    sign: StyleSheet.create({
        ...base,
        col: { ...base.col, borderWidth: 1, overflow: "hidden" },
        colHead: {
            flexDirection: "row-reverse", alignItems: "center", gap: 7,
            paddingHorizontal: 10, paddingVertical: 8,
        },
        colBody: { ...base.colBody, padding: 10 },
        swatch: { width: 11, height: 11, borderRadius: 2 },
        colLabel: { fontSize: 15, lineHeight: 19, flex: 1, textAlign: "right" },
        colCount: { fontSize: 17, lineHeight: 20, fontVariant: ["tabular-nums"] },
        aiLabel: { fontSize: 10.5, letterSpacing: 0.2, textAlign: "right" },
        aiText: { fontSize: 13, lineHeight: 19.5, textAlign: "right" },
        aiWaiting: { fontSize: 12.5, textAlign: "right" },
        outlets: { gap: 0 },
        outletBlock: { ...base.outletBlock, borderTopWidth: 1, paddingVertical: 7 },
        dot: { width: 8, height: 8, borderRadius: 1 },
        outlet: { fontSize: 13, flex: 1, textAlign: "right" },
        headline: { fontSize: 12.5, lineHeight: 18, textAlign: "right", paddingRight: 14 },
        empty: { fontSize: 12.5, lineHeight: 18, textAlign: "right" },
        spine: {},
        unaligned: { ...base.unaligned, borderWidth: 1 },
        unalignedTitle: { fontSize: 13, textAlign: "right" },
        unalignedNote: { fontSize: 12, textAlign: "right" },
        pillText: { fontSize: 12 },
    }),
};
