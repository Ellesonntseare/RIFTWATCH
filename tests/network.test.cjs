const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/js/network.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createNetwork','function createNetwork');
function setup(){
  const elements=new Map(),maps=[{disabled:false},{disabled:false}];
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',classList:{toggle(){}}});return elements.get(id);},querySelectorAll(){return maps;}};
  class Socket{static OPEN=1;constructor(){this.readyState=1;Socket.instance=this;queueMicrotask(()=>this.onopen());}send(){}close(){}receive(message){this.onmessage({data:JSON.stringify(message)});}}
  const context={document,WebSocket:Socket,selectedHero:()=>({id:'personal',name:'Tester'}),createRoomVoice:()=>({stop(){},enabled:false}),createRoomChat:()=>({setRoom(){},receive(){}}),location:{protocol:'http:',host:'localhost',search:''},URLSearchParams,setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(source,context);
  let ready=true;const net=context.createNetwork({canSelectMap:()=>ready});document.getElementById('create-code').value='TEAMONE';
  return {elements,maps,Socket,net,setReady(value){ready=value;}};
}
test('guest disconnect and room closure restore map selection without unlocking loading maps',async()=>{
  for(const event of ['closed','disconnect']){
    const c=setup();await c.elements.get('create-room').onclick();
    c.Socket.instance.receive({type:'joined',role:'guest',code:'ABCDEF',host:'p1'});
    assert(c.maps.every(b=>b.disabled));
    if(event==='closed')c.Socket.instance.receive({type:'closed',message:'Host left'});else c.Socket.instance.onclose();
    assert(c.maps.every(b=>!b.disabled));assert.equal(c.net.role,null);
    c.setReady(false);c.net.render();assert(c.maps.every(b=>b.disabled));
  }
});
