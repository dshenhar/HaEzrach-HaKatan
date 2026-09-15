import {
	Heebo_400Regular,
	Heebo_500Medium,
	Heebo_700Bold,
	Heebo_800ExtraBold,
	useFonts,
} from '@expo-google-fonts/heebo';
import IntroSplash from '@/components/introSplash';
import Onboarding from '@/components/onboarding';
import { getProfile, ReaderProfile } from '@/state/profile';
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
	const [loaded] = useFonts({
		Heebo_400Regular,
		Heebo_500Medium,
		Heebo_700Bold,
		Heebo_800ExtraBold,
	});

	const [profile, setProfile] = useState<ReaderProfile | null>(null);
	const [profileChecked, setProfileChecked] = useState(false);
	const [introOn, setIntroOn] = useState(true);

	useEffect(() => {
		getProfile().then((p) => { setProfile(p); setProfileChecked(true); });
	}, []);

	useEffect(() => {
		if (loaded && profileChecked) SplashScreen.hideAsync();
	}, [loaded, profileChecked]);

	if (!loaded || !profileChecked) return null;

	// the questionnaire is what gives every personal statistic something to
	// compare against, so it runs before the app rather than inside settings
	const app = profile === null ? (
		<Onboarding onDone={setProfile} />
	) : (
		<Stack screenOptions={{ headerStyle: { backgroundColor: "#3c3e75ff" } }}>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
		</Stack>
	);

	// the intro plays over whatever comes first - the questionnaire or the feed -
	// and fades into it
	const shell = (
		<>
			{app}
			{introOn && <IntroSplash onDone={() => setIntroOn(false)} />}
		</>
	);

	// gestures anywhere in the tree need this at the root, and swipe-between-tabs
	// is the first thing in the app that uses one
	if (Platform.OS !== 'web') {
		return (
			<GestureHandlerRootView style={styles.root}>
				<ThemeProvider>{shell}</ThemeProvider>
			</GestureHandlerRootView>
		);
	}

	return (
		<ThemeProvider>
			<WebFrame>{shell}</WebFrame>
		</ThemeProvider>
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
