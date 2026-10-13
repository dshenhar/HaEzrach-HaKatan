import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isIos } from '@/state/install';
import { useTheme } from '@/state/theme';
import { useSkin } from '@/state/direction';
import { SETTLE } from '@/state/craft';


export default function TabLayout() {
	// Thinner than the stock 49pt bar plus the whole home-indicator inset, so it
	// sits lower and the feed gets the room. The icons still clear the indicator.
	const insets = useSafeAreaInsets();
	// iOS PWA without viewport-fit=cover (and briefly after adding it) reads 0 here;
	// use the usual home-indicator inset so the icons clear the bar.
	const iosWeb = Platform.OS === 'web' && isIos();
	const bottomInset = insets.bottom > 0
		? insets.bottom
		: iosWeb ? 38 : 0;
	// iOS PWA: keep more of the safe-area inset so the icons sit clearly above the home bar.
	const bottomPad = Math.max(bottomInset - (iosWeb ? 4 : 14), 0);
	const tabIconSize = Platform.OS === 'web' ? 28 : 24;
	const t = useTheme();
	const dark = t.name === "negative";
	// Each world's bar: the booth's black band, the page's foot under a rule, the
	// concourse's black strip where the tab you are on is lit in sign yellow.
	const skin = useSkin();
	const page = skin.name === "daf";
	const material = page
		? { backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.text }
		: { backgroundColor: skin.name === "sign" ? (dark ? "#000000" : "#0F0F0F") : t.brand,
			borderTopWidth: 1, borderTopColor: dark ? "#2A2A2A" : "#000000" };
	return (
		<Tabs
			screenOptions={{
			tabBarActiveTintColor: page ? t.text : skin.name === "sign" ? "#FFC800" : "#FFFFFF",
			tabBarInactiveTintColor: page ? t.textMuted : "rgba(255,255,255,0.5)",
			headerShown: false,
			tabBarShowLabel: false,
			// They are three screens side by side, so the move between them is
			// sideways: the outgoing one leaves the way the incoming one arrives, and
			// which direction tells you where you are in the row.
			animation: 'shift',
			transitionSpec: {
				animation: 'spring',
				config: { mass: SETTLE.mass, stiffness: SETTLE.stiffness, damping: SETTLE.damping },
			},
			tabBarStyle: {
				height: 44 + bottomPad, paddingTop: 6, paddingBottom: bottomPad,
				elevation: 0, ...material,
			}
			}}
		>
			<Tabs.Screen
			name="mapPage"
			options={{
				title: 'נושאים חמים',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'flame' : 'flame-outline'} color={color} size={tabIconSize}/>
				),
			}}
			/>
			<Tabs.Screen
			name="index"
			options={{
				title: '360',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={tabIconSize} />
				),
			}}
			/>
			<Tabs.Screen
			name="analyticsPage"
			options={{
				title: 'Analytics',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} size={tabIconSize} />
				),
			}}
			/>
			{/* <Tabs.Screen
			name="profilePage"
			options={{
				title: 'Profile',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={24} />
				),
			}}
			/> */}
		</Tabs>
	);
}
