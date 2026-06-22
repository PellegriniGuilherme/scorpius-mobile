// Override autolinking for the `expo` module.
// The autolinking reads namespace from expo/android/build.gradle which says
// "expo.core", but the actual ExpoModulesPackage.kt is at package expo.modules.
// This causes the generated PackageList.java to have the wrong import path.
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
          packageInstance: 'new expo.modules.ExpoModulesPackage()',
        },
      },
    },
  },
};
