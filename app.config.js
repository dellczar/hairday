// Adds settings that come from .env (never committed) on top of app.json.
// GOOGLE_MAPS_ANDROID_API_KEY: Google Maps for Android (Phase 0, Google Cloud). iPhone uses Apple Maps — no key.
module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}]],
    extra: { ...(config.extra ?? {}), hasAndroidMapsKey: !!androidMapsKey },
  };
};
