import { sectionColour, sectionTint } from '@/state/sections';
import { useTheme } from '@/state/theme';
import { TYPE } from '@/state/craft';
import Press from './press';
import React, { useRef, useState } from 'react';
import { I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export type SortKey = "newest" | "oldest" | "covered" | "outside";

/** Which stories the feed shows, by who told them. */
export type BlocFilter = "all" | "blind" | "both" | "right" | "left";

export const BLOC_FILTERS: { key: BlocFilter; label: string; dot?: string }[] = [
    { key: "all", label: "הכל" },
    // the one the app was built for, under the name it goes by
    { key: "blind", label: "Blindspots", dot: "#111827" },
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

type Panel = "filter" | "sort";

type Props = {
    /** the day's headline, which shares its line with the two controls */
    title: string;
    sections: string[];
    selectedSections: string[];
    onToggleSection: (section: string) => void;
    sort: SortKey;
    onSort: (key: SortKey) => void;
    blocFilter: BlocFilter;
    onBlocFilter: (filter: BlocFilter) => void;
    /** whether the reader has told us their side, which makes a blindspot theirs */
    knowsBloc?: boolean;
}

/**
 * The day's title, and on the same line two small icons: the filter and the sort.
 * Each opens its own panel, and only when it is touched - the rail with a toggle,
 * a "סינון" button and a strip of bloc filters under it was three rows of
 * housekeeping between the reader and the first story.
 *
 * A filter that is on is never on unnoticed: its icon wears a gold dot, and while
 * the panel is shut what it is narrowing to sits under the title, each with its ✕.
 */
const FeedControls = ({ title, sections, selectedSections, onToggleSection, sort, onSort,
                       blocFilter, onBlocFilter, knowsBloc }: Props) => {
    const [panel, setPanel] = useState<Panel | null>(null);
    const t = useTheme();
    const dark = t.name === "negative";

    const active = selectedSections.filter((c) => c !== "הכל");
    const filtering = active.length > 0 || blocFilter !== "all";
    const sorting = sort !== "newest";
    const bloc = BLOC_FILTERS.find((option) => option.key === blocFilter);

    const icon = (which: Panel, name: keyof typeof Ionicons.glyphMap, label: string, on: boolean) => {
        const open = panel === which;
        return (
            <Press
                style={[styles.icon, { borderColor: t.line, backgroundColor: t.surface },
                    on && !open && { borderColor: t.brand },
                    open && { backgroundColor: t.text, borderColor: t.text }]}
                onPress={() => setPanel(open ? null : which)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ expanded: open }}
                hitSlop={6}
            >
                <Ionicons name={name} size={15} color={open ? t.surface : t.text} />
                {on && !open && <View style={[styles.badge, { backgroundColor: t.brand, borderColor: t.bg }]} />}
            </Press>
        );
    };

    const chip = (key: string, label: string, on: boolean, onPress: () => void, dot?: string) => (
        <Press key={key}
            style={[styles.chip, styles.edged,
                { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : t.surface }]}
            onPress={onPress}>
            {!!dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
            <Text style={[styles.chipText, { color: on ? t.surface : t.text }]}>{label}</Text>
        </Press>
    );

    return (
        <View style={[styles.wrap, { backgroundColor: t.bg }]}>
            <View style={styles.titleRow}>
                <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title}</Text>
                <View style={styles.icons}>
                    {icon("filter", "funnel-outline", "סינון", filtering)}
                    {icon("sort", "swap-vertical", "מיון", sorting)}
                </View>
            </View>

            {filtering && panel !== "filter" && (
                <Strip style={styles.strip}>
                    {blocFilter !== "all" && bloc && (
                        <Press style={[styles.chip, styles.edged, { borderColor: t.text, backgroundColor: t.surface }]}
                            onPress={() => onBlocFilter("all")}>
                            <Text style={[styles.chipText, { color: t.text }]}>{bloc.label}  ✕</Text>
                        </Press>
                    )}
                    {active.map((section) => (
                        <Press key={section}
                            style={[styles.chip, { backgroundColor: sectionColour(section, dark) }]}
                            onPress={() => onToggleSection(section)}>
                            <Text style={[styles.chipText, styles.chipOn]}>{section}  ✕</Text>
                        </Press>
                    ))}
                </Strip>
            )}

            {panel === "filter" && (
                <>
                    <Text style={[styles.panelLabel, { color: t.textMuted }]}>מי סיקר</Text>
                    <Strip style={styles.strip}>
                        {BLOC_FILTERS.map((option) => chip(option.key, option.label,
                            option.key === blocFilter, () => onBlocFilter(option.key), option.dot))}
                    </Strip>
                    {/* the one filter whose name does not explain itself */}
                    {blocFilter === "blind" && (
                        <Text style={[styles.note, { color: t.textMuted }]}>
                            {knowsBloc
                                ? "סיפורים שהצד שלכם לא סיקר: שני גופים או יותר מהצד השני, ואפס משלכם."
                                : "סיפורים שצד אחד סיקר והשני לא. מלאו את שאלון העמדות כדי לראות דווקא את אלה שהצד שלכם פספס."}
                        </Text>
                    )}
                    <Text style={[styles.panelLabel, { color: t.textMuted }]}>מדורים</Text>
                    <Strip style={styles.strip}>
                        {sections.map((section) => {
                            // off, the chip is a tint of its own colour with the name in
                            // that colour at full strength - the same surface the card's
                            // tab wears, so the strip and the feed are plainly one palette.
                            // On, it fills in: the chosen one is the only solid thing here.
                            const tint = sectionTint(section, dark);
                            const on = active.includes(section);
                            return (
                                <Press key={section}
                                    style={[styles.chip, styles.edged,
                                        on ? { borderColor: tint.ink, backgroundColor: tint.ink }
                                           : { borderColor: tint.edge, backgroundColor: tint.fill }]}
                                    onPress={() => onToggleSection(section)}>
                                    <Text style={[styles.chipText,
                                        on ? styles.chipOn : { color: tint.label }]}>{section}</Text>
                                </Press>
                            );
                        })}
                    </Strip>
                </>
            )}

            {panel === "sort" && (
                <Strip style={styles.strip}>
                    {SORT_OPTIONS.map((option) => chip(option.key, option.label,
                        option.key === sort, () => onSort(option.key)))}
                </Strip>
            )}
        </View>
    );
};

export default FeedControls;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingTop: 2, paddingBottom: 10, gap: 8 },
    // row-reverse: the title from the right edge, the two icons at the left
    titleRow: {
        flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16,
    },
    title: { ...TYPE.display, flex: 1, textAlign: "right" },
    icons: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    icon: {
        width: 32, height: 32, borderRadius: 16, borderWidth: 1,
        alignItems: "center", justifyContent: "center",
    },
    // a filter or an order left on: a gold dot on the icon's shoulder
    badge: {
        position: "absolute", top: -1, right: -1, width: 9, height: 9, borderRadius: 5,
        borderWidth: 1.5,
    },
    // the panel's two halves, each said once and quietly
    panelLabel: {
        fontFamily: "Heebo_700Bold", fontSize: 10.5, textAlign: "right",
        paddingHorizontal: 16, marginBottom: -3,
    },
    strip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16 },
    chip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
    // a hairline rather than a 1.5px outline: the chip is a surface with an edge,
    // not a shape drawn in outline
    edged: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontFamily: "Heebo_500Medium", fontSize: 12, letterSpacing: 0.05 },
    chipOn: { color: "#FFFFFF", fontFamily: "Heebo_700Bold" },
    note: {
        fontFamily: "Heebo_500Medium", fontSize: 11, lineHeight: 16,
        textAlign: "right", paddingHorizontal: 16, marginTop: -2,
    },
});
