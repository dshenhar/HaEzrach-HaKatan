import { getSitePositions, SitePosition } from '@/state/engagement';
import { TYPE } from '@/state/craft';
import { blocOf, Placement, PLACEMENTS, ReaderProfile, saveProfile } from '@/state/profile';
import { useTheme } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, I18nManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
// the phone lays the app out right to left and the web build does not
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";

type Step = "place" | "outlets" | "result";

type Props = {
    /** what the reader answered before, which the questionnaire opens on */
    profile: ReaderProfile | null;
    /** a reader who answered the old questionnaire is asked only for their outlets */
    only?: "outlets";
    /** the new profile, saved - or null when the reader left without finishing */
    onDone: (profile: ReaderProfile | null) => void;
};

/**
 * The questionnaire: where the reader puts themselves, and which outlets they read.
 *
 * Two screens and a result, because every question more is readers lost. The first
 * places the reader on one side or the other, roughly - that is all the analytics
 * page needs to say "from the other side". The second is what "your outlets did not
 * cover this" is measured against. Either can be skipped: a reader in the middle, or
 * who would rather not say, is placed by the outlets they read.
 */
const Onboarding = ({ profile, only, onDone }: Props) => {
    const t = useTheme();
    const [step, setStep] = useState<Step>(only === "outlets" ? "outlets" : "place");
    const [placement, setPlacement] = useState<Placement | null>(profile?.placement ?? null);
    const [chosen, setChosen] = useState<Set<string>>(() => new Set(profile?.outlets ?? []));
    const [positions, setPositions] = useState<Record<string, SitePosition> | null>(null);

    useEffect(() => {
        let live = true;
        getSitePositions().then((next) => { if (live) setPositions(next); });
        return () => { live = false; };
    }, []);
    // every outlet the app reads, in Hebrew order
    const outlets = useMemo(() => Object.keys(positions ?? {})
        .sort((a, b) => a.localeCompare(b, "he")), [positions]);

    const outletsList = [...chosen];
    // a reader of the old questionnaire keeps the side it gave them
    const bloc = only === "outlets" && profile
        ? profile.bloc
        : blocOf(placement, outletsList, positions ?? {});

    const finish = async () => {
        const next: ReaderProfile = {
            ...(only === "outlets" && profile ? profile : {}),
            ...(only === "outlets" ? {} : { placement }),
            outlets: outletsList,
            bloc,
            completedAt: Date.now(),
        };
        await saveProfile(next);
        onDone(next);
    };

    const toggle = (name: string) => setChosen((current) => {
        const next = new Set(current);
        if (next.has(name)) next.delete(name); else next.add(name);
        return next;
    });

    const head = (index: number, of: number) => (
        <View style={[styles.head, { flexDirection: FROM_RIGHT }]}>
            <Text style={[styles.counter, { color: t.textMuted }]}>{index} מתוך {of}</Text>
            <TouchableOpacity onPress={() => onDone(null)} hitSlop={10}
                accessibilityRole="button" accessibilityLabel="סגירה">
                <Ionicons name="close" size={24} color={t.textMuted} />
            </TouchableOpacity>
        </View>
    );

    if (step === "place") {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {head(1, 2)}
                    <Text style={[styles.title, { color: t.text }]}>איפה אתם על המפה?</Text>
                    <Text style={[styles.lede, { color: t.textMuted }]}>
                        בערך, בלי להתחייב. זה מה שמאפשר לאפליקציה להראות לכם כמה ממה שקראתם הגיע
                        מהצד השני. התשובה נשארת במכשיר שלכם.
                    </Text>
                    <View style={styles.options}>
                        {PLACEMENTS.map((option) => {
                            const on = placement === option.value;
                            const ink = option.value > 0 ? RIGHT : option.value < 0 ? LEFT : t.text;
                            return (
                                <TouchableOpacity key={option.value}
                                    style={[styles.option, { backgroundColor: on ? ink : t.surfaceAlt }]}
                                    onPress={() => { setPlacement(option.value); setStep("outlets"); }}
                                    accessibilityRole="button" accessibilityState={{ selected: on }}>
                                    <Text style={[styles.optionText, { color: on ? "#FFFFFF" : ink }]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TouchableOpacity onPress={() => { setPlacement(null); setStep("outlets"); }}
                        accessibilityRole="button">
                        <Text style={[styles.secondary, { color: t.textMuted }]}>מעדיפים לא לענות</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (step === "outlets") {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {only === "outlets" ? head(1, 1) : head(2, 2)}
                    <Text style={[styles.title, { color: t.text }]}>מה אתם קוראים?</Text>
                    <Text style={[styles.lede, { color: t.textMuted }]}>
                        סמנו את המקורות שאתם קוראים בדרך כלל. כך נוכל לסמן לכם סיפורים שהם לא
                        סיקרו - מה שבלי האפליקציה הייתם מפספסים.
                    </Text>
                    {positions === null ? (
                        <ActivityIndicator style={{ marginTop: 24 }} />
                    ) : (
                        <View style={[styles.chips, { flexDirection: FROM_RIGHT }]}>
                            {outlets.map((name) => {
                                const on = chosen.has(name);
                                return (
                                    <TouchableOpacity key={name}
                                        style={[styles.chip, { backgroundColor: on ? t.text : t.surfaceAlt }]}
                                        onPress={() => toggle(name)}
                                        accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                                        <Text style={[styles.chipText, { color: on ? t.surface : t.text }]}>
                                            {on ? "✓ " : ""}{name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                    <TouchableOpacity style={[styles.primary, { backgroundColor: t.text }]}
                        onPress={() => (only === "outlets" ? finish() : setStep("result"))}
                        accessibilityRole="button">
                        <Text style={[styles.primaryText, { color: t.surface }]}>
                            {chosen.size ? `המשך · ${chosen.size} מקורות` : "המשך"}
                        </Text>
                    </TouchableOpacity>
                    {only !== "outlets" && (
                        <TouchableOpacity onPress={() => setStep("place")} accessibilityRole="button">
                            <Text style={[styles.secondary, { color: t.textMuted }]}>חזרה</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </SafeAreaView>
        );
    }

    const ink = bloc === "right" ? RIGHT : bloc === "left" ? LEFT : t.text;
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
            <View style={styles.result}>
                <Text style={[styles.kicker, { color: t.textMuted }]}>
                    {placement ? "לפי מה שבחרתם" : "לפי המקורות שאתם קוראים"}
                </Text>
                <Text style={[styles.resultTitle, { color: ink }]}>
                    {bloc === "right" ? "אתם נוטים ימינה" : bloc === "left" ? "אתם נוטים שמאלה" : "לא שמנו אתכם באף צד"}
                </Text>
                <Text style={[styles.body, { color: t.textMuted }]}>
                    {bloc
                        ? "לא נשתמש בזה כדי להראות לכם יותר ממה שאתם כבר מסכימים איתו - ההפך. מכאן נוכל להראות לכם כמה מהקריאה שלכם נשארת בצד שלכם, ובאילו נושאים לא שמעתם את הצד השני."
                        : "זה בסדר גמור. האפליקציה עדיין תראה לכם הכל משני הצדדים, ואת מה שהמקורות שלכם לא סיקרו. אפשר לענות בכל עת מהאזור האישי."}
                </Text>
                {chosen.size > 0 && (
                    <Text style={[styles.body, { color: t.textMuted }]}>
                        {chosen.size === 1 ? "סימנתם מקור אחד" : `סימנתם ${chosen.size} מקורות`}: בפיד יסומנו
                        הסיפורים שהם לא סיקרו.
                    </Text>
                )}
                <TouchableOpacity style={[styles.primary, { backgroundColor: t.text }]} onPress={finish}
                    accessibilityRole="button">
                    <Text style={[styles.primaryText, { color: t.surface }]}>בואו נתחיל</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep("place")} accessibilityRole="button">
                    <Text style={[styles.secondary, { color: t.textMuted }]}>לענות מחדש</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default Onboarding;

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 22, gap: 14, flexGrow: 1 },
    head: { justifyContent: "space-between", alignItems: "center" },
    counter: { ...TYPE.caption },
    title: { ...TYPE.display, fontSize: 28, lineHeight: 34, textAlign: "right", marginTop: 8 },
    lede: { ...TYPE.body, fontSize: 14, lineHeight: 22, textAlign: "right" },
    options: { gap: 8, marginTop: 6 },
    option: { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18 },
    optionText: { ...TYPE.label, fontSize: 16, lineHeight: 20, textAlign: "right" },
    chips: { flexWrap: "wrap", gap: 8, marginTop: 4 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    chipText: { ...TYPE.label, fontSize: 13.5 },
    primary: { borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 10 },
    primaryText: { ...TYPE.label, fontSize: 15 },
    secondary: { ...TYPE.label, textAlign: "center", paddingVertical: 10 },
    result: { flex: 1, padding: 22, gap: 12, justifyContent: "center" },
    kicker: { ...TYPE.label, textAlign: "right" },
    resultTitle: { ...TYPE.display, textAlign: "right" },
    body: { ...TYPE.body, fontSize: 14, lineHeight: 22, textAlign: "right" },
});
