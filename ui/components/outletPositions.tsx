import { getSitePositions, getTopicPoles, SitePosition, TopicPoles } from '@/state/engagement';
import { track } from '@/state/analytics';
import BlocSwipe, { firstSide, Side } from './blocSwipe';
import OutletDetail from './outletDetail';
import Press from './press';
import React, { useEffect, useMemo, useState } from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';

// The phone lays the app out right to left and the web build does not, so "first
// child on the right" is "row" on one and "row-reverse" on the other.
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
/** the outlet the panel opens on when its side has none to offer */
const FIRST = "ישראל היום";
/** the panel scrolls inside itself, so the page around it does not grow by a screen */
const PANEL_HEIGHT = 440;

/**
 * Where each outlet stands, at the foot of the analytics page.
 *
 * The right's outlets and the left's, each on a page of its own colour, swiped
 * between - opening on the side that has more of them, and on a coin when they are
 * level. Each page starts from the outlet furthest out on its side, so reading it
 * is a walk towards the centre. Touching an outlet - on either page - puts its
 * positions on every topic in the panel underneath.
 */
export default function OutletPositions() {
    const [positions, setPositions] = useState<Record<string, SitePosition>>({});
    const [poles, setPoles] = useState<TopicPoles>({});
    // the side the pages open on, decided once, when the outlets are in
    const [start, setStart] = useState<Side | null>(null);
    const [outlet, setOutlet] = useState<string | null>(null);

    useEffect(() => {
        getSitePositions().then((next) => {
            setPositions(next);
            const all = Object.values(next);
            setStart(firstSide(all.filter((p) => p.bloc === "right").length,
                all.filter((p) => p.bloc === "left").length));
        });
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

    // until one is touched, the panel shows the outlet furthest out on the side the
    // pages opened on
    const shown = outlet ?? (start && lists[start][0]) ?? FIRST;

    const pick = (source: string, bloc: Side) => {
        track("outlet_detail_opened", { how: "list", bloc });
        setOutlet(source);
    };

    const page = (bloc: Side) => (
        <View style={[styles.chips, { flexDirection: FROM_RIGHT }]}>
            {lists[bloc].map((source) => {
                const chosen = source === shown;
                return (
                    <Press key={source}
                        style={[styles.outlet, chosen && styles.outletOn]}
                        onPress={() => pick(source, bloc)}
                        accessibilityRole="button" accessibilityState={{ selected: chosen }}>
                        <Text style={[styles.outletText, chosen && { color: bloc === "right" ? "#C0392F" : "#2B5EA7" }]}
                            numberOfLines={1}>{source}</Text>
                    </Press>
                );
            })}
        </View>
    );

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>עמדות גופי התקשורת</Text>

            {start && (
                <BlocSwipe
                    start={start}
                    right={page("right")}
                    left={page("left")}
                    rightNote={String(lists.right.length)}
                    leftNote={String(lists.left.length)}
                    onSide={(side) => track("outlet_side_opened", { side })}
                />
            )}

            <View style={styles.panel}>
                <OutletDetail source={shown} poles={poles} style={styles.detail} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 10, marginTop: 8 },
    title: { fontFamily: "Rubik_800ExtraBold", fontSize: 19, color: "#111827", textAlign: "right" },
    // white on the side's colour; the outlet in the panel is the one set in white
    chips: { flexWrap: "wrap", gap: 6 },
    outlet: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.16)" },
    outletOn: { backgroundColor: "#FFFFFF" },
    outletText: { fontFamily: "Rubik_700Bold", fontSize: 12, color: "#FFFFFF" },
    // the embedded window: a fixed height, scrolled from inside
    panel: { height: PANEL_HEIGHT, borderRadius: 14, overflow: "hidden" },
    detail: { marginHorizontal: 0 },
});
