import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function moonBox(extra={}){
  const box={...extra};box.globalThis=box;
  vm.runInNewContext(await readFile(new URL('../home-ui.js',import.meta.url),'utf8'),box);
  return box.QibanMoon;
}

test('moon phase names follow the lit fraction, not a percentage',async()=>{
  const M=await moonBox();
  assert.deepEqual([0,0.2,0.5,0.75,1].map(M.phase),['新月','蛾眉月','上弦月','盈凸月','满月']);
  assert.equal(M.phase(-3),'新月');assert.equal(M.phase(9),'满月');assert.equal(M.phase('x'),'新月');
});

test('moon path waxes from the right and closes into a full disc',async()=>{
  const M=await moonBox();
  assert.equal(M.path(0),'');
  assert.match(M.path(0.25),/A48\.00 96 0 0 0 130 34Z$/);
  assert.match(M.path(0.75),/A48\.00 96 0 0 1 130 34Z$/);
  assert.match(M.path(1),/0 1 1 130 226A96 96 0 1 1 130 34Z/);
});

test('every rendered moon gets its own clip id and a new moon still shows a sliver',async()=>{
  const M=await moonBox();
  const a=M.svg({f:0.4,ring:true}),b=M.svg({f:0.4,ring:true});
  const id=html=>html.match(/clipPath id="([^"]+)"/)[1];
  assert.notEqual(id(a),id(b));assert.match(a,/class="moon-ring"/);assert.match(a,/class="moon-pestle"/);
  assert.match(M.svg({f:0}),/class="m-lit"/);assert.doesNotMatch(M.svg({f:0.5,rabbit:false}),/m-rabbit/);
});

test('theme follows the clock until the person picks day or night',async()=>{
  const store=new Map();
  const M=await moonBox({localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
  assert.equal(M.theme.resolve('auto',new Date('2026-10-14T10:00:00')),'day');
  assert.equal(M.theme.resolve('auto',new Date('2026-10-14T22:00:00')),'night');
  assert.equal(M.theme.resolve('night',new Date('2026-10-14T10:00:00')),'night');
  assert.equal(M.theme.pref(),'auto');
  assert.equal(M.theme.cycle(),'day');assert.equal(M.theme.cycle(),'night');assert.equal(M.theme.cycle(),'auto');assert.equal(store.size,0);
  const first=M.theme.toggle(),second=M.theme.toggle();assert.notEqual(first,second);assert.equal(M.theme.label(),second==='day'?'白天':'夜晚');
});

test('theme storage failures never break rendering',async()=>{
  const M=await moonBox({localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}});
  assert.equal(M.theme.pref(),'auto');assert.ok(['day','night'].includes(M.theme.toggle()));
});
