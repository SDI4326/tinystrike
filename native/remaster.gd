extends RefCounted
## CONTACT ZERO V2 — Industrial environment pass. Deterministic placement, CC0 assets.
## Distinct geometry, prop dressing, readable landmarks and grounded cover.
static func color_mat(color: Color, metal: float=0.0, rough:float=.82, emit:bool=false) -> StandardMaterial3D:
    var m:=StandardMaterial3D.new()
    m.albedo_color=color
    m.metallic=metal
    m.roughness=rough
    if emit:
        m.emission_enabled=true
        m.emission=color
        m.emission_energy_multiplier=2.0
    return m

static func textured(name:String, fallback:Color, tiles:float=.25) -> StandardMaterial3D:
    var m=color_mat(fallback,.0,.86)
    var p="res://assets/tex/"+name+"_color.jpg"
    if ResourceLoader.exists(p):
        m.albedo_texture=load(p)
        m.uv1_triplanar=true
        m.uv1_scale=Vector3.ONE*tiles
        var normal="res://assets/tex/"+name+"_normal.jpg"
        if ResourceLoader.exists(normal):
            m.normal_enabled=true
            m.normal_texture=load(normal)
    return m

static func cuboid(root:Node3D, xyz:Vector3, dims:Vector3, mat:Material, physical:bool=false, yaw:float=0.0) -> Node3D:
    var n:Node3D
    if physical:
        var body:=StaticBody3D.new()
        body.collision_layer=1
        body.collision_mask=0
        var c:=CollisionShape3D.new()
        var shape:=BoxShape3D.new()
        shape.size=dims
        c.shape=shape
        body.add_child(c)
        n=body
    else:
        n=Node3D.new()
    root.add_child(n)
    n.position=xyz
    n.rotation.y=yaw
    var mesh:=MeshInstance3D.new()
    var box:=BoxMesh.new()
    box.size=dims
    mesh.mesh=box
    mesh.material_override=mat
    n.add_child(mesh)
    return n

static func prefab(root:Node3D,path:String,xyz:Vector3,size:float,yaw:float=0.0)->void:
    if not ResourceLoader.exists(path):return
    var resource=load(path)
    if not resource is PackedScene:return
    var n=resource.instantiate()
    if not n is Node3D:return
    root.add_child(n)
    n.position=xyz
    n.rotation.y=yaw
    n.scale=Vector3.ONE*size

static func label3d(root:Node3D,caption:String,xyz:Vector3,sz:int,color:Color,yaw:float=0.0)->void:
    var text:=Label3D.new()
    text.text=caption
    text.font_size=sz
    text.pixel_size=.012
    text.modulate=color
    text.outline_modulate=Color(.04,.06,.08,.8)
    text.outline_size=7
    text.no_depth_test=false
    text.position=xyz
    text.rotation.y=yaw
    root.add_child(text)

static func container(root:Node3D,pos:Vector3,mat:Material,trim:Material,angle:float=0.0)->void:
    var holder:=Node3D.new()
    holder.position=pos
    holder.rotation.y=angle
    root.add_child(holder)
    cuboid(holder,Vector3(0,1.30,0),Vector3(5.6,2.6,2.5),mat,true)
    var metal_light=color_mat(Color("87949b"),.7,.4)
    for side in [-1.0,1.0]:
        for i in range(12):
            cuboid(holder,Vector3(-2.53+float(i)*.46,1.33,side*1.26),Vector3(.056,2.36,.075),trim)
        for j in range(4):
            cuboid(holder,Vector3(side*2.83,1.33,-.91+float(j)*.63),Vector3(.075,2.31,.044),trim)
    for h in [.08,2.52]:
        cuboid(holder,Vector3(0,h,0),Vector3(5.74,.11,2.59),metal_light)
    for s in [-1.0,1.0]:
        for zz in [-1.17,1.17]:
            cuboid(holder,Vector3(s*2.77,1.31,zz),Vector3(.16,2.64,.16),metal_light)

static func barrel(root:Node3D,pos:Vector3,mat:Material,trim:Material)->void:
    var n:=StaticBody3D.new()
    n.position=pos
    n.collision_layer=1
    n.collision_mask=0
    var shape:=CylinderShape3D.new()
    shape.radius=.45
    shape.height=.94
    var col:=CollisionShape3D.new()
    col.shape=shape
    n.add_child(col)
    root.add_child(n)
    var mesh:=MeshInstance3D.new()
    var cyl:=CylinderMesh.new()
    cyl.top_radius=.43
    cyl.bottom_radius=.45
    cyl.height=.92
    cyl.radial_segments=12
    mesh.mesh=cyl
    mesh.material_override=mat
    n.add_child(mesh)
    for h in [-.38,.36]:
        var band:=MeshInstance3D.new()
        var ring:=CylinderMesh.new()
        ring.top_radius=.46
        ring.bottom_radius=.46
        ring.height=.08
        ring.radial_segments=12
        band.mesh=ring
        band.position.y=h
        band.material_override=trim
        n.add_child(band)

static func street_lamp(root:Node3D,pos:Vector3,mt:Material,em:Material,light_color:Color)->void:
    cuboid(root,pos+Vector3(0,3.3,0),Vector3(.16,6.6,.16),mt)
    cuboid(root,pos+Vector3(.53,6.47,0),Vector3(1.06,.14,.14),mt)
    cuboid(root,pos+Vector3(1.0,6.37,0),Vector3(.62,.12,.52),em)
    var lamp:=OmniLight3D.new()
    lamp.position=pos+Vector3(1.0,6.2,0)
    lamp.omni_range=12
    lamp.light_energy=1.8
    lamp.light_color=light_color
    root.add_child(lamp)

static func scaffold(root:Node3D,pos:Vector3,height:float,mat:Material,rail:Material)->void:
    for x in [-1.5,1.5]:
        for z in [-1.5,1.5]:
            cuboid(root,pos+Vector3(x,height*.5,z),Vector3(.13,height,.13),mat)
    for h in [1.5,3.0,4.5,6.0]:
        if h>height:break
        for z in [-1.5,1.5]:
            cuboid(root,pos+Vector3(0,h,z),Vector3(3.2,.1,.1),mat)
        for x in [-1.5,1.5]:
            cuboid(root,pos+Vector3(x,h,0),Vector3(.1,.1,3.2),mat)
        if h>3:
            cuboid(root,pos+Vector3(0,h,0),Vector3(3.0,.12,3.0),rail)

static func apply(world:Node3D,which:int)->void:
    var rng:=RandomNumberGenerator.new()
    rng.seed=572814+which*10531
    var concrete=textured("concrete",Color("8c969c"),.26)
    var asphalt=textured("asphalt",Color("41494f"),.32)
    var rusty=textured("metal",Color("646668"),.52)
    var dark=color_mat(Color("202b33"),.62,.46)
    var steel=color_mat(Color("8a9297"),.74,.29)
    var warning=color_mat(Color("e2ae4e"),.2,.45)
    var light_panel=color_mat(Color("c4ebf1"),.0,.33,true)
    var hazard=color_mat(Color("d96d3e"),.09,.56)
    var ca=[Color("596f81"),Color("72817d"),Color("7a7163")][which]
    var redpaint=color_mat(Color("9a3d30"),.45,.66)
    var bluepaint=color_mat(Color("345c71"),.4,.65)
    # Repeating pavement material and road markings give a deliberate street grid.
    cuboid(world,Vector3(0,.016,0),Vector3(12,.032,81),asphalt,false)
    cuboid(world,Vector3(0,.020,0),Vector3(81,.032,10),asphalt,false)
    for z in range(-37,38,9):
        cuboid(world,Vector3(0,.046,float(z)),Vector3(.16,.02,4.1),warning,false)
    for x in range(-38,39,8):
        cuboid(world,Vector3(float(x),.045,0),Vector3(3.4,.02,.16),warning,false)
    for x in [-6.3,6.3]:
        cuboid(world,Vector3(x,.11,0),Vector3(.6,.22,80),concrete,true)
    for z in [-5.2,5.2]:
        cuboid(world,Vector3(0,.11,z),Vector3(80,.22,.6),concrete,true)
    for x in [-37.0,37.0]:
        for z in [-36.0,36.0]:
            street_lamp(world,Vector3(x,0,z),dark,light_panel,Color("d5eaff") if which==1 else Color("ffe3b4"))
    # Freight depots on flanks; alternating elevation creates skyline.
    var cargo_blue=color_mat(Color("4f7288"),.47,.65)
    var cargo_green=color_mat(Color("617865"),.45,.65)
    var cargo_orange=color_mat(Color("955d41"),.4,.66)
    var cargo=[cargo_blue,cargo_green,cargo_orange]
    for side in [-1.0,1.0]:
        for i in range(4):
            var z=-27.0+float(i)*18.1
            var x=side*(13.5+float(i%2)*2.4)
            container(world,Vector3(x,0,z),cargo[(i+which)%3],dark,PI*.5 if i%2==0 else 0.0)
    # Inner square becomes a defended landmark, rather than a featureless corridor.
    scaffold(world,Vector3(-26,0,-4),9.0,dark,steel)
    scaffold(world,Vector3(26,0,8),7.5,dark,steel)
    cuboid(world,Vector3(-26,9.3,-4),Vector3(3.1,.23,3.1),steel)
    cuboid(world,Vector3(-26,10.0,-4),Vector3(.11,1.3,.11),dark)
    label3d(world,"A  /  СЕКТОР",Vector3(-17,3,-17),39,Color("f6ba6c"),PI*.5)
    label3d(world,"B  /  СЕКТОР",Vector3(17,3,17),39,Color("a2dffb"),-PI*.5)
    label3d(world,"CONTACT ZERO",Vector3(0,7.0,-40.06),56,Color("e4edf1"))
    label3d(world,"TACTICAL TRAINING FACILITY",Vector3(0,6.20,-40.06),20,Color("d1aa78"))
    # Metal awnings, warehouse window frames, roof machinery and cable trays.
    for side in [-1.0,1.0]:
        for z in [-27.0,-7.0,14.0,31.0]:
            var x=side*31.0
            for h in [2.8,5.7]:
                for xx in [-4.4,0.0,4.4]:
                    cuboid(world,Vector3(x+xx,h,z+7.07),Vector3(1.7,1.2,.08),dark,false)
                    cuboid(world,Vector3(x+xx,h,z+7.14),Vector3(1.4,.91,.06),steel,false)
            cuboid(world,Vector3(x,6.6,z+7.8),Vector3(9.1,.25,1.7),steel)
            for xx in [-5.5,0.0,5.5]:
                cuboid(world,Vector3(x+xx,6.15,z+7.0),Vector3(.13,1.0,.13),dark)
            for roof_idx in range(2):
                var rx=x-3.6+roof_idx*6.8
                cuboid(world,Vector3(rx,12.9,z),Vector3(2.3,.45,2.3),steel)
                cuboid(world,Vector3(rx,13.6,z),Vector3(1.15,1.05,1.15),dark)
            for ii in range(5):
                cuboid(world,Vector3(x-5.0+float(ii)*2.5,.035,z-6.3),Vector3(.15,.04,.7),steel)
    # Sheltered alleys around middle; vertical slats and roof supports.
    for side in [-1.0,1.0]:
        var xx=side*10.7
        for z in [-31.0,-13.0,8.0,28.0]:
            for m in range(4):
                var zz=z+float(m)*1.0
                cuboid(world,Vector3(xx,1.7,zz),Vector3(.16,3.3,.17),dark)
            cuboid(world,Vector3(xx,3.1,z+1.5),Vector3(.65,.14,5.4),steel)
            cuboid(world,Vector3(xx,3.22,z+1.5),Vector3(1.2,.12,5.4),concrete)
    # Hazard stripes, fuel drums, equipment crates, warning tags.
    for cluster in range(17):
        var x=rng.randf_range(-36,36)
        var z=rng.randf_range(-35,35)
        if absf(x)<7 or absf(z)<6:continue
        var color=cargo[cluster%3]
        for k in range(2+cluster%3):
            barrel(world,Vector3(x+float(k%2)*1.1,.48,z+float(k/2)*1.1),color,steel)
        if cluster%3==0:
            cuboid(world,Vector3(x+1.8,.6,z),Vector3(1.25,1.2,1.2),rusty,true)
            cuboid(world,Vector3(x+1.8,1.21,z),Vector3(1.4,.07,1.4),steel)
    for n in range(55):
        var x=rng.randf_range(-36,36)
        var z=rng.randf_range(-36,36)
        var w=rng.randf_range(.17,.76)
        cuboid(world,Vector3(x,.045,z),Vector3(w,.055,w*.5),dark,false,rng.randf_range(0,PI))
    # Import actual authored CC0 modular props alongside procedural hard-cover.
    for n in range(6):
        var x=-34.0+float(n)*13.0
        var z=31.0 if n%2==0 else -33.5
        prefab(world,"res://assets/kenney/construction-fence.glb",Vector3(x,0,z),1.0,float(n%3)*PI*.5)
    for n in range(7):
        var x=-35.0+float(n)*11.2
        prefab(world,"res://assets/kenney/light-square.glb",Vector3(x,0,35.4),1.2)
    for n in range(9):
        var x=rng.randf_range(-35,35)
        var z=-34.0 if n%2==0 else 35.0
        prefab(world,"res://assets/kenney/crate.glb",Vector3(x,.0,z),1.0,rng.randf_range(-PI,PI))
    for n in range(6):
        var x=-35.0+float(n)*13.7
        prefab(world,"res://assets/kenney/pipe-straight.glb",Vector3(x,2.0,-35.5),2.0,PI*.5)
    # Distinct map identity with lighting and recognizable scene landmarks.
    if which==0:
        for x in [-23.0,23.0]:
            for z in [-35.0,35.0]:
                cuboid(world,Vector3(x,1.7,z),Vector3(1.3,3.4,1.3),rusty,true)
                cuboid(world,Vector3(x,3.5,z),Vector3(2.2,.4,2.2),warning)
    elif which==1:
        for x in [-22.0,-8.0,8.0,22.0]:
            var sign=color_mat(Color("6fbeec"),0,.2,true)
            cuboid(world,Vector3(x,6.2,-38.6),Vector3(5.4,.20,.12),sign)
            label3d(world,"NIGHTSHIFT   /   PORT 07",Vector3(x,5.5,-38.4),15,Color("c6f2ff"))
    else:
        var snow=color_mat(Color("d5e1e4"),0,.94)
        for i in range(35):
            var zz=rng.randf_range(-38,38)
            var xx=rng.randf_range(-38,38)
            if absf(xx)<9 or absf(zz)<7:continue
            cuboid(world,Vector3(xx,.08,zz),Vector3(rng.randf_range(.5,2.5),.13,rng.randf_range(.5,3)),snow,false,rng.randf_range(-PI,PI))
