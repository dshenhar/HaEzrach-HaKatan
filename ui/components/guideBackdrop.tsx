import { useTheme } from '@/state/theme';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/** how much clear room the toggle is given above and below itself */
const HALO = 7;

type Props = {
    opacity: Animated.WithAnimatedValue<number>;
    /** a band across the screen the blur leaves alone, in the overlay's own space */
    hole?: { y: number; h: number } | null;
};

/**
 * Blurs the feed behind a guide. The stories stay recognisable underneath, so it
 * still reads as the same screen, but the picture and its bubble are what the eye
 * lands on. Fades with the guide through the opacity it is given.
 *
 * The guides talk about the toggle, and the toggle switches under them as the tour
 * moves from one to the other - which was happening behind frosted glass. So the
 * blur is cut into two panes with the toggle's own band left clear between them:
 * everything the guide is not talking about goes soft, and the one thing it is
 * talking about is the one thing in focus.
 */
export default function GuideBackdrop({ opacity, hole }: Props) {
    const t = useTheme();
    const tint = t.name === 'negative' ? 'dark' : 'light';

    if (!hole) {
        return (
            <Animated.View style={[styles.fill, { opacity }]}>
                <BlurView intensity={35} tint={tint} style={styles.fill} />
            </Animated.View>
        );
    }

    const above = Math.max(0, hole.y - HALO);
    return (
        <Animated.View style={[styles.fill, { opacity }]}>
            <BlurView intensity={35} tint={tint} style={[styles.pane, { top: 0, height: above }]} />
            <BlurView intensity={35} tint={tint}
                style={[styles.pane, { top: above + hole.h + HALO * 2, bottom: 0 }]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    pane: { position: 'absolute', right: 0, left: 0 },
});
