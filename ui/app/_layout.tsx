import {
	Heebo_400Regular,
	Heebo_500Medium,
	Heebo_700Bold,
	Heebo_800ExtraBold,
	useFonts,
} from '@expo-google-fonts/heebo';
import AccessibilityBar from '@/components/accessibilityBar';
import { ConsentProvider } from '@/state/consent';
import { rememberBloc, track, trackScreen } from '@/state/analytics';
import IntroSplash from '@/components/introSplash';
import Onboarding from '@/components/onboarding';
import QuestionnaireInvite from '@/components/questionnaireInvite';
import { QuestionnaireContext } from '@/state/questionnaire';
import { ArrivalTour } from '@/state/tour';
import { Access, AccessContext, DEFAULT_ACCESS, loadAccess, saveAccess } from '@/state/access';
import { getProfile, isNudgeOff, markWelcomed, ReaderProfile, stopNudging, wasWelcomed } from '@/state/profile';
import { listenForInstall } from '@/state/install';
import { ThemeProvider, useTheme } from '@/state/theme';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// before the splash: the install event can arrive while it is still covering the feed
listenForInstall();

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
	// a first visit: the feed opens on the tour, which ends with the questionnaire
	const [arrival, setArrival] = useState(false);

	useEffect(() => {
		Promise.all([getProfile(), wasWelcomed(), isNudgeOff()]).then(([p, welcomed, quiet]) => {
			setProfile(p);
			setProfileChecked(true);
			if (p) return;                       // answered already: nothing to offer
			if (!welcomed) {
				setArrival(true);
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

	// The reader's own side, kept on the device. The measurement never sends it: it
	// uses it to work out whether a story being opened is from the other side of
	// the map, and sends that - a fact about a reading rather than about a person.
	useEffect(() => { rememberBloc(profile?.bloc); }, [profile]);

	if (!fontsReady || !profileChecked) return null;

	// The app opens for everyone. The questionnaire is what gives every personal
	// statistic something to compare against, but standing it in the doorway asked
	// a stranger to declare themselves before seeing anything.
	const app = asking ? (
		<Onboarding onDone={(p) => {
			track("questionnaire_completed", { bloc: p?.bloc });
			setProfile(p);
			setAsking(false);
		}} />
	) : (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="privacy" />
			<Stack.Screen name="terms" />
			<Stack.Screen name="accessibility" />
			<Stack.Screen name="methodology" />
			<Stack.Screen name="blind" />
		</Stack>
	);

	// the intro plays over whatever comes first - the questionnaire or the feed -
	// and fades into it
	const shell = (
		<>
			<ArrivalTour.Provider
				value={{ due: arrival && !introOn && !asking, done: () => setArrival(false) }}>
				{app}
			</ArrivalTour.Provider>
			{introOn && <IntroSplash onDone={() => setIntroOn(false)} />}
			{/* above everything, on every screen, as the standard expects */}
			<AccessibilityBar />
			<Measured />
			{/* only ever to someone who has not answered - see state/questionnaire.ts */}
			<QuestionnaireInvite
				open={invite !== null && !introOn && profile === null && !asking}
				variant={invite ?? "reminder"}
				onFill={() => { track("questionnaire_opened", { from: invite ?? "" }); setInvite(null); setAsking(true); }}
				onDismiss={() => { track("questionnaire_skipped", { from: invite ?? "" }); setInvite(null); }}
				onNeverAgain={() => { track("questionnaire_silenced"); stopNudging(); }}
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
						<ConsentProvider>
							<QuestionnaireContext.Provider value={ask}>{shell}</QuestionnaireContext.Provider>
						</ConsentProvider>
					</ThemeProvider>
				</AccessProvider>
			</GestureHandlerRootView>
		);
	}

	return (
		<AccessProvider>
			<ThemeProvider>
				<ConsentProvider>
					<QuestionnaireContext.Provider value={ask}>
						<WebFrame>{shell}</WebFrame>
					</QuestionnaireContext.Provider>
				</ConsentProvider>
			</ThemeProvider>
		</AccessProvider>
	);
}

/**
 * The two things measured from the root: which screen is open, and anything that
 * throws while it is. An error nobody reports is an error nobody fixes - two of
 * the faults found this month arrived as screenshots from one reader.
 */
function Measured() {
	const path = usePathname();
	useEffect(() => { trackScreen(path === "/" ? "feed" : path.replace(/^\//, "")); }, [path]);
	useEffect(() => {
		if (Platform.OS !== "web" || typeof window === "undefined") return;
		const broke = (event: ErrorEvent) => track("app_error", {
			where: (event.filename || "").split("/").pop()?.slice(0, 60),
			message: String(event.message || "").slice(0, 100),
		});
		const unhandled = (event: PromiseRejectionEvent) => track("app_error", {
			where: "promise",
			message: String(event.reason).slice(0, 100),
		});
		window.addEventListener("error", broke);
		window.addEventListener("unhandledrejection", unhandled);
		return () => {
			window.removeEventListener("error", broke);
			window.removeEventListener("unhandledrejection", unhandled);
		};
	}, []);
	return null;
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
