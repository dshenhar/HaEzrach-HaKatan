import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DEV_CODE_KEY } from "./engagement";

const THEME_KEY = "theme_pref";
const DEV_KEY = "dev_mode";

export type ThemeName = "light" | "negative" | "contrast";

export type Theme = {
	name: ThemeName;
	bg: string;
	surface: string;
	surfaceAlt: string;
	/** a shade darker than surfaceAlt, so a segmented track reads as one object */
	track: string;
	text: string;
	textMuted: string;
	line: string;
	brand: string;
	brandInk: string;
	/** the "this one is chosen" accent - a third hue, clear of both bloc inks */
	select: string;
	selectInk: string;
	right: string;
	left: string;
	rightSoft: string;
	leftSoft: string;
	/** the wash behind the feed, top to bottom; a flat ground leaves it out */
	sheen?: [string, string];
	/** the light edge along the top of a card, which the hard shadow answers */
	edge: string;
	/** what a card's shadow is made of - ink, not black */
	shadow: string;
};

// Paper, but held under a cold light. The ground and the folded stories are the
// same blue-grey a screen is, a shade apart; an open story is white, so opening one
// is a sheet catching the light. The gold stays exactly where it was - it is the
// one warm thing in the app, and it now has nothing to compete with.
export const LIGHT: Theme = {
	name: "light",
	bg: "#F2F5FA", surface: "#ffffff", surfaceAlt: "#E9EEF6", track: "#DDE4EE",
	text: "#111827", textMuted: "#64748B", line: "#DCE3ED",
	brand: "#22C55E", brandInk: "#04310F",
	select: "#DDA01E", selectInk: "#FFFFFF",
	right: "#C0392F", left: "#2B5EA7",
	rightSoft: "#FBEDEB", leftSoft: "#EDF1F9",
	sheen: ["#E7EDF7", "#F7F9FC"],
	edge: "rgba(255,255,255,0.75)", shadow: "rgba(24,45,82,0.17)",
};

// Not a dimmer light theme: the ground goes dark and the two bloc inks lift so
// they stay legible against it, which keeps red and blue reading as data.
export const NEGATIVE: Theme = {
	name: "negative",
	bg: "#0E0E11", surface: "#18181C", surfaceAlt: "#202027", track: "#2B2B34",
	text: "#F2F2F0", textMuted: "#9A9A95", line: "#2E2E36",
	brand: "#3DD67F", brandInk: "#04310F",
	select: "#E4A92B", selectInk: "#FFFFFF",
	right: "#E8837A", left: "#8FB4E8",
	rightSoft: "#2A1B1A", leftSoft: "#17202E",
	sheen: ["#101018", "#0C0C0F"],
	edge: "rgba(255,255,255,0.06)", shadow: "rgba(0,0,0,0.5)",
};

// The third palette is not a style but an adjustment: black on white, heavier
// lines, and bloc inks dark enough that the map still reads when the rest does.
// Every pair here is past 7:1, where the standard asks for 4.5:1.
export const CONTRAST: Theme = {
	name: "contrast",
	bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F2F2F2", track: "#DADADA",
	text: "#000000", textMuted: "#3A3A3A", line: "#6B6B6B",
	brand: "#046A38", brandInk: "#FFFFFF",
	select: "#8A5A00", selectInk: "#FFFFFF",
	right: "#8E1B12", left: "#123A7A",
	rightSoft: "#FBEFEE", leftSoft: "#EEF2FA",
	// no wash and no soft edge here: this palette is an adjustment, not a look
	edge: "transparent", shadow: "rgba(0,0,0,0.45)",
};

const PALETTES: Record<ThemeName, Theme> = {
	light: LIGHT, negative: NEGATIVE, contrast: CONTRAST,
};

type Ctx = {
	theme: Theme;
	setThemeName: (n: ThemeName) => void;
	devMode: boolean;
	setDevMode: (on: boolean) => void;
};

const ThemeContext = createContext<Ctx>({
	theme: LIGHT, setThemeName: () => {}, devMode: false, setDevMode: () => {},
});

export const useTheme = () => useContext(ThemeContext).theme;
export const useThemeControl = () => useContext(ThemeContext);
export const useDevMode = () => useContext(ThemeContext).devMode;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [name, setName] = useState<ThemeName>("light");
	const [devMode, setDev] = useState(false);

	useEffect(() => {
		AsyncStorage.getItem(THEME_KEY).then((v) => {
			if (v === "negative" || v === "light" || v === "contrast") setName(v as ThemeName);
		});
		// dev mode only comes back on a device that has been given the code
		Promise.all([AsyncStorage.getItem(DEV_KEY), AsyncStorage.getItem(DEV_CODE_KEY)])
			.then(([on, code]) => setDev(on === "1" && !!code));
	}, []);

	const setDevMode = (on: boolean) => {
		setDev(on);
		AsyncStorage.setItem(DEV_KEY, on ? "1" : "0").catch(() => {});
	};

	const setThemeName = (next: ThemeName) => {
		setName(next);
		AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
	};

	return React.createElement(
		ThemeContext.Provider,
		{ value: { theme: PALETTES[name] ?? LIGHT, setThemeName, devMode, setDevMode } },
		children,
	);
}
