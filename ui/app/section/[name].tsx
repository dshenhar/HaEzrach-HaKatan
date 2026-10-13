import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSite } from "@/site/tokens";
import { byNewest, pickLead, useNews } from "@/site/news";
import { Page, Wrap } from "@/site/page";
import { Lead } from "@/site/stories";
import { Skeleton } from "@/site/controls";
import River from "@/site/river";

/** One section of the paper: its biggest story on top, then the rest of the day in it. */
export default function SectionPage() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const section = String(name ?? "");
    const { c, type, wide } = useSite();
    const { readings, loading } = useNews();
    const mine = useMemo(() => readings.filter((r) => r.section === section).sort(byNewest), [readings, section]);
    const lead = pickLead(mine);

    return (
        <Page back title={section} nav={`section:${section}`}>
            <Wrap style={styles.page}>
                <Text style={[type.h1, styles.title, { color: c.ink, borderBottomColor: c.ruleStrong }]} accessibilityRole="header">{section}</Text>
                {loading && !readings.length ? <Skeleton lines={4} big /> : !mine.length ? (
                    <Text style={[type.body, { color: c.muted }]}>אין היום סיפורים במדור הזה.</Text>
                ) : (
                    <>
                        {lead && <View style={[styles.lead, wide && styles.leadWide]}><Lead r={lead} /></View>}
                        <View style={[styles.river, wide && styles.riverWide]}>
                            <River readings={mine.filter((r) => r !== lead)} how={`section:${section}`} showSection={false} />
                        </View>
                    </>
                )}
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    page: { paddingTop: 22 },
    title: { borderBottomWidth: 3, paddingBottom: 12, marginBottom: 22 },
    lead: {},
    leadWide: { maxWidth: 820, alignSelf: "flex-end", width: "100%" },
    river: { marginTop: 36 },
    riverWide: { maxWidth: 820, alignSelf: "flex-end", width: "100%" },
});
