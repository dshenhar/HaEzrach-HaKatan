import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { buildInsights, Insights } from "@/state/insights";
import { clearProfile } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { forgetMe, hasValidDevCode, unlockDevMode } from "@/state/engagement";
import { useConsent } from "@/state/consent";
import { useThemeControl } from "@/state/theme";
import { track } from "@/state/analytics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Page, SectionHead, Wrap } from "@/site/page";
import { Button, Skeleton } from "@/site/controls";
import Meter from "@/site/meter";

/**
 * The reader's own page: what they have read against where they said they
 * stand, and the few settings the site has. Everything here is worked out on
 * this device, from what is kept on it.
 */
export default function Me() {
    const { c, type, wide } = useSite();
    const { profile } = useQuestionnaire();
    const { readings, positions } = useNews();
    const [insights, setInsights] = useState<Insights | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!profile) return;
        buildInsights(profile, positions, readings.map((r) => r.story)).then(setInsights);
    }, [profile, positions, readings]);

    return (
        <Page back title="הקריאה שלי">
            <Wrap style={styles.page}>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">הקריאה שלי</Text>
                    {!profile ? (
                        <View style={[styles.invite, { borderTopColor: c.ruleStrong }]}>
                            <Text style={[type.dek, { color: c.ink2 }]}>
                                כאן יופיעו הנתונים שלכם. העמוד הזה משווה בין העמדות שהצהרתם עליהן לבין מה שקראתם בפועל:
                                כמה הגיע מהצד השני, באילו נושאים, ומאילו גופים.
                            </Text>
                            <Text style={[type.small, { color: c.ink2 }]}>
                                השאלון הוא נקודת הייחוס של כל המספרים כאן. הוא לוקח כדקה, והתשובות נשארות במכשיר שלכם.
                            </Text>
                            <View style={styles.inviteButton}>
                                <Button label="למילוי שאלון העמדות" onPress={() => { track("questionnaire_opened", { from: "me" }); router.push("/questionnaire"); }} />
                            </View>
                        </View>
                    ) : !insights ? <Skeleton lines={5} /> : (
                        <Reading insights={insights} bloc={profile.bloc} wide={wide} />
                    )}
                    <Settings />
                </View>
            </Wrap>
        </Page>
    );
}

function Reading({ insights, bloc, wide }: { insights: Insights; bloc: "right" | "left"; wide: boolean }) {
    const { c, type } = useSite();
    const own = bloc === "right" ? "ימין" : "שמאל";
    const blocced = insights.byBloc.right + insights.byBloc.left;
    const otherPct = blocced ? Math.round((insights.inOtherBloc / blocced) * 100) : 0;

    return (
        <View style={styles.reading}>
            <Text style={[type.meta, { color: c.muted }]}>לפי השאלון, אתם נוטים ל{own}</Text>
            {blocced === 0 ? (
                <Text style={[type.dek, { color: c.ink2 }]}>
                    עוד לא פתחתם כתבות מגופים שמשויכים לגוש. כל כתבה שתפתחו מכאן תיספר כאן.
                </Text>
            ) : (
                <View style={[styles.figure, { flexDirection: wide ? ROW : "column", borderTopColor: c.ruleStrong }]}>
                    <Text style={[styles.big, { color: c.ink }]}>{otherPct}%</Text>
                    <Text style={[type.dek, styles.figureWords, { color: c.ink }]}>
                        מהכתבות שפתחתם הגיעו מהצד השני של המפה. {insights.inOtherBloc} מתוך {blocced}.
                    </Text>
                </View>
            )}
            {blocced > 0 && <Meter right={insights.byBloc.right} left={insights.byBloc.left} size="md" />}

            {insights.oneSidedTopics.length > 0 && (
                <View style={styles.block}>
                    <SectionHead title="נושאים שקראתם רק מצד אחד" />
                    {insights.oneSidedTopics.slice(0, 8).map((t) => (
                        <View key={t.topic} style={[styles.line, { flexDirection: ROW, borderTopColor: c.rule }]}>
                            <Text style={[type.row, { color: c.ink, flex: 1 }]}>{t.topic}</Text>
                            <Text style={[type.meta, { color: t.onlyBloc === "right" ? c.right : c.left }]}>
                                רק {t.onlyBloc === "right" ? "ימין" : "שמאל"}, {t.count}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {insights.missedStories.length > 0 && (
                <View style={styles.block}>
                    <SectionHead title="מה לא פתחתם היום" />
                    {insights.missedStories.slice(0, 6).map((s) => (
                        <View key={s.title} style={[styles.missed, { borderTopColor: c.rule }]}>
                            <Text style={[type.row, { color: c.ink }]}>{s.title}</Text>
                            <Text style={[type.meta, { color: s.bloc === "right" ? c.right : s.bloc === "left" ? c.left : c.muted }]}>{s.source}</Text>
                        </View>
                    ))}
                </View>
            )}

            {insights.unreadOutlets.length > 0 && (
                <View style={styles.block}>
                    <SectionHead title="גופים שלא קראתם החודש" />
                    <Text style={[type.body, { color: c.ink }]}>{insights.unreadOutlets.slice(0, 14).join(", ")}</Text>
                </View>
            )}
        </View>
    );
}

/** the settings the site keeps: measuring, the questionnaire, the reader's ratings, the desk's code */
function Settings() {
    const { c, type } = useSite();
    const { measuring, setMeasuring } = useConsent();
    const { devMode, setDevMode } = useThemeControl();
    const { filled, answered } = useQuestionnaire();
    const router = useRouter();
    const [erased, setErased] = useState<number | null>(null);
    const [erasing, setErasing] = useState(false);
    const [askingCode, setAskingCode] = useState(false);
    const [code, setCode] = useState("");
    const [wrong, setWrong] = useState(false);

    const pair = (on: boolean, yes: string, no: string, set: (v: boolean) => void) => (
        <View style={[styles.pair, { flexDirection: ROW }]}>
            {[true, false].map((v) => (
                <Pressable key={String(v)} onPress={() => set(v)} accessibilityRole="button" accessibilityState={{ selected: on === v }}
                    style={[styles.pairItem, { borderColor: on === v ? c.ink : c.rule, backgroundColor: on === v ? c.ink : c.paper }]}>
                    <Text style={[type.uiStrong, { color: on === v ? c.paper : c.ink, textAlign: "center" }]}>{v ? yes : no}</Text>
                </Pressable>
            ))}
        </View>
    );

    return (
        <View style={styles.settings}>
            <SectionHead title="הגדרות" />

            <Text style={[type.label, { color: c.ink }]}>מדידת שימוש</Text>
            <Text style={[type.small, { color: c.ink2 }]}>
                מדידה אנונימית של מה נלחץ ונפתח, בלי מזהה ובלי עוגיות. <Link href="/privacy" style={{ textDecorationLine: "underline", color: c.ink }}>מדיניות הפרטיות</Link>
            </Text>
            {pair(measuring, "פעילה", "כבויה", (v) => { if (!v) track("measurement_off"); setMeasuring(v); })}

            <View style={[styles.setting, { borderTopColor: c.rule }]}>
                <Text style={[type.label, { color: c.ink }]}>שאלון העמדות</Text>
                <Button quiet label={filled ? "למלא את השאלון מחדש" : "למילוי השאלון"} onPress={async () => {
                    if (filled) { await clearProfile(); answered(null); }
                    router.push("/questionnaire");
                }} />
            </View>

            <View style={[styles.setting, { borderTopColor: c.rule }]}>
                <Text style={[type.label, { color: c.ink }]}>הדירוגים שלי</Text>
                <Text style={[type.small, { color: c.ink2 }]}>מחיקת כל הדירוגים שנשלחו מהמכשיר הזה מהשרת.</Text>
                {erased !== null ? (
                    <Text style={[type.uiStrong, { color: c.ink }]}>{erased === 0 ? "לא היו דירוגים למחוק." : `נמחקו ${erased} דירוגים.`}</Text>
                ) : (
                    <Button quiet label={erasing ? "מוחק…" : "למחוק את הדירוגים שלי"} onPress={async () => {
                        setErasing(true); track("data_deleted");
                        const gone = await forgetMe(); setErasing(false);
                        if (gone !== null) setErased(gone);
                    }} />
                )}
            </View>

            <View style={[styles.setting, { borderTopColor: c.rule }]}>
                <Text style={[type.label, { color: c.ink }]}>מצב פיתוח</Text>
                {pair(devMode, "פעיל", "כבוי", async (on) => {
                    if (!on) { setDevMode(false); setAskingCode(false); return; }
                    if (await hasValidDevCode()) setDevMode(true); else setAskingCode(true);
                })}
                {askingCode && (
                    <View style={[styles.code, { flexDirection: ROW }]}>
                        <TextInput value={code} onChangeText={(t) => { setCode(t); setWrong(false); }} secureTextEntry
                            placeholder="קוד גישה" placeholderTextColor={c.muted} accessibilityLabel="קוד גישה"
                            style={[styles.input, { borderColor: wrong ? c.right : c.ink, color: c.ink }]} />
                        <Button label="אישור" onPress={async () => {
                            if (!code.trim()) return;
                            const ok = await unlockDevMode(code);
                            if (!ok) { setWrong(true); return; }
                            setDevMode(true); setAskingCode(false); setCode("");
                        }} />
                    </View>
                )}
                {wrong && <Text style={[type.meta, { color: c.right }]}>הקוד לא נכון.</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    column: { maxWidth: 760, width: "100%", alignSelf: "center", gap: 14 },
    invite: { borderTopWidth: 3, paddingTop: 16, gap: 12 },
    inviteButton: { alignSelf: "flex-end" },
    reading: { gap: 16 },
    figure: { borderTopWidth: 3, paddingTop: 12, gap: 16, alignItems: "flex-end" },
    big: { fontFamily: FACE.serifBlack, fontSize: 84, lineHeight: 88, fontVariant: ["tabular-nums"] },
    figureWords: { flex: 1 },
    block: { marginTop: 20 },
    line: { borderTopWidth: 1, paddingVertical: 11, alignItems: "baseline", gap: 10 },
    missed: { borderTopWidth: 1, paddingVertical: 12, gap: 4 },
    settings: { marginTop: 36, gap: 12 },
    setting: { borderTopWidth: 1, paddingTop: 16, marginTop: 8, gap: 10 },
    pair: { gap: 8 },
    pairItem: { flex: 1, borderWidth: 1.5, paddingVertical: 11, alignItems: "center" },
    code: { gap: 8, alignItems: "center" },
    input: { flex: 1, borderWidth: 1.5, height: 48, paddingHorizontal: 12, fontFamily: FACE.sansSemi, fontSize: 16, textAlign: "right" },
});
