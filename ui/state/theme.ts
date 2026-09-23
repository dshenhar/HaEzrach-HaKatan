import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DEV_CODE_KEY } from "./engagement";

const THEME_KEY = "theme_pref";
const DEV_KEY = "dev_mode";

export type ThemeName = "light" | "negative";

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
};

export const LIGHT: Theme = {
	name: "light",
	bg: "#f8f8f8", surface: "#ffffff", surfaceAlt: "#F4F4F3", track: "#E4E3DF",
	text: "#111827", textMuted: "#6B7280", line: "#E3E3E1",
	brand: "#22C55E", brandInk: "#04310F",
	select: "#DDA01E", selectInk: "#FFFFFF",
	right: "#C0392F", left: "#2B5EA7",
	rightSoft: "#FBEDEB", leftSoft: "#EDF1F9",
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
			if (v === "negative" || v === "light") setName(v);
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
		{ value: { theme: name === "negative" ? NEGATIVE : LIGHT, setThemeName, devMode, setDevMode } },
		children,
	);
}
