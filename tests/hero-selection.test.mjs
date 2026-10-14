import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createHeroSelection} from '../public/js/hero-selection.js';
test('hero selection changes immediately while previews are pending; stale results cannot replace it',async()=>{
 const pending=new Map(),profiles=[],shown=[],statuses=[];
 const c=createHeroSelection({profile:c=>profiles.push(c.id),status:s=>statuses.push(s),load:c=>new Promise(resolve=>pending.set(c.id,resolve)),display:h=>shown.push(h)});
 c.select({id:'personal'});assert.deepEqual(profiles,['personal']);await delay(180);
 c.select({id:'tactical'});assert.deepEqual(profiles,['personal','tactical']);await delay(180);
 pending.get('tactical')('ghost');await delay(0);pending.get('personal')('serame');await delay(0);
 assert.deepEqual(shown,['ghost']);assert.equal(statuses.at(-1),'OPERATOR READY');
});
test('failed preview leaves selection ready for deployment',async()=>{
 let selected,status;const c=createHeroSelection({profile:c=>selected=c.id,status:s=>status=s,load:async()=>{throw Error('offline');},display:()=>assert.fail('must not display')});
 c.select({id:'sentinel'});assert.equal(selected,'sentinel');await delay(180);assert.match(status,/YOU CAN STILL DEPLOY/);
});
