import { BlindArticle, getBlindArticle, placeBlind } from '@/state/engagement';
import { useStillness } from '@/state/access';
import { track, trackScreen } from '@/state/analytics';
import { useTheme } from '@/state/theme';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";

/**
 * The benchmark, measured instead of estimated.
 *
 * Everywhere else in the app the masthead comes first, which is the honest way to
 * read a feed and the useless way to rate one: a reader who can see whose article
 * it is mostly confirms what they already believe about that outlet, and the model
 * learns the reputation rather than the writing. Here the name is withheld until
 * the vote is in, and then given - which is also the only moment in the app where
 * a reader can be surprised by their own answer.
 */
export default function BlindSurvey() {
    const t = useTheme();
    const router = useRouter();
    const still = useStillness();
    const [item, setItem] = useState<BlindArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [value, setValue] = useState(0);
    const [revealed, setRevealed] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [count, setCount] = useState(0);
    const seen = useRef<string[]>([]);

    const next = useCallback(async () => {
        setLoading(true);
        setRevealed(null);
        setValue(0);
        const picked = await getBlindArticle(seen.current);
        if (picked) {
            seen.current.push(picked.id);
            track("blind_shown", { topic: picked.topic });
        }
        setItem(picked);
        setLoading(false);
    }, []);

    useEffect(() => { next(); }, [next]);

    const send = async () => {
        if (!item || sending) return;
        setSending(true);
        const source = await placeBlind(item.id, value);
        setSending(false);
        setRevealed(source ?? "לא ידוע");
        setCount((n) => n + 1);
        track("blind_submitted", { topic: item.topic, value, placed_at: count + 1 });
    };

    const ink = value === 0 ? t.textMuted : value > 0 ? RIGHT : LEFT;
    const side = value === 0 ? "באמצע" : value > 0 ? item?.poles.right : item?.poles.left;

    return (
        <SafeAreaView edges={["top", "left", "right"]} style={[styles.page, { backgroundColor: t.bg }]}>
            <View style={styles.head}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}
                    accessibilityRole="button" accessibilityLabel="חזרה">
                    <Ionicons name="chevron-forward" size={26} color={t.text} />
                </TouchableOpacity>
                <View style={styles.headWords}>
                    <Text style={[styles.title, { color: t.text }]}>סקר עיוור</Text>
                    <Text style={[styles.hint, { color: t.textMuted }]}>
                        {count ? `${count} כותרות דורגו` : "בלי לדעת מי כתב"}
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Text style={[styles.lede, { color: t.textMuted }]}>
                    כותרת אחת, בלי שם הגוף. הציבו אותה על הציר, והשם יתגלה רק אחרי שתצביעו.
                </Text>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} />
                ) : !item ? (
                    <Text style={[styles.lede, { color: t.textMuted }]}>
                        אין כרגע כותרת לדרג. נסו שוב בעוד כמה דקות.
                    </Text>
                ) : (
                    <>
                        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                            <Text style={[styles.topic, { color: t.textMuted }]}>{item.topic}</Text>
                            <Text style={[styles.headline, { color: t.text }]}>{item.title}</Text>
                            {!!item.summary && item.summary !== item.title && (
                                <Text style={[styles.standfirst, { color: t.textMuted }]}>{item.summary}</Text>
                            )}
                        </View>

                        {revealed === null ? (
                            <>
                                <View style={styles.axis}>
                                    <Text style={[styles.pole, { color: LEFT }]}>{item.poles.left}</Text>
                                    <Text style={[styles.pole, { color: RIGHT }]}>{item.poles.right}</Text>
                                </View>
                                <Slider
                                    minimumValue={-5} maximumValue={5} step={1}
                                    value={value} onValueChange={setValue}
                                    minimumTrackTintColor={LEFT} maximumTrackTintColor={RIGHT}
                                    thumbTintColor={ink}
                                />
                                <Text style={[styles.reading, { color: ink }]}>{side}</Text>

                                <TouchableOpacity style={[styles.send, { backgroundColor: t.text }]}
                                    onPress={send} disabled={sending} accessibilityRole="button">
                                    <Text style={[styles.sendText, { color: t.surface }]}>
                                        {sending ? "שולח…" : "קבעתי"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={next} accessibilityRole="button">
                                    <Text style={[styles.skip, { color: t.textMuted }]}>דלגו על זו</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Animated.View entering={still ? undefined : FadeIn.duration(240)}
                                style={styles.reveal}>
                                <Text style={[styles.revealLabel, { color: t.textMuted }]}>הכתבה היא של</Text>
                                <Text style={[styles.revealName, { color: t.text }]}>{revealed}</Text>
                                <Text style={[styles.revealNote, { color: t.textMuted }]}>
                                    הדירוג שלכם נרשם כדירוג עיוור, והוא נחשב יותר מדירוג שניתן אחרי שראיתם את השם.
                                </Text>
                                <TouchableOpacity style={[styles.send, { backgroundColor: t.text }]}
                                    onPress={next} accessibilityRole="button">
                                    <Text style={[styles.sendText, { color: t.surface }]}>כותרת הבאה</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </>
                )}

                <TouchableOpacity onPress={() => router.push("/methodology")} accessibilityRole="link">
                    <Text style={[styles.skip, { color: t.textMuted }]}>איך הדירוגים האלה נספרים</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },
    head: {
        flexDirection: "row-reverse", alignItems: "center", gap: 10,
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    },
    headWords: { alignItems: "flex-end" },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 20, textAlign: "right" },
    hint: { fontFamily: "Heebo_400Regular", fontSize: 11.5, textAlign: "right" },
    body: { paddingHorizontal: 18, paddingBottom: 48, gap: 14 },
    lede: { fontFamily: "Heebo_500Medium", fontSize: 13, lineHeight: 20, textAlign: "right" },
    // deliberately plain: no colour, no logo, nothing that hints at a masthead
    card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
    topic: { fontFamily: "Heebo_700Bold", fontSize: 11, textAlign: "right" },
    headline: { fontFamily: "Heebo_700Bold", fontSize: 17, lineHeight: 24, textAlign: "right" },
    standfirst: { fontFamily: "Heebo_400Regular", fontSize: 13, lineHeight: 20, textAlign: "right" },
    // the left pole at the left end of the track, the right pole at the right end
    axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    pole: { fontFamily: "Heebo_700Bold", fontSize: 12 },
    reading: { fontFamily: "Heebo_800ExtraBold", fontSize: 15, textAlign: "center" },
    send: { borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 6 },
    sendText: { fontFamily: "Heebo_800ExtraBold", fontSize: 14 },
    skip: { fontFamily: "Heebo_500Medium", fontSize: 12, textAlign: "center", marginTop: 8 },
    reveal: { gap: 6, alignItems: "center" },
    revealLabel: { fontFamily: "Heebo_400Regular", fontSize: 12 },
    revealName: { fontFamily: "Heebo_800ExtraBold", fontSize: 24 },
    revealNote: {
        fontFamily: "Heebo_400Regular", fontSize: 12, lineHeight: 18,
        textAlign: "center", marginTop: 4,
    },
});
