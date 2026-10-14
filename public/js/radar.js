export const RADAR_RANGE=45;
export function radarPoint(x,z,player,radius=94,edge=false){
  const dx=x-player.pos.x,dz=z-player.pos.z,cos=Math.cos(player.yaw),sin=Math.sin(player.yaw);
  let px=(dx*cos-dz*sin)*radius/RADAR_RANGE,py=(dx*sin+dz*cos)*radius/RADAR_RANGE;
  const distance=Math.hypot(px,py),limit=radius-7,outside=distance>limit;
  if(outside&&!edge)return null;
  if(outside){px*=limit/distance;py*=limit/distance;}
  return {x:px,y:py,outside,distance:Math.hypot(dx,dz)};
}
export function renderRadar(canvas,{player,map,background,backgroundScale,monsters,items,peers=[],selfId,time=0}){
  const c=canvas.getContext('2d'),size=240,h=size/2,r=94;
  c.setTransform(canvas.width/size,0,0,canvas.height/size,0,0);c.clearRect(0,0,size,size);
  c.save();c.translate(h,h);
  const circle=(radius,fill,stroke)=>{c.beginPath();c.arc(0,0,radius,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  circle(118,'#08161de8','#5b7e85');circle(113,null,'#24444d');
  c.save();c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.clip();
  const glow=c.createRadialGradient(0,0,0,0,0,r);glow.addColorStop(0,'#1d3940');glow.addColorStop(1,'#0b1c26');circle(r,glow);
  // Terrain and contacts rotate together; the player's forward direction stays up.
  c.save();c.rotate(player.yaw);
  const scale=r/RADAR_RANGE;
  if(background){const [w,d]=map.size;c.drawImage(background,(-player.pos.x-w/2)*scale,(-player.pos.z-d/2)*scale,background.width/backgroundScale*scale,background.height/backgroundScale*scale);}
  c.strokeStyle='#9ad2ce12';c.lineWidth=.6;
  for(let n=-7;n<=7;n++){
    const x=(n*10-player.pos.x%10)*scale,z=(n*10-player.pos.z%10)*scale;
    c.beginPath();c.moveTo(x,-r*1.5);c.lineTo(x,r*1.5);c.moveTo(-r*1.5,z);c.lineTo(r*1.5,z);c.stroke();
  }c.restore();
  c.lineWidth=1;c.setLineDash([2,5]);circle(r/2,null,'#b2e6e21c');c.setLineDash([]);
  c.fillStyle='#b1fce00c';c.beginPath();c.moveTo(0,0);c.arc(0,0,r,-Math.PI*.70,-Math.PI*.30);c.closePath();c.fill();
  c.restore();
  c.lineWidth=1;circle(r,null,'#8acbc956');
  for(let i=0;i<60;i++){const a=i*Math.PI/30;c.strokeStyle=i%5===0?'#93b3b9':'#344d56';c.beginPath();c.moveTo(Math.sin(a)*98,-Math.cos(a)*98);c.lineTo(Math.sin(a)*(i%5===0?103:100),-Math.cos(a)*(i%5===0?103:100));c.stroke();}
  c.font='bold 10px Consolas,monospace';c.textAlign='center';c.textBaseline='middle';
  ['N','E','S','W'].forEach((label,i)=>{const a=i*Math.PI/2+player.yaw;c.fillStyle=label==='N'?'#a4ffe1':'#91a8b0';c.fillText(label,Math.sin(a)*109,-Math.cos(a)*109);});
  function marker(p,kind,color,size=4){if(!p)return;c.save();c.translate(p.x,p.y);c.lineWidth=1.4;c.strokeStyle='#08151c';c.fillStyle=color;
    c.beginPath();if(kind==='diamond'){c.moveTo(0,-size);c.lineTo(size,0);c.lineTo(0,size);c.lineTo(-size,0);c.closePath();}
    else if(kind==='cross'){c.fillRect(-1.2,-4,2.4,8);c.fillRect(-4,-1.2,8,2.4);c.restore();return;}
    else if(kind==='square')c.rect(-size,-size,size*2,size*2);
    else c.arc(0,0,size,0,Math.PI*2);c.fill();c.stroke();c.restore();
  }
  for(const item of items){if(item.kind==='relay')continue;const p=radarPoint(item.pos.x,item.pos.z,player,r);marker(p,item.kind==='med'?'cross':'square',item.kind==='med'?'#80efb0':'#92b9cd',item.kind==='cache'?3:2);}
  let contacts=0;
  for(const m of monsters){if(m.dead)continue;const p=radarPoint(m.x,m.z,player,r);if(p)contacts++;marker(p,m.T.stationary?'diamond':'dot',m.T.stationary?'#ffd278':'#ff707c',m.T.boss?6:3.6);}
  for(const peer of peers){const p=peer.position;if(peer.id===selfId||!p?.active||p.hp<=0)continue;marker(radarPoint(p.pos[0],p.pos[2],player,r,true),'diamond','#73caff',4.5);}
  const relay=items.find(i=>i.kind==='relay');
  if(relay){const p=radarPoint(relay.pos.x,relay.pos.z,player,r,true);c.save();c.translate(p.x,p.y);c.globalAlpha=.45+.15*Math.sin(time*3);circle(9,null,'#a4ffe1');c.restore();marker(p,'diamond','#a4ffe1',5.5);if(p.outside){c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.y,p.x)+Math.PI/2);c.strokeStyle='#a4ffe1';c.beginPath();c.moveTo(-4,-7);c.lineTo(0,-11);c.lineTo(4,-7);c.stroke();c.restore();}}
  // Two-tone arrow stays centered; heading is encoded by rotating the map.
  c.shadowColor='#000';c.shadowBlur=5;c.fillStyle='#f2fff9';c.strokeStyle='#0b272b';c.lineWidth=2;
  c.beginPath();c.moveTo(0,-9);c.lineTo(6,7);c.lineTo(0,3);c.lineTo(-6,7);c.closePath();c.fill();c.stroke();c.shadowBlur=0;
  c.restore();
  return {contacts,distance:relay?Math.round(Math.hypot(relay.pos.x-player.pos.x,relay.pos.z-player.pos.z)):null};
}
