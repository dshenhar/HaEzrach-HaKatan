import { useTheme } from '@/state/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import Modal from 'react-native-modal';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * The offer to answer the questionnaire, made twice: once on the first visit, and
 * after that as a reminder that can be switched off for good.
 *
 * Neither is shown to anyone who has already answered - their positions are saved
 * and nothing here concerns them again.
 */

const WELCOME = {
    title: "ברוכים הבאים!",
    body: [
        "האפליקציה מביאה את אותו יום חדשות משני צדי המפה, כולל מה שאתם לא רגילים לקרוא.",
        "כדי שנוכל להראות לכם כמה מזה באמת הגיע מהצד השני, צריך לדעת איפה אתם עומדים. שאלון עמדות קצר, כדקה, והתשובות נשארות במכשיר שלכם.",
    ],
    primary: "למילוי שאלון העמדות",
    secondary: "אולי אחר כך",
};

// a different opening each time, so a reminder does not read like a machine
const REMINDERS = [
    "היי, עוד לא מילאתם שאלון עמדות",
    "רגע אחד, לפני שממשיכים לקרוא",
    "חסר דבר אחד כדי להראות לכם תמונה מלאה",
];

const REMINDER_BODY =
    "בלי השאלון אפשר לדעת מה קראתם, אבל לא ביחס למה. דקה אחת, ועמוד הנתונים מתחיל לדבר עליכם.";

type Props = {
    open: boolean;
    variant: "welcome" | "reminder";
    onFill: () => void;
    onDismiss: () => void;
    /** the reminder only: the reader asked not to be reminded again */
    onNeverAgain?: () => void;
};

export default function QuestionnaireInvite({ open, variant, onFill, onDismiss, onNeverAgain }: Props) {
    const t = useTheme();
    const [never, setNever] = React.useState(false);
    const welcome = variant === "welcome";
    // the opening line is drawn once per mount, not on every render
    const [title] = React.useState(() =>
        welcome ? WELCOME.title : REMINDERS[Math.floor(Math.random() * REMINDERS.length)]);

    const close = () => {
        if (never) onNeverAgain?.();
        onDismiss();
    };

    return (
        <Modal isVisible={open} onBackdropPress={close} onBackButtonPress={close}
            backdropOpacity={0.45} style={styles.modal} useNativeDriver>
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[styles.title, { color: t.text }]}>{title}</Text>

                {(welcome ? WELCOME.body : [REMINDER_BODY]).map((line) => (
                    <Text key={line} style={[styles.body, { color: t.textMuted }]}>{line}</Text>
                ))}

                <TouchableOpacity
                    style={[styles.primary, { backgroundColor: t.select }]}
                    onPress={() => { if (never) onNeverAgain?.(); onFill(); }}
                    accessibilityRole="button"
                >
                    <Text style={[styles.primaryText, { color: t.selectInk }]}>
                        {welcome ? WELCOME.primary : "למילוי השאלון"}
                    </Text>
                </TouchableOpacity>

                {!welcome && (
                    <TouchableOpacity style={styles.check} onPress={() => setNever((v) => !v)}
                        accessibilityRole="checkbox" accessibilityState={{ checked: never }}>
                        <View style={[styles.box, { borderColor: t.line },
                            never && { backgroundColor: t.text, borderColor: t.text }]}>
                            {never && <Ionicons name="checkmark" size={12} color={t.surface} />}
                        </View>
                        <Text style={[styles.checkText, { color: t.textMuted }]}>אל תציגו לי את זה שוב</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={close} accessibilityRole="button">
                    <Text style={[styles.secondary, { color: t.textMuted }]}>
                        {welcome ? WELCOME.secondary : "לא עכשיו"}
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: { justifyContent: "center", alignItems: "center", margin: 20 },
    card: { width: "100%", maxWidth: 360, borderRadius: 18, borderWidth: 1, padding: 20, gap: 10 },
    title: { fontFamily: "Heebo_800ExtraBold", fontSize: 21, textAlign: "right" },
    body: { fontFamily: "Heebo_400Regular", fontSize: 13.5, lineHeight: 20, textAlign: "right" },
    primary: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 6 },
    primaryText: { fontFamily: "Heebo_800ExtraBold", fontSize: 15 },
    check: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingTop: 2 },
    box: {
        width: 18, height: 18, borderRadius: 5, borderWidth: 1.5,
        alignItems: "center", justifyContent: "center",
    },
    checkText: { fontFamily: "Heebo_400Regular", fontSize: 12, textAlign: "right" },
    secondary: { fontFamily: "Heebo_500Medium", fontSize: 13, textAlign: "center", paddingTop: 6 },
});
