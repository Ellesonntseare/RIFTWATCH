const {WebSocketServer,WebSocket}=require('ws');
const crypto=require('node:crypto');
const {shotHit,TARGET_KILLS,RESPAWN_MS}=require('./duel-rules.cjs');
const MAPS=new Set(['outpost','yard','crypt','ep73','skibidi']);
const HEROES=new Set(['personal','tactical','vanguard','sentinel']);
try{const extra=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'public','extra-hero.json'),'utf8'));if(extra.enabled&&extra.file&&extra.id)HEROES.add(extra.id);}catch{}
const vector=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<12000);

function attachMultiplayer(server){
  const wss=new WebSocketServer({server,path:'/multiplayer',maxPayload:96*1024});
  const rooms=new Map();let count=0;
  const defaultIce=[{urls:'stun:stun.cloudflare.com:3478'}];let iceCache=null;
  async function voiceConfig(){
    if(!process.env.CF_TURN_KEY_ID||!process.env.CF_TURN_API_TOKEN)return defaultIce;
    if(iceCache&&iceCache.until>Date.now())return iceCache.servers;
    try{
      const response=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(process.env.CF_TURN_KEY_ID)+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(5000)});
      if(!response.ok)return defaultIce;
      const data=await response.json();if(!Array.isArray(data.iceServers))return defaultIce;
      iceCache={servers:data.iceServers,until:Date.now()+1800000};return data.iceServers;
    }catch{return defaultIce;}
  }
  function send(ws,type,data={}){if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>1024*1024){ws.close(1013,'Connection too slow');return;}ws.send(JSON.stringify({type,...data}));}
  function broadcast(room,type,data,exclude){for(const peer of room.peers.values())if(peer.id!==exclude)send(peer.ws,type,data);}
  function voicePeers(room){broadcast(room,'voice-peers',{players:[...room.peers.values()].map(p=>({id:p.id,name:p.name,enabled:!!p.voice}))});}
  function roster(room){broadcast(room,'roster',{host:room.host,code:room.code,players:[...room.peers.values()].map(p=>({id:p.id,name:p.name,hero:p.hero,position:p.position}))});voicePeers(room);}
  function duelState(room){if(!room.duel)return;broadcast(room,'duel-state',{players:[...room.duel.players].map(([id,p])=>({id,hp:p.hp,kills:p.kills,deaths:p.deaths,respawnAt:p.respawnAt})),winner:room.duel.winner||null,target:TARGET_KILLS});}
  function leave(peer){
    const room=rooms.get(peer.code);peer.code=null;if(!room)return;
    room.peers.delete(peer.id);
    if(peer.id===room.host){broadcast(room,'closed',{message:'The host left. Create or join another room.'});for(const p of room.peers.values())p.code=null;rooms.delete(room.code);}
    else {if(room.duel){room.duel=null;room.start=null;room.snapshot=null;broadcast(room,'duel-ended',{message:'Opponent left the duel. Return to maps to play again.'});}roster(room);}
  }
  wss.on('connection',(ws,req)=>{
    // Cloudflare forwards the browser's Origin unchanged. Prevent unrelated sites
    // from attaching a browser socket to this server.
    if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host&&origin.origin!==process.env.RIFTWATCH_ORIGIN){ws.close(1008,'Origin mismatch');return;}}catch{ws.close(1008,'Invalid origin');return;}}
    if(wss.clients.size>64){ws.close(1013,'Server full');return;}
    const peer={ws,id:'p'+(++count),code:null,name:'Operator',hero:'personal',position:null,alive:true,rate:0,rateAt:Date.now()};
    ws.on('pong',()=>peer.alive=true);
    send(ws,'connected',{id:peer.id});
    ws.on('message',raw=>{
      const now=Date.now();if(now-peer.rateAt>1000){peer.rate=0;peer.rateAt=now;}if(++peer.rate>90){ws.close(1008,'Message rate exceeded');return;}
      let m;try{m=JSON.parse(raw);}catch{return send(ws,'error',{message:'Invalid message'});}
      if(!m||typeof m.type!=='string')return;
      if(m.type==='create'||m.type==='join'){
        let destination;
        if(m.type==='join'){
          destination=rooms.get(String(m.code||'').toUpperCase().replace(/[^A-F0-9]/g,''));
          if(!destination)return send(ws,'error',{message:'Room not found. Check the code.'});
          if(destination.code===peer.code)return;
          if(destination.peers.size>=(destination.duel?2:4))return send(ws,'error',{message:destination.duel?'1v1 room full (2 players).':'Room full (4 players).'});
        }else if(rooms.size>=24&&rooms.get(peer.code)?.host!==peer.id){
          return send(ws,'error',{message:'Server full. Try again later.'});
        }
        leave(peer);peer.position=null;peer.voice=false;peer.hero=HEROES.has(m.hero)?m.hero:'personal';peer.name=String(m.name||'Operator').replace(/[<>\x00-\x1f]/g,'').slice(0,24);
        let room;
        if(m.type==='create'){
          if(rooms.size>=24)return send(ws,'error',{message:'Server full. Try again later.'});
          let code;do{code=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
          room={code,host:peer.id,peers:new Map(),start:null,snapshot:null,duel:null};rooms.set(code,room);
        }else{room=destination;}
        peer.code=room.code;room.peers.set(peer.id,peer);send(ws,'joined',{code:room.code,host:room.host,role:peer.id===room.host?'host':'guest'});roster(room);
        if(room.start){send(ws,'start',room.start);if(room.snapshot)send(ws,'snapshot',{snapshot:room.snapshot});if(room.duel)duelState(room);}return;
      }
      if(m.type==='leave'){leave(peer);send(ws,'left');return;}
      const room=rooms.get(peer.code);if(!room)return send(ws,'error',{message:'Join a room first.'});
      if(m.type==='voice-config'){voiceConfig().then(iceServers=>send(ws,'voice-config',{iceServers}));return;}
      if(m.type==='voice-ready'){peer.voice=!!m.enabled;voicePeers(room);return;}
      if(m.type==='voice-signal'&&peer.voice&&room.peers.get(m.to)?.voice&&m.signal&&JSON.stringify(m.signal).length<16000){send(room.peers.get(m.to).ws,'voice-signal',{id:peer.id,signal:m.signal});return;}
      if(m.type==='start'&&peer.id===room.host&&MAPS.has(m.mapKey)&&vector(m.spawn)){
        if(m.gameMode==='duel'&&(room.peers.size!==2||!vector(m.guestSpawn)))return send(ws,'error',{message:'1v1 needs exactly two players in the room.'});
        room.start={mapKey:m.mapKey,spawn:m.spawn,guestSpawn:m.gameMode==='duel'?m.guestSpawn:null,gameMode:['endless','duel'].includes(m.gameMode)?m.gameMode:'campaign',difficulty:m.difficulty==='standard'?'standard':'relaxed'};
        room.duel=m.gameMode==='duel'?{players:new Map([...room.peers.keys()].map(id=>[id,{hp:100,kills:0,deaths:0,respawnAt:0,shieldUntil:Date.now()+3500,lastShot:0}])),winner:null}:null;
        room.snapshot=null;broadcast(room,'start',room.start,peer.id);if(room.duel)duelState(room);return;
      }
      if(m.type==='position'&&vector(m.pos)&&Number.isFinite(m.yaw)&&Number.isFinite(m.hp)){
        const duelPlayer=room.duel?.players.get(peer.id);
        peer.position={pos:m.pos,yaw:m.yaw,pitch:Number.isFinite(m.pitch)?Math.max(-1.5,Math.min(1.5,m.pitch)):0,weapon:m.weapon===1?1:0,aiming:!!m.aiming,hp:duelPlayer?duelPlayer.hp:Math.max(0,Math.min(500,m.hp)),active:!!m.active,moving:!!m.moving,speed:Number.isFinite(m.speed)?Math.max(0,Math.min(20,m.speed)):0};
        broadcast(room,'position',{id:peer.id,position:peer.position},peer.id);return;
      }
      if(m.type==='duel-fire'&&room.duel&&!room.duel.winner&&vector(m.from)&&vector(m.to)){
        const shooter=room.duel.players.get(peer.id),targetPeer=[...room.peers.values()].find(p=>p.id!==peer.id),target=room.duel.players.get(targetPeer?.id);
        if(!shooter||!target||!peer.position?.active||!targetPeer.position?.active||shooter.hp<=0||target.hp<=0||m.weapon!==peer.position.weapon||now-shooter.lastShot<(m.weapon===1?50:82))return;
        if(Math.hypot(m.from[0]-peer.position.pos[0],m.from[1]-peer.position.pos[1],m.from[2]-peer.position.pos[2])>3.5||Math.hypot(m.to[0]-m.from[0],m.to[1]-m.from[1],m.to[2]-m.from[2])>260)return;
        shooter.lastShot=now;
        const hit=shotHit(m.from,m.to,targetPeer.position.pos);
        broadcast(room,'duel-shot',{id:peer.id,from:m.from,to:hit?.point||m.to,weapon:m.weapon===1?1:0});
        if(!hit||now<target.shieldUntil)return;
        target.hp=Math.max(0,target.hp-(m.weapon===1?hit.head?38:14:hit.head?75:25));
        if(target.hp===0){target.deaths++;target.respawnAt=now+RESPAWN_MS;shooter.kills++;if(shooter.kills>=TARGET_KILLS)room.duel.winner=peer.id;}
        duelState(room);return;
      }
      if(m.type==='snapshot'&&peer.id===room.host&&m.snapshot&&typeof m.snapshot==='object'){
        const s=m.snapshot;if(!Array.isArray(s.monsters)||s.monsters.length>80||!Array.isArray(s.barrels)||s.barrels.length>100)return;
        room.snapshot=s;broadcast(room,'snapshot',{snapshot:s},peer.id);return;
      }
      if(m.type==='action'&&peer.id!==room.host&&m.action&&typeof m.action==='object'){
        const a=m.action;
        if(!['hit','barrel','interact','pickup','explosion','shot','respawn'].includes(a.kind))return;
        if(a.damage!==undefined&&(!Number.isFinite(a.damage)||a.damage<0||a.damage>600))return;
        if(a.pos!==undefined&&!vector(a.pos))return;
        send(room.peers.get(room.host).ws,'action',{id:peer.id,action:a});return;
      }
      if(m.type==='direct'&&peer.id===room.host&&room.peers.has(m.to)&&['hurt','reward','pickup','sector','revive'].includes(m.event)){
        send(room.peers.get(m.to).ws,m.event,{data:m.data});return;
      }
      if(m.type==='effect'&&peer.id===room.host&&m.effect&&typeof m.effect==='object')broadcast(room,'effect',{effect:m.effect},peer.id);
    });
    ws.on('close',()=>leave(peer));ws.on('error',()=>{});
    ws.peer=peer;
  });
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.peer)continue;if(!ws.peer.alive){ws.terminate();continue;}ws.peer.alive=false;ws.ping();}},25000);heartbeat.unref();
  const duelTick=setInterval(()=>{const now=Date.now();for(const room of rooms.values())if(room.duel&&!room.duel.winner){let changed=false;for(const p of room.duel.players.values())if(p.respawnAt&&now>=p.respawnAt){p.hp=100;p.respawnAt=0;p.shieldUntil=now+2500;changed=true;}if(changed)duelState(room);}},250);duelTick.unref();
  wss.on('close',()=>{clearInterval(heartbeat);clearInterval(duelTick);});
  return {wss,rooms};
}
module.exports={attachMultiplayer};
