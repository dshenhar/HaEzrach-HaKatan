import { Text, View, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { saveProfilePreference, getProfilePreferences, clearAllRatings } from '@/state/engagement';

export default function ProfilePage() {
    const [exposure, setExposure] = useState<boolean>(true);
    const [notifications, setNotifications] = useState<boolean>(false);

    const EXPOSURE_KEY = "exposure-pref";
    const NOTIFICATIN_KEY = "notification-pref";

    const confimRatingClear = () => {
        Alert.alert(
            'אשר פעולה',
            'אתה בטוח שתרצה למחוק את כל הדירוגים?',
            [
                {
                    text: 'ביטול',
                    onPress: () => console.log('Cancel Pressed'),
                    style: 'cancel',
                },
                {
                    text: 'מחק',
                    onPress: clearAllRatings,
                },
            ],
            { cancelable: false }
        );
    }

    const handleExposureChange = () => {
        const temp = !exposure;
        setExposure(temp);
        saveProfilePreference(EXPOSURE_KEY, String(temp));
    }

    const handleNotificationChange = () => {
        const temp = !notifications;
        setNotifications(temp);
        saveProfilePreference(NOTIFICATIN_KEY, String(temp));
    }

    useEffect(() => {
        getProfilePreferences(EXPOSURE_KEY, setExposure);
        getProfilePreferences(NOTIFICATIN_KEY, setNotifications);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>העדפות אלגוריתם</Text>
                <View style={styles.switchRow}>
                    <Text style={styles.switchText}>חשיפה לדעות שונות</Text>
                    <Switch 
                        onValueChange={handleExposureChange}
                        value={exposure}
                    />
                </View>
                <View style={styles.switchRow}>
                    <Text style={styles.switchText}>התראות</Text>
                    <Switch 
                        onValueChange={handleNotificationChange}
                        value={notifications}
                    />
                </View>
            </View>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>נתונים</Text>
                <TouchableOpacity style={styles.voteButton} onPress={confimRatingClear} >
                    <Text style={{ color: "white" }}>איפוס דירוגים</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8ff',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
    },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        elevation: 2,
        borderWidth: 1,
        width: "90%",
        alignItems: "flex-end",
        borderColor: "#eaeaeaff",
    },
    cardTitle: {
        fontFamily: "Heebo_700Bold",
        textAlign: "right",
        fontWeight: "bold",
        fontSize: 18,
        marginBottom: 16,
    },
    switchRow: {
        flexDirection: "row-reverse",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 15,
        width: "100%"
    },
    switchText: {
        fontFamily: "Heebo_400Regular",
        fontSize: 14
    },
    voteButton: {
        padding: 15,
        backgroundColor: "#ef4242ff",
        borderRadius: 10
    }

});
