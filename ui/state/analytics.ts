import { Platform } from "react-native";

/**
 * What the app measures about its own use. Anonymously, which here means something
 * stricter than it usually does.
 *
 * Google Analytics normally writes an identifier into the browser so that one
 * person's visits join into one line. This app turns that off - `client_storage:
 * none` - so nothing is written and nothing is read: every visit arrives as a
 * stranger, and no two of them can be joined. What comes back is how many people
 * did a thing, not who kept doing it. That is a real loss, and it is the price of
 * not having to stop a reader at the door to ask for something.
 *
 * The reader's own bloc is the sharpest thing the app knows about them, and it
 * never leaves the device. It is held in this file, in memory, and used only to
 * work out one fact at the moment it matters: whether the article being opened is
 * from the other side of the map. What is sent is `crossed: yes` - a fact about a
 * reading, not about a person. That answers the question the app exists to answer
 * without anyone's politics travelling anywhere.
 *
 * Nothing identifying is ever sent as a parameter: no headline, no link, no
 * address, no answer to the questionnaire.
 *
 * On a phone build this is a no-op - the web SDK needs a browser - and that is
 * where native measurement would go if the app ever ships through a store.
 */

// A Firebase web config is a public client identifier, not a secret: it names the
// project the browser is talking to, and access is governed by the project's own
// rules. It is in the HTML of every Firebase web app in the world.
const CONFIG = {
    apiKey: "AIzaSyAS_SE70VhJsWDoGvhvbDFkESwgy0hUN3g",
    authDomain: "haezrach-hakatan.firebaseapp.com",
    projectId: "haezrach-hakatan",
    storageBucket: "haezrach-hakatan.firebasestorage.app",
    messagingSenderId: "262418488016",
    appId: "1:262418488016:web:f8264fba2fb5d5b25e9cd5",
    measurementId: "G-NFBNXW47J3",
};

// What makes it anonymous, in four settings. The first is the one that matters:
// with no client storage the measurement cannot write or read an identifier, so a
// returning reader is indistinguishable from a new one.
const ANONYMOUS = {
    client_storage: "none",
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
};

type Params = Record<string, string | number | boolean | undefined>;

let analytics: any = null;
let starting: Promise<void> | null = null;
let on = true;
/** the reader's own side. Held here, used here, never sent. */
let readerBloc: string | null = null;
const waiting: { name: string; params?: Params }[] = [];

async function start(): Promise<void> {
    if (analytics || Platform.OS !== "web") return;
    const [{ initializeApp, getApps }, measure] = await Promise.all([
        import("firebase/app"),
        import("firebase/analytics"),
    ]);
    // a browser with analytics blocked, or a private window, answers no here
    if (!(await measure.isSupported())) return;
    const app = getApps().length ? getApps()[0] : initializeApp(CONFIG);
    // ?debug=1 sends this browser's events to the console's DebugView, where they
    // arrive within seconds and carry every parameter by name. Without it they go
    // into the ordinary reports, which are batched and summarised. It is how you
    // check that a thing you just built is firing, and it changes nothing else.
    const debugging = typeof location !== "undefined"
        && (location.search.includes("debug=1") || location.hostname === "localhost");
    analytics = measure.initializeAnalytics(app, {
        config: debugging ? { ...ANONYMOUS, debug_mode: true } : ANONYMOUS,
    });
    for (const queued of waiting.splice(0)) {
        measure.logEvent(analytics, queued.name as any, queued.params);
    }
}

/** The reader's switch, in the personal area. On unless they turn it off. */
export function setMeasuring(wanted: boolean) {
    on = wanted;
    if (!wanted) {
        waiting.length = 0;
        if (analytics) {
            import("firebase/analytics")
                .then((measure) => measure.setAnalyticsCollectionEnabled(analytics, false))
                .catch(() => {});
        }
        return;
    }
    if (analytics) {
        import("firebase/analytics")
            .then((measure) => measure.setAnalyticsCollectionEnabled(analytics, true))
            .catch(() => {});
        return;
    }
    starting = starting ?? start();
}

export function measuring(): boolean {
    return on;
}

/**
 * The reader's declared bloc, kept on this device. The only thing it is ever used
 * for is the line below, which turns it into a fact about a reading.
 */
export function rememberBloc(bloc: string | null | undefined) {
    readerBloc = bloc || null;
}

/** Whether a story from this bloc is from the other side of the reader's map. */
function crossing(outletBloc: unknown): string | undefined {
    if (!readerBloc || readerBloc === "none") return undefined;
    if (outletBloc !== "right" && outletBloc !== "left") return undefined;
    return outletBloc === readerBloc ? "no" : "yes";
}

/** One thing that happened, named for what it is rather than for where it is. */
export function track(name: string, params?: Params) {
    if (Platform.OS !== "web" || !on) return;
    const clean: Params = {};
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "") clean[key] = value;
    }
    if ("outlet_bloc" in clean) {
        const crossed = crossing(clean.outlet_bloc);
        if (crossed) clean.crossed = crossed;
    }
    if (!analytics) {
        starting = starting ?? start();
        if (waiting.length < 50) waiting.push({ name, params: clean });
        return;
    }
    import("firebase/analytics").then((measure) => {
        measure.logEvent(analytics, name as any, clean);
    }).catch(() => {});
}

/** A screen the reader is looking at. GA4 keeps these apart from ordinary events. */
export function trackScreen(name: string) {
    track("screen_view", { screen_name: name, screen_class: name });
}
