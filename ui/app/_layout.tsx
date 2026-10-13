import {
	FrankRuhlLibre_400Regular, FrankRuhlLibre_500Medium, FrankRuhlLibre_700Bold, FrankRuhlLibre_900Black,
} from '@expo-google-fonts/frank-ruhl-libre';
import {
	Assistant_400Regular, Assistant_600SemiBold, Assistant_700Bold, Assistant_800ExtraBold,
} from '@expo-google-fonts/assistant';
import { ConsentProvider } from '@/state/consent';
import { rememberBloc, track, trackScreen } from '@/state/analytics';
import { QuestionnaireContext } from '@/state/questionnaire';
import { Access, AccessContext, DEFAULT_ACCESS, loadAccess, saveAccess } from '@/state/access';
import { getProfile, ReaderProfile } from '@/state/profile';
import { listenForInstall } from '@/state/install';
import { ThemeProvider } from '@/state/theme';
import { NewsProvider } from '@/site/news';
import { ReadingProvider } from '@/site/reading';
import { ChromeProvider } from '@/site/chrome';
import { useSite } from '@/site/tokens';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as loadFonts } from 'expo-font';
import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// before anything draws: the install event can arrive early
listenForInstall();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded, fontError] = useFonts();
	const [profile, setProfile] = useState<ReaderProfile | null>(null);
	const [profileChecked, setProfileChecked] = useState(false);

	useEffect(() => {
		getProfile().then((p) => { setProfile(p); setProfileChecked(true); });
	}, []);

	// a font that fails to load falls back to the system font instead of a blank page
	const fontsReady = loaded || fontError !== null;
	useEffect(() => {
		if (fontsReady && profileChecked) SplashScreen.hideAsync();
	}, [fontsReady, profileChecked]);

	// The reader's own side, kept on the device. The measurement never sends it: it
	// uses it to work out whether an article being opened is from the other side of
	// the map, and sends that - a fact about a reading rather than about a person.
	useEffect(() => { rememberBloc(profile?.bloc); }, [profile]);

	if (!fontsReady || !profileChecked) return null;

	const shell = (
		<AccessProvider>
			<ThemeProvider>
				<ConsentProvider>
					<Questionnaire profile={profile} setProfile={setProfile}>
						<NewsProvider>
							<ReadingProvider>
								<ChromeProvider>
									<Paper>
										<Stack screenOptions={{ headerShown: false, animation: "fade" }} />
									</Paper>
									<Measured />
								</ChromeProvider>
							</ReadingProvider>
						</NewsProvider>
					</Questionnaire>
				</ConsentProvider>
			</ThemeProvider>
		</AccessProvider>
	);

	// gestures anywhere in the tree need this at the root on a phone
	if (Platform.OS !== 'web') return <GestureHandlerRootView style={styles.fill}>{shell}</GestureHandlerRootView>;
	return shell;
}

function useFonts() {
	return loadFonts({
		FrankRuhlLibre_400Regular, FrankRuhlLibre_500Medium, FrankRuhlLibre_700Bold, FrankRuhlLibre_900Black,
		Assistant_400Regular, Assistant_600SemiBold, Assistant_700Bold, Assistant_800ExtraBold,
	});
}

/** the paper under every page, and the browser's own surfaces in its inks */
function Paper({ children }: { children: React.ReactNode }) {
	const { c } = useSite();
	useEffect(() => {
		if (Platform.OS !== 'web' || typeof document === 'undefined') return;
		document.body.style.backgroundColor = c.paper;
		const meta = document.querySelector('meta[name="theme-color"]');
		meta?.setAttribute('content', c.paper);
		let style = document.getElementById('paper-surfaces');
		if (!style) {
			style = document.createElement('style');
			style.id = 'paper-surfaces';
			document.head.appendChild(style);
		}
		// the parts of the page nobody draws: a selection, the focus ring, the scrollbar
		style.textContent = `
			::selection { background: ${c.mark}; color: ${c.ink}; }
			:focus-visible { outline: 2px solid ${c.ink}; outline-offset: 2px; }
			* { scrollbar-width: thin; scrollbar-color: ${c.rule} transparent; }
			a { -webkit-tap-highlight-color: transparent; }
		`;
	}, [c]);
	return <View style={[styles.fill, { backgroundColor: c.paper }]}>{children}</View>;
}

/** the questionnaire, reachable from any page; answering it changes what the site can say */
function Questionnaire({ profile, setProfile, children }: {
	profile: ReaderProfile | null;
	setProfile: (p: ReaderProfile | null) => void;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const value = {
		profile,
		filled: profile !== null,
		open: () => router.push('/questionnaire'),
		answered: (p: ReaderProfile | null) => {
			if (p) track("questionnaire_completed", { bloc: p.bloc });
			setProfile(p);
		},
	};
	return <QuestionnaireContext.Provider value={value}>{children}</QuestionnaireContext.Provider>;
}

/**
 * The two things measured from the root: which page is open, and anything that
 * throws while it is.
 */
function Measured() {
	const path = usePathname();
	useEffect(() => { trackScreen(path === "/" ? "front" : path.replace(/^\//, "").split("/")[0]); }, [path]);
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

const styles = StyleSheet.create({
	fill: { flex: 1 },
});
