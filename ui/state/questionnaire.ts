import { createContext, useContext } from "react";
import { ReaderProfile } from "./profile";

/**
 * The questionnaire, reachable from anywhere.
 *
 * It used to stand in the doorway: no answers, no app. That is a lot to ask of
 * someone who has not seen the thing yet, so it is now an offer made in three
 * places - the end of the tour, which a first visit opens on by itself, the
 * analytics page that needs it, and a reminder that can be turned off - and the
 * app works without it either way.
 */
type Ctx = {
	profile: ReaderProfile | null;
	/** true once the reader has answered */
	filled: boolean;
	open: () => void;
};

export const QuestionnaireContext = createContext<Ctx>({
	profile: null, filled: false, open: () => {},
});

export const useQuestionnaire = () => useContext(QuestionnaireContext);
