export function createRoomChat(send){
  const panel=document.getElementById('room-chat');
  const toggle=document.getElementById('chat-toggle');
  const header=document.getElementById('chat-drag');
  const close=document.getElementById('chat-close');
  const messages=document.getElementById('chat-messages');
  const form=document.getElementById('chat-form');
  const input=document.getElementById('chat-input');
  const badge=document.getElementById('chat-badge');
  let room=null,unread=0,drag=null;
  function clamp(){
    if(panel.classList.contains('hidden'))return;
    const width=panel.offsetWidth,height=panel.offsetHeight;
    panel.style.left=Math.max(4,Math.min(innerWidth-width-4,parseFloat(panel.style.left)||innerWidth-width-12))+'px';
    panel.style.top=Math.max(4,Math.min(innerHeight-height-4,parseFloat(panel.style.top)||Math.max(4,innerHeight-height-74)))+'px';
  }
  function open(){panel.classList.remove('hidden');unread=0;badge.textContent='';badge.classList.add('hidden');requestAnimationFrame(clamp);}
  toggle.addEventListener('click',()=>panel.classList.contains('hidden')?open():panel.classList.add('hidden'));
  close.addEventListener('click',()=>panel.classList.add('hidden'));
  addEventListener('keydown',event=>{
    if(!room||event.key!=='Enter'||event.repeat||event.target===input||/INPUT|TEXTAREA/.test(event.target?.tagName||''))return;
    if(document.getElementById('menu').classList.contains('hidden')){
      event.preventDefault();event.stopImmediatePropagation();
      if(document.pointerLockElement)document.exitPointerLock();
      open();input.focus();
    }
  });
  header.addEventListener('pointerdown',event=>{
    if(event.target===close)return;
    event.preventDefault();
    const bounds=panel.getBoundingClientRect();
    panel.style.left=bounds.left+'px';panel.style.top=bounds.top+'px';
    drag={id:event.pointerId,x:event.clientX-bounds.left,y:event.clientY-bounds.top};
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;panel.style.left=(event.clientX-drag.x)+'px';panel.style.top=(event.clientY-drag.y)+'px';clamp();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(type,event=>{if(drag?.id===event.pointerId)drag=null;});
  addEventListener('resize',clamp);
  form.addEventListener('submit',event=>{
    event.preventDefault();const message=input.value.trim();
    if(!room||!message)return;
    send(message);input.value='';
  });
  function add(name,message,self=false){
    const row=document.createElement('p');row.className=self?'chat-self':'';
    const who=document.createElement('strong');who.textContent=name+': ';
    row.append(who,document.createTextNode(message));messages.append(row);
    while(messages.children.length>50)messages.firstElementChild.remove();
    messages.scrollTop=messages.scrollHeight;
    if(panel.classList.contains('hidden')&&!self){badge.textContent=String(++unread);badge.classList.remove('hidden');}
  }
  return {
    setRoom(code){if(code===room)return;room=code;messages.replaceChildren();unread=0;badge.textContent='';badge.classList.add('hidden');toggle.classList.toggle('hidden',!code);panel.classList.add('hidden');},
    receive(name,message,self){if(room)add(name,message,self);},
  };
}
