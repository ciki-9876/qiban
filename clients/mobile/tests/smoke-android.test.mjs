import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {instrumentationPassed,smokeAndroid} from '../smoke-android.mjs';
test('Android instrumentation accepts only an actual passing test summary',()=>{
  assert.equal(instrumentationPassed('Time: 1.2\nOK (1 test)\nINSTRUMENTATION_CODE: -1'),true);
  for(const output of ['INSTRUMENTATION_CODE: -1','FAILURES!!!\nTests run: 1, Failures: 1','OK (1 test)\nINSTRUMENTATION_FAILED','INSTRUMENTATION_RESULT: shortMsg=Process crashed.'])assert.equal(instrumentationPassed(output),false);
});
test('Android smoke cannot provision the user computer and never auto-accepts SDK licenses',async()=>{
  if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux')await assert.rejects(smokeAndroid(),/fresh GitHub Linux runner/);
  const source=await readFile(new URL('../smoke-android.mjs',import.meta.url),'utf8');
  assert.match(source,/stdio:\['ignore','pipe','pipe'\]/);assert.doesNotMatch(source,/--licenses|fill\('y'\)|yes\s*\|/);
});
