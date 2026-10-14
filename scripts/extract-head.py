"""Extract only the unchanged head/eye geometry consumed by personal-head.js."""
import json, struct
from pathlib import Path
root = Path(__file__).resolve().parents[1]
raw = (root / 'models/winter_soldier_-_summer_soldier.glb').read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
source = json.loads(raw[20:20 + length])
binary = raw[28 + length:]
out = dict(asset={'version':'2.0'}, scene=0, scenes=[{'nodes':[]}], nodes=[], meshes=[], materials=[], accessors=[], bufferViews=[], buffers=[])
data = bytearray()
def accessor(index):
    a = dict(source['accessors'][index]); v = dict(source['bufferViews'][a['bufferView']])
    assert 'sparse' not in a
    size = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']] * {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    start = v.get('byteOffset',0) + a.get('byteOffset',0); stride = v.get('byteStride',size)
    payload = b''.join(binary[start+i*stride:start+i*stride+size] for i in range(a['count']))
    while len(data) % 4: data.append(0)
    v = {'byteOffset':len(data),'byteLength':len(payload),'buffer':0}
    data.extend(payload); a['byteOffset']=0;a['bufferView'] = len(out['bufferViews']);out['bufferViews'].append(v)
    out['accessors'].append(a)
    return len(out['accessors']) - 1
for mesh in source['meshes']:
    for primitive in mesh['primitives']:
        name = source['materials'][primitive['material']]['name']
        if name not in ['MI_1041303_Head','MI_1041303_Eyes_01','MI_1041303_Eyes_02','MI_1041303_Eyes_03']: continue
        p = {'attributes':{k:accessor(v) for k,v in primitive['attributes'].items() if k in ['POSITION','NORMAL']},'indices':accessor(primitive['indices']),'material':len(out['materials'])}
        out['materials'].append({'name':name});out['nodes'].append({'mesh':len(out['meshes'])})
        out['scenes'][0]['nodes'].append(len(out['nodes'])-1);out['meshes'].append({'name':mesh['name'],'primitives':[p]})
assert len(out['meshes']) == 4
while len(data) % 4: data.append(0)
out['buffers']=[{'byteLength':len(data)}]
js=json.dumps(out,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
result=struct.pack('<III',0x46546c67,2,28+len(js)+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
(root/'models/serame-head.glb').write_bytes(result)
print(f'Head asset: {len(raw):,} -> {len(result):,} bytes; unchanged head and eye geometry')
