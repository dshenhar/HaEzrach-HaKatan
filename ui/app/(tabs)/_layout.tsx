import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { glass, SETTLE } from '@/state/craft';


export default function TabLayout() {
	// Thinner than the stock 49pt bar plus the whole home-indicator inset, so it
	// sits lower and the feed gets the room. The icons still clear the indicator.
	const insets = useSafeAreaInsets();
	const bottomPad = Math.max(insets.bottom - 14, 0);
	const t = useTheme();
	const dark = t.name === "negative";
	// The bar is a translucent layer with the feed running underneath it rather
	// than a solid strip the feed stops at. The bright top edge is the light
	// catching the near side of the material; without it the layer reads as a tint.
	// Floating, so the feed runs underneath it: a translucent bar with nothing
	// passing behind it is a tinted strip pretending to be glass. Every screen in
	// here leaves room at its foot for the bar to stand on.
	const material = Platform.OS === "web" && t.name !== "contrast"
		? { ...glass(dark), borderTopWidth: 1, position: "absolute" as const, left: 0, right: 0, bottom: 0 }
		: { backgroundColor: dark ? "#16161A" : "#2C2C2E" };
	return (
		<Tabs
			screenOptions={{
			tabBarActiveTintColor: t.name === "contrast" ? '#FFFFFF'
				: Platform.OS === "web" ? (dark ? '#F2F2F0' : '#111827') : '#f5f5f5ff',
			// no inactive colour was set, so it fell back to the default dark grey -
			// which on a #3E3E3E bar is all but invisible. This reads clearly and is
			// still plainly dimmer than the active icon.
			tabBarInactiveTintColor: Platform.OS === "web" && t.name !== "contrast"
				? (dark ? 'rgba(242,242,240,0.45)' : 'rgba(17,24,39,0.38)')
				: '#A6A6A6',
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
				borderTopColor: "transparent", elevation: 0, ...material,
			}
			}}
		>
			<Tabs.Screen
			name="mapPage"
			options={{
				title: 'Map',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={24}/>
				),
			}}
			/>
			<Tabs.Screen
			name="index"
			options={{
				title: '360',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
				),
			}}
			/>
			<Tabs.Screen
			name="analyticsPage"
			options={{
				title: 'Analytics',
				tabBarIcon: ({ color, focused }) => (
				<Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} size={24} />
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
