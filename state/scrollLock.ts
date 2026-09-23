import { createContext, useContext } from "react";

/**
 * Lets something deep in a story hold the feed still.
 *
 * Dragging the outlet rail is a vertical gesture inside a vertical scroller, and
 * both were moving at once - the feed crawled while the rail followed the finger.
 * The feed owns the flag; whoever takes over a gesture raises it and drops it when
 * the finger lifts.
 */
export const ScrollLock = createContext<(locked: boolean) => void>(() => {});

export const useScrollLock = () => useContext(ScrollLock);
