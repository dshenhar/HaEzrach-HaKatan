import { useTheme } from '@/state/theme';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = { opacity: Animated.WithAnimatedValue<number> };

/**
 * Blurs the feed behind a guide. The stories stay recognisable underneath, so it
 * still reads as the same screen, but the picture and its bubble are what the eye
 * lands on. Fades with the guide through the opacity it is given.
 */
export default function GuideBackdrop({ opacity }: Props) {
    const t = useTheme();
    return (
        <Animated.View style={[styles.fill, { opacity }]}>
            <BlurView intensity={35} tint={t.name === 'negative' ? 'dark' : 'light'} style={styles.fill} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
