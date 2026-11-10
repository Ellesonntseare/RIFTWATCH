import bpy,json,os
from pathlib import Path
files=[('fast',r'C:\Users\elles\Downloads\runner\skins\Fast Run.fbx','fastRun'),('roll',r'C:\Users\elles\Downloads\runner\Falling To Roll.fbx','landRoll'),('jump',r'C:\Users\elles\Downloads\runner\Jumping Up.fbx','jump'),('run',r'C:\Users\elles\Downloads\runner\Running.fbx','run')]
report=[]
for slug,path,clip in files:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.fbx(filepath=path)
 arms=[o for o in bpy.data.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
 for action in bpy.data.actions:action.name=clip
 action=bpy.data.actions[0];bpy.context.scene.frame_start=int(action.frame_range[0]);bpy.context.scene.frame_end=int(action.frame_range[1]);bpy.context.scene.render.fps=30
 for image in bpy.data.images:
  if max(image.size)>1024:image.scale(max(1,int(image.size[0]*1024/max(image.size))),max(1,int(image.size[1]*1024/max(image.size))))
 output=Path('models/web/runner-'+slug+'.glb').resolve()
 bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=True,export_force_sampling=True,export_image_format='AUTO',export_morph=False)
 report.append({'file':Path(path).name,'output':output.name,'bytes':output.stat().st_size,'meshes':[(o.name,len(o.data.vertices)) for o in meshes],'bones':[(a.name,len(a.data.bones)) for a in arms],'clip':clip,'frames':list(action.frame_range)})
 Path('tests/runner-import-report.json').write_text(json.dumps(report,indent=2))
 print('EXPORTED_RUNNER '+json.dumps(report[-1]),flush=True)
