import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { I18nManager } from "react-native";
import FeedControls, { BlocFilter, SortKey } from "./feedControls";
import ModeGuide from "./modeGuide";
import WelcomeGuide from "./welcomeGuide";
import GuideBackdrop from "./guideBackdrop";
import StoryCard from "./storyCard";
import RatingSheet from "./ratingSheet";
import { fetchArticles, getSitePositions, getTopics, loadFeed, mergeClusters, NewsItem, SitePosition } from "@/state/engagement";
import { track } from "@/state/analytics";
import { orderSections } from "@/state/sections";
import { ELEVATION, glass, TYPE } from "@/state/craft";
import { blindTo } from "@/state/blindspot";
import { useQuestionnaire } from "@/state/questionnaire";
import { useArrivalTour } from "@/state/tour";
import { onStoryRequest, takeStoryRequest } from "@/state/feedFocus";
import { ScrollLock } from "@/state/scrollLock";
import { getProfile, ReaderProfile } from "@/state/profile";
import { useDevMode, useTheme } from "@/state/theme";
import { Alert } from "react-native";
import PersonalArea from "./personalArea";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
/** where on the screen the feed asks "which story is the reader on", as a share of
 *  the visible height, for the drop-off milestones */
const ANCHOR = 0.32;
/** a reader this close to the top is at the top: an update lands without moving them */
const NEAR_TOP = 120;
/**
 * How long the story a scroll stopped on stays swollen before it settles. A phone's
 * flick crosses a dozen stories too fast for any of them to be seen growing, and a
 * story that settled the moment the scroll stopped was never seen growing at all.
 */
const LINGER_MS = 700;
/** the tour the i runs: the anchor's welcome, the man on reading a story by bloc,
 *  and the woman on the questionnaire */
const TOUR = ["welcome", "bloc", "questionnaire"] as const;


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
	const t = useTheme();
	const dev = useDevMode();

	const onFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const y = e.nativeEvent.contentOffset.y;
		// far enough down that the way back is worth a button
		setDeep(y > 600);
		trackScroll(y);
	};

	const backToTop = () => {
		track("back_to_top");
		scrollRef.current?.scrollTo({ y: 0, animated: true });
	};

	// The i runs the tour over a blurred feed, one step per touch: the welcome, then
	// the man who explains reading a story by bloc, then the woman who explains the
	// questionnaire and offers it - its button live for a reader who has not answered,
	// and there but spent for one who has. A first visit opens on the same tour.
	const [tourStep, setTourStep] = useState<number | null>(null);
	const { filled, open: askQuestionnaire } = useQuestionnaire();
	const tourBlur = useRef(new Animated.Value(0)).current;
	const startTour = useStable((how: "tap" | "arrival" = "tap") => {
		track("tour_started", { how });
		// the guides speak about the feed from its top, so the tour starts there
		scrollRef.current?.scrollTo({ y: 0, animated: true });
		setTimeout(() => {
			setTourStep(0);
			Animated.timing(tourBlur, {
				toValue: 1,
				duration: 300,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start();
		}, 330);
	});
	// called once a step's picture has finished leaving
	const advanceTour = (from: number) => {
		const next = from + 1;
		if (next < TOUR.length) {
			track("tour_step", { step: TOUR[next], index: next });
			setTourStep(next);
			return;
		}
		track("tour_finished", { reached: "end", steps: TOUR.length });
		endTour();
	};
	const endTour = (then?: () => void) => {
		Animated.timing(tourBlur, {
			toValue: 0,
			duration: 260,
			easing: Easing.in(Easing.cubic),
			useNativeDriver: true,
		}).start(() => { setTourStep(null); then?.(); });
	};
	const tourStepName = tourStep !== null ? TOUR[tourStep] : null;

	// A first visit: once the feed has stories on it, the tour starts by itself.
	const { due: arrivalDue, done: arrivalDone } = useArrivalTour();
	const arrived = useRef(false);
	useEffect(() => {
		if (!arrivalDue || arrived.current || articles.length === 0) return;
		arrived.current = true;
		// not cancelled when this runs again: telling the layout it is done is what
		// runs it again, and the tour has to start all the same
		setTimeout(() => { arrivalDone(); startTour("arrival"); }, 500);
	}, [arrivalDue, arrivalDone, articles.length, startTour]);

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
		if (blocFilter !== "all") {
			list = list.filter((cluster) => {
				const { right, left } = split(cluster);
				if (blocFilter === "both") return right > 0 && left > 0;
				if (blocFilter === "blind") {
					const missing = blindTo({ right, left });
					// knowing the reader's side turns "a blindspot" into "yours"
					return profile ? missing === profile.bloc : missing !== null;
				}
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
	}, [filteredArticles, sort, positions, profile, blocFilter]);

	// One story open at a time: opening another closes the first. A story opens and
	// closes under the reader's finger and nothing else. The feed used to open
	// whichever story the scroll came to rest on, and to hold the scroll still while
	// it grew - which read as the feed opening things and moving on its own.
	const storyKey = (cluster: NewsItem[], index: number) => String(cluster[0]?.groupId ?? index);
	const [openStory, setOpenStory] = useState<string | null>(null);

	// How far down the reader has got, for the drop-off milestones. Nothing here
	// moves the scroll: it adds up the stories' heights to know which one a position
	// is on, because react-native-web reports a layout only when a view changes size,
	// never when it merely moves.
	const order = useRef<string[]>([]);
	order.current = sortedArticles.map(storyKey);
	const heights = useRef<Record<string, number>>({});
	const topH = useRef(0);              // the header and the controls, above the list
	const viewportH = useRef(0);
	const scrollY = useRef(0);
	// A story opened and shut again two seconds later is one the reader did not want.
	// Opening is only half the measurement; this is the other half.
	const openedAt = useRef(0);
	const deepest = useRef(0);
	// While the feed moves, the story under the reader's thumb swells a little and
	// settles again when the scroll stops - the scroll's own feel, and nothing more:
	// it opens nothing, a story still opens and closes only when it is touched.
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const [scrolling, setScrolling] = useState(false);
	const focusRef = useRef<string | null>(null);
	const moving = useRef(false);
	const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

	const leaveStory = (key: string | null) => {
		if (!key || !openedAt.current) return;
		track("story_dismissed", {
			how_opened: "tap",
			dwell_s: Math.min(600, Math.round((Date.now() - openedAt.current) / 1000)),
		});
		openedAt.current = 0;
	};

	/** a story in the terms the measurement cares about, and no others */
	const shapeOf = (key: string) => {
		const index = order.current.indexOf(key);
		const cluster = sortedArticles[index];
		if (!cluster) return {};
		const { right, left } = split(cluster);
		return {
			topic: cluster[0]?.topic, section: cluster[0]?.section,
			outlets: cluster.length, right, left,
			shape: right && left ? "both" : right ? "right only" : "left only",
			blind_to: blindTo({ right, left }) ?? undefined,
		};
	};

	/** the story a third of the way down the screen, if the list has reached it */
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

	const measure = useStable((key: string, h: number) => { heights.current[key] = h; });

	// An update the feed fetches on its own - the five-minute timer, or the reader
	// coming back to the app, which on the web is every return from an article's tab -
	// used to land at once and throw the list back to its top wherever they were
	// reading. Now it waits for them: at the top it lands straight away, further down
	// it is a button, and it lands when they press it or scroll back up themselves.
	const [pending, setPending] = useState<NewsItem[][] | null>(null);
	const pendingRef = useRef<NewsItem[][] | null>(null);
	const articlesRef = useRef(articles);
	useEffect(() => { pendingRef.current = pending; }, [pending]);
	useEffect(() => { articlesRef.current = articles; }, [articles]);

	const offerUpdate = useStable((next: NewsItem[][]) => {
		if (JSON.stringify(next) === JSON.stringify(articlesRef.current)) return;
		if (scrollY.current < NEAR_TOP) {
			setPending(null);
			setArticles(next);
			return;
		}
		setPending(next);
	});

	const takeUpdate = useStable((toTop: boolean) => {
		const next = pendingRef.current;
		if (!next) return;
		pendingRef.current = null;
		setPending(null);
		setArticles(next);
		if (toTop) scrollRef.current?.scrollTo({ y: 0, animated: true });
	});

	// The feed used to load once and never again, so a phone left open since the
	// morning kept showing the morning's stories. Two triggers: coming back to the
	// app after it was in the background, and a timer while it is on screen. Both
	// go through offerUpdate, so neither moves a reader who is down the list.
	const reload = useCallback(() => {
		loadFeed().then((next) => { if (next) offerUpdate(next); });
		getSitePositions().then(setPositions);
	}, [offerUpdate]);
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") reload();
		});
		const timer = setInterval(reload, 5 * 60 * 1000);
		return () => { sub.remove(); clearInterval(timer); };
	}, [reload]);

	/** how many of the waiting update's stories the reader has not seen at all */
	const freshCount = useMemo(() => {
		if (!pending) return 0;
		const have = new Set(articles.map((story) => String(story[0]?.groupId)));
		return pending.filter((story) => !have.has(String(story[0]?.groupId))).length;
	}, [pending, articles]);

	const trackScroll = useStable((y: number) => {
		scrollY.current = y;
		// back at the top by their own hand: the update that waited lands now
		if (y < NEAR_TOP && pendingRef.current) takeUpdate(false);
		const key = storyAt(y);
		if (key !== focusRef.current) {
			focusRef.current = key;
			setFocusKey(key);
		}
		if (!moving.current) { moving.current = true; setScrolling(true); }
		if (settle.current) clearTimeout(settle.current);
		settle.current = setTimeout(() => { moving.current = false; setScrolling(false); }, LINGER_MS);
		// milestones rather than a number every frame: the shape of a drop-off is all
		// anyone can act on, and five events a session is enough to draw it
		if (key) {
			const reached = order.current.indexOf(key) + 1;
			for (const mark of [5, 10, 20, 40]) {
				if (reached >= mark && deepest.current < mark) {
					deepest.current = mark;
					track("feed_depth", { stories: mark });
				}
			}
		}
	});

	const toggleStory = useStable((key: string) => {
		setOpenStory((current) => {
			leaveStory(current);
			if (current === key) return null;
			track("story_opened", { how: "tap", ...shapeOf(key) });
			openedAt.current = Date.now();
			return key;
		});
	});

	// A hot topic's link asks for a story: it opens here and is brought into view.
	// The request waits for the stories to load, reloads them once if the story is
	// not among them, and clears the filters if they are what hides it.
	const [wanted, setWanted] = useState<string | null>(() => takeStoryRequest());
	useEffect(() => onStoryRequest(() => setWanted(takeStoryRequest())), []);
	const reloadedFor = useRef<string | null>(null);
	const bringTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
	useEffect(() => () => bringTimers.current.forEach(clearTimeout), []);
	const bringIntoView = useStable((key: string) => {
		let y = topH.current;
		for (const k of order.current) {
			if (k === key) break;
			y += heights.current[k] ?? 0;
		}
		// the story's section tab stands above its card, so it is left room
		scrollRef.current?.scrollTo({ y: Math.max(0, y - 34), animated: true });
	});
	const serveRequest = useStable(() => {
		if (!wanted || articles.length === 0) return;
		const has = (list: NewsItem[][]) => list.some((story) => String(story[0]?.groupId) === wanted);
		if (!has(articles)) {
			if (reloadedFor.current === wanted) { setWanted(null); return; }
			reloadedFor.current = wanted;
			loadFeed().then((next) => {
				if (!next) { setWanted(null); return; }
				pendingRef.current = null;
				setPending(null);
				setArticles(next);
			});
			return;
		}
		if (!has(sortedArticles)) {
			setSelectedCategories(["הכל"]);
			setBlocFilter("all");
			return;
		}
		const key = wanted;
		setWanted(null);
		setOpenStory((current) => {
			if (current !== key) {
				leaveStory(current);
				track("story_opened", { how: "hot_topic", ...shapeOf(key) });
				openedAt.current = Date.now();
			}
			return key;
		});
		// after the move to the feed's tab, and after the jump to the top that a
		// change of filters makes; the second is for a slow transition
		bringTimers.current.push(
			setTimeout(() => bringIntoView(key), 450),
			setTimeout(() => bringIntoView(key), 1000));
	});
	useEffect(() => { serveRequest(); }, [wanted, articles, sortedArticles, serveRequest]);

	// one lasting pair of callbacks per story, so that scrolling past one story does
	// not re-render the fifty others
	const bound = useRef<Record<string, { toggle: () => void; measure: (h: number) => void }>>({});
	const handlers = (key: string) => (bound.current[key] ||= {
		toggle: () => toggleStory(key),
		measure: (h: number) => measure(key, h),
	});
	const armMerge = useStable((id: string | number, title: string) => handleArmMerge(id, title));

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
	track("section_filter_changed", { section: category });
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
		track("feed_refreshed");
		setRefreshing(true);
		setPending(null);
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
	}, [selectedCategories, articles])

	// A new choice of sections starts the list from its top. New data does not: it
	// used to, so every update threw the reader back up from wherever they were.
	useEffect(() => {
		scrollRef.current?.scrollTo({ y: 0, animated: true });
	}, [selectedCategories])

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
						<TouchableOpacity onPress={() => startTour()} hitSlop={10} accessibilityLabel="על האפליקציה">
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
				</View>

				<FeedControls
					title="כל מה שקרה היום"
					sections={sections}
					selectedSections={selectedCategories}
					onToggleSection={handleSectionToggle}
					sort={sort}
					onSort={(next) => { track("sort_changed", { sort: next }); setSort(next); }}
					blocFilter={blocFilter}
					onBlocFilter={(next) => { track("bloc_filter_changed", { filter: next }); setBlocFilter(next); }}
					knowsBloc={profile !== null}
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
						topics={allTopics}
						mergeArmed={mergeSource?.id === cluster[0]?.groupId}
						onArmMerge={armMerge}
						open={openStory === key}
						focused={scrolling && focusKey === key && openStory !== key}
						readerBloc={profile?.bloc}
						onMeasure={bind.measure}
						onToggle={bind.toggle} />
					);
				})}
				</View>
				</View>
			</ScrollView>
			</ScrollLock.Provider>

			{/* an update waiting for the reader: it lands when they want it */}
			{pending && (
				<View style={styles.freshRow} pointerEvents="box-none">
					<TouchableOpacity
						style={styles.fresh}
						onPress={() => { track("feed_update_taken", { fresh: freshCount }); takeUpdate(true); }}
						accessibilityRole="button"
						accessibilityLabel="הצגת העדכון וחזרה לראש הפיד"
						hitSlop={8}
					>
						<Ionicons name="arrow-up" size={14} color={t.text} />
						<Text style={[styles.freshText, { color: t.text }]}>
							{freshCount > 1 ? `${freshCount} סיפורים חדשים`
								: freshCount === 1 ? "סיפור חדש" : "הפיד התעדכן"}
						</Text>
					</TouchableOpacity>
				</View>
			)}

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
					<GuideBackdrop opacity={tourBlur} />
					{tourStepName === "welcome" ? (
						<WelcomeGuide key="welcome" onDone={() => advanceTour(tourStep)} />
					) : tourStepName === "questionnaire" ? (
						<ModeGuide key="questionnaire" mode="citizen"
							title="ומה איתכם?"
							body={"שאלון עמדות קצר, כדקה, מאפשר לאפליקציה להשוות בין מה שאתם חושבים לבין מה "
								+ "שאתם קוראים בפועל, ולהראות לכם כמה מהחדשות הגיעו דווקא מהצד השני. "
								+ "התשובות נשארות במכשיר שלכם."}
							action={filled
								? { label: "כבר מילאתם את השאלון ✓", onPress: () => {}, disabled: true }
								: { label: "למילוי שאלון העמדות", onPress: () => {
									track("questionnaire_opened", { from: "tour" });
									endTour(askQuestionnaire);
								} }}
							onDone={() => advanceTour(tourStep)} />
					) : tourStepName === "bloc" ? (
						<ModeGuide key="bloc" mode="bloc" onDone={() => advanceTour(tourStep)} />
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
	// glass rather than a white disc: it sits over moving content, and a solid
	// circle over a scrolling feed reads as a hole punched in it
	toTop: {
		position: "absolute", right: 12, bottom: 92, width: 40, height: 40, borderRadius: 20,
		alignItems: "center", justifyContent: "center",
		...glass(false), borderWidth: 1,
		boxShadow: ELEVATION.float, zIndex: 30,
	},

	freshRow: {
		position: "absolute", top: 10, left: 0, right: 0,
		alignItems: "center", zIndex: 31,
	},
	fresh: {
		flexDirection: "row-reverse", alignItems: "center", gap: 6,
		paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
		...glass(false), borderWidth: 1, boxShadow: ELEVATION.float,
	},
	freshText: { fontFamily: "Heebo_700Bold", fontSize: 12.5 },

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
	brandTop: { ...TYPE.brand },
	brandBottom: {
		fontFamily: "Heebo_700Bold", fontSize: 13, lineHeight: 15, letterSpacing: 0.08,
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
		opacity: 0.22, pointerEvents: "none",
	},
	tour: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
