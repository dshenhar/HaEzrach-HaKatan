import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Adding the site to a home screen. Two different doors, one decision.
 *
 * Chromium (Android, desktop Chrome and Edge) hands us a `beforeinstallprompt`
 * and we open its own install dialog. iPhone has no such event: Safari gets the
 * three steps, and any other browser on the phone is told to open Safari, which
 * is the only place the step exists. Everywhere else there is nothing to offer,
 * so nothing is shown.
 *
 * The listener is attached as early as the root layout is imported, because the
 * event can arrive while the opening splash is still up. Holding it (and
 * cancelling the browser's own bar) means the button in the feed is the one
 * install dialog, not a second one beside it.
 */

const DISMISS_KEY = "install_banner_dismissed";

export type InstallKind = "prompt" | "ios-safari" | "ios-other";

type PromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: PromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function readInstalled(): boolean {
	if (typeof window === "undefined") return false;
	const nav = window.navigator as Navigator & { standalone?: boolean };
	// iOS Safari reports a home-screen launch here, and nowhere else
	if (nav.standalone === true) return true;
	if (typeof window.matchMedia !== "function") return false;
	return window.matchMedia(
		"(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)",
	).matches;
}

function agent(): string {
	if (typeof navigator === "undefined") return "";
	return navigator.userAgent || "";
}

/** An iPhone or iPad, including an iPad that claims to be a Mac. */
export function isIos(): boolean {
	const ua = agent();
	if (/iphone|ipad|ipod/i.test(ua)) return true;
	return typeof navigator !== "undefined"
		&& navigator.platform === "MacIntel"
		&& navigator.maxTouchPoints > 1;
}

/**
 * Home screen install on an iPhone exists only in Safari. Chrome, Firefox and
 * Edge there are Safari's engine with the step removed.
 */
export function isIosSafari(): boolean {
	if (!isIos()) return false;
	// Chrome, Firefox, Edge, and the in-app browsers are WebKit with the
	// home-screen step taken out. Their user agent often still says Safari.
	if (/crios|fxios|edgios|opios|instagram|fban|fbav|whatsapp|gsa\/|micromessenger|line\//i.test(agent())) {
		return false;
	}
	return /safari/i.test(agent());
}

/** What we can offer on this visit, or null when there is nothing to say. */
export function installKind(): InstallKind | null {
	if (Platform.OS !== "web" || typeof window === "undefined") return null;
	if (installed) return null;
	// an iPhone never fires the prompt, and a desktop Chrome pretending to be one
	// (device emulation) should still show the steps a phone would
	if (isIosSafari()) return "ios-safari";
	if (isIos()) return "ios-other";
	if (deferred) return "prompt";
	return null;
}

export function listenForInstall() {
	if (listening || Platform.OS !== "web" || typeof window === "undefined") return;
	listening = true;
	installed = readInstalled();
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferred = event as PromptEvent;
		notify();
	});
	window.addEventListener("appinstalled", () => {
		deferred = null;
		installed = true;
		notify();
	});
}

listenForInstall();

export function subscribeInstall(listener: () => void): () => void {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}

/** Opens the browser's install dialog. The event is spent either way. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
	const event = deferred;
	if (!event) return "unavailable";
	try {
		await event.prompt();
		const choice = await event.userChoice;
		deferred = null;
		if (choice.outcome === "accepted") installed = true;
		notify();
		return choice.outcome;
	} catch {
		deferred = null;
		notify();
		return "unavailable";
	}
}

export const wasInstallDismissed = async () =>
	(await AsyncStorage.getItem(DISMISS_KEY).catch(() => null)) === "1";

export const dismissInstallBanner = () => {
	AsyncStorage.setItem(DISMISS_KEY, "1").catch(() => {});
};
