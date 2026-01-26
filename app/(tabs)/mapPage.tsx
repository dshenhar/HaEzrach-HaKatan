import CompaniesFilter from '@/components/companiesFilter';
import CompanyDetail from '@/components/companyDetail';
import MapCarousel from '@/components/mapCarousel';
import { CompanyItem, getTopics, getSites, getRanks } from '@/state/engagement';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useState, useEffect } from 'react';
import { Text, View, StyleSheet, ActivityIndicator, I18nManager, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
 
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function MapPage() {
    const [topics, setTopics] = useState<string[]>();
    const [sites, setSites] = useState<string[]>();
    const [carouselData, setCarouselData] = useState<Map<string, CompanyItem[]>>(new Map());
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set([]));
    const [open, setOpen] = useState<boolean>(false);
    const [detailSource, setDetailSource] = useState<string>("");
    
    useEffect(() => {
        const fetchTopics = async () => {
            const topicsData = await getTopics();
            setTopics(topicsData);
        };
        const fetchSites = async () => {
            const sitesData = await getSites();
            setSites(sitesData);
        };
        fetchTopics();
        fetchSites();
    }, []);

    useEffect(() => {
        topics?.forEach(async (topic) => {
            if (selectedTopics.has(topic) && !carouselData.get(topic)) {
                const ranks = await getRanks(topic);
                setCarouselData((prev) => new Map(prev).set(topic, ranks));
            }
            if (!selectedTopics.has(topic) && carouselData.get(topic)) {
                setCarouselData((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(topic);
                    return newMap;
                });
            }
        })
    }, [selectedTopics]);

    const handleOpenFilter = () => {
        setOpen(true);
    }

    return (
        <SafeAreaView style={styles.container}>
            {open && <CompaniesFilter topics={topics || []} selectedTopics={selectedTopics} setSelectedTopics={setSelectedTopics} setOpen={setOpen} />}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>כמה אחוז יש לך?</Text>
                <TouchableOpacity style={{position: "absolute", left: 20, alignSelf: "flex-start"}} onPress={handleOpenFilter}>
                    <Ionicons name="add-circle-outline" size={50} color="#000000"></Ionicons>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {selectedTopics.size == 0 ? <Text style={{textAlign: "center", marginTop: 20, fontSize: 16}}>לחץ על הפלוס כדי לבחור נושאים להצגה</Text> : null}
            {
                Array.from(carouselData.entries()).map(([topic, data], index) => (
                    <MapCarousel key={index} data={data} topic={topic} setDetailSource={setDetailSource} />
                ))
            }
            </ScrollView>
            {
                detailSource != "" &&
                <CompanyDetail source={detailSource} setDetailSource={setDetailSource} />
            }
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgb(255, 255, 255)',
        alignItems: 'center',
    },
    headerContainer: {
        marginVertical: 10,
        width: '100%',
        alignSelf: "flex-end",
        flexDirection: "row",
        alignItems: "center",
        alignContent: "space-between",
        justifyContent: "flex-end",
    },
    header: {
        width: '60%',
        fontSize: 50,
        direction: "rtl",
        textAlign: "left",
        paddingRight: 30,
    },
    scrollView: {
        width: '100%',
        flex: 1,
        marginBottom: -40,
    },
    text: {
        color: '#fff',
        margin: 20
    },
});
