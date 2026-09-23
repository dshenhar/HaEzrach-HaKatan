import { clearProfile, ReaderProfile } from '@/state/profile';
import { getLearningStats, hasValidDevCode, LearningStats, unlockDevMode } from '@/state/engagement';
import { useTheme, useThemeControl } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import Modal from 'react-native-modal';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
    open: boolean;
    onClose: () => void;
    profile: ReaderProfile | null;
    onRetakeQuestionnaire: () => void;
}

const PersonalArea = ({ open, onClose, profile, onRetakeQuestionnaire }: Props) => {
    const t = useTheme();
    const { setThemeName, devMode, setDevMode } = useThemeControl();
    const negative = t.name === "negative";
    const [stats, setStats] = React.useState<LearningStats | null>(null);
    // dev mode changes the feed for everyone, so turning it on takes a code
    const [askingCode, setAskingCode] = React.useState(false);
    const [code, setCode] = React.useState("");
    const [codeWrong, setCodeWrong] = React.useState(false);
    const [checking, setChecking] = React.useState(false);

    const toggleDev = async (on: boolean) => {
        if (!on) {
            setDevMode(false);
            setAskingCode(false);
            return;
        }
        if (await hasValidDevCode()) setDevMode(true);
        else setAskingCode(true);
    };

    const submitCode = async () => {
        if (!code.trim() || checking) return;
        setChecking(true);
        const ok = await unlockDevMode(code);
        setChecking(false);
        if (!ok) {
            setCodeWrong(true);
            return;
        }
        setDevMode(true);
        setAskingCode(false);
        setCode("");
        setCodeWrong(false);
    };

    React.useEffect(() => {
        if (open && devMode) getLearningStats().then(setStats);
    }, [open, devMode]);

    const retake = async () => {
        await clearProfile();
        onClose();
        onRetakeQuestionnaire();
    };

    return (
        <Modal
            isVisible={open}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            style={styles.modal}
            backdropOpacity={0.45}
            avoidKeyboard
        >
            <View style={[styles.sheet, { backgroundColor: t.surface }]}>
                <View style={[styles.grabber, { backgroundColor: t.line }]} />

                <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                    <View style={styles.head}>
                        <Ionicons name="person-circle-outline" size={44} color={t.text} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: t.text }]}>האזור האישי</Text>
                            {profile && (
                                <Text style={[styles.sub, { color: t.textMuted }]}>
                                    נוטה {profile.bloc === "right" ? "ימינה" : "שמאלה"} · ציון {profile.overall}
                                </Text>
                            )}
                        </View>
                    </View>

                    <Text style={[styles.section, { color: t.textMuted }]}>תצוגה</Text>
                    <View style={[styles.row, { backgroundColor: t.surfaceAlt }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, { color: t.text }]}>מצב נגטיב</Text>
                            <Text style={[styles.rowNote, { color: t.textMuted }]}>
                                רקע כהה, והצבעים של הגושים מתבהרים כדי להישאר קריאים
                            </Text>
                        </View>
                        <Switch
                            value={negative}
                            onValueChange={(v) => setThemeName(v ? "negative" : "light")}
                            trackColor={{ true: t.brand, false: "#D7D6D2" }}
                        />
                    </View>

                    <View style={[styles.row, { backgroundColor: t.surfaceAlt }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, { color: t.text }]}>מצב פיתוח</Text>
                            <Text style={[styles.rowNote, { color: t.textMuted }]}>
                                תיקון שיוך לנושא ואיחוד אייטמים. כל תיקון נשמר כדוגמה והמודל
                                משתמש בה בשיוכים הבאים
                            </Text>
                        </View>
                        <Switch
                            value={devMode || askingCode}
                            onValueChange={toggleDev}
                            trackColor={{ true: t.brand, false: "#D7D6D2" }}
                        />
                    </View>

                    {askingCode && !devMode && (
                        <View style={[styles.codeRow, { backgroundColor: t.surfaceAlt }]}>
                            <Text style={[styles.rowNote, { color: codeWrong ? t.right : t.textMuted }]}>
                                {codeWrong ? "הקוד לא התקבל. נסה שוב" : "מצב פיתוח משנה את הפיד לכולם, ולכן צריך קוד"}
                            </Text>
                            <View style={styles.codeLine}>
                                <TextInput
                                    value={code}
                                    onChangeText={(v) => { setCode(v); setCodeWrong(false); }}
                                    onSubmitEditing={submitCode}
                                    placeholder="קוד פיתוח"
                                    placeholderTextColor={t.textMuted}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                    style={[styles.codeInput, {
                                        color: t.text,
                                        backgroundColor: t.surface,
                                        borderColor: codeWrong ? t.right : t.line,
                                    }]}
                                />
                                <TouchableOpacity
                                    onPress={submitCode}
                                    disabled={checking || !code.trim()}
                                    style={[styles.codeButton, {
                                        backgroundColor: t.brand,
                                        opacity: checking || !code.trim() ? 0.5 : 1,
                                    }]}
                                >
                                    <Text style={[styles.codeButtonText, { color: t.brandInk }]}>
                                        {checking ? "בודק…" : "אישור"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {devMode && stats && (
                        <View style={[styles.row, { backgroundColor: t.surfaceAlt }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.rowTitle, { color: t.text }]}>מה לימדת עד עכשיו</Text>
                                <Text style={[styles.rowNote, { color: t.textMuted }]}>
                                    {stats.topic_corrections} תיקוני נושא · {stats.cluster_merges} איחודים
                                    {stats.lowest_merged_similarity !== null
                                        ? ` · הדמיון הנמוך ביותר שאיחדת: ${stats.lowest_merged_similarity.toFixed(2)}`
                                        : ""}
                                </Text>
                            </View>
                        </View>
                    )}

                    <Text style={[styles.section, { color: t.textMuted }]}>העמדות שלי</Text>
                    <TouchableOpacity style={[styles.row, { backgroundColor: t.surfaceAlt }]} onPress={retake}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, { color: t.text }]}>למלא מחדש את השאלון</Text>
                            <Text style={[styles.rowNote, { color: t.textMuted }]}>
                                כל הסטטיסטיקות נמדדות מול העמדות שהצהרת עליהן
                            </Text>
                        </View>
                        <Ionicons name="chevron-back" size={18} color={t.textMuted} />
                    </TouchableOpacity>

                    {profile && (
                        <View style={[styles.positions, { borderColor: t.line }]}>
                            {Object.entries(profile.positions).map(([topic, score]) => (
                                <View key={topic} style={[styles.posRow, { borderBottomColor: t.line }]}>
                                    <Text style={[styles.posTopic, { color: t.text }]}>{topic}</Text>
                                    <Text style={[styles.posScore, {
                                        color: score >= 0 ? t.right : t.left,
                                    }]}>
                                        {score > 0 ? "+" : ""}{score}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity onPress={onClose}>
                        <Text style={[styles.close, { color: t.textMuted }]}>סגירה</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
};

export default PersonalArea;

const styles = StyleSheet.create({
    modal: { justifyContent: "flex-end", margin: 0 },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "86%", paddingTop: 8 },
    grabber: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 6 },
    body: { padding: 18, gap: 10, paddingBottom: 32 },

    head: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 6 },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 22, textAlign: "right" },
    sub: { fontFamily: "Heebo_500Medium", fontSize: 12, textAlign: "right" },

    section: { fontFamily: "Heebo_700Bold", fontSize: 11, letterSpacing: 0.6, textAlign: "right", marginTop: 8 },
    row: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderRadius: 12, padding: 13 },
    rowTitle: { fontFamily: "Heebo_700Bold", fontSize: 14, textAlign: "right" },
    rowNote: { fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 17, textAlign: "right", marginTop: 2 },

    codeRow: { borderRadius: 12, padding: 13, gap: 8 },
    codeLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    codeInput: {
        flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
        fontFamily: "Heebo_500Medium", fontSize: 14, textAlign: "right",
    },
    codeButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    codeButtonText: { fontFamily: "Heebo_700Bold", fontSize: 14 },

    positions: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13 },
    posRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    posTopic: { fontFamily: "Heebo_400Regular", fontSize: 13, flex: 1, textAlign: "right" },
    posScore: { fontFamily: "Heebo_800ExtraBold", fontSize: 12 },

    close: { fontFamily: "Heebo_500Medium", fontSize: 13, textAlign: "center", paddingVertical: 14 },
});
