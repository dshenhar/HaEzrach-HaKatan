import SwipeTabs from '@/components/swipeTabs';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

/**
 * The hot topics, to come. This tab held the map of the outlets on two topics;
 * the outlets' positions moved to the foot of the analytics page, and the tab
 * keeps its place in the row - and its route, which the swipe between tabs uses -
 * for what replaces it.
 */
export default function MapPage() {
    return (
        <SwipeTabs>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>נושאים חמים</Text>
                </View>
            </SafeAreaView>
        </SwipeTabs>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgb(255, 255, 255)', alignItems: 'center' },
    // the same title the feed and the analytics page start with
    header: { paddingHorizontal: 16, paddingTop: 10, width: "100%" },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 23, color: "#111827", textAlign: "right" },
});
