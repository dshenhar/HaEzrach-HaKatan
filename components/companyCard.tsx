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
    carouselLen: number;
}
const width = Dimensions.get("screen").width;
const height = Dimensions.get("screen").height;
console.log("width: ", width);
console.log("height: ", height);

const CompanyCard = ({ item, index, scrollX, carouselLen } : props) => {
    const angleStep = (2 * Math.PI) / 10;
    const currentAngle = scrollX.value + 1.2 * angleStep;
    const RADIUS = width * 0.8

    const rnAnimatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index-1) * width, 
            index * width, 
            (index+1) * width]

        const zIndexFloat = interpolate (
            scrollX.value,
            inputRange,
            [-1, 0, -1],
            Extrapolation.CLAMP
        );

        // console.log("zindexFloat: ", zIndexFloat);
        const zIndex = Math.round(zIndexFloat);
        // console.log("zindex: ", zIndex);
        const x = RADIUS * Math.sin(currentAngle)
        return {
            transform: [
                {
                    translateX: interpolate (
                        scrollX.value,
                        inputRange,
                        [
                            -width * 0.574, 
                            0, 
                            width * 0.574], 
                        Extrapolation.CLAMP
                    )
                },
                {
                    rotateY: `${interpolate (
                        scrollX.value,
                        inputRange,
                        [-currentAngle, 0, currentAngle],
                        Extrapolation.CLAMP
                    )}rad`
                    // rotateY: `${currentAngle}rad`
                },
                {
                    scale: interpolate (
                        scrollX.value,
                        inputRange,
                        [0.9, 1, 0.9],
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
        backgroundColor: "#d6bebeff",
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