import { HEROES,selectedHero,operatorName } from './roster.js';
import {createHeroSelection} from './hero-selection.js';
import {installMenuClicks} from './ui-clicks.js?v=20261015-menu-audio';
installMenuClicks(true);
const $=id=>document.getElementById(id);
let index=HEROES.findIndex(h=>h.id===selectedHero().id),preview;
const getPreview=()=>preview ||= import('./hero-preview.js');
const chosenName=()=> $('operator-name').value.trim().replace(/\s+/g,' ').slice(0,24);
function updateName(){
 const name=chosenName(),display=name||'YOUR NAME';
 $('hero-name').textContent=display;
 document.querySelector('.backdrop-word').textContent=display;
 $('equip').textContent=name?'DEPLOY AS '+name.toUpperCase()+' ↗':'ENTER YOUR NAME TO DEPLOY';
 $('equip').disabled=!name;
}
function writeProfile(config){
 $('hero-number').textContent=`OPERATOR ${String(index+1).padStart(2,'0')} / ${String(HEROES.length).padStart(2,'0')}`;$('hero-role').textContent=config.role;$('hero-description').textContent=config.description;$('hero-trait').textContent=config.trait;$('hero-trait-info').textContent=config.traitInfo;
 updateName();$('health-value').textContent=config.hp+' HP';$('speed-value').textContent=config.speed.toFixed(1)+' m/s';$('reload-value').textContent=(2*config.reload).toFixed(1)+' s';
 $('health-bar').style.width=config.hp/160*100+'%';$('speed-bar').style.width=config.speed/7*100+'%';$('reload-bar').style.width=(1.25-config.reload)/.45*100+'%';
 $('roster-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(HEROES.length).padStart(2,'0')}`;$('roster-dots').innerHTML=HEROES.map((h,i)=>`<i class="${i===index?'active':''}"></i>`).join('');
 document.documentElement.style.setProperty('--accent','#'+config.accent.toString(16).padStart(6,'0'));
}

const selection=createHeroSelection({
  profile:config=>{writeProfile(config);$('previous').disabled=$('next').disabled=false;},
  status:text=>{$('status').textContent=text;},
  load:async config=>{const view=await getPreview();view.selectPreview(config);return view.loadPreview(config);},
  display:async hero=>(await getPreview()).displayPreview(hero),
});
function show(){selection.select(HEROES[index]);}
$('previous').onclick=()=>{index=(index+HEROES.length-1)%HEROES.length;show();};
$('next').onclick=()=>{index=(index+1)%HEROES.length;show();};
$('operator-name').value=operatorName();
$('operator-name').addEventListener('input',updateName);
$('equip').onclick=()=>{const name=chosenName();if(!name){$('operator-name').focus();return;}try{localStorage.setItem('riftwatch-hero',HEROES[index].id);localStorage.setItem('riftwatch-operator-name',name);localStorage.setItem('riftwatch-custom-name-set','1');sessionStorage.setItem('riftwatch-ready','1');}catch{}const room=new URLSearchParams(location.search).get('room');location.href='/?deploy=1'+(room?'&room='+encodeURIComponent(room):'');};

addEventListener('keydown',e=>{if(e.target===$('operator-name'))return;if(e.code==='ArrowLeft')$('previous').click();if(e.code==='ArrowRight')$('next').click();});
show();
