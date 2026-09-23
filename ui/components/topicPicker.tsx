import { useTheme } from '@/state/theme';
import React from 'react';
import Modal from 'react-native-modal';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
    open: boolean;
    topics: string[];
    current: string;
    headline: string;
    onPick: (topic: string) => void;
    onClose: () => void;
}

const TopicPicker = ({ open, topics, current, headline, onPick, onClose }: Props) => {
    const t = useTheme();

    return (
        <Modal isVisible={open} onBackdropPress={onClose} onSwipeComplete={onClose}
            swipeDirection="down" style={styles.modal} backdropOpacity={0.45}>
            <View style={[styles.sheet, { backgroundColor: t.surface }]}>
                <View style={[styles.grabber, { backgroundColor: t.line }]} />
                <View style={styles.head}>
                    <Text style={[styles.title, { color: t.text }]}>שיוך לנושא</Text>
                    <Text style={[styles.headline, { color: t.textMuted }]} numberOfLines={2}>{headline}</Text>
                </View>
                <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                    {topics.map((topic) => {
                        const active = topic === current;
                        return (
                            <TouchableOpacity
                                key={topic}
                                style={[styles.row, { borderColor: t.line },
                                    active && { backgroundColor: t.text, borderColor: t.text }]}
                                onPress={() => onPick(topic)}
                            >
                                <Text style={[styles.rowText, { color: active ? t.surface : t.text }]}>{topic}</Text>
                                {active && <Text style={[styles.rowText, { color: t.surface }]}>✓</Text>}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <TouchableOpacity onPress={onClose}>
                    <Text style={[styles.close, { color: t.textMuted }]}>ביטול</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

export default TopicPicker;

const styles = StyleSheet.create({
    modal: { justifyContent: "flex-end", margin: 0 },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "82%", paddingTop: 8 },
    grabber: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 8 },
    head: { paddingHorizontal: 18, gap: 4, paddingBottom: 10 },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 19, textAlign: "right" },
    headline: { fontFamily: "Heebo_400Regular", fontSize: 12, lineHeight: 17, textAlign: "right" },
    list: { paddingHorizontal: 18, paddingBottom: 10, gap: 6 },
    row: {
        flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
        borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13,
    },
    rowText: { fontFamily: "Heebo_500Medium", fontSize: 14, textAlign: "right" },
    close: { fontFamily: "Heebo_500Medium", fontSize: 13, textAlign: "center", paddingVertical: 14 },
});
