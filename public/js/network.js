import {selectedHero} from './roster.js';
import {createRoomVoice} from './voice.js';

export function createNetwork(callbacks){
  let socket=null,id=null,role=null,code=null,lastPosition=0,lastState=0;
  const players=new Map(),$=id=>document.getElementById(id);
  function send(type,data={}){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type,...data}));}
  const voice=createRoomVoice({send,me:()=>id,inRoom:()=>!!code});
  function status(text){$('lobby-status').textContent=text;}
  function render(){
    $('room-code').textContent=code ? 'ROOM '+code : '';
    $('leave-room').classList.toggle('hidden',!code);
    $('copy-invite')?.classList.toggle('hidden',!code);
    $('lobby-players').textContent=[...players.values()].map(p=>`${p.name}${p.id===id?' (you)':''}${p.id===callbacks.hostId?' · host':''}`).join(' / ');
    $('coop-hud').textContent=code ? `${callbacks.mode?.()==='duel'?'1V1':'CO-OP'} ${code} / ${players.size} PLAYERS` : '';
    for(const b of document.querySelectorAll('.mapbtn'))b.disabled=role==='guest'||!(callbacks.canSelectMap?.()??true);
    callbacks.onRoom?.({id,role,code,players});
  }
  async function connect(){
    if(socket?.readyState===WebSocket.OPEN)return;
    status('CONNECTING TO CO-OP SERVER…');
    await new Promise((resolve,reject)=>{
      socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/multiplayer`);
      const timeout=setTimeout(()=>{socket.close();reject(Error('Server connection timed out'));},10000);
      socket.onopen=()=>{clearTimeout(timeout);resolve();};
      socket.onerror=()=>{clearTimeout(timeout);reject(Error('Could not connect to multiplayer server'));};
      socket.onclose=()=>{voice.stop(false);role=null;code=null;players.clear();render();status('DISCONNECTED / CREATE OR JOIN A ROOM TO RECONNECT');callbacks.onDisconnect?.();};
      socket.onmessage=e=>{
        let m;try{m=JSON.parse(e.data);}catch{return;}
        if(m.type==='connected')id=m.id;
        if(m.type==='joined'){id ||= null;role=m.role;code=m.code;callbacks.hostId=m.host;status(role==='host'?'ROOM READY / SHARE THE CODE, THEN SELECT A MAP':'JOINED / WAITING FOR THE HOST TO CHOOSE A MAP');render();}
        if(m.type==='roster'){callbacks.hostId=m.host;const old=new Map(players);players.clear();for(const p of m.players)players.set(p.id,{...p,position:p.position||old.get(p.id)?.position});render();callbacks.onPlayers?.(players);}
        if(m.type==='position'){const p=players.get(m.id);if(p){p.position=m.position;callbacks.onPosition?.(p);}}
        if(m.type==='start'){status('LOADING THE HOST’S MAP…');callbacks.onStart?.(m);}
        if(m.type==='snapshot')callbacks.onSnapshot?.(m.snapshot);
        if(m.type==='duel-state')callbacks.onDuelState?.(m);
        if(m.type==='duel-shot')callbacks.onDuelShot?.(m);
        if(m.type==='duel-ended')callbacks.onDuelEnded?.(m.message);
        if(m.type==='action')callbacks.onAction?.(m.id,m.action);
        if(['hurt','reward','pickup','sector','revive'].includes(m.type))callbacks.onDirect?.(m.type,m.data);
        if(m.type==='effect')callbacks.onEffect?.(m.effect);
        if(m.type==='voice-config')voice.configure(m.iceServers);
        if(m.type==='voice-peers')voice.sync(m.players);
        if(m.type==='voice-signal')voice.signal(m.id,m.signal);
        if(m.type==='error')status(m.message);
        if(m.type==='closed'){voice.stop(false);role=null;code=null;players.clear();render();status(m.message);callbacks.onDisconnect?.();}
        if(m.type==='left'){role=null;code=null;players.clear();render();status('SOLO MODE / CHOOSE A MAP');}
      };
    });
  }
  async function join(type){try{if(voice.enabled)voice.stop();await connect();const hero=selectedHero();send(type,{hero:hero.id,name:hero.name,code:$('join-code').value.trim()});}catch(e){status(e.message);}}
  $('create-room').onclick=()=>join('create');$('join-room').onclick=()=>join('join');
  $('leave-room').onclick=()=>{voice.stop();send('leave');role=null;code=null;players.clear();for(const b of document.querySelectorAll('.mapbtn'))b.disabled=false;render();};
  // Invite link: friends who open it get the room code filled in and join automatically.
  if($('copy-invite'))$('copy-invite').onclick=async()=>{
    const url=`${location.origin}/?room=${encodeURIComponent(code||'')}`;
    try{if(navigator.share){await navigator.share({title:'Join my RIFTWATCH room',text:'Join my RIFTWATCH room:',url});return;}}catch(e){if(e?.name==='AbortError')return;}
    try{await navigator.clipboard.writeText(url);status('INVITE LINK COPIED / SEND IT TO YOUR FRIEND');}
    catch{window.prompt('Copy this invite link and send it to your friend:',url);}
  };
  $('player-name').value=selectedHero().name;
  $('player-name').readOnly=true;
  $('player-name').title='Change your name in the Operators panel';
  window.addEventListener('riftwatch:profile-changed',()=>{
    const profile=selectedHero();
    $('player-name').value=profile.name || 'Operator';
    if(code)send('profile',{hero:profile.id,name:profile.name || 'Operator'});
  });
  $('join-code').value=new URLSearchParams(location.search).get('room')||'';
  if($('join-code').value)setTimeout(()=>{if(!code)join('join');},600);
  return {
    players,get id(){return id},get role(){return role},get code(){return code},
    start:data=>send('start',data),action:action=>send('action',{action}),duelFire:data=>send('duel-fire',data),
    direct:(to,event,data)=>send('direct',{to,event,data}),effect:effect=>send('effect',{effect}),
    tick(now,position,snapshot){if(!code)return;if(now-lastPosition>.08){lastPosition=now;send('position',position);}if(role==='host'&&snapshot&&now-lastState>.1){lastState=now;send('snapshot',{snapshot:snapshot()});}},
    render,
  };
}

