import { useTheme } from '@/state/theme';
import { TYPE } from '@/state/craft';
import Press from './press';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView,
    StyleSheet, Text, View } from 'react-native';

export type Side = "right" | "left";

// One rule for every swipe in the app: a finger moving right brings in the right,
// moving left the left - so the right's page lies to the left of the left's, as it
// does beside a story in the feed. The phone lays a row out right to left and the
// web build does not, so the pages are put down in the order that lands them there,
// and the two names above them stand over their own pages.
const PHYS: Side[] = ["right", "left"];      // left to right on the screen
const ORDER: Side[] = I18nManager.isRTL ? [...PHYS].reverse() : PHYS;
const OVER_PAGES = I18nManager.isRTL ? "row-reverse" : "row";
const LABEL: Record<Side, string> = { right: "ימין", left: "שמאל" };
// The pages' grounds. The dark theme's inks are light, to read on a dark page, and
// white words on them would not; its pages keep the day's deeper red and blue.
const DEEP: Record<Side, string> = { right: "#C0392F", left: "#2B5EA7" };

/**
 * The side to open on: the one more sources stand behind, and a coin when they are
 * level - so neither side is the one always met first.
 */
export function firstSide(right = 0, left = 0): Side {
    if (right !== left) return right > left ? "right" : "left";
    return Math.random() < 0.5 ? "right" : "left";
}

type Props = {
    right: React.ReactNode;
    left: React.ReactNode;
    /** how many sources each side has, which picks the side it opens on */
    rightCount?: number;
    leftCount?: number;
    /** a side to open on, when the counts are not what decides it */
    start?: Side;
    /** what the two labels above the pages say after the side's name, e.g. a count */
    rightNote?: string;
    leftNote?: string;
    onSide?: (side: Side) => void;
};

/**
 * The right and the left as two pages side by side, swiped between, each on its
 * own colour - red for the right, blue for the left - so which one is on screen is
 * never in doubt: a finger moving right brings in the right. Above them the two
 * names, each over its own page, which can be touched as well as swiped to, the
 * one showing filled in.
 */
export default function BlocSwipe({ right, left, rightCount, leftCount, start, rightNote, leftNote, onSide }: Props) {
    const t = useTheme();
    const initial = useMemo(() => start ?? firstSide(rightCount, leftCount),
        // decided once, when the pages are first shown
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []);
    const [side, setSide] = useState<Side>(initial);
    const [width, setWidth] = useState(0);
    const scroller = useRef<ScrollView>(null);
    const placed = useRef(false);
    const ink: Record<Side, string> = { right: t.right, left: t.left };
    const ground = t.name === "negative" ? DEEP : ink;

    const xOf = (s: Side) => PHYS.indexOf(s) * width;
    const go = (s: Side, animated: boolean) => {
        scroller.current?.scrollTo({ x: xOf(s), animated });
    };
    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w && w !== width) setWidth(w);
    };
    // once its width is known, the scroller is set on the side it opens on
    useEffect(() => {
        if (!width || placed.current) return;
        placed.current = true;
        requestAnimationFrame(() => go(initial, false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width]);

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!width) return;
        const page = PHYS[Math.max(0, Math.min(1, Math.round(e.nativeEvent.contentOffset.x / width)))];
        if (page !== side) {
            setSide(page);
            onSide?.(page);
        }
    };

    const page = (s: Side) => (
        <View key={s} style={[styles.page, { width: width || undefined, backgroundColor: ground[s] }]}
            accessibilityLabel={LABEL[s]}>
            {s === "right" ? right : left}
        </View>
    );

    return (
        <View style={styles.wrap} onLayout={onLayout}>
            <View style={[styles.tabs, { flexDirection: OVER_PAGES, backgroundColor: t.surfaceAlt }]}
                accessibilityRole="tablist">
                {PHYS.map((s) => {
                    const on = side === s;
                    const note = s === "right" ? rightNote : leftNote;
                    return (
                        <Press key={s} style={[styles.tab, on && { backgroundColor: ground[s] }]}
                            onPress={() => { go(s, true); setSide(s); onSide?.(s); }}
                            accessibilityRole="tab" accessibilityState={{ selected: on }}>
                            <Text style={[styles.tabText, { color: on ? "#FFFFFF" : ink[s] }]}>
                                {LABEL[s]}{note ? ` · ${note}` : ""}
                            </Text>
                        </Press>
                    );
                })}
            </View>
            <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={32}
                style={styles.scroller}
            >
                {ORDER.map(page)}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: "100%", gap: 8 },
    tabs: { borderRadius: 999, padding: 3, gap: 3 },
    tab: { flex: 1, borderRadius: 999, paddingVertical: 6, alignItems: "center" },
    tabText: { ...TYPE.label, fontSize: 13.5 },
    scroller: { borderRadius: 14 },
    // as tall as the taller of the two: the web build wraps each page of a paging
    // scroller in a box of its own, which the row stretches and the page fills
    page: { borderRadius: 14, padding: 14, flexGrow: 1 },
});
