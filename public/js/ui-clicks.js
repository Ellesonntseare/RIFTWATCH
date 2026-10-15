import {isAudioMuted} from './audio.js';

let context;
let lastClick = 0;

function note(start, end, duration, volume, delay = 0, type = 'triangle') {
  const at = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(start, at);
  oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(volume, at + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.01);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

function play(kind) {
  if (isAudioMuted() || document.hidden || performance.now() - lastClick < 55) return;
  lastClick = performance.now();
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
    if (kind === 'confirm') {
      note(410, 590, 0.075, 0.042);
      note(700, 1030, 0.09, 0.027, 0.055, 'sine');
    } else if (kind === 'select') {
      note(550, 720, 0.06, 0.035);
      note(1180, 870, 0.027, 0.009, 0, 'sine');
    } else if (kind === 'back') {
      note(460, 290, 0.065, 0.03);
    } else {
      note(650, 390, 0.042, 0.028);
      note(1360, 910, 0.02, 0.007, 0, 'sine');
    }
  } catch (error) {
    console.warn('Menu sound unavailable', error);
  }
}

export function installMenuClicks(heroPage = false) {
  document.addEventListener('click', event => {
    const control = event.target.closest('button,a');
    if (!control || control.disabled || control.closest('#mobile-controls')) return;
    if (!heroPage && !control.closest('#menu,#pause,#shop,#over,#hud-editor,#map-loading')) return;
    if (control.matches('#equip,.mapbtn,#windowed,#shopnext,#restart,#hud-save')) play('confirm');
    else if (control.matches('a,#back-maps,#hud-cancel,.loading-back')) play('back');
    else if (control.matches('#previous,#next,.modebtn,.graphicsbtn,.povbtn,.scopebtn,.difficultybtn')) play('select');
    else play('click');
  }, true);
}
