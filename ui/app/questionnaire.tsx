import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { buildProfile, QUESTIONS, saveProfile, SCALE } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { Group, ListRow, Screen } from "@/site/page";
import { Button } from "@/site/controls";

/**
 * Eight statements, one tap each. The answers place the reader on the same axes
 * the outlets are placed on, and never leave the device.
 */
export default function Questionnaire() {
    const { c, dark } = useSite();
    const { answered } = useQuestionnaire();
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [done, setDone] = useState(false);
    const count = Object.keys(answers).length;

    const finish = async () => {
        const profile = buildProfile(answers);
        await saveProfile(profile);
        answered(profile);
        setDone(true);
    };

    const head = (
        <>
            <Text style={[TYPE.screen, { color: c.brandInk }]} accessibilityRole="header">שאלון העמדות</Text>
            {done ? (
                <View style={[styles.done, { flexDirection: ROW }]}>
                    <Ionicons name="checkmark-circle" size={26} color={c.brandInk} />
                    <Text style={[TYPE.body, { color: c.brandInk, flex: 1 }]}>
                        נשמר. מעכשיו הנקודות העיוורות ידברו על הצד שלכם, והקריאה שלכם תימדד מול העמדות שהצהרתם עליהן.
                    </Text>
                </View>
            ) : (
                <>
                    <Text style={[TYPE.body, { color: c.brandInk, opacity: 0.9 }]}>
                        שמונה היגדים, כדקה. התשובות מאפשרות להשוות בין מה שאתם חושבים לבין מה שאתם קוראים, והן נשארות במכשיר שלכם.
                    </Text>
                    <View style={styles.progress} accessible accessibilityLabel={`${count} מתוך ${QUESTIONS.length} נענו`}>
                        <View style={[styles.track, { backgroundColor: "rgba(255,255,255,0.25)", flexDirection: ROW }]}>
                            <View style={[styles.fill, { backgroundColor: c.brandInk, width: `${(count / QUESTIONS.length) * 100}%` }]} />
                        </View>
                        <Text style={[TYPE.meta, { color: c.brandInk }]}>{count} מתוך {QUESTIONS.length} נענו</Text>
                    </View>
                </>
            )}
        </>
    );

    return (
        <Screen back docTitle="שאלון העמדות" colour={c.brand} tone={dark ? "dark" : "light"} head={head}>
            {done ? (
                <Group>
                    <ListRow icon="person-circle" colour={c.brand} label="הקריאה שלי" href="/me" />
                    <ListRow icon="newspaper" colour="#0E6870" label="לעמוד הראשי" href="/" />
                </Group>
            ) : (
                <>
                    {QUESTIONS.map((q, i) => (
                        <View key={q.topic} style={[styles.q, { backgroundColor: c.card }]}>
                            <Text style={[TYPE.meta, { color: c.muted }]}>{i + 1} מתוך {QUESTIONS.length}</Text>
                            <Text style={[TYPE.title, { color: c.ink }]}>{q.statement}</Text>
                            <View style={[styles.scale, { flexDirection: ROW }]}
                                accessibilityRole="radiogroup" accessibilityLabel={q.statement}>
                                {/* strongly for at the reading edge, strongly against at the far one */}
                                {[...SCALE].reverse().map((s) => {
                                    const on = answers[q.topic] === s.value;
                                    return (
                                        <Pressable key={s.value} onPress={() => setAnswers((a) => ({ ...a, [q.topic]: s.value }))}
                                            accessibilityRole="radio" accessibilityState={{ checked: on }}
                                            style={({ pressed }) => [styles.option, {
                                                backgroundColor: on ? c.brand : pressed ? c.pressed : c.sunk }]}>
                                            <Text style={[TYPE.label, { color: on ? c.brandInk : c.ink, textAlign: "center" }]}>{s.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                    <View style={styles.submit}>
                        <Button wide label={count < QUESTIONS.length ? `שמירה (${count} מתוך ${QUESTIONS.length})` : "שמירה"}
                            onPress={finish} disabled={count < QUESTIONS.length} />
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    done: { alignItems: "center", gap: 10 },
    progress: { gap: 6, marginTop: 4 },
    track: { height: 8, borderRadius: 4, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4 },
    q: { marginHorizontal: 12, marginTop: 12, borderRadius: RADIUS.card, padding: 16, gap: 10 },
    scale: { gap: 5, marginTop: 4 },
    option: { flex: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 2, alignItems: "center", justifyContent: "center", minHeight: 58 },
    submit: { paddingHorizontal: 12, marginTop: 18 },
});
