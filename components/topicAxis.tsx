import { CompanyItem } from '@/state/engagement';
import React, { useMemo, useState } from 'react';
import { I18nManager, LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import OutletDot, { DOT } from './outletDot';
import { OUTLINE } from './viewModeToggle';

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const SELECT = "#DDA01E";
const AXIS = "#D9D6CF";
const POLE = "#A29E96";
const BREAKING_POINT = 0;   // mirrors BREAKING_POINT in the server: no neutral band

/** vertical distance between stacked markers */
const STEP = DOT - 2;
/** keeps the outermost markers inside the panel */
const INSET = DOT / 2 + 6;
const PAD = 8;

// The panel is laid out with physical left/right, and a phone runs the app in RTL
// layout, which would mirror it; the web build is LTR already and rejects the style.
const LTR = Platform.OS === "web" ? null : { direction: "ltr" as const };
// the heading row reads right to left on both
const RTL_ROW = I18nManager.isRTL ? "row" : "row-reverse";

type Props = {
    poles: import("@/state/engagement").TopicPoles;
    topic: string;
    data: CompanyItem[];
    setDetailSource: (source: string) => void;
    selected?: string;
}

/**
 * Where every outlet sits on one topic, -5 to +5. The breaking point is drawn as
 * a thin line rather than a gap: an outlet a tenth of a point either side of it
 * is in a different bloc, and that is meant to look as arbitrary as it is.
 */
const TopicAxis = ({ poles, topic, data, setDetailSource, selected }: Props) => {
    const p = poles[topic] ?? { right: "בעד", left: "נגד" };
    const [width, setWidth] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    // Every marker keeps its exact place along the axis. One that would cover a
    // neighbour moves to the nearest free row above or below the line instead, so
    // outlets that agree pile up in plain sight rather than hiding each other.
    const { dots, rows } = useMemo(() => {
        if (!width) return { dots: [], rows: 0 };
        const placed: { x: number; row: number }[] = [];
        let rows = 0;
        const dots = [...data]
            .sort((a, b) => a.bias - b.bias)
            .map((item) => {
                const x = INSET + ((item.bias + 5) / 10) * (width - INSET * 2);
                let row = 0;
                for (let n = 1; placed.some((q) => q.row === row && Math.abs(q.x - x) < DOT - 2); n++) {
                    row = n % 2 ? -Math.ceil(n / 2) : n / 2;   // 0, -1, 1, -2, 2 ...
                }
                placed.push({ x, row });
                rows = Math.max(rows, Math.abs(row));
                return { item, x, row };
            })
            // the chosen marker is drawn last, so its ring is never under a neighbour
            .sort((a, b) => Number(a.item.source === selected) - Number(b.item.source === selected));
        return { dots, rows };
    }, [data, width, selected]);

    const height = PAD * 2 + rows * STEP * 2 + DOT;
    const mid = height / 2;
    const colourOf = (bias: number) => (bias >= BREAKING_POINT ? RIGHT : LEFT);

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Text style={styles.topic}>{topic}</Text>
                {!!selected && (
                    <View style={styles.chosen}>
                        <Text style={[styles.chosenText, OUTLINE]} numberOfLines={1}>{selected}</Text>
                    </View>
                )}
            </View>

            <View style={[styles.panel, LTR, { height }]} onLayout={onLayout}>
                <View style={[styles.line, { top: mid - 0.5 }]} />
                <View style={styles.breakpoint} />
                {dots.map(({ item, x, row }) => (
                    <OutletDot
                        key={item.source}
                        source={item.source}
                        colour={colourOf(item.bias)}
                        x={x}
                        y={mid + row * STEP}
                        selected={item.source === selected}
                        onPress={() => setDetailSource(item.source)}
                    />
                ))}
            </View>

            <View style={[styles.ends, LTR]}>
                <Text style={[styles.end, { textAlign: "left" }]} numberOfLines={1}>{p.left}</Text>
                <Text style={[styles.end, { textAlign: "center" }]} numberOfLines={1}>נקודת שבירה</Text>
                <Text style={[styles.end, { textAlign: "right" }]} numberOfLines={1}>{p.right}</Text>
            </View>
        </View>
    );
};

export default TopicAxis;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
    head: { flexDirection: RTL_ROW, justifyContent: "space-between", alignItems: "center", gap: 10 },
    topic: { fontFamily: "Heebo_800ExtraBold", fontSize: 17, color: "#111827", textAlign: "right", flexShrink: 1 },
    chosen: { backgroundColor: SELECT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, maxWidth: 170 },
    chosenText: { fontFamily: "Heebo_800ExtraBold", fontSize: 13, color: "#FFFFFF" },

    panel: { width: "100%", backgroundColor: "#FAFAF9", borderRadius: 10 },
    line: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: AXIS },
    breakpoint: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: AXIS },

    ends: { flexDirection: "row", alignItems: "center" },
    end: { flex: 1, fontFamily: "Heebo_500Medium", fontSize: 10, color: POLE },
});
