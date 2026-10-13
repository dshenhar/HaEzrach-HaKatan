import { DIRECTIONS, useDirectionControl } from '@/state/direction';
import { useTheme } from '@/state/theme';
import { track } from '@/state/analytics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * The preview's own control: which of the three worlds is showing. It sits above
 * the app rather than in it, a strip the owner uses to compare and that no reader
 * of the finished app will ever see.
 */
export default function DirectionSwitcher() {
    const { skin, setDirection } = useDirectionControl();
    const t = useTheme();
    const dark = t.name === "negative";
    const ink = dark ? "#F2F2EF" : "#111111";

    return (
        <View style={[styles.bar, { backgroundColor: dark ? "#000000" : "#FFFFFF", borderColor: dark ? "#2A2A2A" : "#D4D4D0" }]}
            accessibilityRole="tablist" accessibilityLabel="כיוון עיצוב לתצוגה">
            <Text style={[styles.label, { color: dark ? "#A6A6A0" : "#55554F" }]}>כיוון עיצוב</Text>
            <View style={[styles.track, { backgroundColor: dark ? "#1E1E1D" : "#EDEDEA" }]}>
                {DIRECTIONS.map((d) => {
                    const on = d.key === skin.name;
                    return (
                        <Pressable key={d.key}
                            onPress={() => {
                                if (on) return;
                                track("design_direction_viewed", { direction: d.key });
                                setDirection(d.key);
                            }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                            style={[styles.seg, on && { backgroundColor: ink }]}>
                            <Text style={[styles.segText, { color: on ? (dark ? "#000000" : "#FFFFFF") : ink }]}>
                                {d.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    label: { fontFamily: "Assistant_700Bold", fontSize: 12 },
    track: { flexDirection: "row-reverse", borderRadius: 999, padding: 2, gap: 2 },
    seg: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999 },
    segText: { fontFamily: "Assistant_700Bold", fontSize: 13 },
});
