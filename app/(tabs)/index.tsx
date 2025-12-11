import { View, StyleSheet } from 'react-native';
import NewsFeed from '@/components/newsFeed';
import ToastManager from "toastify-react-native";

export default function Index() {
	return (
		<View style={styles.container}>
			<NewsFeed />
			<ToastManager />
		</View>
  );
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#ffffffff',
		alignItems: 'center',
		justifyContent: 'center',
	},
	// text: {
	//   color: '#fff',
	// },
	// button: {
	//   fontSize: 20,
	//   textDecorationLine: 'underline',
	//   color: '#fff',
	// },
});
