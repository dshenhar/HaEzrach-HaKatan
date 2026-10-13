import React from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";
import { Link } from "expo-router";
import { useSite } from "./tokens";

type GoProps = {
    href: any;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode | ((state: { hovered: boolean; pressed: boolean }) => React.ReactNode);
    onPress?: () => void;
    label?: string;
    /** no tint while held: for a link that is only words */
    plain?: boolean;
    selected?: boolean;
};

/**
 * A link that is a real link - an anchor on the web, so it can be opened in a
 * new tab - and that answers a touch. The router hands its child a fixed style,
 * so the tint lives on an inner layer that has the room's whole box.
 */
export function Go({ href, style, children, onPress, label, plain, selected }: GoProps) {
    const { c } = useSite();
    return (
        <Link href={href} asChild onPress={onPress}>
            <Pressable accessibilityRole="link" accessibilityLabel={label} accessibilityState={selected ? { selected } : undefined}>
                {({ pressed, hovered }: any) => (
                    <View style={[style, !plain && (pressed || hovered) && { backgroundColor: c.pressed }]}>
                        {typeof children === "function" ? children({ hovered: !!hovered, pressed: !!pressed }) : children}
                    </View>
                )}
            </Pressable>
        </Link>
    );
}
