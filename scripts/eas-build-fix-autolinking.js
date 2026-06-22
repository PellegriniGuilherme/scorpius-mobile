/* eslint-disable @typescript-eslint/no-require-imports, no-console */
// CommonJS script (EAS build fix) — rodado em CI/build, não em runtime.
// console.log é usado para debug em `eas build` logs.
const fs = require('fs');
const path = require('path');

const autolinkingDir = path.join(
  process.cwd(),
  'android',
  'app',
  'build',
  'generated',
  'autolinking',
  'src',
  'main',
  'java',
  'com',
  'facebook',
  'react'
);

const file = path.join(autolinkingDir, 'PackageList.java');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  
  // Patch 1: import path
  content = content.replace(
    'import expo.core.ExpoModulesPackage;',
    'import expo.modules.ExpoModulesPackage;'
  );
  
  // Patch 2: instantiation
  content = content.replace(
    'new ExpoModulesPackage()',
    'new expo.modules.ExpoModulesPackage()'
  );
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('[✅] Patched PackageList.java with correct ExpoModulesPackage path');
  } else {
    console.log('[ℹ️] PackageList.java does not need patching');
  }
} else {
  console.log('[⚠️] PackageList.java not found at ' + file);
}
