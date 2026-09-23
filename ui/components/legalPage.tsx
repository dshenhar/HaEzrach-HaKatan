import { Doc } from '@/content/legal';
import { useTheme } from '@/state/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** One of the app's own documents: the privacy policy, the terms, the accessibility statement. */
export default function LegalPage({ doc }: { doc: Doc }) {
    const t = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView edges={["top", "left", "right"]} style={[styles.page, { backgroundColor: t.bg }]}>
            <View style={styles.head}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}
                    accessibilityRole="button" accessibilityLabel="חזרה">
                    <Ionicons name="chevron-forward" size={26} color={t.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: t.text }]}>{doc.title}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Text style={[styles.intro, { color: t.textMuted }]}>{doc.intro}</Text>

                {doc.sections.map((section) => (
                    <View key={section.heading} style={styles.section}>
                        <Text style={[styles.heading, { color: t.text }]}>{section.heading}</Text>
                        {section.body.map((line) => (
                            <Text key={line} style={[styles.line, { color: t.text }]}>{line}</Text>
                        ))}
                    </View>
                ))}

                {!!doc.footer && (
                    <Text style={[styles.footer, { color: t.textMuted }]}>{doc.footer}</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },
    // row-reverse puts the back arrow at the right, where a Hebrew reader starts
    head: {
        flexDirection: "row-reverse", alignItems: "center", gap: 10,
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 20, textAlign: "right" },
    body: { paddingHorizontal: 18, paddingBottom: 48, gap: 18 },
    intro: { fontFamily: "Heebo_500Medium", fontSize: 13.5, lineHeight: 21, textAlign: "right" },
    section: { gap: 7 },
    heading: { fontFamily: "Heebo_800ExtraBold", fontSize: 15, textAlign: "right" },
    line: { fontFamily: "Heebo_400Regular", fontSize: 13, lineHeight: 20, textAlign: "right" },
    footer: { fontFamily: "Heebo_400Regular", fontSize: 11.5, textAlign: "right", marginTop: 4 },
});
