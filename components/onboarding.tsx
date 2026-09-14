import { QUESTIONS, ReaderProfile, SCALE, buildProfile, saveProfile } from '@/state/profile';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";

type Props = { onDone: (profile: ReaderProfile) => void }

const Onboarding = ({ onDone }: Props) => {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});

    const question = QUESTIONS[step];
    const done = step >= QUESTIONS.length;

    const answer = (value: number) => {
        const next = { ...answers, [question.topic]: value };
        setAnswers(next);
        setStep(step + 1);
    };

    const finish = async () => {
        const profile = buildProfile(answers);
        await saveProfile(profile);
        onDone(profile);
    };

    if (done) {
        const profile = buildProfile(answers);
        const pct = ((profile.overall + 5) / 10) * 100;
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.result}>
                    <Text style={styles.resultKicker}>לפי מה שהצהרת</Text>
                    <Text style={styles.resultTitle}>
                        אתה נוטה {profile.bloc === "right" ? "ימינה" : "שמאלה"}
                    </Text>

                    <View style={styles.scaleBar}>
                        <View style={[styles.scaleMarker, { left: `${pct}%` }]} />
                    </View>
                    <View style={styles.scaleEnds}>
                        <Text style={[styles.scaleEnd, { color: LEFT }]}>שמאל</Text>
                        <Text style={[styles.scaleEnd, { color: RIGHT }]}>ימין</Text>
                    </View>

                    <Text style={styles.resultBody}>
                        לא נשתמש בזה כדי להראות לך יותר ממה שאתה כבר מסכים איתו — ההפך.
                        מכאן נוכל להראות לך כמה מהקריאה שלך נשארת בתוך הגוש שלך, ובאילו
                        נושאים בכלל לא שמעת את הצד השני.
                    </Text>

                    <TouchableOpacity style={styles.primary} onPress={finish}>
                        <Text style={styles.primaryText}>בואו נתחיל</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setStep(0); setAnswers({}); }}>
                        <Text style={styles.secondaryText}>למלא מחדש</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(step / QUESTIONS.length) * 100}%` }]} />
                </View>
                <Text style={styles.counter}>{step + 1} מתוך {QUESTIONS.length}</Text>

                <Text style={styles.intro}>עד כמה אתה מסכים?</Text>
                <Text style={styles.statement}>{question.statement}</Text>

                <View style={styles.options}>
                    {SCALE.map((opt) => (
                        <TouchableOpacity key={opt.value} style={styles.option} onPress={() => answer(opt.value)}>
                            <Text style={styles.optionText}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {step > 0 && (
                    <TouchableOpacity onPress={() => setStep(step - 1)}>
                        <Text style={styles.secondaryText}>חזרה</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default Onboarding;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    scroll: { padding: 22, gap: 14, flexGrow: 1, justifyContent: "center" },

    progressTrack: { height: 4, backgroundColor: "#EEEDEA", borderRadius: 999, overflow: "hidden" },
    progressFill: { height: 4, backgroundColor: "#22C55E" },
    counter: { fontFamily: "Heebo_500Medium", fontSize: 11, color: "#9CA3AF", textAlign: "right" },

    intro: { fontFamily: "Heebo_500Medium", fontSize: 13, color: "#6B7280", textAlign: "right" },
    statement: {
        fontFamily: "Heebo_800ExtraBold", fontSize: 23, lineHeight: 32,
        color: "#111827", textAlign: "right", marginBottom: 8,
    },

    options: { gap: 8 },
    option: {
        borderWidth: 1, borderColor: "#E3E3E1", borderRadius: 12,
        paddingVertical: 13, paddingHorizontal: 16, backgroundColor: "#FAFAF9",
    },
    optionText: { fontFamily: "Heebo_700Bold", fontSize: 14, color: "#111827", textAlign: "right" },

    result: { flex: 1, padding: 22, gap: 12, justifyContent: "center" },
    resultKicker: { fontFamily: "Heebo_500Medium", fontSize: 12, color: "#9CA3AF", textAlign: "right" },
    resultTitle: { fontFamily: "Heebo_800ExtraBold", fontSize: 28, color: "#111827", textAlign: "right" },
    scaleBar: {
        height: 8, borderRadius: 999, marginTop: 10,
        backgroundColor: "#E3E3E1", justifyContent: "center",
    },
    scaleMarker: {
        position: "absolute", width: 16, height: 16, borderRadius: 8,
        backgroundColor: "#111827", marginLeft: -8,
    },
    scaleEnds: { flexDirection: "row", justifyContent: "space-between", direction: "ltr" },
    scaleEnd: { fontFamily: "Heebo_800ExtraBold", fontSize: 12 },
    resultBody: {
        fontFamily: "Heebo_400Regular", fontSize: 14, lineHeight: 22,
        color: "#4B5563", textAlign: "right", marginTop: 8,
    },
    primary: {
        backgroundColor: "#22C55E", borderRadius: 999, paddingVertical: 14,
        alignItems: "center", marginTop: 10,
    },
    primaryText: { fontFamily: "Heebo_800ExtraBold", fontSize: 15, color: "#04310F" },
    secondaryText: {
        fontFamily: "Heebo_500Medium", fontSize: 13, color: "#9CA3AF",
        textAlign: "center", paddingVertical: 10,
    },
});
