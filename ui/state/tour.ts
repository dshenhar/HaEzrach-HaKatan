import { createContext, useContext } from "react";

/**
 * A first visit opens on the tour. It used to open on a welcome card that asked
 * for the questionnaire before the reader had seen a single story; now the feed
 * comes up, and the tour that explains it starts by itself - the same one the i
 * runs, ending with the questionnaire. `due` is true once, until the feed has
 * started it.
 */
type Arrival = {
	due: boolean;
	done: () => void;
	/** the reader's very first visit: the tour ends by opening the questionnaire */
	first: boolean;
};

export const ArrivalTour = createContext<Arrival>({ due: false, done: () => {}, first: false });

/**
 * For now the tour runs every time the app is opened, as the owner asked while the
 * explanation is being shaped; it is to go back to the first visit only.
 */
export const TOUR_EVERY_OPEN = true;

export const useArrivalTour = () => useContext(ArrivalTour);
