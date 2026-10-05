import { Platform } from "react-native";

/**
 * What the app measures about its own use, and the one gate it all goes through.
 *
 * This is full measurement: Firebase Analytics sets a persistent identifier in the
 * browser, so one reader's visits join into one line rather than looking like a new
 * person every morning. That is the only way to answer the questions this app was
 * built to answer - does someone who reads one side come back and read the other,
 * does the blind survey hold anyone's attention, does the tour help - and it is
 * also why the reader is asked first, why the privacy policy says it plainly, and
 * why nothing here fires until they have said yes.
 *
 * Nothing identifying is ever sent as a parameter. No headline, no link, no
 * address, no answer to the questionnaire - only the shape of what happened: which
 * view, which bloc, how many outlets, how long. The reader's own bloc goes in as a
 * user property because the whole thesis of the app rests on measuring whether
 * people cross it, and that one is a side rather than a person.
 *
 * On a phone build this is a no-op: the web SDK needs a browser, and the native
 * measurement SDK needs a rebuilt binary. When the app ships through a store, this
 * file is where that goes.
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

type Params = Record<string, string | number | boolean | undefined>;

let analytics: any = null;
let starting: Promise<void> | null = null;
let allowed = false;
/** events that happened before the reader answered, replayed once they say yes */
const waiting: { name: string; params?: Params }[] = [];
const properties: Record<string, string> = {};

async function start(): Promise<void> {
    if (analytics || Platform.OS !== "web") return;
    const [{ initializeApp, getApps }, measure] = await Promise.all([
        import("firebase/app"),
        import("firebase/analytics"),
    ]);
    // a browser with analytics blocked, or a private window, answers no here
    if (!(await measure.isSupported())) return;
    const app = getApps().length ? getApps()[0] : initializeApp(CONFIG);
    analytics = measure.getAnalytics(app);
    for (const [key, value] of Object.entries(properties)) {
        measure.setUserProperties(analytics, { [key]: value });
    }
    for (const queued of waiting.splice(0)) {
        measure.logEvent(analytics, queued.name as any, queued.params);
    }
}

/**
 * Turn measurement on or off. Off is the state the app starts in and the state it
 * returns to the moment the reader changes their mind - the queue is dropped too,
 * so nothing that happened while they were deciding is sent afterwards.
 */
export function allowMeasurement(on: boolean) {
    allowed = on;
    if (!on) {
        waiting.length = 0;
        return;
    }
    starting = starting ?? start();
}

export function measuring(): boolean {
    return allowed;
}

/** One thing that happened, named for what it is rather than for where it is. */
export function track(name: string, params?: Params) {
    if (Platform.OS !== "web" || !allowed) return;
    const clean: Params = {};
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "") clean[key] = value;
    }
    if (!analytics) {
        starting = starting ?? start();
        if (waiting.length < 50) waiting.push({ name, params: clean });
        void starting?.then(() => {});
        return;
    }
    import("firebase/analytics").then((measure) => {
        measure.logEvent(analytics, name as any, clean);
    }).catch(() => {});
}

/** Something true of this reader for the rest of the session, not of one moment. */
export function describeReader(props: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(props)) {
        if (value) properties[key] = value;
    }
    if (Platform.OS !== "web" || !allowed || !analytics) return;
    import("firebase/analytics").then((measure) => {
        measure.setUserProperties(analytics, properties);
    }).catch(() => {});
}

/** A screen the reader is looking at. GA4 keeps these apart from ordinary events. */
export function trackScreen(name: string) {
    track("screen_view", { screen_name: name, screen_class: name });
}
