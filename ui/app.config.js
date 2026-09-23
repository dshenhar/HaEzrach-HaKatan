const base = require("./app.json");

/**
 * Expo Go only runs a project whose runtimeVersion matches its own SDK
 * ("exposdk:54.0.0"). app.json sets `runtimeVersion: {policy: "appVersion"}`,
 * which EAS builds need but which resolves to "1.0.0" - a value Expo Go cannot
 * match, so it sits on "Opening project..." until the request times out.
 *
 * Starting with EXPO_GO=1 drops the EAS-only fields for that run. EAS builds and
 * `eas update` read app.json unchanged, so nothing about the release setup moves.
 *
 *   EXPO_GO=1 npx expo start     phone, through Expo Go
 *   npx expo start               web, or a custom dev client
 */
module.exports = () => {
  const expo = { ...base.expo };

  if (process.env.EXPO_GO === "1") {
    delete expo.runtimeVersion;
    delete expo.updates;
  }

  return { expo };
};
