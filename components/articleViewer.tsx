import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Dimensions } from "react-native";
import Modal from "react-native-modal";
import { WebView } from "react-native-webview";
import { X, ExternalLink } from "lucide-react-native";
import { saveWatch, WatchingEvent } from "@/state/engagement";

const { height } = Dimensions.get("window");

interface ArticleViewerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	url: string;
	title?: string;
	source: string;
	id: string;
	topic: string;
}

export function ArticleViewer({ open, onOpenChange, url, title, source, id, topic }: ArticleViewerProps) {
	const [loading, setLoading] = React.useState(true);

	const handleOnLoadEnd = () => {
		setLoading(false);
		const watchEvent: WatchingEvent = {
			id: id,
			site: source,
			topic: topic,
			date: Date.now()
		}
		saveWatch(watchEvent);
	}

	return (
	<Modal
		isVisible={open}
		onBackdropPress={() => onOpenChange(false)}
		onSwipeComplete={() => onOpenChange(false)}
		swipeDirection="down"
		style={styles.modal}
		propagateSwipe
	>
		<View style={styles.sheet}>
		{/* Header */}
		<View style={styles.header}>
			<View style={styles.headerLeft}>
			<TouchableOpacity
				onPress={() => onOpenChange(false)}
				accessibilityLabel="סגור"
				style={styles.iconButton}
			>
				<X size={20} color="#333" />
			</TouchableOpacity>
			<Text style={styles.title}>{source || "קריאה מלאה"}</Text>
			</View>
			<TouchableOpacity
			onPress={() => Linking.openURL(url)}
			accessibilityLabel="פתח בחלון חדש"
			style={styles.externalButton}
			>
				<ExternalLink size={16} color="#333" />
				<Text style={styles.externalText}>פתח חיצוני</Text>
			</TouchableOpacity>
		</View>

		{/* WebView */}
		<View style={styles.webviewContainer}>
			{url ? (
			<>
				{loading && (
				<View style={styles.loading}>
					<ActivityIndicator size="large" color="#888" />
					<Text style={styles.loadingText}>טוען כתבה...</Text>
				</View>
				)}
				<WebView
				source={{ uri: url }}
				onLoadEnd={handleOnLoadEnd}
				startInLoadingState
				style={StyleSheet.absoluteFill}
				/>
			</>
			) : (
				<View style={styles.loading}>
					<Text style={styles.loadingText}>טוען כתבה...</Text>
				</View>
			)}
		</View>
		</View>
	</Modal>
	);
}

const styles = StyleSheet.create({
	modal: {
		justifyContent: "flex-end",
		margin: 0,
	},
	sheet: {
		height: height * 0.95,
		backgroundColor: "#fff",
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		overflow: "hidden",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		backgroundColor: "#fff",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
	},
	iconButton: {
		padding: 6,
	},
	externalButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		padding: 6,
	},
	externalText: {
		fontSize: 14,
	},
	webviewContainer: {
		flex: 1,
	},
	loading: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#fff",
	},
	loadingText: {
		marginTop: 8,
		color: "#888",
	},
});
