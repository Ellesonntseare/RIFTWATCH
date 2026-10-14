export const HEROES = [
  { id:'personal',name:'SERAME',role:'FIELD COMMANDER',file:'MAIN HERO.glb',hp:110,speed:6,reload:1,description:'Your personal operator. A versatile frontline fighter with balanced mobility and extra resilience.',trait:'STEADY HAND',traitInfo:'110 health · balanced movement · standard reload',accent:0xa4ffe1 },
  { id:'tactical',name:'GHOST',role:'RECON SPECIALIST',file:'MAIN HERO.glb',hp:90,speed:6.8,reload:.85,description:'Fast through the ruins and quick on the reload. Stay moving, find an angle, and strike before the enemy settles.',trait:'QUICK RESPONSE',traitInfo:'15% faster reload · high mobility · lighter armor',accent:0x8bd9ff },
  { id:'vanguard',name:'ROOK',role:'ASSAULT OPERATOR',file:'HERO 3.glb',hp:130,speed:5.5,reload:1,description:'A hardened assault operator built to hold dangerous routes. Trades a little speed for the health to stay in the fight.',trait:'HOLD THE LINE',traitInfo:'130 health · reinforced armor · measured movement',accent:0xffc68b },
  { id:'sentinel',name:'ATLAS',role:'HEAVY SENTINEL',file:'HERO 1.glb',hp:160,speed:4.8,reload:1.1,description:'Heavy armor for the hardest sectors. Durable and deliberate, Atlas can take punishment while the squad would seek cover.',trait:'FORTRESS',traitInfo:'160 health · heavy armor · slower movement and reload',accent:0xc4afff },
];
// The reserved hero appears only after its model has been supplied and enabled.
if(typeof window!=='undefined'){
  try{const extra=await (await fetch('/extra-hero.json',{signal:AbortSignal.timeout(3000)})).json();if(extra.enabled&&extra.file&&extra.id&&!HEROES.some(h=>h.id===extra.id))HEROES.push(extra);}catch(e){console.warn('Additional hero configuration',e.message);}
}
export function selectedHero() {let id='personal';try{id=localStorage.getItem('riftwatch-hero')||localStorage.getItem('riftwatch-skin')||id;}catch{}return HEROES.find(h=>h.id===id)||HEROES[0];}
