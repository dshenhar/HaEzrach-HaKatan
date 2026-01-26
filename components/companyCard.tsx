import { Dimensions, I18nManager, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useContext } from 'react'
import { CompanyItem } from '@/state/engagement'
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { RadarChart } from "react-native-gifted-charts";
import RateBar from './ui/rateBar';
import Ionicons from '@expo/vector-icons/Ionicons';

type props = {
    item: CompanyItem;
    index: number;
    scrollX: SharedValue<number>;
    carouselLen: number;
    setDetailSource: (site: string) => void;
}
const width = Dimensions.get("window").width;
const height = Dimensions.get("screen").height;

const CompanyCard = ({ item, index, scrollX, carouselLen, setDetailSource } : props) => {
    const angleStep = (2 * Math.PI) / 10;
    const currentAngle = scrollX.value + 1.2 * angleStep;
    const RADIUS = width * 0.8

    const handleDetailPress = () => {
        setDetailSource(item.source);
    }

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
    return (
        <Animated.View style={[styles.companyCard]}>
            <View style={styles.innerCard}>
                <TouchableOpacity style={styles.headerContainer} onPress={handleDetailPress}>
                    <Text style={styles.headerText}>{item.source}</Text>
                </TouchableOpacity>
                <View style={styles.rateContainer}>
                    <RateBar rate={(item.bias * 10) + 50} showPrecents={true} style={styles.rateBar} />
                </View>
                <View style={styles.moreContainer}>
                    <Text>למה זה הציון?</Text>
                    <View style={styles.articleContainer}>
                    {
                        item.latest_article_header != "" ?
                            <Text style={styles.articleText}>{item.latest_article_header}</Text>
                        :
                        <Text style={styles.articleText}>אין כתבות בנושא זה</Text>
                    }
                    </View>
                    {
                        item.latest_article_header != "" ?
                        <TouchableOpacity style={{alignSelf: "flex-start"}}>
                            <Text>לכל הכתבות בנושא <Ionicons name="arrow-back-outline" size={10} color="#000000" /></Text>
                        </TouchableOpacity>
                        : null
                    }
                </View>
            </View>
        </Animated.View>
    )
}

export default CompanyCard

const styles = StyleSheet.create({
    companyCard: {
        // height: "100%",
        alignItems: "center",
        // justifyContent: "center",
        // backgroundColor: "#a57272ff",
        // borderRadius: 15,
        gap: 20,
        width: width,
        overflow: "visible",
        // borderWidth: 1,
        marginBottom: 10,
        // position: "absolute"
        // marginHorizontal: 20,
    },
    innerCard: {
        width: 300,
        // height: 250,
        paddingBottom: 20,
        borderWidth: 0.3,
        borderRadius: 10,
        margin: 10,
        borderColor: "#CECECE",
        backgroundColor: "#ECECEC",
        // justifyContent: "center",
        alignItems: "center",
    },
    headerContainer: {
        marginTop: 20,
        marginBottom: 0,
        alignItems: "center",
    },
    headerText: {
        fontSize: 20,
        // fontWeight: "bold",
    },
    rateContainer: {
        marginBottom: 5,
        width: "95%",
    },
    rateBar: {
        padding: 18,
    },
    moreContainer: {
        width: "83%",
        alignItems: "flex-end",
    },
    articleContainer: {
        width: "100%", 
        // height: 60, 
        marginTop: 10, 
        backgroundColor: "#ffffff", 
        borderRadius: 5, 
        marginBottom: 10,
    },
    articleText: {
        padding: 10, 
        fontSize: 15, 
        textAlign: "right",
    },
})