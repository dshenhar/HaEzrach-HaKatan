import MapCarousel from '@/components/mapCarousel';
import { CompanyItem } from '@/state/engagement';
import { createContext } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const topicsContext = createContext<string[] | undefined>(undefined);


export default function MapPage() {
    const companies: CompanyItem[] = [
        {
            source: "abba",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "love",
            ranks: [1, 5, 4, 6, 3, 8]

        },
        {
            source: "hi",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "this",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "more",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "of",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "kind",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        {
            source: "leaf",
            ranks: [1, 5, 4, 6, 3, 8]
        },
        // {
        //     source: "leaf1",
        //     ranks: [1, 5, 4, 6, 3, 8]
        // },
        // {
        //     source: "leaf2",
        //     ranks: [1, 5, 4, 6, 3, 8]
        // },
        // {
        //     source: "leaf3",
        //     ranks: [1, 5, 4, 6, 3, 8]
        // },
        // {
        //     source: "dummy",
        //     ranks: [1, 5, 4, 6, 3, 8]
        // }
    ]
    const topics = ["a", "b", "c", "d", "e", "f"];

    return (
        <SafeAreaView style={styles.container}>
            <topicsContext.Provider value={topics}>
                <MapCarousel data={companies} />
            </topicsContext.Provider>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dddfe1ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        margin: 20
    },
    pacman: {
        width: 50,
        height: 50
    }
});
