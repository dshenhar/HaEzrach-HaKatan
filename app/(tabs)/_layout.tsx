import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';


export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
			tabBarActiveTintColor: '#f5f5f5ff',
			// no inactive colour was set, so it fell back to the default dark grey -
			// which on a #3E3E3E bar is all but invisible. This reads clearly and is
			// still plainly dimmer than the active icon.
			tabBarInactiveTintColor: '#A6A6A6',
			headerShown: false,
			tabBarShowLabel: false,
			tabBarStyle: { paddingTop: 10, backgroundColor: "#3E3E3E" }
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
