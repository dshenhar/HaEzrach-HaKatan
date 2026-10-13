import { I18nManager, TextStyle, useWindowDimensions } from "react-native";
import { ThemeName, useThemeControl } from "@/state/theme";

/**
 * The app's colours.
 *
 * Colour does two jobs here and never mixes them. Red and blue are data: the
 * right bloc and the left, wherever coverage is counted, and nowhere else. Every
 * other colour belongs to a section of the news - a story wears its section's
 * colour on its card, so the day reads by colour before it reads by word - plus
 * the app's own violet for what is chosen, and a highlighter yellow for the one
 * finding the app makes: the blindspots.
 */
export type Ink = {
    /** the screen behind the cards */
    bg: string;
    card: string;
    /** a card inside a card, a well */
    sunk: string;
    pressed: string;
    ink: string;
    ink2: string;
    muted: string;
    rule: string;
    /** the app's own colour: the chosen tab, the chosen chip, the main button */
    brand: string;
    brandInk: string;
    brandTint: string;
    right: string;
    left: string;
    rightTint: string;
    leftTint: string;
    unaligned: string;
    /** the blindspots' highlighter */
    hi: string;
    hiInk: string;
    /** text on a coloured card */
    onColour: string;
    onColourMuted: string;
};

const LIGHT: Ink = {
    bg: "#F1F2F5", card: "#FFFFFF", sunk: "#F6F7F9", pressed: "#E8EAEE",
    ink: "#0F1115", ink2: "#3A3E46", muted: "#656A73", rule: "#E2E4E9",
    brand: "#5B2BE0", brandInk: "#FFFFFF", brandTint: "#EEE8FD",
    right: "#C62A22", left: "#1F55C2", rightTint: "#FCE9E7", leftTint: "#E6EEFC",
    unaligned: "#C6C9D0",
    hi: "#FFD43B", hiInk: "#1A1600",
    onColour: "#FFFFFF", onColourMuted: "rgba(255,255,255,0.82)",
};

const NIGHT: Ink = {
    bg: "#0B0C0F", card: "#16181D", sunk: "#1E2127", pressed: "#262931",
    ink: "#F1F2F4", ink2: "#C9CCD3", muted: "#9AA0AA", rule: "#2A2E36",
    brand: "#9D7BFF", brandInk: "#0B0C0F", brandTint: "#251C42",
    right: "#FF8A80", left: "#8AB1FF", rightTint: "#331B1A", leftTint: "#172238",
    unaligned: "#4A4F59",
    hi: "#FFD43B", hiInk: "#1A1600",
    onColour: "#FFFFFF", onColourMuted: "rgba(255,255,255,0.82)",
};

const CONTRAST: Ink = {
    bg: "#FFFFFF", card: "#FFFFFF", sunk: "#F0F0F0", pressed: "#E0E0E0",
    ink: "#000000", ink2: "#000000", muted: "#262626", rule: "#000000",
    brand: "#3A0FB0", brandInk: "#FFFFFF", brandTint: "#EEE8FD",
    right: "#8E1B12", left: "#0E3576", rightTint: "#FCE9E7", leftTint: "#E6EEFC",
    unaligned: "#8A8A8A",
    hi: "#FFD43B", hiInk: "#000000",
    onColour: "#FFFFFF", onColourMuted: "#FFFFFF",
};

const INKS: Record<ThemeName, Ink> = { light: LIGHT, negative: NIGHT, contrast: CONTRAST };

/**
 * Each section's colour: deep enough that white type on it passes the standard,
 * clear of the two bloc inks, and different enough from its neighbours that a
 * feed of them is a pattern and not a smear.
 */
const SECTION: Record<string, string> = {
    "מלחמה וביטחון": "#3E6B2E",
    "פוליטיקה": "#5B2BE0",
    "משפט": "#0E6870",
    "פלילים ותאונות": "#3B4250",
    "כלכלה": "#047A55",
    "דת ומדינה": "#A15C00",
    "חברה": "#C04A12",
    "עולם": "#0B7194",
    "מזג אוויר וטבע": "#4A7A0E",
    "ספורט ותרבות": "#B0175C",
};
const SECTION_FALLBACK = "#3B4250";

export const sectionColour = (name?: string) => (name && SECTION[name]) || SECTION_FALLBACK;

/** the section's colour as a light wash, for a chip or a card that is not the lead */
export const sectionWash = (name: string | undefined, dark: boolean) =>
    sectionColour(name) + (dark ? "33" : "17");

/** the colours the controversies cycle through, one tile each */
export const TILE = ["#5B2BE0", "#0E6870", "#A15C00", "#B0175C", "#047A55", "#0B7194", "#C04A12", "#3E6B2E"];

/** a controversy's own colour, the same one wherever it appears */
export const tileColour = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TILE[h % TILE.length];
};

/** the blocs' inks deep enough to carry white words, in every display: for a screen laid in a bloc's colour */
export const DEEP = { right: "#C62A22", left: "#1F55C2", none: "#3B4250" } as const;

/** what stands around the phone on a wide screen */
export const BOARD = { light: "#1D1442", negative: "#000000", contrast: "#000000" } as const;

/** One family, every weight: Rubik reads as a tool and still has a voice. */
export const FACE = {
    regular: "Rubik_400Regular",
    medium: "Rubik_500Medium",
    semi: "Rubik_600SemiBold",
    bold: "Rubik_700Bold",
    heavy: "Rubik_800ExtraBold",
    black: "Rubik_900Black",
} as const;

const rtl: TextStyle = { writingDirection: "rtl", textAlign: "right" };
const nums: TextStyle["fontVariant"] = ["tabular-nums"];

export const TYPE = {
    hero: { ...rtl, fontFamily: FACE.heavy, fontSize: 27, lineHeight: 33, letterSpacing: -0.4 },
    h1: { ...rtl, fontFamily: FACE.heavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.35 },
    screen: { ...rtl, fontFamily: FACE.black, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
    section: { ...rtl, fontFamily: FACE.heavy, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
    title: { ...rtl, fontFamily: FACE.bold, fontSize: 18.5, lineHeight: 25, letterSpacing: -0.15 },
    row: { ...rtl, fontFamily: FACE.bold, fontSize: 16.5, lineHeight: 23, letterSpacing: -0.1 },
    body: { ...rtl, fontFamily: FACE.regular, fontSize: 15.5, lineHeight: 24 },
    small: { ...rtl, fontFamily: FACE.regular, fontSize: 14, lineHeight: 21 },
    ui: { ...rtl, fontFamily: FACE.medium, fontSize: 14.5, lineHeight: 19 },
    uiStrong: { ...rtl, fontFamily: FACE.semi, fontSize: 14.5, lineHeight: 19 },
    label: { ...rtl, fontFamily: FACE.bold, fontSize: 13, lineHeight: 16 },
    meta: { ...rtl, fontFamily: FACE.regular, fontSize: 12.5, lineHeight: 16, fontVariant: nums },
    figure: { fontFamily: FACE.heavy, fontVariant: nums },
} as const;

export const RADIUS = { card: 20, inner: 14, chip: 999, button: 14 } as const;

/** A row that runs right to left on the web too, where the RTL switch is ignored. */
export const ROW = I18nManager.isRTL ? "row" : "row-reverse";

/** the widest the app is drawn; past this it stands as a phone in the middle of the screen */
export const PHONE = 440;

export function useSite() {
    const { theme } = useThemeControl();
    const { width } = useWindowDimensions();
    const framed = width > PHONE + 40;
    return {
        c: INKS[theme.name] ?? LIGHT,
        type: TYPE,
        theme: theme.name,
        dark: theme.name === "negative",
        /** the app's own width: the screen's, or the phone's when it is framed */
        width: framed ? PHONE : width,
        framed,
        gutter: 16,
    };
}
