import bpy,json
from pathlib import Path
bpy.ops.object.select_all(action='DESELECT')
obj=bpy.data.objects['AR48sRifle'];obj.select_set(True);bpy.context.view_layer.objects.active=obj
for mod in list(obj.modifiers):
 if mod.type=='SUBSURF':obj.modifiers.remove(mod)
mod=obj.modifiers.new('Mobile mesh','DECIMATE');mod.ratio=.45
bpy.ops.object.modifier_apply(modifier=mod.name)
for image in bpy.data.images:
 if image.size[0]>1024 and image.name.startswith('AR48_'):image.scale(1024,1024)
output=str(Path('models/web/ar48s.glb').resolve());Path(output).parent.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO',export_animations=False)
print('EXPORTED',output,len(obj.data.vertices))
