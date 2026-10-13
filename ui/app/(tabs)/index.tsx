import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { isNudgeOff, stopNudging } from "@/state/profile";
import { useQuestionnaire } from "@/state/questionnaire";
import { track } from "@/state/analytics";
import { FACE, RADIUS, ROW, sectionColour, TYPE, useSite } from "@/site/tokens";
import { ago, byNewest, hebrewDate, longDate, outlets, pickLead, Reading, Side, useNews } from "@/site/news";
import { Go, Screen, SectionHead, Shelf } from "@/site/page";
import { Hero, ShelfCard, useOpenStory } from "@/site/stories";
import { Button, Chips, sectionChips, Skeleton } from "@/site/controls";
import River from "@/site/river";

/**
 * Today. At the top the day and the sections, each in its colour; then the
 * story the most outlets told, with how each side told it; the next biggest on
 * a shelf; what one side ran and the other did not, on the highlighter; the
 * controversies; and every story of the day.
 */
export default function Today() {
    const { c } = useSite();
    const { readings, sections, loading, failed, refresh } = useNews();
    const [section, setSection] = useState("");

    const mine = useMemo(() => (section ? readings.filter((r) => r.section === section) : readings), [readings, section]);
    const { lead, top, rest } = useMemo(() => {
        const first = pickLead(mine);
        const others = mine.filter((r) => r !== first);
        const biggest = [...others].sort((a, b) => b.total - a.total || byNewest(a, b));
        return { lead: first, top: section ? [] : biggest.slice(0, 6), rest: others };
    }, [mine, section]);

    return (
        <Screen search>
            <DateLine />
            {sections.length > 0 && (
                <View style={styles.chips}>
                    <Chips label="מדורים" items={sectionChips(sections)} value={section}
                        onChange={(next) => { track("section_opened", { section: next || "all", from: "chips" }); setSection(next); }} />
                </View>
            )}

            {loading && !readings.length ? (
                <View style={styles.loading}><Skeleton tall cards={3} /></View>
            ) : failed && !readings.length ? (
                <View style={[styles.failed, { backgroundColor: c.card }]}>
                    <Ionicons name="cloud-offline-outline" size={34} color={c.muted} />
                    <Text style={[TYPE.title, { color: c.ink, textAlign: "center" }]}>החדשות לא נטענו.</Text>
                    <Button label="לנסות שוב" onPress={refresh} />
                </View>
            ) : (
                <>
                    {lead && <View style={styles.hero}><Hero r={lead} /></View>}

                    {top.length > 0 && (
                        <>
                            <SectionHead title="עוד בראש החדשות" />
                            <Shelf>{top.map((r) => <ShelfCard key={r.id} r={r} how="top" />)}</Shelf>
                        </>
                    )}

                    {!section && readings.length > 0 && <BlindModule readings={readings} />}
                    {!section && <ControversyShelf />}
                    {!section && <QuestionnaireOffer />}

                    {rest.length > 0 && (
                        <>
                            <SectionHead title={section ? `עוד ב${section}` : "כל הסיפורים של היום"} count={rest.length} />
                            <River key={section} readings={rest} how={section ? `section:${section}` : "river"} showSection={!section} />
                        </>
                    )}
                </>
            )}
        </Screen>
    );
}

/** the day, both ways, and how fresh the paper is */
function DateLine() {
    const { c } = useSite();
    const { updated } = useNews();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60 * 1000);
        return () => clearInterval(t);
    }, []);
    const hebrew = hebrewDate(now);
    return (
        <View style={[styles.dateLine, { flexDirection: ROW }]}>
            <Text style={[TYPE.meta, styles.date, { color: c.ink2 }]} numberOfLines={1}>
                {longDate(now)}{hebrew ? `  ·  ${hebrew}` : ""}
            </Text>
            {!!updated && (
                <View style={[styles.fresh, { flexDirection: ROW }]}>
                    <View style={[styles.liveDot, { backgroundColor: "#16A34A" }]} />
                    <Text style={[TYPE.meta, { color: c.muted }]}>{ago(updated)}</Text>
                </View>
            )}
        </View>
    );
}

/**
 * The blindspots, on the highlighter: what two or more outlets on one side ran
 * and no outlet on the other did, a side at a time. The reader's own blind side
 * comes up first when they have said where they stand.
 */
function BlindModule({ readings }: { readings: Reading[] }) {
    const { c } = useSite();
    const { profile } = useQuestionnaire();
    const open = useOpenStory();
    // a side here is the side that left the story out
    const lists = {
        left: readings.filter((r) => r.missing === "left").sort(byNewest),
        right: readings.filter((r) => r.missing === "right").sort(byNewest),
    };
    const [side, setSide] = useState<Side>(() =>
        profile ? profile.bloc : lists.left.length >= lists.right.length ? "left" : "right");
    if (!lists.left.length && !lists.right.length) return null;
    const list = lists[side];
    const tab = (missing: Side) => {
        const on = side === missing;
        const yours = profile?.bloc === missing;
        return (
            <Pressable key={missing} onPress={() => { track("blindspot_side", { side: missing }); setSide(missing); }}
                accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.blindTab, { backgroundColor: on ? c.hiInk : "rgba(0,0,0,0.07)" }]}>
                <Text style={[styles.blindTabText, { color: on ? c.hi : c.hiInk }]}>
                    {missing === "left" ? "רק הימין סיקר" : "רק השמאל סיקר"}
                </Text>
                <Text style={[styles.blindTabCount, { color: on ? c.hi : c.hiInk }]}>
                    {lists[missing].length}{yours ? "  ·  הצד שלכם פספס" : ""}
                </Text>
            </Pressable>
        );
    };
    return (
        <View style={[styles.blind, { backgroundColor: c.hi }]}>
            <View style={[styles.blindHead, { flexDirection: ROW }]}>
                <Ionicons name="eye-off" size={22} color={c.hiInk} />
                <Text style={[TYPE.section, { color: c.hiInk, flex: 1 }]} accessibilityRole="header">נקודות עיוורות</Text>
            </View>
            <Text style={[TYPE.small, { color: c.hiInk }]}>
                סיפורים ששני גופים או יותר מצד אחד של המפה סיקרו, ואף גוף מהצד השני לא.
            </Text>
            <View style={[styles.blindTabs, { flexDirection: ROW }]} accessibilityRole="tablist">
                {tab("left")}
                {tab("right")}
            </View>
            {list.length === 0 ? (
                <Text style={[TYPE.small, { color: c.hiInk, paddingVertical: 10 }]}>אין היום.</Text>
            ) : list.slice(0, 3).map((r) => (
                <Pressable key={r.id} onPress={() => open(r, "blindspot_module")} accessibilityRole="link"
                    style={({ pressed }) => [styles.blindItem, { backgroundColor: c.card }, pressed && styles.pressed]}>
                    <View style={[styles.blindItemTop, { flexDirection: ROW }]}>
                        <View style={[styles.blindDot, { backgroundColor: sectionColour(r.section) }]} />
                        <Text style={[TYPE.meta, { color: c.muted }]}>{r.section}</Text>
                        <Text style={[TYPE.meta, { color: side === "left" ? c.right : c.left }]}>
                            {outlets(side === "left" ? r.right : r.left)} מה{side === "left" ? "ימין" : "שמאל"}
                        </Text>
                    </View>
                    <Text style={[TYPE.row, { color: c.ink }]} numberOfLines={3}>{r.lead.title}</Text>
                </Pressable>
            ))}
            <Go href="/blindspots" plain label="לכל הנקודות העיוורות">
                <View style={[styles.blindMore, { flexDirection: ROW }]}>
                    <Text style={[TYPE.uiStrong, { color: c.hiInk }]}>לכל הנקודות העיוורות</Text>
                    <Ionicons name="arrow-back" size={18} color={c.hiInk} />
                </View>
            </Go>
        </View>
    );
}

/** the affairs the right and the left are split on, the ones in today's news first, each in its colour */
function ControversyShelf() {
    const { c } = useSite();
    const { hot, hotOrdered, tileOf } = useNews();
    const router = useRouter();
    if (!hot || !hotOrdered.length) return null;
    const shown = hotOrdered.slice(0, 8);
    return (
        <>
            <SectionHead title="מחלוקות" more={{ href: "/controversies", label: "הכל" }} />
            <Shelf>
                {shown.map((t) => (
                    <Pressable key={t.id} accessibilityRole="link" accessibilityLabel={t.title}
                        onPress={() => { track("hot_topic_opened", { id: t.id, from: "front" }); router.push({ pathname: "/controversies/[id]", params: { id: t.id } }); }}
                        style={({ pressed }) => [styles.tile, { backgroundColor: tileOf(t.id) }, pressed && styles.pressed]}>
                        {hot.today.includes(t.id) && (
                            <View style={[styles.tileBadge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                                <Text style={[styles.tileBadgeText, { color: c.onColour }]}>בחדשות היום</Text>
                            </View>
                        )}
                        <Text style={[TYPE.title, { color: c.onColour }]} numberOfLines={3}>{t.title}</Text>
                        <Text style={[TYPE.small, { color: c.onColourMuted }]} numberOfLines={4}>{t.one_line}</Text>
                    </Pressable>
                ))}
            </Shelf>
        </>
    );
}

/**
 * The one thing the app asks of a reader, offered and not demanded: a minute of
 * answers, so that "the other side" can mean their other side. Once declined it
 * stays declined.
 */
function QuestionnaireOffer() {
    const { c } = useSite();
    const { filled, open } = useQuestionnaire();
    const [quiet, setQuiet] = useState(true);
    useEffect(() => { isNudgeOff().then(setQuiet); }, []);
    if (filled || quiet) return null;
    return (
        <View style={[styles.offer, { backgroundColor: c.brand }]}>
            <Text style={[TYPE.section, { color: c.brandInk }]}>ומה איתכם?</Text>
            <Text style={[TYPE.small, { color: c.brandInk, opacity: 0.9 }]}>
                שאלון עמדות קצר, כדקה, מאפשר להשוות בין מה שאתם חושבים לבין מה שאתם קוראים בפועל,
                ולהראות לכם כמה מהחדשות הגיעו דווקא מהצד השני. התשובות נשארות במכשיר שלכם.
            </Text>
            <View style={[styles.offerActions, { flexDirection: ROW }]}>
                <Button label="למילוי השאלון" onColour={c.brand}
                    onPress={() => { track("questionnaire_opened", { from: "front" }); open(); }} />
                <Button quiet label="לא עכשיו" onColour={c.brand}
                    onPress={() => { track("questionnaire_silenced"); stopNudging(); setQuiet(true); }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
    dateLine: { justifyContent: "space-between", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
    date: { flexShrink: 1 },
    fresh: { alignItems: "center", gap: 6 },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    chips: { marginBottom: 14 },
    loading: { paddingTop: 4 },
    failed: { marginHorizontal: 12, borderRadius: RADIUS.card, padding: 28, alignItems: "center", gap: 14 },
    hero: {},

    blind: { marginHorizontal: 12, marginTop: 30, borderRadius: 24, padding: 16, gap: 12 },
    blindHead: { alignItems: "center", gap: 8 },
    blindTabs: { gap: 8 },
    blindTab: { flex: 1, borderRadius: RADIUS.inner, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
    blindTabText: { fontFamily: FACE.bold, fontSize: 14.5, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
    blindTabCount: { fontFamily: FACE.medium, fontSize: 12.5, lineHeight: 16, textAlign: "right", writingDirection: "rtl", fontVariant: ["tabular-nums"] },
    blindItem: { borderRadius: RADIUS.inner, padding: 13, gap: 6 },
    blindItemTop: { alignItems: "center", gap: 8 },
    blindDot: { width: 8, height: 8, borderRadius: 4 },
    blindMore: { alignItems: "center", justifyContent: "space-between", paddingTop: 2 },

    tile: { width: 228, minHeight: 190, borderRadius: 22, padding: 16, gap: 8 },
    tileBadge: { alignSelf: "flex-end", borderRadius: RADIUS.chip, paddingHorizontal: 9, paddingVertical: 3 },
    tileBadgeText: { fontFamily: FACE.semi, fontSize: 12, lineHeight: 16 },

    offer: { marginHorizontal: 12, marginTop: 30, borderRadius: 24, padding: 18, gap: 10 },
    offerActions: { gap: 10, marginTop: 6 },
});
