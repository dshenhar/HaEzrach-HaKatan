import React, { createContext, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { useAccessControl, useStillness, ZOOM_STEPS } from "@/state/access";
import { ThemeName, useThemeControl } from "@/state/theme";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, TYPE, useSite } from "./tokens";
import { Mark } from "./meter";
import { Go } from "./go";

// ------------------------------------------------------------------ accessibility

type Chrome = { openAccess: () => void };
const ChromeContext = createContext<Chrome>({ openAccess: () => {} });
export const useChrome = () => useContext(ChromeContext);

/** the accessibility panel, reachable from every screen's top bar, as the standard asks */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
    const [access, setAccess] = useState(false);
    return (
        <ChromeContext.Provider value={{ openAccess: () => setAccess(true) }}>
            {children}
            <AccessPanel open={access} onClose={() => setAccess(false)} />
        </ChromeContext.Provider>
    );
}

/** a sheet that rises from the bottom, and goes back down the way it came */
export function useSheet(open: boolean) {
    const still = useStillness();
    const [leaving, setLeaving] = useState(false);
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (!open) setLeaving(true);
    }
    const at = useSharedValue(0);
    useEffect(() => {
        at.value = withTiming(open ? 1 : 0, { duration: still ? 0 : open ? 280 : 190, easing: Easing.out(Easing.cubic) });
        if (open) return;
        const t = setTimeout(() => setLeaving(false), still ? 0 : 200);
        return () => clearTimeout(t);
    }, [open, still, at]);
    const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - at.value) * 420 }] }));
    const scrim = useAnimatedStyle(() => ({ opacity: at.value }));
    return { mounted: open || leaving, panel, scrim };
}

const DISPLAYS: { key: ThemeName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "light", label: "רגיל", icon: "sunny-outline" },
    { key: "negative", label: "לילה", icon: "moon-outline" },
    { key: "contrast", label: "ניגודיות", icon: "contrast-outline" },
];

function AccessPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { c } = useSite();
    const { access, setAccess } = useAccessControl();
    const { theme, setThemeName } = useThemeControl();
    const { mounted, panel, scrim } = useSheet(open);
    const insets = useSafeAreaInsets();
    if (!mounted) return null;

    const zoomAt = ZOOM_STEPS.indexOf(access.zoom);
    const setZoom = (step: number) => {
        const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, step))];
        track("accessibility_changed", { setting: "zoom", value: next });
        setAccess({ zoom: next });
    };
    const setDisplay = (key: ThemeName) => {
        track("accessibility_changed", { setting: "display", value: key });
        setAccess({ contrast: key === "contrast" });
        setThemeName(key);
    };
    const choice = (on: boolean, label: string, onPress: () => void, icon?: keyof typeof Ionicons.glyphMap, a11y?: string) => (
        <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
            accessibilityLabel={a11y ?? label}
            style={({ pressed }) => [styles.choice, { backgroundColor: on ? c.brand : pressed ? c.pressed : c.sunk }]}>
            {icon && <Ionicons name={icon} size={20} color={on ? c.brandInk : c.ink} />}
            <Text style={[TYPE.uiStrong, { color: on ? c.brandInk : c.ink, textAlign: "center" }]}>{label}</Text>
        </Pressable>
    );

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,20,0.45)" }, scrim]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="סגירת הנגישות" />
            </Animated.View>
            <Animated.View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20 }, panel]}
                accessibilityViewIsModal>
                <View style={[styles.grab, { backgroundColor: c.rule }]} />
                <View style={[styles.sheetHead, { flexDirection: ROW }]}>
                    <Text style={[TYPE.section, { color: c.ink }]}>נגישות</Text>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="סגירה"
                        style={[styles.round, { backgroundColor: c.sunk }]}>
                        <Ionicons name="close" size={22} color={c.ink} />
                    </Pressable>
                </View>
                <Text style={[TYPE.label, { color: c.muted }]}>גודל טקסט</Text>
                <View style={[styles.choices, { flexDirection: ROW }]}>
                    {choice(false, "א+", () => setZoom(zoomAt + 1), undefined, "הגדלת טקסט")}
                    <Text style={[TYPE.title, styles.zoomNow, { color: c.ink }]}>{Math.round(access.zoom * 100)}%</Text>
                    {choice(false, "א-", () => setZoom(zoomAt - 1), undefined, "הקטנת טקסט")}
                </View>
                <Text style={[TYPE.label, { color: c.muted }]}>תצוגה</Text>
                <View style={[styles.choices, { flexDirection: ROW }]}>
                    {DISPLAYS.map((d) => choice(theme.name === d.key, d.label, () => setDisplay(d.key), d.icon))}
                </View>
                <Text style={[TYPE.label, { color: c.muted }]}>תנועה</Text>
                <View style={[styles.choices, { flexDirection: ROW }]}>
                    {choice(!access.reduceMotion, "רגילה", () => { track("accessibility_changed", { setting: "motion", value: "normal" }); setAccess({ reduceMotion: false }); })}
                    {choice(access.reduceMotion, "מופחתת", () => { track("accessibility_changed", { setting: "motion", value: "reduced" }); setAccess({ reduceMotion: true }); })}
                </View>
                <Go href="/accessibility" onPress={onClose} plain>
                    <Text style={[TYPE.ui, styles.link, { color: c.brand }]}>הצהרת הנגישות המלאה</Text>
                </Go>
            </Animated.View>
        </View>
    );
}

// ------------------------------------------------------------------ top bar

/** how a bar's buttons and words are drawn: on the plain ground, white on a deep colour, or dark on a light one */
export type Tone = "plain" | "light" | "dark";

/** a round button on the bar */
export function RoundButton({ icon, label, onPress, tone = "plain" }: {
    icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: Tone;
}) {
    const { c } = useSite();
    const fill = (pressed: boolean) =>
        tone === "light" ? (pressed ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.2)")
            : tone === "dark" ? (pressed ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.08)")
                : pressed ? c.pressed : c.card;
    return (
        <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
            style={({ pressed }) => [styles.round, { backgroundColor: fill(pressed) }]}>
            <Ionicons name={icon} size={21} color={tone === "light" ? c.onColour : tone === "dark" ? c.hiInk : c.ink} />
        </Pressable>
    );
}

/**
 * The top of a screen. On a tab it carries the screen's name, or on the first
 * tab the app's own; on a screen opened over the tabs it carries the way back.
 * Accessibility is on every one of them.
 */
export function AppBar({ title, back, colour, tone = "plain", search }: {
    title?: string;
    back?: boolean;
    /** the bar's ground, when it is not the plain one */
    colour?: string;
    tone?: Tone;
    search?: boolean;
}) {
    const { c } = useSite();
    const router = useRouter();
    const { openAccess } = useChrome();
    const insets = useSafeAreaInsets();
    const ink = tone === "light" ? c.onColour : tone === "dark" ? c.hiInk : c.ink;
    return (
        <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: colour ?? c.bg, flexDirection: ROW }]}>
            <View style={[styles.barStart, { flexDirection: ROW }]}>
                {back && <RoundButton icon="arrow-forward" label="חזרה" tone={tone}
                    onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
                {!back && !title && (
                    <View style={[styles.brand, { flexDirection: ROW }]} accessibilityRole="header" accessibilityLabel="האזרח הקטן">
                        <Mark size={26} />
                        <Text style={[styles.brandText, { color: ink }]}>האזרח הקטן</Text>
                    </View>
                )}
                {!!title && (
                    <Text style={[back ? TYPE.title : TYPE.h1, styles.barTitle, { color: ink }]} numberOfLines={1}
                        accessibilityRole="header">{title}</Text>
                )}
            </View>
            <View style={[styles.barEnd, { flexDirection: ROW }]}>
                {search && <RoundButton icon="search" label="חיפוש" tone={tone} onPress={() => router.push("/search")} />}
                <RoundButton icon="accessibility-outline" label="נגישות" tone={tone} onPress={openAccess} />
            </View>
        </View>
    );
}

// ------------------------------------------------------------------ tab bar

/** what the router hands the bar at the foot of the tabs */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    index: ["newspaper", "newspaper-outline"],
    blindspots: ["eye-off", "eye-off-outline"],
    controversies: ["flame", "flame-outline"],
    outlets: ["podium", "podium-outline"],
    me: ["person-circle", "person-circle-outline"],
};

/**
 * The bar at the foot: five places, the one you are in lit in the app's violet.
 * Right to left, as Hebrew reads: today first.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
    const { c } = useSite();
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.tabs, { backgroundColor: c.card, borderTopColor: c.rule, paddingBottom: Math.max(insets.bottom, 8),
            flexDirection: ROW }]} accessibilityRole="tablist">
            {state.routes.map((route, i) => {
                const on = state.index === i;
                const { options } = descriptors[route.key];
                const label = String(options.title ?? route.name);
                const [full, outline] = TAB_ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
                return (
                    <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
                        onPress={() => {
                            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                            if (!on && !event.defaultPrevented) navigation.navigate(route.name);
                        }}
                        style={styles.tab}>
                        <View style={[styles.tabPill, on && { backgroundColor: c.brandTint }]}>
                            <Ionicons name={on ? full : outline} size={22} color={on ? c.brand : c.muted} />
                        </View>
                        <Text style={[styles.tabLabel, { color: on ? c.brand : c.muted, fontFamily: on ? FACE.bold : FACE.medium }]}
                            numberOfLines={1}>{label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { paddingHorizontal: 14, paddingBottom: 10, alignItems: "center", justifyContent: "space-between", zIndex: 5 },
    barStart: { alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    barTitle: { flexShrink: 1 },
    barEnd: { alignItems: "center", gap: 8 },
    brand: { alignItems: "center", gap: 9 },
    brandText: { fontFamily: FACE.black, fontSize: 23, lineHeight: 28, letterSpacing: -0.4 },
    round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

    tabs: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
    tab: { flex: 1, alignItems: "center", gap: 2 },
    tabPill: { width: 58, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    tabLabel: { fontSize: 11.5, lineHeight: 14 },

    sheet: {
        position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, gap: 12,
        borderTopLeftRadius: 28, borderTopRightRadius: 28, boxShadow: "0 -10px 40px rgba(10,10,30,0.18)",
    },
    grab: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 4 },
    sheetHead: { justifyContent: "space-between", alignItems: "center" },
    choices: { gap: 8, alignItems: "center" },
    choice: { flex: 1, borderRadius: RADIUS.button, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 4 },
    zoomNow: { minWidth: 64, textAlign: "center" },
    link: { textDecorationLine: "underline", marginTop: 4 },
});
