import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const root = new URL('../static/', import.meta.url);
const context = vm.createContext({window: {}});
const file = new URL('model.js', root);
if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
function model(name) {
  assert.equal(typeof context.window.ReplayModel?.[name], 'function', `${name} behavior must be implemented`);
  return context.window.ReplayModel[name];
}
const times = Array.from({length: 240}, (_,i) => {
  const n = i < 120 ? 571 + i : 781 + i - 120;
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
});
const board = (code, values, type='concept') => ({code,name:code,type,values});
const plain = value => JSON.parse(JSON.stringify(value));
test('as-of curve and vertical range are invariant to every future value', () => {
  const values = Array(240).fill(10); values[1] = -5;
  const before = plain(model('chartModel')(board('BK1', values), 4, 'asof'));
  const changed = [...values]; changed.fill(9e12,5);
  const after = plain(model('chartModel')(board('BK1', changed), 4, 'asof'));
  assert.deepEqual(after,before);
  assert.equal(before.min,-5); assert.equal(before.max,10);
  assert.deepEqual(before.segments.flat().map(p=>p.index),[0,1,2,3,4]);
});
test('overview exposes future values only when explicitly requested', () => {
  const values = Array(240).fill(10); values[239] = 1000;
  assert.equal(model('chartModel')(board('BK1',values),0,'asof').max,10);
  assert.equal(model('chartModel')(board('BK1',values),0,'overview').max,1000);
});
test('chart breaks at both missing samples and lunch instead of joining them', () => {
  const values = Array(240).fill(null); values[117]=1;values[118]=2;values[119]=null;values[120]=3;values[121]=4;
  assert.deepEqual(plain(model('chartModel')(board('BK1',values),121,'asof').segments),[[{index:117,value:1},{index:118,value:2}],[{index:120,value:3},{index:121,value:4}]]);
  values[119]=3;
  assert.equal(model('chartModel')(board('BK1',values),121,'asof').segments.length,2);
});
test('empty visible prefix stays empty and never substitutes future samples', () => {
  const values=Array(240).fill(null);values[239]=100;
  const chart=model('chartModel')(board('BK1',values),3,'asof');
  assert.deepEqual(plain(chart.segments),[]);assert.equal(chart.current,null);
  assert.equal(chart.min,0);assert.equal(chart.max,0);
});
test('window endpoints require the same session and exact elapsed minutes', () => {
  const start=model('windowStart');
  assert.equal(start(times,0,5),-1);assert.equal(start(times,5,5),0);
  assert.equal(start(times,119,30),89);assert.equal(start(times,120,5),-1);
  assert.equal(start(times,124,5),-1);assert.equal(start(times,125,5),120);
  assert.equal(start(times,135,15),120);assert.equal(start(times,150,30),120);
});
test('ranking is endpoint change, signed descending, with stable code ties', () => {
  const rows=[board('BK2',[0,1,2,3,4,10]),board('BK1',[0,1,2,3,4,10]),board('BK3',[20,19,18,17,16,10]),board('BK4',[0,0,0,0,0,0])];
  const ranked=model('rank')(rows,'concept',5,5,times);
  assert.deepEqual(plain(ranked.map(r=>[r.board.code,r.delta])),[['BK1',10],['BK2',10],['BK4',0],['BK3',-10]]);
});
test('ranking excludes an internal gap as well as missing endpoints', () => {
  const rows=[board('complete',[0,1,2,3,4,5]),board('interior',[0,1,null,3,4,5]),board('start',[null,1,2,3,4,5]),board('end',[0,1,2,3,4,null])];
  assert.deepEqual(plain(model('rank')(rows,'concept',5,5,times).map(r=>r.board.code)),['complete']);
});
test('ranking never uses other types or future values', () => {
  const values=Array(240).fill(0);values[5]=10;values[239]=1e12;
  const ranked=model('rank')([board('A',values),board('B',values,'region')],'concept',5,5,times);
  assert.deepEqual(plain(ranked.map(r=>[r.board.code,r.delta])),[['A',10]]);
});
test('selection honors a fixed preferred code and deterministic fallback', () => {
  const rows=[board('BK2',[]),board('BK1',[]),board('BK0',[],'industry')];
  assert.equal(model('selectBoard')(rows,'concept','BK2').code,'BK2');
  assert.equal(model('selectBoard')(rows,'concept',null).code,'BK1');
  assert.equal(model('selectBoard')(rows,'concept','missing').code,'BK1');
  assert.equal(model('selectBoard')(rows,'region','BK2'),null);
});
test('stale day success cannot replace the newer selected day', async () => {
  const cache=Object.create(null), pending={};
  const loader=model('createDayLoader')(date=>new Promise(resolve=>pending[date]=resolve),cache);
  const a=loader.load('2026-11-11'),b=loader.load('2026-11-20');
  cache['2026-11-20']={boards:[]};pending['2026-11-20']();
  assert.deepEqual(plain(await b),{date:'2026-11-20',payload:{boards:[]},stale:false});
  cache['2026-11-11']={boards:[]};pending['2026-11-11']();
  assert.equal((await a).stale,true);
});
test('stale day failure is ignored while current day failure remains visible', async () => {
  const cache=Object.create(null), pending={};
  const loader=model('createDayLoader')(date=>new Promise((resolve,reject)=>pending[date]={resolve,reject}),cache);
  const a=loader.load('A'),b=loader.load('B');pending.A.reject(Error('old failure'));
  assert.equal((await a).stale,true);
  pending.B.reject(Error('current failure'));
  await assert.rejects(b,/current failure/);
});
test('axis labels omit a near-zero label when it overlaps an endpoint', () => {
  const labels=model('axisLabels')(-6.9e8,0.07e8,210,16);
  assert.deepEqual(plain(labels.map(label=>label.value).sort((a,b)=>a-b)),[-6.9e8,0.07e8]);
  for(let index=1;index<labels.length;index++)assert.ok(labels[index].position-labels[index-1].position>=16);
  assert.deepEqual(plain(model('axisLabels')(0,0,210,16)),[{value:0,position:0}]);
});
test('axis labels retain a well-separated zero reference', () => {
  assert.deepEqual(plain(model('axisLabels')(-10,10,210,16)),[{value:10,position:0},{value:0,position:105},{value:-10,position:210}]);
});
test('catalog warning compares real instants, treating naive clocks as Shanghai', () => {
  const late=model('catalogAfterCursor');
  assert.equal(late('2026-11-20T14:59:00+08:00','2026-11-20','09:31'),true);
  assert.equal(late('2026-11-20 14:59:00','2026-11-20','14:58'),true);
  assert.equal(late('2026-11-20T06:59:00Z','2026-11-20','14:59'),false);
  assert.equal(late('2026-11-20T14:59:00+08:00','2026-11-20','15:00'),false);
  assert.equal(late('2026-11-19T23:25:00Z','2026-11-20','09:31'),false);
  assert.equal(late(null,'2026-11-20','09:31'),false);
});

test('watchlist keeps identity/order and does not substitute unavailable boards', () => {
  const pins = [{code:'BK2',type:'concept'}, {code:'BK1',type:'industry'}];
  const boards = [board('BK2',Array.from({length:240},(_,i)=>i*1e8))];
  const rows = model('watchRows')(boards,pins,40,times);
  assert.equal(rows[0].code,'BK2'); assert.equal(rows[0].deltas[5],5e8);
  assert.equal(rows[0].deltas[15],15e8); assert.equal(rows[0].deltas[30],30e8);
  assert.equal(rows[1].board,null); assert.equal(rows[1].deltas[5],null);
});
test('watchlist excludes gaps/lunch/future endpoints without turning them into zero', () => {
  const b=board('BK1',Array.from({length:240},(_,i)=>i));
  b.values[29]=null;
  let rows=model('watchRows')([b],[{code:'BK1',type:'concept'}],40,times);
  assert.equal(rows[0].deltas[5],5); assert.equal(rows[0].deltas[15],null);
  rows=model('watchRows')([b],[{code:'BK1',type:'concept'}],120,times);
  assert.equal(rows[0].deltas[5],null);
  b.values[41]=1e20;
  rows=model('watchRows')([b],[{code:'BK1',type:'concept'}],40,times);
  assert.equal(rows[0].deltas[5],5);
});
test('saved watchlist accepts bounded unique identities, never stored historical names', () => {
  const normalize=model('normalizePins');
  assert.deepEqual(plain(normalize([{code:'BK1',type:'concept',name:'future name'},
    {code:'BK1',type:'concept'}, {code:'BK2',type:'other'},null])),[{code:'BK1',type:'concept'}]);
  assert.equal(normalize(Array.from({length:30},(_,i)=>({code:`BK${i}`,type:'industry'}))).length,12);
  assert.deepEqual(plain(normalize({bad:true})),[]);
});
