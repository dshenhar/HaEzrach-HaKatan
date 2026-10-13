import React, { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, useRouter } from "expo-router";
import { buildInsights, Insights } from "@/state/insights";
import { clearProfile } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { forgetMe, hasValidDevCode, unlockDevMode } from "@/state/engagement";
import { useConsent } from "@/state/consent";
import { useThemeControl } from "@/state/theme";
import { installKind, promptInstall, subscribeInstall } from "@/state/install";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, TYPE, useSite } from "@/site/tokens";
import { useNews } from "@/site/news";
import { Group, ListRow, Screen } from "@/site/page";
import { Button, Skeleton } from "@/site/controls";
import Meter from "@/site/meter";

/**
 * The reader's own place: what they have read against where they said they
 * stand, the few settings the app has, and the way to everything that is not
 * news - the blind poll, how it works, the statements. Everything worked out
 * here is worked out on this device, from what is kept on it.
 */
export default function Me() {
    const { c } = useSite();
    const { profile } = useQuestionnaire();
    const { readings, positions } = useNews();
    const [insights, setInsights] = useState<Insights | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!profile) return;
        buildInsights(profile, positions, readings.map((r) => r.story)).then(setInsights);
    }, [profile, positions, readings]);

    return (
        <Screen title="אני" docTitle="הקריאה שלי">
            {!profile ? (
                <View style={[styles.invite, { backgroundColor: c.brand }]}>
                    <Text style={[TYPE.section, { color: c.brandInk }]}>הקריאה שלי</Text>
                    <Text style={[TYPE.small, { color: c.brandInk, opacity: 0.92 }]}>
                        כאן יופיעו הנתונים שלכם. העמוד הזה משווה בין העמדות שהצהרתם עליהן לבין מה שקראתם בפועל:
                        כמה הגיע מהצד השני, באילו נושאים, ומאילו גופים.
                    </Text>
                    <Text style={[TYPE.small, { color: c.brandInk, opacity: 0.92 }]}>
                        השאלון הוא נקודת הייחוס של כל המספרים כאן. הוא לוקח כדקה, והתשובות נשארות במכשיר שלכם.
                    </Text>
                    <View style={styles.inviteButton}>
                        <Button label="למילוי שאלון העמדות" onColour={c.brand}
                            onPress={() => { track("questionnaire_opened", { from: "me" }); router.push("/questionnaire"); }} />
                    </View>
                </View>
            ) : !insights ? <Skeleton cards={2} /> : (
                <MyReading insights={insights} bloc={profile.bloc} />
            )}
            <Settings />
            <Group title="עוד באזרח הקטן">
                <ListRow icon="shuffle" colour="#B0175C" label="סקר עיוור" detail="כותרת בלי שם הגוף, והשם מתגלה אחרי ההצבעה" href="/blind" />
                <ListRow icon="information-circle" colour="#5B2BE0" label="על האזרח הקטן" href="/about" />
                <ListRow icon="git-compare" colour="#0E6870" label="איך זה עובד" detail="השיטה: קיבוץ, שיוך לגוש, סיכומים ודירוגים" href="/methodology" />
            </Group>
            <Install />
            <Group title="מסמכים">
                <ListRow icon="accessibility" colour="#0B7194" label="הצהרת נגישות" href="/accessibility" />
                <ListRow icon="lock-closed" colour="#3B4250" label="מדיניות פרטיות" href="/privacy" />
                <ListRow icon="document-text" colour="#A15C00" label="תנאי שימוש" href="/terms" />
            </Group>
        </Screen>
    );
}

function MyReading({ insights, bloc }: { insights: Insights; bloc: "right" | "left" }) {
    const { c } = useSite();
    const own = bloc === "right" ? "ימין" : "שמאל";
    const blocced = insights.byBloc.right + insights.byBloc.left;
    const otherPct = blocced ? Math.round((insights.inOtherBloc / blocced) * 100) : 0;

    return (
        <>
            <View style={[styles.stat, { backgroundColor: c.brand }]}>
                <Text style={[TYPE.label, { color: c.brandInk, opacity: 0.85 }]}>לפי השאלון, אתם נוטים ל{own}</Text>
                {blocced === 0 ? (
                    <Text style={[TYPE.body, { color: c.brandInk }]}>
                        עוד לא פתחתם כתבות מגופים שמשויכים לגוש. כל כתבה שתפתחו מכאן תיספר כאן.
                    </Text>
                ) : (
                    <>
                        <View style={[styles.figure, { flexDirection: ROW }]}>
                            <Text style={[styles.big, { color: c.brandInk }]}>{otherPct}%</Text>
                            <Text style={[TYPE.body, styles.figureWords, { color: c.brandInk }]}>
                                מהכתבות שפתחתם הגיעו מהצד השני של המפה. {insights.inOtherBloc} מתוך {blocced}.
                            </Text>
                        </View>
                        <Meter right={insights.byBloc.right} left={insights.byBloc.left} size="md" onColour />
                    </>
                )}
            </View>

            {insights.oneSidedTopics.length > 0 && (
                <Group title="נושאים שקראתם רק מצד אחד">
                    {insights.oneSidedTopics.slice(0, 8).map((t) => (
                        <View key={t.topic} style={[styles.line, { flexDirection: ROW }]}>
                            <Text style={[TYPE.uiStrong, { color: c.ink, flex: 1 }]}>{t.topic}</Text>
                            <View style={[styles.tag, { backgroundColor: t.onlyBloc === "right" ? c.rightTint : c.leftTint }]}>
                                <Text style={[TYPE.meta, { color: t.onlyBloc === "right" ? c.right : c.left, fontFamily: FACE.semi }]}>
                                    רק {t.onlyBloc === "right" ? "ימין" : "שמאל"}, {t.count}
                                </Text>
                            </View>
                        </View>
                    ))}
                </Group>
            )}

            {insights.missedStories.length > 0 && (
                <Group title="מה לא פתחתם היום">
                    {insights.missedStories.slice(0, 6).map((s) => (
                        <View key={s.title} style={styles.missed}>
                            <Text style={[TYPE.uiStrong, { color: c.ink }]}>{s.title}</Text>
                            <Text style={[TYPE.meta, { color: s.bloc === "right" ? c.right : s.bloc === "left" ? c.left : c.muted }]}>{s.source}</Text>
                        </View>
                    ))}
                </Group>
            )}

            {insights.unreadOutlets.length > 0 && (
                <Group title="גופים שלא קראתם החודש">
                    <Text style={[TYPE.body, styles.missed, { color: c.ink }]}>{insights.unreadOutlets.slice(0, 14).join(", ")}</Text>
                </Group>
            )}
        </>
    );
}

/** a setting that is on or off */
function SwitchRow({ label, detail, value, onChange }: {
    label: string; detail?: React.ReactNode; value: boolean; onChange: (on: boolean) => void;
}) {
    const { c } = useSite();
    return (
        <View style={[styles.switchRow, { flexDirection: ROW }]}>
            <View style={styles.switchWords}>
                <Text style={[TYPE.uiStrong, { color: c.ink }]}>{label}</Text>
                {!!detail && <Text style={[TYPE.meta, { color: c.muted }]}>{detail}</Text>}
            </View>
            <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
                trackColor={{ true: c.brand, false: c.rule }} thumbColor="#FFFFFF"
                {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </View>
    );
}

/** the settings the app keeps: measuring, the questionnaire, the reader's ratings, the desk's code */
function Settings() {
    const { c } = useSite();
    const { measuring, setMeasuring } = useConsent();
    const { devMode, setDevMode } = useThemeControl();
    const { filled, answered } = useQuestionnaire();
    const router = useRouter();
    const [erased, setErased] = useState<number | null>(null);
    const [erasing, setErasing] = useState(false);
    const [askingCode, setAskingCode] = useState(false);
    const [code, setCode] = useState("");
    const [wrong, setWrong] = useState(false);

    return (
        <Group title="הגדרות">
            <SwitchRow label="מדידת שימוש" value={measuring}
                onChange={(v) => { if (!v) track("measurement_off"); setMeasuring(v); }}
                detail={<>מדידה אנונימית של מה נלחץ ונפתח, בלי מזהה ובלי עוגיות. <Link href="/privacy" style={{ textDecorationLine: "underline", color: c.ink2 }}>מדיניות הפרטיות</Link></>} />
            <ListRow icon="list" colour={c.brand} label={filled ? "למלא את השאלון מחדש" : "למילוי שאלון העמדות"}
                onPress={async () => {
                    if (filled) { await clearProfile(); answered(null); }
                    router.push("/questionnaire");
                }} />
            {erased !== null ? (
                <View style={styles.switchRow}>
                    <Text style={[TYPE.uiStrong, { color: c.ink }]}>{erased === 0 ? "לא היו דירוגים למחוק." : `נמחקו ${erased} דירוגים.`}</Text>
                </View>
            ) : (
                <ListRow icon="trash" colour="#C62A22" label={erasing ? "מוחק…" : "למחוק את הדירוגים שלי"}
                    detail="מחיקת כל הדירוגים שנשלחו מהמכשיר הזה מהשרת"
                    onPress={async () => {
                        if (erasing) return;
                        setErasing(true); track("data_deleted");
                        const gone = await forgetMe(); setErasing(false);
                        if (gone !== null) setErased(gone);
                    }} />
            )}
            <View>
                <SwitchRow label="מצב פיתוח" value={devMode} onChange={async (on) => {
                    if (!on) { setDevMode(false); setAskingCode(false); return; }
                    if (await hasValidDevCode()) setDevMode(true); else setAskingCode(true);
                }} />
                {askingCode && (
                    <View style={[styles.code, { flexDirection: ROW }]}>
                        <TextInput value={code} onChangeText={(t) => { setCode(t); setWrong(false); }} secureTextEntry
                            placeholder="קוד גישה" placeholderTextColor={c.muted} accessibilityLabel="קוד גישה"
                            style={[styles.input, { borderColor: wrong ? c.right : c.rule, color: c.ink, backgroundColor: c.sunk }]} />
                        <Button label="אישור" onPress={async () => {
                            if (!code.trim()) return;
                            const ok = await unlockDevMode(code);
                            if (!ok) { setWrong(true); return; }
                            setDevMode(true); setAskingCode(false); setCode("");
                        }} />
                    </View>
                )}
                {wrong && <Text style={[TYPE.meta, styles.wrong, { color: c.right }]}>הקוד לא נכון.</Text>}
            </View>
        </Group>
    );
}

const SAFARI_STEPS: { icon: "share-outline" | "add-circle-outline" | "checkmark-circle-outline"; text: string }[] = [
    { icon: "share-outline", text: "לחצו על כפתור השיתוף" },
    { icon: "add-circle-outline", text: "בחרו «הוסף למסך הבית»" },
    { icon: "checkmark-circle-outline", text: "לחצו «הוסף»" },
];

const OTHER_IOS = "את ההוספה למסך הבית אפשר לעשות רק מספארי. פתחו שם את האתר, ומשם הוסיפו.";

/** adding the app to the home screen, where the browser has a way to */
function Install() {
    const { c } = useSite();
    const kind = useSyncExternalStore(subscribeInstall, installKind, () => null);
    const [steps, setSteps] = useState(false);
    if (!kind) return null;
    return (
        <Group title="התקנה">
            <ListRow icon="add-circle" colour="#047A55" label="הוספה למסך הבית"
                onPress={async () => {
                    if (kind !== "prompt") { setSteps((s) => !s); return; }
                    const outcome = await promptInstall();
                    if (outcome === "accepted") track("install_accepted", { where: "personal" });
                }} />
            {steps && (
                <View style={styles.steps}>
                    {kind === "ios-safari" ? SAFARI_STEPS.map((step, i) => (
                        <View key={step.text} style={[styles.step, { flexDirection: ROW }]}>
                            <Text style={[TYPE.label, styles.stepNo, { color: c.brand, backgroundColor: c.brandTint }]}>{i + 1}</Text>
                            <Ionicons name={step.icon} size={20} color={c.ink} />
                            <Text style={[TYPE.small, { color: c.ink, flex: 1 }]}>{step.text}</Text>
                        </View>
                    )) : (
                        <Text style={[TYPE.small, { color: c.ink2 }]}>{OTHER_IOS}</Text>
                    )}
                </View>
            )}
        </Group>
    );
}

const styles = StyleSheet.create({
    invite: { marginHorizontal: 12, borderRadius: 24, padding: 18, gap: 10 },
    inviteButton: { alignSelf: "flex-end", marginTop: 6 },
    stat: { marginHorizontal: 12, borderRadius: 24, padding: 18, gap: 12 },
    figure: { alignItems: "center", gap: 14 },
    big: { fontFamily: FACE.black, fontSize: 64, lineHeight: 70, fontVariant: ["tabular-nums"] },
    figureWords: { flex: 1 },
    line: { alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    tag: { borderRadius: RADIUS.chip, paddingHorizontal: 9, paddingVertical: 3 },
    missed: { paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
    switchRow: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 54 },
    switchWords: { flex: 1, gap: 3 },
    code: { gap: 8, alignItems: "center", paddingHorizontal: 14, paddingBottom: 12 },
    input: { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.button, height: 48, paddingHorizontal: 12, fontFamily: FACE.medium, fontSize: 16, textAlign: "right" },
    wrong: { paddingHorizontal: 14, paddingBottom: 10 },
    steps: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
    step: { alignItems: "center", gap: 10 },
    stepNo: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, overflow: "hidden" },
});
