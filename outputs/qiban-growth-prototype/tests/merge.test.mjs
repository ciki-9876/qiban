import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';

// Exercise the HTTP request handler in memory; this environment prohibits socket listeners.
test('merged server serves version, navigation, and every new browser dependency',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-merge-'));
  try{
    const {server}=await createApp({dataDir:dir});
    server.address=()=>({port:52160});
    const request=(url,host='127.0.0.1:52160')=>new Promise(resolve=>{
      const response={destroyed:false,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,headers:this.headers,body:String(body)});}};
      server.emit('request',{method:'GET',url,headers:{host}},response);
    });
    const health=await request('/api/health');assert.equal(health.status,200);assert.deepEqual(JSON.parse(health.body),{app:'qiban',version:'0.9.0-beta.1'});
    const page=await request('/');assert.equal(page.status,200);assert.match(page.body,/data-view="outings"/);assert.match(page.body,/qiban-build" content="0.9.0-beta.1"/);
    const urls=[...page.body.matchAll(/<(?:script[^>]*src|link[^>]*href)="([^"\s]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(urls.includes('research-cards.js'));assert.ok(urls.includes('home-ui.js'));
    for(const url of urls){const r=await request('/'+url);assert.equal(r.status,200,url);assert.ok(r.body.length>0);assert.equal(r.headers['Cache-Control'],'no-store');}
    assert.equal((await request('/api/health','evil.example')).status,403);
    assert.equal((await request('/ai-config.json')).status,404);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('single-file product contains its brought-back feature and all scripts compile',async()=>{
  const html=await readFile(new URL('../../栖伴-目标成长交互原型.html',import.meta.url),'utf8');
  const {Script}=await import('node:vm');
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(match[1]));
  assert.match(html,/data-view="outings"/);assert.match(html,/brought-filters/);assert.match(html,/research-layout/);assert.doesNotMatch(html,/<script src="/);
});
