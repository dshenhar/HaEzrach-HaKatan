import { useTheme } from '@/state/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * The last card of the tour, shown only to a reader who has not answered the
 * questionnaire. It sits on the same blurred backdrop the guides use.
 */
type Props = { onFill: () => void; onSkip: () => void };

export default function TourQuestionnaire({ onFill, onSkip }: Props) {
    const t = useTheme();
    return (
        <View style={styles.wrap}>
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[styles.title, { color: t.text }]}>ודבר אחרון</Text>
                <Text style={[styles.body, { color: t.textMuted }]}>
                    שאלון עמדות קצר מאפשר לאפליקציה להשוות בין מה שאתם חושבים לבין מה שאתם קוראים
                    בפועל, ולהראות לכם כמה מהיום הגיע דווקא מהצד השני. התשובות נשארות במכשיר שלכם.
                </Text>
                <TouchableOpacity style={[styles.primary, { backgroundColor: t.select }]}
                    onPress={onFill} accessibilityRole="button">
                    <Text style={[styles.primaryText, { color: t.selectInk }]}>למילוי השאלון</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSkip} accessibilityRole="button">
                    <Text style={[styles.skip, { color: t.textMuted }]}>אחר כך</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
        alignItems: "center", justifyContent: "center", padding: 22 },
    card: { width: "100%", maxWidth: 340, borderRadius: 18, borderWidth: 1, padding: 20, gap: 10,
        boxShadow: "0 8px 26px rgba(0,0,0,0.22)" },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 20, textAlign: "right" },
    body: { fontFamily: "Heebo_400Regular", fontSize: 13.5, lineHeight: 20, textAlign: "right" },
    primary: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 6 },
    primaryText: { fontFamily: "Heebo_800ExtraBold", fontSize: 15 },
    skip: { fontFamily: "Heebo_500Medium", fontSize: 13, textAlign: "center", paddingTop: 4 },
});
