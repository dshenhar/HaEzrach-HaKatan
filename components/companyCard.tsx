import { Dimensions, StyleSheet, Text, View } from 'react-native'
import React, { useContext } from 'react'
import { CompanyItem } from '@/state/engagement'
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { topicsContext } from '@/app/(tabs)/mapPage';
import { RadarChart } from "react-native-gifted-charts";

type props = {
    item: CompanyItem;
    index: number;
    scrollX: SharedValue<number>;
    scrollY: SharedValue<number>;
    carouselLen: number;
}
const width = Dimensions.get("screen").width + 10;
const height = Dimensions.get("screen").height;
console.log("width: ", width);
console.log("height: ", height);

const CompanyCard = ({ item, index, scrollX, scrollY, carouselLen } : props) => {
    const rnAnimatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index-7) * width, 
            (index-6) * width, 
            (index-5) * width, 
            (index-4) * width, 
            (index-3) * width, 
            (index-2) * width, 
            (index-1) * width, 
            index * width, 
            (index+1) * width, 
            (index+2) * width, 
            (index+3) * width, 
            (index+4) * width, 
            (index+5) * width, 
            (index+6) * width, 
            (index+7) * width, 
            (index+8) * width, 
            (index+9) * width]
        const zIndexFloat = interpolate (
            scrollX.value,
            inputRange,
            [8, 6, 4, 2, 4, 6, 8, 10, 8, 6, 4, 2, 4, 6, 8, 6, 4],
            Extrapolation.CLAMP
        );

        // console.log("zindexFloat: ", zIndexFloat);
        const zIndex = Math.round(zIndexFloat);
        // console.log("zindex: ", zIndex);

        return {
            transform: [
                {
                    translateX: interpolate (
                        scrollX.value,
                        inputRange,
                        [
                            -width * 7.2, 
                            -width * 6.4, 
                            -width * 5.2, 
                            -width * 4, 
                            -width * 2.8, 
                            -width * 1.6, 
                            -width * 0.8, 
                            0, 
                            width * 0.8, 
                            width * 1.6, 
                            width * 2.8, 
                            width * 4, 
                            width * 5.2, 
                            width * 6.4, 
                            width * 7.2,
                            width * 8,
                            width * 8.8],
                        Extrapolation.CLAMP
                    )
                },
                {
                    translateY: interpolate (
                        scrollX.value,
                        inputRange,
                        [
                            scrollY.value-30, 
                            scrollY.value-60, 
                            scrollY.value-90, 
                            scrollY.value-120, 
                            scrollY.value-90, 
                            scrollY.value-60, 
                            scrollY.value-30, 
                            scrollY.value, 
                            scrollY.value-30, 
                            scrollY.value-60, 
                            scrollY.value-90, 
                            scrollY.value-120, 
                            scrollY.value-90, 
                            scrollY.value-60, 
                            scrollY.value-30,
                            scrollY.value-30,
                            scrollY.value-30],
                        Extrapolation.CLAMP
                    )
                },
                {
                    scale: interpolate (
                        scrollX.value,
                        inputRange,
                        [0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 1, 0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 0.8, 0.7],
                        Extrapolation.CLAMP
                    ),
                },
                {perspective: 1000}
            ],
            zIndex: zIndex,
            elevation: zIndex
        }
    })

    console.log(index);
    const topics = useContext(topicsContext)
    return (
        <Animated.View style={[styles.companyCard, rnAnimatedStyle]}>
            <View style={styles.innerCard}>
                <View style={styles.chartContainer}>
                    <RadarChart 
                        data={item.ranks} 
                        labels={topics}
                        maxValue={10}
                        
                    />
                </View>
                <Text>this is the company card: {item.source}</Text>
            </View>
        </Animated.View>
    )
}

export default CompanyCard

const styles = StyleSheet.create({
    companyCard: {
        // height: "100%",
        alignItems: "center",
        justifyContent: "center",
        // backgroundColor: "#a57272ff",
        // borderRadius: 15,
        // borderWidth: 1,
        gap: 20,
        width: width,
        overflow: "visible",
        // position: "absolute"
        // marginHorizontal: 20,
    },
    innerCard: {
        width: 250,
        height: 400,
        borderWidth: 1,
        borderRadius: 15,
        backgroundColor: "#d6d3d3ff",
        // justifyContent: "center",
        alignItems: "center",
    },
    chartContainer: {
        // borderWidth: 2,
        transform: [
            {
                scale: 0.9
            }
        ],
        marginTop: -30
        // flex: 1
    }
})