import { Stack } from 'expo-router';

export default function RootLayout() {
	return (
		<Stack screenOptions={{
			headerStyle: {
				backgroundColor: "#3c3e75ff"
			}
		}}>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
		</Stack>
	);
}
