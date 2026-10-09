import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const sandbox={};vm.runInNewContext(await readFile(new URL('../attachment-input.js',import.meta.url),'utf8'),sandbox);
const {bind}=sandbox.QibanAttachmentInput;
function setup(){
  const listeners={},classes=new Set(),received=[];let available=true,rejected=0;
  const target={classList:{add:s=>classes.add(s),remove:s=>classes.delete(s)},contains:n=>n==='inside',addEventListener:(type,fn)=>listeners[type]=fn};
  bind(target,{canReceive:()=>available,onFiles:f=>received.push(f),onUnavailable:()=>rejected++});
  const fire=(type,props={})=>{let prevented=false;const event={preventDefault(){prevented=true;},...props};listeners[type](event);return {prevented,event};};
  return {fire,received,classes,setAvailable:v=>available=v,rejected:()=>rejected};
}
const png={name:'screenshot.png',type:'image/png'};
const transfer={items:[{kind:'file',getAsFile:()=>png}],types:['Files'],files:[png]};
test('image clipboard paste forwards file once and suppresses text insertion',()=>{
  const x=setup(),result=x.fire('paste',{clipboardData:transfer});assert.equal(result.prevented,true);assert.equal(x.received.length,1);assert.equal(x.received[0][0],png);
});
test('ordinary text paste and non-composer paste remain native',()=>{
  const x=setup();assert.equal(x.fire('paste',{clipboardData:{items:[{kind:'string',type:'text/plain'}]}}).prevented,false);
  x.setAvailable(false);assert.equal(x.fire('paste',{clipboardData:transfer}).prevented,false);assert.equal(x.received.length,0);
});
test('clipboard file-list fallback works without duplicate item/file uploads',()=>{
  const x=setup();x.fire('paste',{clipboardData:{files:[png]}});assert.equal(x.received[0].length,1);
  x.fire('paste',{clipboardData:transfer});assert.equal(x.received[1].length,1);
});
test('file drag highlights the dialog, drop uploads and clears highlighting',()=>{
  const x=setup();assert.equal(x.fire('dragenter',{dataTransfer:transfer}).prevented,true);assert.equal(x.classes.has('attachment-dragging'),true);
  const drag=x.fire('dragover',{dataTransfer:{...transfer}});assert.equal(drag.event.dataTransfer.dropEffect,'copy');
  assert.equal(x.fire('drop',{dataTransfer:transfer}).prevented,true);assert.equal(x.received[0][0],png);assert.equal(x.classes.size,0);
});
test('text drag remains native and readonly result cannot acquire attachments',()=>{
  const x=setup();assert.equal(x.fire('dragover',{dataTransfer:{types:['text/plain']}}).prevented,false);
  x.setAvailable(false);assert.equal(x.fire('drop',{dataTransfer:transfer}).prevented,true);assert.equal(x.received.length,0);assert.equal(x.rejected(),1);
});
test('closing dialog clears drag affordance',()=>{const x=setup();x.fire('dragenter',{dataTransfer:transfer});x.fire('close');assert.equal(x.classes.size,0);});
test('leaving the entire dialog clears highlight after nested dragenter events',()=>{
  const x=setup();x.fire('dragenter',{dataTransfer:transfer});x.fire('dragenter',{dataTransfer:transfer});x.fire('dragleave',{relatedTarget:'outside'});assert.equal(x.classes.size,0);
});
