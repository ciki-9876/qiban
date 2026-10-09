import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {sanitizeContext,validateResult} from '../ai.mjs';
const box={};vm.runInNewContext(await readFile(new URL('../record-input.js',import.meta.url),'utf8'),box);const R=box.QibanRecordInput;
test('legacy draft fields merge once, without losing either text or changing history',()=>{
 const old={text:'我完成了界面',observation:'按钮已经可以使用',confirmed:[1]};const snapshot=JSON.stringify(old);
 const merged=R.unify(old);assert.equal(merged.text,'我完成了界面\n\n按钮已经可以使用');assert.equal(R.unify(merged).text,merged.text);assert.equal(JSON.stringify(old),snapshot);
 assert.equal(R.unify({text:'按钮已经可以使用',observation:'按钮已经可以使用'}).text,'按钮已经可以使用');
 assert.equal(R.unify({text:'',observation:'只有感受'}).text,'只有感受');
});
test('one input becomes personal evidence only with explicit confirmation, and deleted text stays deleted',()=>{
 const d=R.unify({text:'做了',observation:'体验完成',confirmed:[]});assert.equal(R.observation(d),'');assert.equal(R.observation({...d,confirmed:[0]}),'做了\n\n体验完成');assert.equal(R.observation({...d,text:'',confirmed:[0]}),'');
});
test('full legacy draft fits new limit and flows through personal evidence validation',()=>{
 const merged=R.unify({text:'a'.repeat(4000),observation:'b'.repeat(1500),confirmed:[0]});
 const contract={kind:'decision',outcome:'留下体验',criteria:[{label:'已体验',method:'experience'}]};
 const input={goal:'目标',task:{title:'试用',prompt:'',criteria:['已体验'],contract},current:merged.text,previous:[],delivery:{artifactIds:[],link:'',confirmed:[0],observation:R.observation(merged)}};
 const c=sanitizeContext(input,'feedback');assert.equal(c.current.length,5502);assert.equal(c.delivery.observation,c.current);
 const f={grade:'A',title:'体验已确认',strength:'本人确认',hint:'',comparison:'',checks:[{label:'已体验',pass:true,evidence:'bbb',source:'observation'}]};assert.equal(validateResult(f,'feedback',c).checks[0].status,'self');
 assert.throws(()=>validateResult(f,'feedback',{...c,delivery:{...c.delivery,confirmed:[]}}));
});
