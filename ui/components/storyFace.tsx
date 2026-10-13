import { GENERAL_TOPIC } from '@/state/engagement';
import { sectionTint } from '@/state/sections';
import { Skin } from '@/state/direction';
import { Theme } from '@/state/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * What a story shows before it is opened, drawn three ways. The facts are the
 * same in all three - when it broke, its section and issue, whether one side left
 * it out, the headline, who told it from each side, and who told it at all - and
 * so is their order of importance. What changes is the object they are printed on.
 */
export type FaceProps = {
    skin: Skin;
    t: Theme;
    open: boolean;
    time: string | null;
    section: string;
    topic: string;
    /** dev mode: the issue can be changed from the card */
    dev: boolean;
    onTopic: () => void;
    /** which side left it out, if one did */
    missing: "right" | "left" | null;
    /** the side that left it out is the reader's own */
    mine: boolean;
    blindText: string;
    title: string;
    right: number;
    left: number;
    total: number;
    /** every outlet's name, and the same names by side for the page */
    sources: string[];
    rightSources: string[];
    leftSources: string[];
};

export default function StoryFace(props: FaceProps) {
    if (props.skin.name === "daf") return <DafFace {...props} />;
    if (props.skin.name === "sign") return <SignFace {...props} />;
    return <BallotFace {...props} />;
}

/** the issue, quiet - and in dev mode, the way to change it */
const Topic = ({ p, style, textStyle }: { p: FaceProps; style: any; textStyle: any }) => {
    if (!p.topic || p.topic === GENERAL_TOPIC) return null;
    return (
        <TouchableOpacity disabled={!p.dev} onPress={p.onTopic}
            style={[style, p.dev && { borderColor: p.t.select, borderStyle: "dashed", borderWidth: 1 }]}>
            <Text style={textStyle} numberOfLines={1}>{p.topic}{p.dev ? "  ✎" : ""}</Text>
        </TouchableOpacity>
    );
};

// ------------------------------------------------------------------ ballot
/**
 * A slip from the booth. The headline is what the slip is for; the stub at its
 * end, behind a perforation, carries the count from each side. A side that told
 * none of it leaves its cell blank - an empty slip, which is what a blindspot is.
 */
function BallotFace(p: FaceProps) {
    const { t, skin } = p;
    const f = skin.faces;
    const cell = (side: "right" | "left") => {
        const count = side === "right" ? p.right : p.left;
        const ink = side === "right" ? t.right : t.left;
        const blank = p.missing === side;
        return (
            <View style={[ballot.cell,
                blank ? { borderColor: ink, borderStyle: "dashed", borderWidth: 1.5 }
                      : { borderColor: "transparent", borderWidth: 1.5 }]}>
                <Text style={[ballot.cellLabel, { color: blank ? ink : t.textMuted, fontFamily: f.uiStrong }]}>
                    {side === "right" ? "ימין" : "שמאל"}
                </Text>
                <Text style={[ballot.cellCount, { color: count ? ink : t.textMuted, fontFamily: f.figure }]}>
                    {count}
                </Text>
            </View>
        );
    };
    return (
        <View style={ballot.row}>
            <View style={ballot.main}>
                <View style={ballot.meta}>
                    {!!p.time && (
                        <Text style={[ballot.time, { color: t.text, fontFamily: f.figure }]}>{p.time}</Text>
                    )}
                    {!!p.section && (
                        <View style={[ballot.section, { borderColor: t.text }]}>
                            <Text style={[ballot.sectionText, { color: t.text, fontFamily: f.uiStrong }]}
                                numberOfLines={1}>{p.section}</Text>
                        </View>
                    )}
                    <Topic p={p} style={ballot.topic}
                        textStyle={[ballot.topicText, { color: t.textMuted, fontFamily: f.ui }]} />
                </View>
                {!!p.missing && (
                    <View style={[ballot.stamp, { borderColor: p.missing === "right" ? t.right : t.left },
                        p.mine && { backgroundColor: p.missing === "right" ? t.right : t.left }]}>
                        <Text style={[ballot.stampText, { fontFamily: f.uiStrong,
                            color: p.mine ? "#FFFFFF" : p.missing === "right" ? t.right : t.left }]}
                            numberOfLines={1}>{p.blindText}</Text>
                    </View>
                )}
                <Text style={[ballot.title, { color: t.text, fontFamily: f.headline }]}
                    numberOfLines={p.open ? undefined : 3}>{p.title}</Text>
                {!p.open && (
                    <Text style={[ballot.sources, { color: t.textMuted, fontFamily: f.body }]}
                        numberOfLines={1}>{p.sources.join(", ")}</Text>
                )}
            </View>
            {/* the stub, torn along the perforation from the slip it belongs to */}
            <View style={[ballot.stub, { borderColor: t.line }]}
                accessibilityLabel={`${p.total} גופים סיקרו, ${p.right} מימין ו-${p.left} משמאל`}>
                {cell("right")}
                {cell("left")}
            </View>
        </View>
    );
}

const ballot = StyleSheet.create({
    // row-reverse: the slip's text from the right edge, the stub at its left end
    row: { flexDirection: "row-reverse", alignItems: "stretch", gap: 12 },
    main: { flex: 1, gap: 6 },
    meta: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
    time: { fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
    // the section as a slip's code box: black rule, black letters, no colour
    section: { borderWidth: 1.5, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 1 },
    sectionText: { fontSize: 11.5, lineHeight: 15, letterSpacing: 0.1 },
    topic: { maxWidth: 150, borderRadius: 2, paddingHorizontal: 2 },
    topicText: { fontSize: 12, lineHeight: 16 },
    // the finding, stamped: the ink of the side that is missing
    stamp: {
        alignSelf: "flex-end", borderWidth: 1.5, borderRadius: 2,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    stampText: { fontSize: 11.5, lineHeight: 15, letterSpacing: 0.2 },
    title: { fontSize: 17, lineHeight: 23, letterSpacing: -0.15, textAlign: "right" },
    sources: { fontSize: 12.5, lineHeight: 17, textAlign: "right" },
    stub: {
        width: 54, borderRightWidth: 1.5, borderStyle: "dashed",
        paddingRight: 10, justifyContent: "center", gap: 6,
    },
    cell: { borderRadius: 3, alignItems: "center", paddingVertical: 3 },
    cellLabel: { fontSize: 10.5, lineHeight: 13, letterSpacing: 0.2 },
    cellCount: { fontSize: 22, lineHeight: 26, fontVariant: ["tabular-nums"] },
});

// ------------------------------------------------------------------ daf
/**
 * A passage on the page. The headline is the text in the middle; under it, the
 * outlets that told it stand in two columns either side of a rule, the right
 * bloc's on the right and the left's on the left - the commentaries, before a
 * word of them is read. A side with nothing to say has an empty column.
 */
function DafFace(p: FaceProps) {
    const { t, skin } = p;
    const f = skin.faces;
    const dark = t.name === "negative";
    const tint = p.section ? sectionTint(p.section, dark) : null;
    const column = (side: "right" | "left") => {
        const names = side === "right" ? p.rightSources : p.leftSources;
        const ink = side === "right" ? t.right : t.left;
        return (
            <View style={daf.col}>
                <View style={daf.colHead}>
                    <Text style={[daf.colLabel, { color: ink, fontFamily: f.bodyStrong }]}>
                        {side === "right" ? "ימין" : "שמאל"}
                    </Text>
                    <Text style={[daf.colCount, { color: t.textMuted, fontFamily: f.ui }]}>{names.length}</Text>
                </View>
                <Text style={[daf.colNames, { color: names.length ? t.text : t.textMuted, fontFamily: f.ui }]}
                    numberOfLines={2}>
                    {names.length ? names.join(", ") : "לא סיקרו"}
                </Text>
            </View>
        );
    };
    return (
        <View style={daf.wrap}>
            <View style={daf.meta}>
                {!!p.time && (
                    <Text style={[daf.time, { color: t.textMuted, fontFamily: f.ui }]}>{p.time}</Text>
                )}
                {!!p.section && tint && (
                    <Text style={[daf.section, { color: tint.label, fontFamily: f.uiStrong }]}
                        numberOfLines={1}>{p.section}</Text>
                )}
                <Topic p={p} style={daf.topic}
                    textStyle={[daf.topicText, { color: t.textMuted, fontFamily: f.ui }]} />
            </View>
            <Text style={[daf.title, { color: t.text, fontFamily: f.headline }]}
                numberOfLines={p.open ? undefined : 3}>{p.title}</Text>
            {!!p.missing && (
                <Text style={[daf.blind, { fontFamily: f.uiStrong,
                    color: p.missing === "right" ? t.right : t.left },
                    p.mine && daf.blindMine]}>
                    {p.blindText}
                </Text>
            )}
            {!p.open && (
                <View style={daf.cols}
                    accessibilityLabel={`${p.total} גופים סיקרו, ${p.right} מימין ו-${p.left} משמאל`}>
                    {column("right")}
                    <View style={[daf.spine, { backgroundColor: t.line }]} />
                    {column("left")}
                </View>
            )}
        </View>
    );
}

const daf = StyleSheet.create({
    wrap: { gap: 7 },
    meta: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
    time: { fontSize: 12.5, lineHeight: 16, fontVariant: ["tabular-nums"] },
    section: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
    topic: { maxWidth: 160 },
    topicText: { fontSize: 12, lineHeight: 16 },
    title: { fontSize: 19.5, lineHeight: 27, letterSpacing: -0.2, textAlign: "right" },
    blind: { fontSize: 12.5, lineHeight: 17, textAlign: "right" },
    blindMine: { textDecorationLine: "underline" },
    // row-reverse: the right bloc's column on the right, the rule, then the left's
    cols: { flexDirection: "row-reverse", alignItems: "stretch", gap: 12, marginTop: 2 },
    col: { flex: 1, gap: 2 },
    colHead: { flexDirection: "row-reverse", alignItems: "baseline", gap: 6 },
    colLabel: { fontSize: 14, lineHeight: 18 },
    colCount: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
    colNames: { fontSize: 12, lineHeight: 17, textAlign: "right" },
    spine: { width: 1 },
});

// ------------------------------------------------------------------ sign
/**
 * A panel on the concourse. The count of outlets that told the story stands on
 * a black inset at its end, the way a gate number does, with the right-and-left
 * split ruled under it; the section rides on its line colour like a route.
 */
function SignFace(p: FaceProps) {
    const { t, skin } = p;
    const f = skin.faces;
    const dark = t.name === "negative";
    const tint = p.section ? sectionTint(p.section, dark) : null;
    const known = p.right + p.left;
    return (
        <View style={sign.row}>
            <View style={sign.main}>
                <View style={sign.meta}>
                    {!!p.time && (
                        <Text style={[sign.time, { color: t.text, fontFamily: f.uiStrong }]}>{p.time}</Text>
                    )}
                    {!!p.section && tint && (
                        <View style={sign.route}>
                            <View style={[sign.routeSwatch, { backgroundColor: tint.ink }]} />
                            <Text style={[sign.routeText, { color: t.text, fontFamily: f.ui }]}
                                numberOfLines={1}>{p.section}</Text>
                        </View>
                    )}
                    <Topic p={p} style={sign.topic}
                        textStyle={[sign.topicText, { color: t.textMuted, fontFamily: f.ui }]} />
                </View>
                {!!p.missing && (
                    <View style={[sign.blind, { backgroundColor: p.mine
                        ? (p.missing === "right" ? t.right : t.left) : t.text }]}>
                        <View style={[sign.blindSwatch, { backgroundColor: p.mine ? "#FFFFFF"
                            : p.missing === "right" ? t.right : t.left }]} />
                        <Text style={[sign.blindText, { color: p.mine ? "#FFFFFF" : t.surface, fontFamily: f.uiStrong }]}
                            numberOfLines={1}>{p.blindText}</Text>
                    </View>
                )}
                <Text style={[sign.title, { color: t.text, fontFamily: f.headline }]}
                    numberOfLines={p.open ? undefined : 3}>{p.title}</Text>
                {!p.open && (
                    <Text style={[sign.sources, { color: t.textMuted, fontFamily: f.body }]}
                        numberOfLines={1}>{p.sources.join(", ")}</Text>
                )}
            </View>
            <View style={sign.gate}
                accessibilityLabel={`${p.total} גופים סיקרו, ${p.right} מימין ו-${p.left} משמאל`}>
                {/* on the dark concourse the inset turns over: a white plate, black figure */}
                <View style={[sign.count, { backgroundColor: dark ? t.text : "#0F0F0F" }]}>
                    <Text style={[sign.countText, { fontFamily: f.figure, color: dark ? t.bg : "#FFFFFF" }]}>{p.total}</Text>
                </View>
                {/* the split, right from the right: a bar, not a ring */}
                <View style={[sign.split, { backgroundColor: t.track }]}>
                    {known > 0 && <View style={{ flex: p.right, backgroundColor: t.right }} />}
                    {known > 0 && <View style={{ flex: p.left, backgroundColor: t.left }} />}
                </View>
            </View>
        </View>
    );
}

const sign = StyleSheet.create({
    row: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12 },
    main: { flex: 1, gap: 7 },
    meta: { flexDirection: "row-reverse", alignItems: "center", gap: 10, flexWrap: "wrap" },
    time: { fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
    route: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
    routeSwatch: { width: 10, height: 10, borderRadius: 2 },
    routeText: { fontSize: 12.5, lineHeight: 16 },
    topic: { maxWidth: 150 },
    topicText: { fontSize: 12, lineHeight: 16 },
    blind: {
        alignSelf: "flex-end", flexDirection: "row-reverse", alignItems: "center", gap: 6,
        borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3,
    },
    blindSwatch: { width: 8, height: 8, borderRadius: 1 },
    blindText: { fontSize: 11.5, lineHeight: 15 },
    title: { fontSize: 16.5, lineHeight: 22, letterSpacing: -0.1, textAlign: "right" },
    sources: { fontSize: 12.5, lineHeight: 17, textAlign: "right" },
    gate: { width: 48, gap: 4, alignItems: "stretch" },
    count: { height: 48, borderRadius: 4, alignItems: "center", justifyContent: "center" },
    countText: { fontSize: 24, lineHeight: 28, fontVariant: ["tabular-nums"] },
    split: { height: 5, borderRadius: 1, flexDirection: "row-reverse", overflow: "hidden" },
});
