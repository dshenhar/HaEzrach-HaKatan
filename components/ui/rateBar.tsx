import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

export default function RateBar ({ rate } : { rate: number }) {
    return (
        <View style={styles.container}>
            <View style={{width: `${rate}%`, backgroundColor: '#7987FA', alignSelf: "flex-start", padding: rate > 0 ? 3 : 0}}></View>
            <View style={{width: `${100-rate}%`, backgroundColor: '#FFA288', alignSelf: "flex-end", padding: rate < 100 ? 3 : 0}}></View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
    }
})