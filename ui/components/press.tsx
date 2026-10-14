import { useStillness } from '@/state/access';
import { PRESS_MS, PRESS_SCALE } from '@/state/craft';
import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = PressableProps & {
    style?: StyleProp<ViewStyle>;
    /** how far it gives; a large surface should move less than a small one */
    scale?: number;
    children?: React.ReactNode;
};

/**
 * Anything you can touch, that answers the moment you touch it.
 *
 * The feedback is on the press and not on the release. Waiting for the tap to
 * complete before showing anything is the difference between an interface that
 * feels direct and one that feels like it is thinking about it - the delay is
 * small and the loss is not.
 *
 * It is a timing curve rather than a spring on purpose: this is not a gesture
 * anyone can grab mid-flight, it is a light that comes on. 110ms is below the
 * threshold where a press feels acknowledged late.
 *
 * The look is on the inner view, which is the one that gives; how it shares its
 * row with what stands beside it - flex, alignSelf - is on the outer one as well,
 * which is the one its row lays out.
 */
export default function Press({ style, scale = PRESS_SCALE, children, ...rest }: Props) {
    const still = useStillness();
    const give = useSharedValue(1);
    const squash = useAnimatedStyle(() => ({ transform: [{ scale: give.value }] }));

    const to = (value: number) => {
        give.value = still ? 1 : withTiming(value, {
            duration: PRESS_MS,
            easing: Easing.out(Easing.quad),
        });
    };

    const { flex, flexGrow, flexShrink, flexBasis, alignSelf }: ViewStyle =
        StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {};

    return (
        <Pressable
            {...rest}
            style={{ flex, flexGrow, flexShrink, flexBasis, alignSelf }}
            onPressIn={(e) => { to(scale); rest.onPressIn?.(e); }}
            onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
        >
            <Animated.View style={[style, squash]}>{children}</Animated.View>
        </Pressable>
    );
}
