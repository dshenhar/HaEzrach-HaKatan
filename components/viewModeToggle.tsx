import { useTheme } from '@/state/theme';
import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-native-modal';
import { Animated, Easing, LayoutChangeEvent, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ViewMode = "bloc" | "citizen";

const EXPLAIN: Record<ViewMode, { title: string; body: string }> = {
    bloc: {
        title: "תצוגה גושית",
        body: "אנחנו רגילים לקטלג כל אירוע לפי השאלה אם הוא משרת את המחנה שלנו או פוגע בו — ומתוך זה נגזרת גם הזהות שלנו. התצוגה הזו מראה איך הגוש שלך והגוש הנגדי סיקרו את אותו אירוע עצמו.",
    },
    citizen: {
        title: "האזרח הקטן",
        body: "סקירה עניינית שלא מתייחסת למי אמר ולאיזה מחנה הוא שייך. היא לא מתיימרת לשבור את האג'נדות הקיימות, אלא להציג אותן זו לצד זו כפי שנכתבו — וחושפת אותך לעיתונות שאתה לא קורא ביום־יום.",
    },
};

const Info = ({ colour, outlined }: { colour: string; outlined?: boolean }) => (
    <View style={[styles.info, { borderColor: colour }]}>
        <Text style={[styles.infoText, { color: colour }, outlined && OUTLINE]}>i</Text>
    </View>
);

type Props = { mode: ViewMode; onChange: (m: ViewMode) => void }

const PAD = 5;
const GAP = 6;

// White on gold is only ~2.2:1, so the selected label carries a hairline outline.
// paintOrder puts the stroke BEHIND the glyph - without it the stroke paints over
// the fill and eats into the letterforms, which reads as a blurry bold.
// Native has no text stroke, so it gets a tight dark halo instead.
const OUTLINE: any = Platform.select({
    web: { WebkitTextStroke: "0.6px rgba(0,0,0,0.55)", paintOrder: "stroke fill" },
    default: {
        textShadowColor: "rgba(0,0,0,0.55)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 2,
    },
});

const ViewModeToggle = ({ mode, onChange }: Props) => {
    const t = useTheme();
    const [explain, setExplain] = useState<ViewMode | null>(null);
    const [railWidth, setRailWidth] = useState(0);

    // row-reverse puts the first child at the right edge
    const order: ViewMode[] = ["bloc", "citizen"];
    const half = railWidth ? (railWidth - PAD * 2 - GAP) / 2 : 0;

    // 0 = bloc (right), 1 = citizen (left)
    const slide = useRef(new Animated.Value(mode === "bloc" ? 0 : 1)).current;
    useEffect(() => {
        Animated.timing(slide, {
            toValue: mode === "bloc" ? 0 : 1,
            duration: 220,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: true,
        }).start();
    }, [mode, slide]);

    const onRailLayout = (e: LayoutChangeEvent) => setRailWidth(e.nativeEvent.layout.width);

    return (
        <View style={styles.wrap}>
            <View style={[styles.rail, { backgroundColor: t.track }]} onLayout={onRailLayout}>
                {half > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.thumb, {
                            width: half,
                            backgroundColor: t.select,
                            // starts on the right, slides left
                            left: PAD + half + GAP,
                            transform: [{
                                translateX: slide.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -(half + GAP)],
                                }),
                            }],
                        }]}
                    />
                )}

                {order.map((key) => {
                    const on = mode === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            style={styles.seg}
                            onPress={() => onChange(key)}
                            activeOpacity={0.9}
                        >
                            <Text
                                numberOfLines={1}
                                style={[styles.segText, { color: on ? t.selectInk : t.textMuted },
                                    on && OUTLINE]}
                            >
                                {EXPLAIN[key].title}
                            </Text>
                            <TouchableOpacity onPress={() => setExplain(key)} hitSlop={8}>
                                <Info colour={on ? t.selectInk : t.textMuted} outlined={on} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Modal isVisible={explain !== null} onBackdropPress={() => setExplain(null)}
                backdropOpacity={0.45} style={styles.modal}>
                <View style={[styles.card, { backgroundColor: t.surface }]}>
                    {explain && (
                        <>
                            <Text style={[styles.cardTitle, { color: t.text }]}>{EXPLAIN[explain].title}</Text>
                            <Text style={[styles.cardBody, { color: t.textMuted }]}>{EXPLAIN[explain].body}</Text>
                        </>
                    )}
                    <TouchableOpacity onPress={() => setExplain(null)}>
                        <Text style={[styles.close, { color: t.brand }]}>הבנתי</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
};

export default ViewModeToggle;

const styles = StyleSheet.create({
    wrap: { width: "100%", alignSelf: "stretch", paddingHorizontal: 12, paddingTop: 4 },
    rail: { width: "100%", flexDirection: "row-reverse", borderRadius: 999, padding: PAD, gap: GAP },
    thumb: { position: "absolute", top: PAD, bottom: PAD, borderRadius: 999 },
    seg: {
        // minWidth 0 lets a flex child shrink below its content width; without it
        // the label wrapped and pushed the pill past the rail. The labels are
        // different lengths, so neither gets a fixed half - each takes what it needs.
        flex: 1, minWidth: 0,
        flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
        gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 6,
    },
    segText: { fontFamily: "Heebo_700Bold", fontSize: 13.5, flexShrink: 0 },
    info: {
        width: 15, height: 15, borderRadius: 8, borderWidth: 1, flexShrink: 0,
        alignItems: "center", justifyContent: "center",
    },
    infoText: { fontFamily: "Heebo_700Bold", fontSize: 9.5, lineHeight: 13 },

    modal: { justifyContent: "center", margin: 24 },
    card: { borderRadius: 16, padding: 20, gap: 10 },
    cardTitle: { fontFamily: "Heebo_800ExtraBold", fontSize: 19, textAlign: "right" },
    cardBody: { fontFamily: "Heebo_400Regular", fontSize: 14, lineHeight: 22, textAlign: "right" },
    close: { fontFamily: "Heebo_800ExtraBold", fontSize: 14, textAlign: "center", paddingTop: 8 },
});
