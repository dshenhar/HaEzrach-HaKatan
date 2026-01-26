import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react';
import { CompanyDetailType, getRanksByCompany } from '@/state/engagement';
import { Scroll } from 'lucide-react-native';
import RateBar from './ui/rateBar';
import Ionicons from '@expo/vector-icons/Ionicons';

const height = window.innerHeight;

const CompanyDetail = ({ source, setDetailSource } : { source: string, setDetailSource: (source: string) => void }) => {
    const [ranks, setRanks] = useState<CompanyDetailType[]>();

    useEffect(() => {
        const fetchRanks = async () => {
            const ranksData = await getRanksByCompany(source);
            setRanks(ranksData);
        };
        fetchRanks();
        console.log("Fetched ranks for company detail:", ranks);
    }, [source]);

  return (
    <Modal transparent style={styles.container}>
        <Pressable style={styles.overlay} onPress={() => setDetailSource("")}/>
        <View style={styles.detailContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setDetailSource("")}>
                <Ionicons name="close-circle-outline" size={40} color="#333" />
            </TouchableOpacity>
            <Text style={styles.companyName}>{source}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
                {
                    ranks ? ranks.map((rank, index) => (
                        <View key={index} style={{marginVertical: 10, paddingHorizontal: 20}}>
                            <Text style={styles.topicName}>{rank.topic}</Text>
                            <RateBar rate={(rank.bias * 10) + 50} showPrecents={true} style={styles.rateBar} />
                        </View>
                    )) : <Text>Loading...</Text>
                }
            </ScrollView>
        </View>
    </Modal>
  )
}

export default CompanyDetail

const styles = StyleSheet.create({
    container: {
    },
    overlay: {
        flex: 1,
        backgroundColor: '#676767a8',
    },
    detailContainer: {
        height: "80%",
        position: "absolute",
        bottom: 0,
        width: '100%',
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingVertical: 10,
    },
    closeButton: {
        position: "absolute",
        top: 30,
        left: 30,
        zIndex: 1,
    },
    companyName: {
        fontSize: 30,
        textAlign: "right",
        fontWeight: "bold",
        paddingRight: 38,
        paddingBottom: 10,
        paddingTop: 20,
    },
    topicName: {
        fontSize: 18,
        textAlign: "right",
        paddingRight: 20,
    },
    rateBar: {
        padding: 18,
    },
})