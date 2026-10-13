import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useStillness } from "@/state/access";
import { FACE, ROW, useSite } from "./tokens";

type Props = {
    right: number;
    left: number;
    other?: number;
    /** lg on a story's own page, md on a front-page story, sm in a list */
    size?: "lg" | "md" | "sm";
    /** drawn on the black band: the inks lifted for it */
    onBand?: boolean;
    /** grow from the edges when it first appears; only where it is the subject */
    grow?: boolean;
};

const HEIGHT = { lg: 12, md: 7, sm: 4 } as const;

/**
 * The coverage meter, the site's one picture.
 *
 * Every outlet that told the story is a share of the bar. The right bloc's share
 * grows from the right edge and the left's from the left, the way the map lies;
 * outlets in neither bloc sit between them in grey. It is a count and nothing
 * more, which is why it can stand under any headline: three papers on the right
 * and none on the left is not an opinion. A side with nothing leaves its end of
 * the bar bare, with a zero at it.
 */
export default function Meter({ right, left, other = 0, size = "md", onBand, grow }: Props) {
    const { c } = useSite();
    const still = useStillness();
    const total = right + left + other;
    const rightInk = onBand ? c.bandRight : c.right;
    const leftInk = onBand ? c.bandLeft : c.left;
    const quiet = onBand ? c.bandMuted : c.muted;
    const h = HEIGHT[size];

    const shown = useSharedValue(grow && !still ? 0 : 1);
    useEffect(() => {
        if (!grow || still) { shown.value = 1; return; }
        shown.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.exp) });
    }, [grow, still, shown]);
    const fromRight = useAnimatedStyle(() => ({ transform: [{ scaleX: shown.value }] }));
    const fromLeft = useAnimatedStyle(() => ({ transform: [{ scaleX: shown.value }] }));

    const label = `${total} גופים סיקרו: ${right} מהימין, ${left} מהשמאל${other ? `, ${other} בלי שיוך` : ""}`;

    const end = (side: "right" | "left") => {
        const n = side === "right" ? right : left;
        const ink = side === "right" ? rightInk : leftInk;
        const word = side === "right" ? "ימין" : "שמאל";
        if (size === "sm") {
            return <Text style={[styles.smNum, { color: n ? ink : quiet }]}>{n}</Text>;
        }
        return (
            <Text style={[size === "lg" ? styles.lgLabel : styles.mdLabel, { color: n ? ink : quiet }]}>
                {word} <Text style={size === "lg" ? styles.lgNum : styles.mdNum}>{n}</Text>
            </Text>
        );
    };

    return (
        <View accessible accessibilityLabel={label} style={size === "sm" ? styles.smWrap : styles.wrap}>
            {size !== "sm" && (
                <View style={[styles.labels, { flexDirection: ROW }]}>
                    {end("right")}
                    {other > 0 && (
                        <Text style={[size === "lg" ? styles.lgOther : styles.mdOther, { color: quiet }]}>
                            בלי שיוך {other}
                        </Text>
                    )}
                    {end("left")}
                </View>
            )}
            <View style={[styles.barRow, { flexDirection: ROW }]}>
                {size === "sm" && end("right")}
                <View style={[styles.bar, { height: h, flexDirection: ROW }]}>
                    {/* the right bloc's share, from the right edge */}
                    <View style={{ flex: right, minWidth: 0 }}>
                        {right > 0 && (
                            <Animated.View style={[styles.fill, { backgroundColor: rightInk, transformOrigin: "right" }, fromRight]} />
                        )}
                    </View>
                    {other > 0 && (
                        <View style={{ flex: other, backgroundColor: onBand ? c.bandRule : c.unaligned }} />
                    )}
                    {/* the left bloc's share, from the left edge */}
                    <View style={{ flex: left, minWidth: 0 }}>
                        {left > 0 && (
                            <Animated.View style={[styles.fill, { backgroundColor: leftInk, transformOrigin: "left" }, fromLeft]} />
                        )}
                    </View>
                    {total === 0 && <View style={{ flex: 1, backgroundColor: c.unaligned }} />}
                </View>
                {size === "sm" && end("left")}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 6, width: "100%" },
    smWrap: { width: "100%" },
    labels: { justifyContent: "space-between", alignItems: "baseline" },
    barRow: { alignItems: "center", gap: 8 },
    // the shares sit edge to edge; a hairline of paper between them comes from the gap
    bar: { flex: 1, gap: 2, overflow: "hidden" },
    fill: { flex: 1 },
    lgLabel: { fontFamily: FACE.sansHeavy, fontSize: 15, lineHeight: 19 },
    lgNum: { fontFamily: FACE.sansHeavy, fontSize: 19, fontVariant: ["tabular-nums"] },
    lgOther: { fontFamily: FACE.sansSemi, fontSize: 13.5, lineHeight: 19 },
    mdLabel: { fontFamily: FACE.sansBold, fontSize: 13.5, lineHeight: 17 },
    mdNum: { fontFamily: FACE.sansHeavy, fontSize: 14, fontVariant: ["tabular-nums"] },
    mdOther: { fontFamily: FACE.sansSemi, fontSize: 12.5, lineHeight: 17 },
    smNum: { fontFamily: FACE.sansHeavy, fontSize: 12.5, lineHeight: 14, minWidth: 12, textAlign: "center", fontVariant: ["tabular-nums"] },
});

/**
 * The site's mark: one square, cut down the middle, red on the right and blue on
 * the left. The whole idea, at the size of a letter.
 */
export function Mark({ size = 22, onBand }: { size?: number; onBand?: boolean }) {
    const { c } = useSite();
    const gap = Math.max(2, Math.round(size / 11));
    return (
        <View style={{ width: size, height: size, flexDirection: ROW, gap }} accessible={false}>
            <View style={{ flex: 1, backgroundColor: onBand ? c.bandRight : c.right }} />
            <View style={{ flex: 1, backgroundColor: onBand ? c.bandLeft : c.left }} />
        </View>
    );
}
