import React, { useRef, useState } from 'react';
import { I18nManager, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView,
    StyleSheet, View, ViewStyle } from 'react-native';

const GAP = 12;
// how much of the next card shows at the edge, so the row says it goes on
const PEEK = 52;
const MAX_CARD = 340;

// The web build lays the page out left to right, so the row is reversed for its
// first card to stand at the right, and the scroller starts at its right end. The
// phone is right to left already. Snapping is the browser's own, on each card's
// right edge.
const WEB = Platform.OS === "web";
const ROW = I18nManager.isRTL ? "row" : "row-reverse";
const SNAP_ROW = (WEB ? { scrollSnapType: "x mandatory" } : {}) as ViewStyle;
const SNAP_ITEM = (WEB ? { scrollSnapAlign: "end" } : {}) as ViewStyle;

type Props<T> = {
    items: T[];
    keyOf: (item: T) => string;
    render: (item: T, width: number) => React.ReactNode;
    /** a last card at the row's far end - "more", say */
    end?: (width: number) => React.ReactNode;
    /** the side padding the row starts and ends with */
    inset?: number;
};

/**
 * A row of cards swiped sideways, from right to left as Hebrew reads: the first card
 * at the right, the next one showing at the left edge, each settling on its own
 * place. When cards are added at the far end the row stays where the reader is and
 * then moves one card on, to the first of the new ones.
 */
export default function RtlCarousel<T>({ items, keyOf, render, end, inset = 16 }: Props<T>) {
    const [width, setWidth] = useState(0);
    const scroller = useRef<ScrollView>(null);
    const x = useRef(0);
    const content = useRef(0);
    const card = width ? Math.min(width - inset - PEEK, MAX_CARD) : 0;

    const onLayout = (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w && w !== width) setWidth(w);
    };
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => { x.current = e.nativeEvent.contentOffset.x; };
    const onContentSizeChange = (w: number) => {
        const before = content.current;
        content.current = w;
        if (I18nManager.isRTL) return;
        if (!before) {
            // the first card is at the right end: start there
            scroller.current?.scrollToEnd({ animated: false });
            return;
        }
        const grown = w - before;
        if (grown > 0) {
            // the row grew at its left end; what the reader was looking at moved right
            // by as much, and the view follows it there, then shows the first new card
            const kept = x.current + grown;
            scroller.current?.scrollTo({ x: kept, animated: false });
            requestAnimationFrame(() =>
                scroller.current?.scrollTo({ x: Math.max(0, kept - card - GAP), animated: true }));
        }
    };

    return (
        <View onLayout={onLayout} style={styles.wrap}>
            {width > 0 && (
                <ScrollView
                    ref={scroller}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={32}
                    onContentSizeChange={onContentSizeChange}
                    decelerationRate="fast"
                    snapToInterval={WEB ? undefined : card + GAP}
                    style={SNAP_ROW}
                    contentContainerStyle={[styles.row, { flexDirection: ROW, paddingHorizontal: inset }]}
                >
                    {items.map((item) => (
                        <View key={keyOf(item)} style={[{ width: card }, SNAP_ITEM]}>{render(item, card)}</View>
                    ))}
                    {end && <View style={SNAP_ITEM}>{end(card)}</View>}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // the cards run to the screen's edges; the page's own padding is undone around it
    wrap: { width: "100%" },
    row: { gap: GAP, alignItems: "stretch", paddingVertical: 2 },
});
