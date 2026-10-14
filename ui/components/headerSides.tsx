import { civilDate, hebrewDate, isNight, useMinute, useWeather, weatherIcon } from '@/state/today';
import { useTheme } from '@/state/theme';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

// Each side keeps to its own edge whatever direction the app runs in: the date to
// the right of the logo, flush right, and the weather to its left, flush left.
const LTR = { direction: "ltr" } as const;
/** narrower than this the two sides' words get smaller rather than cut; narrower
 *  than TINY, a 320 point phone, a long Hebrew date ("כ״ב אדר א׳ ה׳תשפ״ז") breaks
 *  over two lines */
const NARROW = 380;
const TINY = 340;

type Props = { ink: string };

/** the day, by the civil calendar and the Hebrew: "15.10.2026" over "ג׳ חשוון ה׳תשפ״ז" */
export function TodayDate({ ink }: Props) {
    const t = useTheme();
    const now = useMinute();
    const width = useWindowDimensions().width;
    const small = width < NARROW;
    const hebrew = hebrewDate(now);
    return (
        <View style={[styles.side, LTR, styles.right]}>
            <Text style={[styles.top, small && styles.topSmall, { color: ink }]} numberOfLines={1}>{civilDate(now)}</Text>
            {!!hebrew && (
                <Text style={[styles.bottom, small && styles.bottomSmall, styles.alignRight, { color: t.textMuted }]}
                    numberOfLines={width < TINY ? 2 : 1}>{hebrew}</Text>
            )}
        </View>
    );
}

/** the city and its weather: "ירושלים" over "22°C 🌙"; only the city until the weather comes */
export function WeatherNow({ ink }: Props) {
    const t = useTheme();
    const now = useMinute();
    const weather = useWeather();
    const small = useWindowDimensions().width < NARROW;
    const night = isNight(now);
    const degrees = weather ? Math.round(weather.temp) || 0 : null;
    const icon = weather ? weatherIcon(weather.symbol, night) : null;
    return (
        <View style={[styles.side, LTR, styles.left]}
            accessible accessibilityLabel={degrees === null ? "ירושלים" : `ירושלים, ${degrees} מעלות`}>
            <Text style={[styles.top, small && styles.topSmall, styles.alignLeft, { color: ink }]} numberOfLines={1}>
                {weather?.city ?? "ירושלים"}
            </Text>
            {degrees !== null && (
                // the number then the picture, left to right, as it is read
                <View style={[styles.weatherRow, LTR]}>
                    <Text style={[styles.bottom, small && styles.bottomSmall, { color: t.textMuted }]}>{`${degrees}°C`}</Text>
                    <Text style={[styles.icon, small && styles.bottomSmall]}>{icon}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // each side takes half of what the logo leaves, so the logo stays in the middle
    side: { flex: 1, minWidth: 0, gap: 1 },
    right: { alignItems: "flex-end" },
    left: { alignItems: "flex-start" },
    top: { fontFamily: "Rubik_700Bold", fontSize: 12.5, lineHeight: 16, letterSpacing: 0.1 },
    topSmall: { fontSize: 11, lineHeight: 14 },
    bottom: { fontFamily: "Rubik_500Medium", fontSize: 11.5, lineHeight: 15, letterSpacing: 0.05 },
    bottomSmall: { fontSize: 10, lineHeight: 13 },
    alignRight: { textAlign: "right" },
    alignLeft: { textAlign: "left" },
    weatherRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    icon: { fontSize: 12, lineHeight: 15 },
});
