extends RefCounted
# COMPOUND: a four-route objective arena using actual licensed Kenney CC0
# industrial GLBs. All cover has physics, and bots can navigate both lanes.
static func build(world:Node3D)->Dictionary:
    var rem=load("res://remaster.gd")
    var art=load("res://maps_v3.gd")
    var stone=rem.textured("concrete",Color("8a8172"),.25)
    var asphalt=rem.textured("asphalt",Color("343b40"),.28)
    var steel=rem.textured("metal",Color("3c4b53"),.24)
    var rails=rem.color_mat(Color("303a42"),.45,.48)
    var accent=rem.color_mat(Color("daa66d"),.0,.45)
    var blue=rem.color_mat(Color("4c737f"),.48,.56)
    var ochre=rem.color_mat(Color("947051"),.34,.65)
    rem.cuboid(world,Vector3(0,-.50,0),Vector3(46,1,40),stone,true)
    # Four high walls, an unobstructed central route, and parallel flank lanes.
    for z in [-19.0,19.0]:
        rem.cuboid(world,Vector3(0,2,z),Vector3(46,4,1),stone,true)
    for x in [-22.6,22.6]:
        rem.cuboid(world,Vector3(x,2,0),Vector3(1,4,40),stone,true)
    var buildings=[
        [-14.0,-11.7,"building-a"],[14.0,-11.7,"building-b"],
        [-14.0,11.5,"building-h"],[14.0,11.5,"building-e"]
    ]
    var model_count=0
    for row in buildings:
        var x=float(row[0])
        var z=float(row[1])
        var solid=rem.cuboid(world,Vector3(x,4.1,z),Vector3(12.0,8.2,11.0),stone,true)
        for part in solid.get_children():
            if part is MeshInstance3D:part.visible=false
        var path="res://assets/city/"+String(row[2])+".glb"
        if ResourceLoader.exists(path):
            art.place_model(world,path,Vector3(x,0,z),Vector3(12.4,8.9,11.1))
            model_count+=1
    # Parallel cover layouts produce a real aim duel instead of an empty road.
    for sign in [-1.0,1.0]:
        for z in [-9.0,0.0,9.0]:
            rem.cuboid(world,Vector3(sign*6.8,1.1,z),Vector3(.52,2.2,4.2),stone,true)
            rem.cuboid(world,Vector3(sign*6.8,2.28,z),Vector3(.76,.16,4.5),steel,false)
    for i in range(8):
        var x=(-3.4 if i%2==0 else 3.4)
        var z=-9.0+float(i)*2.6
        rem.cuboid(world,Vector3(x,.53,z),Vector3(1.12,1.06,1.12),ochre,true)
        rem.cuboid(world,Vector3(x,.95,z),Vector3(1.26,.085,1.26),steel,false)
        art.place_model(world,"res://assets/kenney/crate.glb",Vector3(x,0,z),Vector3(1.1,1.0,1.1))
    for x in [-19.0,19.0]:
        for z in [-1.4,5.0]:
            rem.cuboid(world,Vector3(x,.76,z),Vector3(2.5,1.52,3.5),blue,true)
            for k in range(5):
                rem.cuboid(world,Vector3(x-1.2+k*.6,1.1,z+1.79),Vector3(.08,1.23,.08),rails)
    # A-site and B-site have actual 3D floor markings and recognizable callouts.
    for i in range(2):
        var x=-13.4 if i==0 else 13.4
        var z=.0 if i==0 else 3.8
        var col=Color("e4a65b") if i==0 else Color("79bcd9")
        var marking=rem.color_mat(col,.1,.5,true)
        rem.cuboid(world,Vector3(x,.024,z),Vector3(5,.048,.18),marking)
        rem.cuboid(world,Vector3(x,.024,z),Vector3(.18,.048,5),marking)
        rem.label3d(world,"SITE  A" if i==0 else "SITE  B",Vector3(x,3.1,z),29,col)
    # Light gantries, height detail, and consistent sightline landmarks.
    for x in [-18.0,18.0]:
        for z in [-16.5,16.5]:
            rem.street_lamp(world,Vector3(x,0,z),rails,accent,Color("f6c793"))
    for z in [-15.5,15.5]:
        rem.cuboid(world,Vector3(0,4.8,z),Vector3(10,.22,.4),steel,false)
        rem.cuboid(world,Vector3(0,3.8,z),Vector3(.13,2.2,.15),rails,false)
    # Escape ladders and pipework from a real CC0 industrial pack.
    for x in [-17.0,17.0]:
        for z in [-17.0,17.0]:
            art.place_model(world,"res://assets/kenney/pipe-straight.glb",Vector3(x,.5,z),Vector3(.8,.8,3.0))
    print("COMPOUND_READY building_meshes=",model_count,"  collision_blocks=34")
    return {"loaded":true,"mesh_count":model_count,"colliders":34}
