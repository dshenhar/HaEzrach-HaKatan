import React, { useEffect, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { CONTACT } from "@/content/legal";
import { FACE, MAX_WIDTH, ROW, useSite } from "./tokens";
import { Header, Nav } from "./chrome";
import { Mark } from "./meter";
import { useNews } from "./news";
import { Go } from "./go";

export { Go };

type PageProps = {
    children: React.ReactNode;
    /** the browser tab's title; the site's name follows it */
    title?: string;
    nav?: Nav;
    /** inside the site: the header offers the way back */
    back?: boolean;
    /** the front page sets its own masthead, so the bar's name waits until it has scrolled away */
    masthead?: boolean;
};

/**
 * A page of the site: the bar that stays, the page under it, the footer at its
 * foot. Pulling down at the top fetches the paper again.
 */
export function Page({ children, title, nav = null, back = false, masthead = false }: PageProps) {
    const { c } = useSite();
    const { refresh } = useNews();
    const [past, setPast] = useState(!masthead);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined") return;
        document.title = title ? `${title} | האזרח הקטן` : "האזרח הקטן | כל החדשות, משני צדי המפה";
    }, [title]);

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!masthead) return;
        const y = e.nativeEvent.contentOffset.y;
        if ((y > 150) !== past) setPast(y > 150);
    };

    return (
        <View style={[styles.page, { backgroundColor: c.paper }]}>
            <Header nav={nav} showName={past} back={back} />
            <ScrollView
                style={styles.scroll}
                onScroll={onScroll}
                scrollEventThrottle={32}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
                    setRefreshing(true); await refresh(); setRefreshing(false);
                }} />}
            >
                {children}
                <Footer />
            </ScrollView>
        </View>
    );
}

/** the page's measure: the width a column of print can hold, centred on a desk */
export function Wrap({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const { gutter } = useSite();
    return <View style={[styles.wrap, { paddingHorizontal: gutter }, style]}>{children}</View>;
}

/**
 * A section of the paper opens on a heavy rule and its name, and nothing above
 * the name: the rule says a new section starts, the name says which.
 */
export function SectionHead({ title, more, onBand }: { title: string; more?: { href: any; label: string }; onBand?: boolean }) {
    const { c, type } = useSite();
    const ink = onBand ? c.bandInk : c.ink;
    return (
        <View style={[styles.sectionHead, { borderTopColor: ink, flexDirection: ROW }]}>
            <Text style={[type.section, { color: ink }]} accessibilityRole="header">{title}</Text>
            {more && (
                <Go href={more.href} plain>
                    {({ hovered }) => (
                        <Text style={[type.uiStrong, { color: ink, textDecorationLine: hovered ? "underline" : "none" }]}>
                            {more.label} ←
                        </Text>
                    )}
                </Go>
            )}
        </View>
    );
}

/** a press on paper: the row tints while it is held, and on a desk while the pointer is over it */
export function pressTint(c: { pressed: string }) {
    return ({ pressed, hovered }: any) => (pressed || hovered ? { backgroundColor: c.pressed } : null);
}

/** A thin rule between things that belong to one list. */
export function Rule({ strong, style }: { strong?: boolean; style?: StyleProp<ViewStyle> }) {
    const { c } = useSite();
    return <View style={[{ height: strong ? 3 : 1, backgroundColor: strong ? c.ruleStrong : c.rule }, style]} />;
}

const FOOT_LINKS: { href: string; label: string }[] = [
    { href: "/about", label: "על האזרח הקטן" },
    { href: "/methodology", label: "איך נקבעת העמדה" },
    { href: "/blind", label: "סקר עיוור" },
    { href: "/questionnaire", label: "שאלון העמדות" },
    { href: "/accessibility", label: "הצהרת נגישות" },
    { href: "/privacy", label: "מדיניות פרטיות" },
    { href: "/terms", label: "תנאי שימוש" },
];

function Footer() {
    const { c, type, wide } = useSite();
    return (
        <View style={[styles.footer, { borderTopColor: c.ruleStrong, backgroundColor: c.paperAlt }]}>
            <Wrap>
                <View style={[styles.footTop, { flexDirection: wide ? ROW : "column" }]}>
                    <View style={styles.footName}>
                        <View style={[styles.footMark, { flexDirection: ROW }]}>
                            <Mark size={24} />
                            <Text style={[styles.footNameText, { color: c.ink }]}>האזרח הקטן</Text>
                        </View>
                        <Text style={[type.small, { color: c.ink2 }]}>כל החדשות, משני צדי המפה.</Text>
                    </View>
                    <View style={[styles.footLinks, { flexDirection: ROW }]}>
                        {FOOT_LINKS.map((l) => (
                            <Go key={l.href} href={l.href} plain style={styles.footLink}>
                                {({ hovered }) => (
                                    <Text style={[type.ui, { color: c.ink, textDecorationLine: hovered ? "underline" : "none" }]}>{l.label}</Text>
                                )}
                            </Go>
                        ))}
                    </View>
                </View>
                <Text style={[type.meta, styles.footNote, { color: c.muted }]}>
                    כותרת, תקציר, שם הגוף ושעה. כל כתבה נקראת באתר של הגוף שפרסם אותה. לפניות: {CONTACT}
                </Text>
            </Wrap>
        </View>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },
    scroll: { flex: 1 },
    wrap: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
    sectionHead: {
        borderTopWidth: 3, paddingTop: 10, marginBottom: 14,
        justifyContent: "space-between", alignItems: "baseline",
    },
    footer: { borderTopWidth: 3, marginTop: 48, paddingTop: 28, paddingBottom: 48 },
    footTop: { gap: 22, justifyContent: "space-between" },
    footName: { gap: 6 },
    footMark: { alignItems: "center", gap: 10 },
    footNameText: { fontFamily: FACE.serifBlack, fontSize: 28, lineHeight: 34 },
    footLinks: { flexWrap: "wrap", columnGap: 22, rowGap: 6, maxWidth: 620 },
    footLink: { paddingVertical: 4 },
    footNote: { marginTop: 24 },
});

