import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";

/**
 * What a reader has asked the app to do differently for them.
 *
 * Israeli law asks a service to be usable by everyone (תקן ישראלי 5568, which
 * follows WCAG 2.0 AA), and these are the three adjustments this app can honestly
 * offer: text size, contrast, and stillness.
 *
 *   text      on the web there is nothing between the reader and a fixed pixel
 *             size, so the whole page is zoomed. On a phone the operating
 *             system's own text size already reaches the app, and the panel says so.
 *   contrast  a third palette, black on white with heavier lines, well past the
 *             4.5:1 the standard asks for.
 *   motion    every animation in the app checks this before it runs: the story
 *             that glides open, the intro, the guides.
 */
export type Access = {
    zoom: number;            // 1 is the design size
    contrast: boolean;
    reduceMotion: boolean;
};

export const DEFAULT_ACCESS: Access = { zoom: 1, contrast: false, reduceMotion: false };

export const ZOOM_STEPS = [0.9, 1, 1.15, 1.3, 1.5];
export const ACCESS_KEY = "access_prefs";

export const loadAccess = async (): Promise<Access> => {
    try {
        const raw = await AsyncStorage.getItem(ACCESS_KEY);
        return raw ? { ...DEFAULT_ACCESS, ...JSON.parse(raw) } : DEFAULT_ACCESS;
    } catch {
        return DEFAULT_ACCESS;
    }
};

export const saveAccess = (value: Access) => {
    AsyncStorage.setItem(ACCESS_KEY, JSON.stringify(value)).catch(() => {});
};

type Ctx = { access: Access; setAccess: (next: Partial<Access>) => void };

export const AccessContext = createContext<Ctx>({
    access: DEFAULT_ACCESS,
    setAccess: () => {},
});

export const useAccess = () => useContext(AccessContext).access;
export const useAccessControl = () => useContext(AccessContext);

/** Animations ask this before they run. */
export const useStillness = () => useContext(AccessContext).access.reduceMotion;
