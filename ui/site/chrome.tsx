import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccessControl, useStillness, ZOOM_STEPS } from "@/state/access";
import { ThemeName, useThemeControl } from "@/state/theme";
import { track } from "@/state/analytics";
import { installKind, promptInstall } from "@/state/install";
import { FACE, MAX_WIDTH, ROW, useSite } from "./tokens";
import { Mark } from "./meter";
import { Go } from "./go";
import { useNews } from "./news";

// ------------------------------------------------------------------ overlays

type Chrome = { openMenu: () => void; openAccess: () => void };
const ChromeContext = createContext<Chrome>({ openMenu: () => {}, openAccess: () => {} });
export const useChrome = () => useContext(ChromeContext);

/**
 * The two things that open over any page: the menu, and the accessibility panel
 * the standard asks to be reachable from every screen. They live at the root so
 * every page reaches them the same way, from the header.
 */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
    const [menu, setMenu] = useState(false);
    const [access, setAccess] = useState(false);
    return (
        <ChromeContext.Provider value={{ openMenu: () => setMenu(true), openAccess: () => setAccess(true) }}>
            {children}
            <Menu open={menu} onClose={() => setMenu(false)} />
            <AccessPanel open={access} onClose={() => setAccess(false)} />
        </ChromeContext.Provider>
    );
}

/** slides in from the reading edge, and back out the way it came */
function useDrawer(open: boolean) {
    const still = useStillness();
    // kept on screen after it is closed, for as long as it takes to leave
    const [leaving, setLeaving] = useState(false);
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (!open) setLeaving(true);
    }
    const at = useSharedValue(0);
    useEffect(() => {
        at.value = withTiming(open ? 1 : 0, { duration: still ? 0 : open ? 240 : 170, easing: Easing.out(Easing.cubic) });
        if (open) return;
        const t = setTimeout(() => setLeaving(false), still ? 0 : 180);
        return () => clearTimeout(t);
    }, [open, still, at]);
    const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - at.value) * 60 }], opacity: at.value }));
    const scrim = useAnimatedStyle(() => ({ opacity: at.value }));
    return { mounted: open || leaving, panel, scrim };
}

const MAIN_PAGES: { href: string; label: string }[] = [
    { href: "/", label: "ראשי" },
    { href: "/blindspots", label: "נקודות עיוורות" },
    { href: "/controversies", label: "מחלוקות" },
    { href: "/outlets", label: "גופי התקשורת" },
    { href: "/me", label: "הקריאה שלי" },
    { href: "/blind", label: "סקר עיוור" },
];

const SMALL_PAGES: { href: string; label: string }[] = [
    { href: "/about", label: "על האזרח הקטן" },
    { href: "/methodology", label: "איך נקבעת העמדה" },
    { href: "/questionnaire", label: "שאלון העמדות" },
    { href: "/accessibility", label: "הצהרת נגישות" },
    { href: "/privacy", label: "מדיניות פרטיות" },
    { href: "/terms", label: "תנאי שימוש" },
];

function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { c, type, wide } = useSite();
    const { sections } = useNews();
    const { mounted, panel, scrim } = useDrawer(open);
    const insets = useSafeAreaInsets();
    const install = Platform.OS === "web" ? installKind() : null;
    if (!mounted) return null;

    const row = (href: string, label: string, big: boolean) => (
        <Go key={href} href={href} onPress={onClose} style={[styles.menuRow, { borderBottomColor: c.rule }]}>
            <Text style={[big ? styles.menuBig : styles.menuSmall, { color: c.ink }]}>{label}</Text>
        </Go>
    );

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.42)" }, scrim]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="סגירת התפריט" />
            </Animated.View>
            <Animated.View style={[styles.menu, { backgroundColor: c.paper, paddingTop: insets.top,
                width: wide ? 420 : "100%" }, panel]}
                accessibilityViewIsModal>
                <View style={[styles.menuHead, { flexDirection: ROW, borderBottomColor: c.ruleStrong }]}>
                    <View style={[styles.name, { flexDirection: ROW }]}>
                        <Mark size={20} />
                        <Text style={[styles.nameText, { color: c.ink }]}>האזרח הקטן</Text>
                    </View>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="סגירה"
                        style={styles.iconHit}>
                        <Ionicons name="close" size={26} color={c.ink} />
                    </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.menuBody}>
                    {MAIN_PAGES.map((p) => row(p.href, p.label, true))}
                    {sections.length > 0 && (
                        <>
                            <Text style={[type.label, styles.menuGroup, { color: c.muted }]}>מדורים</Text>
                            <View style={[styles.sectionGrid, { flexDirection: ROW }]}>
                                {sections.map((s) => (
                                    <Go key={s} href={{ pathname: "/section/[name]", params: { name: s } }} onPress={onClose}
                                        style={[styles.sectionCell, { borderColor: c.rule }]}>
                                        <Text style={[type.uiStrong, { color: c.ink }]}>{s}</Text>
                                    </Go>
                                ))}
                            </View>
                        </>
                    )}
                    <View style={[styles.smallBlock, { borderTopColor: c.ruleStrong }]}>
                        {SMALL_PAGES.map((p) => row(p.href, p.label, false))}
                        {install && (
                            <Pressable onPress={() => { track("install_tapped", { from: "menu" }); promptInstall(); onClose(); }}
                                style={({ pressed }) => [styles.menuRow, { borderBottomColor: c.rule }, pressed && { backgroundColor: c.pressed }]}>
                                <Text style={[styles.menuSmall, { color: c.ink }]}>התקנה במסך הבית</Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

// ------------------------------------------------------------------ accessibility

const DISPLAYS: { key: ThemeName; label: string }[] = [
    { key: "light", label: "רגיל" },
    { key: "negative", label: "לילה" },
    { key: "contrast", label: "ניגודיות גבוהה" },
];

/**
 * Text size, a dark page or a high-contrast one, and stillness: the three
 * adjustments the site can honestly make, in one place, from every page.
 */
function AccessPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { c, type } = useSite();
    const { access, setAccess } = useAccessControl();
    const { theme, setThemeName } = useThemeControl();
    const { mounted, panel, scrim } = useDrawer(open);
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

    const choice = (on: boolean, label: string, onPress: () => void, a11y?: string) => (
        <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
            accessibilityLabel={a11y ?? label}
            style={({ pressed }) => [styles.choice, { borderColor: on ? c.ink : c.rule, backgroundColor: on ? c.ink : pressed ? c.pressed : c.paper }]}>
            <Text style={[type.uiStrong, { color: on ? c.paper : c.ink, textAlign: "center" }]}>{label}</Text>
        </Pressable>
    );

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.42)" }, scrim]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="סגירת הנגישות" />
            </Animated.View>
            <Animated.View style={[styles.access, { backgroundColor: c.paper, borderColor: c.ruleStrong, paddingTop: insets.top + 8 }, panel]}
                accessibilityViewIsModal>
                <View style={[styles.menuHead, { flexDirection: ROW, borderBottomColor: c.ruleStrong }]}>
                    <Text style={[type.section, { color: c.ink }]}>נגישות</Text>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="סגירה" style={styles.iconHit}>
                        <Ionicons name="close" size={26} color={c.ink} />
                    </Pressable>
                </View>
                <View style={styles.accessBody}>
                    <Text style={[type.label, { color: c.muted }]}>גודל טקסט</Text>
                    <View style={[styles.choices, { flexDirection: ROW }]}>
                        {choice(false, "א+", () => setZoom(zoomAt + 1), "הגדלת טקסט")}
                        <Text style={[type.uiStrong, styles.zoomNow, { color: c.ink }]}>{Math.round(access.zoom * 100)}%</Text>
                        {choice(false, "א-", () => setZoom(zoomAt - 1), "הקטנת טקסט")}
                    </View>
                    <Text style={[type.label, { color: c.muted }]}>תצוגה</Text>
                    <View style={[styles.choices, { flexDirection: ROW }]}>
                        {DISPLAYS.map((d) => choice(theme.name === d.key, d.label, () => setDisplay(d.key)))}
                    </View>
                    <Text style={[type.label, { color: c.muted }]}>תנועה</Text>
                    <View style={[styles.choices, { flexDirection: ROW }]}>
                        {choice(!access.reduceMotion, "רגילה", () => { track("accessibility_changed", { setting: "motion", value: "normal" }); setAccess({ reduceMotion: false }); })}
                        {choice(access.reduceMotion, "מופחתת", () => { track("accessibility_changed", { setting: "motion", value: "reduced" }); setAccess({ reduceMotion: true }); })}
                    </View>
                    <Go href="/accessibility" onPress={onClose} plain>
                        <Text style={[type.ui, styles.link, { color: c.ink }]}>הצהרת הנגישות המלאה</Text>
                    </Go>
                </View>
            </Animated.View>
        </View>
    );
}

// ------------------------------------------------------------------ header

export type Nav = "home" | "blindspots" | "controversies" | "outlets" | `section:${string}` | null;

type HeaderProps = {
    /** which strip item is lit; no strip when null */
    nav: Nav;
    /** the small name in the bar: hidden while the masthead itself is on screen */
    showName: boolean;
    back: boolean;
};

/**
 * The bar that stays: the menu and, inside the site, the way back on the reading
 * side; the name in the middle; search and accessibility on the other side.
 * Under it on the front page and the sections, the strip of where to go.
 */
export function Header({ nav, showName, back }: HeaderProps) {
    const { c } = useSite();
    const { openMenu, openAccess } = useChrome();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
        <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
            style={({ pressed, hovered }: any) => [styles.iconHit, (pressed || hovered) && { backgroundColor: c.pressed }]}>
            <Ionicons name={name} size={24} color={c.ink} />
        </Pressable>
    );

    return (
        <View style={[styles.header, { backgroundColor: c.paper, borderBottomColor: nav ? c.rule : c.ruleStrong, paddingTop: insets.top }]}>
            <View style={[styles.bar, { flexDirection: ROW, maxWidth: MAX_WIDTH + 2 * 16 }]}>
                <View style={[styles.side, { flexDirection: ROW }]}>
                    {back && icon("arrow-forward", "חזרה", () => (router.canGoBack() ? router.back() : router.replace("/")))}
                    {icon("menu", "תפריט", openMenu)}
                </View>
                <Go href="/" plain label="האזרח הקטן, לעמוד הראשי"
                    style={[styles.name, { flexDirection: ROW, opacity: showName ? 1 : 0 }]}>
                    <Mark size={18} />
                    <Text style={[styles.nameText, { color: c.ink }]}>האזרח הקטן</Text>
                </Go>
                <View style={[styles.side, styles.sideEnd, { flexDirection: ROW }]}>
                    {icon("search", "חיפוש", () => router.push("/search"))}
                    {icon("accessibility-outline", "נגישות", openAccess)}
                </View>
            </View>
            {nav && <Strip nav={nav} />}
        </View>
    );
}

/**
 * Where to go, in one line: the front page, the two things only this site has,
 * then the day's sections. A browser opens a sideways scroller at its left edge,
 * which would show the end of a Hebrew list first; it is put at its start.
 */
function Strip({ nav }: { nav: Nav }) {
    const { c, type, gutter, width } = useSite();
    const { sections } = useNews();
    const ref = useRef<ScrollView>(null);
    // once the reader has moved the strip, it stays where they left it
    const moved = useRef(false);
    // widths only: the browser reports a view's size when it changes, never its place
    const widths = useRef<Record<string, number>>({});
    const contentW = useRef(0);
    const items: { key: Nav; label: string; href: any }[] = [
        { key: "home", label: "ראשי", href: "/" },
        { key: "blindspots", label: "נקודות עיוורות", href: "/blindspots" },
        { key: "controversies", label: "מחלוקות", href: "/controversies" },
        ...sections.map((s) => ({ key: `section:${s}` as Nav, label: s, href: { pathname: "/section/[name]", params: { name: s } } })),
        { key: "outlets", label: "גופי התקשורת", href: "/outlets" },
    ];
    // on a desk the strip starts where the page's column does
    const pad = Math.max(gutter - 10, (width - MAX_WIDTH) / 2 + gutter - 10);
    const GAP = 2;
    // Put the strip at its start - the right end, where Hebrew begins - and, when
    // a section further along is lit, bring it in so it is seen whole.
    const place = () => {
        if (moved.current || !contentW.current) return;
        const max = Math.max(0, contentW.current - width);
        let fromEnd = pad;
        let x = max;
        for (const item of items) {
            const w = widths.current[String(item.key)] ?? 0;
            if (item.key === nav) {
                const left = contentW.current - fromEnd - w;
                x = Math.min(max, Math.max(0, left - 24));
                break;
            }
            fromEnd += w + GAP;
        }
        ref.current?.scrollTo({ x, animated: false });
    };
    // after every render: cheap, and the strip's sizes arrive one by one
    useEffect(() => { place(); });
    return (
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}
            onTouchStart={() => { moved.current = true; }}
            onScrollBeginDrag={() => { moved.current = true; }}
            onContentSizeChange={(w) => { contentW.current = w; place(); }}
            contentContainerStyle={[styles.strip, { flexDirection: ROW, paddingHorizontal: pad, minWidth: "100%" }]}>
            {items.map((item) => {
                const on = item.key === nav;
                return (
                    <View key={String(item.key)} onLayout={(e) => {
                        widths.current[String(item.key)] = e.nativeEvent.layout.width;
                        place();
                    }}>
                        <Go href={item.href} plain selected={on}
                            style={[styles.stripItem, { borderBottomColor: on ? c.ink : "transparent" }]}>
                            {({ hovered }) => (
                                <Text style={[type.uiStrong, { color: on ? c.ink : c.ink2, fontFamily: on ? FACE.sansHeavy : FACE.sansBold,
                                    textDecorationLine: hovered && !on ? "underline" : "none" }]}>
                                    {item.label}
                                </Text>
                            )}
                        </Go>
                    </View>
                );
            })}
        </ScrollView>
    );
}

/** the route's own name for the strip, when a page does not say */
export function useNavFromPath(): Nav {
    const path = usePathname();
    if (path === "/") return "home";
    if (path.startsWith("/blindspots")) return "blindspots";
    if (path.startsWith("/controversies")) return "controversies";
    if (path.startsWith("/outlets")) return "outlets";
    return null;
}

const styles = StyleSheet.create({
    header: { width: "100%", borderBottomWidth: 1, zIndex: 20 },
    bar: { height: 56, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, width: "100%", alignSelf: "center" },
    side: { alignItems: "center", gap: 2, minWidth: 96 },
    sideEnd: { justifyContent: "flex-end" },
    iconHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    name: { alignItems: "center", gap: 8 },
    nameText: { fontFamily: FACE.serifBlack, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
    strip: { alignItems: "stretch", gap: 2 },
    stripItem: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 9, borderBottomWidth: 3 },

    menu: { position: "absolute", top: 0, bottom: 0, right: 0, maxWidth: "100%" },
    menuHead: { height: 60, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 3 },
    menuBody: { paddingBottom: 40 },
    menuRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    menuBig: { fontFamily: FACE.serifBold, fontSize: 25, lineHeight: 32, textAlign: "right", writingDirection: "rtl" },
    menuSmall: { fontFamily: FACE.sansBold, fontSize: 16, lineHeight: 21, textAlign: "right", writingDirection: "rtl" },
    menuGroup: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
    sectionGrid: { flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
    sectionCell: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
    smallBlock: { marginTop: 26, borderTopWidth: 3 },

    access: { position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: 3, maxWidth: 560, alignSelf: "center" },
    accessBody: { padding: 20, gap: 12 },
    choices: { gap: 8, alignItems: "center" },
    choice: { flex: 1, borderWidth: 1.5, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
    zoomNow: { minWidth: 56, textAlign: "center" },
    link: { textDecorationLine: "underline", marginTop: 6 },
});
