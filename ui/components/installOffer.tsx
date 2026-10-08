import {
	dismissInstallBanner,
	installKind,
	InstallKind,
	promptInstall,
	subscribeInstall,
	wasInstallDismissed,
} from "@/state/install";
import { track } from "@/state/analytics";
import { useTheme } from "@/state/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { I18nManager, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "react-native-modal";

/**
 * The offer to keep the site on the home screen. The strip under the name is
 * made once and remembers a refusal. The row in the personal area stays until
 * the site is actually installed, so closing the strip is not the last door.
 *
 * On an iPhone the button cannot install anything itself, so it opens the
 * steps. A second modal on top of the personal-area sheet gets clipped, so
 * there the same steps open in place.
 */

const ACTION = "הוספה למסך הבית";

const SAFARI_STEPS: { icon: "share-outline" | "add-circle-outline" | "checkmark-circle-outline"; text: string }[] = [
	{ icon: "share-outline", text: "לחצו על כפתור השיתוף" },
	{ icon: "add-circle-outline", text: "בחרו «הוסף למסך הבית»" },
	{ icon: "checkmark-circle-outline", text: "לחצו «הוסף»" },
];

const OTHER_IOS = "את ההוספה למסך הבית אפשר לעשות רק מספארי. פתחו שם את האתר, ומשם הוסיפו.";

// across a remount in development, so one visit is not counted twice
let offered = false;

function useInstallOffer() {
	const kind = useSyncExternalStore(subscribeInstall, installKind, () => null);
	// null until the saved refusal is read, so the strip does not flash and vanish
	// a phone build has no install dialog, so the refusal is already settled
	const [dismissed, setDismissed] = useState<boolean | null>(Platform.OS === "web" ? null : true);
	const [busy, setBusy] = useState(false);
	const [guide, setGuide] = useState(false);

	useEffect(() => {
		if (Platform.OS !== "web") return;
		let live = true;
		wasInstallDismissed().then((gone) => { if (live) setDismissed(gone); });
		return () => { live = false; };
	}, []);

	const add = async (where: "banner" | "personal") => {
		if (kind === "prompt") {
			if (busy) return;
			setBusy(true);
			const outcome = await promptInstall();
			setBusy(false);
			if (outcome === "accepted") track("install_accepted", { where });
			return;
		}
		// the strip's button always opens the steps; the row opens and closes them
		setGuide((open) => (where === "banner" ? true : !open));
	};

	const dismiss = () => {
		track("install_dismissed");
		dismissInstallBanner();
		setDismissed(true);
		setGuide(false);
	};

	return {
		kind,
		showBanner: dismissed === false && kind !== null,
		showRow: kind !== null,
		busy,
		guide,
		closeGuide: () => setGuide(false),
		add,
		dismiss,
	};
}

function rowDirection(): "row" | "row-reverse" {
	// the same trick as the feed header: the first child lands on the right,
	// whether or not the web view honours the RTL flag
	return I18nManager.isRTL ? "row" : "row-reverse";
}

export function InstallSteps({ kind }: { kind: Exclude<InstallKind, "prompt"> }) {
	const t = useTheme();
	if (kind === "ios-other") {
		return <Text style={[styles.stepText, { color: t.text }]}>{OTHER_IOS}</Text>;
	}
	return (
		<View style={styles.steps}>
			{SAFARI_STEPS.map((step) => (
				<View key={step.text} style={[styles.step, { flexDirection: rowDirection() }]}>
					<Ionicons name={step.icon} size={18} color={t.text} />
					<Text style={[styles.stepText, { color: t.text, flex: 1 }]}>{step.text}</Text>
				</View>
			))}
		</View>
	);
}

function InstallGuide({ open, kind, onClose }: {
	open: boolean;
	kind: InstallKind | null;
	onClose: () => void;
}) {
	const t = useTheme();
	const steps = kind === "ios-safari" || kind === "ios-other" ? kind : null;
	return (
		<Modal isVisible={open && steps !== null} onBackdropPress={onClose} onBackButtonPress={onClose}
			backdropOpacity={0.45} style={styles.modal} useNativeDriver>
			<View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
				<Text style={[styles.title, { color: t.text }]}>{ACTION}</Text>
				{steps && <InstallSteps kind={steps} />}
				<TouchableOpacity onPress={onClose} accessibilityRole="button">
					<Text style={[styles.close, { color: t.textMuted }]}>סגירה</Text>
				</TouchableOpacity>
			</View>
		</Modal>
	);
}

/** The strip under the name. Hidden once refused, and hidden once installed. */
export function InstallBanner() {
	const t = useTheme();
	const offer = useInstallOffer();

	useEffect(() => {
		if (!offer.showBanner || offered || !offer.kind) return;
		offered = true;
		track("install_offered", { kind: offer.kind });
	}, [offer.showBanner, offer.kind]);

	if (!offer.showBanner || !offer.kind) return null;

	return (
		<>
			<View style={[styles.banner, { backgroundColor: t.surfaceAlt, borderColor: t.line }]}>
				<View style={[styles.bannerInner, { flexDirection: rowDirection() }]}>
					<TouchableOpacity
						onPress={() => offer.add("banner")}
						disabled={offer.busy}
						accessibilityRole="button"
						style={[styles.bannerButton, { backgroundColor: t.select, opacity: offer.busy ? 0.6 : 1 }]}
					>
						<Text style={[styles.bannerButtonText, { color: t.selectInk }]}>{ACTION}</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={offer.dismiss}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="סגירה"
						style={styles.bannerClose}
					>
						<Ionicons name="close" size={16} color={t.textMuted} />
					</TouchableOpacity>
				</View>
			</View>
			<InstallGuide open={offer.guide} kind={offer.kind} onClose={offer.closeGuide} />
		</>
	);
}

/** The same action, kept in the personal area after the strip has been closed. */
export function InstallRow() {
	const t = useTheme();
	const offer = useInstallOffer();
	if (!offer.showRow || !offer.kind) return null;
	const steps = offer.guide && offer.kind !== "prompt" ? offer.kind : null;

	return (
		<>
			<Text style={[styles.section, { color: t.textMuted }]}>במכשיר</Text>
			<TouchableOpacity
				style={[styles.row, { backgroundColor: t.surfaceAlt, flexDirection: rowDirection() }]}
				onPress={() => offer.add("personal")}
				disabled={offer.busy}
				accessibilityRole="button"
			>
				<Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>{ACTION}</Text>
				<Ionicons name={steps ? "chevron-up" : "chevron-back"} size={18} color={t.textMuted} />
			</TouchableOpacity>
			{steps && (
				<View style={[styles.inline, { backgroundColor: t.surfaceAlt, borderColor: t.line }]}>
					<InstallSteps kind={steps} />
				</View>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	banner: {
		marginHorizontal: 16, marginTop: 8, marginBottom: 2,
		borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
	},
	// the close sits on the card, not on the button
	bannerInner: { alignItems: "center", gap: 10 },
	bannerButton: { flex: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
	bannerClose: { padding: 4 },
	bannerButtonText: { fontFamily: "Heebo_800ExtraBold", fontSize: 13 },

	section: {
		fontFamily: "Heebo_700Bold", fontSize: 11, letterSpacing: 0.6,
		textAlign: "right", marginTop: 8,
	},
	row: { alignItems: "center", gap: 12, borderRadius: 12, padding: 13 },
	rowTitle: { fontFamily: "Heebo_700Bold", fontSize: 14, textAlign: "right" },
	inline: { borderWidth: 1, borderRadius: 12, padding: 13 },

	modal: { justifyContent: "center", alignItems: "center", margin: 20 },
	card: { width: "100%", maxWidth: 360, borderRadius: 18, borderWidth: 1, padding: 20, gap: 14 },
	title: { fontFamily: "Heebo_800ExtraBold", fontSize: 21, textAlign: "right" },
	steps: { gap: 10 },
	step: { alignItems: "center", gap: 8 },
	stepText: { fontFamily: "Heebo_400Regular", fontSize: 14, lineHeight: 20, textAlign: "right" },
	close: { fontFamily: "Heebo_500Medium", fontSize: 13, textAlign: "center", paddingTop: 2 },
});
