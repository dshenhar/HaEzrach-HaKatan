import { getSitePositions, getTopicPoles, SitePosition, TopicPoles } from '@/state/engagement';
import { track } from '@/state/analytics';
import OutletDetail from './outletDetail';
import Press from './press';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const RIGHT_SOFT = "#FBEDEB";
const LEFT_SOFT = "#EDF1F9";
// The phone lays the app out right to left and the web build does not, so "first
// child on the right" is "row" on one and "row-reverse" on the other.
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
const FROM_LEFT = I18nManager.isRTL ? "row-reverse" : "row";
/** the outlet the panel opens on before anyone picks one */
const FIRST = "ישראל היום";
/** the panel scrolls inside itself, so the page around it does not grow by a screen */
const PANEL_HEIGHT = 440;

type Side = "right" | "left";

/**
 * Where each outlet stands, at the foot of the analytics page.
 *
 * Two circles in the blocs' colours: the red one opens the right's outlets in a
 * strip that runs leftwards out of it, the blue one the left's, running rightwards.
 * Each strip starts from the outlet furthest out on its side, so the walk away
 * from a circle is a walk towards the centre. Touching an outlet - from either
 * strip - puts its positions on every topic in the panel underneath.
 */
export default function OutletPositions() {
    const [positions, setPositions] = useState<Record<string, SitePosition>>({});
    const [poles, setPoles] = useState<TopicPoles>({});
    const [side, setSide] = useState<Side | null>(null);
    const [outlet, setOutlet] = useState(FIRST);
    const strip = useRef<ScrollView>(null);
    // made once and kept: a value the strip's animation drives, read as it renders
    const [reveal] = useState(() => new Animated.Value(0));

    useEffect(() => {
        getSitePositions().then(setPositions);
        getTopicPoles().then(setPoles);
    }, []);

    const lists = useMemo(() => {
        const all = Object.values(positions);
        const of = (bloc: Side) => all
            .filter((p) => p.bloc === bloc)
            .sort((a, b) => bloc === "right" ? (b.bias ?? 0) - (a.bias ?? 0) : (a.bias ?? 0) - (b.bias ?? 0))
            .map((p) => p.source);
        return { right: of("right"), left: of("left") };
    }, [positions]);

    const openSide = (next: Side) => {
        const closing = side === next;
        if (!closing) track("outlet_side_opened", { side: next });
        setSide(closing ? null : next);
        if (closing) return;
        reveal.setValue(0);
        Animated.timing(reveal, {
            toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start();
    };

    const pick = (source: string, bloc: Side) => {
        track("outlet_detail_opened", { how: "list", bloc });
        setOutlet(source);
    };

    // A horizontal scroller opens at the left on the web and at the right on the
    // phone. Each strip has to open at its own circle, so the one that starts on the
    // far side is sent to its end.
    const startAtCircle = () => {
        if (!side) return;
        const farSide = side === "right" ? !I18nManager.isRTL : I18nManager.isRTL;
        if (farSide) strip.current?.scrollToEnd({ animated: false });
    };

    const circle = (bloc: Side) => {
        const on = side === bloc;
        const ink = bloc === "right" ? RIGHT : LEFT;
        return (
            <Press
                style={[styles.circle, { backgroundColor: ink }, on && styles.circleOn]}
                onPress={() => openSide(bloc)}
                accessibilityRole="button"
                accessibilityLabel={bloc === "right" ? "גופי הימין" : "גופי השמאל"}
                accessibilityState={{ expanded: on }}
            >
                <Text style={styles.circleText}>{bloc === "right" ? "ימין" : "שמאל"}</Text>
            </Press>
        );
    };

    const ink = side === "right" ? RIGHT : LEFT;
    const soft = side === "right" ? RIGHT_SOFT : LEFT_SOFT;

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>עמדות גופי התקשורת</Text>

            <View style={[styles.rail, { flexDirection: FROM_RIGHT }]}>
                {circle("right")}
                <View style={styles.middle}>
                    {side ? (
                        <Animated.View style={{
                            opacity: reveal,
                            // out of its own circle: the right's strip moves leftwards
                            // into place, the left's rightwards
                            transform: [{
                                translateX: reveal.interpolate({
                                    inputRange: [0, 1], outputRange: [side === "right" ? 28 : -28, 0],
                                }),
                            }],
                        }}>
                            <ScrollView
                                key={side}
                                ref={strip}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                onContentSizeChange={startAtCircle}
                                contentContainerStyle={[styles.strip,
                                    { flexDirection: side === "right" ? FROM_RIGHT : FROM_LEFT }]}
                            >
                                {lists[side].map((source) => {
                                    const chosen = source === outlet;
                                    return (
                                        <Press key={source}
                                            style={[styles.outlet, { borderColor: ink },
                                                chosen ? { backgroundColor: ink } : { backgroundColor: soft }]}
                                            onPress={() => pick(source, side)}
                                            accessibilityRole="button">
                                            <Text style={[styles.outletText, { color: chosen ? "#FFFFFF" : ink }]}
                                                numberOfLines={1}>{source}</Text>
                                        </Press>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    ) : (
                        <Text style={styles.hint}>בחרו צד כדי לראות את הגופים שלו</Text>
                    )}
                </View>
                {circle("left")}
            </View>

            <View style={styles.panel}>
                <OutletDetail source={outlet} poles={poles} style={styles.detail} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 10, marginTop: 8 },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 19, color: "#111827", textAlign: "right" },
    rail: { alignItems: "center", gap: 8 },
    circle: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: "center", justifyContent: "center",
    },
    // the open side wears a ring, so it reads as pressed while its strip is out
    circleOn: { borderWidth: 3, borderColor: "#FFFFFF", boxShadow: "0 0 0 2px #111827" },
    circleText: { fontFamily: "Heebo_800ExtraBold", fontSize: 12.5, color: "#FFFFFF" },
    middle: { flex: 1, minHeight: 40, justifyContent: "center", overflow: "hidden" },
    strip: { alignItems: "center", gap: 6, paddingVertical: 4 },
    outlet: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
    outletText: { fontFamily: "Heebo_700Bold", fontSize: 12 },
    hint: { fontFamily: "Heebo_400Regular", fontSize: 12, color: "#9CA3AF", textAlign: "center" },
    // the embedded window: a fixed height, scrolled from inside
    panel: { height: PANEL_HEIGHT, borderRadius: 14, overflow: "hidden" },
    detail: { marginHorizontal: 0 },
});
