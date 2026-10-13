import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Doc } from "@/content/legal";
import { useSite } from "./tokens";
import { Page, Wrap } from "./page";

/**
 * A page that is read from top to bottom: the methodology, the statements, the
 * policies. One column at a reading measure, the standfirst set larger, each
 * part under its own heading.
 */
export default function ArticlePage({ doc, children }: { doc: Doc; children?: React.ReactNode }) {
    const { c, type } = useSite();
    return (
        <Page back title={doc.title}>
            <Wrap>
                <View style={styles.column}>
                    <Text style={[type.h1, { color: c.ink }]} accessibilityRole="header">{doc.title}</Text>
                    <Text style={[type.dek, styles.intro, { color: c.ink2, borderBottomColor: c.ruleStrong }]}>{doc.intro}</Text>
                    {doc.sections.map((section) => (
                        <View key={section.heading} style={styles.section}>
                            <Text style={[type.major, { color: c.ink }]} accessibilityRole="header">{section.heading}</Text>
                            {section.body.map((p) => (
                                <Text key={p.slice(0, 40)} style={[type.body, { color: c.ink }]}>{p}</Text>
                            ))}
                        </View>
                    ))}
                    {children}
                    {!!doc.footer && <Text style={[type.meta, styles.foot, { color: c.muted, borderTopColor: c.rule }]}>{doc.footer}</Text>}
                </View>
            </Wrap>
        </Page>
    );
}

const styles = StyleSheet.create({
    // a measure a line of Hebrew prose can be read at, on any screen
    column: { maxWidth: 720, width: "100%", alignSelf: "center", paddingTop: 26, gap: 14 },
    intro: { paddingBottom: 20, borderBottomWidth: 3, marginBottom: 6 },
    section: { gap: 10, paddingTop: 14 },
    foot: { borderTopWidth: 1, paddingTop: 14, marginTop: 18 },
});
