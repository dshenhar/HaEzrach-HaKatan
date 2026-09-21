import SwipeTabs from '@/components/swipeTabs';
import { fetchArticles, getSitePositions, NewsItem, SitePosition } from "@/state/engagement";
import { buildInsights, Insights } from "@/state/insights";
import { getProfile, ReaderProfile } from "@/state/profile";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, I18nManager, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** "BeHadrei Haredim" does not fit in a 44px circle */
function shortLabel(name: string) {
	const words = name.split(/\s+/);
	return words.length > 1 ? words.map((w) => w.slice(0, 6)).slice(0, 2).join("\n") : name.slice(0, 8);
}

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
const BRAND = "#22C55E";
// Every row on this page reads right to left. The phone runs the app in RTL layout
// and the web build does not, so the same row needs "row" on one and "row-reverse"
// on the other to put its first item on the right.
const RTL_ROW = I18nManager.isRTL ? "row" : "row-reverse";

export default function AnalyticsPage() {
	const [profile, setProfile] = useState<ReaderProfile | null>(null);
	const [insights, setInsights] = useState<Insights | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	// long and static, so it stays out of the way until asked for
	const [positionsOpen, setPositionsOpen] = useState(false);

	const load = useCallback(async () => {
		let feed: NewsItem[][] = [];
		const [p, positions] = await Promise.all([
			getProfile(),
			getSitePositions(),
			fetchArticles((next) => { feed = typeof next === "function" ? next(feed) : next; }),
		]);
		setProfile(p);
		if (p) setInsights(await buildInsights(p, positions as Record<string, SitePosition>, feed));
	}, []);

	useEffect(() => { load(); }, [load]);

	const onRefresh = async () => {
		setRefreshing(true);
		await load();
		setRefreshing(false);
	};

	if (!profile || !insights) {
		return (
			<SafeAreaView style={styles.container}>
				<ActivityIndicator style={{ marginTop: 40 }} />
			</SafeAreaView>
		);
	}

	const ownLabel = profile.bloc === "right" ? "ימין" : "שמאל";
	const otherLabel = profile.bloc === "right" ? "שמאל" : "ימין";
	const ownColour = profile.bloc === "right" ? RIGHT : LEFT;
	const otherColour = profile.bloc === "right" ? LEFT : RIGHT;
	const captivePct = Math.round(insights.captive * 100);

	return (
		<SwipeTabs>
			<SafeAreaView style={styles.container}>
				<ScrollView
					contentContainerStyle={styles.scroll}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				>
					<Text style={styles.title}>מה קורא פה</Text>
					<Text style={styles.subtitle}>ניתוח נתוני הצפיות שלך</Text>

					{insights.totalRead === 0 ? (
						<View style={styles.card}>
							<Text style={styles.cardTitle}>עוד לא קראת כתבות</Text>
							<Text style={styles.note}>
								הנתונים כאן נבנים מהכתבות שאתה פותח. תקרא כמה כתבות ותחזור.
							</Text>
						</View>
					) : (
						<>
							<View style={styles.card}>
								<Text style={styles.cardTitle}>כמה אתה שבוי בקונספציה</Text>
								<View style={styles.bigRow}>
									<Text style={styles.big}>{captivePct}%</Text>
									<Text style={styles.note}>
										מהקריאה שלך הגיעה מגופים בגוש {ownLabel} — הגוש שהצהרת עליו
									</Text>
								</View>
								<View style={styles.track}>
									<View style={[styles.fill, { width: `${captivePct}%`, backgroundColor: ownColour }]} />
								</View>
								<Text style={styles.footnote}>
									{insights.inOwnBloc} כתבות מ{ownLabel} · {insights.inOtherBloc} מ{otherLabel}
								</Text>
							</View>

							<View style={styles.card}>
								<Text style={styles.cardTitle}>פילוח סוגי העמדות אותן קראת</Text>
								<View style={styles.legend}>
									<Text style={[styles.legendItem, { color: RIGHT }]}>● עמדות ימין</Text>
									<Text style={[styles.legendItem, { color: LEFT }]}>● עמדות שמאל</Text>
								</View>
								{(() => {
									const total = insights.byBloc.right + insights.byBloc.left || 1;
									// area, not diameter, carries the share - a bubble sized by
									// diameter exaggerates the bigger side
									const size = (n: number) => 42 + Math.sqrt(n / total) * 78;
									// right bloc first, so it lands on the right like its label
									const bubbles = [
										{ n: insights.byBloc.right, colour: RIGHT, key: "r" },
										{ n: insights.byBloc.left, colour: LEFT, key: "l" },
									].filter((b) => b.n > 0);
									return (
										<View style={styles.bubbles}>
											{bubbles.map((b) => (
												<View key={b.key} style={[styles.bubble, {
													width: size(b.n), height: size(b.n),
													borderRadius: size(b.n) / 2, backgroundColor: b.colour,
												}]}>
													<Text style={styles.bubbleText}>
														{Math.round((b.n / total) * 100)}%
													</Text>
												</View>
											))}
										</View>
									);
								})()}
							</View>

							<View style={styles.card}>
								<Text style={styles.cardTitle}>מידת גיוון הקריאה ביחס לעמדתך</Text>
								<View style={styles.track}>
									<View style={[styles.fill, {
										width: `${Math.round((1 - insights.captive) * 100)}%`, backgroundColor: BRAND,
									}]} />
								</View>
								<Text style={styles.note}>
									{insights.captive < 0.5
										? "אתה קורא יותר מהגוש השני מאשר משלך. זה נדיר."
										: insights.captive < 0.8
										? "אתה יוצא מהגוש שלך לא מעט."
										: "כמעט כל הקריאה שלך בתוך הגוש שלך."}
								</Text>
							</View>

							<Text style={styles.sectionTitle}>Blind Spots</Text>

							{insights.oneSidedTopics.length > 0 && (
								<View style={styles.card}>
									<Text style={styles.cardTitle}>נושאים ששמעת בהם צד אחד בלבד</Text>
									{insights.oneSidedTopics.slice(0, 5).map((t) => (
										<View key={t.topic} style={styles.row}>
											<Text style={styles.rowLabel}>{t.topic}</Text>
											<Text style={[styles.rowValue, {
												color: t.onlyBloc === "right" ? RIGHT : LEFT,
											}]}>
												רק {t.onlyBloc === "right" ? "ימין" : "שמאל"} · {t.count}
											</Text>
										</View>
									))}
								</View>
							)}

							<View style={styles.card}>
								<Text style={styles.cardTitle}>העיתונים שלא קראת בהם מעל חודש</Text>
								<View style={styles.avatars}>
									{insights.unreadOutlets.slice(0, 8).map((name) => (
										<View key={name} style={styles.avatar}>
											<Text style={styles.avatarText} numberOfLines={2}>{shortLabel(name)}</Text>
										</View>
									))}
								</View>
							</View>

							{insights.untouchedTopics.length > 0 && (
								<View style={styles.card}>
									<Text style={styles.cardTitle}>נושאים שלא נגעת בהם בכלל</Text>
									<View style={styles.chips}>
										{insights.untouchedTopics.slice(0, 8).map((topic) => (
											<View key={topic} style={styles.chip}>
												<Text style={styles.chipText}>{topic}</Text>
											</View>
										))}
									</View>
								</View>
							)}

							{insights.missedStories.length > 0 && (
								<View style={styles.card}>
									<Text style={styles.cardTitle}>האירועים שפספסת</Text>
									{insights.missedStories.slice(0, 3).map((story, i) => (
										<View key={i} style={styles.missed}>
											<View style={styles.missedHead}>
												<View style={[styles.avatar, styles.avatarSm]}>
													<Text style={styles.avatarText} numberOfLines={2}>{shortLabel(story.source)}</Text>
												</View>
												{!!story.topic && (
													<View style={styles.chip}>
														<Text style={styles.chipText}>{story.topic}</Text>
													</View>
												)}
											</View>
											<Text style={styles.missedTitle} numberOfLines={2}>{story.title}</Text>
										</View>
									))}
									<Text style={styles.footnote}>
										{insights.missedStories.length} סיפורים שלא פתחת — המוצגים כאן מהגוש שאתה פחות קורא
									</Text>
								</View>
							)}
						</>
					)}

					<View style={styles.card}>
						<TouchableOpacity
							style={styles.cardHead}
							onPress={() => setPositionsOpen(!positionsOpen)}
							activeOpacity={0.7}
						>
							<Text style={styles.cardTitle}>העמדה שהצהרת עליה</Text>
							<Ionicons
								name={positionsOpen ? "chevron-up" : "chevron-down"}
								size={18}
								color="#6B7280"
							/>
						</TouchableOpacity>

						{positionsOpen && Object.entries(profile.positions).map(([topic, score]) => (
							<View key={topic} style={styles.row}>
								<Text style={styles.rowLabel}>{topic}</Text>
								<Text style={[styles.rowValue, { color: score >= 0 ? RIGHT : LEFT }]}>
									{score > 0 ? "+" : ""}{score}
								</Text>
							</View>
						))}
					</View>
				</ScrollView>
			</SafeAreaView>
		</SwipeTabs>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f8f8f8ff" },
	scroll: { padding: 16, gap: 12, paddingBottom: 40 },
	title: { fontFamily: "Heebo_800ExtraBold", fontSize: 26, color: "#111827", textAlign: "right" },
	subtitle: { fontFamily: "Heebo_400Regular", fontSize: 14, color: "#6B7280", textAlign: "right", marginBottom: 4 },
	sectionTitle: { fontFamily: "Heebo_800ExtraBold", fontSize: 19, color: "#111827", textAlign: "right", marginTop: 8 },

	card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 9 },
	cardTitle: { fontFamily: "Heebo_700Bold", fontSize: 14, color: "#111827", textAlign: "right" },
	bigRow: { flexDirection: RTL_ROW, alignItems: "baseline", gap: 10 },
	big: { fontFamily: "Heebo_800ExtraBold", fontSize: 34, color: "#111827" },
	note: { fontFamily: "Heebo_400Regular", fontSize: 12, lineHeight: 18, color: "#6B7280", textAlign: "right", flex: 1 },
	footnote: { fontFamily: "Heebo_500Medium", fontSize: 11, color: "#9CA3AF", textAlign: "right" },

	// the bars fill from the right
	track: { flexDirection: RTL_ROW, height: 10, borderRadius: 999, backgroundColor: "#EEEDEA", overflow: "hidden" },
	fill: { height: 10, borderRadius: 999 },

	// centred like the circles below, so each label sits over its own circle
	legend: { flexDirection: RTL_ROW, justifyContent: "center", gap: 44 },
	legendItem: { fontFamily: "Heebo_700Bold", fontSize: 11 },

	cardHead: { flexDirection: RTL_ROW, alignItems: "center", justifyContent: "space-between" },
	row: {
		// without the gap the score sat flush against the end of the topic name
		flexDirection: RTL_ROW, justifyContent: "space-between", alignItems: "center", gap: 14,
		borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEEDEA", paddingVertical: 6,
	},
	rowLabel: { fontFamily: "Heebo_400Regular", fontSize: 13, color: "#111827", textAlign: "right", flex: 1 },
	rowValue: { fontFamily: "Heebo_800ExtraBold", fontSize: 12 },

	bubbles: { flexDirection: RTL_ROW, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 6 },
	bubble: { alignItems: "center", justifyContent: "center" },
	bubbleText: { fontFamily: "Heebo_800ExtraBold", fontSize: 13, color: "#fff" },

	avatars: { flexDirection: RTL_ROW, flexWrap: "wrap", gap: 8 },
	avatar: {
		width: 46, height: 46, borderRadius: 23, backgroundColor: "#3A3A38",
		alignItems: "center", justifyContent: "center", padding: 3,
	},
	avatarSm: { width: 30, height: 30, borderRadius: 15 },
	avatarText: { fontFamily: "Heebo_700Bold", fontSize: 8, color: "#fff", textAlign: "center", lineHeight: 10 },

	missed: {
		backgroundColor: "#F4F4F3", borderRadius: 10, padding: 10, gap: 6, marginTop: 2,
	},
	missedHead: { flexDirection: RTL_ROW, alignItems: "center", gap: 8 },
	missedTitle: { fontFamily: "Heebo_700Bold", fontSize: 13, lineHeight: 18, color: "#111827", textAlign: "right" },

	chips: { flexDirection: RTL_ROW, flexWrap: "wrap", gap: 6 },
	chip: { borderWidth: 1, borderColor: "#E3E3E1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
	chipText: { fontFamily: "Heebo_500Medium", fontSize: 11, color: "#111827" },
});
