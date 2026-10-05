import { useConsent } from '@/state/consent';
import { useStillness } from '@/state/access';
import { useTheme } from '@/state/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

/**
 * The one thing the app asks for before it takes it.
 *
 * It sits at the foot of the feed rather than over it: the reader can read the
 * news without answering, and nothing is measured while they decide. Both answers
 * are buttons of the same size - a banner where "no" is a grey word under the
 * fold is a banner that is counting on nobody finding it.
 */
export default function ConsentBanner() {
    const { consent, answer } = useConsent();
    const t = useTheme();
    const router = useRouter();
    const still = useStillness();

    if (consent !== "unasked") return null;

    return (
        <Animated.View
            entering={still ? undefined : FadeInDown.duration(320).delay(1200)}
            style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.line }]}
        >
            <Text style={[styles.body, { color: t.text }]}>
                אפשר למדוד איך אתם משתמשים באפליקציה? זה עוזר לנו לדעת מה עובד — למשל אם
                קוראים באמת חוצים את המפה. המדידה מזהה את המכשיר, לא אתכם, ואין פרסום.
            </Text>
            <TouchableOpacity onPress={() => router.push("/privacy")} accessibilityRole="link">
                <Text style={[styles.more, { color: t.textMuted }]}>מה בדיוק נאסף</Text>
            </TouchableOpacity>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.button, { borderColor: t.line }]}
                    onPress={() => answer("no")}
                    accessibilityRole="button"
                >
                    <Text style={[styles.buttonText, { color: t.text }]}>לא, תודה</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: t.text, borderColor: t.text }]}
                    onPress={() => answer("yes")}
                    accessibilityRole="button"
                >
                    <Text style={[styles.buttonText, { color: t.surface }]}>אפשר</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: "absolute", left: 10, right: 10, bottom: 78,
        borderRadius: 12, borderWidth: 1, padding: 13, gap: 8, zIndex: 40,
        boxShadow: "0 6px 20px rgba(17,24,39,0.18)",
    },
    body: { fontFamily: "Heebo_400Regular", fontSize: 12.5, lineHeight: 19, textAlign: "right" },
    more: {
        fontFamily: "Heebo_500Medium", fontSize: 11.5, textAlign: "right",
        textDecorationLine: "underline",
    },
    // row-reverse: the agreement sits where a Hebrew reader's thumb starts
    row: { flexDirection: "row-reverse", gap: 8, marginTop: 2 },
    button: {
        flex: 1, borderWidth: 1, borderRadius: 999,
        paddingVertical: 10, alignItems: "center",
    },
    buttonText: { fontFamily: "Heebo_700Bold", fontSize: 12.5 },
});
