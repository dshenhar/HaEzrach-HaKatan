import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { buildProfile, QUESTIONS, saveProfile, SCALE } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { ROW, useSite } from "@/site/tokens";
import { Page, Wrap } from "@/site/page";
import { Button } from "@/site/controls";

/**
 * Eight statements, one tap each. The answers place the reader on the same axes
 * the outlets are placed on, and never leave the device.
 */
export default function Questionnaire() {
    const { c, type, wide } = useSite();
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

    return (
        <Page back title="שאלון העמדות">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">שאלון העמדות</Text>
                    {done ? (
                        <View style={styles.done}>
                            <Text style={[type.dek, { color: c.ink }]}>נשמר. מעכשיו הנקודות העיוורות ידברו על הצד שלכם, והקריאה שלכם תימדד מול העמדות שהצהרתם עליהן.</Text>
                            <View style={[styles.doneLinks, { flexDirection: ROW }]}>
                                <Link href="/me" style={StyleSheet.flatten([type.uiStrong, styles.link, { color: c.ink }])}>הקריאה שלי</Link>
                                <Link href="/" style={StyleSheet.flatten([type.uiStrong, styles.link, { color: c.ink }])}>לעמוד הראשי</Link>
                            </View>
                        </View>
                    ) : (
                        <>
                            <Text style={[type.dek, styles.dek, { color: c.ink2, borderBottomColor: c.ruleStrong }]}>
                                שמונה היגדים, כדקה. התשובות מאפשרות להשוות בין מה שאתם חושבים לבין מה שאתם קוראים, והן נשארות במכשיר שלכם.
                            </Text>
                            {QUESTIONS.map((q, i) => (
                                <View key={q.topic} style={[styles.q, { borderBottomColor: c.rule }]}>
                                    <Text style={[type.meta, { color: c.muted }]}>{i + 1} מתוך {QUESTIONS.length}</Text>
                                    <Text style={[type.major, { color: c.ink }]}>{q.statement}</Text>
                                    <View style={[styles.scale, { flexDirection: ROW }]}
                                        accessibilityRole="radiogroup" accessibilityLabel={q.statement}>
                                        {/* strongly for at the reading edge, strongly against at the far one */}
                                        {[...SCALE].reverse().map((s) => {
                                            const on = answers[q.topic] === s.value;
                                            return (
                                                <Pressable key={s.value} onPress={() => setAnswers((a) => ({ ...a, [q.topic]: s.value }))}
                                                    accessibilityRole="radio" accessibilityState={{ checked: on }}
                                                    style={({ hovered }: any) => [styles.option, { borderColor: on ? c.ink : c.rule,
                                                        backgroundColor: on ? c.ink : hovered ? c.pressed : c.paper }]}>
                                                    <Text style={[type.uiStrong, { color: on ? c.paper : c.ink, textAlign: "center" }]}>
                                                        {wide ? s.label.replace("\n", " ") : s.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                            <View style={[styles.submit, { flexDirection: ROW }]}>
                                <Button label="שמירה" onPress={finish} disabled={count < QUESTIONS.length} />
                                <Text style={[type.meta, { color: c.muted }]}>{count} מתוך {QUESTIONS.length} נענו</Text>
                            </View>
                        </>
                    )}
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    column: { maxWidth: 760, width: "100%", alignSelf: "center", gap: 14 },
    dek: { borderBottomWidth: 3, paddingBottom: 18 },
    q: { gap: 10, paddingVertical: 18, borderBottomWidth: 1 },
    scale: { gap: 4, marginTop: 4 },
    option: { flex: 1, borderWidth: 1.5, paddingVertical: 9, paddingHorizontal: 2, alignItems: "center", justifyContent: "center", minHeight: 58 },
    submit: { alignItems: "center", gap: 16, marginTop: 8 },
    done: { gap: 18, paddingTop: 6 },
    doneLinks: { gap: 24 },
    link: { textDecorationLine: "underline" },
});
