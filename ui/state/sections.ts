/**
 * The sections the feed is filtered by, and the colour each one wears.
 *
 * Every article gets a section - that is what the tab above a closed story says
 * and what the filter strip offers. An issue (the political axis) is a different
 * field: most news has none, and only the map uses it.
 *
 * The palette deliberately avoids the two bloc inks. Red and blue mean right and
 * left everywhere else in the app, so a section tab in either would read as a
 * claim about the story. These are earthier and a step darker than the surfaces,
 * so white text sits on them cleanly in both themes.
 */
export const SECTIONS = [
	"מלחמה וביטחון",
	"פוליטיקה",
	"משפט",
	"פלילים ותאונות",
	"כלכלה",
	"דת ומדינה",
	"חברה",
	"עולם",
	"מזג אוויר וטבע",
	"ספורט ותרבות",
] as const;

export type Section = (typeof SECTIONS)[number];

/**
 * The section's colour as a surface rather than as a block of it.
 *
 * A saturated rectangle with white text on it is the loudest thing a label can
 * be, and there is one on every card in the feed. The same colour at a tenth of
 * its strength, with the text in the colour at full, reads by colour just as fast
 * and stops shouting - which is how a category label is drawn anywhere that
 * someone has thought about it.
 */
export function sectionTint(name: string, dark: boolean) {
	const ink = sectionColour(name, dark);
	return {
		fill: ink + (dark ? "2E" : "1C"),   // 18% on dark, 11% on light
		edge: ink + (dark ? "45" : "38"),
		// The label is the same hue carried further from the background, because the
		// colour that makes a good fill does not make readable text on itself:
		// measured on all ten, four of them came out between 3.3 and 4.1 against
		// their own tint, where the standard asks for 4.5. Pulling the ink 22%
		// darker (lighter on the dark ground) puts the worst at 4.9.
		label: shift(ink, dark ? 0.26 : -0.22),
		ink,
	};
}

/** the same colour, moved toward black (negative) or white (positive) */
function shift(hex: string, by: number): string {
	const channel = (i: number) => {
		const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
		const moved = by < 0 ? value * (1 + by) : value + (255 - value) * by;
		return Math.round(Math.max(0, Math.min(255, moved))).toString(16).padStart(2, "0");
	};
	return "#" + channel(0) + channel(1) + channel(2);
}

const COLOURS: Record<string, { light: string; dark: string }> = {
	"מלחמה וביטחון": { light: "#8A4B3C", dark: "#B4644F" },
	"פוליטיקה": { light: "#7B4FA0", dark: "#9E72C4" },
	"משפט": { light: "#4F4E96", dark: "#7675BE" },
	"פלילים ותאונות": { light: "#6B6560", dark: "#938C85" },
	"כלכלה": { light: "#2E7D64", dark: "#4FA487" },
	"דת ומדינה": { light: "#A2742A", dark: "#C69A4B" },
	"חברה": { light: "#C0674E", dark: "#D98A6E" },
	"עולם": { light: "#2F7F86", dark: "#51A6AD" },
	"מזג אוויר וטבע": { light: "#6F8A3F", dark: "#93AE61" },
	"ספורט ותרבות": { light: "#96407A", dark: "#BC659F" },
};

const FALLBACK = { light: "#6B6560", dark: "#938C85" };

export const sectionColour = (section: string | undefined, dark: boolean): string => {
	const pair = (section && COLOURS[section]) || FALLBACK;
	return dark ? pair.dark : pair.light;
};

/** The sections present in the feed, in the order above rather than the feed's. */
export const orderSections = (present: Iterable<string>): string[] => {
	const seen = new Set(present);
	const known = SECTIONS.filter((s) => seen.has(s));
	const extra = [...seen].filter((s) => !SECTIONS.includes(s as Section));
	return [...known, ...extra];
};
