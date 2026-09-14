import { CompanyItem } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
// a third accent that reads as "chosen" without competing with the two bloc inks
const SELECT = "#DDA01E";
const SELECT_SOFT = "#FBF1DA";
const BREAKING_POINT = 0;

type Props = {
    poles: import("@/state/engagement").TopicPoles;
    topicX: string;
    dataX: CompanyItem[];
    topicY: string;
    dataY: CompanyItem[];
    setDetailSource: (source: string) => void;
    selected?: string;
}

/**
 * Two topics at once. An outlet's horizontal place is its score on one issue and
 * its vertical place its score on the other, so a flat left-right reading breaks
 * apart: the haredi papers land bottom-right on economy-vs-religion, which no
 * single axis can show.
 */
const LABEL_W = 54;
const LABEL_H = 13;

const TopicQuadrant = ({ poles, topicX, dataX, topicY, dataY, setDetailSource, selected }: Props) => {
    const px = poles[topicX] ?? { right: "בעד", left: "נגד" };
    const py = poles[topicY] ?? { right: "בעד", left: "נגד" };
    const [size, setSize] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout.width);

    const points = useMemo(() => {
        const byY = new Map(dataY.map((d) => [d.source, d.bias]));
        return dataX
            .filter((d) => byY.has(d.source))
            .map((d) => ({
                source: d.source,
                x: d.bias,
                y: byY.get(d.source) as number,
            }));
    }, [dataX, dataY]);

    // -5..5 -> 0..1 with an inset so markers never sit on the frame
    const norm = (v: number) => 0.08 + ((v + 5) / 10) * 0.84;
    const colourOf = (x: number, y: number) => {
        const mean = (x + y) / 2;
        return mean >= BREAKING_POINT ? RIGHT : LEFT;
    };

    // Markers land wherever the data puts them, and labels collide. Walk them in
    // order and nudge each one down until it clears the labels already placed -
    // a dot with an unreadable name is worse than no name at all.
    const laidOut = useMemo(() => {
        if (!size) return [];
        const placed: { x: number; y: number }[] = [];
        return points
            .map((p) => ({ ...p, px: norm(p.x) * size, py: (1 - norm(p.y)) * size }))
            .sort((a, b) => a.py - b.py)
            .map((p) => {
                let labelY = p.py;
                let guard = 0;
                while (
                    guard++ < 40 &&
                    placed.some((q) => Math.abs(q.x - p.px) < LABEL_W && Math.abs(q.y - labelY) < LABEL_H)
                ) {
                    labelY += LABEL_H;
                }
                placed.push({ x: p.px, y: labelY });
                return { ...p, labelY };
            });
    }, [points, size]);

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Text style={styles.title}>{topicX}  ×  {topicY}</Text>
            </View>

            <View style={styles.plotRow}>
                <Text style={styles.yLabel} numberOfLines={2}>{topicY}</Text>

                <View style={styles.plot} onLayout={onLayout}>
                    <View style={styles.hLine} />
                    <View style={styles.vLine} />
                    <Text style={[styles.tick, styles.tickTop]} numberOfLines={1}>{py.right}</Text>
                    <Text style={[styles.tick, styles.tickBottom]} numberOfLines={1}>{py.left}</Text>

                    {laidOut.map((p) => {
                        const on = p.source === selected;
                        return (
                            <React.Fragment key={p.source}>
                                <View pointerEvents="none" style={[styles.dotWrap, {
                                    left: p.px - 6, top: p.py - 6,
                                }]}>
                                    <View style={[styles.dot, { backgroundColor: colourOf(p.x, p.y) },
                                        on && styles.dotOn]} />
                                </View>
                                <TouchableOpacity
                                    style={[styles.labelWrap, { left: p.px - LABEL_W / 2, top: p.labelY + 5 },
                                        on && styles.labelWrapOn]}
                                    onPress={() => setDetailSource(p.source)}
                                >
                                    <Text style={[styles.label, { color: colourOf(p.x, p.y) },
                                        on && styles.labelOn]} numberOfLines={1}>
                                        {p.source}
                                    </Text>
                                </TouchableOpacity>
                            </React.Fragment>
                        );
                    })}
                </View>
            </View>

            <View style={styles.xAxis}>
                <Text style={[styles.end, { color: LEFT }]} numberOfLines={1}>{px.left}</Text>
                <Text style={styles.xLabel} numberOfLines={1}>{topicX}</Text>
                <Text style={[styles.end, { color: RIGHT }]} numberOfLines={1}>{px.right}</Text>
            </View>
        </View>
    );
};

export default TopicQuadrant;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
    head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 15, color: "#111827", flex: 1, textAlign: "right" },
    count: { fontFamily: "Heebo_500Medium", fontSize: 11, color: "#6B7280" },

    plotRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    yLabel: {
        fontFamily: "Heebo_700Bold", fontSize: 10, color: "#6B7280",
        width: 58, textAlign: "center",
    },
    plot: { flex: 1, aspectRatio: 1, backgroundColor: "#FAFAF9", borderRadius: 10 },
    hLine: { position: "absolute", top: "50%", left: 8, right: 8, height: 1, backgroundColor: "#D9D6CF" },
    vLine: { position: "absolute", left: "50%", top: 8, bottom: 8, width: 1, backgroundColor: "#D9D6CF" },
    tick: { position: "absolute", fontFamily: "Heebo_500Medium", fontSize: 9, color: "#B6B2AA", left: "50%", marginLeft: 4, maxWidth: 110 },
    tickTop: { top: 4 },
    tickBottom: { bottom: 4 },

    dotWrap: { position: "absolute", width: 12, height: 12, alignItems: "center", justifyContent: "center" },
    dot: { width: 9, height: 9, borderRadius: 5 },
    dotOn: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: SELECT },
    labelWrap: { position: "absolute", width: LABEL_W, alignItems: "center" },
    labelWrapOn: {
        backgroundColor: SELECT_SOFT, borderRadius: 4,
        borderWidth: 1, borderColor: SELECT, paddingVertical: 1,
    },
    label: { fontFamily: "Heebo_700Bold", fontSize: 8.5, textAlign: "center" },
    labelOn: { fontFamily: "Heebo_800ExtraBold", fontSize: 9.5 },

    xAxis: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", direction: "ltr", paddingLeft: 64 },
    xLabel: { fontFamily: "Heebo_700Bold", fontSize: 10, color: "#6B7280", flex: 1, textAlign: "center" },
    end: { fontFamily: "Heebo_800ExtraBold", fontSize: 10.5, maxWidth: 110 },
});
