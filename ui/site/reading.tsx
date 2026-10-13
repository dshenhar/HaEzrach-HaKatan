import React, { createContext, useContext, useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getTopicPoles, isRatable, NewsItem, saveRating, saveWatch, SitePosition, TopicPoles } from "@/state/engagement";
import { track } from "@/state/analytics";
import { useStillness } from "@/state/access";
import { FACE, RADIUS, ROW, TYPE, useSite } from "./tokens";

type Opener = (item: NewsItem, ctx: { outlets: number; positions: Record<string, SitePosition>; from: string }) => void;

const ReadingContext = createContext<Opener>(() => {});
export const useOpenArticle = () => useContext(ReadingContext);

/**
 * Reading an outlet's article, and what follows it.
 *
 * The article opens on the outlet's own site - the full text is theirs, and so
 * is the visit. When the reader comes back, and the story's issue has two sides
 * to be on, one question waits for them: where on the axis would they put what
 * they just read. One tap answers it; nothing has to be dragged.
 */
export function ReadingProvider({ children }: { children: React.ReactNode }) {
    const [asking, setAsking] = useState<NewsItem | null>(null);
    const [poles, setPoles] = useState<TopicPoles>({});
    useEffect(() => { getTopicPoles().then(setPoles).catch(() => {}); }, []);

    const open: Opener = (item, { outlets, positions, from }) => {
        track("article_opened", {
            outlet_bloc: positions[item.source]?.bloc ?? "unknown",
            topic: item.topic, section: item.section, outlets, mode: from,
        });
        saveWatch({ id: item.id, site: item.source, topic: item.topic, date: Date.now() });
        Linking.openURL(item.link);
        if (Platform.OS === "web" && typeof document !== "undefined") {
            const left = Date.now();
            const back = () => {
                if (document.visibilityState !== "visible") return;
                document.removeEventListener("visibilitychange", back);
                track("returned_from_article", { away_s: Math.min(3600, Math.round((Date.now() - left) / 1000)) });
            };
            document.addEventListener("visibilitychange", back);
        }
        if (isRatable(item)) setAsking(item);
    };

    return (
        <ReadingContext.Provider value={open}>
            {children}
            <RatePrompt item={asking} poles={asking ? poles[asking.topic] : undefined} onDone={() => setAsking(null)} />
        </ReadingContext.Provider>
    );
}

/** the axis's eleven steps, +5 at the right edge and -5 at the left: the axis lies the way the map does */
const STEPS = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];

/** where an article stands on its issue's axis, in one tap, with the issue's two poles over the ends */
export function Steps({ value, onChange, poles }: {
    value: number | null; onChange: (v: number) => void; poles?: { right: string; left: string };
}) {
    const { c } = useSite();
    const ink = (v: number) => (v > 0 ? c.right : v < 0 ? c.left : c.ink);
    const tint = (v: number) => (v > 0 ? c.rightTint : v < 0 ? c.leftTint : c.sunk);
    return (
        <View style={styles.steps}>
            <View style={[styles.poles, { flexDirection: ROW }]}>
                <Text style={[TYPE.label, styles.pole, { color: c.right }]}>{poles?.right ?? "ימין"}</Text>
                <Text style={[TYPE.label, styles.pole, { color: c.left, textAlign: "left" }]}>{poles?.left ?? "שמאל"}</Text>
            </View>
            <View style={[styles.scale, { flexDirection: ROW }]}>
                {STEPS.map((v) => {
                    const on = value === v;
                    return (
                        <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={v === 0 ? "באמצע" : v > 0 ? `${v} לכיוון ${poles?.right ?? "הימין"}` : `${-v} לכיוון ${poles?.left ?? "השמאל"}`}
                            style={[styles.step, { backgroundColor: on ? ink(v) : tint(v) }]}>
                            <Text style={[styles.stepText, { color: on ? "#FFFFFF" : ink(v) }]}>{Math.abs(v)}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

function RatePrompt({ item, poles, onDone }: { item: NewsItem | null; poles?: { right: string; left: string }; onDone: () => void }) {
    const { c } = useSite();
    const still = useStillness();
    const insets = useSafeAreaInsets();
    const [value, setValue] = useState<number | null>(null);
    const [sent, setSent] = useState(false);
    // the article being asked about, kept while the sheet slides away after it is gone
    const [target, setTarget] = useState<NewsItem | null>(item);
    if (item && item !== target) {
        setTarget(item);
        setValue(null);
        setSent(false);
    }
    const shown = useSharedValue(0);

    useEffect(() => {
        shown.value = withTiming(item ? 1 : 0, { duration: still ? 0 : item ? 280 : 190, easing: Easing.out(Easing.cubic) });
    }, [item, still, shown]);
    const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * 420 }] }));

    if (!target) return null;

    const close = () => {
        if (!sent) track("rating_dismissed", { topic: target.topic });
        onDone();
    };
    const send = () => {
        if (value === null) return;
        saveRating({ id: target.id, source: target.source, topic: target.topic, value, createdAt: Date.now() });
        track("rating_submitted", { topic: target.topic, value, blind: false });
        setSent(true);
        setTimeout(onDone, 900);
    };

    return (
        <Animated.View pointerEvents={item ? "auto" : "none"}
            style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 18 }, sheet]}
            accessibilityViewIsModal>
            <View style={[styles.grab, { backgroundColor: c.rule }]} />
            <View style={[styles.head, { flexDirection: ROW }]}>
                <Text style={[TYPE.label, styles.headText, { color: c.muted }]} numberOfLines={1}>{target.source}, על {target.topic}</Text>
                <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="לא עכשיו"
                    style={[styles.close, { backgroundColor: c.sunk }]}>
                    <Ionicons name="close" size={22} color={c.ink} />
                </Pressable>
            </View>
            {sent ? (
                <View style={[styles.sent, { flexDirection: ROW }]}>
                    <Ionicons name="checkmark-circle" size={28} color={c.brand} />
                    <Text style={[TYPE.section, { color: c.ink }]}>נשמר. תודה.</Text>
                </View>
            ) : (
                <>
                    <Text style={[TYPE.section, { color: c.ink }]}>איפה הייתם מציבים את הכתבה שקראתם?</Text>
                    <Steps value={value} onChange={setValue} poles={poles} />
                    <Pressable onPress={send} disabled={value === null} accessibilityRole="button"
                        style={[styles.send, { backgroundColor: value === null ? c.rule : c.brand }]}>
                        <Text style={[TYPE.uiStrong, { color: value === null ? c.muted : c.brandInk }]}>שליחה</Text>
                    </Pressable>
                    <Text style={[TYPE.meta, { color: c.muted }]}>דירוגי הקוראים הם מה שמזיז את עמדות הגופים לאורך זמן.</Text>
                </>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    sheet: {
        position: "absolute", left: 0, right: 0, bottom: 0,
        paddingHorizontal: 18, paddingTop: 10, gap: 14,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        boxShadow: "0 -10px 40px rgba(10,10,30,0.2)",
    },
    grab: { width: 40, height: 5, borderRadius: 3, alignSelf: "center" },
    head: { justifyContent: "space-between", alignItems: "center", gap: 10 },
    headText: { flex: 1 },
    close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    sent: { alignItems: "center", gap: 10, paddingVertical: 18 },
    steps: { gap: 8 },
    poles: { justifyContent: "space-between", gap: 12 },
    pole: { flex: 1 },
    scale: { gap: 4 },
    step: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    stepText: { fontFamily: FACE.bold, fontSize: 15, fontVariant: ["tabular-nums"] },
    send: { height: 50, borderRadius: RADIUS.button, alignItems: "center", justifyContent: "center" },
});
