// RIFTWATCH cinematic menu: preserves the existing gameplay controls by relocating their live DOM nodes.
// Do not replace #modes/#maps/#lobby/.play-options with copies: main.js and network.js own them.
import { selectedHero, HEROES } from './roster.js';
import * as THREE from 'three';
import { buildHero } from './hero.js';

const $ = id => document.getElementById(id);
const menu = $('menu');
let updateOperatorPreview = () => {};
if (menu) initializeCinematicMenu();

function initializeCinematicMenu() {
  const modes = $('modes');
  const maps = $('maps');
  const lobby = $('lobby');
  const options = menu.querySelector('.play-options');
  const loadtxt = $('loadtxt');
  if (!modes || !maps || !lobby || !options || !loadtxt) return;
  const originalNodes = { modes, maps, lobby, options, loadtxt };
  // Retain already-initialized buttons and nodes so all original event listeners survive.
  menu.innerHTML = `
    <div class="rw-atmosphere" aria-hidden="true"><div class="rw-grid"></div><div class="rw-light"></div></div>
    <header class="rw-topbar">
      <a class="rw-logo" href="/?deploy=1"><span class="rw-sigil">R<span>W</span></span><strong>RIFTWATCH</strong></a>
      <nav class="rw-topnav" aria-label="Main navigation">
        <button class="rw-top-link active" type="button" data-rw-home>GAME MODES</button>
        <button class="rw-top-link" type="button" data-rw-open="operator">OPERATORS</button>
        <button class="rw-top-link" type="button" data-rw-open="squad">MULTIPLAYER</button>
        <button class="rw-top-link" type="button" data-rw-open="options">SETTINGS</button>
      </nav>
      <button type="button" class="rw-profile" data-rw-open="squad"><small>PROFILE</small><strong id="rw-profile-name">OPERATOR</strong><span>▦</span></button>
    </header>
    <main class="rw-stage">
      <section class="rw-left">
        <div class="rw-title"><small>HERO DIVISION <em>/</em> FIELD OPERATIONS</small><h1>RIFT<span>WATCH</span><sup>01</sup></h1><p>THE WORLD BROKE OPEN. <b>TAKE IT BACK.</b></p></div>
        <div class="rw-select">
          <div class="rw-panel-heading"><span>GAME MODES</span><small>SELECT OPERATION / 01</small></div>
          <div id="rw-modes-slot"></div>
          <p id="rw-mode-description">Select a mission type and deploy to the field.</p>
        </div>
        <button type="button" class="rw-promo" data-rw-open="maps"><span class="rw-promo-icon">⌁</span><span><small>RIFTWATCH // MISSION CONTROL</small><strong>YOUR NEXT DEPLOYMENT</strong><em>CHOOSE BATTLEFIELD ↗</em></span></button>
      </section>
      <section class="rw-center" aria-label="3D operator showcase">
        <div class="rw-spotlight" aria-hidden="true"></div>
        <div id="rw-hero-stage" role="img" aria-label="Preview of your selected operator"><div id="rw-preview-loading">INITIALIZING OPERATOR...</div></div>
         <button id="rw-operator-prev" class="rw-operator-arrow rw-operator-prev" type="button" aria-label="Previous operator">‹</button><button id="rw-operator-next" class="rw-operator-arrow rw-operator-next" type="button" aria-label="Next operator">›</button>
        <div class="rw-corner tl"></div><div class="rw-corner tr"></div><div class="rw-corner bl"></div><div class="rw-corner br"></div>
        <div class="rw-hero-caption"><span>● ACTIVE OPERATOR</span><strong id="rw-hero-caption">FIELD COMMANDER</strong><small id="rw-caption-role">TACTICAL DIVISION</small></div>
        <button class="rw-change" type="button" data-rw-open="operator">CHANGE OPERATOR ↗</button>
      </section>
      <aside class="rw-right">
        <div class="rw-rank"><span class="rw-rank-icon">RW</span><div><small>OPERATOR STATUS</small><strong>READY FOR DEPLOYMENT</strong><span>● TACTICAL DIVISION</span></div></div>
        <div class="rw-stat-panel">
          <header class="rw-card-title"><span>OPERATOR PROFILE</span><small>LIVE DATA</small></header>
          <div class="rw-unit"><b id="rw-hero-name">OPERATOR</b><small id="rw-hero-role">FIELD COMMANDER</small></div>
          <div class="rw-meter-item"><span>HEALTH <b id="rw-hero-health">110 HP</b></span><div class="rw-meter"><i id="rw-health-track"></i></div></div>
          <div class="rw-meter-item"><span>MOBILITY <b id="rw-hero-speed">6.0 M/S</b></span><div class="rw-meter"><i id="rw-speed-track"></i></div></div>
          <div class="rw-meter-item"><span>RELOAD <b id="rw-hero-reload">2.0 S</b></span><div class="rw-meter"><i id="rw-reload-track"></i></div></div>
          <div class="rw-trait">SIGNATURE TRAIT <strong id="rw-trait">STEADY HAND</strong></div>
        </div>
        <div class="rw-mission-panel">
          <header class="rw-card-title"><span>MISSION BRIEF</span><small>ACTIVE OBJECTIVES</small></header>
          <div class="rw-mission-row"><em>01</em><span><b>RECOVER THE RELAY</b><small>Secure mission data</small></span><i>◇</i></div>
          <div class="rw-mission-row"><em>02</em><span><b>CLEAR THE SECTOR</b><small>Eliminate hostiles</small></span><i>◇</i></div>
          <div class="rw-mission-row"><em>03</em><span><b>REACH EXTRACTION</b><small>Return to the relay</small></span><i>◇</i></div>
        </div>
        <button class="rw-mission-button" type="button" data-rw-open="maps"><small>NEXT OPERATION</small><strong>SELECT DEPLOYMENT ↗</strong></button>
      </aside>
    </main>
    <details class="rw-deployment" open>
    <summary>SELECT YOUR DEPLOYMENT</summary>
    <footer class="rw-footer">
      <div class="rw-status"><span>▤</span><div id="rw-status-slot"></div></div>
      <button type="button" class="rw-squad-button" data-rw-open="squad"><span class="rw-avatar">RW</span><span class="rw-avatar">+</span><span class="rw-avatar">+</span><b>SQUAD / INVITE ↗</b></button>
      <button type="button" class="rw-deploy" data-rw-open="maps">SELECT MAP <span>↗</span></button>
    </footer>
    </details>
    <div class="rw-dialog hidden" id="rw-dialog" role="dialog" aria-modal="true" aria-labelledby="rw-dialog-heading">
      <div class="rw-dialog-backdrop" data-rw-close></div>
      <section class="rw-dialog-inner">
        <header><div><small>RIFTWATCH / FIELD TERMINAL</small><h2 id="rw-dialog-heading">DEPLOYMENT</h2></div><button type="button" aria-label="Close dialog" class="rw-dialog-close" data-rw-close>✕</button></header>
        <div id="rw-panel-maps" class="rw-dialog-panel"><p>Choose your battlefield. For 1V1 Duel, first create a room with exactly two players.</p><div id="rw-maps-slot"></div></div>
        <div id="rw-panel-squad" class="rw-dialog-panel hidden"><p>Create or join a private room, then choose a map when everyone is ready.</p><div id="rw-lobby-slot"></div><section class="rw-voice-card" aria-label="Squad voice chat"><span class="rw-voice-title">SQUAD VOICE <small id="rw-voice-status">VOICE OFF</small></span><div class="rw-voice-actions"><button id="rw-voice-toggle" type="button">ENABLE VOICE</button><button id="rw-voice-mute" type="button" class="hidden">MUTE MIC</button></div><div id="rw-voice-peers" class="rw-voice-peers" aria-live="polite"></div></section><button type="button" class="rw-next" data-rw-open="maps">CHOOSE BATTLEFIELD ↗</button></div>
        <div id="rw-panel-options" class="rw-dialog-panel hidden"><p>Adjust visuals and controls for your device.</p><div id="rw-options-slot"></div><label class="rw-music-label" for="rw-music-range">MUSIC VOLUME <strong id="rw-music-number">9%</strong></label><input id="rw-music-range" type="range" min="0" max="30" value="9" aria-label="Music volume"><p class="rw-note">Performance mode is recommended on phones.</p><p><a href="/asset-credits.html">ASSET CREDITS ↗</a></p><button type="button" class="rw-next" data-rw-close>APPLY & RETURN ↗</button></div>
        <div id="rw-panel-operator" class="rw-dialog-panel hidden"><p>Choose an operator, personalize your callsign, and return to the battlefield. All changes are saved on this device.</p><div class="rw-operator-editor"><div><div class="rw-panel-heading"><span>YOUR OPERATORS</span><small id="rw-operator-count">AVAILABLE</small></div><div id="rw-operator-choices" class="rw-operator-choices"></div></div><div class="rw-operator-edit-info"><small>PROFILE / CALLSIGN</small><h3 id="rw-operator-choice-role">FIELD COMMANDER</h3><p id="rw-operator-choice-description"></p><label for="rw-callsign">OPERATOR NAME</label><input id="rw-callsign" type="text" maxlength="24" autocomplete="nickname" placeholder="Enter your callsign"><p class="rw-note">This name is also used in multiplayer rooms.</p><button type="button" class="rw-next" id="rw-save-operator">SAVE OPERATOR & RETURN ↗</button><p id="rw-operator-message" role="status"></p></div></div></div>
      </section>
    </div>`;
  menu.classList.add('rw-menu');
  $('rw-modes-slot').append(originalNodes.modes);
  $('rw-maps-slot').append(originalNodes.maps);
  $('rw-lobby-slot').append(originalNodes.lobby);
  $('rw-options-slot').append(originalNodes.options);
  $('rw-status-slot').append(originalNodes.loadtxt);
  // The actual mode buttons, map buttons and lobby controls are the ORIGINAL elements.
  // Operator customization is now a first-class pane inside this menu, not a redirect to hero.html.
  const choices = $('rw-operator-choices');
  const callsign = $('rw-callsign');
  let activeHeroId = selectedHero().id;
  const cleanName = value => String(value || '').replace(/[<>\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
  callsign.value = selectedHero().name || '';
  $('rw-operator-count').textContent = HEROES.length + ' AVAILABLE';
  function renderProfile() {
    const operator = selectedHero(), label = operator.name || 'OPERATOR';
    $('rw-profile-name').textContent = label;
    $('rw-hero-name').textContent = label;
    $('rw-hero-role').textContent = operator.role;
    $('rw-hero-caption').textContent = label.toUpperCase();
    $('rw-caption-role').textContent = operator.role;
    $('rw-hero-health').textContent = operator.hp + ' HP';
    $('rw-hero-speed').textContent = operator.speed.toFixed(1) + ' M/S';
    $('rw-hero-reload').textContent = (2 * operator.reload).toFixed(1) + ' S';
    $('rw-trait').textContent = operator.trait;
    $('rw-health-track').style.width = Math.round(Math.min(100,operator.hp/160*100)) + '%';
    $('rw-speed-track').style.width = Math.round(Math.min(100,operator.speed/7*100)) + '%';
    $('rw-reload-track').style.width = Math.round(Math.max(6,Math.min(100,(1.25-operator.reload)/.45*100))) + '%';
    $('rw-operator-choice-role').textContent = operator.role;
    $('rw-operator-choice-description').textContent = operator.description;
  }
  function renderChoices() {
    choices.replaceChildren();
    for (const config of HEROES) {
      const button = document.createElement('button');
      button.type='button';
      button.className='rw-operator-option' + (config.id===activeHeroId?' selected':'');
      button.setAttribute('aria-pressed',String(config.id===activeHeroId));
      const number=document.createElement('span'); number.className='rw-operator-option-number';number.textContent=String(HEROES.indexOf(config)+1).padStart(2,'0');
      const data=document.createElement('span');data.className='rw-operator-option-copy';
      const name=document.createElement('strong');name.textContent=config.role;
      const stats=document.createElement('small');stats.textContent=config.hp+' HP  /  '+config.speed.toFixed(1)+' MOBILITY';
      data.append(name,stats);
      const arrow=document.createElement('span');arrow.textContent='›';arrow.className='rw-operator-option-arrow';
      button.append(number,data,arrow);
      button.addEventListener('click',()=>selectOperator(config));
      choices.append(button);
    }
  }
  function announceProfileChange() {
    // The existing WebSocket client can update the room roster when the host has not deployed yet.
    window.dispatchEvent(new CustomEvent('riftwatch:profile-changed'));
  }
  function selectOperator(config) {
    activeHeroId=config.id;
    try { localStorage.setItem('riftwatch-hero',config.id); } catch(error) { console.warn('Could not save operator',error); }
    renderProfile();renderChoices();
    $('rw-operator-message').textContent=config.role+' SELECTED';
    updateOperatorPreview(config);
    announceProfileChange();
  }
  function shiftOperator(direction){
    const position=HEROES.findIndex(config=>config.id===activeHeroId);
    selectOperator(HEROES[(position+direction+HEROES.length)%HEROES.length]);
  }
  $('rw-operator-prev').addEventListener('click',()=>shiftOperator(-1));
  $('rw-operator-next').addEventListener('click',()=>shiftOperator(1));
  const showcase=$('rw-hero-stage');
  let swipeStart=null;
  showcase.addEventListener('touchstart',event=>{if(event.touches.length===1)swipeStart={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  showcase.addEventListener('touchend',event=>{
    if(!swipeStart||!event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-swipeStart.x,dy=event.changedTouches[0].clientY-swipeStart.y;swipeStart=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2)shiftOperator(dx<0?1:-1);
  },{passive:true});
  showcase.addEventListener('touchcancel',()=>{swipeStart=null;},{passive:true});
  let lastWheel=0;
  showcase.addEventListener('wheel',event=>{
    const amount=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(Math.abs(amount)<20||Date.now()-lastWheel<300)return;
    event.preventDefault();lastWheel=Date.now();shiftOperator(amount>0?1:-1);
  },{passive:false});
  function saveCallsign() {
    const name=cleanName(callsign.value) || 'Operator';
    callsign.value=name;
    try {
      localStorage.setItem('riftwatch-operator-name',name);
      localStorage.setItem('riftwatch-custom-name-set','1');
    } catch(error) {console.warn('Could not save operator name',error);}
    renderProfile();
    announceProfileChange();
    $('rw-operator-message').textContent='PROFILE SAVED';
  }
  $('rw-save-operator').addEventListener('click',()=>{saveCallsign();close();});
  callsign.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('rw-save-operator').click();}});
  renderProfile();renderChoices();
  const music=$('music-volume');
  const localMusic=$('rw-music-range');
  if (music) {
    localMusic.value=music.value;
    $('rw-music-number').textContent=music.value+'%';
    localMusic.addEventListener('input',()=>{
      music.value=localMusic.value;
      music.dispatchEvent(new Event('input',{bubbles:true}));
      $('rw-music-number').textContent=localMusic.value+'%';
    });
  }
  const voiceToggle=$('voice-toggle'),voiceMute=$('voice-mute'),voiceStatus=$('voice-status');
  const syncVoice=()=>{
    $('rw-voice-toggle').textContent=voiceToggle?.textContent || 'ENABLE VOICE';
    $('rw-voice-mute').textContent=voiceMute?.textContent || 'MUTE MIC';
    $('rw-voice-mute').classList.toggle('hidden',voiceMute?.classList.contains('hidden') ?? true);
    $('rw-voice-status').textContent=voiceStatus?.textContent || 'VOICE OFF';
    $('rw-voice-toggle').disabled=!$('room-code').textContent.trim() && voiceToggle?.textContent==='ENABLE VOICE';
    document.body.classList.toggle('rw-room-joined',!!$('room-code').textContent.trim());
  };
  $('rw-voice-toggle').addEventListener('click',()=>voiceToggle?.click());
  $('rw-voice-mute').addEventListener('click',()=>voiceMute?.click());
  if (voiceToggle && voiceMute && voiceStatus) {
    new MutationObserver(syncVoice).observe($('voice-controls'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    new MutationObserver(syncVoice).observe($('room-code'),{childList:true,characterData:true,subtree:true});
  }
  function syncMenuVisibility() {
    const showing=!menu.classList.contains('hidden');
    document.body.classList.toggle('rw-menu-visible',showing);
    document.body.classList.toggle('rw-game-visible',!showing && !$('hud').classList.contains('hidden'));
    syncVoice();
  }
  new MutationObserver(syncMenuVisibility).observe(menu,{attributes:true,attributeFilter:['class']});
  new MutationObserver(syncMenuVisibility).observe($('hud'),{attributes:true,attributeFilter:['class']});
  syncMenuVisibility();
  const descriptions = {campaign:'Recover the relay. Survive ten sectors and extract.',endless:'Survive wave after wave of hostile forces.',hunt:'Track 30 targets in the island wilderness.',duel:'Create a private two-player room. First to 5 eliminations.'};
  const syncMode = () => {
    const mode = modes.querySelector('.modebtn.sel')?.dataset.mode || 'campaign';
    $('rw-mode-description').textContent = descriptions[mode];
    if (!$('rw-panel-maps').classList.contains('hidden')) $('rw-dialog-heading').textContent = mode === 'duel' ? 'PRIVATE DUEL / DEPLOYMENT' : 'SELECT YOUR BATTLEFIELD';
  };
  modes.addEventListener('click', () => { queueMicrotask(syncMode); });
  syncMode();
  const dialog = $('rw-dialog');
  let returnFocus = null;
  function close() {
    dialog.classList.add('hidden');
    menu.classList.remove('rw-dialog-active');
    returnFocus?.focus?.();
    returnFocus = null;
  }
  function open(which) {
    if (!['maps','squad','options','operator'].includes(which)) return;
    if (dialog.classList.contains('hidden')) returnFocus = document.activeElement;
    for (const type of ['maps','squad','options','operator']) $('rw-panel-' + type).classList.toggle('hidden',which !== type);
    $('rw-dialog-heading').textContent = which === 'squad' ? 'SQUAD / MULTIPLAYER' : which === 'options' ? 'FIELD OPTIONS' : which === 'operator' ? 'CHOOSE YOUR OPERATOR' : 'SELECT YOUR BATTLEFIELD';
    dialog.classList.remove('hidden');
    menu.classList.add('rw-dialog-active');
    dialog.querySelector('.rw-dialog-close').focus();
    if (which === 'maps') syncMode();
    if (which === 'operator') { renderChoices(); callsign.value=selectedHero().name || ''; }
  }
  menu.addEventListener('click', event => {
    const openButton = event.target.closest('[data-rw-open]');
    if (openButton) { open(openButton.dataset.rwOpen); return; }
    if (event.target.closest('[data-rw-close]')) { close(); return; }
    if (event.target.closest('[data-rw-home]')) { close(); return; }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.classList.contains('hidden')) { event.preventDefault(); close(); }
    if (event.key === 'Tab' && !dialog.classList.contains('hidden')) {
      const focusable = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')]
        .filter(el => !el.closest('.hidden') && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  // Join links open the squad pane, while preserving the URL-driven multiplayer workflow.
  if (new URLSearchParams(location.search).has('room')) open('squad');
  else if (new URLSearchParams(location.search).has('operator')) open('operator');
  initOperatorPreview($('rw-hero-stage'), selectedHero());
}

async function initOperatorPreview(stage, firstOperator) {
  if (!stage || !stage.isConnected) return;
  let renderer, avatar, observer, frameId=0, last=0, request=0;
  try {
    const width=()=>Math.max(1,stage.clientWidth),height=()=>Math.max(1,stage.clientHeight);
    const mobile=matchMedia('(pointer:coarse)').matches;
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setSize(width(),height(),false);
    stage.prepend(renderer.domElement);
    const scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xc4eaff,0x101827,2.3));
    const key=new THREE.DirectionalLight(0xc6f5ff,2.5);key.position.set(-3,4,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0x41daef,3);rim.position.set(3,3,-3);scene.add(rim);
    const camera=new THREE.PerspectiveCamera(31,width()/height(),.1,60);
    camera.position.set(0,1.14,3.65);camera.lookAt(0,1.05,0);
    const loading=$('rw-preview-loading');
    updateOperatorPreview=async config=>{
      const token=++request;
      if (!stage.isConnected || menuHidden()) return;
      if (loading) {loading.hidden=false;loading.textContent='PREPARING '+config.role+'…';}
      try {
        const next=await buildHero(config.id,{preview:true});
        if(token!==request || !stage.isConnected || menuHidden())return;
        if(avatar)scene.remove(avatar.root);
        avatar=next;avatar.root.rotation.y=-.23;scene.add(avatar.root);
        if(loading)loading.hidden=true;
      } catch(error) {
        console.warn('Operator preview unavailable',error);
        if(token===request&&loading){loading.hidden=false;loading.textContent='PREVIEW UNAVAILABLE · OPERATOR STILL PLAYABLE';}
      }
    };
    const resize=()=>{
      if(!stage.isConnected)return;
      const w=width(),h=height();
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    };
    if(typeof ResizeObserver==='function'){observer=new ResizeObserver(resize);observer.observe(stage);}
    else window.addEventListener('resize',resize);
    function animate(now){
      if(!stage.isConnected || menuHidden()){
        observer?.disconnect();
        if(!observer)window.removeEventListener('resize',resize);
        updateOperatorPreview=()=>{};
        renderer.forceContextLoss();renderer.dispose();
        renderer.domElement.remove();
        return;
      }
      frameId=requestAnimationFrame(animate);
      if(document.hidden || now-last < (mobile?1000/18:1000/24))return;
      const dt=Math.min(.05,(now-last)/1000||0);last=now;
      if(avatar){
        avatar.update(dt,false,0);
        avatar.root.rotation.y=-.23+Math.sin(now*.00028)*.045;
      }
      renderer.render(scene,camera);
    }
    frameId=requestAnimationFrame(animate);
    await updateOperatorPreview(firstOperator);
  }catch(error){
    console.warn('Operator preview renderer unavailable',error);
    if($('rw-preview-loading'))$('rw-preview-loading').textContent='OPERATOR PREVIEW UNAVAILABLE';
    if(frameId)cancelAnimationFrame(frameId);
    observer?.disconnect();renderer?.dispose();
  }
}
function menuHidden(){return menu.classList.contains('hidden')||!menu.isConnected;}
