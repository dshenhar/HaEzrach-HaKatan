import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { allowMeasurement } from "./analytics";

/**
 * Whether the reader has agreed to be measured.
 *
 * Three states, and the difference matters: "asked and yes", "asked and no", and
 * "not asked yet". Measurement is off in the third as firmly as in the second -
 * silence is not agreement - and the banner is shown only in the third, so a
 * reader who said no is not asked again every morning.
 *
 * The answer is kept on the device and nowhere else; changing it in the personal
 * area takes effect in the same breath.
 */
const KEY = "measure_consent";

export type Consent = "yes" | "no" | "unasked";

type Ctx = { consent: Consent; answer: (next: "yes" | "no") => void };

const ConsentContext = createContext<Ctx>({ consent: "unasked", answer: () => {} });

export const useConsent = () => useContext(ConsentContext);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
    const [consent, setConsent] = useState<Consent>("unasked");

    useEffect(() => {
        AsyncStorage.getItem(KEY).then((stored) => {
            if (stored === "yes" || stored === "no") {
                setConsent(stored);
                allowMeasurement(stored === "yes");
            }
        }).catch(() => {});
    }, []);

    const answer = (next: "yes" | "no") => {
        setConsent(next);
        allowMeasurement(next === "yes");
        AsyncStorage.setItem(KEY, next).catch(() => {});
    };

    return React.createElement(ConsentContext.Provider, { value: { consent, answer } }, children);
}
