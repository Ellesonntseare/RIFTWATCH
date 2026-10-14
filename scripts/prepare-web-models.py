"""Create smaller delivery copies; preserve source GLBs and all mesh/rig data. Run the optional weld/simplify step separately before regenerating gzip files."""
import io,json,struct,gzip,sys
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'models';out=root/'web';out.mkdir(exist_ok=True)
names=sys.argv[1:] or ['MAIN HERO.glb','HERO 1.glb','HERO 3.glb','futuristic_soldier_free.glb','winter_soldier_-_summer_soldier.glb','gun-bot_with_walk_and_idle_animation.glb','crimson_fire_demon_-_triposr_vs_supavoxel.glb','horned_minotaur_demon_-_png_to_stl_-_supavoxel.glb','low-poly_colt_m4a1.glb','chg_laser_machine_gun.glb','chg_c4.glb','explosive_barrel.glb','old_gun_cabinet_with_animations.glb']
for name in names:
 src=root/name;raw=src.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:];replacements={}
 for im in doc.get('images',[]):
  if 'bufferView' not in im:continue
  ix=im['bufferView'];v=doc['bufferViews'][ix];start=v.get('byteOffset',0);original=binary[start:start+v['byteLength']]
  image=Image.open(io.BytesIO(original));image.thumbnail((512,512),Image.Resampling.LANCZOS)
  buf=io.BytesIO();opaque=('A' not in image.getbands() or image.getchannel('A').getextrema()==(255,255));fmt='JPEG' if opaque else 'PNG'
  if opaque:image=image.convert('RGB');image.save(buf,format=fmt,quality=85,optimize=True)
  else:image.save(buf,format=fmt,optimize=True)
  new=buf.getvalue()
  if len(new)<len(original):replacements[ix]=new;im['mimeType']='image/jpeg' if opaque else 'image/png'
 data=bytearray()
 for i,v in enumerate(doc.get('bufferViews',[])):
  start=v.get('byteOffset',0);payload=replacements.get(i,binary[start:start+v['byteLength']])
  while len(data)%4:data.append(0)
  v['byteOffset']=len(data);v['byteLength']=len(payload);data.extend(payload)
 while len(data)%4:data.append(0)
 doc['buffers']=[{'byteLength':len(data)}]
 js=json.dumps(doc,separators=(',',':'),ensure_ascii=True).encode();js+=b' '*((-len(js))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(js)+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
 target=out/name;target.write_bytes(result);compressed=gzip.compress(result,compresslevel=6,mtime=0);Path(str(target)+'.gz').write_bytes(compressed)
 print(f'{name}: {len(raw):,} -> {len(result):,}; transfer {len(compressed):,}',flush=True)
