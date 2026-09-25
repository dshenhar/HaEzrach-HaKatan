import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { I18nManager } from "react-native";
import FeedControls, { BlocFilter, SortKey } from "./feedControls";
import ViewModeToggle, { ViewMode } from "./viewModeToggle";
import ModeGuide from "./modeGuide";
import WelcomeGuide from "./welcomeGuide";
import GuideBackdrop from "./guideBackdrop";
import StoryCard from "./storyCard";
import TourQuestionnaire from "./tourQuestionnaire";
import RatingSheet from "./ratingSheet";
import { fetchArticles, getSitePositions, getTopics, mergeClusters, NewsItem, SitePosition } from "@/state/engagement";
import { orderSections } from "@/state/sections";
import { useQuestionnaire } from "@/state/questionnaire";
import { ScrollLock } from "@/state/scrollLock";
import { getProfile, ReaderProfile } from "@/state/profile";
import { useDevMode, useTheme } from "@/state/theme";
import { Alert } from "react-native";
import PersonalArea from "./personalArea";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// The logo is navy ink, so negative mode swaps in a pale copy of it.
// the navy the logo is drawn in, sampled off the file itself, so the words and the
// mark beside them are the same ink
const BRAND_INK = "#192F50";
const BRAND_INK_DARK = "#C7D4E8";
const MARK_INK = require("../assets/images/mark-ink.png");
const MARK_LIGHT = require("../assets/images/mark-light.png");
/** the doodled paper the stories are printed on - light theme only, where it is
 *  paper. The tile is mirrored into its own quarters, so it repeats without a seam. */
const PAPER = require("../assets/images/paper.webp");
const MARK_RATIO = 426 / 372;
/** room under the last story, so the tab bar never sits on a headline */
const TAIL = 120;
/**
 * Where on the screen the feed asks "which story is the reader on", as a share of
 * the visible height. A little above the middle: the story that opens grows
 * downwards, and it needs the room below it.
 */
const ANCHOR = 0.32;
/** a scroll that has not moved for this long has stopped, and the story opens */
const SETTLE_MS = 150;
/** how long after a story opens the feed keeps correcting the scroll under it */
const HOLD_MS = 1200;
/** a scroll this much further than the feed is holding is the reader's own */
const LET_GO = 40;
/** the tour the i runs: the anchor's welcome, then each view with its guide */
// The tour ends with the questionnaire for a reader who has not answered it, and
// two steps earlier for everyone else.
const TOUR_BASE = ["welcome", "bloc", "citizen"] as const;
type TourStep = (typeof TOUR_BASE)[number] | "questionnaire";


/**
 * A callback the cards can hold on to: its identity never changes, so a story that
 * has not itself changed does not re-render when the feed does, and it still runs
 * against the latest state.
 */
function useStable<T extends (...args: any[]) => any>(fn: T): T {
	const held = useRef(fn);
	held.current = fn;
	return useCallback(((...args: any[]) => held.current(...args)) as T, []);
}

export default function NewsFeed() {
	const [selectedCategories, setSelectedCategories] = useState<string[]>(["הכל"]);
	const [articles, setArticles] = useState<Array<NewsItem[]>>([]);
	const [filteredArticles, setFilteredArticles] = useState<Array<NewsItem[]>>([]);
	const [sections, setSections] = useState<string[]>([]);
	const [ratingOpen, setRatingOpen] = useState(false);
	const [ratingTarget, setRatingTarget] = useState<NewsItem | null>(null);
	const [refreshing, setRefreshing] = useState<boolean>(false);
	const [deep, setDeep] = useState(false);
	// the bloc view's own filter: who told the story, not what it is about
	const [blocFilter, setBlocFilter] = useState<BlocFilter>("all");
	// raised while a story's outlet rail is being dragged, so the two scrollers
	// do not fight over the same finger
	const [scrollLocked, setScrollLocked] = useState(false);
	const scrollRef = useRef<ScrollView>(null);
	const [positions, setPositions] = useState<Record<string, SitePosition>>({});
	const [personalOpen, setPersonalOpen] = useState(false);
	const [profile, setProfile] = useState<ReaderProfile | null>(null);
	const [allTopics, setAllTopics] = useState<string[]>([]);
	const [mergeSource, setMergeSource] = useState<{ id: string | number; title: string } | null>(null);
	const [sort, setSort] = useState<SortKey>("newest");
	const [viewMode, setViewMode] = useState<ViewMode>("bloc");
	const t = useTheme();
	const dev = useDevMode();

	const onFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const y = e.nativeEvent.contentOffset.y;
		// far enough down that the way back is worth a button
		setDeep(y > 600);
		trackScroll(y);
	};

	const backToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

	// The i runs the tour over a blurred feed, one step per touch: the welcome, the
	// bloc view with the man, the citizen view with the woman. The toggle switches
	// behind the blur to match each guide, and the last touch hands the feed back the
	// way the reader had it. Tapping the toggle on its own just switches the view.
	const [tourStep, setTourStep] = useState<number | null>(null);
	// the band the blur leaves clear, which is wherever the toggle has ended up
	const toggleBox = useRef<View>(null);
	const [spot, setSpot] = useState<{ y: number; h: number } | null>(null);
	const insets = useSafeAreaInsets();
	const [tour, setTour] = useState<TourStep[]>([...TOUR_BASE]);
	const { filled, open: askQuestionnaire } = useQuestionnaire();
	const tourBlur = useRef(new Animated.Value(0)).current;
	const modeBeforeTour = useRef<ViewMode>("bloc");
	const startTour = () => {
		modeBeforeTour.current = viewMode;
		// the questionnaire closes the tour, but only for someone it still concerns
		setTour(filled ? [...TOUR_BASE] : [...TOUR_BASE, "questionnaire"]);
		// The toggle scrolls with the feed now, so the tour brings it back on screen
		// before it starts - the guides point at it, and the blur leaves a clear band
		// where it lands. measureInWindow counts from the top of the screen; the
		// overlay starts under the notch, which is what the inset takes off again.
		scrollRef.current?.scrollTo({ y: 0, animated: true });
		setTimeout(() => {
			toggleBox.current?.measureInWindow?.((_x, y, _w, h) => {
				setSpot(h ? { y: y - insets.top, h } : null);
			});
			setTourStep(0);
			Animated.timing(tourBlur, {
				toValue: 1,
				duration: 300,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start();
		}, 330);
	};
	// called once a step's picture has finished leaving
	const advanceTour = (from: number) => {
		const next = from + 1;
		if (next < tour.length) {
			const step = tour[next];
			if (step === "bloc" || step === "citizen") setViewMode(step);
			setTourStep(next);
			return;
		}
		endTour();
	};
	const endTour = (then?: () => void) => {
		setViewMode(modeBeforeTour.current);
		Animated.timing(tourBlur, {
			toValue: 0,
			duration: 260,
			easing: Easing.in(Easing.cubic),
			useNativeDriver: true,
		}).start(() => { setTourStep(null); then?.(); });
	};
	const tourStepName = tourStep !== null ? tour[tourStep] : null;

	const reload = useCallback(() => {
		fetchArticles(setArticles);
		getSitePositions().then(setPositions);
	}, []);

	// The feed used to load once and never again, so a phone left open since the
	// morning kept showing the morning's stories. Two triggers: coming back to the
	// app after it was in the background, and a timer while it is on screen.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") reload();
		});
		const timer = setInterval(reload, 5 * 60 * 1000);
		return () => { sub.remove(); clearInterval(timer); };
	}, [reload]);

	useEffect(() => {
		getSitePositions().then(setPositions);
		getProfile().then(setProfile);
		getTopics(true).then(setAllTopics);   // the picker may say "not political"
	}, []);

	const clusterTime = (cluster: NewsItem[]) =>
		Math.min(...cluster.map((a) => new Date(a.time).getTime()).filter((n) => !Number.isNaN(n)));

	/** how much of a story's coverage came from the bloc the reader is NOT in */
	const otherBlocShare = (cluster: NewsItem[]) => {
		if (!profile) return 0;
		const other = profile.bloc === "right" ? "left" : "right";
		const known = cluster.filter((a) => positions[a.source]?.bloc);
		if (known.length === 0) return 0;
		return known.filter((a) => positions[a.source]?.bloc === other).length / known.length;
	};

	/** who told a story: the two counts the ring draws and the bloc filter reads */
	const split = (cluster: NewsItem[]) => ({
		right: cluster.filter((a) => positions[a.source]?.bloc === "right").length,
		left: cluster.filter((a) => positions[a.source]?.bloc === "left").length,
	});

	const sortedArticles = useMemo(() => {
		let list = [...filteredArticles];
		// A story only one bloc is telling is the most interesting thing the feed
		// knows, and this is where a reader goes looking for it.
		if (viewMode === "bloc" && blocFilter !== "all") {
			list = list.filter((cluster) => {
				const { right, left } = split(cluster);
				if (blocFilter === "both") return right > 0 && left > 0;
				if (blocFilter === "right") return right > 0 && left === 0;
				return left > 0 && right === 0;
			});
		}
		switch (sort) {
			case "oldest":
				return list.sort((a, b) => clusterTime(a) - clusterTime(b));
			case "covered":
				return list.sort((a, b) => b.length - a.length);
			case "outside":
				// most-covered-by-the-other-side first, newest breaking the tie
				return list.sort((a, b) =>
					otherBlocShare(b) - otherBlocShare(a) || clusterTime(b) - clusterTime(a));
			default:
				return list.sort((a, b) => clusterTime(b) - clusterTime(a));
		}
	}, [filteredArticles, sort, positions, profile, viewMode, blocFilter]);

	// One story open at a time: opening another closes the first, and switching
	// between the bloc and citizen views closes whatever was open.
	const storyKey = (cluster: NewsItem[], index: number) => String(cluster[0]?.groupId ?? index);
	const [openStory, setOpenStory] = useState<string | null>(null);
	useEffect(() => { setOpenStory(null); }, [viewMode]);

	// ---------------------------------------------------------------------------
	// The scroll decides which story is open.
	//
	// Reaching a headline used to cost two touches: one to open the story, one to
	// open a bloc. The first of them is now the scroll itself - wherever it comes to
	// rest, that story opens onto its two blocs, and the reader's touch is spent on
	// the side they actually want to read. A story closed by hand stays closed until
	// the reader has moved on to another one.
	//
	// Nothing here measures where a story sits on the screen directly: react-native-web
	// reports a layout only when a view changes size, never when it merely moves. The
	// feed keeps each story's height instead and adds them up, which changes only when
	// a story opens or folds - exactly when a layout is reported.
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const [scrolling, setScrolling] = useState(false);
	// a story the scroll opened folds the last one away without an animation, so the
	// list's height changes in one frame and the scroll can be paid back in the same
	const [autoOpened, setAutoOpened] = useState(false);
	const order = useRef<string[]>([]);
	order.current = sortedArticles.map(storyKey);
	const heights = useRef<Record<string, number>>({});
	const shut = useRef<Record<string, number>>({});   // what each story measures folded
	const topH = useRef(0);              // the header and the controls, above the list
	const viewportH = useRef(0);
	const scrollY = useRef(0);
	const focusRef = useRef<string | null>(null);
	const openRef = useRef<string | null>(null);
	openRef.current = openStory;
	const dismissed = useRef<string | null>(null);
	const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
	const moving = useRef(false);
	// while a story opens, the place on the screen the feed is holding still
	const hold = useRef<{ key: string; offset: number; until: number } | null>(null);

	/** where a story starts, counted down the list from under the controls */
	const topOf = (key: string) => {
		let y = topH.current;
		for (const k of order.current) {
			if (k === key) break;
			y += heights.current[k] ?? 0;
		}
		return y;
	};

	/** the story the anchor line is crossing, if the list has reached it yet */
	const storyAt = (y: number) => {
		const line = y + viewportH.current * ANCHOR;
		let top = topH.current;
		for (const k of order.current) {
			const h = heights.current[k] ?? 0;
			if (line >= top && line < top + h) return k;
			top += h;
		}
		return null;
	};

	const measure = useStable((key: string, h: number) => {
		heights.current[key] = h;
		if (key !== openRef.current) shut.current[key] = h;
		// The feed has already moved the scroll by what it expects the fold to save.
		// This is the second line: if a story ends up a different height than that,
		// the one the reader stopped on is put back where they left it.
		const held = hold.current;
		if (!held) return;
		if (Date.now() > held.until) { hold.current = null; return; }
		const want = Math.max(0, topOf(held.key) - held.offset);
		if (Math.abs(want - scrollY.current) > 1) {
			scrollRef.current?.scrollTo({ y: want, animated: false });
		}
	});

	/** the scroll has come to rest: open whatever it rested on */
	const rest = useStable(() => {
		moving.current = false;
		setScrolling(false);
		const key = focusRef.current;
		if (!key || key === openRef.current || key === dismissed.current) return;

		// The story that was open folds away in the same breath. If it sits higher up
		// the list, the whole feed would ride up past the reader's eyes by however
		// much it saves, so the scroll pays that back in the same frame - the story
		// they stopped on does not move at all, it only grows.
		const gone = openRef.current;
		const above = gone && gone !== key && topOf(gone) < topOf(key);
		const saved = above ? (heights.current[gone!] ?? 0) - (shut.current[gone!] ?? 0) : 0;

		hold.current = { key, offset: topOf(key) - scrollY.current, until: Date.now() + HOLD_MS };
		setAutoOpened(true);
		setOpenStory(key);
		if (saved > 0) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - saved), animated: false });
	});

	const trackScroll = useStable((y: number) => {
		scrollY.current = y;
		// a scroll that is not where the feed is holding the list is the reader's own,
		// and the feed stops holding it at once
		const held = hold.current;
		if (held && Math.abs(y - (topOf(held.key) - held.offset)) > LET_GO) hold.current = null;
		const key = storyAt(y);
		if (key !== focusRef.current) {
			focusRef.current = key;
			setFocusKey(key);
			// the story the reader folded away is forgotten once they have left it
			if (key !== dismissed.current) dismissed.current = null;
		}
		if (!moving.current) { moving.current = true; setScrolling(true); }
		if (settle.current) clearTimeout(settle.current);
		settle.current = setTimeout(rest, SETTLE_MS);
	});

	const toggleStory = useStable((key: string) => {
		hold.current = null;
		setAutoOpened(false);
		setOpenStory((current) => {
			if (current === key) { dismissed.current = key; return null; }
			dismissed.current = null;
			return key;
		});
	});

	// one lasting pair of callbacks per story, so that scrolling past one story does
	// not re-render the fifty others
	const bound = useRef<Record<string, { toggle: () => void; measure: (h: number) => void }>>({});
	const handlers = (key: string) => (bound.current[key] ||= {
		toggle: () => toggleStory(key),
		measure: (h: number) => measure(key, h),
	});
	const armMerge = useStable((id: string | number, title: string) => handleArmMerge(id, title));
	useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

	// first tap arms a story, second tap picks the one to fold it into
	const handleArmMerge = async (clusterId: string | number, title: string) => {
		if (!mergeSource) {
			setMergeSource({ id: clusterId, title });
			return;
		}
		if (mergeSource.id === clusterId) {
			setMergeSource(null);
			return;
		}
		const ok = await mergeClusters(clusterId, mergeSource.id);
		setMergeSource(null);
		if (ok) {
			onRefresh();
		} else {
			Alert.alert("האיחוד נכשל", "נסה שוב");
		}
	};

	const brandInk = t.name === "negative" ? BRAND_INK_DARK : BRAND_INK;

	const handleSectionToggle = (category: string) => {
	if (category === "הכל") {
		setSelectedCategories(["הכל"]);
	} else {
		setSelectedCategories((prev) => {
		const filtered = prev.filter((cat) => cat !== "הכל");
		if (prev.includes(category)) {
			const newCategories = filtered.filter((cat) => cat !== category);
			return newCategories.length === 0 ? ["הכל"] : newCategories;
		} else {
			return [...filtered, category];
		}
		});
	}
	};

	useEffect(() => {
		fetchArticles(setArticles);
	}, []);

	const onRefresh = () => {
		setRefreshing(true);
		fetchArticles(setArticles);
		setTimeout(() => {
			setRefreshing(false);
		}, 1000);
	}

	// only the sections today's feed actually has, in the palette's own order
	useEffect(() => {
		setSections(orderSections(articles.map((story) => story[0]?.section).filter(Boolean)));
	}, [articles]);

	useEffect(() => {
		setFilteredArticles(selectedCategories.includes("הכל")
			? articles
			: articles.filter((story) => selectedCategories.includes(story[0].section)));
		scrollRef.current?.scrollTo({ y: 0, animated: true })
	}, [selectedCategories, articles])

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: t.bg }]}>
			{dev && (
				<View style={[styles.devBar, { backgroundColor: t.brand }]}>
					<Text style={styles.devBarText}>
						{mergeSource ? `מאחד: ${mergeSource.title.slice(0, 32)}…` : "מצב פיתוח"}
					</Text>
				</View>
			)}
			<View style={styles.feedArea}>
			<ScrollLock.Provider value={setScrollLocked}>
			<ScrollView 
				style={[styles.scrollView, { backgroundColor: t.name === "light" ? "transparent" : t.bg }]}
				scrollEnabled={!scrollLocked}
				contentContainerStyle={{ paddingBottom: TAIL }}
				onScroll={onFeedScroll}
				onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
				ref={scrollRef}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{/* the name, the day and the controls scroll away with the list: on a
				    phone they were taking a third of the screen off the news */}
				<View onLayout={(e) => { topH.current = e.nativeEvent.layout.height; }}>
				<View style={styles.header}>
					<View style={styles.headerTop}>
						<TouchableOpacity onPress={startTour} hitSlop={10} accessibilityLabel="על האפליקציה">
							<Ionicons name="information-circle-outline" size={30} color={t.text} />
						</TouchableOpacity>
						{/* the name set rather than drawn: "חדשות" leads, "האזרח הקטן" sits
						    under it, and the book with the dove stands to their right */}
						<View style={styles.brand} accessibilityLabel="חדשות האזרח הקטן">
							<Image
								source={t.name === "negative" ? MARK_LIGHT : MARK_INK}
								style={styles.mark}
								resizeMode="contain"
							/>
							<View style={styles.brandWords}>
								<Text style={[styles.brandTop, { color: brandInk }]}>חדשות</Text>
								<Text style={[styles.brandBottom, { color: brandInk }]}>האזרח הקטן</Text>
							</View>
						</View>
						<TouchableOpacity onPress={() => setPersonalOpen(true)} hitSlop={10}>
							<Ionicons name="person-circle-outline" size={30} color={t.text} />
						</TouchableOpacity>
					</View>
					<Text style={[styles.title, { color: t.text }]}>כל מה שקרה היום</Text>
				</View>

				<FeedControls
					sections={sections}
					selectedSections={selectedCategories}
					onToggleSection={handleSectionToggle}
					sort={sort}
					onSort={setSort}
					mode={viewMode}
					onMode={setViewMode}
					blocFilter={blocFilter}
					onBlocFilter={setBlocFilter}
					toggleRef={toggleBox}
				/>
				</View>

				<View style={styles.cardsArea}>
				{/* only under the stories, and only just there: the header and the
				    controls keep the plain ground they had */}
				{t.name === "light" && (
					<Image source={PAPER} style={styles.paper} resizeMode="repeat" />
				)}
				<View style={styles.cards}>
				{sortedArticles.map((cluster, index) => {
					const key = storyKey(cluster, index);
					const bind = handlers(key);
					return (
						<StoryCard key={key} data={cluster} positions={positions}
						setRatingOpen={setRatingOpen} setRatingTarget={setRatingTarget}
						mode={viewMode}
						topics={allTopics}
						mergeArmed={mergeSource?.id === cluster[0]?.groupId}
						onArmMerge={armMerge}
						open={openStory === key}
						focused={scrolling && focusKey === key && openStory !== key}
						instant={autoOpened}
						onMeasure={bind.measure}
						onToggle={bind.toggle} />
					);
				})}
				</View>
				</View>
			</ScrollView>
			</ScrollLock.Provider>

			{/* the way back, once the day is long: opposite the accessibility button */}
			{deep && (
				<TouchableOpacity
					style={styles.toTop}
					onPress={backToTop}
					accessibilityRole="button"
					accessibilityLabel="חזרה לראש הפיד"
					hitSlop={8}
				>
					<Ionicons name="chevron-up" size={20} color={t.text} />
				</TouchableOpacity>
			)}

			</View>

			{/* over the whole screen, header and toggle included; the blur stays put while
			    the pictures change, and each picture moves the tour on when touched */}
			{tourStep !== null && (
				<View style={styles.tour}>
					<GuideBackdrop opacity={tourBlur} hole={spot} />
					{tourStepName === "welcome" ? (
						<WelcomeGuide key="welcome" onDone={() => advanceTour(tourStep)} />
					) : tourStepName === "questionnaire" ? (
						<TourQuestionnaire
							onFill={() => endTour(askQuestionnaire)}
							onSkip={() => advanceTour(tourStep)} />
					) : tourStepName !== null ? (
						<ModeGuide key={tourStepName} mode={tourStepName} onDone={() => advanceTour(tourStep)} />
					) : null}
				</View>
			)}
			
			<RatingSheet 
				open={ratingOpen} 
				onOpenChange={setRatingOpen} 
				ratingTarget={ratingTarget}
			/>

			<PersonalArea
				open={personalOpen}
				onClose={() => setPersonalOpen(false)}
				profile={profile}
				onRetakeQuestionnaire={() => setProfile(null)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	toTop: {
		position: "absolute", right: 12, bottom: 92, width: 38, height: 38, borderRadius: 19,
		alignItems: "center", justifyContent: "center",
		backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: "#E3E3E1",
		boxShadow: "0 2px 8px rgba(0,0,0,0.18)", zIndex: 30,
	},

	container: { 
		flex: 1, 
		alignItems: "center", 
		width: "100%", 
		backgroundColor: '#f8f8f8ff',
	},
	header: {
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 2,
		gap: 2,
		width: "100%"
	},
	devBar: { width: "100%", paddingVertical: 5, alignItems: "center" },
	devBarText: { fontFamily: "Heebo_700Bold", fontSize: 11, color: "#04310F" },
	headerTop: {
		// right to left: the i, the logo, the personal area - the two icons are the
		// same size, so space-between centres the logo; the direction keeps that order
		// on the physical screen whether or not RTL layout is on
		flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 10,
	},
	// row-reverse puts the mark on the right of the words, as the logo has it
	brand: {
		flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
		alignItems: "center",
		gap: 8,
	},
	mark: { height: 40, width: 40 * MARK_RATIO },
	brandWords: { alignItems: "flex-end" },
	brandTop: { fontFamily: "Heebo_800ExtraBold", fontSize: 21, lineHeight: 23 },
	brandBottom: { fontFamily: "Heebo_700Bold", fontSize: 13, lineHeight: 15 },
	title: {
 
		fontFamily: "Heebo_700Bold", 
		fontSize: 30, 
		fontWeight: "bold", 
		textAlign: "right" 
	},
	scrollView: {
		width: "100%",
		backgroundColor: '#f8f8f8ff',
		// borderWidth: 2,
		flex: 1,
	},
	// the stories keep the narrow side margin the header does not want; the paper
	// sits in the box around them, so it runs edge to edge under the list alone
	cardsArea: { position: "relative" },
	cards: { paddingHorizontal: 6 },
	feedArea: { flex: 1, width: "100%" },
	// it sits still while the feed moves over it, so it reads as the page rather
	// than as something in the list
	// width and height spelled out: react-native-web otherwise stamps the asset's
	// own 760 square on it inline, which beats anything a stylesheet says
	paper: {
		position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
		opacity: 0.12, pointerEvents: "none",
	},
	tour: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
