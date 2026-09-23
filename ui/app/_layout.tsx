import {
	Heebo_400Regular,
	Heebo_500Medium,
	Heebo_700Bold,
	Heebo_800ExtraBold,
	useFonts,
} from '@expo-google-fonts/heebo';
import AccessibilityBar from '@/components/accessibilityBar';
import IntroSplash from '@/components/introSplash';
import Onboarding from '@/components/onboarding';
import QuestionnaireInvite from '@/components/questionnaireInvite';
import { QuestionnaireContext } from '@/state/questionnaire';
import { Access, AccessContext, DEFAULT_ACCESS, loadAccess, saveAccess } from '@/state/access';
import { getProfile, isNudgeOff, markWelcomed, ReaderProfile, stopNudging, wasWelcomed } from '@/state/profile';
import { ThemeProvider, useTheme } from '@/state/theme';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync();

// On the web the app still renders as a phone: the layouts, the tab bar and the
// horizontal carousels are all built for a narrow column, and letting them
// stretch across a desktop window makes the app look like a different product.
const PHONE_WIDTH = 420;

export default function RootLayout() {
	const [loaded, fontError] = useFonts({
		Heebo_400Regular,
		Heebo_500Medium,
		Heebo_700Bold,
		Heebo_800ExtraBold,
	});

	const [profile, setProfile] = useState<ReaderProfile | null>(null);
	const [profileChecked, setProfileChecked] = useState(false);
	const [introOn, setIntroOn] = useState(true);
	// the questionnaire is an overlay now, opened from wherever it is offered
	const [asking, setAsking] = useState(false);
	const [invite, setInvite] = useState<"welcome" | "reminder" | null>(null);

	useEffect(() => {
		Promise.all([getProfile(), wasWelcomed(), isNudgeOff()]).then(([p, welcomed, quiet]) => {
			setProfile(p);
			setProfileChecked(true);
			if (p) return;                       // answered already: nothing to offer
			if (!welcomed) {
				setInvite("welcome");
				markWelcomed();
			} else if (!quiet) {
				setInvite("reminder");
			}
		});
	}, []);

	// a font that fails to load falls back to the system font instead of leaving
	// the app on a blank screen
	const fontsReady = loaded || fontError !== null;

	useEffect(() => {
		if (fontsReady && profileChecked) SplashScreen.hideAsync();
	}, [fontsReady, profileChecked]);

	if (!fontsReady || !profileChecked) return null;

	// The app opens for everyone. The questionnaire is what gives every personal
	// statistic something to compare against, but standing it in the doorway asked
	// a stranger to declare themselves before seeing anything.
	const app = asking ? (
		<Onboarding onDone={(p) => { setProfile(p); setAsking(false); }} />
	) : (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="privacy" />
			<Stack.Screen name="terms" />
			<Stack.Screen name="accessibility" />
		</Stack>
	);

	// the intro plays over whatever comes first - the questionnaire or the feed -
	// and fades into it
	const shell = (
		<>
			{app}
			{introOn && <IntroSplash onDone={() => setIntroOn(false)} />}
			{/* above everything, on every screen, as the standard expects */}
			<AccessibilityBar />
			{/* only ever to someone who has not answered - see state/questionnaire.ts */}
			<QuestionnaireInvite
				open={invite !== null && !introOn && profile === null && !asking}
				variant={invite ?? "reminder"}
				onFill={() => { setInvite(null); setAsking(true); }}
				onDismiss={() => setInvite(null)}
				onNeverAgain={stopNudging}
			/>
		</>
	);

	const ask = { profile, filled: profile !== null, open: () => setAsking(true) };

	// gestures anywhere in the tree need this at the root, and swipe-between-tabs
	// is the first thing in the app that uses one
	if (Platform.OS !== 'web') {
		return (
			<GestureHandlerRootView style={styles.root}>
				<AccessProvider>
					<ThemeProvider>
						<QuestionnaireContext.Provider value={ask}>{shell}</QuestionnaireContext.Provider>
					</ThemeProvider>
				</AccessProvider>
			</GestureHandlerRootView>
		);
	}

	return (
		<AccessProvider>
			<ThemeProvider>
				<QuestionnaireContext.Provider value={ask}>
					<WebFrame>{shell}</WebFrame>
				</QuestionnaireContext.Provider>
			</ThemeProvider>
		</AccessProvider>
	);
}

/**
 * Holds what the reader asked for in the accessibility panel and remembers it.
 * On the web the text size is the page's own zoom, because nothing else reaches a
 * fixed pixel size; on a phone the operating system's setting already does.
 */
function AccessProvider({ children }: { children: React.ReactNode }) {
	const [access, setState] = useState<Access>(DEFAULT_ACCESS);

	useEffect(() => { loadAccess().then(setState); }, []);

	useEffect(() => {
		if (Platform.OS !== 'web' || typeof document === 'undefined') return;
		(document.documentElement.style as any).zoom = String(access.zoom);
	}, [access.zoom]);

	const setAccess = (next: Partial<Access>) => {
		setState((current) => {
			const merged = { ...current, ...next };
			saveAccess(merged);
			return merged;
		});
	};

	return (
		<AccessContext.Provider value={{ access, setAccess }}>{children}</AccessContext.Provider>
	);
}

function WebFrame({ children }: { children: React.ReactNode }) {
	const t = useTheme();
	const board = t.name === "negative" ? "#08080A" : "#E7E5E0";
	return (
		<View style={[styles.web, { backgroundColor: board }]}>
			<View style={[styles.frame, { backgroundColor: t.bg, borderColor: t.line }]}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	web: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: '#E7E5E0',
	},
	frame: {
		flex: 1,
		width: '100%',
		maxWidth: PHONE_WIDTH,
		backgroundColor: '#f8f8f8ff',
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderColor: '#D5D2CB',
		overflow: 'hidden',
	},
});
