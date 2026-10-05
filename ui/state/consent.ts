import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { setMeasuring } from "./analytics";

/**
 * Whether the reader wants to be counted.
 *
 * It is on unless they turn it off, and there is no banner. The measurement writes
 * no identifier and can join no two visits (see analytics.ts), so there is nothing
 * to ask permission for - and a news app that stops a stranger at the door to
 * negotiate about cookies has spent its first impression on paperwork. The switch
 * lives in the personal area for anyone who looks, and the privacy policy says
 * where it is.
 */
const KEY = "measure_consent";

type Ctx = { measuring: boolean; setMeasuring: (on: boolean) => void };

const ConsentContext = createContext<Ctx>({ measuring: true, setMeasuring: () => {} });

export const useConsent = () => useContext(ConsentContext);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
    const [on, setOn] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(KEY).then((stored) => {
            if (stored === "no") {
                setOn(false);
                setMeasuring(false);
            }
        }).catch(() => {});
    }, []);

    const choose = (next: boolean) => {
        setOn(next);
        setMeasuring(next);
        AsyncStorage.setItem(KEY, next ? "yes" : "no").catch(() => {});
    };

    return React.createElement(
        ConsentContext.Provider,
        { value: { measuring: on, setMeasuring: choose } },
        children,
    );
}
