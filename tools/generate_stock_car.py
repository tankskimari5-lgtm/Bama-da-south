"""Original mesh-based 1980s box sedan with modular hood/trunk and a speaker enclosure.
Bama Da South asset. Uses trimesh; units meters, Y-up, front -Z.
"""
import os, math, json, copy, collections
import numpy as np
import trimesh
from PIL import Image
from trimesh.visual.material import PBRMaterial
from trimesh.transformations import translation_matrix, rotation_matrix

OUT=os.environ.get('BAMA_ASSET_OUT','public/cars')
os.makedirs(OUT,exist_ok=True)
scene=trimesh.Scene(); count=collections.Counter(); tags={}
COL={
 'paint':((104,106,107,255),.25,.30),
 'paint_dark':((78,82,83,255),.35,.19),
 'paint_light':((133,135,135,255),.26,.24),
 'vinyl':((49,50,49,255),.92,.01),
 'chrome':((204,210,211,255),.19,.92),
 'chrome_soft':((149,155,157,255),.33,.70),
 'black':((16,18,21,255),.87,.03),
 'rubber':((20,21,23,255),.97,0),
 'wheel_grey':((61,65,70,255),.72,.28),
 'whitewall':((219,212,194,255),.78,.03),
 'glass':((42,62,69,110),.11,.15),
 'windshield':((69,95,99,105),.08,.07),
 'red':((158,23,27,255),.29,.12),
 'red_bright':((212,29,32,255),.26,.07),
 'amber':((235,132,38,255),.22,.10),
 'headlamp':((226,220,199,255),.17,.12),
 'engine':((52,55,58,255),.48,.38),
 'engine_red':((160,42,34,255),.44,.36),
 'hoses':((26,29,31,255),.89,.03),
 'battery':((30,34,38,255),.83,.05),
 'copper':((179,108,59,255),.44,.65),
 'carpet':((51,52,56,255),.94,.03),
 'inner':((35,38,41,255),.92,.02),
 'brake':((75,82,84,255),.45,.50),
 'belt':((14,16,17,255),.92,.01),
 'under_glass':((9,12,13,255),.93,.02),
 'seats':((54,53,54,255),.94,.01),
}
mats={}
for k,(c,rough,metal) in COL.items():
 mats[k]=PBRMaterial(name=k,baseColorFactor=np.array(c)/255,roughnessFactor=rough,metallicFactor=metal,alphaMode='BLEND' if c[3]<255 else 'OPAQUE',doubleSided=(k in ['glass','windshield']))

def place_mesh(name,mesh,material,parent='Vehicle_Root',transform=None):
 if len(mesh.faces)==0:return None
 mesh.visual=trimesh.visual.TextureVisuals(material=mats.get(material,material))
 count[name]+=1
 nm=name if count[name]==1 else f'{name}_{count[name]:02}'
 return scene.add_geometry(mesh, geom_name=nm,node_name=nm,parent_node_name=parent,transform=transform)

def loc(center):return translation_matrix(center)
def box(name,center,extents,mat,parent='Vehicle_Root'):
 return place_mesh(name,trimesh.creation.box(extents=extents),mat,parent,loc(center))
def cyl(name,center,radius,height,mat,parent='Vehicle_Root',axis='z',sections=20):
 mesh=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
 t=np.eye(4)
 if axis=='y': t=rotation_matrix(np.pi/2,[1,0,0])
 if axis=='x': t=rotation_matrix(np.pi/2,[0,1,0])
 t[:3,3]=center
 return place_mesh(name,mesh,mat,parent,t)
def tube(name,center,major,minor,material,parent='Vehicle_Root',axis='z',sect=32,minorsect=9):
 g=trimesh.creation.torus(major,minor,major_sections=sect,minor_sections=minorsect)
 t=np.eye(4)
 if axis=='x':t=rotation_matrix(np.pi/2,[0,1,0])
 if axis=='y':t=rotation_matrix(np.pi/2,[1,0,0])
 t[:3,3]=center
 return place_mesh(name,g,material,parent,t)
def bar(name,start,end,r,mat,parent='Vehicle_Root',sections=10):
 a,b=np.array(start,float),np.array(end,float);v=b-a; d=np.linalg.norm(v)
 if d<1e-7:return
 g=trimesh.creation.cylinder(radius=r,height=d,sections=sections,segment=np.array([a,b]))
 return place_mesh(name,g,mat,parent)
def plate(name,points,mat,parent='Vehicle_Root',double=True):
 points=np.array(points,float)
 if len(points)==4:
  faces=[[0,1,2],[0,2,3]]
 elif len(points)==3:faces=[[0,1,2]]
 else:faces=[[0,i,i+1] for i in range(1,len(points)-1)]
 if double:faces=faces+[f[::-1] for f in faces]
 return place_mesh(name,trimesh.Trimesh(vertices=points,faces=faces,process=False),mat,parent)
def closed_quad(name,points,depth,mat,parent='Vehicle_Root'):
 pts=np.array(points,float);n=np.cross(pts[1]-pts[0],pts[2]-pts[1]);n=n/(np.linalg.norm(n)+1e-9)
 vv=np.vstack([pts+depth*.5*n,pts-depth*.5*n]);faces=[]
 for i in range(1,len(pts)-1):faces.append([0,i,i+1]);faces.append([len(pts),len(pts)+i+1,len(pts)+i])
 for i in range(len(pts)):
  j=(i+1)%len(pts);faces.extend([[i,j,len(pts)+j],[i,len(pts)+j,len(pts)+i]])
 return place_mesh(name,trimesh.Trimesh(vertices=vv,faces=faces,process=False),mat,parent)

scene.graph.update(frame_to='Vehicle_Root',frame_from=scene.graph.base_frame,matrix=np.eye(4))
# Fundamental dimensions in meters. Keep model origin on the ground.
HALFWIDTH=.958; REAR=2.59;FRONT=-2.61;WHEEL_R=.354;WHEEL_Y=.395
FRONT_AXLE=-1.53;REAR_AXLE=1.54

# Dark rolling chassis, cabin floor, longitudinals, wheel wells.
box('Full_Floorpan',(0,.38,.05),(1.62,.15,4.62),'inner')
box('Main_Frame_Left',(-.60,.37,0),(.09,.20,4.55),'black')
box('Main_Frame_Right',(.60,.37,0),(.09,.20,4.55),'black')
box('Center_Tunnel',(0,.52,0),(.25,.20,2.9),'inner')
box('Underbody_Front_Beam',(0,.47,-2.26),(1.50,.18,.13),'engine')
box('Underbody_Rear_Beam',(0,.42,2.39),(1.49,.13,.15),'engine')

# Build outer side panels as continuous strips with cut wheel arches.
for side in [-1,1]:
 x=side*HALFWIDTH
 zs=np.linspace(FRONT,REAR,164)
 verts=[];faces=[]
 for z in zs:
  arch=.355
  for center in [FRONT_AXLE,REAR_AXLE]:
   dist=abs(z-center)
   if dist<.49:arch=max(arch,WHEEL_Y+math.sqrt(max(0,.49**2-dist**2)))
  # high belt line, foot line, folded accent and rounded shoulders
  z_end=(abs(z)>2.25)
  upper=1.04 if z < -1.02 or z > 1.37 else 1.13
  wx=x*(.975 if z_end else 1.0)
  verts.extend([(wx,arch,z),(wx,upper-.13,z),(wx-side*.013,upper-.02,z)])
 for k in range(len(zs)-1):
  a=3*k;b=a+3
  for i in range(2):
   faces.extend([[a+i,b+i,a+i+1],[a+i+1,b+i,b+i+1]])
 panel=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
 place_mesh('Body_Quarter_Left' if side<0 else 'Body_Quarter_Right',panel,'paint')
 # Body crease / rocker side thin chrome
 bar('Full_Length_Side_Moulding',(x+side*.006,.835,-2.32),(x+side*.006,.835,2.32),.009,'chrome_soft',sections=6)
 bar('Lower_Rocker_Trim',(x-side*.008,.414,-1.13),(x-side*.008,.414,1.00),.018,'chrome',sections=6)
 # shoulder seam above door top
 bar('Beltline_Trim',(x-side*.009,1.133,-.91),(x-side*.009,1.133,1.36),.015,'chrome',sections=6)
 # door seams, handle brackets, lock cylinders
 for z in [-.88,.18,1.30]:
  bar('Door_Gap',(x+side*.009,.465,z),(x+side*.009,1.106,z),.006,'black',sections=6)
 for z in [-.41,.80]:
  box('Chromed_Door_Handle',(x+side*.026,1.028,z),(.049,.036,.145),'chrome')
  cyl('Door_Keyhole',(x+side*.053,1.018,z+.115),.009,.003,'black',axis='x',sections=12)
 # side skirts chrome lower edge
 bar('Chrome_Sill_Bottom',(x,.36,-.9),(x,.36,1.07),.014,'chrome_soft')
 # sculpted rounded chrome lips above arch along vehicle side
 for za in [FRONT_AXLE,REAR_AXLE]:
  coords=[]
  for phi in np.linspace(math.pi,0,27):
   coords.append((x+side*.017,WHEEL_Y+math.sin(phi)*.485,za+math.cos(phi)*.485))
  for k in range(len(coords)-1):bar('Chrome_Wheel_Arch',coords[k],coords[k+1],.015,'chrome_soft',sections=5)
  # dark deep wheel wells; arch profile black lining
  for k in range(len(coords)-1):
   p0=list(coords[k]);p1=list(coords[k+1]);p0[0]-=side*.017;p1[0]-=side*.017
   bar('Black_Arch_Inner',p0,p1,.024,'black',sections=5)

# Front and rear cross surfaces, body end nose/tail
for z,kind in [(FRONT,'front'),(REAR,'rear')]:
 box('Front_Nose' if kind=='front' else 'Rear_Tail',(0,.75 if kind=='front' else .49,z), (1.80,.58 if kind=='front' else .26,.10),'paint')
 if kind=='rear':
  for side in [-1,1]:box('Tail_Quarter_Column',(side*.839,.833,z),( .185,.45,.115),'paint')
 box('Lower_Fascia_'+kind,(0,.505,z+(.04 if z<0 else -.04)),(1.80,.15,.14),'paint_dark')

# Doors and cabin from clear surfaces and A/B/C pillars.
# Seats visible through glass.
for sx in [-.43,.43]:
 for zz in [-.20,.63]:
  box('Velour_Seat_Cushion',(sx,.65,zz),(.50,.17,.48),'seats')
  box('Velour_Seat_Back',(sx,.95,zz+.16),(.51,.58,.12),'seats')
  box('Headrest',(sx,1.26,zz+.17),(.30,.18,.14),'seats')
box('Dashboard',(0,1.058,-.82),(1.56,.16,.34),'black')
for sx in [-.44,.44]:
 box('Dashboard_Trim_Chrome',(sx,1.122,-.68),(.66,.016,.015),'chrome_soft')
# steering wheel at driver left from front seat; torus normal z for vertical wheel (real wheel tilted)
tube('Steering_Wheel',(-.43,1.11,-.42),.185,.018,'black',axis='z',sect=32,minorsect=8)
bar('Steering_Column',(-.43,1.04,-.55),(-.43,1.12,-.36),.031,'chrome_soft')
for angle in range(3):
 a=angle*math.pi*2/3
 bar('Steering_Spoke',(-.43,1.11,-.412),(-.43+math.cos(a)*.15,1.11+math.sin(a)*.15,-.414),.011,'chrome')

# Four door body window glass. Front window x side, z intervals near B pillar.
for side in [-1,1]:
 x0=side*.916;xt=side*.782
 # front door glass trapezoid with slightly curved rear top
 f=[(x0,1.17,-.895),(x0,1.17,.105),(xt,1.54,.105),(xt,1.54,-.475)]
 r=[(x0,1.17,.235),(x0,1.17,1.225),(xt,1.54,.937),(xt,1.54,.235)]
 plate('Front_Door_Tinted_Window',f,'glass')
 plate('Rear_Door_Tinted_Window',r,'glass')
 # chrome window frames along front and rear panels
 for prefix,poly in [('Front',f),('Rear',r)]:
  for i in range(4):bar(prefix+'_Window_Chrome_Piping',poly[i],poly[(i+1)%4],.011,'chrome',sections=6)
 # prominent black/chrome B-pillar
 bar('B_Pillar_Black',(x0,1.16,.165),(xt,1.565,.165),.031,'black')
 bar('B_Pillar_Edge',(x0,1.16,.185),(xt,1.562,.185),.011,'chrome')
 # C pillar body paint and lower pillar - rear glass
 plate('C_Pillar_Painted',[(x0,1.135,1.23),(xt,1.56,.945),(xt,1.56,1.135),(x0,1.13,1.465)],'paint')
 # front mirror
 box('Chrome_Side_Mirror',(side*1.041,1.17,-.78),(.20,.105,.17),'paint_light')
 box('Mirror_Reflector',(side*1.145,1.17,-.78),(.010,.077,.128),'chrome_soft')
 bar('A_Pillar',(x0,1.17,-.96),(xt,1.575,-.53),.028,'chrome')
 bar('C_Pillar_Edge',(xt,1.54,.96),(x0,1.175,1.36),.025,'chrome')

# Windshield front and rear, roof vinyl texture modeled as dark roof panel.
windshield=[(-.88,1.152,-1.018),(.88,1.152,-1.018),(.78,1.565,-.525),(-.78,1.565,-.525)]
rearwindow=[(-.78,1.565,.985),(.78,1.565,.985),(.867,1.17,1.412),(-.867,1.17,1.412)]
plate('Laminated_Windshield',windshield,'windshield')
plate('Tinted_Rear_Glass',rearwindow,'glass')
for prefix,window in [('Front',windshield),('Rear',rearwindow)]:
 for k in range(4):bar(prefix+'_Windshield_Trim',window[k],window[(k+1)%4],.016,'chrome_soft')
box('Vinyl_Roof_Structure',(0,1.578,.23),(1.59,.078,1.54),'vinyl')
for side in [-1,1]:
 bar('Roof_Gutter', (side*.823,1.579,-.52),(side*.823,1.579,1.015),.013,'chrome')
 # roof edge molding
 bar('Roof_Rain_Gutter',(side*.836,1.516,-.50),(side*.836,1.516,1.035),.011,'chrome_soft')
# front wipers with crank pivots
for sx in [-.48,.39]:
 bar('Windshield_Wiper', (sx-.23,1.164,-1.017),(sx+.24,1.174,-1.006),.011,'black')

# Front headlight/bezel/grille system
box('Main_Grille_Depth',(0,.869,-2.690),(1.055,.355,.05),'black')
for x in [-.525,.525]:bar('Chrome_Grille_Edge_V',(x,.869,-2.726),(x,1.05,-2.726),.018,'chrome')
for y in [.692,1.044]:bar('Chrome_Grille_Edge_H',(-.532,y,-2.728),(.532,y,-2.728),.017,'chrome')
for x in np.linspace(-.485,.485,17):
 bar('Grille_Vertical_Slat',(x,.70,-2.733),(x,1.04,-2.733),.010,'chrome_soft',sections=5)
for xsign in [-1,1]:
 xx=xsign*.747
 box('Headlamp_Chrome_Bezel',(xx,.876,-2.698),(.395,.266,.040),'chrome')
 box('Rectangular_Headlight_Glass',(xx,.877,-2.724),(.342,.218,.022),'headlamp')
 # bulb reflector subdividers
 bar('Lamp_Internal_Divider',(xx,.77,-2.739),(xx,.975,-2.739),.006,'chrome_soft')
 box('Amber_Parking_Light',(xsign*.937,.826,-2.729),(.10,.176,.023),'amber')
box('Front_Bumper',(0,.49,-2.743),(1.92,.18,.20),'chrome')
box('Front_Rubber_Bumper_Strip',(0,.512,-2.851),(1.92,.045,.016),'black')
for side in [-1,1]:
 box('Front_Bumper_Endcap',(side*.91,.50,-2.709),(.10,.23,.24),'chrome')
 box('Front_Parking_Lamp',(side*.61,.426,-2.855),(.25,.044,.013),'headlamp')
box('Front_Plate_Bracket',(0,.45,-2.867),(.34,.185,.020),'black')
# Rear chrome and taillights
box('Rear_Deck_Fascia',(0,.589,2.654),(1.84,.16,.08),'paint')
for side in [-1,1]:
 box('Red_Taillight_Bezel',(side*.73,.84,2.713),(.41,.265,.043),'chrome')
 box('Red_Rectangle_Brake_Lens',(side*.73,.845,2.743),(.372,.213,.020),'red')
 box('Reverse_Lamp',(side*.74,.794,2.757),(.161,.045,.010),'headlamp')
 box('Rear_Turn_Stripe',(side*.91,.841,2.759),(.043,.208,.010),'red_bright')
box('Rear_Bumper_Chrome',(0,.50,2.754),(1.93,.20,.20),'chrome')
box('Rear_Bumper_Black_Rubber',(0,.536,2.862),(1.91,.04,.017),'black')
box('Rear_License_Surround',(0,.63,2.766),(.38,.19,.018),'chrome_soft')
box('Rear_Plate',(0,.630,2.783),(.31,.128,.009),'black')
for side in [-1,1]:
 box('Rear_Bumper_Overrider',(side*.49,.52,2.849),(.052,.183,.108),'black')

# Wheels: each is a true separate node, with tire rubber, chrome wire-spoke rims,
# whitewalls and brake/disc geometry.
for label,x,z in [('FL',-1.003,FRONT_AXLE),('FR',1.003,FRONT_AXLE),('RL',-1.003,REAR_AXLE),('RR',1.003,REAR_AXLE)]:
 group='Wheel_'+label
 scene.graph.update(frame_to=group,frame_from='Vehicle_Root',matrix=loc((x,WHEEL_Y,z)))
 tube('Tire_Rubber', (0,0,0), .315,.071,'rubber',group,axis='x',sect=36,minorsect=10)
 # circular bulk tire
 cyl('Tire_Sidewall',(0,0,0),.317,.204,'rubber',group,axis='x',sections=36)
 for offs in [-.109,.109]:
  cyl('Whitewall_Outer_Ring',(offs,0,0),.260,.003,'whitewall',group,axis='x',sections=40)
  cyl('Wheel_Dark_Center',(offs+(-.005 if offs<0 else .005),0,0),.224,.005,'black',group,axis='x',sections=40)
  cyl('Rim_Chrome_Face',(offs+(-.009 if offs<0 else .009),0,0),.202,.008,'chrome_soft',group,axis='x',sections=40)
  tube('Rim_Chrome_Bezel',(offs+(-.019 if offs<0 else .019),0,0),.206,.012,'chrome',group,axis='x',sect=40,minorsect=8)
  # highly detailed wire spokes criss-cross in 2 planes
  frontface=offs+(-.026 if offs<0 else .026)
  for k in range(20):
   a=k*math.tau/20
   aa=a+.37
   s1=(frontface,math.sin(a)*.078,math.cos(a)*.078)
   e1=(frontface,math.sin(aa)*.186,math.cos(aa)*.186)
   bar('Wire_Spoke',s1,e1,.0036,'chrome',group,sections=5)
   bb=a-.37
   e2=(frontface,math.sin(bb)*.186,math.cos(bb)*.186)
   bar('Wire_Cross_Spoke',s1,e2,.0033,'chrome',group,sections=5)
  cyl('Wheel_Center_Cap',(frontface+(.011 if offs>0 else -.011),0,0),.057,.019,'chrome',group,axis='x',sections=30)
  tube('Wheel_Spinner_Chrome',(frontface,0,0),.052,.008,'chrome',group,axis='x',sect=30,minorsect=7)

# Compartments. Hood lid and trunk lid are independent movable frames.
HOOD_PIVOT=np.array([0,1.090,-.910]);TRUNK_PIVOT=np.array([0,1.086,1.405]);
scene.graph.update(frame_to='Hood_Hinge',frame_from='Vehicle_Root',matrix=loc(HOOD_PIVOT))
scene.graph.update(frame_to='Trunk_Hinge',frame_from='Vehicle_Root',matrix=loc(TRUNK_PIVOT))

# Black motor bay: frame rails, exposed engine, radiator, firewall and bay painted inner walls.
box('Engine_Bay_Lower',(0,.555,-1.81),(1.45,.12,1.64),'inner')
box('Firewall',(0,.795,-.960),(1.51,.43,.056),'paint_dark')
for side in [-1,1]:
 box('Engine_Inner_Fender',(side*.746,.83,-1.77),(.08,.48,1.52),'paint_dark')
 box('Fender_Strut_Tower',(side*.660,.81,-1.24),(.24,.20,.27),'paint')
 cyl('Shock_Tower_Top',(side*.666,.934,-1.24),.095,.029,'black',axis='y')
# radiator near front, hoses
box('Radiator_Core',(0,.75,-2.375),(1.20,.45,.105),'black')
for sx in np.linspace(-.53,.53,21):
 bar('Radiator_Louver',(sx,.57,-2.434),(sx,.92,-2.434),.006,'chrome_soft',sections=5)
box('Radiator_Top_Tank',(0,.988,-2.36),(1.25,.092,.18),'engine')
# central V8 engine, valve covers, intake etc
box('V8_Cast_Iron_Block',(0,.695,-1.60),(.81,.41,.82),'engine_red')
box('V8_Oil_Pan',(0,.453,-1.68),(.63,.14,.76),'black')
for side in [-1,1]:
 # offset V banks
 g=trimesh.creation.box(extents=(.275,.130,.73))
 T=rotation_matrix(side*.29,[0,0,1]);T[:3,3]=[side*.39,.905,-1.59]
 place_mesh('V8_Chrome_Valve_Cover',g,'chrome_soft',transform=T)
 for k in range(4):
  b=(-1.83+k*.16)
  bar('V8_Spark_Plug_Wire',(side*.24,1.038,b),(side*.44,.864,b+.04),.006,'red_bright',sections=6)
 box('V8_Exhaust_Header',(side*.52,.575,-1.57),(.11,.21,.67),'copper')
# intake manifold / circular chrome air cleaner
box('V8_Intake_Manifold',(0,.91,-1.60),(.50,.12,.60),'engine')
cyl('Round_Air_Cleaner',(0,1.011,-1.61),.33,.105,'chrome',axis='y',sections=42)
cyl('Air_Cleaner_Dark_Filter',(0,1.066,-1.61),.285,.012,'black',axis='y',sections=42)
tube('Air_Filter_Metal_Lid',(0,1.076,-1.61),.294,.013,'chrome',axis='y')
# water pump, crankshaft pulleys, cooling fan
for y,r in [(.686,.106),(.84,.084),(.99,.062)]:
 cyl('Engine_Belt_Pulley',(0,y,-2.084),r,.06,'chrome_soft',axis='z',sections=26)
bar('Alternator_Belt',(0,.683,-2.138),(0,.973,-2.138),.011,'belt')
# alternator and brake booster, battery
cyl('Alternator_Chrome',(.48,.75,-2.04),.12,.19,'chrome_soft',axis='z',sections=16)
cyl('Brake_Booster',(-.61,.91,-1.028),.145,.10,'chrome_soft',axis='z',sections=26)
box('Master_Brake_Reservoir',(-.61,1.06,-1.030),(.14,.145,.23),'whitewall')
box('Battery_Case',(.596,.718,-2.15),(.30,.29,.28),'battery')
for sx in [.50,.68]:cyl('Battery_Terminal',(sx,.867,-2.12),.024,.03,'copper',axis='y')
# Coolant header, hoses
box('Coolant_Expansion_Tank',(-.60,.765,-2.195),(.21,.24,.29),'whitewall')
for side in [-1,1]:
 control=[(side*.34,1.10,-1.79),(side*.49,1.10,-2.04),(side*.46,.89,-2.26)]
 for a,b in zip(control[:-1],control[1:]):bar('Radiator_Rubber_Hose',a,b,.037,'hoses',sections=12)
# Hood with folded stamped under-panel, bevelled creases and raised center.
# Coordinates relative to Hood_Hinge. Front edge -2.545, rear hinge -.910.
hood_quad=[(-.805,0.020,-1.600),(.805,0.020,-1.600),(.855,-.017,0),(-.855,-.017,0)]
closed_quad('Hood_Outer_Skin',hood_quad,.037,'paint','Hood_Hinge')
closed_quad('Hood_Subliner',[(-.742,-.062,-1.544),(.742,-.062,-1.544),(.780,-.060,-.085),(-.780,-.060,-.085)],.016,'inner','Hood_Hinge')
for side in [-1,1]:
 bar('Hood_Pressed_Bead',(side*.29,.051,-1.52),(side*.31,.051,-.07),.009,'paint_light','Hood_Hinge')
 bar('Hood_Chrome_Line',(side*.821,.012,-1.58),(side*.840,.011,-.06),.007,'chrome_soft','Hood_Hinge')
 for z in [-1.34,-.90,-.46]:
  bar('Hood_Stiffening_Rib',(side*.70,-.090,z),(-side*.70,-.090,z),.023,'paint_dark','Hood_Hinge')
box('Hood_Front_Seal',(0,-.044,-1.555),(1.60,.026,.018),'rubber','Hood_Hinge')
# Hood ornament
bar('Hood_Ornament_Stand',(0,.060,-1.505),(0,.115,-1.505),.007,'chrome','Hood_Hinge')
box('Hood_Ornament',(0,.135,-1.505),(.073,.025,.019),'chrome','Hood_Hinge')
# Nose fenders surrounding open motor bay; top edges only
for side in [-1,1]:
 box('Front_Fender_Shelf',(side*.850,1.025,-1.76),(.20,.06,1.78),'paint')
 bar('Front_Fender_Piping',(side*.956,1.058,-2.60),(side*.956,1.063,-.96),.009,'chrome_soft')

# Trunk dark cavity and accessible cargo well
box('Cargo_Floor_Carpet',(0,.473,1.98),(1.48,.078,1.22),'carpet')
box('Cargo_Front_Wall',(0,.84,1.436),(1.47,.71,.064),'carpet')
for side in [-1,1]:
 box('Trunk_Inner_Carpet_Left' if side<0 else 'Trunk_Inner_Carpet_Right',(side*.754,.793,1.992),(.055,.62,1.14),'carpet')
box('Trunk_Rear_Sill',(0,.592,2.615),(1.51,.10,.085),'paint_dark')
for side in [-1,1]:
 box('Rear_Quarter_Deck',(side*.823,1.015,1.988),(.20,.067,1.23),'paint')
# lid local coordinates: hinge z=1.405, rear edge +2.595 so local +1.19
closed_quad('Trunk_Lid_Outer',[(-.79,-.04,0),(.79,-.04,0),(.885,-.041,1.16),(-.885,-.041,1.16)],.038,'paint','Trunk_Hinge')
closed_quad('Trunk_Lid_Inner',[(-.70,-.085,.055),(.70,-.085,.055),(.79,-.09,1.08),(-.79,-.09,1.08)],.017,'inner','Trunk_Hinge')
for side in [-1,1]:
 bar('Trunk_Lid_Seam',(side*.800,-.013,.04),(side*.880,-.014,1.154),.012,'chrome_soft','Trunk_Hinge')
 for zz in [.28,.62,.92]:bar('Trunk_Reinforcement_Crossbar',(-.68,-.111,zz),(.68,-.111,zz),.022,'paint_dark','Trunk_Hinge')
box('Trunk_Chrome_Emblem',(0,-.020,1.055),(.28,.025,.065),'chrome','Trunk_Hinge')
box('Trunk_Lock',(0,-.045,1.145),(.075,.026,.018),'chrome_soft','Trunk_Hinge')
box('Trunk_Carpet_Shelf',(0,.997,1.46),(1.42,.035,.08),'carpet')

# Stock car: speaker installations are added by the game after purchase.
# The cargo well is deliberately empty in this base GLB.
# Named strut bodies placed between body and lids and expected to be controlled in Three.js.
# Frame positions are initially CLOSED. Viewer can recompute strut geometry in motion.
for side in [-1,1]:
 x=side*.67
 scene.graph.update(frame_to=('Hood_Strut_L' if side<0 else 'Hood_Strut_R'),frame_from='Vehicle_Root',matrix=np.eye(4))
 bar('Hood_Gas_Strut_Cylinder',(x,.87,-1.14),(x,.99,-.98),.025,'black',('Hood_Strut_L' if side<0 else 'Hood_Strut_R'))
 bar('Hood_Gas_Strut_Rod',(x,.96,-1.035),(x,1.035,-.94),.013,'chrome',('Hood_Strut_L' if side<0 else 'Hood_Strut_R'))
 scene.graph.update(frame_to=('Trunk_Strut_L' if side<0 else 'Trunk_Strut_R'),frame_from='Vehicle_Root',matrix=np.eye(4))
 bar('Trunk_Strut_Cylinder',(x,.86,1.60),(x,.98,1.82),.023,'black',('Trunk_Strut_L' if side<0 else 'Trunk_Strut_R'))
 bar('Trunk_Strut_Rod',(x,.93,1.75),(x,1.04,1.94),.012,'chrome',('Trunk_Strut_L' if side<0 else 'Trunk_Strut_R'))

# Engine running visual: a separately named radiator cooling fan group.
scene.graph.update(frame_to='Engine_Radiator_Fan',frame_from='Vehicle_Root',matrix=loc((0,.765,-2.257)))
for i in range(6):
 a=i*math.tau/6
 g=trimesh.creation.box(extents=(.115,.038,.017))
 rot=rotation_matrix(a,[0,0,1]); rot[:3,3]=(.125*math.cos(a),.125*math.sin(a),0)
 place_mesh('Cooling_Fan_Blade',g,'black','Engine_Radiator_Fan',rot)
cyl('Cooling_Fan_Hub',(0,0,.01),.065,.035,'chrome_soft','Engine_Radiator_Fan')

# Compound engine and trunk names for game controls.
info={
 'name':'Bama Da South — 1980s Box-Style Sedan',
 'vehicle_length_m':5.3,'vehicle_width_m':1.95,'vehicle_height_m':1.69,
 'axis':'Y up / -Z forward',
 'hood_node':'Hood_Hinge','hood_open_angle_radians':1.05,
 'trunk_node':'Trunk_Hinge','trunk_open_angle_radians':-1.22,
 'bass_diaphragms':[],
 'wheel_nodes':['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'],
 'speaker_system':'Stock cargo trunk; speaker installs purchasable in game',
 'parts':'Independently articulated hood/trunk; full engine bay, cabin interior, struts, empty trunk, grille/chrome and wire wheels',
}
scene.metadata.update(info)
glb=scene.export(file_type='glb')
file=os.path.join(OUT,'Bama_Box_Sedan_Stock.glb')
with open(file,'wb') as f:f.write(glb)
print('SAVED',file,'bytes',os.stat(file).st_size)
print('Mesh count:',len(scene.geometry),'Triangles:',sum(len(g.faces) for g in scene.geometry.values()),'Scene bounds:',scene.bounds)
print('Group nodes:',[n for n in scene.graph.nodes if any(w in n for w in ['Hood_Hinge','Trunk_Hinge','Bass_Diaphragm','Wheel_FL'])])
with open(os.path.join(OUT,'model_info.json'),'w') as f:json.dump(info,f,indent=2)