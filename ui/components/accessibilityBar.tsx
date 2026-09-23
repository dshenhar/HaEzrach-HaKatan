import { useAccessControl, ZOOM_STEPS } from '@/state/access';
import { useThemeControl } from '@/state/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

/**
 * The accessibility panel: a button that sits above everything, and behind it the
 * three adjustments the app can honestly make - text size, contrast and stillness -
 * plus the statement the law asks a service to publish.
 *
 * It is deliberately small and out of the way until it is touched. Text size is a
 * web control: on a phone the operating system's own setting already reaches the
 * app, and the panel says where to find it rather than offering a second one that
 * would fight with it.
 */
export default function AccessibilityBar() {
    const [open, setOpen] = useState(false);
    const { access, setAccess } = useAccessControl();
    const { theme: t, setThemeName } = useThemeControl();
    const router = useRouter();

    const step = Math.max(0, ZOOM_STEPS.indexOf(access.zoom));
    const setZoom = (next: number) => setAccess({ zoom: next });

    const toggleContrast = (on: boolean) => {
        setAccess({ contrast: on });
        setThemeName(on ? "contrast" : "light");
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.button, { backgroundColor: t.text, borderColor: t.surface }]}
                onPress={() => setOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={open ? "סגירת תפריט הנגישות" : "פתיחת תפריט הנגישות"}
                hitSlop={8}
            >
                <Ionicons name="accessibility" size={20} color={t.surface} />
            </TouchableOpacity>

            {open && (
                <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="סגירה" />
            )}

            {open && (
                <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}
                    accessibilityViewIsModal>
                    <Text style={[styles.title, { color: t.text }]}>נגישות</Text>

                    {Platform.OS === "web" ? (
                        <View style={styles.block}>
                            <Text style={[styles.label, { color: t.text }]}>גודל טקסט</Text>
                            <View style={styles.steps}>
                                {ZOOM_STEPS.map((value, index) => {
                                    const on = index === step;
                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            onPress={() => setZoom(value)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`גודל טקסט ${Math.round(value * 100)} אחוז`}
                                            style={[styles.stepBtn, {
                                                borderColor: on ? t.text : t.line,
                                                backgroundColor: on ? t.text : "transparent",
                                            }]}
                                        >
                                            <Text style={[styles.stepText, {
                                                color: on ? t.surface : t.text,
                                                fontSize: 10 + index * 1.6,
                                            }]}>א</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.note, { color: t.textMuted }]}>
                            גודל הטקסט נקבע בהגדרות המכשיר, והאפליקציה מתאימה את עצמה אליו.
                        </Text>
                    )}

                    <View style={styles.row}>
                        <Switch value={access.contrast} onValueChange={toggleContrast}
                            accessibilityLabel="ניגודיות גבוהה" />
                        <Text style={[styles.label, { color: t.text }]}>ניגודיות גבוהה</Text>
                    </View>

                    <View style={styles.row}>
                        <Switch value={access.reduceMotion}
                            onValueChange={(on) => setAccess({ reduceMotion: on })}
                            accessibilityLabel="הפחתת אנימציות" />
                        <Text style={[styles.label, { color: t.text }]}>הפחתת אנימציות</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => { setOpen(false); router.push("/accessibility"); }}
                        accessibilityRole="link"
                    >
                        <Text style={[styles.link, { color: t.textMuted }]}>הצהרת הנגישות</Text>
                    </TouchableOpacity>
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    // bottom left, clear of the tab bar and of the crowd at the foot of the feed
    button: {
        position: "absolute", left: 12, bottom: 92, width: 40, height: 40, borderRadius: 20,
        alignItems: "center", justifyContent: "center", borderWidth: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.28)", zIndex: 50,
    },
    scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 49 },
    panel: {
        position: "absolute", left: 12, bottom: 140, width: 236, borderRadius: 14,
        borderWidth: 1, padding: 14, gap: 12, zIndex: 51,
        boxShadow: "0 8px 26px rgba(0,0,0,0.22)",
    },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 16, textAlign: "right" },
    block: { gap: 7 },
    label: { fontFamily: "Heebo_700Bold", fontSize: 13, textAlign: "right", flex: 1 },
    note: { fontFamily: "Heebo_400Regular", fontSize: 11.5, lineHeight: 17, textAlign: "right" },
    steps: { flexDirection: "row-reverse", gap: 6, alignItems: "center" },
    stepBtn: {
        width: 34, height: 34, borderRadius: 9, borderWidth: 1.5,
        alignItems: "center", justifyContent: "center",
    },
    stepText: { fontFamily: "Heebo_800ExtraBold" },
    row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
    link: {
        fontFamily: "Heebo_500Medium", fontSize: 12, textAlign: "right",
        textDecorationLine: "underline",
    },
});
