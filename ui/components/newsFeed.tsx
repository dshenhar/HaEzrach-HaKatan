import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, useWindowDimensions, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// The logo is navy ink, so negative mode swaps in a pale copy of it.
// the navy the logo is drawn in, sampled off the file itself, so the words and the
// mark beside them are the same ink
const BRAND_INK = "#192F50";
const BRAND_INK_DARK = "#C7D4E8";
const MARK_INK = require("../assets/images/mark-ink.png");
const MARK_LIGHT = require("../assets/images/mark-light.png");
const MARK_RATIO = 426 / 372;
const CROWD = require("../assets/images/parlament.png");
const CROWD_RATIO = 1200 / 604;
/** how far above the crowd the list starts fading out */
const CROWD_FADE = 48;
/** scrolled further than this, the crowd steps aside */
const CROWD_HIDE_AFTER = 12;
/** the tour the i runs: the anchor's welcome, then each view with its guide */
// The tour ends with the questionnaire for a reader who has not answered it, and
// two steps earlier for everyone else.
const TOUR_BASE = ["welcome", "bloc", "citizen"] as const;
type TourStep = (typeof TOUR_BASE)[number] | "questionnaire";


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
	const [now, setNow] = useState(new Date());
	const [allTopics, setAllTopics] = useState<string[]>([]);
	const [mergeSource, setMergeSource] = useState<{ id: string | number; title: string } | null>(null);
	const [sort, setSort] = useState<SortKey>("newest");
	const [viewMode, setViewMode] = useState<ViewMode>("bloc");
	const t = useTheme();
	const dev = useDevMode();
	// the web build draws the app inside a 420px phone frame
	const { width: windowWidth } = useWindowDimensions();
	const crowdWidth = Math.round(Math.min(windowWidth, 420) * 0.68);
	const crowdHeight = Math.round(crowdWidth / CROWD_RATIO);

	// The crowd sits on the tab bar only while the feed is at its very top: the
	// first scroll sends it down behind the bar, and it comes back only once the
	// list is all the way up again (the gap between the two thresholds keeps it
	// from flickering around the top). It also steps aside while the tour is
	// running or a story is open, so nothing has to share the screen with it.
	const crowdIn = useRef(new Animated.Value(1)).current;
	const crowdShown = useRef(true);
	const atTop = useRef(true);
	const guideOut = useRef(false);
	const storyOpen = useRef(false);
	const syncCrowd = () => {
		const show = atTop.current && !guideOut.current && !storyOpen.current;
		if (show === crowdShown.current) return;
		crowdShown.current = show;
		Animated.timing(crowdIn, {
			toValue: show ? 1 : 0,
			duration: show ? 320 : 220,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	};
	const onFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const y = e.nativeEvent.contentOffset.y;
		atTop.current = atTop.current ? y <= CROWD_HIDE_AFTER : y <= 1;
		// far enough down that the way back is worth a button
		setDeep(y > 600);
		syncCrowd();
	};

	const backToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

	// The i runs the tour over a blurred feed, one step per touch: the welcome, the
	// bloc view with the man, the citizen view with the woman. The toggle switches
	// behind the blur to match each guide, and the last touch hands the feed back the
	// way the reader had it. Tapping the toggle on its own just switches the view.
	const [tourStep, setTourStep] = useState<number | null>(null);
	const [tour, setTour] = useState<TourStep[]>([...TOUR_BASE]);
	const { filled, open: askQuestionnaire } = useQuestionnaire();
	const tourBlur = useRef(new Animated.Value(0)).current;
	const modeBeforeTour = useRef<ViewMode>("bloc");
	const startTour = () => {
		modeBeforeTour.current = viewMode;
		// the questionnaire closes the tour, but only for someone it still concerns
		setTour(filled ? [...TOUR_BASE] : [...TOUR_BASE, "questionnaire"]);
		setTourStep(0);
		Animated.timing(tourBlur, {
			toValue: 1,
			duration: 300,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
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
	useEffect(() => {
		guideOut.current = tourStep !== null;
		syncCrowd();
	}, [tourStep]);
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

	// tick on the minute boundary rather than every 60s from mount, so the
	// displayed minute never lags the real one
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			const d = new Date();
			const msToNextMinute = (60 - d.getSeconds()) * 1000 - d.getMilliseconds();
			timer = setTimeout(() => { setNow(new Date()); schedule(); }, msToNextMinute);
		};
		schedule();
		return () => clearTimeout(timer);
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
	useEffect(() => {
		// a story that dropped out of the feed on a refresh no longer keeps the crowd away
		storyOpen.current = openStory !== null
			&& sortedArticles.some((cluster, i) => storyKey(cluster, i) === openStory);
		syncCrowd();
	}, [openStory, sortedArticles]);

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

	const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	const dateLabel = now.toLocaleDateString("he-IL", { day: "numeric", month: "long" });


	const brandInk = t.name === "negative" ? BRAND_INK_DARK : BRAND_INK;

	const greet = () => {
	const curHour = new Date().getHours();
		if (6 <= curHour && curHour < 12) {
			return "בוקר טוב!"
		}
		if (12 <= curHour && curHour < 18) {
			return "צהריים טובים!"
		}
		return "ערב טוב!"
	}

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
				<Text style={[styles.subtitle, { color: t.textMuted }]}>
					{greet()} <Text style={styles.dot}>·</Text> {dateLabel} <Text style={styles.dot}>·</Text> <Text style={styles.clock}>{clock}</Text>
				</Text>
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
			/>

			<View style={styles.feedArea}>
			<ScrollLock.Provider value={setScrollLocked}>
			<ScrollView 
				style={[styles.scrollView, { backgroundColor: t.bg }]}
				scrollEnabled={!scrollLocked}
				contentContainerStyle={{ paddingBottom: crowdHeight + CROWD_FADE }}
				onScroll={onFeedScroll}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
				ref={scrollRef}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{sortedArticles.map((cluster, index) => {
					const key = storyKey(cluster, index);
					return (
						<StoryCard key={key} data={cluster} positions={positions}
						setRatingOpen={setRatingOpen} setRatingTarget={setRatingTarget}
						mode={viewMode}
						topics={allTopics}
						mergeArmed={mergeSource?.id === cluster[0]?.groupId}
						onArmMerge={handleArmMerge}
						open={openStory === key}
						onToggle={() => setOpenStory((current) => (current === key ? null : key))} />
					);
				})}
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

			{/* the crowd sits on the tab bar, and the stories fade out behind their heads */}
			<Animated.View style={[styles.crowd, { height: crowdHeight + CROWD_FADE, opacity: crowdIn }]}>
				<LinearGradient
					colors={[t.bg + "00", t.bg, t.bg]}
					locations={[0, (CROWD_FADE + crowdHeight * 0.3) / (crowdHeight + CROWD_FADE), 1]}
					style={StyleSheet.absoluteFill}
				/>
				<Animated.Image
					source={CROWD}
					resizeMode="contain"
					style={{
						width: crowdWidth,
						height: crowdHeight,
						transform: [{ translateY: crowdIn.interpolate({ inputRange: [0, 1], outputRange: [crowdHeight * 0.5, 0] }) }],
					}}
				/>
			</Animated.View>
			</View>

			{/* over the whole screen, header and toggle included; the blur stays put while
			    the pictures change, and each picture moves the tour on when touched */}
			{tourStep !== null && (
				<View style={styles.tour}>
					<GuideBackdrop opacity={tourBlur} />
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
		paddingBottom: 4, 
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
	dot: { color: "#C9C6BF" },
	clock: { fontFamily: "Heebo_700Bold", fontVariant: ["tabular-nums"] },
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
	subtitle: {
 
		fontFamily: "Heebo_400Regular", 
		fontSize: 14, 
		marginHorizontal: 5,
		marginVertical: 2,
		color: "#6b7280", 
		textAlign: "right" 
	},
	scrollView: {
		width: "100%",
		paddingHorizontal: 11,
		backgroundColor: '#f8f8f8ff',
		// borderWidth: 2,
		flex: 1,
	},
	feedArea: { flex: 1, width: "100%" },
	crowd: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "flex-end",
		// scrolling keeps working through the crowd
		pointerEvents: "none",
	},
	tour: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
