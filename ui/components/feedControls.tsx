import { sectionColour } from '@/state/sections';
import ViewModeToggle, { ViewMode } from './viewModeToggle';
import { useTheme } from '@/state/theme';
import React, { useRef, useState } from 'react';
import { I18nManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

export type SortKey = "newest" | "oldest" | "covered" | "outside";

/** Which stories the bloc view shows, by who told them. */
export type BlocFilter = "all" | "both" | "right" | "left";

export const BLOC_FILTERS: { key: BlocFilter; label: string; dot?: string }[] = [
    { key: "all", label: "הכל" },
    { key: "both", label: "שני הצדדים", dot: "#DDA01E" },
    { key: "right", label: "רק ימין", dot: "#C0392F" },
    { key: "left", label: "רק שמאל", dot: "#2B5EA7" },
];

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "newest", label: "מחדש לישן" },
    { key: "oldest", label: "מישן לחדש" },
    { key: "covered", label: "הכי מסוקר למעלה" },
    { key: "outside", label: "מחוץ לתיבת התהודה שלי" },
];

/**
 * A strip that starts where Hebrew starts. Its chips are laid out right to left,
 * but a browser still opens a horizontal scroller at its left edge, which showed
 * the end of the list first. Native RTL already starts on the right.
 */
const Strip = ({ children, style }: { children: React.ReactNode; style?: any }) => {
    const ref = useRef<ScrollView>(null);
    const placed = useRef(false);
    return (
        <ScrollView
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={style}
            onContentSizeChange={() => {
                if (I18nManager.isRTL || placed.current) return;
                placed.current = true;
                ref.current?.scrollToEnd({ animated: false });
            }}
        >
            {children}
        </ScrollView>
    );
};

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

type Props = {
    sections: string[];
    selectedSections: string[];
    onToggleSection: (section: string) => void;
    sort: SortKey;
    onSort: (key: SortKey) => void;
    mode: ViewMode;
    onMode: (mode: ViewMode) => void;
    /** only the bloc view asks who told a story, so only it offers this */
    blocFilter: BlocFilter;
    onBlocFilter: (filter: BlocFilter) => void;
}

/**
 * One rail, right to left: the view the reader is in takes the right of it and most
 * of its width, and everything that narrows the feed - which sections, in which
 * order - sits behind a single control on its left. Two controls of their own were
 * two thirds of a rail spent on housekeeping, above a header that was already
 * taking a third of a phone's screen off the news.
 */
const FeedControls = ({ sections, selectedSections, onToggleSection, sort, onSort,
                       mode, onMode, blocFilter, onBlocFilter }: Props) => {
    const [open, setOpen] = useState(false);
    const t = useTheme();
    const dark = t.name === "negative";

    const active = selectedSections.filter((c) => c !== "הכל");
    const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "";
    const sortIsDefault = sort === "newest";

    return (
        <View style={[styles.wrap, { backgroundColor: t.bg }]}>
            <View style={styles.rail}>
                <ViewModeToggle mode={mode} onChange={onMode} compact />

                {/* the border turns gold when the feed the reader is looking at is not
                    the whole feed, so a filter left on is never left on unnoticed */}
                <TouchableOpacity
                    style={[styles.control, { borderColor: t.line, backgroundColor: t.surface },
                        !open && (active.length > 0 || !sortIsDefault) && { borderColor: t.brand },
                        open && { backgroundColor: t.text, borderColor: t.text }]}
                    onPress={() => setOpen(!open)}
                    accessibilityRole="button"
                    accessibilityLabel="סינון ומיון"
                >
                    <FilterIcon colour={open ? t.surface : t.text} />
                    <Text style={[styles.controlText, { color: open ? t.surface : t.text }]}>
                        סינון{active.length ? ` · ${active.length}` : ""}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* who told the story is a question only the bloc view asks */}
            {mode === "bloc" && (
                <Strip style={styles.strip}>
                    {BLOC_FILTERS.map((option) => {
                        const on = option.key === blocFilter;
                        return (
                            <TouchableOpacity key={option.key}
                                style={[styles.chip, styles.sectionChip,
                                    { borderColor: on ? t.text : t.line,
                                      backgroundColor: on ? t.text : t.surface }]}
                                onPress={() => onBlocFilter(option.key)}>
                                {!!option.dot && (
                                    <View style={[styles.dot, { backgroundColor: option.dot }]} />
                                )}
                                <Text style={[styles.chipText,
                                    { color: on ? t.surface : t.text }]}>{option.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </Strip>
            )}

            {active.length > 0 && !open && (
                <Strip style={styles.chosen}>
                    {active.map((section) => (
                        <TouchableOpacity key={section}
                            style={[styles.chip, { backgroundColor: sectionColour(section, dark) }]}
                            onPress={() => onToggleSection(section)}>
                            <Text style={[styles.chipText, styles.chipOn]}>{section}  ✕</Text>
                        </TouchableOpacity>
                    ))}
                </Strip>
            )}

            {open && (
                <Text style={[styles.panelLabel, { color: t.textMuted }]}>מדורים</Text>
            )}
            {open && (
                <Strip style={styles.strip}>
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
                </Strip>
            )}

            {open && (
                <Text style={[styles.panelLabel, { color: t.textMuted }]}>סדר הצגה</Text>
            )}
            {open && (
                <Strip style={styles.strip}>
                    {SORT_OPTIONS.map((opt) => {
                        const on = opt.key === sort;
                        return (
                            <TouchableOpacity key={opt.key}
                                style={[styles.chip, { backgroundColor: on ? t.text : t.surfaceAlt }]}
                                onPress={() => onSort(opt.key)}>
                                <Text style={[styles.chipText, { color: on ? t.surface : t.text }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </Strip>
            )}

            {!sortIsDefault && !open && (
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
    // the two halves of the one panel, each said once and quietly
    panelLabel: {
        fontFamily: "Heebo_700Bold", fontSize: 10.5, textAlign: "right",
        paddingHorizontal: 16, marginBottom: -3,
    },
    chosen: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16 },
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
