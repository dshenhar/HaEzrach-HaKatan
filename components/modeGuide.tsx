import { useTheme } from '@/state/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { EXPLAIN, ViewMode } from './viewModeToggle';

// Each guide leans in from its own side of the feed: the man from the right for the
// bloc view, the woman from the left for the citizen view. The pictures are cut flat
// on that side, so they read as stepping out of the edge of the screen. tipX/tipY
// locate the pointing fingertip inside each picture, where the bubble's tail goes;
// headFrom/headTo is the band the head covers, which the bubble keeps clear of.
const GUIDES = {
    bloc: {
        image: require('../assets/images/guide-bloc.png'), ratio: 708 / 1200,
        tipX: 0.008, tipY: 0.359, headFrom: 0.54, headTo: 1, side: 'right',
    },
    citizen: {
        image: require('../assets/images/guide-citizen.png'), ratio: 710 / 1200,
        tipX: 0.99, tipY: 0.361, headFrom: 0, headTo: 0.494, side: 'left',
    },
} as const;

/** the picture sits this far past the screen edge, so the pop's overshoot never shows its cut */
const TUCK = 28;
const MARGIN = 14;
const TAIL = 18;
/** narrower than this the text gets hard to read, so the bubble may cover the head instead */
const MIN_BUBBLE = 220;

type Props = { mode: ViewMode; onDone: () => void };

export default function ModeGuide({ mode, onDone }: Props) {
    const t = useTheme();
    const guide = GUIDES[mode];
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

    // starts once the overlay knows its size, since every position depends on it
    const measured = area !== null;
    useEffect(() => {
        if (!measured) return;
        Animated.sequence([
            Animated.timing(enter, {
                toValue: 1,
                duration: 520,
                easing: Easing.out(Easing.back(1.3)),
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

    const imgH = Math.min(area.h * 0.8, area.w * 1.15);
    const imgW = imgH * guide.ratio;
    const imgLeft = guide.side === 'right' ? area.w - imgW + TUCK : -TUCK;
    // the picture stands on the bottom of the feed, right above the tab bar
    const tipX = imgLeft + guide.tipX * imgW;
    const tipY = area.h - imgH + guide.tipY * imgH;

    // the bubble keeps to the side the guide points at, clear of the face
    let bubbleLeft = MARGIN;
    let bubbleRight = area.w - MARGIN;
    if (guide.side === 'right') {
        bubbleRight = Math.min(bubbleRight, Math.max(imgLeft + guide.headFrom * imgW - 10, MARGIN + MIN_BUBBLE));
    } else {
        bubbleLeft = Math.max(bubbleLeft, Math.min(imgLeft + guide.headTo * imgW + 10, area.w - MARGIN - MIN_BUBBLE));
    }
    const bubbleWidth = bubbleRight - bubbleLeft;
    const tailLeft = Math.min(Math.max(tipX - bubbleLeft - TAIL / 2, 18), bubbleWidth - 18 - TAIL);
    // the tail is a square turned 45deg, so it reaches TAIL * 0.7 below the bubble
    const bubbleBottom = area.h - tipY + TAIL * 0.7 + 6;

    const offscreen = guide.side === 'right' ? imgW : -imgW;
    const fadeOut = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

    return (
        // the guide stays until the reader is done with it: any touch on the screen sends it away
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
            <Animated.View
                style={{
                    position: 'absolute',
                    left: imgLeft,
                    bottom: 0,
                    width: imgW,
                    height: imgH,
                    opacity: fadeOut,
                    transform: [{
                        translateX: Animated.add(
                            enter.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] }),
                            leave.interpolate({ inputRange: [0, 1], outputRange: [0, offscreen * 0.25] }),
                        ),
                    }],
                }}
            >
                <Image source={guide.image} style={styles.fill} resizeMode="contain" />
            </Animated.View>

            <Animated.View
                style={{
                    position: 'absolute',
                    left: bubbleLeft,
                    width: bubbleWidth,
                    bottom: bubbleBottom,
                    opacity: Animated.multiply(
                        pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                        fadeOut,
                    ),
                    transform: [
                        { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                        { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                    ],
                }}
            >
                <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.line }]}>
                    <Text style={[styles.title, { color: t.text }]}>{EXPLAIN[mode].title}</Text>
                    <Text style={[styles.body, { color: t.textMuted }]}>{EXPLAIN[mode].body}</Text>
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
        paddingHorizontal: 16,
        paddingVertical: 13,
        gap: 4,
        boxShadow: '0 6px 22px rgba(0,0,0,0.14)',
    },
    title: { fontFamily: 'Heebo_800ExtraBold', fontSize: 16, textAlign: 'right' },
    body: { fontFamily: 'Heebo_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'right' },
    // a square turned 45deg, bordered on the two sides that show below the bubble
    tail: {
        position: 'absolute',
        bottom: -TAIL / 2,
        width: TAIL,
        height: TAIL,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        transform: [{ rotate: '45deg' }],
    },
});
