// ---------------------------------------------------------------------------
// withNotifeeMavenRepo — Expo config plugin.
//
// @notifee/react-native ships its `app.notifee:core` AAR bundled locally and
// normally registers that Maven repo from inside its OWN subproject build.gradle
// (via rootProject.allprojects). That works for a normal Gradle build, but
// `expo run:android` runs with `--configure-on-demand`, so the Notifee subproject
// isn't configured before :app resolves dependencies — and the repo is missing,
// causing: "Could not find any matches for app.notifee:core:+".
//
// Registering the repo at the ROOT project (which is always configured) fixes it
// regardless of configure-on-demand. Doing it via a config plugin keeps it in
// app.json so it survives every `expo prebuild`.
// ---------------------------------------------------------------------------

const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '@notifee/react-native/android/libs';
const NOTIFEE_REPO = `maven {
            // Notifee bundles its core AAR locally; register the repo at the root so it
            // resolves even with Gradle --configure-on-demand (used by expo run:android).
            url "$rootDir/../node_modules/@notifee/react-native/android/libs"
        }`;

module.exports = function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes(MARKER)) return cfg; // idempotent

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}\n        ${NOTIFEE_REPO}`
    );
    return cfg;
  });
};
