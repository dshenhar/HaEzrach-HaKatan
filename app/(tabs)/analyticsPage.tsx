import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import PieChart from "react-native-pie-chart";
import { Settings } from "lucide-react-native";
import { getAggs, getRanks, getWatches } from "@/state/engagement";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AnalyticsPage() {
	const [data, setData] = useState<Record<string, any>>({});
	const [aggregates, setAggregates] = useState<Record<string, any>>({});
	const [watches, setWatches] = useState<any[]>([]);
	const [refreshing, setRefreshing] = useState<boolean>(false);

	const fetchAnalitics = async () => {
		setData(await getRanks());
		setAggregates(await getAggs());
		setWatches(await getWatches());
	}

	useEffect(() => {
		fetchAnalitics();
	}, []);

	// ---- POSITION BREAKDOWN ----
	const positionData = useMemo(() => {
	if (!data || Object.keys(data).length === 0) {
		console.log("no data");
		return [];
	}

	let left = 0, center = 0, right = 0;

	watches.forEach(s => {
		const rating = data[s.site]?.[s.topic];
		if (rating < -2.5) left++;
		else if (rating > 2.5) right++;
		else center++;
	});

	const total = left + center + right || 1;

	const temp =  [
		{ name: "עמדות ימין", value: right, percentage: Math.round(right / total * 100), color: "#166534" },
		{ name: "עמדות מרכז", value: center, percentage: Math.round(center / total * 100), color: "#16a34a" },
		{ name: "עמדות שמאל", value: left, percentage: Math.round(left / total * 100), color: "#4ade80" },
	];
	console.log(temp);
	return temp;

	}, [data, watches, aggregates]);

	// ---- DIVERSITY SCORE ----
	const diversityScore = useMemo(() => {
		if (!aggregates || Object.keys(aggregates).length === 0) return 0;

		const sources = Object.keys(aggregates);
		const ratings = sources.map(source => {
			const topics = Object.values(aggregates[source] || {});
			return topics.length
			? topics.reduce((sum: number, t: any) => sum + t.avg, 0) / topics.length
			: 0;
		});

		const variance = ratings.reduce((sum, r) => sum + r * r, 0) / ratings.length;

		return Math.max(0, Math.min(100, Math.round((1 - variance / 25) * 100)));
	}, [aggregates]);

	// ---- BLIND SPOTS ----
	const allSources = Object.keys(data);
	const readLastMonth = new Set(
		watches.filter(e => {
		const now = new Date();
		const monthAgo = new Date();
		monthAgo.setMonth(now.getMonth() - 1);
		return e.date >= monthAgo && e.date <= now;
		}).map(e => e.site)
	);

	const blindSpots = allSources.filter(s => !readLastMonth.has(s));

	// ---- PIE CHART ----
	const pieData = positionData.filter(item => item.value > 0).map((item) => ({
		value: item.value,
		color: item.color,
	}));

	const onRefresh = () => {
		setRefreshing(true);
		fetchAnalitics();
		setTimeout(() => {
			setRefreshing(false);
		}, 1000);
	}

	return (
	<SafeAreaView style={styles.container}>
		{/* Header */}
		<View style={styles.header}>
		<Text style={styles.logo}>360°</Text>
		<Settings size={26} color="#888" />
		</View>

		<ScrollView style={styles.scroll} 
		contentContainerStyle={{ paddingBottom: 5, alignItems: "center" }} 
		showsVerticalScrollIndicator={false} 
		refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
		>
			{/* Title */}
			<View style={styles.titleWrapper}>
				<Text style={styles.mainTitle}>נתונים וניתוחים</Text>
				<Text style={styles.subTitle}>ניתוח נתוני הצפיות שלך</Text>
			</View>

			{/* Position Breakdown */}
			<View style={styles.card}>
				<Text style={styles.cardTitle}>פילוח סוגי העמדות אותן קראת</Text>

				<View style={styles.chartRow}>
				<PieChart
					series={pieData.length ? pieData : [{ value: 0.9999, color: "#888" }, { value: 0.0001, color: "#fff" }]}
					widthAndHeight={150}
					cover={0.60}
					padAngle={0.03}
				/>
				</View>

				<View style={styles.percentRow}>
				{
					(positionData.length ? positionData : [
						{ name: "עמדות ימין", value: "right", percentage: 0, color: "#166534" },
						{ name: "עמדות מרכז", value: "center", percentage: 0, color: "#16a34a" },
						{ name: "עמדות שמאל", value: "left", percentage: 0, color: "#4ade80" },
					]).map((p, i) => (
						<Text key={i} style={[styles.percentText, { color: p.color }]}>
							{p.percentage}%
						</Text>
					))
				}
				</View>

				<View style={styles.legendRow}>
				{(positionData.length ? positionData : [
					{ name: "עמדות ימין", value: "right", percentage: 0, color: "#166534" },
					{ name: "עמדות מרכז", value: "center", percentage: 0, color: "#16a34a" },
					{ name: "עמדות שמאל", value: "left", percentage: 0, color: "#4ade80" },
				]).map((p, i) => (
					<View key={i} style={styles.legendItem}>
					<View style={[styles.circle, { backgroundColor: p.color }]} />
					<Text>{p.name}</Text>
					</View>
				))}
				</View>
			</View>

			{/* Diversity Score */}
			<View style={styles.card}>
				<Text style={styles.cardTitle}>מידת גיוון קריאה ביחס לעמדה שלך</Text>

				<View style={styles.progressBar}>
				<View style={[styles.progressFill, { width: `${diversityScore}%` }]} />
				</View>

				<Text style={styles.scoreNumber}>{diversityScore}%</Text>

				<Text style={styles.subTitle2}>
				ציון גיוון קריאה — ככל שהציון גבוה יותר, אתה קורא מגוון רחב יותר של דעות
				</Text>
			</View>

			{/* Blind Spots */}
			<View style={styles.card}>
				<Text style={styles.cardTitle}>Blind Spots</Text>
				<Text style={styles.subTitle2}>העיתונים שלא קראת בהם מעל חודש</Text>

				{blindSpots.length > 0 ? (
				<View style={styles.badgeRow}>
					{blindSpots.map((b) => (
					<View key={b} style={styles.badge}>
						<Text>{b}</Text>
					</View>
					))}
				</View>
				) : (
				<Text style={styles.successText}>מעולה! קראת מכל המקורות החודש</Text>
				)}
			</View>
		</ScrollView>
	</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
		direction: "rtl",
		marginBottom: -35
	},
	header: {
		padding: 16,
		borderBottomWidth: 1,
		borderColor: "#ddd",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	logo: {
		fontSize: 26,
		fontWeight: "bold",
	},
	scroll: {
		backgroundColor: '#f8f8f8ff',
		paddingTop: 16,
	},
	titleWrapper: {
		alignItems: "center",
		marginBottom: 20,
	},
	mainTitle: {
		fontSize: 22,
		fontWeight: "bold",
	},
	subTitle: {
		color: "#666",
		marginTop: 4,
	},
	card: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginBottom: 20,
		elevation: 2,
		borderWidth: 1,
		width: "90%",
		alignItems: "center",
		borderColor: "#eaeaeaff",
	},
	cardTitle: {
		textAlign: "center",
		fontWeight: "bold",
		fontSize: 18,
		marginBottom: 16,
	},
	chartRow: {
		alignItems: "center",
		// borderWidth: 1
	},
	percentRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginTop: 8,
		// borderWidth: 1
	},
	percentText: {
		marginHorizontal: 10,
		fontSize: 18,
		fontWeight: "bold",
	},
	legendRow: {
		flexDirection: "row",
		justifyContent: "center",
		marginTop: 12,
	},
	legendItem: {
		flexDirection: "row",
		alignItems: "center",
		marginHorizontal: 10,
	},
	circle: {
		width: 10,
		height: 10,
		borderRadius: 6,
		marginRight: 6,
		marginLeft: 4
	},
	progressBar: {
		width: "100%",
		height: 10,
		backgroundColor: "#ddd",
		borderRadius: 10,
		overflow: "hidden",
		marginTop: 10,
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#16a34a",
	},
	scoreNumber: {
		fontSize: 26,
		marginTop: 12,
		fontWeight: "bold",
		color: "#15803d",
		textAlign: "center",
	},
	subTitle2: {
		textAlign: "center",
		color: "#666",
		marginTop: 4,
	},
	badgeRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		marginTop: 10,
	},
	badge: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: "#aaa",
		borderRadius: 12,
		margin: 4,
	},
	successText: {
		textAlign: "center",
		color: "#16a34a",
		fontWeight: "600",
		marginTop: 10,
	},
});

