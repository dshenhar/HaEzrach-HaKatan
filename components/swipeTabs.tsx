import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// left to right, the order the tab bar shows them
const TABS = ["/mapPage", "/", "/analyticsPage"] as const;

const DISTANCE = 60;   // px before a drag counts as a page turn
const SLOP = 70;       // a mostly-vertical drag is a scroll, not a swipe

/**
 * Wraps a tab screen so a horizontal drag moves to the neighbouring tab.
 * expo-router's Tabs has no swipe of its own, and swapping in a pager would mean
 * rebuilding the navigator - this keeps the existing structure and adds the
 * gesture on top. Dragging left brings in the tab on the right, and the reverse -
 * the page moves with the finger rather than the selection moving against it.
 */
const SwipeTabs = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const segments = useSegments();

    const go = (delta: number) => {
        const last = String(segments[segments.length - 1] ?? "");
        // the feed route is the group's index, so its segment is the group itself
        const current = last === "(tabs)" || last === "index" || last === "" ? "/" : `/${last}`;
        const i = (TABS as readonly string[]).indexOf(current);
        if (i === -1) return;
        const next = TABS[i + delta];
        if (next) router.replace(next);
    };

    const pan = Gesture.Pan()
        // let vertical scrolling win: only claim the gesture once it is clearly sideways
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
            if (Math.abs(e.translationY) > SLOP) return;
            // a page turn, not a nudge: dragging left pulls the page on the right
            // into view, the way a carousel behaves
            if (e.translationX <= -DISTANCE) go(1);        // dragging left
            else if (e.translationX >= DISTANCE) go(-1);   // dragging right
        })
        .runOnJS(true);

    // the web build is a phone-width column in a desktop window; a drag there is
    // a text selection, not a page turn
    if (Platform.OS === "web") return <>{children}</>;

    return (
        <GestureDetector gesture={pan}>
            <View style={styles.fill}>{children}</View>
        </GestureDetector>
    );
};

export default SwipeTabs;

const styles = StyleSheet.create({ fill: { flex: 1 } });
