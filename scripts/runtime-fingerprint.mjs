import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
export async function runtimeFingerprint() {
  const fixed=['clients/windows/main.cjs','clients/windows/preload.cjs','clients/windows/native-core.cjs','clients/windows/update-host.cjs','clients/windows/package.json','clients/mobile/capacitor.config.json','clients/mobile/android/app/build.gradle','clients/mobile/android/variables.gradle','clients/mobile/ios/App/App.xcodeproj/project.pbxproj','clients/updates/manifest.cjs','clients/updates/config.json'];
  for(const platform of ['ios','android'])for(const file of await readdir(path.join(root,'clients/mobile/native',platform)))fixed.push(`clients/mobile/native/${platform}/${file}`);
  const hash=createHash('sha256');
  for(const name of fixed.sort())hash.update(name+'\0').update((await readFile(path.join(root,name),'utf8')).replaceAll('\r\n','\n')).update('\0');
  const dependencies=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).dependencies;
  hash.update(JSON.stringify(dependencies));
  return hash.digest('hex');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const digest=await runtimeFingerprint();
  if(process.argv.includes('--freeze-runtime'))await writeFile(path.join(root,'clients/updates/runtime-lock.json'),JSON.stringify({runtime:'qiban-native-2',fingerprint:digest},null,2)+'\n');
  console.log('Native runtime fingerprint: '+digest);
}
