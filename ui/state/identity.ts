import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "voter_id";
let cached: string | null = null;

const make = () => {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
	let out = "";
	for (let i = 0; i < 24; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
	return out;
};

/**
 * A random string this device made up, sent with a rating so the same person
 * cannot rate the same article twice.
 *
 * It is not a cookie and not an account: it says nothing about who you are, it
 * never leaves the ratings, and clearing the app's data ends it. Deleting your
 * ratings (the personal area) sends it once more, to say which ones to remove.
 */
export const getDeviceId = async (): Promise<string> => {
	if (cached) return cached;
	try {
		const stored = await AsyncStorage.getItem(KEY);
		if (stored) { cached = stored; return stored; }
	} catch {}
	const fresh = make();
	cached = fresh;
	AsyncStorage.setItem(KEY, fresh).catch(() => {});
	return fresh;
};

export const forgetDeviceId = async () => {
	cached = null;
	await AsyncStorage.removeItem(KEY).catch(() => {});
};
