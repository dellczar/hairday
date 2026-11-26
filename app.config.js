// Adds settings that come from .env (never committed) on top of app.json.
// GOOGLE_MAPS_ANDROID_API_KEY: Google Maps for Android (Phase 0, Google Cloud). iPhone uses Apple Maps — no key.
// google-services.json: Firebase settings for Android push notifications. Kept on this Mac (gitignored);
// builds without it still work, they just can't get a push address on Android.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleServices = path.join(process.cwd(), 'google-services.json');
  const android = fs.existsSync(googleServices)
    ? { ...(config.android ?? {}), googleServicesFile: './google-services.json' }
    : config.android;
  return {
    ...config,
    android,
    plugins: [...(config.plugins ?? []), ['react-native-maps', androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}]],
    extra: { ...(config.extra ?? {}), hasAndroidMapsKey: !!androidMapsKey },
  };
};
