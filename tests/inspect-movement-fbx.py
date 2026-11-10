import bpy,json,os
files=[r'C:\Users\elles\Downloads\runner\skins\Fast Run.fbx',r'C:\Users\elles\Downloads\runner\Falling To Roll.fbx',r'C:\Users\elles\Downloads\runner\Jumping Up.fbx',r'C:\Users\elles\Downloads\runner\Running.fbx']
for path in files:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 try:
  bpy.ops.import_scene.fbx(filepath=path)
  meshes=[o for o in bpy.data.objects if o.type=='MESH'];arms=[o for o in bpy.data.objects if o.type=='ARMATURE']
  print('FBX_REPORT '+json.dumps({'file':os.path.basename(path),'meshes':[(o.name,len(o.data.vertices),[round(x,3) for x in o.dimensions]) for o in meshes], 'armatures':[(o.name,len(o.data.bones),[b.name for b in o.data.bones][:12]) for o in arms],'actions':[(a.name,list(a.frame_range)) for a in bpy.data.actions],'images':[(i.name,list(i.size),bool(i.packed_file)) for i in bpy.data.images]}),flush=True)
 except Exception as e: print('FBX_ERROR '+str(e),flush=True)
