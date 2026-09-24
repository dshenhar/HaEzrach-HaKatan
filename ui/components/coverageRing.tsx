import { useStillness } from '@/state/access';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const Arc = Animated.createAnimatedComponent(Circle);

/**
 * How a story was covered, as a ring: the share of the outlets that told it from
 * each side, with how many told it at all in the middle.
 *
 * This is the one number in the app that is a plain fact rather than a judgement -
 * four papers on the right and one on the left is not an opinion - which is why it
 * can sit on a closed story where a label could not. A ring all in one colour is a
 * story only one side is telling.
 *
 * It draws itself from twelve o'clock clockwise when it appears, so the split is
 * watched rather than read. The colours are the bloc inks at a fraction of their
 * strength: a feed of these should read as a pattern, not as a wall of red and blue.
 */
const SIZE = 38;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const DRAW_MS = 750;

type Props = { right: number; left: number; rightInk: string; leftInk: string; text: string };

export default function CoverageRing({ right, left, rightInk, leftInk, text }: Props) {
    const total = right + left;
    const rightLen = total ? C * (right / total) : 0;
    const still = useStillness();
    const grown = useSharedValue(still ? 1 : 0);

    useEffect(() => {
        grown.value = still ? 1 : withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) });
    }, [still, total, rightLen]);

    // the right bloc's arc first, then the left carries on where it stopped
    const rightArc = useAnimatedProps(() => ({
        strokeDasharray: [Math.min(grown.value * C, rightLen), C],
    }));
    const leftArc = useAnimatedProps(() => ({
        strokeDasharray: [Math.max(0, grown.value * C - rightLen), C],
    }));

    return (
        <View style={styles.wrap}
            accessibilityLabel={`${total} גופים סיקרו, ${right} מימין ו-${left} משמאל`}>
            <Svg width={SIZE} height={SIZE}>
                {/* rotated so the drawing starts at twelve rather than at three */}
                <Arc
                    cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                    stroke={rightInk} strokeWidth={STROKE} opacity={0.45}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    animatedProps={rightArc}
                />
                <Arc
                    cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                    stroke={leftInk} strokeWidth={STROKE} opacity={0.45}
                    strokeDashoffset={-rightLen}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    animatedProps={leftArc}
                />
            </Svg>
            <Text style={styles.count}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    count: {
        position: "absolute", fontFamily: "Heebo_800ExtraBold", fontSize: 13,
        color: "#111827", includeFontPadding: false,
    },
});
