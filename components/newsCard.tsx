import { slideItemColors, slideWidth } from '@/state/constants';
import { NewsItem, URL_BASE } from '@/state/engagement';
import { Bookmark, ExternalLink, Share2 } from "lucide-react-native";
import React, { Dispatch, SetStateAction } from 'react';
import { Alert, Dimensions, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RateBar from './ui/rateBar';
import { Background } from '@react-navigation/elements';
import Ionicons from '@expo/vector-icons/Ionicons';

type props = {
    slide: NewsItem;
    index: number;
    expanded: boolean;
    setExpanded: Dispatch<SetStateAction<boolean>>;
    setViewerOpen: Dispatch<SetStateAction<boolean>>;
    setViewerUrl: Dispatch<SetStateAction<string | null>>;
    setViewerTitle: Dispatch<SetStateAction<string>>;
    setViewerSource: Dispatch<SetStateAction<string>>;
    setRatingOpen: Dispatch<SetStateAction<boolean>>;
    setRatingTarget: Dispatch<SetStateAction<NewsItem | null>>;
}

const NewsCard = ({slide, index, expanded, setExpanded, setViewerOpen, setViewerUrl, setViewerTitle, 
    setViewerSource, setRatingOpen, setRatingTarget}: props) => {
    const width = Dimensions.get("window").width * slideWidth;

    const getBiasColor = (score: number) => {
        if (score <= -3) return "#3b82f6"; // blue
        if (score >= 3) return "#ef4444"; // red
        return "#9ca3af"; // gray
    };

    const handleLongPress = () => {
        setRatingTarget(slide);
        setRatingOpen(true);
    }

    const timeFormat = (timeIso : string) => {
        const date = new Date(timeIso);
        const curDate = new Date();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const day = date.getDay();
        const curDay = curDate.getDay();
        const timeText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        if (day === curDay) {
            return "היום " + timeText;
        } else if (day === ((curDay-1) > 0 ? (curDay-1) : (curDay+6))) {
            return "אתמול " + timeText;
        }
        return `${date.getDay().toString()}.${date.getMonth().toString()} ` + timeText;
    }

    const openArticle = (s: NewsItem) => {
        const raw = s.link?.trim() || "";
        let href = raw.startsWith("//") ? `https:${raw}` : raw;
    
        if (!href) {
            Alert.alert("אין קישור לכתבה", "לא ניתן לפתוח קריאה מלאה");
            return;
        }
    
        const isHttp = /^https?:\/\//i.test(href);
        if (!isHttp) {
            Linking.openURL(href).catch(() => {
                Alert.alert("שגיאה", "לא ניתן לפתוח את הקישור החיצוני");
                });
            return;
        }
        
        if (href.includes("ynet") || href.includes("calcalist")) {
            console.log("contains ynet or calcalist");
            href = `${URL_BASE}/api/bypass?url=${encodeURIComponent(href)}`;
        }
    
        console.log("Opening article:", href);
    
        setViewerUrl(href);
        setViewerTitle(s.title);
        setViewerSource(s.source);
        setViewerOpen(true);
	};
      
	return (
		// <View style={{height: !expanded ? 170 : "auto", top: 10}}>
			// {/* <View style={[styles.backSlide, { backgroundColor: slideItemColors["thirdBackground"][slide.category], transform: [{ rotate: "-2.62deg" }] }]}></View> */}
			// {/* <View style={[styles.backSlide, { backgroundColor: slideItemColors["secondBackground"][slide.category], transform: [{ rotate: "0.43deg" }], left: 14, top: 10 }]}></View> */}
		<View style={[styles.slide, { width: width, height: !expanded  ? 185 : "auto"}]}>
			<TouchableOpacity onPress={() => setExpanded(!expanded)} onLongPress={handleLongPress} activeOpacity={0.9}>
				<View style={[{ flexDirection: "row", width: "100%", justifyContent: "space-between"}]}>
					<TouchableOpacity style={styles.iconButton}>
						<Bookmark size={22} color="#6b7280" />
					</TouchableOpacity>
					<Text style={[styles.time, {position: "absolute", top: 0, right: 0}]}>{timeFormat(slide.time)}</Text>
				</View>
				<View style={styles.titleWrapper}>
					<View style={styles.titleContainer}>
						<Text style={styles.title} numberOfLines={!expanded ? 3 : undefined}>
							{slide.title}
						</Text>
					</View>
				</View>
			</TouchableOpacity>

			{!expanded ? (
				<View style={[styles.rowBetween, { position: "absolute", bottom: 45, alignSelf: "center" }]}>
					{/* <View style={styles.row}>
						<View
						style={[
							styles.dot,
							{ backgroundColor: getBiasColor(slide.siteBiasScore) },
						]}
						/>
						<Text style={styles.source}>{slide.source}</Text>
					</View> */}
					<View style={[styles.row, { width: "100%", justifyContent: "flex-end" }]}>
						<View style={{ width: "25%", alignSelf: "center", height: 20, justifyContent: "center" }}>
							<RateBar rate={(slide.biasScore * 10) + 50} showPrecents={false} style={{ padding: 3 }} />
						</View>
						<View style={[styles.badge ]}>
							<Text style={ styles.badgeText }>{slide.topic}</Text>
						</View>
						{/* <View style={[styles.badge, {backgroundColor: "#d5d5d5ff"}]}>
							<Text style={ styles.badgeText }>{slide.category}</Text>
						</View> */}
						{/* <View style={[styles.badge, styles.badgeSecondary]}>
							<Text style={styles.badgeText}>{slide.category}</Text>
						</View> */}
					</View>
				</View>
			) : (
				<View style={{ flex: 1, justifyContent: "space-between" }}>
					<View>
						<View style={styles.rowBetween}>
							<View style={styles.row}>
							</View>
							<View style={styles.row}>
							<Text style={styles.source}>{slide.source}</Text>
							<View
								style={[
								styles.dot,
								{ backgroundColor: getBiasColor(slide.siteBiasScore) },
								]}
							/>
							</View>
						</View>
						<Text style={styles.summary}>{slide.summary}</Text>
					</View>
					<View>
						<View style={styles.rowBetween}>
							{/* <View style={styles.row} /> */}
							<View style={[styles.row, { flex: 1, justifyContent: "space-between"}]}>
								<View
									style={[styles.badge, { backgroundColor: getBiasColor(slide.biasScore) }]}
								>
									<Text style={styles.badgeText}>{slide.category + "/ " + slide.topic}</Text>
								</View>
								<View style={[styles.badge, styles.badgeSecondary]}>
									<Text style={styles.badgeText}>{slide.category}</Text>
								</View>
							</View>
						</View>
						<View style={[styles.rowBetween, { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#d9d9dbff" }]}>
							<TouchableOpacity
							style={styles.readButton}
							onPress={() => openArticle(slide)}
							>
								<ExternalLink size={16} color="#fff" />
								<Text style={styles.readText}>לקריאה</Text>
							</TouchableOpacity>
							<View style={styles.row}>
								<TouchableOpacity style={styles.iconButton}>
									<Share2 size={18} color="#6b7280" />
								</TouchableOpacity>
								<TouchableOpacity style={styles.iconButton}>
									<Bookmark size={18} color="#6b7280" />
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>
			)}
			<View style={{borderTopWidth: 0.5, width: "100%", alignItems: "center", position: "absolute", bottom: -1, alignSelf: "center", borderColor: "#d8d8d8ff"}}>
				<Ionicons style={{padding: 5}} name={'chevron-down-outline'} color={"#d8d8d8ff"} size={20}/>
			</View>
		</View>
		// </View>
    )
}

export default NewsCard

const styles = StyleSheet.create({
	slide: {
		// flex: 1,
		// top: 3,
		padding: 15,
		borderRadius: 8,
		marginHorizontal: 9,
		backgroundColor: '#ebebebff',
		// marginBottom: 15,
		height: 145,
		// borderWidth: 1
	},
	backSlide: {
		position: "absolute",
		// top: 10,
		height: 140,
		// borderWidth: 1,
		borderRadius: 8,
		width: "95%",
		marginHorizontal: 4,
		opacity: 0.4
	},
	titleWrapper: {
		flexDirection: "row-reverse",
		alignItems: "flex-start",
		borderRadius: 8,
		justifyContent: "space-between",
		overflow: "hidden",
		width: "100%",
		// borderWidth: 1
	},
	image: {
		width: 80,
		height: 80,
		marginLeft: 12,
		borderRadius: 8,
	},
	imageExpanded: {
	// when expanded, allow image to keep size but title area can grow
	},
	imagePlaceholder: {
		backgroundColor: "#e5e7eb",
	},
	titleContainer: {
		width: "80%",
		// flex: 1,
		justifyContent: "center",
	},
	title: {
		marginTop: 8,
		fontSize: 18,
		fontWeight: "600",
		textAlign: "right",
		color: "#111827",
	},
	summary: {
		marginTop: 8,
		textAlign: "right",
		color: "#4b5563",
	},
	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 8,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		// width: "100%",
		// borderWidth: 1
	},
	dot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		marginHorizontal: 4,
	},
	source: {
		fontSize: 12,
		color: "#111827",
	},
	time: {
		fontSize: 12,
		color: "#6b7280",
		marginLeft: 4,
		alignSelf: "flex-end"
	},
	badge: {
		borderRadius: 12,
		paddingLeft: 5,
		paddingVertical: 5,
		marginLeft: 4,
	},
	badgeText: {
		fontSize: 12,
		color: "#6b7280",
	},
	badgeSecondary: {
		backgroundColor: "#e5e7eb",
	},
	readButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#2563eb",
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	readText: {
		color: "#fff",
		fontSize: 12,
		marginLeft: 4,
	},
	iconButton: {
		marginLeft: 0,
	},
});
