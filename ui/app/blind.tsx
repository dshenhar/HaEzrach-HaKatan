import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlindArticle, getBlindArticle, placeBlind } from "@/state/engagement";
import { track } from "@/state/analytics";
import { FACE, RADIUS, TYPE, useSite } from "@/site/tokens";
import { Screen } from "@/site/page";
import { Button, Skeleton } from "@/site/controls";
import { Steps } from "@/site/reading";

const BLIND = "#B0175C";

/**
 * The blind poll. Everywhere else the outlet's name comes first, which is the
 * honest way to read and the useless way to rate: a reader who can see whose
 * article it is mostly confirms what they already think of that outlet. Here the
 * name is withheld until the vote is in.
 */
export default function BlindPoll() {
    const { c } = useSite();
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

    const head = (
        <>
            <Text style={[TYPE.screen, { color: c.onColour }]} accessibilityRole="header">סקר עיוור</Text>
            <Text style={[TYPE.body, { color: c.onColourMuted }]}>
                כותרת אחת, בלי שם הגוף, בלי לוגו ובלי צבע. הציבו אותה על הציר, ושם הגוף יתגלה רק אחרי שתצביעו.
            </Text>
            {count > 0 && <Text style={[TYPE.uiStrong, { color: c.onColour }]}>דירגתם {count} כותרות</Text>}
        </>
    );

    return (
        <Screen back docTitle="סקר עיוור" colour={BLIND} head={head}>
            {loading ? (
                <View style={styles.pad}><Skeleton tall cards={1} /></View>
            ) : !item ? (
                <Text style={[TYPE.body, styles.empty, { color: c.muted }]}>אין כרגע כותרת לדרג. נסו שוב בעוד כמה דקות.</Text>
            ) : (
                <View style={[styles.card, { backgroundColor: c.card }]}>
                    {revealed === null && (
                        <View style={[styles.hidden, { backgroundColor: c.sunk }]}>
                            <Text style={[styles.hiddenText, { color: c.muted }]}>גוף מוסתר</Text>
                        </View>
                    )}
                    <Text style={[TYPE.label, { color: c.muted }]}>{item.topic}</Text>
                    <Text style={[TYPE.h1, { color: c.ink }]}>{item.title}</Text>
                    {!!item.summary && item.summary !== item.title && (
                        <Text style={[TYPE.body, { color: c.ink2 }]}>{item.summary}</Text>
                    )}
                    {revealed === null ? (
                        <View style={styles.vote}>
                            <Steps value={value} onChange={setValue} poles={item.poles} />
                            <Button wide label={sending ? "שולח…" : "קבעתי"} onPress={send} disabled={value === null || sending} />
                        </View>
                    ) : (
                        <View style={[styles.reveal, { backgroundColor: BLIND }]}>
                            <Text style={[TYPE.label, { color: c.onColourMuted }]}>הכותרת פורסמה ב</Text>
                            <Text style={[styles.revealName, { color: c.onColour }]}>{revealed}</Text>
                            <Button label="לכותרת הבאה" onColour={BLIND} onPress={next} />
                        </View>
                    )}
                </View>
            )}
            <Text style={[TYPE.meta, styles.note, { color: c.muted }]}>
                הדירוגים העיוורים נרשמים ככאלה, והם המקור האמין ביותר שיש לנו על נטיית הסיקור.
            </Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    pad: { paddingTop: 12 },
    empty: { paddingHorizontal: 18, paddingTop: 20 },
    card: { marginHorizontal: 12, marginTop: 14, borderRadius: 24, padding: 18, gap: 12 },
    hidden: { alignSelf: "flex-end", borderRadius: RADIUS.chip, paddingHorizontal: 12, paddingVertical: 5 },
    hiddenText: { fontFamily: FACE.semi, fontSize: 12.5, lineHeight: 16 },
    vote: { gap: 14, marginTop: 6 },
    reveal: { borderRadius: 18, padding: 18, gap: 10, alignItems: "flex-end", marginTop: 6 },
    revealName: { fontFamily: FACE.black, fontSize: 34, lineHeight: 42, textAlign: "right" },
    note: { paddingHorizontal: 18, paddingTop: 14 },
});
