extends RefCounted
# Standalone CC0 tactical arena: 3DAssets.dev "Fountain square at site A".
# Meshes are imported as authored, without distorting their proportions.
static func build(world:Node3D) -> Dictionary:
    var status={"loaded":false,"mesh_count":0,"colliders":0}
    var path="res://assets/hilltown/fountain_square.glb"
    if not ResourceLoader.exists(path):
        push_warning("Missing HILLTOWN GLB")
        return status
    var resource=load(path)
    if not resource is PackedScene:return status
    var level=resource.instantiate()
    if not level is Node3D:return status
    level.name="HILLTOWN_SITE_A"
    world.add_child(level)
    var min_p=Vector3(INF,INF,INF)
    var max_p=Vector3(-INF,-INF,-INF)
    for entry in level.find_children("*","MeshInstance3D",true,false):
        if not entry is MeshInstance3D or entry.mesh==null:continue
        var local=entry.mesh.get_aabb()
        var world_box=entry.global_transform*local
        min_p=min_p.min(world_box.position)
        max_p=max_p.max(world_box.end)
        status["mesh_count"]=int(status["mesh_count"])+1
        var nm=entry.name.to_lower()
        if nm.contains("attacker") or nm.contains("defender") or nm.contains("operator"):continue
        if local.size.length()>.85:
            entry.create_trimesh_collision()
            status["colliders"]=int(status["colliders"])+1
    if min_p.x!=INF:
        level.position=-Vector3((min_p.x+max_p.x)*.5,min_p.y,(min_p.z+max_p.z)*.5)
    # Safe collision floor outside the artist-authored 36x24-metre square.
    var floor=StaticBody3D.new()
    floor.name="HILLTOWN_GROUND"
    floor.collision_layer=1
    floor.position=Vector3(0,-.55,0)
    var body_shape=CollisionShape3D.new()
    var box=BoxShape3D.new()
    box.size=Vector3(48,1,40)
    body_shape.shape=box
    floor.add_child(body_shape)
    var mesh=MeshInstance3D.new()
    var geo=BoxMesh.new()
    geo.size=box.size
    mesh.mesh=geo
    var material=StandardMaterial3D.new()
    material.albedo_color=Color("a09583")
    material.roughness=.92
    mesh.material_override=material
    floor.add_child(mesh)
    world.add_child(floor)
    for i in range(4):
        var length=Vector3(46,4,.5) if i<2 else Vector3(.5,4,39)
        var position=Vector3(0,2,-19.5 if i==0 else 19.5) if i<2 else Vector3(-23 if i==2 else 23,2,0)
        var barrier=StaticBody3D.new()
        barrier.collision_layer=1
        barrier.position=position
        var collision=CollisionShape3D.new()
        var shape=BoxShape3D.new()
        shape.size=length
        collision.shape=shape
        barrier.add_child(collision)
        world.add_child(barrier)
    status["loaded"]=true
    print("HILLTOWN_LOADED ",status)
    return status
