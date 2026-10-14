import { useEffect, useState } from "react";
import { URL_BASE } from "./engagement";

/**
 * The day and the weather the feed's header shows on either side of the logo.
 *
 * The Hebrew date comes from the browser's own Hebrew calendar and is written out
 * here in letters, the way a newspaper's masthead has it: "ג׳ חשוון ה׳תשפ״ז". The
 * date is the civil day's, as on a masthead, not the one that turns at sunset.
 *
 * The weather is Jerusalem's, from the API, which asks MET Norway for it once for
 * every reader. Night and day are the sun's: the moon shows from the minute it
 * sets, whatever hour the forecast was made for.
 */

export const CITY = { name: "ירושלים", lat: 31.7683, lon: 35.2137 };

const GERESH = "׳";
const GERSHAYIM = "״";
const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

/** 1..999 in letters, with its geresh or gershayim: 3 "ג׳", 15 "ט״ו", 787 "תשפ״ז" */
export function inLetters(n: number): string {
    const rest = n % 100;
    // fifteen and sixteen are written nine-six and nine-seven, not with the Name
    const tail = rest === 15 ? "טו" : rest === 16 ? "טז" : TENS[Math.floor(rest / 10)] + ONES[rest % 10];
    const word = HUNDREDS[Math.floor(n / 100) % 10] + tail;
    return word.length === 1 ? word + GERESH : word.slice(0, -1) + GERSHAYIM + word.slice(-1);
}

// the calendar's English month names, as browsers give them, in Hebrew
const MONTHS: [RegExp, string][] = [
    [/^tish/i, "תשרי"], [/hesh|chesh/i, "חשוון"], [/^kislev/i, "כסלו"], [/^tevet/i, "טבת"],
    [/^she?vat/i, "שבט"], [/^adar (i|1)$/i, "אדר א׳"], [/^adar (ii|2)$/i, "אדר ב׳"], [/^adar$/i, "אדר"],
    [/^nisan/i, "ניסן"], [/^iyy?ar/i, "אייר"], [/^sivan/i, "סיוון"], [/^tamm?uz/i, "תמוז"], [/^av$/i, "אב"],
    [/^elul/i, "אלול"],
];

/** "ג׳ חשוון ה׳תשפ״ז" - or null where the browser has no Hebrew calendar */
export function hebrewDate(day: Date): string | null {
    try {
        const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" })
            .formatToParts(day);
        const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
        const date = parseInt(part("day"), 10);
        const year = parseInt(part("year"), 10);
        const month = MONTHS.find(([name]) => name.test(part("month").trim()))?.[1];
        if (!date || !year || !month) return null;
        // the thousands a letter with its geresh, and then the rest: "ה׳" + "תשפ״ז"
        return `${inLetters(date)} ${month} ${inLetters(Math.floor(year / 1000))}${inLetters(year % 1000)}`;
    } catch {
        return null;
    }
}

/** "15.10.2026" */
export function civilDate(day: Date): string {
    const two = (n: number) => String(n).padStart(2, "0");
    return `${two(day.getDate())}.${two(day.getMonth() + 1)}.${day.getFullYear()}`;
}

/** the sun's height over the horizon, in degrees: the usual short solar formulas */
export function sunHeight(at: Date, lat: number, lon: number): number {
    const rad = Math.PI / 180;
    const d = at.getTime() / 86400000 - 10957.5;                 // days since 2000-01-01 12:00 UTC
    const anomaly = (357.529 + 0.98560028 * d) * rad;
    const mean = 280.459 + 0.98564736 * d;
    const along = (mean + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * rad;
    const tilt = (23.439 - 0.00000036 * d) * rad;
    const ascension = Math.atan2(Math.cos(tilt) * Math.sin(along), Math.cos(along));
    const declination = Math.asin(Math.sin(tilt) * Math.sin(along));
    const sidereal = ((18.697374558 + 24.06570982441908 * d) % 24) * 15;
    const hour = (sidereal + lon) * rad - ascension;
    return Math.asin(Math.sin(lat * rad) * Math.sin(declination)
        + Math.cos(lat * rad) * Math.cos(declination) * Math.cos(hour)) / rad;
}

/** after sunset and before sunrise: the sun's middle is 0.833° under the horizon at both */
export const isNight = (at: Date) => sunHeight(at, CITY.lat, CITY.lon) < -0.833;

/** MET Norway's symbol for the hour as a picture, the moon for a clear night */
export function weatherIcon(symbol: string | null | undefined, night: boolean): string {
    const kind = (symbol ?? "").replace(/_(day|night|polartwilight)$/, "");
    if (/thunder/.test(kind)) return "⛈️";
    if (/snow|sleet/.test(kind)) return "🌨️";
    if (/^light(rain)?showers$/.test(kind) && !night) return "🌦️";
    if (/rain|showers/.test(kind)) return "🌧️";
    if (kind === "fog") return "🌫️";
    if (kind === "cloudy") return "☁️";
    if (night) return "🌙";
    if (kind === "partlycloudy") return "⛅";
    if (kind === "fair") return "🌤️";
    return "☀️";
}

/** the time, moved on every minute, so the date turns at midnight and the moon comes out */
export function useMinute(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 60 * 1000);
        return () => clearInterval(tick);
    }, []);
    return now;
}

export type Weather = { city: string; temp: number; symbol: string | null };

const ASK_EVERY = 20 * 60 * 1000;
let kept: { value: Weather | null; at: number } = { value: null, at: 0 };

/** Jerusalem's weather, asked again every twenty minutes; null until it comes, or if it does not */
export function useWeather(): Weather | null {
    const [weather, setWeather] = useState<Weather | null>(kept.value);
    useEffect(() => {
        let gone = false;
        const ask = async () => {
            if (kept.value && Date.now() - kept.at < ASK_EVERY) {
                setWeather(kept.value);
                return;
            }
            try {
                const res = await fetch(`${URL_BASE}/weather`);
                const body = await res.json();
                if (typeof body?.temp !== "number") return;
                kept = { value: { city: body.city || CITY.name, temp: body.temp, symbol: body.symbol ?? null }, at: Date.now() };
                if (!gone) setWeather(kept.value);
            } catch {
                // the header goes on without it
            }
        };
        ask();
        const again = setInterval(ask, ASK_EVERY);
        return () => { gone = true; clearInterval(again); };
    }, []);
    return weather;
}
