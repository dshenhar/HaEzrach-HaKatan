/**
 * A blindspot: a story one bloc told and the other did not.
 *
 * This is the one finding in the app that needs no judgement at all. Who covered a
 * story is a count, not an opinion, and "four outlets on the right ran this and
 * nobody on the left did" is a fact a reader can check in a minute. It is also the
 * single most useful thing the app can say, because it is the only one that names
 * something the reader could not have known was missing.
 *
 * The rule has a floor. One outlet on one side and none on the other is a thin
 * story, not a blindspot - a single desk working late. Two is where a side has
 * made a choice. The floor is here, in one place, because it is a claim the app
 * makes in public and the methodology page quotes this number.
 */
export const FLOOR = 2;

export type Split = { right: number; left: number };

/**
 * Which bloc is missing the story, or null if both told it - or if neither told it
 * loudly enough for the silence to mean anything.
 *
 * Note which way round this is, because it is the easy mistake and it would print
 * the finding backwards: a story two right-wing outlets ran and no left-wing one
 * did is a blindspot *of the left*. The side that is named is the side that is not
 * there.
 */
export function blindTo({ right, left }: Split): "right" | "left" | null {
    if (right >= FLOOR && left === 0) return "left";
    if (left >= FLOOR && right === 0) return "right";
    return null;
}

/**
 * What to call it, for a reader whose own side we may or may not know.
 *
 * Ground News says "Blindspot for the Right". When we know the reader is on that
 * side, it stops being a fact about a bloc and becomes a fact about them - which
 * is the whole point of having asked.
 */
export function blindLabel(missing: "right" | "left", readerBloc?: string | null): string {
    if (readerBloc === missing) return "הצד שלך לא סיקר את זה";
    return missing === "right" ? "הימין לא סיקר את זה" : "השמאל לא סיקר את זה";
}

/** The ink the badge is drawn in: the colour of the side that is missing. */
export const BLIND_INK = { right: "#C0392F", left: "#2B5EA7" } as const;
