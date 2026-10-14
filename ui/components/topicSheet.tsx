import { HotTopic, topicPicture } from '@/state/hotTopics';
import { TYPE } from '@/state/craft';
import { useTheme } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import BlocSwipe from './blocSwipe';
import Press from './press';
import React, { useState } from 'react';
import { I18nManager, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextStyle, View,
    ViewStyle } from 'react-native';
import Modal from 'react-native-modal';

// the phone lays the app out right to left and the web build does not
const FROM_RIGHT = I18nManager.isRTL ? "row" : "row-reverse";
const FROM_LEFT = I18nManager.isRTL ? "row-reverse" : "row";

const ASPECTS = [
    ["coverage", "איך מסקרים"],
    ["view", "איך רואים את זה"],
    ["motives", "מה מניע אותם"],
] as const;
type Aspect = typeof ASPECTS[number][0];

// The web sets the facts the way a page is set: the picture floated to the left of
// one block and the lines running beside it and on under it, which a row of two
// columns cannot do. React Native's types know nothing of floats and block boxes, and
// the web build hands them to the browser as written, so they are cast. A block's
// align-content goes back to normal: the web build gives every view flex-start, and
// a block with any other value is closed to the float beside it. Justified, Rubik's
// kerning is taken by Chrome for room to stretch a line into and opens gaps inside
// words, so the justified text is set without it.
const WEB = Platform.OS === "web";
const css = <T,>(style: object) => (WEB ? (style as T) : undefined);
const FLOW = css<ViewStyle>({ display: "flow-root" });
const FLOAT = css<ViewStyle>({ float: "left", marginRight: 14, marginBottom: 6 });
const LINE = css<TextStyle>({ display: "block", fontKerning: "none" });

type Props = {
    /** the affair, kept by the page while the sheet slides away */
    topic: HotTopic | null;
    visible: boolean;
    onClose: () => void;
    onOpenStory: (topic: HotTopic, storyId: string) => void;
};

/**
 * An affair, whole, in a sheet that rises from the foot of the screen with the page
 * blurred above it. The name and the line that says what the dispute is; the facts,
 * set to the right of its picture; then the two sides - how each covers it, sees it
 * and what drives it, one at a time, the right and the left swiped between - and the
 * stories in today's feed that are about it.
 */
export default function TopicSheet({ topic: at, visible, onClose, onOpenStory }: Props) {
    const t = useTheme();
    const dark = t.name === "negative";
    const [aspect, setAspect] = useState<Aspect>("coverage");
    const [missing, setMissing] = useState<string | null>(null);

    const side = (which: "right" | "left") => (
        <Text style={[styles.sideText, LINE]}>{at?.[which]?.[aspect]}</Text>
    );

    return (
        <Modal
            isVisible={visible && !!at}
            onBackdropPress={onClose}
            onBackButtonPress={onClose}
            onModalHide={() => setAspect("coverage")}
            style={styles.modal}
            customBackdrop={
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}
                    accessibilityRole="button" accessibilityLabel="סגירה">
                    <BlurView intensity={30} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(17,24,39,0.18)" }]} />
                </Pressable>
            }
            backdropOpacity={1}
            useNativeDriverForBackdrop
        >
            {at && (
                <View style={[styles.sheet, { backgroundColor: t.surface }]}>
                    <View style={[styles.grabber, { backgroundColor: t.line }]} />
                    <View style={[styles.head, { flexDirection: FROM_LEFT }]}>
                        <Press onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="סגירה"
                            style={[styles.close, { backgroundColor: t.surfaceAlt }]}>
                            <Ionicons name="close" size={20} color={t.text} />
                        </Press>
                    </View>
                    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.title, { color: t.text }]}>{at.title}</Text>
                        {!!at.one_line && (
                            <Text style={[styles.oneLine, LINE, { color: t.textMuted }]}>{at.one_line}</Text>
                        )}

                        <View style={[styles.facts, FLOW ?? { flexDirection: FROM_LEFT, gap: 14 }]}>
                            <View style={[styles.picture, FLOAT]}>
                                {missing !== at.id && (
                                    <Image source={{ uri: topicPicture(at.id) }} style={styles.pictureImage}
                                        resizeMode="cover" accessible={false} onError={() => setMissing(at.id)} />
                                )}
                            </View>
                            <View style={[css<ViewStyle>({ display: "block", alignContent: "normal" }) ?? { flex: 1 }]}>
                                <Text style={[styles.label, LINE, { color: t.textMuted }]}>הפרטים</Text>
                                <Text style={[styles.summary, LINE, { color: t.text }]}>{at.summary}</Text>
                            </View>
                        </View>

                        <View style={[styles.aspects, { flexDirection: FROM_RIGHT, backgroundColor: t.surfaceAlt }]}
                            accessibilityRole="tablist">
                            {ASPECTS.map(([key, label]) => {
                                const on = aspect === key;
                                return (
                                    <Press key={key} style={[styles.aspect, on && { backgroundColor: t.text }]}
                                        onPress={() => setAspect(key)}
                                        accessibilityRole="tab" accessibilityState={{ selected: on }}>
                                        <Text style={[styles.aspectText, { color: on ? t.surface : t.text }]}
                                            numberOfLines={1}>{label}</Text>
                                    </Press>
                                );
                            })}
                        </View>
                        <BlocSwipe key={at.id} right={side("right")} left={side("left")} />

                        {at.links.length > 0 && (
                            <View style={styles.links}>
                                <Text style={[styles.label, { color: t.textMuted }]}>בפיד היום</Text>
                                {at.links.map((link) => (
                                    <Press key={link.id}
                                        style={[styles.link, { backgroundColor: t.surfaceAlt, flexDirection: FROM_RIGHT }]}
                                        onPress={() => onOpenStory(at, link.id)}
                                        accessibilityRole="link"
                                        accessibilityLabel={`פתיחה בפיד: ${link.title}`}>
                                        <View style={styles.linkWords}>
                                            <Text style={[styles.linkTitle, { color: t.text }]} numberOfLines={2}>
                                                {link.title}
                                            </Text>
                                            <Text style={[styles.linkMeta, { color: t.textMuted }]}>{link.outlets} גופים</Text>
                                        </View>
                                        <Ionicons name={I18nManager.isRTL ? "chevron-forward" : "chevron-back"}
                                            size={16} color={t.textMuted} />
                                    </Press>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: { justifyContent: "flex-end", margin: 0 },
    // most of the screen; what stands above it is the page, blurred
    sheet: {
        height: "88%", width: "100%", maxWidth: 560, alignSelf: "center",
        borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8 },
    head: { paddingHorizontal: 14, marginTop: -2 },
    close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    body: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
    title: { ...TYPE.title, fontSize: 22, lineHeight: 29, textAlign: "right" },
    oneLine: { ...TYPE.body, fontSize: 15, lineHeight: 23, textAlign: "justify" },
    facts: { marginTop: 4 },
    picture: { width: 124, height: 124, borderRadius: 14, overflow: "hidden", backgroundColor: "#E9E8E4" },
    pictureImage: { width: "100%", height: "100%" },
    label: { ...TYPE.micro, textAlign: "right", marginBottom: 4 },
    summary: { ...TYPE.body, fontSize: 15, lineHeight: 24, textAlign: "justify" },
    aspects: { borderRadius: 999, padding: 3, gap: 3, marginTop: 8 },
    aspect: { flex: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" },
    aspectText: { ...TYPE.label, fontSize: 12.5 },
    sideText: { ...TYPE.body, fontSize: 15, lineHeight: 24, color: "#FFFFFF", textAlign: "justify" },
    links: { gap: 8, marginTop: 6 },
    link: { borderRadius: 12, padding: 12, gap: 10, alignItems: "center" },
    linkWords: { flex: 1, gap: 3 },
    linkTitle: { ...TYPE.label, textAlign: "right" },
    linkMeta: { ...TYPE.caption, textAlign: "right" },
});
