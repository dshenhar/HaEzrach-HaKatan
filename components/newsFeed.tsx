import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { I18nManager } from "react-native";
import { CategoryFilter } from "./categoryFilter";
import NewsCarousel from "./newsCarousel";
import RatingSheet from "./ratingSheet";
import { fetchArticles } from "@/state/engagement";
import { SafeAreaView } from "react-native-safe-area-context";

// Force RTL layout once (you can move this to App.tsx)
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);


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
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.subtitle}>{greet()}</Text>
				<Text style={styles.title}>כל מה שקרה היום</Text>
			</View>

			<CategoryFilter
				categories={topics}
				selectedCategories={selectedCategories}
				onCategoryToggle={handleCategoryToggle}
			/>

			<ScrollView 
				style={styles.scrollView}
				scrollEventThrottle={16}
				showsVerticalScrollIndicator={false}
				ref={scrollRef}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				{filteredArticles.map((cluster, index) => (
					<NewsCarousel key={index} data={cluster} setRatingOpen={setRatingOpen} 
					setRatingTarget={setRatingTarget} />
				))}
			</ScrollView>
			
			<RatingSheet 
				open={ratingOpen} 
				onOpenChange={setRatingOpen} 
				ratingTarget={ratingTarget}
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
	title: { 
		fontSize: 30, 
		fontWeight: "bold", 
		textAlign: "right" 
	},
	subtitle: { 
		fontSize: 14, 
		margin: 5,
		color: "#6b7280", 
		textAlign: "right" 
	},
	scrollView: {
		width: "100%",
		backgroundColor: '#f8f8f8ff',
		// borderWidth: 2,
		flex: 1,
		marginBottom: -35
	}
});
