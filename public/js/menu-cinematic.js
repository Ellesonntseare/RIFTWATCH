// RIFTWATCH cinematic menu: preserves the existing gameplay controls by relocating their live DOM nodes.
// Do not replace #modes/#maps/#lobby/.play-options with copies: main.js and network.js own them.
import { selectedHero, HEROES } from './roster.js';
import * as THREE from 'three';
import { buildHero } from './hero.js';

const $ = id => document.getElementById(id);
const menu = $('menu');
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
        <a class="rw-top-link" href="/hero.html">LOADOUT</a>
        <a class="rw-top-link" href="/hero.html">CUSTOMIZE</a>
        <button class="rw-top-link" type="button" data-rw-open="squad">MULTIPLAYER</button>
        <button class="rw-top-link" type="button" data-rw-open="options">OPTIONS</button>
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
        <div class="rw-corner tl"></div><div class="rw-corner tr"></div><div class="rw-corner bl"></div><div class="rw-corner br"></div>
        <div class="rw-hero-caption"><span>● ACTIVE OPERATOR</span><strong id="rw-hero-caption">FIELD COMMANDER</strong><small id="rw-caption-role">TACTICAL DIVISION</small></div>
        <a class="rw-change" href="/hero.html">CHANGE OPERATOR ↗</a>
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
    <footer class="rw-footer">
      <div class="rw-status"><span>▤</span><div id="rw-status-slot"></div></div>
      <button type="button" class="rw-squad-button" data-rw-open="squad"><span class="rw-avatar">RW</span><span class="rw-avatar">+</span><span class="rw-avatar">+</span><b>SQUAD / INVITE ↗</b></button>
      <button type="button" class="rw-deploy" data-rw-open="maps">SELECT MAP <span>↗</span></button>
    </footer>
    <div class="rw-dialog hidden" id="rw-dialog" role="dialog" aria-modal="true" aria-labelledby="rw-dialog-heading">
      <div class="rw-dialog-backdrop" data-rw-close></div>
      <section class="rw-dialog-inner">
        <header><div><small>RIFTWATCH / FIELD TERMINAL</small><h2 id="rw-dialog-heading">DEPLOYMENT</h2></div><button type="button" aria-label="Close dialog" class="rw-dialog-close" data-rw-close>✕</button></header>
        <div id="rw-panel-maps" class="rw-dialog-panel"><p>Choose your battlefield. For 1V1 Duel, first create a room with exactly two players.</p><div id="rw-maps-slot"></div></div>
        <div id="rw-panel-squad" class="rw-dialog-panel hidden"><p>Create or join a private room, then choose a map when everyone is ready.</p><div id="rw-lobby-slot"></div><button type="button" class="rw-next" data-rw-open="maps">CHOOSE BATTLEFIELD ↗</button></div>
        <div id="rw-panel-options" class="rw-dialog-panel hidden"><p>Adjust visuals and controls for your device.</p><div id="rw-options-slot"></div><p class="rw-note">Performance mode is recommended on phones.</p><button type="button" class="rw-next" data-rw-close>APPLY & RETURN ↗</button></div>
      </section>
    </div>`;
  menu.classList.add('rw-menu');
  $('rw-modes-slot').append(originalNodes.modes);
  $('rw-maps-slot').append(originalNodes.maps);
  $('rw-lobby-slot').append(originalNodes.lobby);
  $('rw-options-slot').append(originalNodes.options);
  $('rw-status-slot').append(originalNodes.loadtxt);
  // The actual mode buttons, map buttons and lobby controls are the ORIGINAL elements.
  const operator = selectedHero();
  const label = operator.name || 'OPERATOR';
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
  const descriptions = {campaign:'Recover the relay. Survive ten sectors and extract.',endless:'Survive wave after wave of hostile forces.',hunt:'Track 30 targets in the island wilderness.',duel:'Create a private two-player room. First to 5 eliminations.'};
  const syncMode = () => {
    const mode = modes.querySelector('.modebtn.sel')?.dataset.mode || 'campaign';
    $('rw-mode-description').textContent = descriptions[mode];
    $('rw-dialog-heading').textContent = mode === 'duel' ? 'PRIVATE DUEL / DEPLOYMENT' : 'SELECT YOUR BATTLEFIELD';
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
    if (!['maps','squad','options'].includes(which)) return;
    if (dialog.classList.contains('hidden')) returnFocus = document.activeElement;
    for (const type of ['maps','squad','options']) $('rw-panel-' + type).classList.toggle('hidden',which !== type);
    $('rw-dialog-heading').textContent = which === 'squad' ? 'SQUAD / MULTIPLAYER' : which === 'options' ? 'FIELD OPTIONS' : 'SELECT YOUR BATTLEFIELD';
    dialog.classList.remove('hidden');
    menu.classList.add('rw-dialog-active');
    dialog.querySelector('[data-rw-close]').focus();
    if (which === 'maps') syncMode();
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
  initOperatorPreview($('rw-hero-stage'), operator);
}

async function initOperatorPreview(stage, operator) {
  if (!stage || !stage.isConnected) return;
  let renderer, avatar, frameId = 0, last = 0;
  try {
    const width = () => Math.max(1,stage.clientWidth), height = () => Math.max(1,stage.clientHeight);
    renderer = new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width(),height());
    stage.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xc4eaff,0x101827,2.3));
    const key = new THREE.DirectionalLight(0xc6f5ff,2.5);key.position.set(-3,4,5);scene.add(key);
    const rim = new THREE.DirectionalLight(0x41daef,3.0);rim.position.set(3,3,-3);scene.add(rim);
    const camera = new THREE.PerspectiveCamera(31,width()/height(),.1,60);
    camera.position.set(0,1.14,5.8);
    camera.lookAt(0,1.05,0);
    avatar = await buildHero(operator.id,{preview:true});
    if (!stage.isConnected) { renderer.dispose();return; }
    scene.add(avatar.root);
    avatar.root.rotation.y = -.23;
    $('rw-preview-loading')?.remove();
    const resize = () => {
      if (!stage.isConnected) return;
      const w = width(), h = height();
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    let lastRender = 0;
    function animate(now) {
      if (!stage.isConnected) { observer.disconnect(); renderer.dispose();return; }
      frameId = requestAnimationFrame(animate);
      if (document.hidden || menuHidden() || now-lastRender < 1000/24) return;
      const dt = Math.min(.05,(now-last || 0)/1000);last=now;lastRender=now;
      avatar.update(dt,false,0);
      avatar.root.rotation.y = -.23 + Math.sin(now*.00028)*.045;
      renderer.render(scene,camera);
    }
    frameId = requestAnimationFrame(animate);
  } catch(error) {
    console.warn('Operator menu preview unavailable',error);
    $('rw-preview-loading').textContent = 'OPERATOR PREVIEW UNAVAILABLE';
    renderer?.dispose();
    if (frameId) cancelAnimationFrame(frameId);
  }
}
function menuHidden() { return menu.classList.contains('hidden') || !menu.isConnected; }
