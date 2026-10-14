import {test} from 'node:test';
import assert from 'node:assert/strict';
import {downloadMap,downloadLabel} from '../public/js/map-download.js';

function response(headers, chunks) {
  return new Response(new ReadableStream({start(controller) {
    for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
    controller.close();
  }}), {headers});
}
test('compressed download uses decoded asset size, not compressed length', async () => {
  const updates=[];
  const bytes=await downloadMap('/map.glb',p=>updates.push(p),async()=>response({'Content-Encoding':'gzip','Content-Length':'2','X-Asset-Size':'4'},[[1,2],[3,4]]));
  assert.deepEqual([...new Uint8Array(bytes)],[1,2,3,4]);
  assert.equal(updates[1].total,4);
  assert.match(downloadLabel('City',updates[1]),/50%/);
  assert.equal(updates.at(-1).done,true);
});
test('missing decoded size never invents remaining bytes',async()=>{
  const updates=[];
  await downloadMap('/map.glb',p=>updates.push(p),async()=>response({'Content-Encoding':'gzip','Content-Length':'2'},[[1,2,3,4]]));
  assert.equal(updates[1].total,0);
  assert.match(downloadLabel('City',updates[1]),/total size unavailable/);
});
test('truncated downloads and HTTP failures do not report completion',async()=>{
  const updates=[];
  await assert.rejects(downloadMap('/map.glb',p=>updates.push(p),async()=>response({'X-Asset-Size':'8'},[[1,2]])),/Incomplete/);
  assert(!updates.some(p=>p.done));
  await assert.rejects(downloadMap('/missing',()=>{},async()=>new Response('',{status:404})),/404/);
});
test('remaining size is shown until preparation starts',()=>{
  assert.match(downloadLabel('City',{loaded:1048576,total:4194304,done:false}),/25%.*1.0 \/ 4.0 MB.*3.0 MB left/);
  assert.match(downloadLabel('City',{loaded:4,total:4,done:true}),/download complete.*preparing map/);
});
