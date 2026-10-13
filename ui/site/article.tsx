import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Doc } from "@/content/legal";
import { RADIUS, TYPE, useSite } from "./tokens";
import { Screen } from "./page";

/**
 * A screen that is read from top to bottom: the methodology, the statements, the
 * policies. The standfirst in the app's violet at the top, then each part in its
 * own card under its own heading.
 */
export default function ArticlePage({ doc, children }: { doc: Doc; children?: React.ReactNode }) {
    const { c, dark } = useSite();
    const head = (
        <>
            <Text style={[TYPE.screen, { color: c.brandInk }]} accessibilityRole="header">{doc.title}</Text>
            <Text style={[TYPE.body, { color: c.brandInk, opacity: 0.92 }]}>{doc.intro}</Text>
        </>
    );
    return (
        <Screen back docTitle={doc.title} colour={c.brand} tone={dark ? "dark" : "light"} head={head}>
            {doc.sections.map((section) => (
                <View key={section.heading} style={[styles.card, { backgroundColor: c.card }]}>
                    <Text style={[TYPE.title, { color: c.ink }]} accessibilityRole="header">{section.heading}</Text>
                    {section.body.map((p) => (
                        <Text key={p.slice(0, 40)} style={[TYPE.body, { color: c.ink }]}>{p}</Text>
                    ))}
                </View>
            ))}
            {children}
            {!!doc.footer && <Text style={[TYPE.meta, styles.foot, { color: c.muted }]}>{doc.footer}</Text>}
        </Screen>
    );
}

const styles = StyleSheet.create({
    card: { marginHorizontal: 12, marginTop: 12, borderRadius: RADIUS.card, padding: 18, gap: 10 },
    foot: { paddingHorizontal: 18, paddingTop: 16 },
});
