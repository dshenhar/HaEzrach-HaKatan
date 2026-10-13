import React, { useEffect, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useStillness } from "@/state/access";
import { FACE, RADIUS, ROW, sectionColour, TYPE, useSite } from "./tokens";

type Chip<K extends string> = { key: K; label: string; colour?: string; count?: number };

/**
 * A row of chips that narrows a list in place: the chosen one filled - in its
 * own colour when it has one, in the app's violet when it does not. It scrolls
 * sideways when it is longer than the screen, starting where Hebrew starts.
 */
export function Chips<K extends string>({ items, value, onChange, label, small }: {
    items: Chip<K>[];
    value: K;
    onChange: (key: K) => void;
    label: string;
    /** a quieter row, for the order under the filter */
    small?: boolean;
}) {
    const { c } = useSite();
    const ref = useRef<ScrollView>(null);
    const moved = useRef(false);
    return (
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => { if (Platform.OS === "web" && !moved.current) ref.current?.scrollToEnd({ animated: false }); }}
            onTouchStart={() => { moved.current = true; }}
            onScrollBeginDrag={() => { moved.current = true; }}
            style={styles.chipsScroll}
            contentContainerStyle={[styles.chips, { flexDirection: ROW, minWidth: "100%" }]}
            accessibilityRole="tablist" accessibilityLabel={label}>
            {items.map((item) => {
                const on = item.key === value;
                const fill = item.colour ?? c.brand;
                return (
                    <Pressable key={item.key} onPress={() => onChange(item.key)} accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={({ pressed }) => [styles.chip, small && styles.chipSmall, { flexDirection: ROW,
                            backgroundColor: on ? fill : pressed ? c.pressed : c.card,
                            borderColor: on ? fill : c.rule }]}>
                        {!!item.colour && !on && <View style={[styles.dot, { backgroundColor: item.colour }]} />}
                        <Text style={[styles.chipText, small && styles.chipTextSmall, { color: on ? (item.colour ? "#FFFFFF" : c.brandInk) : c.ink, fontFamily: on ? FACE.semi : FACE.medium }]}>
                            {item.label}
                        </Text>
                        {item.count !== undefined && (
                            <Text style={[styles.chipCount, { color: on ? (item.colour ? "#FFFFFF" : c.brandInk) : c.muted, opacity: on ? 0.85 : 1 }]}>{item.count}</Text>
                        )}
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/** the section chips: "everything", then each section of the day in its colour */
export const sectionChips = (sections: string[]) => [
    { key: "", label: "הכל" },
    ...sections.map((s) => ({ key: s, label: s, colour: sectionColour(s) })),
];

/** A segmented choice of two or three, in one rounded track. */
export function Segments<K extends string>({ items, value, onChange, label }: {
    items: { key: K; label: string }[];
    value: K;
    onChange: (key: K) => void;
    label: string;
}) {
    const { c } = useSite();
    return (
        <View style={[styles.segments, { backgroundColor: c.sunk, flexDirection: ROW }]} accessibilityRole="tablist" accessibilityLabel={label}>
            {items.map((item) => {
                const on = item.key === value;
                return (
                    <Pressable key={item.key} onPress={() => onChange(item.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                        style={[styles.segment, on && { backgroundColor: c.card, boxShadow: "0 1px 3px rgba(15,17,21,0.12)" }]}>
                        <Text style={[TYPE.uiStrong, { color: on ? c.ink : c.muted, textAlign: "center" }]}>{item.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** The app's buttons: violet and filled for the main thing, outlined for the rest. */
export function Button({ label, onPress, quiet, disabled, wide, onColour }: {
    label: string; onPress: () => void; quiet?: boolean; disabled?: boolean; wide?: boolean;
    /** white, on a coloured card, in the card's colour */
    onColour?: string;
}) {
    const { c } = useSite();
    const fill = onColour ? (quiet ? "rgba(255,255,255,0.18)" : "#FFFFFF")
        : quiet ? c.card : disabled ? c.rule : c.brand;
    const ink = onColour ? (quiet ? "#FFFFFF" : onColour) : quiet ? c.ink : disabled ? c.muted : c.brandInk;
    return (
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
            style={({ pressed }) => [styles.button, wide && styles.wide, { backgroundColor: fill },
                quiet && !onColour && { borderColor: c.rule, borderWidth: 1.5 },
                pressed && !disabled && styles.pressed]}>
            <Text style={[TYPE.uiStrong, { color: ink, textAlign: "center" }]}>{label}</Text>
        </Pressable>
    );
}

/**
 * The shape of the screen before its words arrive: grey cards where the stories
 * will be, breathing slowly so the wait reads as a wait and not as a blank.
 */
export function Skeleton({ cards = 3, tall }: { cards?: number; tall?: boolean }) {
    const { c } = useSite();
    const still = useStillness();
    const glow = useSharedValue(0.6);
    useEffect(() => {
        if (still) return;
        glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    }, [still, glow]);
    const breathe = useAnimatedStyle(() => ({ opacity: glow.value }));
    return (
        <Animated.View style={[styles.skeleton, breathe]} accessibilityLabel="טוען" accessible>
            {Array.from({ length: cards }).map((_, i) => (
                <View key={i} style={[styles.ghost, { backgroundColor: c.card, height: tall && i === 0 ? 300 : 120 }]}>
                    <View style={[styles.ghostLine, { backgroundColor: c.sunk, width: "40%" }]} />
                    <View style={[styles.ghostLine, { backgroundColor: c.sunk }]} />
                    <View style={[styles.ghostLine, { backgroundColor: c.sunk, width: "70%" }]} />
                </View>
            ))}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    chipsScroll: { flexGrow: 0 },
    chips: { gap: 8, paddingHorizontal: 12, paddingVertical: 2 },
    chip: { alignItems: "center", gap: 6, borderRadius: RADIUS.chip, borderWidth: 1, paddingHorizontal: 14, height: 36 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { fontSize: 14, lineHeight: 18 },
    chipSmall: { height: 30, paddingHorizontal: 11 },
    chipTextSmall: { fontSize: 13 },
    chipCount: { fontFamily: FACE.semi, fontSize: 12.5, fontVariant: ["tabular-nums"] },
    segments: { borderRadius: RADIUS.button, padding: 4, gap: 4, marginHorizontal: 12 },
    segment: { flex: 1, borderRadius: 10, paddingVertical: 9 },
    button: { borderRadius: RADIUS.button, paddingHorizontal: 22, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
    wide: { alignSelf: "stretch" },
    pressed: { transform: [{ scale: 0.98 }] },
    skeleton: { gap: 12, paddingHorizontal: 12 },
    ghost: { borderRadius: RADIUS.card, padding: 16, gap: 12, justifyContent: "flex-end" },
    ghostLine: { height: 14, borderRadius: 7, alignSelf: "flex-end", width: "100%" },
});
