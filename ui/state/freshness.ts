import { Platform } from "react-native";

/**
 * The web app picks up a new version when the reader comes back to it.
 *
 * The page is never cached, but a tab or a home-screen app left open goes on
 * running the code it loaded, deploy after deploy, until it is reloaded - and a
 * fix tested in it looks as if it never shipped. When the app comes back into
 * view, it asks the server which bundle the page names now; if it is not the one
 * running, the app reloads, at the moment the reader has just returned and has
 * nothing in hand.
 */
const ENTRY = /_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/;

export function reloadWhenStale(): () => void {
	if (Platform.OS !== "web" || typeof document === "undefined") return () => {};
	const running = [...document.querySelectorAll("script[src]")]
		.map((s) => (s as HTMLScriptElement).src.match(ENTRY)?.[0])
		.find(Boolean);
	if (!running) return () => {};              // a development build has no such bundle
	let asking = false;
	const check = async () => {
		if (document.visibilityState !== "visible" || asking) return;
		asking = true;
		try {
			const res = await fetch("/", { cache: "no-store" });
			const live = (await res.text()).match(ENTRY)?.[0];
			if (live && live !== running) window.location.reload();
		} catch {
			// offline, or the server did not answer: the next return asks again
		} finally {
			asking = false;
		}
	};
	document.addEventListener("visibilitychange", check);
	return () => document.removeEventListener("visibilitychange", check);
}
