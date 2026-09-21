import { CompanyItem } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import OutletDot, { DOT } from './outletDot';
import { OUTLINE } from './viewModeToggle';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
// a third accent that reads as "chosen" without competing with the two bloc inks
const SELECT = "#DDA01E";
const AXIS = "#D9D6CF";
const POLE = "#A29E96";
const BREAKING_POINT = 0;

/** room to the right of the plot for the x axis's name */
const X_TITLE_W = 62;
/** the x axis's name may reach this far into the page's side margin, which buys the plot width */
const OVERHANG = 10;
const GAP = 4;
/** room above the plot for the y axis's name */
const Y_TITLE_H = 20;
const BADGE = 80;

// The plot is laid out with physical left/right. On a phone the app runs in RTL
// layout, which would mirror every left/right here, so the chart is pinned to LTR.
// The web build is LTR already and rejects the style.
const LTR = Platform.OS === "web" ? null : { direction: "ltr" as const };

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
const TopicQuadrant = ({ poles, topicX, dataX, topicY, dataY, setDetailSource, selected }: Props) => {
    const px = poles[topicX] ?? { right: "בעד", left: "נגד" };
    const py = poles[topicY] ?? { right: "בעד", left: "נגד" };
    const [width, setWidth] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
    const plot = width ? width + OVERHANG - X_TITLE_W - GAP : 0;

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

    // Outlets with near-identical scores would stack their markers and hide each
    // other's letters. Each one that lands on a marker already placed steps aside
    // along a widening ring until it clears - a few pixels, small next to the scale.
    const laidOut = useMemo(() => {
        if (!plot) return [];
        const placed: { x: number; y: number }[] = [];
        const clear = (x: number, y: number) => placed.every((q) => Math.hypot(q.x - x, q.y - y) >= DOT - 2);
        const place = (x0: number, y0: number) => {
            if (clear(x0, y0)) return { x: x0, y: y0 };
            for (let r = 6; r <= 24; r += 6) {
                for (let k = 0; k < 8; k++) {
                    const a = (k / 8) * Math.PI * 2;
                    const x = x0 + r * Math.cos(a);
                    const y = y0 + r * Math.sin(a);
                    if (clear(x, y)) return { x, y };
                }
            }
            return { x: x0, y: y0 };
        };
        return points.map((p) => {
            const at = place(norm(p.x) * plot, (1 - norm(p.y)) * plot);
            placed.push(at);
            return { ...p, cx: at.x, cy: at.y };
        });
    }, [points, plot]);

    // the chosen marker is drawn last, so its ring is never under a neighbour
    const drawOrder = [...laidOut].sort((a, b) => Number(a.source === selected) - Number(b.source === selected));

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>{topicX}  ×  {topicY}</Text>

            <View style={[styles.chart, LTR, { height: Y_TITLE_H + plot }]} onLayout={onLayout}>
                {plot > 0 && (
                    <>
                        {/* the y axis's name sits on top of its line, the x axis's at the end of its */}
                        <Text style={[styles.yTitle, { width: plot }]} numberOfLines={1}>{topicY}</Text>
                        <View style={[styles.xTitleBox, { left: plot + GAP, top: Y_TITLE_H + plot / 2 - 20 }]}>
                            <Text style={styles.xTitle} numberOfLines={2}>{topicX}</Text>
                        </View>

                        <View style={[styles.plot, { top: Y_TITLE_H, width: plot, height: plot }]}>
                            <View style={styles.hLine} />
                            <View style={styles.vLine} />
                            <Text style={[styles.pole, { top: 3, left: plot / 2 + 5 }]} numberOfLines={1}>{py.right}</Text>
                            <Text style={[styles.pole, { bottom: 3, left: plot / 2 + 5 }]} numberOfLines={1}>{py.left}</Text>
                            <Text style={[styles.pole, { top: plot / 2 + 3, right: 6, textAlign: "right" }]} numberOfLines={1}>{px.right}</Text>
                            <Text style={[styles.pole, { top: plot / 2 + 3, left: 6 }]} numberOfLines={1}>{px.left}</Text>

                            {selected && (
                                <View style={styles.badge}>
                                    <Text style={[styles.badgeText, OUTLINE]} numberOfLines={2}>{selected}</Text>
                                </View>
                            )}

                            {drawOrder.map((p) => (
                                <OutletDot
                                    key={p.source}
                                    source={p.source}
                                    colour={colourOf(p.x, p.y)}
                                    x={p.cx}
                                    y={p.cy}
                                    selected={p.source === selected}
                                    onPress={() => setDetailSource(p.source)}
                                />
                            ))}
                        </View>
                    </>
                )}
            </View>
        </View>
    );
};

export default TopicQuadrant;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 8 },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 15, color: "#111827", textAlign: "right" },

    chart: { width: "100%" },
    yTitle: {
        position: "absolute", top: 0, left: 0, height: Y_TITLE_H,
        fontFamily: "Heebo_700Bold", fontSize: 11, color: "#6B7280", textAlign: "center",
    },
    xTitleBox: { position: "absolute", width: X_TITLE_W, height: 40, justifyContent: "center" },
    xTitle: { fontFamily: "Heebo_700Bold", fontSize: 11, lineHeight: 15, color: "#6B7280", textAlign: "center" },

    plot: { position: "absolute", left: 0, backgroundColor: "#FAFAF9", borderRadius: 10 },
    // both lines run edge to edge, so each carries on straight into its axis's name
    hLine: { position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: AXIS },
    vLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: AXIS },
    pole: { position: "absolute", fontFamily: "Heebo_500Medium", fontSize: 9.5, color: POLE, maxWidth: 120 },

    badge: {
        position: "absolute", left: 8, top: 8, width: BADGE, height: BADGE, borderRadius: BADGE / 2,
        backgroundColor: SELECT, alignItems: "center", justifyContent: "center", padding: 5,
    },
    // the same size as the outlet's name heading its detail below the chart
    badgeText: { fontFamily: "Heebo_800ExtraBold", fontSize: 17, lineHeight: 20, color: "#FFFFFF", textAlign: "center" },

});
