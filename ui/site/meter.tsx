import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useStillness } from "@/state/access";
import { FACE, ROW, useSite } from "./tokens";

type Props = {
    right: number;
    left: number;
    other?: number;
    /** lg on a story's own screen and the lead, md on a card, sm in a list */
    size?: "lg" | "md" | "sm";
    /** drawn on a coloured card: it sits on a white track, its words in white */
    onColour?: boolean;
    /** grow from the edges when it first appears; only where it is the subject */
    grow?: boolean;
};

const HEIGHT = { lg: 12, md: 8, sm: 6 } as const;

/**
 * The coverage meter, the app's one picture.
 *
 * Every outlet that told the story is a share of the bar. The right bloc's share
 * grows from the right end and the left's from the left, the way the map lies;
 * outlets in neither bloc sit between them in grey. It is a count, so it can
 * stand under any headline: three papers on the right and none on the left is
 * not an opinion. A side with nothing leaves its end bare, with a zero at it.
 */
export default function Meter({ right, left, other = 0, size = "md", onColour, grow }: Props) {
    const { c } = useSite();
    const still = useStillness();
    const total = right + left + other;
    const h = HEIGHT[size];

    const shown = useSharedValue(grow && !still ? 0 : 1);
    useEffect(() => {
        if (!grow || still) { shown.value = 1; return; }
        shown.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.exp) });
    }, [grow, still, shown]);
    const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: shown.value }] }));

    const label = `${total} גופים סיקרו: ${right} מהימין, ${left} מהשמאל${other ? `, ${other} בלי שיוך` : ""}`;
    const word = (side: "right" | "left") => {
        const n = side === "right" ? right : left;
        const ink = onColour ? c.onColour : n ? (side === "right" ? c.right : c.left) : c.muted;
        return (
            <Text style={[size === "sm" ? styles.smWord : styles.word, { color: ink }]}>
                {side === "right" ? "ימין" : "שמאל"} <Text style={size === "sm" ? styles.smNum : styles.num}>{n}</Text>
            </Text>
        );
    };

    return (
        <View accessible accessibilityLabel={label} style={styles.wrap}>
            <View style={[styles.words, { flexDirection: ROW }]}>
                {word("right")}
                {other > 0 && size !== "sm" && (
                    <Text style={[styles.other, { color: onColour ? c.onColourMuted : c.muted }]}>בלי שיוך {other}</Text>
                )}
                {word("left")}
            </View>
            <View style={[styles.track, { height: h, borderRadius: h, flexDirection: ROW,
                backgroundColor: onColour ? "rgba(255,255,255,0.28)" : c.sunk }]}>
                {/* the right bloc's share, from the right end */}
                <View style={{ flex: right, minWidth: 0 }}>
                    {right > 0 && <Animated.View style={[styles.fill, { backgroundColor: onColour ? "#FF8A80" : c.right,
                        transformOrigin: "right" }, fill]} />}
                </View>
                {other > 0 && <View style={{ flex: other, backgroundColor: onColour ? "rgba(255,255,255,0.55)" : c.unaligned }} />}
                {/* the left bloc's share, from the left end */}
                <View style={{ flex: left, minWidth: 0 }}>
                    {left > 0 && <Animated.View style={[styles.fill, { backgroundColor: onColour ? "#9CC0FF" : c.left,
                        transformOrigin: "left" }, fill]} />}
                </View>
                {total === 0 && <View style={{ flex: 1 }} />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 5, width: "100%" },
    words: { justifyContent: "space-between", alignItems: "baseline" },
    track: { width: "100%", overflow: "hidden", gap: 2 },
    fill: { flex: 1 },
    word: { fontFamily: FACE.semi, fontSize: 13, lineHeight: 17 },
    num: { fontFamily: FACE.heavy, fontSize: 14.5, fontVariant: ["tabular-nums"] },
    smWord: { fontFamily: FACE.medium, fontSize: 12, lineHeight: 15 },
    smNum: { fontFamily: FACE.bold, fontSize: 12.5, fontVariant: ["tabular-nums"] },
    other: { fontFamily: FACE.medium, fontSize: 12.5, lineHeight: 17 },
});

/**
 * The app's mark: one square, cut down the middle, red on the right and blue on
 * the left. The whole idea, at the size of a letter.
 */
export function Mark({ size = 22 }: { size?: number }) {
    const { c } = useSite();
    const gap = Math.max(2, Math.round(size / 11));
    return (
        <View style={{ width: size, height: size, flexDirection: ROW, gap, borderRadius: size * 0.22, overflow: "hidden" }}
            accessible={false}>
            <View style={{ flex: 1, backgroundColor: c.right }} />
            <View style={{ flex: 1, backgroundColor: c.left }} />
        </View>
    );
}
