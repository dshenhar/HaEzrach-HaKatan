import { sectionColour, sectionTint } from '@/state/sections';
import { useTheme } from '@/state/theme';
import { useSkin } from '@/state/direction';
import Press from './press';
import { SearchField } from './searchOverlay';
import { keptHot } from '@/state/hotTopics';
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

type Panel = "filter" | "sort" | "search";

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
    query: string;
    onQuery: (text: string) => void;
    /** the query is sent: its results open over the app */
    onSearch: () => void;
}

/**
 * The day's title, and on the same line three small icons: the filter, the sort and
 * the search. Each opens its own panel, and only when it is touched - the rail with a toggle,
 * a "סינון" button and a strip of bloc filters under it was three rows of
 * housekeeping between the reader and the first story.
 *
 * A filter that is on is never on unnoticed: its icon wears a gold dot, and while
 * the panel is shut what it is narrowing to sits under the title, each with its ✕.
 */
const FeedControls = ({ title, sections, selectedSections, onToggleSection, sort, onSort,
                       blocFilter, onBlocFilter, knowsBloc, query, onQuery, onSearch }: Props) => {
    const [panel, setPanel] = useState<Panel | null>(null);
    const t = useTheme();
    const skin = useSkin();
    const f = skin.faces;
    const dark = t.name === "negative";
    // The icons: on the booth's tray they are small white slips, on the page they
    // are bare ink, on the concourse they are black pictogram squares. Open, each
    // takes the world's mark for "this one": the stamp, an ink fill, a yellow face.
    const iconBox = skin.name === "sign"
        ? { backgroundColor: t.text, borderColor: t.text }
        : skin.name === "daf"
            ? { backgroundColor: "transparent", borderColor: "transparent" }
            : { backgroundColor: t.surface, borderColor: t.line };
    const iconInk = skin.name === "sign" ? t.surface : t.text;
    const openBox = skin.name === "sign"
        ? { backgroundColor: t.brand, borderColor: t.text }
        : { backgroundColor: t.select, borderColor: t.select };
    const openInk = skin.name === "sign" ? t.brandInk : t.selectInk;
    // chosen, a chip wears the same mark
    const chosen = skin.name === "sign"
        ? { backgroundColor: t.brand, borderColor: t.text }
        : { backgroundColor: t.select, borderColor: t.select };
    const chosenInk = skin.name === "sign" ? t.brandInk : t.selectInk;
    // the filters' dots name the blocs; they take the world's inks for them
    const inkOf = (dot: string) => dot === "#C0392F" ? t.right : dot === "#2B5EA7" ? t.left
        : dot === "#111827" ? t.text : skin.name === "sign" ? t.brandInk : t.select;

    const active = selectedSections.filter((c) => c !== "הכל");
    const filtering = active.length > 0 || blocFilter !== "all";
    const sorting = sort !== "newest";
    const bloc = BLOC_FILTERS.find((option) => option.key === blocFilter);

    const icon = (which: Panel, name: keyof typeof Ionicons.glyphMap, label: string, on: boolean) => {
        const open = panel === which;
        return (
            <Press
                style={[styles.icon, iconBox, { borderRadius: skin.radius.control },
                    open && openBox]}
                onPress={() => {
                    // the hot topics are fetched as the search row opens, not when it is sent
                    if (which === "search" && !open) void keptHot();
                    setPanel(open ? null : which);
                }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ expanded: open }}
                hitSlop={6}
            >
                <Ionicons name={name} size={skin.name === "daf" ? 19 : 16} color={open ? openInk : iconInk} />
                {on && !open && <View style={[styles.badge, { backgroundColor: skin.name === "sign" ? t.brand : t.select,
                    borderColor: t.bg }]} />}
            </Press>
        );
    };

    const chip = (key: string, label: string, on: boolean, onPress: () => void, dot?: string) => (
        <Press key={key}
            style={[styles.chip, styles.edged, { borderRadius: skin.radius.chip },
                on ? chosen : { borderColor: t.line, backgroundColor: t.surface }]}
            onPress={onPress}>
            {!!dot && <View style={[styles.dot, { backgroundColor: inkOf(dot),
                borderRadius: skin.name === "ballot" ? 0 : 4 }]} />}
            <Text style={[styles.chipText, { color: on ? chosenInk : t.text, fontFamily: on ? f.uiStrong : f.ui }]}>{label}</Text>
        </Press>
    );

    return (
        <View style={[styles.wrap, { backgroundColor: t.bg }]}>
            <View style={styles.titleRow}>
                <Text style={[styles.title, { color: t.text, fontFamily: f.display },
                    skin.name === "daf" && styles.titlePage]} numberOfLines={1}>{title}</Text>
                <View style={styles.icons}>
                    {icon("filter", "funnel-outline", "סינון", filtering)}
                    {icon("sort", "swap-vertical", "מיון", sorting)}
                    {icon("search", "search", "חיפוש", false)}
                </View>
            </View>

            {filtering && panel !== "filter" && (
                <Strip style={styles.strip}>
                    {blocFilter !== "all" && bloc && (
                        <Press style={[styles.chip, styles.edged, chosen, { borderRadius: skin.radius.chip }]}
                            onPress={() => onBlocFilter("all")}>
                            <Text style={[styles.chipText, { color: chosenInk, fontFamily: f.uiStrong }]}>{bloc.label}  ✕</Text>
                        </Press>
                    )}
                    {active.map((section) => (
                        <Press key={section}
                            style={[styles.chip, styles.edged, { borderRadius: skin.radius.chip },
                                skin.name === "ballot" ? chosen
                                    : { backgroundColor: sectionColour(section, dark), borderColor: sectionColour(section, dark) }]}
                            onPress={() => onToggleSection(section)}>
                            <Text style={[styles.chipText, styles.chipOn, { fontFamily: f.uiStrong }]}>{section}  ✕</Text>
                        </Press>
                    ))}
                </Strip>
            )}

            {panel === "filter" && (
                <>
                    <Text style={[styles.panelLabel, { color: t.textMuted, fontFamily: f.uiStrong }]}>מי סיקר</Text>
                    <Strip style={styles.strip}>
                        {BLOC_FILTERS.map((option) => chip(option.key, option.label,
                            option.key === blocFilter, () => onBlocFilter(option.key), option.dot))}
                    </Strip>
                    {/* the one filter whose name does not explain itself */}
                    {blocFilter === "blind" && (
                        <Text style={[styles.note, { color: t.textMuted, fontFamily: f.ui }]}>
                            {knowsBloc
                                ? "סיפורים שהצד שלכם לא סיקר: שני גופים או יותר מהצד השני, ואפס משלכם."
                                : "סיפורים שצד אחד סיקר והשני לא. מלאו את שאלון העמדות כדי לראות דווקא את אלה שהצד שלכם פספס."}
                        </Text>
                    )}
                    <Text style={[styles.panelLabel, { color: t.textMuted, fontFamily: f.uiStrong }]}>מדורים</Text>
                    <Strip style={styles.strip}>
                        {sections.map((section) => {
                            // off, the chip is a tint of its own colour with the name in
                            // that colour at full strength - the same surface the card's
                            // tab wears, so the strip and the feed are plainly one palette.
                            // On, it fills in: the chosen one is the only solid thing here.
                            const tint = sectionTint(section, dark);
                            const on = active.includes(section);
                            // the booth keeps one ink: a section is a plain slip there,
                            // and the stamp marks the chosen. The page and the
                            // concourse keep each section's colour, as a route does.
                            if (skin.name === "ballot") return chip(section, section, on, () => onToggleSection(section));
                            return (
                                <Press key={section}
                                    style={[styles.chip, styles.edged, { borderRadius: skin.radius.chip },
                                        on ? { borderColor: tint.ink, backgroundColor: tint.ink }
                                           : { borderColor: tint.edge, backgroundColor: tint.fill }]}
                                    onPress={() => onToggleSection(section)}>
                                    <Text style={[styles.chipText, { fontFamily: on ? f.uiStrong : f.ui },
                                        on ? styles.chipOn : { color: tint.label }]}>{section}</Text>
                                </Press>
                            );
                        })}
                    </Strip>
                </>
            )}

            {/* the search row opens where the other two panels do; what it finds
                opens over the whole app, the feed and the hot topics both */}
            {panel === "search" && (
                <View style={styles.searchRow}>
                    <View style={styles.searchField}>
                        <SearchField value={query} onChange={onQuery} onSubmit={onSearch} autoFocus />
                    </View>
                    <Press style={[styles.go, { borderRadius: skin.radius.control === 0 ? 2 : Math.max(skin.radius.control, 3) },
                        skin.name === "sign" ? { backgroundColor: t.brand, borderWidth: 1, borderColor: t.text }
                            : { backgroundColor: skin.name === "ballot" ? t.select : t.text }]} onPress={onSearch}
                        accessibilityRole="button" accessibilityLabel="הצגת התוצאות">
                        <Text style={[styles.goText, { color: skin.name === "sign" ? t.brandInk : skin.name === "ballot" ? t.selectInk : t.surface,
                            fontFamily: f.uiStrong }]}>חיפוש</Text>
                    </Press>
                </View>
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
    title: { fontSize: 29, lineHeight: 35, letterSpacing: -0.4, flex: 1, textAlign: "right" },
    titlePage: { fontSize: 27, letterSpacing: -0.5 },
    icons: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    icon: {
        width: 34, height: 34, borderWidth: 1,
        alignItems: "center", justifyContent: "center",
    },
    // a filter or an order left on: a gold dot on the icon's shoulder
    badge: {
        position: "absolute", top: -1, right: -1, width: 9, height: 9, borderRadius: 5,
        borderWidth: 1.5,
    },
    // the panel's two halves, each said once and quietly
    panelLabel: {
        fontSize: 11.5, textAlign: "right",
        paddingHorizontal: 16, marginBottom: -3,
    },
    strip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16 },
    chip: { paddingVertical: 6, paddingHorizontal: 11 },
    // a hairline rather than a 1.5px outline: the chip is a surface with an edge,
    // not a shape drawn in outline
    edged: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontSize: 13, letterSpacing: 0.05 },
    chipOn: { color: "#FFFFFF" },
    searchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 16 },
    searchField: { flex: 1 },
    go: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
    goText: { fontSize: 14 },
    note: {
        fontSize: 12, lineHeight: 17,
        textAlign: "right", paddingHorizontal: 16, marginTop: -2,
    },
});
