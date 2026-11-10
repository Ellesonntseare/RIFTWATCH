import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MAPS} from '../public/js/maps.js';

const main=fs.readFileSync(new URL('../public/js/main.js',import.meta.url),'utf8');
const creation=main.slice(main.indexOf('const MAP_SELECTION_ORDER'),main.indexOf('\nupdateModeMenu();',main.indexOf('const MAP_SELECTION_ORDER')));
const filtering=main.slice(main.indexOf('function updateModeMenu(){'),main.indexOf("document.querySelectorAll('.modebtn').forEach(b=>b.addEventListener",main.indexOf('function updateModeMenu(){')));

function menu(maps=MAPS){
  const buttons=[],deployed=[],state={gameMode:'campaign'};
  const context=vm.createContext({MAPS:maps,state,network:{render(){}},startGame:key=>deployed.push(key),
    $:id=>id==='maps'?{appendChild:b=>buttons.push(b)}:{textContent:''},
    document:{createElement(){const b={dataset:{},events:{},hidden:false};b.classList={toggle(name,on){if(name==='hidden')b.hidden=on;}};b.addEventListener=(name,callback)=>b.events[name]=callback;return b;},querySelectorAll:selector=>selector==='.mapbtn'?buttons:[],querySelector:()=>({firstChild:{textContent:''}})}});
  vm.runInContext(creation+filtering,context);
  // Asset readiness enables all buttons; filtering must keep the chosen map reachable.
  buttons.forEach(b=>b.disabled=false);
  return {buttons,deployed,select(mode){state.gameMode=mode;context.updateModeMenu();return buttons.filter(b=>!b.hidden&&!b.disabled);}};
}

test('Battle Royale exposes a clickable Frontier District map that starts royale deployment',()=>{
  const m=menu(),visible=m.select('royale');assert.deepEqual(visible.map(b=>b.dataset.key),['royale']);
  assert.match(visible[0].innerHTML,/Frontier District/);visible[0].events.click();assert.deepEqual(m.deployed,['royale']);
});
test('switching modes restores the appropriate campaign and hunt maps',()=>{
  const m=menu();m.select('royale');assert.deepEqual(m.select('hunt').map(b=>b.dataset.key),['island']);
  assert.ok(m.select('campaign').some(b=>b.dataset.key==='outpost'));assert.ok(m.select('campaign').every(b=>!['island','royale'].includes(b.dataset.key)));
});
test('new map definitions cannot silently disappear from the menu',()=>{
  const m=menu({...MAPS,futureDistrict:{name:'Future District'}});
  assert.equal(m.buttons.filter(b=>b.dataset.key==='futureDistrict').length,1);
});
