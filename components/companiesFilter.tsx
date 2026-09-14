import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import React from 'react'
import CheckboxRow from './checkboxRow'

const CompaniesFilter = ({ topics, selectedTopics, setSelectedTopics, setOpen } : { topics: string[], selectedTopics: Set<string>, setSelectedTopics: (selectedTopics: Set<string>) => void, setOpen: (open: boolean) => void }) => {
    const { height } = useWindowDimensions();
    const handlePress = () => {
        setOpen(false);
    }
  return (
      <View style={styles.container}>
        <Pressable style={styles.overlay} onPress={handlePress} />
        <ScrollView style={[styles.filterContainer, { height }]}>
            <Text style={styles.sheetTitle}>סדר לפי...</Text>
            {topics.map((topic, index) => (
                <CheckboxRow key={index} topic={topic} selectedTopics={selectedTopics} setSelectedTopics={setSelectedTopics} />
            ))}
        </ScrollView>
    </View>
  )
}

export default CompaniesFilter

const styles = StyleSheet.create({
    sheetTitle: {
        fontFamily: "Heebo_800ExtraBold", fontSize: 22, color: "#111827",
        textAlign: "right", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
    },
    container: {
        flex: 1,
        height: "112%",
        width: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 10,
        // backgroundColor: "#7e4e4e5d"
    },
    overlay: {
        flex: 1,
        backgroundColor: "#00000080",
        // width: "100%",
        // height: "100%",
        // zIndex: 0,
    },
    filterContainer: {
        flex: 1,
        width: "60%",
        backgroundColor: "#ffffff",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        borderBottomRightRadius: 10,
        borderTopRightRadius: 10,
        padding: 20,
        // direction: "rtl",
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 20,
        borderBottomLeftRadius: 10,
    },
})