import { NewsItem } from '@/state/engagement';
import React, { Dispatch, SetStateAction, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View, ViewToken } from 'react-native';
import { ArticleViewer } from './articleViewer';
import NewsCard from './newsCard';
import Pagination from './pagination';

type props = {
    data: NewsItem[];
    setRatingOpen: Dispatch<SetStateAction<boolean>>;
    setRatingTarget: Dispatch<SetStateAction<NewsItem | null>>;
}

const NewsCarousel = ({ data, setRatingOpen, setRatingTarget }  : props ) => {
    const [expanded, setExpanded] = useState<boolean>(false);
    const [viewerOpen, setViewerOpen] = useState<boolean>(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState<string>("");
    const [viewerSource, setViewerSource] = useState<string>("");
    const [paginationIndex, setPaginationIndex] = useState<number>(0);
    const carouselRef = useRef<FlatList>(null)

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

    return (
        <View style={styles.card}>
            <FlatList
                data={data}
                renderItem={({ item, index }) => (
                    <NewsCard key={index} slide={item} index={index} expanded={expanded} setExpanded={setExpanded} 
                    setViewerOpen={setViewerOpen} setViewerUrl={setViewerUrl} setViewerTitle={setViewerTitle} 
                    setViewerSource={setViewerSource} setRatingOpen={setRatingOpen} setRatingTarget={setRatingTarget} />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                ref={carouselRef}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialScrollIndex={randomInitialIndex}
                getItemLayout={(data, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                })}
            />

            <Pagination 
                items={data} 
                paginationIndex={paginationIndex} 
                setPaginationIndex={setPaginationIndex} 
                carouselRef={carouselRef} 
            />
            
            <ArticleViewer
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                url={viewerUrl || ''}
                title={viewerTitle}
                source={viewerSource}
                id={data[0].id}
                topic={data[0].topic}
            />
        </View>
    )
}

export default NewsCarousel

const styles = StyleSheet.create({
    card: {
        width: "100%",
        marginBottom: 20,
        borderRadius: 12,
        // shadowColor: "#000",
        // shadowOpacity: 0.1,
        // shadowRadius: 6,
        // elevation: 3,
        // borderWidth: 2,
        // backgroundColor: "white",
        // borderColor: "#eaeaeaff",
    }
})