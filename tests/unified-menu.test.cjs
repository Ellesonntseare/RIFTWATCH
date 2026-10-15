const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=path=>fs.readFileSync(path,'utf8');
const html=read('public/index.html');
const legacy=read('public/hero.html');
const menu=read('public/js/menu-cinematic.js');
const css=read('public/menu-cinematic.css');
const game=read('public/js/main.js');
const monsters=read('public/js/monsters.js');
const network=read('public/js/network.js');
const server=read('multiplayer-server.cjs');
const android=read('app/src/main/java/za/co/teamtrader/riftwatch/MainActivity.java');

test('Cinematic menu, not legacy hero selector, is the launch screen',()=>{
  assert.doesNotMatch(html,/location\.replace\('\/hero\.html'/);
  assert.match(html,/menu-cinematic\.js\?/);
  assert.match(html,/menu-cinematic\.css\?/);
  assert.match(legacy,/location\.replace\('\/\?operator=1'/);
  assert.match(android,/GAME_URL = "https:\/\/rift\.teamtrader\.co\.za\/"/);
});

test('Operator selection and callsign editor are integrated inside the new menu',()=>{
  assert.match(menu,/data-rw-open="operator"/);
  assert.match(menu,/id="rw-panel-operator"/);
  assert.match(menu,/id="rw-callsign"/);
  assert.match(menu,/function selectOperator\(config\)/);
  assert.match(menu,/function saveCallsign\(\)/);
  assert.match(menu,/updateOperatorPreview=async/);
  assert.doesNotMatch(menu,/href="\/hero\.html"/);
  assert.match(network,/riftwatch:profile-changed/);
  assert.match(server,/if\(m\.type==='profile'\)/);
});

test('Touch users can reach deployment and start without pointer lock',()=>{
  assert.match(menu,/data-rw-open="maps"/);
  assert.match(css,/#menu\.rw-menu #maps \.mapbtn/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/\.rw-footer \{position:sticky/);
  assert.match(game,/if\(touchDevice\)\s*\{\s*lock\(\);/);
  assert.match(game,/MAP_SELECTION_ORDER = \['outpost', 'yard', 'ep73', 'skibidi', 'crypt', 'island'\]/);
});

test('Voice controls are integrated with lobby and not a permanent bottom bar',()=>{
  assert.match(menu,/id="rw-voice-toggle"/);
  assert.match(menu,/id="rw-voice-mute"/);
  assert.match(menu,/voiceToggle\?\.click\(\)/);
  assert.match(css,/body\.rw-menu-visible #voice-controls/);
  assert.match(css,/body\.rw-game-visible\.rw-room-joined #voice-controls/);
});

function health(type){
  const expression=new RegExp('\\b'+type+':\\s*\\{[^\\n]*?\\bhp:\\s*(\\d+)');
  const hit=monsters.match(expression);
  assert.ok(hit,'Missing enemy type '+type);
  return Number(hit[1]);
}

test('Ordinary enemy durability exceeds several M4 body shots',()=>{
  assert.ok(health('grunt')>=100);
  assert.ok(health('runner')>=80);
  assert.ok(health('shooter')>=100);
  assert.ok(health('sniper')>=120);
  assert.match(game,/head \? CFG\.gun\.headMul/);
  assert.match(game,/headMul: 4/);
});
