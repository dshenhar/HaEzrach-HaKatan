import { HotTopic, topicPicture } from '@/state/hotTopics';
import { TYPE } from '@/state/craft';
import { useTheme } from '@/state/theme';
import Press from './press';
import React, { useState } from 'react';
import { I18nManager, Image, StyleSheet, Text, View } from 'react-native';

// the phone lays the app out right to left and the web build does not
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
const PICTURE = 84;

type Props = {
    topic: HotTopic;
    onOpen: () => void;
};

/**
 * One affair as a card in a row of them: its picture on the left, its name and the
 * one line that says what the dispute is beside it, and - when today's feed has
 * stories on it - how many. A touch opens the whole of it, from the foot of the
 * screen.
 */
export default function HotTopicCard({ topic, onOpen }: Props) {
    const t = useTheme();
    // an affair whose picture is not there yet keeps the empty frame
    const [missing, setMissing] = useState(false);
    const stories = topic.links.length;

    return (
        <Press style={[styles.card, { backgroundColor: t.surfaceAlt, flexDirection: FROM_RIGHT }]}
            scale={0.98} onPress={onOpen}
            accessibilityRole="button" accessibilityLabel={`${topic.title}. ${topic.one_line}`}>
            <View style={styles.words}>
                <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>{topic.title}</Text>
                {!!topic.one_line && (
                    <Text style={[styles.oneLine, { color: t.textMuted }]} numberOfLines={3}>{topic.one_line}</Text>
                )}
                {stories > 0 && (
                    <Text style={styles.stories}>
                        {stories === 1 ? "כתבה אחת בפיד היום" : `${stories} כתבות בפיד היום`}
                    </Text>
                )}
            </View>
            <View style={styles.picture}>
                {!missing && (
                    <Image source={{ uri: topicPicture(topic.id) }} style={styles.pictureImage}
                        resizeMode="cover" accessible={false} onError={() => setMissing(true)} />
                )}
            </View>
        </Press>
    );
}

const styles = StyleSheet.create({
    // no border: the card is told from the white page by its ground, a shade greyer;
    // every card in a row is as tall as the tallest, so the row reads as one
    card: { flex: 1, borderRadius: 18, padding: 14, gap: 12, alignItems: "flex-start", minHeight: 150 },
    words: { flex: 1, gap: 5 },
    title: { ...TYPE.title, fontSize: 17.5, lineHeight: 23, textAlign: "right" },
    oneLine: { ...TYPE.body, fontSize: 13.5, lineHeight: 20, textAlign: "right" },
    stories: { ...TYPE.micro, color: "#B45309", textAlign: "right", marginTop: 2 },
    picture: { width: PICTURE, height: PICTURE, borderRadius: 14, overflow: "hidden", backgroundColor: "#E9E8E4" },
    pictureImage: { width: "100%", height: "100%" },
});
