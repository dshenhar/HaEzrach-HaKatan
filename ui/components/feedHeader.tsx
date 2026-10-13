import { useSkin } from '@/state/direction';
import { useTheme } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { I18nManager, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// The book with the dove, in navy ink and in a pale copy for dark grounds.
const MARK_INK = require("../assets/images/mark-ink.png");
const MARK_LIGHT = require("../assets/images/mark-light.png");
const MARK_RATIO = 426 / 372;

type Props = { onAbout: () => void; onPersonal: () => void };

/**
 * The name at the top of the feed, with the tour on one side and the personal
 * area on the other. Each world sets it on its own shell: the booth's black band,
 * the page's head between its double rule, the concourse's yellow panel.
 */
export default function FeedHeader({ onAbout, onPersonal }: Props) {
    const t = useTheme();
    const skin = useSkin();
    const f = skin.faces;
    const dark = t.name === "negative";

    // what the shell is, and what reads on it
    const shell = skin.name === "daf" ? t.bg : t.brand;
    const ink = skin.name === "daf" ? t.text : t.brandInk;
    const mark = skin.name === "ballot" || (skin.name === "daf" && dark) ? MARK_LIGHT : MARK_INK;

    const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
        <TouchableOpacity onPress={onPress} hitSlop={10} accessibilityLabel={label} accessibilityRole="button"
            style={styles.iconHit}>
            <Ionicons name={name} size={26} color={ink} />
        </TouchableOpacity>
    );

    const words = skin.name === "daf" ? (
        // the page's head: one line, centred between its rules
        <Text style={[styles.dafName, { color: ink, fontFamily: f.display }]}>חדשות האזרח הקטן</Text>
    ) : (
        <View style={styles.words}>
            <Text style={[styles.top, { color: ink, fontFamily: f.display },
                skin.name === "sign" && styles.topSign]}>חדשות</Text>
            <Text style={[styles.bottom, { color: ink, fontFamily: skin.name === "sign" ? f.ui : f.uiStrong }]}>
                האזרח הקטן
            </Text>
        </View>
    );

    return (
        <View style={[styles.shell, { backgroundColor: shell },
            skin.name === "daf" && styles.shellPage]}>
            <View style={styles.row}>
                {icon("information-circle-outline", "על האפליקציה", onAbout)}
                <View style={styles.brand} accessibilityLabel="חדשות האזרח הקטן">
                    <Image source={mark} style={[styles.mark, skin.name === "daf" && styles.markSmall]}
                        resizeMode="contain" />
                    {words}
                </View>
                {icon("person-circle-outline", "האזור האישי", onPersonal)}
            </View>
            {/* the page's double rule, the head's foot */}
            {skin.name === "daf" && (
                <View style={styles.rules}>
                    <View style={[styles.ruleHeavy, { backgroundColor: t.text }]} />
                    <View style={[styles.ruleLight, { backgroundColor: t.text }]} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    shell: { width: "100%", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, marginBottom: 12 },
    shellPage: { paddingBottom: 0, marginBottom: 6 },
    // right to left: the i, the name, the personal area. The two icons are the same
    // size, so space-between centres the name between them
    row: {
        flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
        alignItems: "center", justifyContent: "space-between", gap: 10,
    },
    iconHit: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    brand: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 8 },
    mark: { height: 38, width: 38 * MARK_RATIO },
    markSmall: { height: 30, width: 30 * MARK_RATIO },
    words: { alignItems: "flex-end" },
    top: { fontSize: 24, lineHeight: 26, letterSpacing: -0.2 },
    topSign: { fontSize: 23, letterSpacing: -0.4 },
    bottom: { fontSize: 13, lineHeight: 15, letterSpacing: 0.1 },
    dafName: { fontSize: 23, lineHeight: 30, letterSpacing: -0.3 },
    rules: { marginTop: 10, gap: 2 },
    ruleHeavy: { height: 2.5 },
    ruleLight: { height: 1 },
});
