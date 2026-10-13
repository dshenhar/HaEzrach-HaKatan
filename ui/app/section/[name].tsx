import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { sectionColour, TYPE, useSite } from "@/site/tokens";
import { byNewest, pickLead, useNews } from "@/site/news";
import { Screen } from "@/site/page";
import { Hero } from "@/site/stories";
import { Skeleton } from "@/site/controls";
import River from "@/site/river";

/** One section of the news, in its colour: its biggest story on top, then the rest of the day in it. */
export default function SectionScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const section = String(name ?? "");
    const { c } = useSite();
    const { readings, loading } = useNews();
    const mine = useMemo(() => readings.filter((r) => r.section === section).sort(byNewest), [readings, section]);
    const lead = pickLead(mine);
    const told = mine.reduce((n, r) => n + r.total, 0);

    const head = (
        <>
            <Text style={[TYPE.screen, { color: c.onColour }]} accessibilityRole="header">{section}</Text>
            {mine.length > 0 && (
                <Text style={[TYPE.uiStrong, { color: c.onColourMuted }]}>
                    {mine.length === 1 ? "סיפור אחד היום" : `${mine.length} סיפורים היום`}  ·  {told === 1 ? "כתבה אחת" : `${told} כתבות`}
                </Text>
            )}
        </>
    );

    return (
        <Screen back docTitle={section} colour={sectionColour(section)} head={head}>
            {loading && !readings.length ? <Skeleton tall cards={2} /> : !mine.length ? (
                <Text style={[TYPE.body, styles.empty, { color: c.muted }]}>אין היום סיפורים במדור הזה.</Text>
            ) : (
                <>
                    {lead && <View style={styles.lead}><Hero r={lead} /></View>}
                    <View style={styles.river}>
                        <River readings={mine.filter((r) => r !== lead)} how={`section:${section}`} showSection={false} />
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    empty: { paddingHorizontal: 18, paddingTop: 20 },
    lead: { paddingTop: 12 },
    river: { marginTop: 22 },
});
