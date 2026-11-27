import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context=vm.createContext({window:{},Intl,Date});
const path=new URL('../static/locales.js',import.meta.url);
if(fs.existsSync(path))vm.runInContext(fs.readFileSync(path,'utf8'),context);
function api(name){assert.equal(typeof context.window.ReplayI18n?.[name],'function',`${name} behavior must be implemented`);return context.window.ReplayI18n[name];}
test('English is the default even if storage is missing or inaccessible',()=>{
  assert.equal(api('chooseLocale')(null),'en');
  assert.equal(api('chooseLocale')({getItem(){throw Error('blocked')}}),'en');
  assert.equal(api('chooseLocale')({getItem(){return 'unsupported'}}),'en');
});
test('explicit Chinese selection survives reload without changing data identifiers',()=>{
  const values={};const storage={getItem:key=>values[key],setItem:(key,value)=>values[key]=value};
  assert.equal(api('saveLocale')(storage,'zh-CN'),'zh-CN');
  assert.equal(api('chooseLocale')(storage),'zh-CN');
  assert.equal(api('message')('zh-CN','app.title'),'板块资金流回放');
  assert.equal(api('message')('en','app.title'),'Board flow replay');
});
test('locale storage write failure does not prevent switching language',()=>{
  assert.equal(api('saveLocale')({setItem(){throw Error('blocked')}},'zh-CN'),'zh-CN');
});
test('unknown locale falls back to English and dynamic text is interpolated',()=>{
  assert.equal(api('message')('fr','app.title'),'Board flow replay');
  assert.equal(api('message')('en','status.loading',{date:'2026-11-20'}),'Loading local archive for 2026-11-20…');
});
test('currency values use one stable 100-million-yuan scale in both languages',()=>{
  assert.equal(api('formatMoney')('en',12345678900),'123.46');
  assert.equal(api('formatMoney')('zh-CN',12345678900),'123.46');
});
test('naive owner timestamps explicitly use Shanghai rather than browser local zone',()=>{
  const date=api('formatTimestamp')('en','2026-11-20 15:05:00');
  assert.match(date,/3:05|15:05/);
  assert.match(date,/Nov|11/);
});
