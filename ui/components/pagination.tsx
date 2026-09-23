import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { Dispatch, RefObject, SetStateAction } from 'react'
import { CompanyItem, NewsItem } from '@/state/engagement';

type props = {
    items: NewsItem[] | CompanyItem[];
    paginationIndex: number;
    setPaginationIndex: Dispatch<SetStateAction<number>>;
    carouselRef: RefObject<FlatList | null>;
}

const Pagination = ({ items, paginationIndex, setPaginationIndex, carouselRef } : props) => {
    
    const getSourceAbbr = (source: string) => {
        if (!source) return "";
        const clean = source.replace(/[^א-תA-Za-z]/g, "");
        return clean.slice(0, 2).toUpperCase();
    };
    
    return (
        <View style={styles.dotsContainer}>
            {items.map((item, index) => {
                return (
                    <TouchableOpacity
                        key={index}
                        onPress={() => {
                            // console.log(carouselRef.current)
                            // carouselRef.current?.scrollTo({ index: index });
                            carouselRef.current?.scrollToIndex({ 
                                index: index,
                                animated: true 
                            })
                            setPaginationIndex(index);
                        }}
                        style={[
                            styles.dotButton, 
                            // styles.dotActive,
                            paginationIndex === index ? styles.dotActive : styles.dotInactive
                        ]}>
                        <Text style={paginationIndex === index ? styles.dotLabelActive : styles.dotLabelInactive}>{getSourceAbbr(item.source)}</Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

export default Pagination

const styles = StyleSheet.create({
    dotsContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        // marginVertical: 2,
        // borderWidth: 1,
        gap: 10,
    },
    dotButton: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 1,
    },
    dotActive: {
        // backgroundColor: "#2563eb",
        width: 28,
        height: 28,
        borderBottomWidth: 2,
    },
    dotInactive: {
        // backgroundColor: "#d1d5db",
        width: 22,
        height: 22,
    },
    dotLabelActive: {
        fontFamily: "Heebo_500Medium",
        color: "#000000ff",
        fontSize: 13,
        // textDecorationLine: "underline",
        fontWeight: "500",
    },
    dotLabelInactive: {
        fontFamily: "Heebo_500Medium",
        color: "#6c6c6cff",
        fontSize: 13,
        // fontWeight: "500",
    },
})