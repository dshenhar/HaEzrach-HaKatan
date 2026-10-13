import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useStillness } from "@/state/access";
import { FACE, ROW, useSite } from "./tokens";

/**
 * A choice of views over one list, as words with a rule under the chosen one.
 * The list under it changes; nothing opens.
 */
export function Tabs<K extends string>({ items, value, onChange, label }: {
    items: { key: K; label: string }[];
    value: K;
    onChange: (key: K) => void;
    label: string;
}) {
    const { c, type } = useSite();
    return (
        <View style={[styles.tabs, { flexDirection: ROW, borderBottomColor: c.rule }]} accessibilityRole="tablist" accessibilityLabel={label}>
            {items.map((item) => {
                const on = item.key === value;
                return (
                    <Pressable key={item.key} onPress={() => onChange(item.key)} accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={({ hovered }: any) => [styles.tab, { borderBottomColor: on ? c.ink : hovered ? c.rule : "transparent" }]}>
                        <Text style={[type.ui, { color: on ? c.ink : c.ink2, fontFamily: on ? FACE.sansHeavy : FACE.sansSemi }]}>
                            {item.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** The site's one button: ink on paper, square, full words. */
export function Button({ label, onPress, quiet, disabled }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
    const { c, type } = useSite();
    return (
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
            style={({ pressed, hovered }: any) => [styles.button,
                quiet ? { borderColor: c.ink, backgroundColor: pressed || hovered ? c.pressed : "transparent" }
                    : { borderColor: c.ink, backgroundColor: disabled ? c.rule : c.ink, opacity: pressed ? 0.85 : 1 },
                disabled && { borderColor: c.rule }]}>
            <Text style={[type.uiStrong, { color: quiet ? c.ink : disabled ? c.muted : c.paper, textAlign: "center" }]}>{label}</Text>
        </Pressable>
    );
}

/**
 * The shape of the page before its words arrive: grey lines where the headlines
 * will be, breathing slowly so the wait reads as a wait and not as a blank.
 */
export function Skeleton({ lines = 3, big }: { lines?: number; big?: boolean }) {
    const { c } = useSite();
    const still = useStillness();
    const glow = useSharedValue(0.55);
    useEffect(() => {
        if (still) return;
        glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    }, [still, glow]);
    const breathe = useAnimatedStyle(() => ({ opacity: glow.value }));
    return (
        <Animated.View style={[styles.skeleton, breathe]} accessibilityLabel="טוען" accessible>
            {Array.from({ length: lines }).map((_, i) => (
                <View key={i} style={{ height: big ? 30 : 18, width: i === lines - 1 ? "62%" : "100%",
                    backgroundColor: c.paperAlt, alignSelf: "flex-end" }} />
            ))}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    tabs: { borderBottomWidth: 1, flexWrap: "wrap", columnGap: 4 },
    tab: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 9, borderBottomWidth: 3, marginBottom: -1 },
    button: { borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
    skeleton: { gap: 10 },
});
