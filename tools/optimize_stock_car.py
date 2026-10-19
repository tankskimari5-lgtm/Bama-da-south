import os
import collections
from pathlib import Path
import trimesh

src=Path('public/cars/Bama_Box_Sedan_Stock.glb')
dst=Path('public/cars/Bama_Box_Sedan_Stock_Mobile.glb')
s=trimesh.load(src,force='scene')
out=trimesh.Scene()
out.metadata.update(s.metadata)
parents=s.graph.transforms.parents
for node in s.graph.nodes:
    if node==s.graph.base_frame or node in s.graph.nodes_geometry: continue
    parent=parents.get(node)
    mat,_=s.graph.get(node,frame_from=parent)
    out.graph.update(frame_to=node,frame_from=parent,matrix=mat)

groups=collections.defaultdict(list)
for node in s.graph.nodes_geometry:
    parent=parents[node]
    transform,_=s.graph.get(node,frame_from=parent)
    geom=s.geometry[s.graph[node][1]].copy()
    material=geom.visual.material
    geom.apply_transform(transform)
    groups[(parent,material.name)].append(geom)

for (parent,matname),meshes in groups.items():
    merged=meshes[0] if len(meshes)==1 else trimesh.util.concatenate(meshes)
    merged.visual=trimesh.visual.TextureVisuals(material=meshes[0].visual.material)
    label=(parent+'_'+matname.replace(' ','_').replace('/','_'))
    out.add_geometry(merged,node_name=label,geom_name=label,parent_node_name=parent)

dst.write_bytes(out.export(file_type='glb'))
reloaded=trimesh.load(dst,force='scene')
assert len(reloaded.geometry)<140
assert all(name in reloaded.graph.nodes for name in ('Hood_Hinge','Trunk_Hinge','Engine_Radiator_Fan','Wheel_FL','Wheel_RR'))
assert abs(reloaded.bounds[1][2]-2.903)<.2
print('optimized',len(s.geometry),'->',len(reloaded.geometry),'size',dst.stat().st_size)
