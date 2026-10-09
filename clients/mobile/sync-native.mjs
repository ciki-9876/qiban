import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
async function rewrite(file, edit) {
  const before = await fs.readFile(file, 'utf8'), after = edit(before);
  if (after !== before) await fs.writeFile(file, after);
}

// Keep custom security code in source files independent of Capacitor-generated resources.
for (const name of ['MainActivity.java', 'QibanNativePlugin.java']) {
  await fs.copyFile(path.join(root, 'native/android', name), path.join(root, 'android/app/src/main/java/io/github/ciki9876/qiban/dev', name));
}
for (const name of ['QibanViewController.swift', 'QibanNativePlugin.swift']) {
  await fs.copyFile(path.join(root, 'native/ios', name), path.join(root, 'ios/App/App', name));
}
await rewrite(path.join(root, 'android/variables.gradle'), text => text.replace(/minSdkVersion = \d+/, 'minSdkVersion = 29'));
await rewrite(path.join(root, 'android/app/build.gradle'), text => text.replace(/versionCode \d+/, 'versionCode 900').replace(/versionName "[^"]+"/, 'versionName "0.9.0"'));
await rewrite(path.join(root, 'android/app/src/main/AndroidManifest.xml'), text => text
  .replace('android:allowBackup="true"', 'android:allowBackup="false"\n        android:usesCleartextTraffic="false"')
  .replace('android:exported="true">', 'android:exported="true"\n            android:windowSoftInputMode="adjustResize">'));
await fs.writeFile(path.join(root, 'android/app/src/main/res/xml/file_paths.xml'), `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="qiban_exports" path="qiban-exports/" />
</paths>
`);
await rewrite(path.join(root, 'ios/App/App/Base.lproj/Main.storyboard'), text => text.replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="QibanViewController" customModule="App"'));
await rewrite(path.join(root, 'ios/App/App/SceneDelegate.swift'), text => text.replace('window?.rootViewController = CAPBridgeViewController()', 'window?.rootViewController = QibanViewController()'));
await rewrite(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), text => {
  text = text.replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 16.0;')
    .replace(/MARKETING_VERSION = [\d.]+;/g, 'MARKETING_VERSION = 0.9.0;').replace(/CURRENT_PROJECT_VERSION = \d+;/g, 'CURRENT_PROJECT_VERSION = 900;');
  for (const [index, name] of ['QibanNativePlugin.swift', 'QibanViewController.swift'].entries()) {
    if (text.includes(`/* ${name} in Sources */`)) continue;
    const fileId = `9B1BA900000000000000000${index}`, buildId = `9B1BA900000000000000001${index}`;
    text = text.replace('/* End PBXBuildFile section */', `\t\t${buildId} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* ${name} */; };\n/* End PBXBuildFile section */`);
    text = text.replace('/* End PBXFileReference section */', `\t\t${fileId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`);
    text = text.replace('504EC3071FED79650016851F /* AppDelegate.swift */,', `${fileId} /* ${name} */,\n\t\t\t\t504EC3071FED79650016851F /* AppDelegate.swift */,`);
    text = text.replace('504EC3081FED79650016851F /* AppDelegate.swift in Sources */,', `${buildId} /* ${name} in Sources */,\n\t\t\t\t504EC3081FED79650016851F /* AppDelegate.swift in Sources */,`);
  }
  return text;
});
await rewrite(path.join(root, 'ios/App/CapApp-SPM/Package.swift'), text => text.replace('platforms: [.iOS(.v15)]', 'platforms: [.iOS(.v16)]'));

console.log('Native security bridge and platform defaults synchronized.');
