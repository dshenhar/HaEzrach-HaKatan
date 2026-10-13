import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { Theme, ThemeName } from "./theme";

/**
 * Three ways the app could look, side by side on one preview, for the owner to
 * choose between. Each is a whole visual world: its palette in all three themes,
 * its faces, its corners, and the few signature pieces the feed draws its own way.
 * Function, content and the order of things are the same in all three.
 *
 *   ballot  the polling booth: a grey tray, white slips, black ink, a violet stamp
 *   daf     a page of the Talmud: the story in the middle, the two blocs' readings
 *           of it as the commentaries on either side
 *   sign    wayfinding: yellow panels and black type, yellow kept for finding
 *           your way and for nothing else
 *
 * The choice is read from the address (?d=ballot) so a link can open on one, and
 * kept on the device after that.
 */
export type DirectionName = "ballot" | "daf" | "sign";

export const DIRECTIONS: { key: DirectionName; label: string }[] = [
    { key: "ballot", label: "פתק" },
    { key: "daf", label: "דף" },
    { key: "sign", label: "שלט" },
];

/** The faces each world sets its text in, by the job the text does. */
export type Faces = {
    /** the app's name and the day's title */
    display: string;
    /** a story's headline */
    headline: string;
    /** the summaries, the notes, anything read as a sentence */
    body: string;
    bodyStrong: string;
    /** buttons, chips, labels, the outlets' names */
    ui: string;
    uiStrong: string;
    /** counts, times: anything read as a number */
    figure: string;
};

export type Skin = {
    name: DirectionName;
    faces: Faces;
    /** the corner every surface in the world is cut to */
    radius: { card: number; control: number; chip: number };
    /** what lies outside the phone column on a desktop screen */
    board: (theme: ThemeName) => string;
};

const FACES: Record<DirectionName, Faces> = {
    // A slip's letters are the heaviest thing in the booth, and they are a sans.
    ballot: {
        display: "SecularOne_400Regular",
        headline: "Assistant_800ExtraBold",
        body: "Assistant_400Regular",
        bodyStrong: "Assistant_700Bold",
        ui: "Assistant_600SemiBold",
        uiStrong: "Assistant_800ExtraBold",
        figure: "SecularOne_400Regular",
    },
    // The page is set in the face Israeli print has been set in for a century.
    daf: {
        display: "FrankRuhlLibre_900Black",
        headline: "FrankRuhlLibre_700Bold",
        body: "FrankRuhlLibre_400Regular",
        bodyStrong: "FrankRuhlLibre_700Bold",
        ui: "NotoSansHebrew_500Medium",
        uiStrong: "NotoSansHebrew_700Bold",
        figure: "FrankRuhlLibre_700Bold",
    },
    // One humanist sans on every panel, the way a sign system has one.
    sign: {
        display: "Rubik_800ExtraBold",
        headline: "Rubik_700Bold",
        body: "Rubik_400Regular",
        bodyStrong: "Rubik_600SemiBold",
        ui: "Rubik_500Medium",
        uiStrong: "Rubik_700Bold",
        figure: "Rubik_800ExtraBold",
    },
};

const RADIUS: Record<DirectionName, Skin["radius"]> = {
    // paper is cut square; a slip's corner is only just softened by handling
    ballot: { card: 3, control: 3, chip: 3 },
    // a printed page has no corners to speak of: rules, not boxes
    daf: { card: 0, control: 2, chip: 2 },
    // sign panels are routed metal, a small even radius on every one
    sign: { card: 6, control: 6, chip: 4 },
};

/**
 * Every palette has the same slots as the incumbent theme, so the screens that
 * have not been redrawn yet still take the world's colours from it.
 */
type Palettes = Record<ThemeName, Omit<Theme, "name">>;

const PALETTES: Record<DirectionName, Palettes> = {
    ballot: {
        light: {
            // the booth: a cool grey tray, white slips on it, black ink, and the
            // violet of the committee's stamp for whatever is chosen
            bg: "#E4E4E0", surface: "#FFFFFF", surfaceAlt: "#F3F3F0", track: "#D5D5D0",
            text: "#111111", textMuted: "#55554F", line: "#CACAC4",
            brand: "#111111", brandInk: "#FFFFFF",
            select: "#5B3D8F", selectInk: "#FFFFFF",
            right: "#B3261E", left: "#1F4FA3",
            rightSoft: "#F6E5E3", leftSoft: "#E4EBF7",
        },
        negative: {
            bg: "#141414", surface: "#1E1E1D", surfaceAlt: "#262625", track: "#30302E",
            text: "#F2F2EF", textMuted: "#A6A6A0", line: "#3A3A37",
            brand: "#050505", brandInk: "#F2F2EF",
            select: "#A88BDA", selectInk: "#141414",
            right: "#EE8A80", left: "#93B3EC",
            rightSoft: "#2B1C1B", leftSoft: "#1A2233",
        },
        contrast: {
            bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F0F0F0", track: "#D9D9D9",
            text: "#000000", textMuted: "#333333", line: "#5E5E5E",
            brand: "#000000", brandInk: "#FFFFFF",
            select: "#3E2470", selectInk: "#FFFFFF",
            right: "#8E1B12", left: "#123A7A",
            rightSoft: "#FBEFEE", leftSoft: "#EEF2FA",
        },
    },
    daf: {
        light: {
            // white page, iron-black ink, rules a shade off the page
            bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F4F4F1", track: "#E4E4DF",
            text: "#161616", textMuted: "#5A5A55", line: "#D9D9D3",
            brand: "#161616", brandInk: "#FFFFFF",
            select: "#161616", selectInk: "#FFFFFF",
            right: "#A2302A", left: "#21437F",
            rightSoft: "#F7EDEB", leftSoft: "#EBF0F7",
        },
        negative: {
            bg: "#111111", surface: "#111111", surfaceAlt: "#1B1B1A", track: "#292927",
            text: "#EDEDE8", textMuted: "#A3A39C", line: "#33332F",
            brand: "#EDEDE8", brandInk: "#111111",
            select: "#EDEDE8", selectInk: "#111111",
            right: "#E99288", left: "#97B4E6",
            rightSoft: "#2A1D1B", leftSoft: "#1B2232",
        },
        contrast: {
            bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F0F0F0", track: "#D9D9D9",
            text: "#000000", textMuted: "#333333", line: "#5E5E5E",
            brand: "#000000", brandInk: "#FFFFFF",
            select: "#000000", selectInk: "#FFFFFF",
            right: "#8E1B12", left: "#123A7A",
            rightSoft: "#FBEFEE", leftSoft: "#EEF2FA",
        },
    },
    sign: {
        light: {
            // concrete concourse, white panels, sign black, and the yellow that
            // means "this way" - sections, the chosen tab, the chosen filter
            bg: "#ECECE8", surface: "#FFFFFF", surfaceAlt: "#F5F5F2", track: "#DBDBD5",
            text: "#0F0F0F", textMuted: "#52524D", line: "#CDCDC6",
            brand: "#FFC800", brandInk: "#0F0F0F",
            select: "#0F0F0F", selectInk: "#FFC800",
            right: "#C22D24", left: "#2255AE",
            rightSoft: "#F8E7E5", leftSoft: "#E5ECF8",
        },
        negative: {
            bg: "#0D0D0D", surface: "#191919", surfaceAlt: "#222222", track: "#2D2D2D",
            text: "#F4F4F0", textMuted: "#A8A8A2", line: "#363634",
            brand: "#FFC800", brandInk: "#0F0F0F",
            select: "#FFC800", selectInk: "#0F0F0F",
            right: "#F0897F", left: "#8DB0EE",
            rightSoft: "#2C1C1B", leftSoft: "#1A2234",
        },
        contrast: {
            bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F0F0F0", track: "#D9D9D9",
            text: "#000000", textMuted: "#333333", line: "#5E5E5E",
            brand: "#FFC800", brandInk: "#000000",
            select: "#000000", selectInk: "#FFC800",
            right: "#8E1B12", left: "#123A7A",
            rightSoft: "#FBEFEE", leftSoft: "#EEF2FA",
        },
    },
};

const BOARDS: Record<DirectionName, Record<ThemeName, string>> = {
    ballot: { light: "#CFCFCA", negative: "#070707", contrast: "#E6E6E6" },
    daf: { light: "#E9E9E4", negative: "#060606", contrast: "#E6E6E6" },
    sign: { light: "#1A1A1A", negative: "#050505", contrast: "#1A1A1A" },
};

export const skinOf = (name: DirectionName): Skin => ({
    name,
    faces: FACES[name],
    radius: RADIUS[name],
    board: (theme) => BOARDS[name][theme],
});

export const paletteOf = (name: DirectionName, theme: ThemeName): Theme =>
    ({ name: theme, ...PALETTES[name][theme] });

const KEY = "design_direction";
const isDirection = (v: unknown): v is DirectionName =>
    v === "ballot" || v === "daf" || v === "sign";

/** ?d=sign in the address, read once, before anything is drawn */
const fromAddress = (): DirectionName | null => {
    if (Platform.OS !== "web" || typeof location === "undefined") return null;
    const asked = new URLSearchParams(location.search).get("d");
    return isDirection(asked) ? asked : null;
};

type Ctx = { skin: Skin; setDirection: (next: DirectionName) => void };

const DirectionContext = createContext<Ctx>({ skin: skinOf("ballot"), setDirection: () => {} });

export const useSkin = () => useContext(DirectionContext).skin;
export const useDirectionControl = () => useContext(DirectionContext);

export function DirectionProvider({ children }: { children: React.ReactNode }) {
    const [name, setName] = useState<DirectionName>(() => fromAddress() ?? "ballot");

    useEffect(() => {
        if (fromAddress()) return;          // the link wins over what was kept
        AsyncStorage.getItem(KEY).then((kept) => { if (isDirection(kept)) setName(kept); })
            .catch(() => {});
    }, []);

    const setDirection = (next: DirectionName) => {
        setName(next);
        AsyncStorage.setItem(KEY, next).catch(() => {});
        // keep the address in step, so a copied link opens on what is showing
        if (Platform.OS === "web" && typeof history !== "undefined" && typeof location !== "undefined") {
            const url = new URL(location.href);
            url.searchParams.set("d", next);
            history.replaceState(history.state, "", url.toString());
        }
    };

    return React.createElement(
        DirectionContext.Provider,
        { value: { skin: skinOf(name), setDirection } },
        children,
    );
}
