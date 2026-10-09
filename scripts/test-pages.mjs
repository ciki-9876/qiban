import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs');
const page=await readFile(path.join(docs,'index.html'),'utf8');
test('Pages build has only self-hosted frontend dependencies and no local private files',async()=>{
 assert.match(page,/qiban-static-preview/);
 for(const match of page.matchAll(/<(?:script[^>]*src|link[^>]*href)="([^"\s]+\.(?:js|css))"/g))assert.ok((await stat(path.join(docs,match[1]))).isFile());
 const files=['server.mjs','ai-config.json','.env'];
 for(const name of files)await assert.rejects(stat(path.join(docs,name)));
});
test('public preview boots without an AI request or a credential entry form',async()=>{
 const elements=new Map(),events=new Map(),store=new Map(),requests=[];
 function element(){return {innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},addEventListener(type,fn){this[type]=fn;},setAttribute(){},removeAttribute(){},querySelector(){return element();},querySelectorAll(){return [];},showModal(){this.open=true;},focus(){}};}
 const document={visibilityState:'visible',activeElement:null,querySelector(selector){if(selector==='meta[name="qiban-static-preview"]')return {content:'true'};if(selector.startsWith('meta['))return null;if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll(){return [];},addEventListener(type,fn){events.set(type,fn);}};
 const env={URL,Date,console,document,location:{protocol:'https:',hash:'#outings'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},fetch:async(...args)=>{requests.push(args);throw Error('unexpected network request')},setTimeout,clearTimeout};
 env.window={addEventListener(){},scrollTo(){}};
 for(const match of page.matchAll(/<script src="([^"]+)"/g))vm.runInNewContext(await readFile(path.join(docs,match[1]),'utf8'),env,{filename:match[1]});
 await new Promise(r=>setImmediate(r));
 assert.equal(requests.length,0);assert.match(elements.get('#main').innerHTML,/栖栖带回的/);
 elements.get('#ai-connection').click();assert.match(elements.get('#workspace-dialog').innerHTML,/在线预览/);assert.doesNotMatch(elements.get('#workspace-dialog').innerHTML,/id="ai-key"/);
});
