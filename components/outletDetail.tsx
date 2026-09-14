import { CompanyDetailType, getRanksByCompany, TopicPoles } from '@/state/engagement';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";

type Props = {
    source: string;
    poles: TopicPoles;
}

/**
 * The selected outlet's position on every topic, shown in place under the map
 * rather than in a modal - so the chart and the breakdown stay visible together
 * and tapping around the chart is a browsing gesture, not a dialog to dismiss.
 */
const OutletDetail = ({ source, poles }: Props) => {
    const [ranks, setRanks] = useState<CompanyDetailType[] | null>(null);

    useEffect(() => {
        let live = true;
        setRanks(null);
        getRanksByCompany(source).then((data) => { if (live) setRanks(data); });
        return () => { live = false; };
    }, [source]);

    return (
        <View style={styles.panel}>
            <View style={styles.head}>
                <View>
                    <Text style={styles.name}>{source}</Text>
                    <View style={styles.nameRule} />
                </View>
                <Text style={styles.hint}>עמדה בכל נושא</Text>
            </View>

            {ranks === null ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollBody} nestedScrollEnabled>
                    {ranks.map((rank) => {
                        const p = poles[rank.topic] ?? { right: "בעד", left: "נגד" };
                        // -5..5 -> 0..1 measured from the left edge
                        const pct = ((rank.bias + 5) / 10) * 100;
                        const leaning = rank.bias >= 0 ? RIGHT : LEFT;
                        return (
                            <View key={rank.topic} style={styles.row}>
                                <View style={styles.rowHead}>
                                    <Text style={styles.topic} numberOfLines={1}>{rank.topic}</Text>
                                    <Text style={[styles.stance, { color: leaning }]} numberOfLines={1}>
                                        {rank.bias >= 0 ? p.right : p.left}
                                    </Text>
                                </View>
                                <View style={styles.track}>
                                    <View style={styles.midline} />
                                    <View style={[styles.fill, rank.bias >= 0
                                        ? { left: "50%", width: `${pct - 50}%`, backgroundColor: RIGHT }
                                        : { left: `${pct}%`, width: `${50 - pct}%`, backgroundColor: LEFT }]} />
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
};

export default OutletDetail;

const styles = StyleSheet.create({
    panel: { flex: 1, backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 16, padding: 14, gap: 8 },
    head: { flexDirection: "row-reverse", alignItems: "baseline", justifyContent: "space-between" },
    name: { fontFamily: "Heebo_800ExtraBold", fontSize: 17, color: "#111827" },
    nameRule: { height: 3, width: 26, borderRadius: 999, backgroundColor: "#DDA01E", marginTop: 3 },
    hint: { fontFamily: "Heebo_400Regular", fontSize: 11, color: "#9CA3AF" },
    scroll: { flex: 1 },
    scrollBody: { gap: 11, paddingBottom: 6 },

    row: { gap: 4 },
    rowHead: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 10 },
    topic: { fontFamily: "Heebo_500Medium", fontSize: 12.5, color: "#111827", flex: 1, textAlign: "right" },
    stance: { fontFamily: "Heebo_700Bold", fontSize: 11, maxWidth: 130 },
    // a bar that grows out from the centre, so the direction is the message
    track: { height: 7, borderRadius: 999, backgroundColor: "#F0EFEC", overflow: "hidden" },
    midline: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: "#DAD8D2" },
    fill: { position: "absolute", top: 0, bottom: 0, borderRadius: 999 },
});
