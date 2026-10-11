import { useCallback, useRef } from "react";

/**
 * A callback that can be held on to: its identity never changes, so what holds it
 * does not re-render when the screen does, and it still runs against the latest
 * state.
 */
export function useStable<T extends (...args: any[]) => any>(fn: T): T {
	const held = useRef(fn);
	held.current = fn;
	return useCallback(((...args: any[]) => held.current(...args)) as T, []);
}
