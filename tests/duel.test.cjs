const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {WebSocket}=require('ws'),{attachMultiplayer}=require('../multiplayer-server.cjs');
const {shotHit}=require('../duel-rules.cjs');
async function client(url){
  const ws=new WebSocket(url),inbox=[],waiters=[];
  ws.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.type===m.type);if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else inbox.push(m);});
  const next=type=>{const i=inbox.findIndex(m=>m.type===type);if(i>=0)return Promise.resolve(inbox.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={type,resolve,timer:setTimeout(()=>reject(Error('No '+type)),1800)};waiters.push(w);});};
  await next('connected');return {ws,next,send(type,data={}){ws.send(JSON.stringify({type,...data}));}};
}
test('shot geometry accepts a body shot and rejects a miss and a blocked segment',()=>{
  assert(shotHit([0,1.2,0],[10,1.2,0],[5,0,0]));
  assert(!shotHit([0,1.2,0],[10,1.2,0],[5,0,3]));
  assert(!shotHit([0,1.2,0],[3,1.2,0],[5,0,0]));
});
test('duel requires two players and server controls hits, score and respawn',async()=>{
  const server=http.createServer(),{wss,rooms}=attachMultiplayer(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='ws://127.0.0.1:'+server.address().port+'/multiplayer',peers=[];
  try{
    const host=await client(url),guest=await client(url);peers.push(host,guest);
    host.send('create');const joined=await host.next('joined');
    host.send('start',{mapKey:'yard',spawn:[0,0,0],guestSpawn:[5,0,0],gameMode:'duel'});
    assert.match((await host.next('error')).message,/exactly two/);
    guest.send('join',{code:joined.code});const second=await guest.next('joined');await host.next('roster');
    host.send('start',{mapKey:'yard',spawn:[0,0,0],guestSpawn:[5,0,0],gameMode:'duel'});
    assert.equal((await guest.next('start')).gameMode,'duel');
    const initial=await host.next('duel-state');assert.equal(initial.players.length,2);await guest.next('duel-state');
    const room=rooms.get(joined.code);
    for(const p of room.duel.players.values())p.shieldUntil=0;
    host.send('position',{pos:[0,0,0],yaw:0,hp:500,active:true,weapon:0});await guest.next('position');
    guest.send('position',{pos:[5,0,0],yaw:0,hp:500,active:true,weapon:0});await host.next('position');
    assert.equal(room.peers.get(joined.host).position.hp,100,'client cannot set its own health');
    room.duel.players.get([...room.peers.keys()].find(id=>id!==joined.host)).hp=25;
    host.send('duel-fire',{from:[0,1.2,0],to:[10,1.2,0],weapon:0});
    const shot=await guest.next('duel-shot');assert.equal(shot.id,joined.host);
    const result=await host.next('duel-state');await guest.next('duel-state');assert.equal(result.players.find(p=>p.id===joined.host).kills,1);
    const victim=result.players.find(p=>p.id!==joined.host);assert.equal(victim.hp,0);assert(victim.respawnAt>Date.now());
    room.duel.players.get(victim.id).respawnAt=Date.now()-1;
    const respawn=await guest.next('duel-state');assert.equal(respawn.players.find(p=>p.id===victim.id).hp,100);
    const third=await client(url);peers.push(third);third.send('join',{code:joined.code});assert.match((await third.next('error')).message,/room full/);
  }finally{for(const p of peers)p.ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
});
