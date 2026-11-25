// Android store builds (Google Play).
// 1) Signs release builds with the HairDay upload key when its settings file exists on this Mac
//    (~/.hairday-keys/upload-key.properties, or the path in HAIRDAY_UPLOAD_PROPERTIES). The key and
//    its passwords never go into the repo; without the file, release builds fall back to the debug key.
// 2) Lets the app shrink (R8) without failing on Stripe's optional "add card to wallet" classes,
//    which Hairday doesn't use.
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const SIGNING = `
// HairDay upload key (see plugins/with-android-release.js)
def hairdayKeyProps = new Properties()
def hairdayKeyFile = new File(System.getenv('HAIRDAY_UPLOAD_PROPERTIES') ?: (System.getProperty('user.home') + '/.hairday-keys/upload-key.properties'))
if (hairdayKeyFile.exists()) { hairdayKeyFile.withInputStream { hairdayKeyProps.load(it) } }
`;

module.exports = function withAndroidRelease(config) {
  config = withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (!g.includes('hairdayKeyProps')) {
      g = g.replace(/^android \{/m, `${SIGNING}\nandroid {`);
      g = g.replace(
        /signingConfigs \{\s*debug \{/,
        `signingConfigs {
        release {
            if (hairdayKeyFile.exists()) {
                storeFile file(hairdayKeyProps['HAIRDAY_UPLOAD_STORE_FILE'])
                storePassword hairdayKeyProps['HAIRDAY_UPLOAD_STORE_PASSWORD']
                keyAlias hairdayKeyProps['HAIRDAY_UPLOAD_KEY_ALIAS']
                keyPassword hairdayKeyProps['HAIRDAY_UPLOAD_KEY_PASSWORD']
            }
        }
        debug {`,
      );
      g = g.replace(
        /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
        `$1signingConfig hairdayKeyFile.exists() ? signingConfigs.release : signingConfigs.debug`,
      );
    }
    c.modResults.contents = g;
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const rule = '-dontwarn com.stripe.android.pushProvisioning.**';
      const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!now.includes(rule)) fs.writeFileSync(file, `${now}\n# Stripe's optional wallet provisioning (not used by Hairday)\n${rule}\n`);
      return c;
    },
  ]);
  return config;
};
