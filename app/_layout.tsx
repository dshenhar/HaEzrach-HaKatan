import { Stack } from 'expo-router';
import { I18nManager } from 'react-native';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

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
