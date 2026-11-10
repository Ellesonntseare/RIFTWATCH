import bpy,json
print('ASSET_INSPECT',json.dumps({'objects':[{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else 0} for o in bpy.data.objects],'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file)} for i in bpy.data.images]}))
