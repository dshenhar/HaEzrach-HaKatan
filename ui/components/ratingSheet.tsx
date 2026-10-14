import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { isRatable, saveRating, NewsItem, RatingEvent } from "@/state/engagement";
import { track } from "@/state/analytics";
import { TYPE } from "@/state/craft";
import { scaleFor } from "@/state/issueStance";
import { Toast } from "toastify-react-native";

const RIGHT = "#C0392F";
const LEFT = "#2B5EA7";
// The left's end on the left of the screen and the right's on the right, as
// everywhere in the app, whatever direction the page around it runs in.
const MAP = { flexDirection: "row", direction: "ltr" } as const;
// The slider takes a starting value of 0 for none at all and starts at its minimum
// instead, so it runs 0..10 and the middle is 5; its low end, at the left, is the
// left's.
const MID = 5;

interface RatingSheetProps {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	ratingTarget: NewsItem | null;
}

/**
 * Asked as a reader comes back from an article: was it for or against - against
 * what the issue is about, its "for" at the end of the side that is for it - or, on
 * political coverage, which has no for and against, how right or left it felt.
 *
 * Every headline on one of the issues is placed by the model on that issue's axis;
 * this is the readers' half. The model's reading stands until enough of them have
 * answered, and then they can move the headline to the other side - and with it,
 * over time, the outlet. The answer is kept on the same axis either way, the
 * right's end positive: the words change, the scale does not.
 */
export default function RatingSheet({ open, onOpenChange, ratingTarget }: RatingSheetProps) {
	const [val, setVal] = useState(0);
	const slideAnim = React.useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible

	const onSubmit = () => {
		const rate: RatingEvent = {
			id: ratingTarget ? ratingTarget.id : "0",
			source: ratingTarget ? ratingTarget.source : "0",
			topic: ratingTarget ? ratingTarget.topic : "0",
			value: val,
			createdAt: Date.now()
		}
		saveRating(rate);
		track("rating_submitted", { topic: rate.topic, value: rate.value, blind: false, kind: "feel" });
		Toast.show({
			type: "default",
			text1: "תודה, נשמר",
			position: "bottom",
			visibilityTime: 2000,
			backgroundColor: "white",
			textColor: "#111827",
			progressBarColor: "#111827",
			closeIcon: undefined,
			closeIconFamily: undefined,
			closeIconSize: 0,
		});
		setVal(0);
	}

	// Nothing to ask about a road accident: the sheet stays shut on a story whose
	// topic has no two sides, wherever it was opened from.
	const asked = open && isRatable(ratingTarget);

	// Animate sheet in/out
	useEffect(() => {
	if (asked) {
		Animated.timing(slideAnim, {
		toValue: 1,
		duration: 250,
		easing: Easing.out(Easing.ease),
		useNativeDriver: true,
		}).start();
	} else {
		Animated.timing(slideAnim, {
		toValue: 0,
		duration: 200,
		easing: Easing.in(Easing.ease),
		useNativeDriver: true,
		}).start();
	}
	}, [asked]);

	const handleSubmit = () => {
		onOpenChange(false);
		onSubmit();
		setVal(0);
	};

	const translateY = slideAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [400, 0],
	});

	const handleClose = () => {
		track("rating_dismissed", { topic: ratingTarget?.topic });
		onOpenChange(false);
		setVal(0);
	}

	const ink = val === 0 ? "#6B7280" : val > 0 ? RIGHT : LEFT;
	const scale = scaleFor(ratingTarget?.topic ?? "");

	return (
		<Modal
			visible={asked}
			transparent
			animationType="none"
			onRequestClose={handleClose}
		>
			{/* Background overlay */}
			<Pressable
			style={styles.overlay}
			onPress={handleClose}
			/>

			{/* Sliding sheet */}
			<Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
				<Text style={styles.title}>{scale.question}</Text>
				<Text style={styles.subtitle} numberOfLines={2}>
					{ratingTarget ? `${ratingTarget.source} · ${scale.about}` : ""}
				</Text>

				<View style={[styles.ends, MAP]}>
					<Text style={[styles.end, { color: LEFT }]}>{scale.leftEnd}</Text>
					<Text style={[styles.end, { color: RIGHT }]}>{scale.rightEnd}</Text>
				</View>
				<View style={MAP}>
					<Slider
						style={styles.slider}
						minimumValue={0}
						maximumValue={2 * MID}
						step={1}
						value={val + MID}
						onValueChange={(v) => setVal(Math.round(v) - MID)}
						minimumTrackTintColor={LEFT}
						maximumTrackTintColor={RIGHT}
						thumbTintColor={ink}
						accessibilityLabel={scale.spoken}
					/>
				</View>

				<Text style={[styles.value, { color: ink }]}>{scale.reading(val)}</Text>

				<View style={styles.buttonsWrapper}>
					<TouchableOpacity
						onPress={handleSubmit}
						style={[styles.button, styles.confirm]}
						accessibilityRole="button"
					>
					<Text style={styles.confirmText}>שליחה</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={handleClose}
						style={[styles.button, styles.cancel]}
						accessibilityRole="button"
					>
					<Text style={styles.cancelText}>דילוג</Text>
					</TouchableOpacity>
				</View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(17,24,39,0.35)",
	},
	sheet: {
		position: "absolute",
		bottom: 0,
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
		padding: 20,
		paddingBottom: 36,
		gap: 6,
		backgroundColor: "#fff",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	title: { ...TYPE.title, color: "#111827", textAlign: "right" },
	subtitle: { ...TYPE.caption, color: "#6B7280", textAlign: "right", marginBottom: 10 },
	ends: { justifyContent: "space-between", paddingHorizontal: 4 },
	slider: { flex: 1, height: 36 },
	end: { ...TYPE.label },
	value: { ...TYPE.label, fontSize: 15, textAlign: "center", marginTop: 6 },
	// the send on the right, where a Hebrew reader's eye ends the line
	buttonsWrapper: {
		flexDirection: "row-reverse",
		gap: 10,
		marginTop: 16,
	},
	button: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 999,
		alignItems: "center",
	},
	cancel: { backgroundColor: "#F4F4F3" },
	cancelText: { fontFamily: "Rubik_700Bold", fontSize: 14, color: "#111827" },
	confirm: { backgroundColor: "#111827" },
	confirmText: { fontFamily: "Rubik_700Bold", fontSize: 14, color: "#FFFFFF" },
});
