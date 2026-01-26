import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

export default function RateBar ({ rate, showPrecents, style } : { rate: number, showPrecents: boolean, style?: any }) {
    return (
        <View style={[styles.container, style]}>
            {showPrecents && <Text style={{position: 'absolute', right: 30, alignSelf: "center", zIndex: 1, color: '#000000', fontWeight: 'bold'}}>{rate}%</Text>}
            <View style={{width: `${Math.round(rate)}%`, backgroundColor: '#7987FA', alignSelf: "flex-start", padding: rate > 0 ? style.padding : 0}}></View>
            <View style={{width: `${100-Math.round(rate)}%`, backgroundColor: '#FFA288', alignSelf: "flex-end", padding: rate < 100 ? style.padding : 0}}></View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
    }
})