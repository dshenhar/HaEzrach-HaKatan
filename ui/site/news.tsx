import { getSitePositions, loadFeed, NewsItem, SitePosition, storySummaries } from "@/state/engagement";
import { HotPage, HotTopic, loadHot } from "@/state/hotTopics";
import { blindTo } from "@/state/blindspot";
import { orderSections } from "@/state/sections";
import { TILE, tileColour } from "./tokens";
import { track } from "@/state/analytics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

export type Story = NewsItem[];
export type Side = "right" | "left";

/** One story, read once: who told it, from which side, and when. */
export type Reading = {
    id: string;
    story: Story;
    lead: NewsItem;
    rightItems: NewsItem[];
    leftItems: NewsItem[];
    otherItems: NewsItem[];
    right: number;
    left: number;
    other: number;
    total: number;
    /** the side that left it out, if one did (see state/blindspot.ts) */
    missing: Side | null;
    /** when the first outlet ran it, and when the last one did */
    first: Date | null;
    last: Date | null;
    section: string;
    topic: string;
    summaries: Partial<Record<Side | "all", string>>;
};

export const storyId = (story: Story) => String(story[0]?.groupId ?? story[0]?.id ?? "");

const timeOf = (item: NewsItem) => {
    const t = new Date(item.time).getTime();
    return Number.isNaN(t) ? null : t;
};

export function read(story: Story, positions: Record<string, SitePosition>): Reading {
    const rightItems: NewsItem[] = [];
    const leftItems: NewsItem[] = [];
    const otherItems: NewsItem[] = [];
    story.forEach((item) => {
        const bloc = positions[item.source]?.bloc;
        (bloc === "right" ? rightItems : bloc === "left" ? leftItems : otherItems).push(item);
    });
    const times = story.map(timeOf).filter((t): t is number => t !== null);
    const right = rightItems.length;
    const left = leftItems.length;
    return {
        id: storyId(story),
        story,
        lead: story[0],
        rightItems, leftItems, otherItems,
        right, left, other: otherItems.length, total: story.length,
        missing: blindTo({ right, left }),
        first: times.length ? new Date(Math.min(...times)) : null,
        last: times.length ? new Date(Math.max(...times)) : null,
        section: story[0]?.section ?? "",
        topic: story[0]?.topic ?? "",
        summaries: storySummaries(story),
    };
}

/**
 * The front page's lead: the story the most outlets told, among those that broke
 * in the last eighteen hours, the newer winning a tie. The day's biggest story is
 * the one the most desks decided to run - a count, like everything else here.
 */
export function pickLead(readings: Reading[]): Reading | null {
    const since = Date.now() - 18 * 60 * 60 * 1000;
    const recent = readings.filter((r) => (r.first?.getTime() ?? 0) >= since);
    const pool = recent.length ? recent : readings;
    return [...pool].sort((a, b) => b.total - a.total
        || (b.first?.getTime() ?? 0) - (a.first?.getTime() ?? 0))[0] ?? null;
}

/** newest first, by when the story broke */
export const byNewest = (a: Reading, b: Reading) =>
    (b.first?.getTime() ?? 0) - (a.first?.getTime() ?? 0);

type News = {
    readings: Reading[];
    positions: Record<string, SitePosition>;
    hot: HotPage | null;
    /** the sections today's stories are filed under, in the palette's order */
    sections: string[];
    /** first load not back yet */
    loading: boolean;
    /** the feed could not be had at all */
    failed: boolean;
    /** the newest article anywhere in the feed */
    updated: Date | null;
    refresh: () => Promise<void>;
    byId: (id: string) => Reading | undefined;
    hotById: (id: string) => HotTopic | undefined;
    /** the controversies in the order they are shown: today's first, then the most burning */
    hotOrdered: HotTopic[];
    /** a controversy's colour, the same wherever it appears, and never the same as the one beside it */
    tileOf: (id: string) => string;
};

const NewsContext = createContext<News | null>(null);

export function useNews(): News {
    const news = useContext(NewsContext);
    if (!news) throw new Error("useNews outside NewsProvider");
    return news;
}

const EVERY = 5 * 60 * 1000;

/**
 * The day's paper, fetched once and shared by every page: the stories, where each
 * outlet stands, and the controversies. It is fetched again every five minutes
 * while the site is open and whenever the reader comes back to it; a fetch that
 * fails keeps what is already on the page.
 */
export function NewsProvider({ children }: { children: React.ReactNode }) {
    const [feed, setFeed] = useState<Story[] | null>(null);
    const [positions, setPositions] = useState<Record<string, SitePosition>>({});
    const [hot, setHot] = useState<HotPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const busy = useRef(false);
    // whether any feed has ever arrived: a failure then keeps it, rather than failing the page
    const hadFeed = useRef(false);

    const refresh = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        const [nextFeed, nextPositions, nextHot] = await Promise.all([
            loadFeed(), getSitePositions(), loadHot(),
        ]);
        busy.current = false;
        if (nextFeed) {
            hadFeed.current = true;
            setFeed(nextFeed);
            setFailed(false);
        } else {
            setFailed(!hadFeed.current);
            track("api_failed", { where: "feed" });
        }
        if (Object.keys(nextPositions).length) setPositions(nextPositions);
        if (nextHot) setHot(nextHot);
        setLoading(false);
    }, []);

    useEffect(() => {
        void Promise.resolve().then(refresh);
        const timer = setInterval(refresh, EVERY);
        const sub = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
        return () => { clearInterval(timer); sub.remove(); };
    }, [refresh]);

    const value = useMemo<News>(() => {
        const readings = (feed ?? []).filter((s) => s.length).map((s) => read(s, positions));
        const index = new Map(readings.map((r) => [r.id, r]));
        const hotIndex = new Map((hot?.topics ?? []).map((t) => [t.id, t]));
        const today = (hot?.today ?? []).map((id) => hotIndex.get(id)).filter((t): t is HotTopic => !!t);
        const hotOrdered = [...today, ...(hot?.topics ?? []).filter((t) => !hot?.today.includes(t.id))
            .sort((a, b) => b.relevance - a.relevance)];
        const tiles = new Map(hotOrdered.map((t, i) => [t.id, TILE[i % TILE.length]]));
        const lasts = readings.map((r) => r.last?.getTime() ?? 0);
        return {
            readings,
            positions,
            hot,
            sections: orderSections(readings.map((r) => r.section).filter(Boolean)),
            loading,
            failed,
            updated: lasts.length ? new Date(Math.max(...lasts)) : null,
            refresh,
            byId: (id) => index.get(id),
            hotById: (id) => hotIndex.get(id),
            hotOrdered,
            tileOf: (id) => tiles.get(id) ?? tileColour(id),
        };
    }, [feed, positions, hot, loading, failed, refresh]);

    return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

// ------------------------------------------------------------------ dates

const pad = (n: number) => String(n).padStart(2, "0");

export const clock = (d: Date | null) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "");

/** "13:42" today, "אתמול 22:10" yesterday, a date before that */
export function when(d: Date | null): string {
    if (!d) return "";
    const now = new Date();
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return clock(d);
    if (diff === 1) return `אתמול ${clock(d)}`;
    return `${d.getDate()}.${d.getMonth() + 1} ${clock(d)}`;
}

/** "יום שלישי, 13 באוקטובר 2026" */
export function longDate(d: Date): string {
    try {
        return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
    } catch {
        return d.toDateString();
    }
}

const LETTERS: [number, string][] = [
    [400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"], [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"],
    [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"], [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"],
    [3, "ג"], [2, "ב"], [1, "א"],
];

/** a number in Hebrew letters, the way a date is written: 2 is ב׳, 15 is ט״ו, 787 is תשפ״ז */
export function gematria(n: number): string {
    let rest = n;
    let out = "";
    while (rest > 0) {
        // fifteen and sixteen are not written with the letters of the Name
        if (rest === 15) { out += "טו"; break; }
        if (rest === 16) { out += "טז"; break; }
        const [value, letter] = LETTERS.find(([v]) => v <= rest)!;
        out += letter;
        rest -= value;
    }
    return out.length === 1 ? `${out}׳` : `${out.slice(0, -1)}״${out.slice(-1)}`;
}

/** "ב׳ בחשוון תשפ״ז", where the browser knows the Hebrew calendar */
export function hebrewDate(d: Date): string {
    try {
        const parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" })
            .formatToParts(d);
        const day = Number(parts.find((p) => p.type === "day")?.value);
        const month = parts.find((p) => p.type === "month")?.value;
        const year = Number(parts.find((p) => p.type === "year")?.value);
        if (!day || !month || !year) return "";
        return `${gematria(day)} ב${month} ${gematria(year % 1000)}`;
    } catch {
        return "";
    }
}

/** "לפני 12 דקות", for the masthead's last update */
export function ago(d: Date | null): string {
    if (!d) return "";
    const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (minutes < 1) return "עכשיו";
    if (minutes === 1) return "לפני דקה";
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.round(minutes / 60);
    if (hours === 1) return "לפני שעה";
    if (hours === 2) return "לפני שעתיים";
    return `לפני ${hours} שעות`;
}

/** "גוף אחד", "2 גופים" */
export const outlets = (n: number) => (n === 1 ? "גוף אחד" : `${n} גופים`);
