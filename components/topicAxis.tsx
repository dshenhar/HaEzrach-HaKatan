import { CompanyItem } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const BREAKING_POINT = 0;   // mirrors BREAKING_POINT in the server: no neutral band

type Props = {
    poles: import("@/state/engagement").TopicPoles;
    topic: string;
    data: CompanyItem[];
    setDetailSource: (source: string) => void;
    selected?: string;
}

const LANES = 4;   // labels would collide on one line, so they stagger

/**
 * Where every outlet sits on one topic, -5 to +5. The breaking point is drawn as
 * a thin line rather than a gap: an outlet a tenth of a point either side of it
 * is in a different bloc, and that is meant to look as arbitrary as it is.
 */
const TopicAxis = ({ poles, topic, data, setDetailSource, selected }: Props) => {
    const p = poles[topic] ?? { right: "בעד", left: "נגד" };
    const [width, setWidth] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    const placed = useMemo(() => {
        return [...data]
            .sort((a, b) => a.bias - b.bias)
            .map((item, i) => ({
                item,
                // -5..5 -> 0..1, then inset so the widest label still fits
                pct: 0.06 + ((item.bias + 5) / 10) * 0.88,
                lane: i % LANES,
            }));
    }, [data]);

    const colourOf = (bias: number) =>
        bias >= BREAKING_POINT ? RIGHT : LEFT;

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Text style={styles.topic}>{topic}</Text>
            </View>

            <View style={styles.plot} onLayout={onLayout}>
                <View style={styles.line} />
                <View style={[styles.breakpoint, { left: "50%" }]} />

                {width > 0 && placed.map(({ item, pct, lane }) => (
                    <TouchableOpacity
                        key={item.source}
                        style={[styles.marker, { left: pct * width - 4, top: 22 + lane * 26 }]}
                        onPress={() => setDetailSource(item.source)}
                    >
                        <View style={[styles.dot, { backgroundColor: colourOf(item.bias) },
                            item.source === selected && styles.dotOn]} />
                        <Text style={[styles.label, { color: colourOf(item.bias) },
                            item.source === selected && styles.labelOn]} numberOfLines={1}>
                            {item.source}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.ends}>
                <Text style={[styles.end, { color: LEFT }]} numberOfLines={1}>{p.left}</Text>
                <Text style={styles.mid}>נקודת שבירה</Text>
                <Text style={[styles.end, { color: RIGHT }]} numberOfLines={1}>{p.right}</Text>
            </View>
        </View>
    );
};

export default TopicAxis;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
    head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    topic: { fontFamily: "Heebo_800ExtraBold", fontSize: 17, color: "#111827", textAlign: "right" },
    count: { fontFamily: "Heebo_500Medium", fontSize: 11, color: "#6B7280" },
    plot: { height: 22 + LANES * 26 + 6, width: "100%" },
    line: { position: "absolute", top: 14, left: 0, right: 0, height: 2, backgroundColor: "#111827" },
    breakpoint: { position: "absolute", top: 6, height: 18, width: 1, backgroundColor: "#C9C6BF" },
    marker: { position: "absolute", alignItems: "center", gap: 3 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    label: { fontFamily: "Heebo_700Bold", fontSize: 10 },
    dotOn: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: "#DDA01E" },
    labelOn: { fontFamily: "Heebo_800ExtraBold", fontSize: 11 },
    ends: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", direction: "ltr" },
    end: { fontFamily: "Heebo_800ExtraBold", fontSize: 11.5, maxWidth: 140 },
    mid: { fontFamily: "Heebo_400Regular", fontSize: 10, color: "#9CA3AF" },
});
