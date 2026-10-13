import React, { useCallback, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useFocusEffect, useScrollToTop } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, ROW, TYPE, useSite } from "./tokens";
import { AppBar, Tone } from "./chrome";
import { useNews } from "./news";
import { Go } from "./go";

export { Go };

type ScreenProps = {
    children: React.ReactNode;
    /** the browser tab's title; the app's name follows it */
    docTitle?: string;
    /** the screen's name in the top bar; none on the first tab, where the app's name stands */
    title?: string;
    back?: boolean;
    search?: boolean;
    /**
     * The screen's own colour: the bar, and the head under it, are laid in it,
     * and the rest of the screen rises over its foot on a rounded sheet.
     */
    colour?: string;
    tone?: Tone;
    /** what stands at the top of the screen, in its colour when it has one */
    head?: React.ReactNode;
};

/**
 * A screen of the app: its bar, fixed; its content scrolling under it, with a
 * line under the bar once there is something under it; and the paper fetched
 * again when it is pulled down from the top. Tapping the tab it is on brings it
 * back to the top.
 */
export function Screen({ children, docTitle, title, back, search, colour, tone, head }: ScreenProps) {
    const { c } = useSite();
    const { refresh } = useNews();
    const [refreshing, setRefreshing] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const ref = useRef<ScrollView>(null);
    useScrollToTop(ref);
    const ground = colour ?? c.bg;
    const barTone: Tone = tone ?? (colour ? "light" : "plain");

    useFocusEffect(useCallback(() => {
        if (Platform.OS !== "web" || typeof document === "undefined") return;
        document.title = docTitle ? `${docTitle} | האזרח הקטן` : "האזרח הקטן | כל החדשות, משני צדי המפה";
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", ground);
    }, [docTitle, ground]));

    return (
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
            <AppBar title={title} back={back} search={search} colour={ground} tone={barTone} />
            <View style={[styles.barLine, { backgroundColor: colour ? "rgba(0,0,0,0.14)" : c.rule, opacity: scrolled ? 1 : 0 }]} />
            <ScrollView
                ref={ref}
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={32}
                onScroll={(e) => {
                    const now = e.nativeEvent.contentOffset.y > 4;
                    if (now !== scrolled) setScrolled(now);
                }}
                refreshControl={<RefreshControl refreshing={refreshing} tintColor={colour ? c.onColour : c.muted}
                    onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
            >
                {colour ? (
                    <>
                        {/* the colour goes on above the top, so a pull down shows more of it and not a gap */}
                        <View style={[styles.overscroll, { backgroundColor: colour }]} />
                        <View style={[styles.head, { backgroundColor: colour }]}>{head}</View>
                        <View style={[styles.sheet, { backgroundColor: c.bg }]}>{children}</View>
                    </>
                ) : (
                    <>
                        {head}
                        {children}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

/** A group of the screen: its name, and where to see all of it. */
export function SectionHead({ title, more, count, style }: {
    title: string;
    more?: { href: any; label: string };
    count?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const { c } = useSite();
    return (
        <View style={[styles.sectionHead, { flexDirection: ROW }, style]}>
            <View style={[styles.sectionTitle, { flexDirection: ROW }]}>
                <Text style={[TYPE.section, { color: c.ink }]} accessibilityRole="header">{title}</Text>
                {count !== undefined && (
                    <View style={[styles.count, { backgroundColor: c.ink }]}>
                        <Text style={[styles.countText, { color: c.card }]}>{count}</Text>
                    </View>
                )}
            </View>
            {more && (
                <Go href={more.href} plain>
                    <Text style={[TYPE.uiStrong, { color: c.brand }]}>{more.label}</Text>
                </Go>
            )}
        </View>
    );
}

/** A card: white, round-cornered, and it gives a little under the finger. */
export function Card({ children, onPress, style, label, tint }: {
    children: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    label?: string;
    /** a coloured card instead of a white one */
    tint?: string;
}) {
    const { c } = useSite();
    const base = [styles.card, { backgroundColor: tint ?? c.card }, style];
    if (!onPress) return <View style={base}>{children}</View>;
    return (
        <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label}
            style={({ pressed }) => [base, pressed && styles.pressed]}>
            {children}
        </Pressable>
    );
}

/**
 * A sideways shelf of cards that opens on its first card. On the web the cards
 * are laid right to left by hand, so the scroller's own start - its left end -
 * shows the last of them; it is turned to its other end until the reader moves it.
 */
export function Shelf({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
    const ref = useRef<ScrollView>(null);
    const moved = useRef(false);
    const toStart = () => {
        if (Platform.OS !== "web" || moved.current) return;
        ref.current?.scrollToEnd({ animated: false });
    };
    return (
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}
            onContentSizeChange={toStart}
            onTouchStart={() => { moved.current = true; }}
            onScrollBeginDrag={() => { moved.current = true; }}
            contentContainerStyle={[styles.shelf, { gap, flexDirection: ROW, minWidth: "100%" }]}
            style={styles.shelfScroll}>
            {children}
        </ScrollView>
    );
}

/** rows in one card, divided by hairlines, under a small name: the settings, the outlets, the pages */
export function Group({ children, title, note, style }: {
    children: React.ReactNode; title?: string; note?: string; style?: StyleProp<ViewStyle>;
}) {
    const { c } = useSite();
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={[styles.group, style]}>
            {!!title && <Text style={[TYPE.label, styles.groupTitle, { color: c.muted }]} accessibilityRole="header">{title}</Text>}
            <View style={[styles.groupCard, { backgroundColor: c.card }]}>
                {rows.map((row, i) => (
                    <View key={i}>
                        {i > 0 && <View style={[styles.groupRule, { backgroundColor: c.rule }]} />}
                        {row}
                    </View>
                ))}
            </View>
            {!!note && <Text style={[TYPE.meta, styles.groupNote, { color: c.muted }]}>{note}</Text>}
        </View>
    );
}

/** one row of a group: a coloured square with its sign, its words, and the way on */
export function ListRow({ icon, colour, label, detail, href, onPress, external }: {
    icon?: keyof typeof Ionicons.glyphMap;
    colour?: string;
    label: string;
    detail?: string;
    href?: any;
    onPress?: () => void;
    /** it leaves the app */
    external?: boolean;
}) {
    const { c } = useSite();
    const inner = (
        <View style={[styles.listRow, { flexDirection: ROW }]}>
            {icon && (
                <View style={[styles.listIcon, { backgroundColor: colour ?? c.brand }]}>
                    <Ionicons name={icon} size={18} color="#FFFFFF" />
                </View>
            )}
            <View style={styles.listWords}>
                <Text style={[TYPE.uiStrong, { color: c.ink }]}>{label}</Text>
                {!!detail && <Text style={[TYPE.meta, { color: c.muted }]}>{detail}</Text>}
            </View>
            <Ionicons name={external ? "open-outline" : "chevron-back"} size={18} color={c.muted} />
        </View>
    );
    if (href) return <Go href={href} onPress={onPress} label={label}>{inner}</Go>;
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
            style={({ pressed }) => pressed && { backgroundColor: c.pressed }}>
            {inner}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingBottom: 40, flexGrow: 1 },
    barLine: { height: StyleSheet.hairlineWidth, marginBottom: -StyleSheet.hairlineWidth, zIndex: 4 },
    overscroll: { position: "absolute", top: -1000, height: 1000, left: 0, right: 0 },
    head: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 34, gap: 12 },
    sheet: { flexGrow: 1, marginTop: -20, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8 },
    sectionHead: { justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 30, marginBottom: 12 },
    sectionTitle: { alignItems: "center", gap: 8 },
    count: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
    countText: { fontFamily: "Rubik_700Bold", fontSize: 12.5, fontVariant: ["tabular-nums"] },
    card: { borderRadius: RADIUS.card, padding: 16, boxShadow: "0 1px 2px rgba(15,17,21,0.05), 0 4px 14px rgba(15,17,21,0.05)" },
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
    shelf: { paddingHorizontal: 16, paddingVertical: 4 },
    shelfScroll: { flexGrow: 0 },
    group: { marginHorizontal: 12, marginTop: 26, gap: 8 },
    groupTitle: { paddingHorizontal: 6 },
    groupCard: { borderRadius: RADIUS.card, overflow: "hidden" },
    groupRule: { height: StyleSheet.hairlineWidth, marginRight: 60 },
    groupNote: { paddingHorizontal: 6 },
    listRow: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 54 },
    listIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    listWords: { flex: 1, gap: 2 },
});
