import { sectionColour } from '@/state/sections';
import { useTheme } from '@/state/theme';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type SortKey = "newest" | "oldest" | "covered" | "outside";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "newest", label: "מחדש לישן" },
    { key: "oldest", label: "מישן לחדש" },
    { key: "covered", label: "הכי מסוקר למעלה" },
    { key: "outside", label: "מחוץ לתיבת התהודה שלי" },
];

const FilterIcon = ({ colour }: { colour: string }) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Line x1="3" y1="7" x2="9" y2="7" stroke={colour} strokeWidth="2" strokeLinecap="round" />
        <Line x1="15" y1="7" x2="21" y2="7" stroke={colour} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="12" cy="7" r="2.6" stroke={colour} strokeWidth="2" />
        <Line x1="3" y1="17" x2="6" y2="17" stroke={colour} strokeWidth="2" strokeLinecap="round" />
        <Line x1="12" y1="17" x2="21" y2="17" stroke={colour} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="9" cy="17" r="2.6" stroke={colour} strokeWidth="2" />
    </Svg>
);

const SortIcon = ({ colour }: { colour: string }) => (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Path d="M7 4v16M7 4l-3 3.5M7 4l3 3.5" stroke={colour} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M17 20V4M17 20l-3-3.5M17 20l3-3.5" stroke={colour} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

type Props = {
    sections: string[];
    selectedSections: string[];
    onToggleSection: (section: string) => void;
    sort: SortKey;
    onSort: (key: SortKey) => void;
}

/**
 * One rail, right to left: the filter control sits at the right edge, the sort
 * control at the left, and whatever the reader has chosen fills the middle. Only
 * one of the two strips is open at a time - two open rails stack and swallow the
 * feed on a phone.
 */
const FeedControls = ({ sections, selectedSections, onToggleSection, sort, onSort }: Props) => {
    const [panel, setPanel] = useState<"none" | "filter" | "sort">("none");
    const t = useTheme();
    const dark = t.name === "negative";

    const active = selectedSections.filter((c) => c !== "הכל");
    const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "";
    const sortIsDefault = sort === "newest";

    return (
        <View style={[styles.wrap, { backgroundColor: t.bg }]}>
            <View style={styles.rail}>
                <TouchableOpacity
                    style={[styles.control, { borderColor: t.line, backgroundColor: t.surface },
                        panel === "filter" && { backgroundColor: t.text, borderColor: t.text }]}
                    onPress={() => setPanel(panel === "filter" ? "none" : "filter")}
                >
                    <FilterIcon colour={panel === "filter" ? t.surface : t.text} />
                    <Text style={[styles.controlText, { color: panel === "filter" ? t.surface : t.text }]}>
                        סינון{active.length ? ` · ${active.length}` : ""}
                    </Text>
                </TouchableOpacity>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chosen}>
                    {active.map((section) => (
                        <TouchableOpacity key={section}
                            style={[styles.chip, { backgroundColor: sectionColour(section, dark) }]}
                            onPress={() => onToggleSection(section)}>
                            <Text style={[styles.chipText, styles.chipOn]}>{section}  ✕</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={[styles.control, { borderColor: t.line, backgroundColor: t.surface },
                        panel === "sort" && { backgroundColor: t.text, borderColor: t.text },
                        !sortIsDefault && panel !== "sort" && { borderColor: t.brand }]}
                    onPress={() => setPanel(panel === "sort" ? "none" : "sort")}
                >
                    <SortIcon colour={panel === "sort" ? t.surface : t.text} />
                    <Text style={[styles.controlText, { color: panel === "sort" ? t.surface : t.text }]}>מיון</Text>
                </TouchableOpacity>
            </View>

            {panel === "filter" && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.strip}>
                    {sections.map((section) => {
                        const colour = sectionColour(section, dark);
                        const on = active.includes(section);
                        return (
                            <TouchableOpacity key={section}
                                style={[styles.chip, styles.sectionChip,
                                    { borderColor: colour, backgroundColor: on ? colour : t.surface }]}
                                onPress={() => onToggleSection(section)}>
                                {/* the dot carries the colour when the chip is off, so the
                                    strip reads as the same palette either way */}
                                {!on && <View style={[styles.dot, { backgroundColor: colour }]} />}
                                <Text style={[styles.chipText, on ? styles.chipOn : { color: t.text }]}>{section}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {panel === "sort" && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.strip}>
                    {SORT_OPTIONS.map((opt) => {
                        const on = opt.key === sort;
                        return (
                            <TouchableOpacity key={opt.key}
                                style={[styles.chip, { backgroundColor: on ? t.text : t.surfaceAlt }]}
                                onPress={() => { onSort(opt.key); setPanel("none"); }}>
                                <Text style={[styles.chipText, { color: on ? t.surface : t.text }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {!sortIsDefault && panel === "none" && (
                <Text style={[styles.sortNote, { color: t.textMuted }]}>ממוין: {sortLabel}</Text>
            )}
        </View>
    );
};

export default FeedControls;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingTop: 10, paddingBottom: 4, gap: 8 },
    // row-reverse puts the first child at the right edge
    rail: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 16 },
    control: {
        flexDirection: "row-reverse", alignItems: "center", gap: 6,
        borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13,
    },
    controlText: { fontFamily: "Heebo_700Bold", fontSize: 12.5 },
    chosen: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 2 },
    strip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16 },
    chip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
    sectionChip: {
        flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1.5,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { fontFamily: "Heebo_500Medium", fontSize: 12.5 },
    chipOn: { color: "#FFFFFF", fontFamily: "Heebo_700Bold" },
    sortNote: { fontFamily: "Heebo_500Medium", fontSize: 10.5, textAlign: "center" },
});
