import { sectionColour, sectionTint } from '@/state/sections';
import { useTheme } from '@/state/theme';
import { TYPE } from '@/state/craft';
import Press from './press';
import React, { useRef, useState } from 'react';
import { I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';
import Modal from 'react-native-modal';
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

type Props = {
    /** the day's headline, which shares its line with the filter button */
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
 * The day's title, and on the same line one button: the filter. It opens a drawer
 * from the foot of the screen holding everything that narrows or orders the feed -
 * who told a story, its section, and the order - so the head of the feed is the
 * title and the news, and not three rows of housekeeping.
 *
 * A filter that is on is never on unnoticed: the button wears a gold dot, and what
 * the feed is narrowed to sits under the title, each with its ✕.
 */
const FeedControls = ({ title, sections, selectedSections, onToggleSection, sort, onSort,
                       blocFilter, onBlocFilter, knowsBloc }: Props) => {
    const [drawer, setDrawer] = useState(false);
    const t = useTheme();
    const dark = t.name === "negative";

    const active = selectedSections.filter((c) => c !== "הכל");
    const filtering = active.length > 0 || blocFilter !== "all";
    const sorting = sort !== "newest";
    const bloc = BLOC_FILTERS.find((option) => option.key === blocFilter);
    const order = SORT_OPTIONS.find((option) => option.key === sort);

    const chip = (key: string, label: string, on: boolean, onPress: () => void, dot?: string) => (
        <Press key={key}
            style={[styles.chip, styles.row, { backgroundColor: on ? t.text : t.surfaceAlt }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            {!!dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
            <Text style={[styles.chipText, { color: on ? t.surface : t.text }]}>{label}</Text>
        </Press>
    );

    return (
        <View style={[styles.wrap, { backgroundColor: t.bg }]}>
            <View style={styles.titleRow}>
                <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title}</Text>
                <Press
                    style={[styles.button, { backgroundColor: t.surfaceAlt }]}
                    onPress={() => setDrawer(true)}
                    accessibilityRole="button"
                    accessibilityLabel="סינון ומיון"
                    hitSlop={6}
                >
                    <Ionicons name="options-outline" size={17} color={t.text} />
                    {(filtering || sorting) && (
                        <View style={[styles.badge, { backgroundColor: t.brand, borderColor: t.bg }]} />
                    )}
                </Press>
            </View>

            {(filtering || sorting) && (
                <Strip style={styles.strip}>
                    {blocFilter !== "all" && bloc && (
                        <Press style={[styles.chip, { backgroundColor: t.surfaceAlt }]}
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
                    {sorting && order && (
                        <Press style={[styles.chip, { backgroundColor: t.surfaceAlt }]}
                            onPress={() => onSort("newest")}>
                            <Text style={[styles.chipText, { color: t.text }]}>{order.label}  ✕</Text>
                        </Press>
                    )}
                </Strip>
            )}

            <Modal
                isVisible={drawer}
                onBackdropPress={() => setDrawer(false)}
                onBackButtonPress={() => setDrawer(false)}
                onSwipeComplete={() => setDrawer(false)}
                swipeDirection="down"
                style={styles.modal}
                backdropOpacity={0.35}
                propagateSwipe
            >
                <View style={[styles.sheet, { backgroundColor: t.surface }]}>
                    <View style={[styles.grabber, { backgroundColor: t.line }]} />
                    <View style={styles.sheetHead}>
                        <Text style={[styles.sheetTitle, { color: t.text }]}>סינון ומיון</Text>
                        <Press onPress={() => setDrawer(false)} hitSlop={10}
                            accessibilityRole="button" accessibilityLabel="סגירה">
                            <Ionicons name="close" size={22} color={t.text} />
                        </Press>
                    </View>

                    <Text style={[styles.panelLabel, { color: t.textMuted }]}>מי סיקר</Text>
                    <View style={styles.wrapRow}>
                        {BLOC_FILTERS.map((option) => chip(option.key, option.label,
                            option.key === blocFilter, () => onBlocFilter(option.key), option.dot))}
                    </View>
                    {/* the one filter whose name does not explain itself */}
                    {blocFilter === "blind" && (
                        <Text style={[styles.note, { color: t.textMuted }]}>
                            {knowsBloc
                                ? "סיפורים שהצד שלכם לא סיקר: שני גופים או יותר מהצד השני, ואפס משלכם."
                                : "סיפורים שצד אחד סיקר והשני לא. מלאו את שאלון העמדות כדי לראות דווקא את אלה שהצד שלכם פספס."}
                        </Text>
                    )}

                    <Text style={[styles.panelLabel, { color: t.textMuted }]}>מדורים</Text>
                    <View style={styles.wrapRow}>
                        {sections.map((section) => {
                            // off, the chip is a tint of its own colour with the name in
                            // that colour at full strength - the same surface the card's
                            // tab wears, so the drawer and the feed are plainly one palette.
                            // On, it fills in: the chosen one is the only solid thing here.
                            const tint = sectionTint(section, dark);
                            const on = active.includes(section);
                            return (
                                <Press key={section}
                                    style={[styles.chip, { backgroundColor: on ? tint.ink : tint.fill }]}
                                    onPress={() => onToggleSection(section)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}>
                                    <Text style={[styles.chipText,
                                        on ? styles.chipOn : { color: tint.label }]}>{section}</Text>
                                </Press>
                            );
                        })}
                    </View>

                    <Text style={[styles.panelLabel, { color: t.textMuted }]}>מיון</Text>
                    <View style={styles.wrapRow}>
                        {SORT_OPTIONS.map((option) => chip(option.key, option.label,
                            option.key === sort, () => onSort(option.key)))}
                    </View>

                    <Press style={[styles.done, { backgroundColor: t.text }]} onPress={() => setDrawer(false)}
                        accessibilityRole="button">
                        <Text style={[styles.doneText, { color: t.surface }]}>הצגת הסיפורים</Text>
                    </Press>
                </View>
            </Modal>
        </View>
    );
};

export default FeedControls;

const styles = StyleSheet.create({
    wrap: { width: "100%", paddingTop: 2, paddingBottom: 10, gap: 8 },
    // row-reverse: the title from the right edge, the button at the left
    titleRow: {
        flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16,
    },
    title: { ...TYPE.display, flex: 1, textAlign: "right" },
    button: {
        width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    },
    // a filter or an order left on: a gold dot on the button's shoulder
    badge: {
        position: "absolute", top: -1, right: -1, width: 10, height: 10, borderRadius: 5,
        borderWidth: 1.5,
    },
    strip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16 },
    chip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
    row: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontFamily: "Rubik_500Medium", fontSize: 13, letterSpacing: 0.05 },
    chipOn: { color: "#FFFFFF", fontFamily: "Rubik_700Bold" },
    modal: { justifyContent: "flex-end", margin: 0 },
    sheet: {
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30, gap: 10,
        width: "100%", maxWidth: 520, alignSelf: "center",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
    sheetHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { ...TYPE.title, fontSize: 19, textAlign: "right" },
    // the drawer's parts, each said once and quietly
    panelLabel: { fontFamily: "Rubik_700Bold", fontSize: 12, textAlign: "right", marginTop: 6 },
    wrapRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
    note: {
        fontFamily: "Rubik_500Medium", fontSize: 12, lineHeight: 17, textAlign: "right",
    },
    done: { marginTop: 12, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
    doneText: { fontFamily: "Rubik_700Bold", fontSize: 15 },
});
