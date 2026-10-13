import { I18nManager, TextStyle, useWindowDimensions } from "react-native";
import { ThemeName, useThemeControl } from "@/state/theme";

/**
 * The paper the site is printed on.
 *
 * A daily, not an app: white paper, ink, rules instead of boxes, and two inks
 * kept for one job only - red for the right bloc and blue for the left, wherever
 * coverage is measured. Nothing else on the page is red or blue, so a reader
 * learns in one look that colour here is a count and never a decoration.
 */
export type Ink = {
    paper: string;
    /** a module set off from the page: a paper tint, not a box */
    paperAlt: string;
    /** what a row turns while a finger is on it */
    pressed: string;
    ink: string;
    /** standfirsts and summaries: a step off the headline's black */
    ink2: string;
    /** times, counts, captions */
    muted: string;
    rule: string;
    ruleStrong: string;
    right: string;
    left: string;
    rightTint: string;
    leftTint: string;
    /** outlets in neither bloc, in the middle of the meter */
    unaligned: string;
    /** the one full-bleed band on the front page */
    band: string;
    bandInk: string;
    bandMuted: string;
    bandRule: string;
    bandRight: string;
    bandLeft: string;
    /** a search hit, a selection */
    mark: string;
};

const LIGHT: Ink = {
    paper: "#FFFFFF", paperAlt: "#F5F5F2", pressed: "#EDEDE9",
    ink: "#141414", ink2: "#3B3B3B", muted: "#666662",
    rule: "#E1E1DD", ruleStrong: "#141414",
    right: "#B3261E", left: "#1D4E9E", rightTint: "#F8E4E2", leftTint: "#E3EBF7",
    unaligned: "#CFCFCA",
    band: "#141414", bandInk: "#F4F4F1", bandMuted: "#A8A8A3", bandRule: "#34342F",
    bandRight: "#FF968C", bandLeft: "#94B9FF",
    mark: "#FFE27A",
};

// Night: the page goes dark and the inks lift, so the counts still read as counts.
const NIGHT: Ink = {
    paper: "#111111", paperAlt: "#1A1A19", pressed: "#242423",
    ink: "#EDEDEA", ink2: "#CACAC5", muted: "#9C9C96",
    rule: "#2B2B29", ruleStrong: "#EDEDEA",
    right: "#FF8F85", left: "#8FB5FF", rightTint: "#2E1D1B", leftTint: "#1A2335",
    unaligned: "#4A4A47",
    // the band turns over at night: a pale strip on the dark page
    band: "#EDEDEA", bandInk: "#111111", bandMuted: "#55554F", bandRule: "#C9C9C4",
    bandRight: "#A52219", bandLeft: "#1A4793",
    mark: "#6B5A12",
};

// Contrast is an adjustment, not a style: black on white, every rule visible,
// inks dark enough to pass 7:1.
const CONTRAST: Ink = {
    paper: "#FFFFFF", paperAlt: "#F0F0F0", pressed: "#E2E2E2",
    ink: "#000000", ink2: "#000000", muted: "#262626",
    rule: "#000000", ruleStrong: "#000000",
    right: "#8E1B12", left: "#0E3576", rightTint: "#F8E4E2", leftTint: "#E3EBF7",
    unaligned: "#8A8A8A",
    band: "#000000", bandInk: "#FFFFFF", bandMuted: "#D9D9D9", bandRule: "#FFFFFF",
    bandRight: "#FFA49C", bandLeft: "#ADC9FF",
    mark: "#FFD84A",
};

const INKS: Record<ThemeName, Ink> = { light: LIGHT, negative: NIGHT, contrast: CONTRAST };

/**
 * Two faces. Frank Ruhl - the face Israeli print has been set in for a century -
 * carries everything that is read: headlines, standfirsts, the blocs' summaries.
 * Assistant carries everything that is used: the menu, the filters, the times
 * and the counts.
 */
export const FACE = {
    serif: "FrankRuhlLibre_400Regular",
    serifMedium: "FrankRuhlLibre_500Medium",
    serifBold: "FrankRuhlLibre_700Bold",
    serifBlack: "FrankRuhlLibre_900Black",
    sans: "Assistant_400Regular",
    sansSemi: "Assistant_600SemiBold",
    sansBold: "Assistant_700Bold",
    sansHeavy: "Assistant_800ExtraBold",
} as const;

/** a Hebrew line: set right to left, so a quote or a full stop lands where it belongs */
const rtl: TextStyle = { writingDirection: "rtl", textAlign: "right" };

/** Two steps of every size: the phone's, and the desk's. */
const scale = (wide: boolean) => ({
    masthead: { fontFamily: FACE.serifBlack, fontSize: wide ? 84 : 46, lineHeight: wide ? 90 : 52, letterSpacing: wide ? -1.6 : -0.8 },
    lead: { ...rtl, fontFamily: FACE.serifBold, fontSize: wide ? 46 : 31, lineHeight: wide ? 54 : 38, letterSpacing: wide ? -0.9 : -0.5 },
    h1: { ...rtl, fontFamily: FACE.serifBold, fontSize: wide ? 44 : 30, lineHeight: wide ? 52 : 38, letterSpacing: wide ? -0.8 : -0.45 },
    section: { ...rtl, fontFamily: FACE.serifBlack, fontSize: wide ? 30 : 25, lineHeight: wide ? 36 : 30, letterSpacing: -0.3 },
    major: { ...rtl, fontFamily: FACE.serifBold, fontSize: wide ? 24 : 21, lineHeight: wide ? 31 : 28, letterSpacing: -0.25 },
    row: { ...rtl, fontFamily: FACE.serifBold, fontSize: wide ? 19.5 : 18, lineHeight: wide ? 27 : 25.5, letterSpacing: -0.1 },
    dek: { ...rtl, fontFamily: FACE.serif, fontSize: wide ? 20 : 18, lineHeight: wide ? 31 : 28 },
    body: { ...rtl, fontFamily: FACE.serif, fontSize: wide ? 17.5 : 16.5, lineHeight: wide ? 29 : 27 },
    small: { ...rtl, fontFamily: FACE.serif, fontSize: 15, lineHeight: 24 },
    ui: { ...rtl, fontFamily: FACE.sansSemi, fontSize: 15, lineHeight: 20 },
    uiStrong: { ...rtl, fontFamily: FACE.sansBold, fontSize: 15, lineHeight: 20 },
    meta: { ...rtl, fontFamily: FACE.sansSemi, fontSize: 13.5, lineHeight: 18, fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] },
    label: { ...rtl, fontFamily: FACE.sansHeavy, fontSize: 13.5, lineHeight: 17, letterSpacing: 0.1 },
});

export type Type = ReturnType<typeof scale>;

/** A row that runs right to left on the web too, where the RTL switch is ignored. */
export const ROW = I18nManager.isRTL ? "row" : "row-reverse";

export const BREAK = { md: 720, lg: 1080 } as const;
export const MAX_WIDTH = 1200;

/** The page as the reader has it: the inks for their theme, the type for their screen. */
export function useSite() {
    const { theme } = useThemeControl();
    const { width } = useWindowDimensions();
    const wide = width >= BREAK.md;
    const desk = width >= BREAK.lg;
    return {
        c: INKS[theme.name] ?? LIGHT,
        type: scale(wide),
        theme: theme.name,
        width,
        wide,
        desk,
        gutter: desk ? 32 : wide ? 24 : 16,
    };
}
