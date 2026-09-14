import SwipeTabs from '@/components/swipeTabs';
import CompaniesFilter from '@/components/companiesFilter';
import OutletDetail from '@/components/outletDetail';
import TopicAxis from '@/components/topicAxis';
import TopicQuadrant from '@/components/topicQuadrant';
import { CompanyItem, getTopics, getSites, getRanksByTopic, getTopicPoles, TopicPoles } from '@/state/engagement';
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
    const [poles, setPoles] = useState<TopicPoles>({});
    
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
        getTopicPoles().then(setPoles);
    }, []);

    useEffect(() => {
        // Deliberately two topics from different families. Two topics from the
        // same one (both territory, say) rank the outlets almost identically, so
        // the plane collapses into a diagonal line and shows nothing.
        if (topics && topics.length >= 2 && selectedTopics.size === 0) {
            const preferred = ["בנייה בהתנחלויות", "כלכלה"].filter((t) => topics.includes(t));
            setSelectedTopics(new Set(preferred.length === 2 ? preferred : topics.slice(0, 2)));
        }
    }, [topics]);

    useEffect(() => {
        if (detailSource) return;
        const first = Array.from(carouselData.values())[0];
        if (first && first.length) {
            // the most right-leaning outlet, just so the panel opens on something
            // rather than on whatever the query happened to return first
            const pick = [...first].sort((a, b) => b.bias - a.bias)[0];
            setDetailSource(pick.source);
        }
    }, [carouselData]);

    useEffect(() => {
        topics?.forEach(async (topic) => {
            if (selectedTopics.has(topic) && !carouselData.get(topic)) {
                const ranks = await getRanksByTopic(topic);
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
        <SwipeTabs>
            <SafeAreaView style={styles.container}>
                {open && <CompaniesFilter topics={topics || []} selectedTopics={selectedTopics} setSelectedTopics={setSelectedTopics} setOpen={setOpen} />}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.title}>אנחנו על המפה</Text>
                        <TouchableOpacity onPress={handleOpenFilter} hitSlop={10}>
                            <Ionicons name="search-circle-outline" size={30} color="#111827" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>
                        כאן תוכלו לראות את העיתונות השונה ועמדותיה לגבי נושאים שונים.{"\n"}
                        לבחירת נושאים לחצו על אייקון החיפוש (🔍)
                    </Text>
                </View>

                <View style={styles.chartArea}>
                    {selectedTopics.size == 0 ? <Text style={{textAlign: "center", marginTop: 20, fontSize: 15, fontFamily: "Heebo_400Regular", color: "#6B7280"}}>לא נבחרו נושאים</Text> : null}
                {
                    (() => {
                        const entries = Array.from(carouselData.entries());
                        // two topics become a plane; one stays a single axis
                        if (entries.length === 2) {
                            const [[topicX, dataX], [topicY, dataY]] = entries;
                            return <TopicQuadrant poles={poles} topicX={topicX} dataX={dataX}
                                topicY={topicY} dataY={dataY} setDetailSource={setDetailSource}
                                selected={detailSource} />;
                        }
                        return entries.map(([topic, data], index) => (
                            <TopicAxis key={index} poles={poles} topic={topic} data={data}
                                setDetailSource={setDetailSource} selected={detailSource} />
                        ));
                    })()
                }
                </View>

                {!!detailSource && (
                    <View style={styles.detailArea}>
                        <OutletDetail source={detailSource} poles={poles} />
                    </View>
                )}
            </SafeAreaView>
        </SwipeTabs>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgb(255, 255, 255)',
        alignItems: 'center',
    },
    // same shape as the feed and the analytics page: title with its control on
    // the same line, explanatory line under it
    header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, width: "100%", gap: 2 },
    headerTop: {
        flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10,
    },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 23, color: "#111827", textAlign: "right" },
    subtitle: {
        // sized so each sentence holds one line at the phone width
        fontFamily: "Heebo_400Regular", fontSize: 12.5, lineHeight: 19,
        color: "#6B7280", textAlign: "right",
    },
    chartArea: { width: "100%" },
    detailArea: { flex: 1, width: "100%", paddingBottom: 8, minHeight: 220 },
    text: {
        color: '#fff',
        margin: 20
    },
});
