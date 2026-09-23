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
