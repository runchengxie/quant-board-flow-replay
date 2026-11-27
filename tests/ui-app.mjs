import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.value='';this.textContent='';this.hidden=false;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];if(this.tag==='select'&&!children.some(c=>c.value===this.value))this.value=children[0]?.value||'';}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key];}
  get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
}
const times=Array.from({length:240},(_,i)=>{const n=i<120?571+i:781+i-120;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;});
function setup(savedLanguage,customizePayload){
  const ids=['day','kind','win','minute','lookup','ranking','chart','status','clock','language','mode','provenance','warning','boardname','value','scope','empty','boardlist','mode-hint'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(['day','kind','win','language','mode'].includes(id)?'select':'div')]));
  elements.kind.value='concept';elements.win.value='15';elements.mode.value='asof';
  const values=Array(240).fill(1);values[239]=1e12;
  const payload={boards:[{code:'BK2',name:'Second',type:'concept',values:[...values]},{code:'BK1',name:'First',type:'concept',values:[...values]}],counts:{concept:{observedPoints:480,observedBoards:2,expectedBoards:2}},hasCatalog:true,provenance:{sources:['eastmoney'],archivedAtMin:'2026-11-20T15:05:00+08:00',archivedAtMax:'2026-11-20T15:05:00+08:00'},warnings:[]};
  if(customizePayload)customizePayload(payload);
  const storageValues={'board-flow-replay.language':savedLanguage};
  const storage={getItem:key=>storageValues[key]??null,setItem:(key,value)=>storageValues[key]=value};
  const document={getElementById:id=>elements[id],querySelectorAll:()=>[],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),documentElement:{},head:new Element('head'),title:''};
  const window={localStorage:storage,ARCHIVE_DAYS:{'2026-11-20':payload},REPLAY_META:{format:'board-flow-replay-v1',dates:['2026-11-20'],times,archive:{format:'board-flow-parquet-v1',manifestSha256:'a'.repeat(64),snapshotAt:'2026-11-20T15:40:00+08:00'},coverage:{'2026-11-20':{boards:2,rows:480,hasCatalog:true}}}};
  const context=vm.createContext({window,document,Intl,Date,console});
  for(const name of ['model.js','locales.js','app.js']){const path=new URL('../static/'+name,import.meta.url);assert.ok(fs.existsSync(path),`${name} behavior must be implemented`);vm.runInContext(fs.readFileSync(path,'utf8'),context);}
  return {window,document,elements,storage,payload};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('default screen starts at first cursor with deterministic board and no future chart',async()=>{
  const {elements,document}=setup();await tick();
  assert.equal(document.documentElement.lang,'en');assert.equal(elements.minute.value,'0');
  assert.match(elements.boardname.textContent,/BK1/);
  const paths=elements.chart.children.filter(x=>x.tag==='path');
  assert.equal(paths.length,1);assert.equal((paths[0].attributes.d.match(/[ML]/g)||[]).length,1);
  assert.equal(elements.ranking.children.length,0);
});
test('moving cursor preserves a deliberate selection rather than picking the new winner',async()=>{
  const {elements}=setup();await tick();
  elements.lookup.value='BK2';elements.lookup.onchange();
  elements.minute.value='239';elements.minute.oninput();
  assert.match(elements.boardname.textContent,/BK2/);
});
test('saved locale is honored and a later switch persists with unchanged sector selection',async()=>{
  const {elements,document,storage}=setup('zh-CN');await tick();
  assert.equal(document.documentElement.lang,'zh-CN');assert.match(elements.boardname.textContent,/BK1/);
  elements.language.value='en';elements.language.onchange();
  assert.equal(document.documentElement.lang,'en');assert.equal(storage.getItem('board-flow-replay.language'),'en');
  assert.match(elements.boardname.textContent,/BK1/);
});

test('rendered axis labels stay separated while every reference line remains',async()=>{
  const {elements}=setup(undefined,payload=>{for(const board of payload.boards){board.values.fill(-1e8);board.values[0]=-6.9e8;board.values[1]=0.07e8;}});await tick();
  elements.minute.value='5';elements.minute.oninput();
  const labels=elements.chart.children.filter(element=>element.tag==='text'&&element.attributes.x==='63').map(element=>Number(element.attributes.y)).sort((a,b)=>a-b);
  assert.equal(labels.length,2);assert.ok(labels[1]-labels[0]>=16);
  assert.equal(elements.chart.children.filter(element=>element.tag==='line'&&element.attributes.x1==='70'&&element.attributes.x2==='598').length,3);
});
test('a catalog captured after an as-of cursor gets a localized availability warning',async()=>{
  const {elements}=setup(undefined,payload=>{payload.provenance.catalogCapturedAtMax='2026-11-20T14:59:00+08:00';});await tick();
  assert.match(elements.warning.textContent,/catalog.*captured after.*cursor/i);
  elements.language.value='zh-CN';elements.language.onchange();
  assert.match(elements.warning.textContent,/名单.*晚于.*游标/);
  elements.minute.value='239';elements.minute.oninput();
  assert.doesNotMatch(elements.warning.textContent,/名单.*晚于.*游标/);
  elements.minute.value='0';elements.minute.oninput();elements.mode.value='overview';elements.mode.onchange();
  assert.doesNotMatch(elements.warning.textContent,/名单.*晚于.*游标/);
});
