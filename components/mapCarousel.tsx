import React, { Dispatch, SetStateAction, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View, ViewToken, Text } from 'react-native';
import Pagination from './pagination';
import CompanyCard from './companyCard';
import { CompanyItem, getRanks } from '@/state/engagement';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

type props = {
    data: CompanyItem[];
    topic: string;
}

const MapCarousel = ({ data, topic }  : props ) => {
    const [paginationIndex, setPaginationIndex] = useState<number>(0);
    const carouselRef = useRef<FlatList>(null)
    const scrollX = useSharedValue(0);

    const onScrollHendeler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollX.value = e.contentOffset.x;
            // console.log("X", scrollX);
        }
    })

    const onViewableItemsChanged = ({ viewableItems } : { viewableItems: ViewToken[] }) => {
        if (viewableItems[0]?.index !== undefined && viewableItems[0]?.index !== null) {
            setPaginationIndex(viewableItems[0].index);
        }
    }

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50
    }

    const screenWidth = Dimensions.get('window').width;

    const randomInitialIndex = useMemo(() => {
        if (!data || data.length === 0) return 0;
        return Math.floor(Math.random() * data.length);
    }, [data]);

    const renderer = useCallback(({ item, index } : { item: CompanyItem, index: number }) => {
        return <CompanyCard item={item} index={index} scrollX={scrollX} carouselLen={data.length} />
    }, []);


    return (
        <View style={styles.card}>
            <View>
                <Text style={{color: "black", alignSelf: "center", fontSize: 20}}>{topic}</Text>
            </View>
            <Animated.FlatList
                data={data}
                renderItem={({ item, index }) => (
                    <CompanyCard item={item} index={index} scrollX={scrollX} carouselLen={data.length} />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                onScroll={onScrollHendeler}
                onViewableItemsChanged={onViewableItemsChanged}
                ref={carouselRef}
                removeClippedSubviews={false}
                scrollEventThrottle={1000 / 60}
            
            />
            {/* <View style={{bottom: 100}}>
                <Pagination 
                    items={data} 
                    paginationIndex={paginationIndex} 
                    setPaginationIndex={setPaginationIndex} 
                    carouselRef={carouselRef} 
                />
            </View> */}
        </View>
    )
}

export default MapCarousel

const styles = StyleSheet.create({
    card: {
        marginTop: 20,
    }
})