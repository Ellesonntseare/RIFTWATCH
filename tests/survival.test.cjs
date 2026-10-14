const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const main=fs.readFileSync('public/js/main.js','utf8');
const source=main.slice(main.indexOf('function hurtPlayer(a) {'),main.indexOf('function die()'));
function survival(){
  const P={hp:110,spawnShield:0,damageGrace:0},state={difficulty:'relaxed',hurt:0,shake:0},operations={buffs:{shield:0}};
  let deaths=0;
  const hurt=new Function('P','state','operations','sfx','die',source+'return hurtPlayer;')(P,state,operations,{hurt(){}},()=>deaths++);
  return {P,state,operations,hurt,get deaths(){return deaths;}};
}
test('deployment shield prevents damage while the player gets oriented',()=>{
  const c=survival();c.P.spawnShield=2;c.hurt(100);assert.equal(c.P.hp,110);assert.equal(c.deaths,0);
});
test('simultaneous enemy bullets cannot stack damage within the grace window',()=>{
  const c=survival();for(let i=0;i<15;i++)c.hurt(7);assert(Math.abs(c.P.hp-106.15)<.001);assert.equal(c.deaths,0);
  c.P.damageGrace=0;c.hurt(7);assert(Math.abs(c.P.hp-102.3)<.001);
});
test('a boss attack does not kill a full-health relaxed-mode operator in one hit',()=>{
  const c=survival();c.hurt(1000);assert(Math.abs(c.P.hp-96.8)<.001);assert.equal(c.deaths,0);
});
test('standard mode remains selectable and timed shields reduce damage further',()=>{
  const c=survival();c.state.difficulty='standard';c.hurt(7);assert.equal(c.P.hp,103);
  c.P.damageGrace=0;c.operations.buffs.shield=10;c.hurt(7);assert(Math.abs(c.P.hp-100.55)<.001);
});
