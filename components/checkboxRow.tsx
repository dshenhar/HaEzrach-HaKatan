import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'

// One topic draws a single axis, two draw a plane. A third has nowhere to go, so
// picking one while two are already selected replaces the older of them.
export const MAX_TOPICS = 2;

const CheckboxRow = ({ topic, selectedTopics, setSelectedTopics } : { topic: string, selectedTopics: Set<string>, setSelectedTopics: (selectedTopics: Set<string>) => void }) => {
    const checked = selectedTopics.has(topic);

    const handlePress = () => {
        const next = new Set(selectedTopics);
        if (checked) {
            next.delete(topic);
        } else {
            if (next.size >= MAX_TOPICS) {
                const oldest = Array.from(next)[0];
                next.delete(oldest);
            }
            next.add(topic);
        }
        setSelectedTopics(next);
    }

    const full = !checked && selectedTopics.size >= MAX_TOPICS;

  return (
    <View style={styles.container}>
        <TouchableOpacity
            style={[styles.checkbox, checked && styles.checkboxOn, full && styles.checkboxFull]}
            onPress={handlePress}
        >
            <Text style={[styles.label, checked && styles.labelOn]}>{topic}</Text>
        </TouchableOpacity>
    </View>
  )
}

export default CheckboxRow

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 5,
        direction: "rtl",
    },
    checkbox: {
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: "#E3E3E1",
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 8,
    },
    checkboxOn: { backgroundColor: "#111827", borderColor: "#111827" },
    checkboxFull: { opacity: 0.45 },
    label: { fontFamily: "Heebo_500Medium", fontSize: 13, color: "#111827" },
    labelOn: { fontFamily: "Heebo_700Bold", color: "#fff" }
})