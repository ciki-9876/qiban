import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const image='system-images;android-36;default;x86_64';
const packageId='io.github.ciki9876.qiban.dev';
const serial='emulator-5554';
export function instrumentationPassed(text){return /OK \(1 test\)/.test(text)&&!/FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_RESULT: shortMsg/.test(text);}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function exists(file){try{await access(file);return true;}catch{return false;}}

export async function smokeAndroid(){
  // This script must never provision the user's computer or touch its ADB state.
  if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw Error('Android smoke requires a fresh GitHub Linux runner. Local SDK licenses and devices are untouched.');
  const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  if(!sdk||!process.env.RUNNER_TEMP)throw Error('Runner Android SDK and temporary directory are required.');
  const output=path.join(root,'artifacts/android-smoke');await mkdir(output,{recursive:true});
  const isolated=path.join(process.env.RUNNER_TEMP,'qiban-android-smoke');await mkdir(isolated,{recursive:true,mode:0o700});
  const env={...process.env,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_USER_HOME:path.join(isolated,'user'),ANDROID_AVD_HOME:path.join(isolated,'avd')};
  await mkdir(env.ANDROID_USER_HOME,{recursive:true,mode:0o700});await mkdir(env.ANDROID_AVD_HOME,{recursive:true,mode:0o700});
  const report={platform:'android',commit:process.env.GITHUB_SHA||null,image,licenseAcceptance:false,isolatedDevice:true,realCredentialsUsed:false,status:'running',stage:'sdk'};
  let emulator;
  async function save(){await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
  async function command(binary,args,{timeout=120000,log,allowFailure=false}={}){
    const stream=log?createWriteStream(path.join(output,log)):null;
    let text='';
    let result;
    try{
      result=await new Promise((resolve,reject)=>{
        const child=spawn(binary,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
        const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error(`${path.basename(binary)} exceeded its smoke-test timeout.`));},timeout);
        const collect=chunk=>{text+=chunk;if(stream&&!stream.writableEnded)stream.write(chunk);};child.stdout.on('data',collect);child.stderr.on('data',collect);
        child.on('error',error=>{clearTimeout(timer);reject(error);});
        child.on('close',code=>{clearTimeout(timer);resolve(code);});
      });
    }finally{await new Promise(resolve=>stream?stream.end(resolve):resolve());}
    if(result!==0&&!allowFailure)throw Error(`${path.basename(binary)} failed (${result}); see ${log||'runner logs'}. No license was accepted.`);
    return {code:result,text};
  }
  const adb=path.join(sdk,'platform-tools/adb');
  const device=args=>command(adb,['-s',serial,...args]);
  try{
    await save();
    // setup-android's package installer sends 'y'; invoke SDK manager ourselves
    // with closed stdin so a newly required agreement fails instead of being accepted.
    await command('sdkmanager',['emulator',image],{timeout:360000,log:'sdk-install.log'});
    if(!await exists(path.join(sdk,'emulator/emulator'))||!await exists(path.join(sdk,'system-images/android-36/default/x86_64/system.img')))throw Error('AOSP emulator/image is unavailable. Review sdk-install.log for missing packages or unaccepted licenses.');
    if(!await exists('/dev/kvm'))throw Error('This runner has no KVM device; no software-only fallback is used.');
    // Access is limited to this ephemeral runner's primary group.
    await command('sudo',['chgrp',String(process.getgid()),'/dev/kvm']);
    await command('sudo',['chmod','g+rw','/dev/kvm']);
    await command('avdmanager',['create','avd','--name','qiban-ci-api36','--package',image,'--device','pixel'],{log:'avd-create.log'});
    report.stage='boot';await save();
    const emulatorLog=createWriteStream(path.join(output,'emulator.log'));
    emulator=spawn(path.join(sdk,'emulator/emulator'),['-avd','qiban-ci-api36','-port','5554','-no-window','-no-audio','-no-boot-anim','-no-snapshot','-wipe-data','-gpu','swiftshader','-accel','on','-cores','2','-memory','2048','-camera-back','none','-camera-front','none'],{env,stdio:['ignore','pipe','pipe']});
    emulator.stdout.pipe(emulatorLog,{end:false});emulator.stderr.pipe(emulatorLog,{end:false});emulator.on('close',()=>emulatorLog.end());
    emulator.on('error',error=>{report.emulatorError=error.message;});
    let booted=false;const until=Date.now()+240000;
    while(Date.now()<until){
      if(emulator.exitCode!==null||report.emulatorError)throw Error('Emulator stopped during boot; see emulator.log.');
      const state=await command(adb,['-s',serial,'shell','getprop','sys.boot_completed'],{timeout:10000,allowFailure:true});
      if(state.code===0&&state.text.trim()==='1'){booted=true;break;}await delay(2000);
    }
    if(!booted)throw Error('Emulator did not boot within four minutes.');
    report.bootCompleted=true;await device(['shell','input','keyevent','82']);
    report.stage='instrumentation';await save();
    await device(['install','-r',path.join(root,'clients/mobile/android/app/build/outputs/apk/debug/app-debug.apk')]);
    await device(['install','-r',path.join(root,'clients/mobile/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')]);
    const test=await command(adb,['-s',serial,'shell','am','instrument','-w','-r','-e','class',`${packageId}.AndroidSmokeTest`,'-e','qibanIsolatedAvd','true',`${packageId}.test/androidx.test.runner.AndroidJUnitRunner`],{timeout:180000,log:'instrumentation.log'});
    if(!instrumentationPassed(test.text))throw Error('Android login/storage instrumentation failed; see instrumentation.log.');
    await device(['pull',`/sdcard/Android/data/${packageId}/files/ci-smoke/login.png`,path.join(output,'login.png')]);
    await device(['pull',`/sdcard/Android/data/${packageId}/files/ci-smoke/device-report.json`,path.join(output,'device-report.json')]);
    report.device=JSON.parse(await readFile(path.join(output,'device-report.json'),'utf8'));
    if(report.device.secureStoreWriteReadDelete!==true||report.device.realCredentialsUsed!==false)throw Error('Device fixture report is incomplete.');
    report.status='passed';report.stage='complete';console.log('Android smoke passed: bundled login and isolated encrypted fixture write/read/delete.');
  }catch(error){
    report.status='failed';report.error=error.message;
    if(emulator&&report.bootCompleted){
      await command(adb,['-s',serial,'shell','screencap','-p','/sdcard/qiban-ci-failure.png'],{allowFailure:true}).catch(()=>{});
      await command(adb,['-s',serial,'pull','/sdcard/qiban-ci-failure.png',path.join(output,'failure.png')],{allowFailure:true}).catch(()=>{});
      await command(adb,['-s',serial,'logcat','-d','-v','brief','AndroidRuntime:E','*:S'],{allowFailure:true,log:'android-errors.log'}).catch(()=>{});
    }
    throw error;
  }finally{
    await save();
    if(emulator&&emulator.exitCode===null){
      await new Promise(resolve=>{
        const stop=setTimeout(()=>{emulator.kill('SIGKILL');resolve();},5000);
        emulator.once('close',()=>{clearTimeout(stop);resolve();});emulator.kill('SIGTERM');
      });
    }
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  smokeAndroid().catch(error=>{console.error(error.message);process.exitCode=1;});
}
