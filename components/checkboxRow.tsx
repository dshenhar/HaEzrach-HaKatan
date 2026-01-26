import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'

const CheckboxRow = ({ topic, selectedTopics, setSelectedTopics } : { topic: string, selectedTopics: Set<string>, setSelectedTopics: (selectedTopics: Set<string>) => void }) => {
    const [checked, setChecked] = React.useState<boolean>(selectedTopics.has(topic));

    const handlePress = () => {
        const newSelectedTopics = new Set(selectedTopics);
        if (checked) {
            newSelectedTopics.delete(topic);
            setChecked(false);
        } else {
            newSelectedTopics.add(topic);
            setChecked(true);
        }
        setSelectedTopics(newSelectedTopics);
    }

  return (
    <View style={styles.container}>
        <TouchableOpacity style={[styles.checkbox, {backgroundColor: checked ? "#878787bf" : "white"}]} onPress={handlePress}>
            <Text>{topic}</Text>
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
        borderRadius: 20,
        padding: 8,
    }
})