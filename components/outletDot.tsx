import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export const DOT = 22;
const SELECT = "#DDA01E";

/**
 * What goes inside an outlet's marker: the first letter, or one letter from each of
 * the first two words (כיכר השבת -> כה). For a numbered channel the number is what
 * tells it apart, so ערוץ 14 is 14 rather than ע1, which ערוץ 13 would share.
 */
export function initials(name: string): string {
    const words = name.replace(/[!?.״"']/g, "").split(/\s+/).filter(Boolean);
    const number = name.match(/\d+/)?.[0];
    if (number && words.length > 1) return number;
    if (words.length > 1) return words[0][0] + words[1][0];
    return words[0]?.[0] ?? "?";
}

type Props = {
    source: string;
    colour: string;
    /** the marker's centre, in its parent's physical coordinates */
    x: number;
    y: number;
    selected: boolean;
    onPress: () => void;
};

/** An outlet on the map: a disc in its bloc's colour with its initials, ringed in gold when chosen. */
export default function OutletDot({ source, colour, x, y, selected, onPress }: Props) {
    const size = selected ? DOT + 6 : DOT;
    const tag = initials(source);
    return (
        <TouchableOpacity
            onPress={onPress}
            hitSlop={4}
            accessibilityLabel={source}
            style={[styles.dot, {
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colour,
            }, selected && styles.on]}
        >
            <Text style={[styles.text, { fontSize: tag.length > 1 ? 9.5 : 11 }]}>{tag}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    dot: { position: "absolute", alignItems: "center", justifyContent: "center" },
    on: { borderWidth: 3, borderColor: SELECT },
    text: { fontFamily: "Heebo_800ExtraBold", color: "#FFFFFF", textAlign: "center" },
});
