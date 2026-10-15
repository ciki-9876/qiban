import {LiveUpdate} from '@capawesome/capacitor-live-update';
import manifest from './manifest.cjs';
import config from './config.json';
export function mobileUpdater(native) {
  let checking;
  return Object.freeze({
    ready: () => LiveUpdate.ready(),
    check: () => checking ||= (async () => {
      const response = await native.updateManifest({});
      if (response.status === 404) return {status:'current'};
      if (response.status !== 200) throw Error('暂时无法检查更新，当前版本仍可使用。');
      return manifest.stageUpdate({api:LiveUpdate,envelope:response.data,config,target:'mobile'});
    })().finally(() => { checking = null; })
  });
}
