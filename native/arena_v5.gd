extends RefCounted
# CONTACT ZERO V5 — playable FPS arena / deliberately navigable block layout
# No random cubes, no invisible blockers across primary lanes.
# Structural collision is paired with corresponding visible art and cover.
const WIDTH=66.0
const DEPTH=88.0

static func _building(world:Node3D,pos:Vector3,model:String,light:Material,which:int)->void:
    var art=load("res://maps_v3.gd")
    var rem=load("res://remaster.gd")
    var dim=Vector3(11.8,9.0,11.8)
    var shell=rem.cuboid(world,pos+Vector3(0,dim.y*.5,0),dim,light,true)
    # Author-authored building; keep collision shell aligned with the facade.
    var pref="res://assets/city/"+model+".glb"
    if ResourceLoader.exists(pref):
        for child in shell.get_children():
            if child is MeshInstance3D:
                child.visible=false
        art.place_model(world,pref,pos,dim)

static func _cover(world:Node3D,pos:Vector3,kind:int,mats:Array)->void:
    var rem=load("res://remaster.gd")
    var steel=mats[0]
    var wood=mats[1]
    if kind==0:
        rem.cuboid(world,pos+Vector3(0,.65,0),Vector3(1.6,1.3,1.6),wood,true)
        rem.cuboid(world,pos+Vector3(0,1.33,0),Vector3(1.8,.07,1.8),steel)
    elif kind==1:
        rem.cuboid(world,pos+Vector3(0,.45,0),Vector3(3.4,.90,1.00),steel,true)
        for x in [-1.55,1.55]:
            rem.cuboid(world,pos+Vector3(x,.95,0),Vector3(.13,.27,1.08),wood)
    elif kind==2:
        rem.container(world,pos,mats[2],steel,PI*.5)

static func make(world:Node3D)->Dictionary:
    var rem=load("res://remaster.gd")
    var art=load("res://maps_v3.gd")
    var asphalt=rem.textured("asphalt",Color("44484a"),.22)
    var concrete=rem.textured("concrete",Color("8b8580"),.28)
    var metal=rem.textured("metal",Color("485862"),.44)
    var pale=rem.color_mat(Color("7c8285"),.05,.87)
    var sand=rem.color_mat(Color("87888a"),.02,.9)
    var rusty=rem.color_mat(Color("8a553c"),.35,.68)
    var blue=rem.color_mat(Color("41627c"),.45,.52)
    var wood=rem.color_mat(Color("775d43"),.02,.77)
    var dark=rem.color_mat(Color("293842"),.45,.5)
    var signA=rem.color_mat(Color("e5b97d"),.0,.55,true)
    var signB=rem.color_mat(Color("82c6e3"),.0,.55,true)
    var props:Array=[metal,wood,blue]

    # FULL 66x88m level with three continuous lanes:
    # left flank (x=-27), mid (x=0), right flank (x=27).
    rem.cuboid(world,Vector3(0,-.55,0),Vector3(WIDTH,1.1,DEPTH),asphalt,true)
    for zz in [-43.55,43.55]:
        rem.cuboid(world,Vector3(0,3.15,zz),Vector3(WIDTH,6.3,.9),sand,true)
    for xx in [-32.55,32.55]:
        rem.cuboid(world,Vector3(xx,3.15,0),Vector3(.9,6.3,DEPTH),sand,true)

    # Two pairs of urban industrial blocks on either side of the middle corridor.
    # The 7-11 metre gaps between blocks intentionally CONNECT flank and mid.
    var lots=[
        [-19.0,-28.0,"building-a"],[19.0,-28.0,"building-b"],
        [-19.0,-3.0,"building-f"],[19.0,-3.0,"building-h"],
        [-19.0,22.0,"building-l"],[19.0,22.0,"building-n"]
    ]
    for i in range(lots.size()):
        var item=lots[i]
        _building(world,Vector3(float(item[0]),0,float(item[1])),String(item[2]),pale if i%3!=0 else concrete,i)
        # Use actual authored roof, not a giant floating concrete sheet.
    for x in [-11.8,11.8]:
        for z in [-28.,-3.,22.]:
            rem.cuboid(world,Vector3(x,1.1,z),Vector3(.32,2.2,3.8),dark,true)
            # Frontward yellow hazard line, not an invisible collision.
            rem.cuboid(world,Vector3(x+.08,.06,z),Vector3(.08,.035,3.6),signA)

    # Actual corrugated cargo containers interrupt long sniper sightlines.
    # Each has a collidable body and metal ribs; lateral paths remain open.
    rem.container(world,Vector3(0,0,14),blue,metal,0.0)
    rem.container(world,Vector3(0,0,-15),rusty,metal,0.0)
    # Sightlines remain open: each lane has short, offset cover pieces, no dead ends.
    for pos in [
        Vector3(-6,0,-32),Vector3(6,0,-20),
        Vector3(-6,0,-7),Vector3(6,0,7),
        Vector3(-6,0,19),Vector3(6,0,32)
    ]:
        _cover(world,pos,1,props)
    for pos in [
        Vector3(-27,0,-14),Vector3(-27,0,13),
        Vector3(27,0,-12),Vector3(27,0,15)
    ]:
        _cover(world,pos,0,props)
    # Central objective courtyard: approach from at least 3 directions.
    for pos in [
        Vector3(-9,0,-11),Vector3(9,0,12)
    ]:
        rem.cuboid(world,pos+Vector3(0,.05,0),Vector3(5.8,.1,5.8),concrete,false)
        rem.cuboid(world,pos+Vector3(0,1.1,-2.9),Vector3(5,.42,.21),dark,false)
    rem.label3d(world,"A / WAREHOUSE",Vector3(-9,4.0,-9.6),33,Color("ffd39a"),PI*.5)
    rem.label3d(world,"B / YARD",Vector3(9,4.0,11),33,Color("b9e5ff"),-PI*.5)

    # Varied structures, surface details and industrial dressing only near walls.
    for side in [-1.0,1.0]:
        var x=side*31.3
        for z in [-35.0,-11.0,13.0,35.0]:
            rem.street_lamp(world,Vector3(x,0,z),dark,signA,Color("ffd3a3"))
        for z in [-39.0,-16.0,8.0,34.0]:
            rem.cuboid(world,Vector3(x-side*.9,3.65,z),Vector3(.20,7.1,.20),metal,false)
            rem.cuboid(world,Vector3(x-side*.8,7.0,z),Vector3(.5,.18,2.5),dark,false)
    # Sky breaks: rail platforms and a billboard, not gigantic floating soldiers.
    for z in [-16.0,10.0]:
        for x in [-25.0,25.0]:
            rem.cuboid(world,Vector3(x,3.0,z),Vector3(.28,6.0,.30),dark,false)
            rem.cuboid(world,Vector3(x,5.9,z),Vector3(1.2,.12,1.8),metal,false)
    rem.label3d(world,"CONTACT ZERO / LOGISTICS",Vector3(0,6.9,-42.9),51,Color("e4d9c9"))

    # Dark asphalt zones and curb borders are visual, not walls.
    for lane_x in [-27.0,0.0,27.0]:
        for z in range(-38,39,10):
            rem.cuboid(world,Vector3(lane_x,.06,float(z)),Vector3(.13,.025,3.4),sand,false)

    # Distinguishable defender and attacker spawn staging areas.
    for z in [-36.5,36.5]:
        rem.cuboid(world,Vector3(0,.035,z),Vector3(11.0,.07,3.5),concrete,false)
        for x in [-5.0,5.0]:
            rem.cuboid(world,Vector3(x,.12,z),Vector3(.12,.12,3.1),blue if z>0 else rusty,false)

    print("V5_URBAN_ARENA_READY: 3 lanes, 2 sites, 6 industrial buildings")
    return {"built":true,"lanes":3,"bombsites":2,"buildings":6}
