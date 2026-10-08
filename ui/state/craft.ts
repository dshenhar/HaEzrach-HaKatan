/**
 * The numbers the interface is made of: light, type and motion.
 *
 * They live together because they are one decision. A card's shadow, the tracking
 * on its headline and the spring that opens it all answer the same question - is
 * this a real object on a surface, or a div with a border? Nothing here is
 * arbitrary; every value below is one someone can ask about and get an answer.
 *
 * The app had the opposite of this: a 3px hard offset shadow on everything, one
 * letter-spacing for every size, and fixed-duration timing curves. Each is the
 * cheap version of the thing it stands in for.
 */

// ---------------------------------------------------------------- light
/**
 * Two shadows, always. A real object casts a tight dark contact shadow where it
 * meets the surface and a wide faint one from the light in the room; one blurred
 * drop shadow reads as a sticker, and a hard offset shadow reads as a diagram of
 * a shadow. The ink is the app's own near-black rather than pure black, so the
 * shadow belongs to the page instead of being a grey film over it.
 */
export const ELEVATION = {
    /** a folded story, lying on the feed */
    rest: "0 1px 2px rgba(17,24,39,0.055), 0 2px 7px rgba(17,24,39,0.045)",
    /** the open story: lifted, and the only card at this height */
    raised: "0 1px 3px rgba(17,24,39,0.07), 0 10px 28px rgba(17,24,39,0.10)",
    /** chrome that floats over content and must separate from anything under it */
    float: "0 2px 6px rgba(17,24,39,0.10), 0 12px 32px rgba(17,24,39,0.16)",
    /** a sheet that owns the screen */
    sheet: "0 2px 8px rgba(17,24,39,0.10), 0 24px 60px rgba(17,24,39,0.22)",
} as const;

export const ELEVATION_DARK = {
    rest: "0 1px 2px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.35)",
    raised: "0 1px 3px rgba(0,0,0,0.5), 0 10px 28px rgba(0,0,0,0.45)",
    float: "0 2px 6px rgba(0,0,0,0.55), 0 12px 32px rgba(0,0,0,0.5)",
    sheet: "0 2px 8px rgba(0,0,0,0.6), 0 24px 60px rgba(0,0,0,0.55)",
} as const;

export const elevation = (dark: boolean) => (dark ? ELEVATION_DARK : ELEVATION);

// ---------------------------------------------------------------- type
/**
 * Tracking is size-specific or it is wrong somewhere. Letters drift apart as they
 * grow, so large text is pulled in; small text needs air to stay legible, so it is
 * let out. Leading runs the other way - tight on a headline, generous on a
 * paragraph. Hebrew has no ascenders and descenders to speak of, which is why the
 * leading here is a little tighter than the same scale in Latin would want.
 */
export const TYPE = {
    display: { fontSize: 30, lineHeight: 34, letterSpacing: -0.66, fontFamily: "Heebo_800ExtraBold" },
    title:   { fontSize: 20, lineHeight: 25, letterSpacing: -0.3, fontFamily: "Heebo_800ExtraBold" },
    brand:   { fontSize: 21, lineHeight: 23, letterSpacing: -0.4, fontFamily: "Heebo_800ExtraBold" },
    headline:{ fontSize: 14.5, lineHeight: 20, letterSpacing: -0.08, fontFamily: "Heebo_700Bold" },
    body:    { fontSize: 13, lineHeight: 20, letterSpacing: 0, fontFamily: "Heebo_400Regular" },
    caption: { fontSize: 11.5, lineHeight: 16, letterSpacing: 0.05, fontFamily: "Heebo_400Regular" },
    label:   { fontSize: 12.5, lineHeight: 17, letterSpacing: 0.05, fontFamily: "Heebo_700Bold" },
    micro:   { fontSize: 10.5, lineHeight: 14, letterSpacing: 0.14, fontFamily: "Heebo_700Bold" },
} as const;

// ---------------------------------------------------------------- motion
/**
 * Springs rather than durations, because a spring can be interrupted: new input
 * only moves the target and the motion stays continuous, where a timing curve has
 * to be cancelled and restarted and shows the seam.
 *
 * Reanimated asks for stiffness and damping; the two numbers worth thinking in are
 * the damping ratio and the response. These are converted from them, for mass 1:
 *   stiffness = (2π / response)²      damping = 2 · ratio · √stiffness
 */
/** ratio 1.0, response 0.38s - critically damped, no overshoot. The default. */
export const SETTLE = { mass: 1, stiffness: 273, damping: 33 } as const;
/** ratio 0.8, response 0.30s - a little overshoot, and only after a real gesture */
export const GIVE = { mass: 1, stiffness: 439, damping: 34 } as const;

/** what a press does, the instant the finger lands rather than when it lifts */
export const PRESS_SCALE = 0.975;
export const PRESS_MS = 110;

/**
 * The card under the reader's thumb while a list moves - the feed's stories, the
 * hot topics. It swells by `scale` in `ms`, and the one a scroll stopped on stays
 * swollen for `lingerMs`: a phone's flick crosses a dozen cards too fast for any of
 * them to be seen growing, and one that settled the moment the scroll stopped was
 * never seen growing at all. 3% of a phone-wide card is about 11 points, which
 * reads as a lift and not a jump.
 */
export const SWELL = { scale: 0.03, ms: 170, lingerMs: 700 } as const;

// ---------------------------------------------------------------- material
/**
 * Translucent chrome, with the content running underneath it rather than stopping
 * at a solid strip. The bright inner edge is the light catching the near side of
 * the material - without it the layer reads as a flat tint instead of glass.
 */
export const GLASS = {
    light: {
        backgroundColor: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(22px) saturate(180%)",
        borderColor: "rgba(255,255,255,0.65)",
    },
    dark: {
        backgroundColor: "rgba(22,22,26,0.72)",
        backdropFilter: "blur(22px) saturate(180%)",
        borderColor: "rgba(255,255,255,0.09)",
    },
} as const;

export const glass = (dark: boolean) => (dark ? GLASS.dark : GLASS.light);
