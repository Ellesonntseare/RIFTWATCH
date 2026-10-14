let ac = null, master = null, muted = false, ambience = null;
let music=null,musicVolume=.09,ducked=false;
export function setMusicVolume(value){musicVolume=Math.max(0,Math.min(.3,value));if(music)music.volume=musicVolume*(ducked?.35:1);}
export function duckMusic(speaking){ducked=!!speaking;setMusicVolume(musicVolume);}
export function toggleAudio() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.35, ac.currentTime, 0.1);if(music)music.muted=muted; return muted; }
export function setAmbience(active) { if (ambience) ambience.gain.setTargetAtTime(active ? 0.015 : 0, ac.currentTime, 0.4);if(music){if(active)music.play().catch(()=>{});else music.pause();} }
export function initAudio() {
  if (ac) { ac.resume();music?.play().catch(()=>{}); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.35;
  const limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 8; master.connect(limiter); limiter.connect(ac.destination);
  ambience = ac.createGain(); ambience.gain.value = 0; ambience.connect(master);
  for (const frequency of [55, 82.41, 110.18]) { const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = frequency; osc.connect(ambience); osc.start(); }
  music=new Audio('/assets/audio/dark-alleys.ogg');music.loop=true;music.volume=musicVolume;music.muted=muted;music.play().catch(()=>{});
}
function noise(dur, vol, fc, type = 'lowpass') {
  if (!ac) return; const n = ac.sampleRate * dur | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = fc;
  const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start();
}
function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
export const sfx = {
  shot: () => { noise(0.035, 0.8, 5500, 'highpass'); noise(0.18, 0.5, 1700); tone(130, 38, 0.14, 0.6, 'triangle'); tone(900, 180, 0.025, 0.12, 'square'); },
  step: () => { noise(0.075, 0.13, 700); tone(90, 50, 0.06, 0.06); },
  laser: () => { tone(1500, 300, 0.12, 0.25, 'sawtooth'); noise(0.05, 0.2, 6000, 'highpass'); },
  hit: () => tone(300, 120, 0.06, 0.25, 'square'),
  headshot: () => { tone(1200, 1800, 0.12, 0.4, 'triangle'); tone(900, 400, 0.15, 0.3, 'square', 0.02); },
  kill: () => { tone(220, 60, 0.25, 0.4, 'sawtooth'); },
  hurt: () => { tone(120, 50, 0.2, 0.5, 'sawtooth'); noise(0.1, 0.4, 600); },
  growl: v => { tone(90, 50, 0.5, 0.25 * v, 'sawtooth'); },
  explosion: v => { noise(1.1, 1.0 * v, 500); tone(70, 20, 0.8, 0.8 * v, 'sine'); },
  reload: () => { tone(500, 300, 0.05, 0.3, 'square'); tone(300, 600, 0.06, 0.3, 'square', 0.9); },
  empty: () => tone(200, 180, 0.04, 0.3, 'square'),
  wave: () => { tone(220, 440, 0.4, 0.4, 'triangle'); tone(330, 660, 0.4, 0.3, 'triangle', 0.15); },
  pickup: () => { tone(600, 900, 0.1, 0.3, 'triangle'); tone(900, 1200, 0.1, 0.3, 'triangle', 0.1); },
  throw: () => noise(0.12, 0.3, 1500, 'bandpass'),
  beep: v => tone(1800, 1800, 0.06, 0.25 * v, 'sine'),
  swap: () => { noise(0.08, 0.3, 3000, 'bandpass'); },
};
