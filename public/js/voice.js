import {duckMusic} from './audio.js';
export function createRoomVoice({send,me,inRoom}){
  const $=id=>document.getElementById(id),connections=new Map();
  let stream=null,enabled=false,muted=false,context=null,timer=null,iceServers=[{urls:'stun:stun.cloudflare.com:3478'}],members=[];
  function hint(text){$('voice-status').textContent=text;$('voice-hud').textContent=text;}
  function audioMeter(media){const source=context.createMediaStreamSource(media),analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);return {source,analyser,data:new Uint8Array(256)};}
  let ownMeter,configReady=null;
  function speaking(meter){if(!meter)return false;meter.analyser.getByteTimeDomainData(meter.data);return Math.sqrt(meter.data.reduce((n,v)=>n+((v-128)/128)**2,0)/meter.data.length)>.028;}
  function indicators(){const names=[];if(!muted&&speaking(ownMeter))names.push('You');for(const [id,p]of connections)if(speaking(p.meter))names.push(members.find(m=>m.id===id)?.name||'Friend');duckMusic(names.length>0);$('voice-speaking').textContent=names.length?'SPEAKING · '+names.join(' / '):enabled?(muted?'MIC MUTED':'VOICE ON'):'';}
  function closePeer(id){const p=connections.get(id);if(!p)return;p.pc.close();p.audio?.pause();p.audio?.remove();p.meter?.source.disconnect();connections.delete(id);}
  function peer(id){if(connections.has(id))return connections.get(id);
    const pc=new RTCPeerConnection({iceServers}),p={pc,queued:[],offered:false,audio:null,meter:null};connections.set(id,p);
    for(const track of stream.getTracks())pc.addTrack(track,stream);
    pc.onicecandidate=e=>{if(e.candidate)send('voice-signal',{to:id,signal:{candidate:e.candidate.toJSON()}});};
    pc.ontrack=e=>{const media=e.streams[0]||new MediaStream([e.track]);if(!p.audio){p.audio=document.createElement('audio');p.audio.autoplay=true;$('voice-audio').appendChild(p.audio);}p.audio.srcObject=media;p.audio.play().catch(()=>hint('VOICE CONNECTED / CLICK ENABLE VOICE TO ALLOW AUDIO'));if(context&&!p.meter)p.meter=audioMeter(media);};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')hint('ROOM VOICE CONNECTED');if(pc.connectionState==='failed')hint('VOICE CONNECTION FAILED / REJOIN VOICE');};
    return p;
  }
  async function sync(list){members=list;if(!enabled)return;const active=new Set(list.filter(p=>p.enabled&&p.id!==me()).map(p=>p.id));for(const id of connections.keys())if(!active.has(id))closePeer(id);
    for(const id of active){const p=peer(id);if(Number(me()?.slice(1))<Number(id.slice(1))&&!p.offered){p.offered=true;try{await p.pc.setLocalDescription(await p.pc.createOffer());send('voice-signal',{to:id,signal:{description:p.pc.localDescription.toJSON()}});}catch{hint('VOICE COULD NOT CONNECT / TRY AGAIN');}}}
  }
  async function signal(id,message){if(!enabled)return;const p=peer(id);try{
    if(message.description){await p.pc.setRemoteDescription(message.description);for(const candidate of p.queued)await p.pc.addIceCandidate(candidate);p.queued=[];if(message.description.type==='offer'){await p.pc.setLocalDescription(await p.pc.createAnswer());send('voice-signal',{to:id,signal:{description:p.pc.localDescription.toJSON()}});}}
    if(message.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(message.candidate);else p.queued.push(message.candidate);}
  }catch{hint('VOICE COULD NOT CONNECT / TRY AGAIN');}}
  function stop(notify=true){enabled=false;if(notify)send('voice-ready',{enabled:false});duckMusic(false);for(const id of connections.keys())closePeer(id);stream?.getTracks().forEach(t=>t.stop());stream=null;ownMeter=null;if(timer)clearInterval(timer);timer=null;context?.close();context=null;$('voice-toggle').textContent='ENABLE VOICE';$('voice-mute').classList.add('hidden');$('voice-speaking').textContent='';hint('VOICE OFF');}
  async function enable(){if(!inRoom()){hint('JOIN A ROOM TO USE VOICE');return;}if(enabled){stop();return;}try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Use HTTPS or localhost for voice');
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    context=new (window.AudioContext||window.webkitAudioContext)();await context.resume();ownMeter=audioMeter(stream);enabled=true;muted=false;
    $('voice-toggle').textContent='LEAVE VOICE';$('voice-mute').textContent='MUTE MIC';$('voice-mute').classList.remove('hidden');hint('VOICE ON / WAITING FOR FRIENDS');timer=setInterval(indicators,160);
    await new Promise(resolve=>{configReady=resolve;setTimeout(()=>{if(configReady){configReady=null;resolve();}},6000);send('voice-config');});
    if(enabled)send('voice-ready',{enabled:true});
  }catch(e){hint(e.name==='NotAllowedError'?'MICROPHONE PERMISSION DENIED':e.message);stream?.getTracks().forEach(t=>t.stop());stream=null;}}
  $('voice-toggle').onclick=enable;$('voice-mute').onclick=()=>{if(!stream)return;muted=!muted;for(const track of stream.getAudioTracks())track.enabled=!muted;$('voice-mute').textContent=muted?'UNMUTE MIC':'MUTE MIC';};
  addEventListener('beforeunload',()=>{stream?.getTracks().forEach(t=>t.stop());});
  return {stop,sync,signal,configure(servers){if(Array.isArray(servers)&&servers.length){iceServers=servers;for(const p of connections.values())p.pc.setConfiguration({iceServers});}if(configReady){const done=configReady;configReady=null;done();}},get enabled(){return enabled}};
}
