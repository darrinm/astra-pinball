import bpy, math, os
from mathutils import Vector
root='/Users/darrin/src/astra-pinball'
col=bpy.data.collections.new('Candy Castle Asset')
bpy.context.scene.collection.children.link(col)
created=[]
def mat(name,c,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.27
 return m
pink=mat('Strawberry fondant',(.82,.14,.29)); cream=mat('Vanilla icing',(1,.79,.48)); roof=mat('Raspberry glaze',(.46,.025,.095)); gold=mat('Caramel gold',(.76,.4,.1),.65); dark=mat('Chocolate windows',(.06,.012,.02))
def finish(o,name,m):
 o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o);o.data.materials.append(m);created.append(o)
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o
def cyl(name,x,y,z,r,h,m,r2=None):
 if r2 is None:bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=h,location=(x,y,z))
 else:bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r,radius2=r2,depth=h,location=(x,y,z))
 return finish(bpy.context.object,name,m)
def sphere(name,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc);o=finish(bpy.context.object,name,m);o.scale=scale;return o
for x,y,r,h in [(0,.3,.77,1.9),(-.94,0,.4,1.18),(.94,0,.4,1.18),(-.63,.72,.32,1.7),(.63,.72,.32,1.7)]:
 cyl('Fondant tower',x,y,h/2,r,h,pink)
 for z in [.12,h-.12]:cyl('Icing cornice',x,y,z,r*1.09,.16,cream)
 cyl('Swirled roof',x,y,h+.42,r*1.22,.95,roof,0.015)
 for j in range(7):
  a=j*math.tau/7;sphere('Icing drip',(x+math.cos(a)*r,y+math.sin(a)*r,h-.17),(.11,.11,.2+(j%3)*.04),cream)
 for z in [.46,.87]:
  sphere('Chocolate inset',(x,y-r-.015,z),(.085,.025,.16),dark)
 cyl('Flag pole',x,y,h+1.03,.018,.32,gold)
 sphere('Golden finial',(x,y,h+1.21),(.06,.06,.06),gold)
# Door arch, open visually at center front.
for j in range(13):
 a=j/12*math.pi
 sphere('Door icing arch',(.35*math.cos(a),-.49,.4+.35*math.sin(a)),(.075,.075,.075),cream)
sphere('Dark castle door',(0,-.485,.28),(.3,.025,.4),dark)
for x in [-.36,.36]:cyl('Door jamb',x,-.49,.2,.06,.4,cream)
bpy.ops.object.select_all(action='DESELECT')
for o in created:o.select_set(True)
bpy.context.view_layer.objects.active=created[0]
bpy.ops.export_scene.gltf(filepath=root+'/public/assets/candy-castle.glb',export_format='GLB',use_selection=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'/design/candy-castle.blend',copy=True)
result={'objects':len(created),'asset':root+'/public/assets/candy-castle.glb'}
