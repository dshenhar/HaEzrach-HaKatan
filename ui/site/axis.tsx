import React from "react";
import { StyleSheet, View } from "react-native";
import { useSite } from "./tokens";

/**
 * A position between -5 and +5, drawn on a line: +5 at the right end, -5 at the
 * left, the middle marked. The mark is the colour of the side it falls on.
 */
export default function Axis({ value, height = 14 }: { value: number | null; height?: number }) {
    const { c } = useSite();
    const v = value === null ? null : Math.max(-5, Math.min(5, value));
    // share of the line from the right edge
    const fromRight = v === null ? null : (5 - v) / 10;
    const ink = v === null ? c.muted : v > 0.25 ? c.right : v < -0.25 ? c.left : c.ink;
    return (
        <View style={[styles.axis, { height }]} accessible={false}>
            <View style={[styles.line, { backgroundColor: c.rule, top: height / 2 }]} />
            <View style={[styles.mid, { backgroundColor: c.muted, height }]} />
            {fromRight !== null && (
                <View style={[styles.dot, { backgroundColor: ink, width: height - 2, height: height - 2,
                    right: `${fromRight * 100}%`, marginRight: -(height - 2) / 2, top: 1 }]} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    axis: { width: "100%", position: "relative" },
    line: { position: "absolute", left: 0, right: 0, height: 1 },
    mid: { position: "absolute", left: "50%", width: 1, top: 0 },
    dot: { position: "absolute" },
});
