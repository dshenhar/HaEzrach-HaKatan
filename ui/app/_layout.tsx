import {
	Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, Rubik_900Black,
} from '@expo-google-fonts/rubik';
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
import { BOARD, PHONE, useSite } from '@/site/tokens';
import { Mark } from '@/site/meter';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as loadFonts } from 'expo-font';
import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
				<Phone>
					<ConsentProvider>
						<Questionnaire profile={profile} setProfile={setProfile}>
							<NewsProvider>
								<ReadingProvider>
									<ChromeProvider>
										<Stack screenOptions={{ headerShown: false, animation: "slide_from_left" }} />
										<Measured />
									</ChromeProvider>
								</ReadingProvider>
							</NewsProvider>
						</Questionnaire>
					</ConsentProvider>
				</Phone>
			</ThemeProvider>
		</AccessProvider>
	);

	// gestures anywhere in the tree need this at the root on a phone
	if (Platform.OS !== 'web') return <GestureHandlerRootView style={styles.fill}>{shell}</GestureHandlerRootView>;
	return shell;
}

function useFonts() {
	return loadFonts({
		Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, Rubik_900Black,
	});
}

/**
 * The app is a phone app. On a phone it is the whole screen; on anything wider
 * it stands as a phone in the middle of it, on a deep ground, with its name
 * beside it when there is room - the same app, not a stretched one.
 */
function Phone({ children }: { children: React.ReactNode }) {
	const { c, framed, theme } = useSite();
	const { width, height } = useWindowDimensions();
	const board = BOARD[theme] ?? BOARD.light;
	useEffect(() => {
		if (Platform.OS !== 'web' || typeof document === 'undefined') return;
		document.body.style.backgroundColor = framed ? board : c.bg;
		let style = document.getElementById('app-surfaces');
		if (!style) {
			style = document.createElement('style');
			style.id = 'app-surfaces';
			document.head.appendChild(style);
		}
		// the parts of the page nobody draws: a selection, the focus ring, the scrollbar
		style.textContent = `
			::selection { background: ${c.hi}; color: ${c.hiInk}; }
			:focus-visible { outline: 2px solid ${c.brand}; outline-offset: 2px; }
			input:focus-visible, textarea:focus-visible { outline: none; }
			* { scrollbar-width: none; }
			a { -webkit-tap-highlight-color: transparent; }
		`;
	}, [c, framed, board]);

	if (!framed) return <View style={[styles.fill, { backgroundColor: c.bg }]}>{children}</View>;
	const tall = Math.min(height - 48, 940);
	return (
		<View style={[styles.board, { backgroundColor: board }]}>
			{width > PHONE + 520 && (
				<View style={styles.beside} accessible={false}>
					<View style={styles.besideName}>
						<Mark size={34} />
						<Text style={styles.besideTitle}>האזרח הקטן</Text>
					</View>
					<Text style={styles.besideLine}>כל החדשות, משני צדי המפה.</Text>
					<Text style={styles.besideSmall}>האפליקציה בנויה לטלפון. פתחו את הכתובת בטלפון, והיא תמלא את כל המסך.</Text>
				</View>
			)}
			<View style={[styles.phone, { width: PHONE, height: tall, backgroundColor: c.bg }]}>{children}</View>
		</View>
	);
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
	board: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 72 },
	phone: {
		borderRadius: 44, overflow: 'hidden', borderWidth: 10, borderColor: '#0A0A10',
		boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
	},
	beside: { width: 300, gap: 14 },
	besideName: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
	besideTitle: { fontFamily: 'Rubik_900Black', fontSize: 34, lineHeight: 40, color: '#FFFFFF', letterSpacing: -0.6 },
	besideLine: { fontFamily: 'Rubik_600SemiBold', fontSize: 20, lineHeight: 28, color: '#FFFFFF', textAlign: 'right', writingDirection: 'rtl' },
	besideSmall: { fontFamily: 'Rubik_400Regular', fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.72)', textAlign: 'right', writingDirection: 'rtl' },
});
