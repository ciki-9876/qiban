import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareArtifact} from '../artifacts.mjs';
import {buildRequest,validateResult} from '../ai.mjs';
const a=prepareArtifact({name:'image.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='});
a.imageUrl='data:'+a.mime+';base64,'+a.base64;
const contract={kind:'artifact',outcome:'截图可见首页',criteria:[{label:'可见首页',method:'content'}]};
const ctx={task:{contract,criteria:['可见首页']},current:'完成',previous:[],delivery:{artifacts:[a],artifactIds:[a.id],confirmed:[]}};
const f={grade:'A',title:'可见',strength:'已观察图片',hint:'',comparison:'',checks:[{label:'可见首页',pass:true,evidence:'画面上方显示首页标题',source:a.id}]};
test('image goes in multimodal part exactly once, not in JSON text',()=>{
 const b=buildRequest({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',tokenField:'max_tokens'},'feedback',ctx);
 const parts=b.messages[1].content;assert.equal(parts[2].image_url.url,a.imageUrl);assert.ok(!parts[0].text.includes(a.base64));
});
test('visual observation accepts image evidence but not forged image or runtime confirmation',()=>{
 const r=validateResult(f,'feedback',ctx);assert.equal(r.grade,'A');assert.equal(r.checks[0].status,'visual');
 assert.throws(()=>validateResult(f,'feedback',{...ctx,delivery:{...ctx.delivery,artifacts:[{...a,imageUrl:undefined}]}}));
 const runtime={...ctx,task:{...ctx.task,contract:{...contract,criteria:[{label:'可见首页',method:'experience'}]}}};assert.throws(()=>validateResult(f,'feedback',runtime));
});
test('fake image bytes are rejected',()=>assert.throws(()=>prepareArtifact({name:'fake.png',base64:Buffer.from('not an image').toString('base64')})));
test('saved image hydration includes image bytes for model input',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const {saveArtifact,hydrateEvidence}=await import('../artifacts.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-vision-'));
 try{await saveArtifact(dir,a);const hydrated=await hydrateEvidence(dir,ctx);assert.equal(hydrated.delivery.artifacts[0].imageUrl,a.imageUrl);}finally{await rm(dir,{recursive:true,force:true});}
});
