import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { saveRating, NewsItem, RatingEvent } from "@/state/engagement";
import { Toast } from "toastify-react-native";

interface RatingSheetProps {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	ratingTarget: NewsItem | null;
}

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
		Toast.show({
			type: "default",
			text1: "vote sent!",
			position: "bottom",
			visibilityTime: 2000,
			backgroundColor: "white",
			textColor: "#1d417eff",
			progressBarColor: "#1d417eff",
			closeIcon: undefined,
			closeIconFamily: undefined,
			closeIconSize: 0,
		});
		setVal(0);
	}

	// Animate sheet in/out
	useEffect(() => {
	if (open) {
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
	}, [open]);

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
		onOpenChange(false);
		setVal(0);
	}

	return (
		<Modal
			visible={open}
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
				<View style={styles.header}>
					<Text style={styles.title} numberOfLines={2}>
					דרגו: עד כמה הכתבה של {ratingTarget ? ratingTarget.source : "error"} בעד/נגד הנושא {ratingTarget ? ratingTarget.topic : "error"}?
					</Text>
				</View>

				<Text style={styles.subtitle}>-5 = נגד חזק, 0 = ניטרלי, 5 = בעד חזק</Text>

				<Slider
					minimumValue={-5}
					maximumValue={5}
					step={1}
					value={val}
					onValueChange={setVal}
					minimumTrackTintColor="#2563eb"
					maximumTrackTintColor="#ef0606ff"
				/>

				<Text style={styles.value}>{val}</Text>

				<View style={styles.buttonsWrapper}>
					<TouchableOpacity
						onPress={handleClose}
						style={[styles.button, styles.cancel]}
					>
					<Text style={styles.cancelText}>ביטול</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={handleSubmit}
						style={[styles.button, styles.confirm]}
					>
					<Text style={styles.confirmText}>שמור דירוג</Text>
					</TouchableOpacity>
				</View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.45)",
	},
	sheet: {
		position: "absolute",
		bottom: 0,
		width: "100%",
		padding: 20,
		paddingBottom: 40,
		backgroundColor: "#fff",
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 10,
		direction: "rtl",
	},
	header: {
		marginBottom: 10,
	},
	title: {
		fontFamily: "Heebo_700Bold",
		fontSize: 15,
		fontWeight: "700",
		textAlign: "right",
	},
	subtitle: {
		fontFamily: "Heebo_400Regular",
		marginTop: 4,
		marginBottom: 12,
		fontSize: 13,
		color: "#6b7280",
		textAlign: "right",
	},
	value: {
		fontFamily: "Heebo_700Bold",
		marginTop: 12,
		textAlign: "center",
		fontSize: 22,
		fontWeight: "700",
	},
	buttonsWrapper: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 12,
		marginTop: 20,
	},
	button: {
		paddingVertical: 10,
		paddingHorizontal: 18,
		borderRadius: 10,
	},
	cancel: {
		backgroundColor: "#e5e7eb",
	},
	cancelText: {
		fontFamily: "Heebo_700Bold",
		color: "#111827",
		fontWeight: "600",
	},
	confirm: {
		backgroundColor: "#2563eb",
	},
	confirmText: {
		fontFamily: "Heebo_700Bold",
		color: "#fff",
		fontWeight: "600",
	},
});
