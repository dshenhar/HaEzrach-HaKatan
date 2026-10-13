import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "@/site/chrome";

/**
 * The app's five places, on the bar at its foot: today's news, what one side
 * left out, the controversies, the outlets, and the reader's own page. Every
 * other screen opens over them and goes back to them.
 */
export default function TabsLayout() {
    return (
        <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" options={{ title: "היום" }} />
            <Tabs.Screen name="blindspots" options={{ title: "נקודות עיוורות" }} />
            <Tabs.Screen name="controversies" options={{ title: "מחלוקות" }} />
            <Tabs.Screen name="outlets" options={{ title: "גופים" }} />
            <Tabs.Screen name="me" options={{ title: "אני" }} />
        </Tabs>
    );
}
