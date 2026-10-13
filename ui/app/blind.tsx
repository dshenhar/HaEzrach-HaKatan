import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlindArticle, getBlindArticle, placeBlind } from "@/state/engagement";
import { track } from "@/state/analytics";
import { FACE, ROW, useSite } from "@/site/tokens";
import { Page, Wrap } from "@/site/page";
import { Button, Skeleton } from "@/site/controls";

const STEPS = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];

/**
 * The blind poll. Everywhere else the outlet's name comes first, which is the
 * honest way to read and the useless way to rate: a reader who can see whose
 * article it is mostly confirms what they already think of that outlet. Here the
 * name is withheld until the vote is in.
 */
export default function BlindPoll() {
    const { c, type } = useSite();
    const [item, setItem] = useState<BlindArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [value, setValue] = useState<number | null>(null);
    const [revealed, setRevealed] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [count, setCount] = useState(0);
    const seen = useRef<string[]>([]);

    const next = useCallback(async () => {
        setLoading(true);
        setRevealed(null);
        setValue(null);
        const picked = await getBlindArticle(seen.current);
        if (picked) {
            seen.current.push(picked.id);
            track("blind_shown", { topic: picked.topic });
        }
        setItem(picked);
        setLoading(false);
    }, []);
    useEffect(() => { void Promise.resolve().then(next); }, [next]);

    const send = async () => {
        if (!item || sending || value === null) return;
        setSending(true);
        const source = await placeBlind(item.id, value);
        setSending(false);
        setRevealed(source ?? "לא ידוע");
        setCount((n) => n + 1);
        track("blind_submitted", { topic: item.topic, value, placed_at: count + 1 });
    };

    const ink = (v: number) => (v > 0 ? c.right : v < 0 ? c.left : c.ink);

    return (
        <Page back title="סקר עיוור">
            <Wrap>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">סקר עיוור</Text>
                    <Text style={[type.dek, { color: c.ink2 }]}>
                        כותרת אחת, בלי שם הגוף, בלי לוגו ובלי צבע. הציבו אותה על הציר, ושם הגוף יתגלה רק אחרי שתצביעו.
                    </Text>
                    {count > 0 && <Text style={[type.meta, { color: c.muted }]}>דירגתם {count} כותרות</Text>}

                    {loading ? (
                        <View style={styles.sheet}><Skeleton lines={3} big /></View>
                    ) : !item ? (
                        <Text style={[type.body, { color: c.muted }]}>אין כרגע כותרת לדרג. נסו שוב בעוד כמה דקות.</Text>
                    ) : (
                        <View style={[styles.sheet, { borderTopColor: c.ruleStrong, borderBottomColor: c.rule }]}>
                            <Text style={[type.label, { color: c.muted }]}>{item.topic}</Text>
                            <Text style={[type.lead, { color: c.ink }]}>{item.title}</Text>
                            {!!item.summary && item.summary !== item.title && (
                                <Text style={[type.body, { color: c.ink2 }]}>{item.summary}</Text>
                            )}

                            {revealed === null ? (
                                <View style={styles.vote}>
                                    <View style={[styles.poles, { flexDirection: ROW }]}>
                                        <Text style={[type.label, { color: c.right }]}>{item.poles.right}</Text>
                                        <Text style={[type.label, { color: c.left }]}>{item.poles.left}</Text>
                                    </View>
                                    <View style={[styles.scale, { flexDirection: ROW }]}>
                                        {STEPS.map((v) => {
                                            const on = value === v;
                                            return (
                                                <Pressable key={v} onPress={() => setValue(v)} accessibilityRole="button"
                                                    accessibilityState={{ selected: on }}
                                                    accessibilityLabel={v === 0 ? "באמצע" : v > 0 ? `${v} לכיוון ${item.poles.right}` : `${-v} לכיוון ${item.poles.left}`}
                                                    style={[styles.step, { borderColor: on ? ink(v) : c.rule, backgroundColor: on ? ink(v) : c.paper }]}>
                                                    <Text style={[styles.stepText, { color: on ? c.paper : ink(v) }]}>{Math.abs(v)}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    <Button label={sending ? "שולח…" : "קבעתי"} onPress={send} disabled={value === null || sending} />
                                </View>
                            ) : (
                                <View style={[styles.reveal, { backgroundColor: c.paperAlt }]}>
                                    <Text style={[type.label, { color: c.muted }]}>הכותרת פורסמה ב</Text>
                                    <Text style={[styles.revealName, { color: c.ink }]}>{revealed}</Text>
                                    <Button quiet label="לכותרת הבאה" onPress={next} />
                                </View>
                            )}
                        </View>
                    )}
                    <Text style={[type.meta, { color: c.muted }]}>
                        הדירוגים העיוורים נרשמים ככאלה, והם המקור האמין ביותר שיש לנו על נטיית הסיקור.
                    </Text>
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    column: { maxWidth: 720, width: "100%", alignSelf: "center", paddingTop: 26, gap: 14 },
    sheet: { borderTopWidth: 3, borderBottomWidth: 1, paddingTop: 18, paddingBottom: 22, gap: 12, marginTop: 8 },
    vote: { gap: 12, marginTop: 10 },
    poles: { justifyContent: "space-between" },
    scale: { gap: 4 },
    step: { flex: 1, height: 46, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    stepText: { fontFamily: FACE.sansHeavy, fontSize: 16, fontVariant: ["tabular-nums"] },
    reveal: { padding: 18, gap: 10, alignItems: "flex-end", marginTop: 8 },
    revealName: { fontFamily: FACE.serifBlack, fontSize: 34, lineHeight: 42, textAlign: "right" },
});
