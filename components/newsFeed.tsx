import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { I18nManager } from "react-native";
import FeedControls, { SortKey } from "./feedControls";
import ViewModeToggle, { ViewMode } from "./viewModeToggle";
import StoryCard from "./storyCard";
import RatingSheet from "./ratingSheet";
import { fetchArticles, getSitePositions, getTopics, mergeClusters, SitePosition } from "@/state/engagement";
import { getProfile, ReaderProfile } from "@/state/profile";
import { useDevMode, useTheme } from "@/state/theme";
import { Alert } from "react-native";
import PersonalArea from "./personalArea";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


interface NewsItem {
	id: string;
	title: string;
	source: string;
	time: string;
	summary: string;
	biasScore: number; // -5 to 5 scale
	siteBiasScore: number;
	category: string;
	topic: string;
	link: string;
	groupId?: string;
	imageUrl?: string;
}

export default function NewsFeed() {
	const [selectedCategories, setSelectedCategories] = useState<string[]>(["הכל"]);
	const [articles, setArticles] = useState<Array<NewsItem[]>>([]);
	const [filteredArticles, setFilteredArticles] = useState<Array<NewsItem[]>>([]);
	const [topics, setTopics] = useState(new Set<string>(["הכל"]));
	const [ratingOpen, setRatingOpen] = useState(false);
	const [ratingTarget, setRatingTarget] = useState<NewsItem | null>(null);
	const [refreshing, setRefreshing] = useState<boolean>(false);
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

	const sortedArticles = useMemo(() => {
		const list = [...filteredArticles];
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
	}, [filteredArticles, sort, positions, profile]);

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

	const handleCategoryToggle = (category: string) => {
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
		setTopics(new Set<string>(["הכל"]));
		fetchArticles(setArticles);
		setTimeout(() => {
			setRefreshing(false);
		}, 1000);
	}

	useEffect(() => {
		setTopics((prevTopics) => {
			const newTopics = new Set(prevTopics);
			for (const article of articles) {
				newTopics.add(article[0].topic);
			}
			return newTopics;
		});
	}, [articles]);

	useEffect(() => {
		setFilteredArticles(selectedCategories.includes("הכל") ? articles : articles.filter((item) => selectedCategories.includes(item[0].topic)));
		scrollRef.current?.scrollTo({ y: 0, animated: true })
	}, [selectedCategories, topics])

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
			{dev && (
				<View style={[styles.devBar, { backgroundColor: t.brand }]}>
					<Text style={styles.devBarText}>
						{mergeSource ? `מאחד: ${mergeSource.title.slice(0, 32)}…` : "מצב פיתוח"}
					</Text>
				</View>
			)}
			<View style={styles.header}>
				<View style={styles.headerTop}>
					<Text style={[styles.subtitle, { color: t.textMuted }]}>
						{greet()} <Text style={styles.dot}>·</Text> {dateLabel} <Text style={styles.dot}>·</Text> <Text style={styles.clock}>{clock}</Text>
					</Text>
					<TouchableOpacity onPress={() => setPersonalOpen(true)} hitSlop={10}>
						<Ionicons name="person-circle-outline" size={30} color={t.text} />
					</TouchableOpacity>
				</View>
				<Text style={[styles.title, { color: t.text }]}>כל מה שקרה היום</Text>
			</View>

			<ViewModeToggle mode={viewMode} onChange={setViewMode} />

			<FeedControls
				topics={[...topics].filter((c) => c !== "הכל")}
				selectedTopics={selectedCategories}
				onToggleTopic={handleCategoryToggle}
				sort={sort}
				onSort={setSort}
			/>

			<ScrollView 
				style={[styles.scrollView, { backgroundColor: t.bg }]}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
				ref={scrollRef}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{sortedArticles.map((cluster, index) => (
					<StoryCard key={index} data={cluster} positions={positions}
					setRatingOpen={setRatingOpen} setRatingTarget={setRatingTarget}
					mode={viewMode}
					topics={allTopics}
					mergeArmed={mergeSource?.id === cluster[0]?.groupId}
					onArmMerge={handleArmMerge} />
				))}
			</ScrollView>
			
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
	container: { 
		flex: 1, 
		alignItems: "center", 
		width: "100%", 
		backgroundColor: '#f8f8f8ff',
	},
	header: { 
		paddingHorizontal: 16, 
		paddingTop: 16, 
		paddingBottom: 8, 
		width: "100%" 
	},
	devBar: { width: "100%", paddingVertical: 5, alignItems: "center" },
	devBarText: { fontFamily: "Heebo_700Bold", fontSize: 11, color: "#04310F" },
	headerTop: {
		flexDirection: "row-reverse",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 10,
	},
	dot: { color: "#C9C6BF" },
	clock: { fontFamily: "Heebo_700Bold", fontVariant: ["tabular-nums"] },
	title: {
 
		fontFamily: "Heebo_700Bold", 
		fontSize: 30, 
		fontWeight: "bold", 
		textAlign: "right" 
	},
	subtitle: {
 
		fontFamily: "Heebo_400Regular", 
		fontSize: 14, 
		margin: 5,
		color: "#6b7280", 
		textAlign: "right" 
	},
	scrollView: {
		width: "100%",
		paddingHorizontal: 16,
		backgroundColor: '#f8f8f8ff',
		// borderWidth: 2,
		flex: 1,
		marginBottom: -35
	}
});
