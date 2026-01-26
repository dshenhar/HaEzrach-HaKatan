import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';


export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
			tabBarActiveTintColor: '#f5f5f5ff',
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
