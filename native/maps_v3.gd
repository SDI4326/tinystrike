extends RefCounted
# Distinct art direction per level using downloadable CC0 environment models.
static func place_model(world:Node3D,path:String,pos:Vector3,target:Vector3,angle:float=0.0)->void:
    if not ResourceLoader.exists(path):return
    var res=load(path)
    if not res is PackedScene:return
    var instance=res.instantiate()
    if not instance is Node3D:return
    world.add_child(instance)
    var bb=AABB()
    var has=false
    for item in instance.find_children("*","MeshInstance3D",true,false):
        if not item is MeshInstance3D:continue
        if item.mesh==null:continue
        var xf=item.global_transform
        var bound=xf*item.mesh.get_aabb()
        if not has:
            bb=bound
            has=true
        else:
            bb=bb.merge(bound)
    var size=bb.size
    var s=minf(target.x/maxf(.02,size.x),minf(target.y/maxf(.02,size.y),target.z/maxf(.02,size.z)))
    s=clampf(s,.015,7.0)
    instance.scale=Vector3.ONE*s
    instance.rotation.y=angle
    # Godot imported prefabs have origin at their base; aligning the bounding
    # centre in X and Z prevents huge pivot-based offsets in the map.
    var mid=bb.get_center()*s
    instance.position=Vector3(pos.x-mid.x,pos.y-bb.position.y*s,pos.z-mid.z)

static func apply(world:Node3D,which:int)->void:
    var kits=[
        ["building-a","building-b","building-c","building-d","building-e","building-f"],
        ["building-g","building-h","building-i","building-j","building-k","building-l"],
        ["building-m","building-n","building-a","building-d","building-f","building-h"]
    ]
    var kit=kits[which]
    # Authored urban architecture fitted into the structural collision blocks,
    # visible from paths; not procedural boxes masquerading as buildings.
    for side in [-1.0,1.0]:
        for n in range(4):
            var idx=n if side<0 else n+2
            var xx=side*31.0
            var zz=[-27.0,-7.0,14.0,31.0][n]
            var path="res://assets/city/"+String(kit[idx%kit.size()])+".glb"
            place_model(world,path,Vector3(xx,0,zz),Vector3(15.0,13.0,14.2),PI*.5 if side>0 else -PI*.5)
    for n in range(4):
        var p=[Vector3(-8,0,-15),Vector3(11,0,12),Vector3(-12,0,14),Vector3(12,0,-20)][n]
        var nm=String(kit[(n+3)%kit.size()])
        place_model(world,"res://assets/city/"+nm+".glb",p,Vector3(10.8,8.0,8.4),PI*.5*float(n%4))
    # One consistent, recognizable orientation landmark per map.
    if which==0:
        for i in range(8):
            var x=-33.0+float(i)*9
            place_model(world,"res://assets/kenney/light-square.glb",Vector3(x,0,39),Vector3(1.5,7.5,1.5))
    elif which==1:
        for i in range(6):
            var x=-33.0+float(i)*12
            place_model(world,"res://assets/kenney/construction-fence.glb",Vector3(x,0,-34),Vector3(4.0,3.0,.2))
    else:
        for i in range(6):
            var x=-31.0+float(i)*11.3
            place_model(world,"res://assets/kenney/crate.glb",Vector3(x,0,-36),Vector3(2.0,1.7,2.1),PI*.5*float(i%4))
