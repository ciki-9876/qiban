import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, utimes} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assertComparisonContext, assertInstalledBundle, assertSourcePaths, crashMetadata, ownCrashMetadata, removeLegacyArmv7} from '../ios-compare-capability.mjs';

const udid='12345678-1234-1234-1234-123456789ABC',id='io.github.ciki9876.qiban.dev',sha='a'.repeat(40);
const installed='/Users/runner/Library/Developer/CoreSimulator/Devices/'+udid+'/data/Containers/Bundle/Application/fixture/App.app';
const a={device:{udid},bundleId:id,platform:'iOS Simulator',signing:'simulator-adhoc',sourceCommit:sha,ciRunId:'1234',ciRunAttempt:'1',result:'failed',stage:'launch_app',checkedAt:new Date(Date.now()-1000).toISOString()};
const startup={freshHostedSimulator:true,commands:[{result:'success',command:'xcrun',args:['simctl','boot',udid]}]};
const env={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:sha,GITHUB_RUN_ID:'1234',GITHUB_RUN_ATTEMPT:'1'};
const info={CFBundleIdentifier:id,CFBundleExecutable:'App',CFBundleSupportedPlatforms:['iPhoneSimulator']};
test('capability comparison requires this hosted commit, original failed launch and independently proved boot',()=>{
  assert.equal(assertComparisonContext(a,startup,env).udid,udid);
  for(const altered of [{...env,GITHUB_ACTIONS:'false'},{...env,RUNNER_ENVIRONMENT:'self-hosted'},{...env,GITHUB_SHA:'b'.repeat(40)},{...env,GITHUB_RUN_ID:'5678'},{...env,GITHUB_RUN_ATTEMPT:'2'}])assert.throws(()=>assertComparisonContext(a,startup,altered));
  for(const altered of [{...a,result:'started'},{...a,stage:'install_app'},{...a,bundleId:'other.app'},{...a,checkedAt:new Date(Date.now()-46*60000).toISOString()}])assert.throws(()=>assertComparisonContext(altered,startup,env));
  assert.throws(()=>assertComparisonContext(a,{...startup,freshHostedSimulator:false},env));
  assert.throws(()=>assertComparisonContext(a,{...startup,commands:[]},env));
  assertInstalledBundle(installed,udid,info);
  assert.throws(()=>assertInstalledBundle('/Users/person/private/App.app',udid,info));
  assert.throws(()=>assertInstalledBundle(installed,udid,{...info,CFBundleIdentifier:'other.app'}));
  const workspace='/ci/qiban',original=workspace+'/artifacts/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app',output=workspace+'/artifacts/ios';
  assertSourcePaths(workspace,original,output);assert.throws(()=>assertSourcePaths(workspace,workspace+'/another/App.app',output));assert.throws(()=>assertSourcePaths(workspace,original,'/outside/evidence'));
});
test('B changes only the legacy armv7 capability and leaves the original metadata untouched',()=>{
  const original={...info,MinimumOSVersion:'16.0',UIRequiredDeviceCapabilities:['armv7','wifi'],arbitrary:{same:true}};
  const adjusted=removeLegacyArmv7(original);
  assert.deepEqual(adjusted,{...original,UIRequiredDeviceCapabilities:['wifi']});assert.deepEqual(original.UIRequiredDeviceCapabilities,['armv7','wifi']);
  assert.equal('UIRequiredDeviceCapabilities' in removeLegacyArmv7({...original,UIRequiredDeviceCapabilities:['armv7']}),false);
  assert.throws(()=>removeLegacyArmv7({...original,UIRequiredDeviceCapabilities:['arm64']}));
});
test('own crash selection exports only exception/termination/architecture and refuses other bundle paths',()=>{
  const body=JSON.stringify({procPath:installed+'/App',cpuType:'ARM-64',exception:{type:'EXC_CRASH',signal:'SIGABRT',private:'must-not-export'},termination:{namespace:'CODESIGNING',code:2,indicator:'Invalid Page',private:'must-not-export'},threads:[{payload:'must-not-export'}]});
  const metadata=crashMetadata({bundleID:id},body,installed,udid);
  assert.deepEqual(metadata,{bundleId:id,binaryName:'App',arch:'ARM-64',exception:{type:'EXC_CRASH',signal:'SIGABRT'},termination:{namespace:'CODESIGNING',code:2,indicator:'Invalid Page'}});
  assert.equal(crashMetadata({bundleID:'other.app'},body,installed,udid),null);
  assert.equal(crashMetadata({bundleID:id},body.replace('/App"','/Other"'),installed,udid),null);
  assert.equal(crashMetadata({bundleID:id},body,installed,'other-device'),null);
});
test('crash reader selects only newly produced own App headers and ignores unrelated or old reports',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'qiban-own-crash-fixture-'));
  try{
    await mkdir(folder,{recursive:true});const now=Date.now();
    const body=JSON.stringify({procPath:installed+'/App',cpuType:'ARM-64',exception:{type:'EXC_BAD_ACCESS'},termination:{code:11},threads:[{secret:'synthetic-never-export'}]});
    await writeFile(path.join(folder,'App-own.ips'),JSON.stringify({bundleID:id})+'\n'+body);
    await writeFile(path.join(folder,'App-other.ips'),JSON.stringify({bundleID:'other.app'})+'\n'+body);
    await writeFile(path.join(folder,'App-old.ips'),JSON.stringify({bundleID:id})+'\n'+body);await utimes(path.join(folder,'App-old.ips'),new Date(now-10000),new Date(now-10000));
    await writeFile(path.join(folder,'Other-own.ips'),JSON.stringify({bundleID:id})+'\n'+body);
    const reports=await ownCrashMetadata(folder,installed,udid,now-1000);
    assert.equal(reports.length,1);assert.equal(reports[0].exception.type,'EXC_BAD_ACCESS');assert.doesNotMatch(JSON.stringify(reports),/secret|threads|synthetic-never-export/);
  }finally{await rm(folder,{recursive:true,force:true});}
});
