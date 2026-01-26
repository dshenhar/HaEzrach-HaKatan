import React from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, I18nManager } from "react-native";

interface CategoryFilterProps {
    categories: Set<string>;
    selectedCategories: string[];
    onCategoryToggle: (category: string) => void;
}

export function CategoryFilter({ categories, selectedCategories, onCategoryToggle } : CategoryFilterProps) {
    return (
        <View style={styles.container}>
            <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            >
                {[...categories].map((category, index) => {
                    const selected = selectedCategories.includes(category);
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                            styles.badge,
                            selected ? styles.badgeSelected : styles.badgeUnselected,
                            ]}
                            onPress={() => onCategoryToggle(category)}
                        >
                            <Text
                            style={[
                                styles.badgeText,
                                selected ? styles.badgeTextSelected : styles.badgeTextUnselected,
                            ]}
                            >
                            {category}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        backgroundColor: '#f8f8f8ff',
        direction: I18nManager.isRTL ? "rtl" : "ltr",
    },
    scrollContent: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        gap: 8,
    },
    badge: {
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginRight: 1,
    },
    badgeSelected: {
        backgroundColor: "#545454ff",
    },
    badgeUnselected: {
        backgroundColor: "#dedddeff",
    },
    badgeText: {
        fontSize: 13,
    },
    badgeTextSelected: {
        color: "#ffffffff",
    },
    badgeTextUnselected: {
        color: "#000000ff",
    },
});
