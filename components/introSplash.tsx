import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

const LOGO = require("../assets/images/logo-ink.png");
const CROWD = require("../assets/images/parlament.png");
const LOGO_RATIO = 600 / 186;
const CROWD_RATIO = 1200 / 604;

/** how long the logo and the crowd stand still before the app comes in */
const HOLD_MS = 3000;
const LEAVE_MS = 900;

/**
 * The opening card: logo over the crowd on white. When it leaves, the logo rises
 * and the crowd sinks as both fade, and the white fades out a beat behind them so
 * the app underneath comes in through it.
 */
export default function IntroSplash({ onDone }: { onDone: () => void }) {
    const { width, height } = useWindowDimensions();
    // the web build draws the app inside a 420px phone frame
    const frame = Math.min(width, 420);
    const logoWidth = Math.round(frame * 0.6);
    const crowdWidth = Math.round(frame * 0.86);
    const leave = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = Animated.sequence([
            Animated.delay(HOLD_MS),
            Animated.timing(leave, {
                toValue: 1,
                duration: LEAVE_MS,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
        ]);
        anim.start(({ finished }) => { if (finished) onDone(); });
        return () => anim.stop();
    }, []);

    const drift = height * 0.3;
    const artOpacity = leave.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0], extrapolate: "clamp" });
    const groundOpacity = leave.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0] });

    return (
        <View style={styles.overlay}>
            <Animated.View style={[styles.ground, { opacity: groundOpacity }]} />
            <View style={styles.stack}>
                <Animated.Image
                    source={LOGO}
                    resizeMode="contain"
                    accessibilityLabel="חדשות האזרח הקטן"
                    style={{
                        width: logoWidth,
                        height: logoWidth / LOGO_RATIO,
                        opacity: artOpacity,
                        transform: [{ translateY: leave.interpolate({ inputRange: [0, 1], outputRange: [0, -drift] }) }],
                    }}
                />
                <Animated.Image
                    source={CROWD}
                    resizeMode="contain"
                    style={{
                        width: crowdWidth,
                        height: crowdWidth / CROWD_RATIO,
                        opacity: artOpacity,
                        transform: [{ translateY: leave.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) }],
                    }}
                />
            </View>
        </View>
    );
}

// spelled out: StyleSheet.absoluteFillObject is gone from this React Native
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
    overlay: { ...FILL, zIndex: 100 },
    ground: { ...FILL, backgroundColor: "#FFFFFF" },
    stack: {
        ...FILL,
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
    },
});
