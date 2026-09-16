import { useTheme } from '@/state/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GuideBackdrop from './guideBackdrop';

const TV = require('../assets/images/welcome-tv.png');
const TV_RATIO = 1000 / 721;

export const WELCOME = {
    title: 'ברוכים הבאים!',
    body: [
        'בישראל של 2026 העם מקוטב. הכל פוליטי, וכל מחנה רואה מציאות אחרת — ולכן גם החדשות שכל מחנה קורא שונות, ובעיקר מהדהדות לנו את מה שאנחנו כבר חושבים או רוצים לשמוע.',
        'בחדשות האזרח הקטן אנחנו מביאים לכם את כל החדשות, בכל שעה ביום — גם את אלה שאתם לא רגילים לקרוא. כן, גם של המחנה השני!',
    ],
};

const MARGIN = 14;
const TAIL = 18;
/** the set hangs just under the header row, so the logo stays in view */
const HEADER_ROW = 52;
/** what the bubble underneath needs, which caps how big the set can be */
const BUBBLE_ROOM = 270;

type Props = { onDone: () => void };

/**
 * The welcome: the anchor's television drops in from the top of the screen with
 * the explanation in a bubble underneath. Like the mode guides, it stays until the
 * reader touches the screen.
 */
export default function WelcomeGuide({ onDone }: Props) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const [area, setArea] = useState<{ w: number; h: number } | null>(null);
    const enter = useRef(new Animated.Value(0)).current;
    const pop = useRef(new Animated.Value(0)).current;
    const leave = useRef(new Animated.Value(0)).current;
    const leaving = useRef(false);

    const dismiss = () => {
        if (leaving.current) return;
        leaving.current = true;
        Animated.timing(leave, {
            toValue: 1,
            duration: 350,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => onDone());
    };

    const measured = area !== null;
    useEffect(() => {
        if (!measured) return;
        Animated.sequence([
            Animated.timing(enter, {
                toValue: 1,
                duration: 600,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
            Animated.timing(pop, {
                toValue: 1,
                duration: 260,
                easing: Easing.out(Easing.back(1.6)),
                useNativeDriver: true,
            }),
        ]).start();
    }, [measured]);

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (!area || area.w !== width || area.h !== height) setArea({ w: width, h: height });
    };

    if (!area) return <View style={styles.overlay} onLayout={onLayout} />;

    const top = insets.top + HEADER_ROW;
    const tvW = Math.max(180, Math.min(area.w * 0.8, 380, (area.h - top - BUBBLE_ROOM) * TV_RATIO));
    const tvH = tvW / TV_RATIO;
    // the tail is a square turned 45deg, so it reaches TAIL * 0.7 above the bubble
    const bubbleTop = top + tvH + TAIL * 0.7 + 6;
    const tailLeft = area.w / 2 - MARGIN - TAIL / 2;

    const fadeOut = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    // the set and the blur behind it fade in and out together
    const backdrop = Animated.multiply(
        enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        fadeOut,
    );

    return (
        <Pressable
            style={styles.overlay}
            onLayout={onLayout}
            // react-native-web holds onPressIn back a moment and, for a quick tap, only
            // fires it when onPress is set too
            onPressIn={dismiss}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="סגירת ההסבר"
        >
            <GuideBackdrop opacity={backdrop} />
            <Animated.View
                style={{
                    position: 'absolute',
                    top,
                    left: (area.w - tvW) / 2,
                    width: tvW,
                    height: tvH,
                    opacity: backdrop,
                    transform: [{
                        // drops from above the top edge of the screen
                        translateY: Animated.add(
                            enter.interpolate({ inputRange: [0, 1], outputRange: [-(top + tvH), 0] }),
                            leave.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }),
                        ),
                    }],
                }}
            >
                <Image source={TV} style={styles.fill} resizeMode="contain" />
            </Animated.View>

            <Animated.View
                style={{
                    position: 'absolute',
                    top: bubbleTop,
                    left: MARGIN,
                    right: MARGIN,
                    opacity: Animated.multiply(
                        pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                        fadeOut,
                    ),
                    transform: [
                        { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                        { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                    ],
                }}
            >
                <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.line }]}>
                    <Text style={[styles.title, { color: t.text }]}>{WELCOME.title}</Text>
                    {WELCOME.body.map((paragraph) => (
                        <Text key={paragraph} style={[styles.body, { color: t.textMuted }]}>{paragraph}</Text>
                    ))}
                </View>
                <View
                    style={[styles.tail, { left: tailLeft, backgroundColor: t.surface, borderColor: t.line }]}
                />
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    fill: { width: '100%', height: '100%' },
    bubble: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 15,
        gap: 8,
        boxShadow: '0 6px 22px rgba(0,0,0,0.14)',
    },
    title: { fontFamily: 'Heebo_800ExtraBold', fontSize: 20, textAlign: 'right' },
    body: { fontFamily: 'Heebo_400Regular', fontSize: 13.5, lineHeight: 20, textAlign: 'right' },
    // a square turned 45deg, bordered on the two sides that show above the bubble
    tail: {
        position: 'absolute',
        top: -TAIL / 2,
        width: TAIL,
        height: TAIL,
        borderLeftWidth: 1,
        borderTopWidth: 1,
        transform: [{ rotate: '45deg' }],
    },
});
