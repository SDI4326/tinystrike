extends Node3D
# CONTACT ZERO — native Windows tactical FPS. Godot 4.4+
const SPEED := 7.0
const RUN_SPEED := 10.5
const CROUCH_SPEED := 3.7
const GRAVITY := 20.0
const MOUSE_SENS := 0.0019
var scene_root: Node3D
var player: CharacterBody3D
var camera: Camera3D
var neck: Node3D
var gun_root: Node3D
var gun_mesh: Node3D
var bots: Array = []
var running := false
var changing_map := false
var map_id := 0
var phase := 0
var health := 100.0
var armor := 50.0
var money := 3200
var mag := 30
var reserve := 150
var reload_time := 0.0
var fire_delay := 0.0
var last_shot := 0.0
var recoil := 0.0
var footstep := 0.0
var game_time := 0.0
var round_time := 180.0
var score_blue := 0
var score_red := 0
var kills := 0
var deaths := 0
var ui: CanvasLayer
var cover: ColorRect
var title_label: Label
var subtitle_label: Label
var hud: Control
var top_label: Label
var info_label: Label
var ammo_label: Label
var hint_label: Label
var hp_label: Label
var cross: Label
var panel: Control
var tex_metal: Material
var tex_stone: Material
var tex_floor: Material
var tex_glass: Material
var tex_trim: Material
var sky_tint: Color = Color("b4a48c")
var rng := RandomNumberGenerator.new()
var bot_update := 0.0
var fps_anim: AnimationPlayer
var fps_anim_name := ""
var using_authored_rig := false
var muzzle: OmniLight3D
var audio_gun: AudioStreamPlayer
var audio_hit: AudioStreamPlayer
var shot_anim_ends := 0.0
var damage_flash: ColorRect
var damage_flash_time := 0.0
var running_bob := 0.0
var current_speed := 0.0
var weapon_idx := 0
var grenade_he := 2
var grenade_smoke := 1
var grenade_time := 0.0
var projectiles: Array = []
var weapon_aim := false
var crosshair_ui: Control
var buy_overlay: Control
var grenade_label: Label
var rifle_pose := 0
var base_weapon_transform: Node3D
var gun_orientation := 0.0
var gun_float := 0.0
var nav_grid: RefCounted
var bomb: RefCounted
var bomb_label: Label
var bot_skill := 0.62
var suppress_bots := false
var total_nav_replans := 0
const GUNS = [
    {"name":"AK-74M","model":"ak47","mag":30,"damage":32.0,"interval":.105,"reload":2.55,"reserve":150,"price":2700,"recoil":.014},
    {"name":"M4A1","model":"m4a1","mag":30,"damage":28.0,"interval":.087,"reload":2.25,"reserve":150,"price":3000,"recoil":.011},
    {"name":"AWP","model":"awp","mag":10,"damage":100.0,"interval":1.2,"reload":3.25,"reserve":40,"price":4750,"recoil":.085},
    {"name":"DESERT EAGLE","model":"deagle","mag":7,"damage":51.0,"interval":.29,"reload":1.9,"reserve":35,"price":700,"recoil":.042},
    {"name":"MP5","model":"mp5","mag":30,"damage":23.0,"interval":.072,"reload":2.1,"reserve":180,"price":1500,"recoil":.010},
    {"name":"USP-S","model":"usp","mag":12,"damage":32.0,"interval":.20,"reload":1.7,"reserve":72,"price":600,"recoil":.021}
]

func _ready() -> void:
    rng.randomize()
    get_window().title = "CONTACT ZERO — NATIVE WINDOWS FPS"
    _create_ui()
    _reset_scene(0)
    _show_menu()
    set_process(true)
    set_physics_process(true)

func _mat(col: Color, rough: float = .78, metal: float = 0.0) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = col
    m.roughness = rough
    m.metallic = metal
    return m

func _box(host: Node3D, pos: Vector3, size: Vector3, m: Material, solid: bool = true) -> Node3D:
    var n: Node3D
    if solid:
        var body := StaticBody3D.new()
        body.collision_layer = 1
        body.collision_mask = 0
        var col := CollisionShape3D.new()
        var shp := BoxShape3D.new()
        shp.size = size
        col.shape = shp
        body.add_child(col)
        n = body
    else:
        n = Node3D.new()
    n.position = pos
    var mesh := MeshInstance3D.new()
    var geom := BoxMesh.new()
    geom.size = size
    mesh.mesh = geom
    mesh.material_override = m
    n.add_child(mesh)
    host.add_child(n)
    return n

func _reset_scene(which: int) -> void:
    running = false
    if is_instance_valid(scene_root):
        scene_root.queue_free()
        await get_tree().process_frame
    bots.clear()
    scene_root = Node3D.new()
    scene_root.name = "FPS_WORLD"
    add_child(scene_root)
    map_id = which
    var colors = [
        [Color("a9a08c"),Color("8d8070"),Color("b3a288")],
        [Color("435460"),Color("435864"),Color("536673")],
        [Color("b5c3cd"),Color("8394a2"),Color("9caebc")],
        [Color("978d7e"),Color("a5977f"),Color("aebbc5")]
    ][which]
    sky_tint = colors[2]
    tex_floor = load("res://remaster.gd").textured("asphalt",colors[0],.16)
    tex_stone = load("res://remaster.gd").textured("concrete",colors[1],.18)
    tex_metal = load("res://remaster.gd").textured("metal",Color("404e59"),.3)
    tex_trim = _mat(Color("a6abb0"), .49, .23)
    tex_glass = _mat(Color("304451"), .20, .75)
    var env := WorldEnvironment.new()
    var world := Environment.new()
    world.background_mode = Environment.BG_COLOR
    world.background_color = sky_tint
    world.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    world.ambient_light_color = Color("b7d9ec") if which == 1 else Color("fff2dc")
    world.ambient_light_energy = .43 if which == 1 else .62
    world.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    world.fog_enabled = true
    world.fog_light_color = sky_tint
    world.fog_density = .0055
    env.environment = world
    scene_root.add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-56,-38,0)
    sun.light_color = Color("a8d8ff") if which == 1 else Color("ffe1b1")
    sun.light_energy = .48 if which == 1 else .88
    sun.shadow_enabled = true
    scene_root.add_child(sun)
    if which==3:
        var result=load("res://hilltown.gd").build(scene_root)
        if not result["loaded"]:
            push_error("COMPOUND map did not load")
        nav_grid=load("res://bot_nav.gd").new()
        nav_grid.build(scene_root)
        total_nav_replans=0
        _make_player()
        for n in range(4):_make_bot(true,n)
        for n in range(5):_make_bot(false,n)
        _init_bomb()
        return
    _box(scene_root,Vector3(0,-.5,0),Vector3(84,1,84),tex_floor)
    for z in [-41.0,41.0]:
        _box(scene_root,Vector3(0,4,z),Vector3(84,8,1.8),tex_stone)
    for x in [-41.0,41.0]:
        _box(scene_root,Vector3(x,4,0),Vector3(1.8,8,84),tex_stone)
    # Corridors, courtyards, and readable cover: no invisible walls.
    for side in [-1,1]:
        for z in [-27,-7,14,31]:
            _building(Vector3(side*31,0,z),Vector3(14,8+abs(z)%5,14))
    for t in [[-8,-15,10,7],[11,12,10,7],[-12,14,4,6],[12,-20,6,5]]:
        _building(Vector3(t[0],0,t[1]),Vector3(t[2],t[3],8))
    for q in [[-19,-22],[20,-22],[-20,0],[19,2],[-18,20],[18,22],[1,-27],[0,-2]]:
        _box(scene_root,Vector3(q[0],.8,q[1]),Vector3(2.7,1.6,2.4),tex_metal)
    for z in [-29,29]:
        for x in [-26,26]:
            _box(scene_root,Vector3(x,3.5,z),Vector3(.17,7,.17),tex_metal,false)
            var bulb := OmniLight3D.new()
            bulb.position=Vector3(x,6.8,z)
            bulb.light_color=Color("8bd4ff") if which==1 else Color("ffcc8d")
            bulb.light_energy=2.7
            bulb.omni_range=16
            scene_root.add_child(bulb)
    if which == 1:
        for i in range(6):
            _box(scene_root,Vector3(-16+i*6,1.45,-33),Vector3(4.9,2.9,3),tex_metal)
    elif which == 2:
        for i in range(7):
            _box(scene_root,Vector3(-30+i*9,.55,6+i%3*4),Vector3(4,1.1,2),tex_floor)
    load("res://remaster.gd").apply(scene_root,which)
    load("res://maps_v3.gd").apply(scene_root,which)
    nav_grid=load("res://bot_nav.gd").new()
    nav_grid.build(scene_root)
    total_nav_replans=0
    _make_player()
    for n in range(4):
        _make_bot(true,n)
    for n in range(5):
        _make_bot(false,n)
    _init_bomb()

func _init_bomb() -> void:
    bomb=load("res://bomb_mode.gd").new()
    bomb.setup(scene_root,map_id)
    bomb.set_carrier(bots)

func _building(p: Vector3,s: Vector3) -> void:
    var collider=_box(scene_root,p+Vector3(0,s.y*.5,0),s,tex_stone)
    if absf(p.x)>24.0 and ResourceLoader.exists("res://assets/city/building-a.glb"):
        for visual in collider.get_children():
            if visual is MeshInstance3D:visual.visible=false
        return
    _box(scene_root,p+Vector3(0,s.y+.2,0),Vector3(s.x+.3,.35,s.z+.3),tex_metal,false)
    for z in [-3.4,0.0,3.4]:
        var face := -1.0 if p.x>0 else 1.0
        _box(scene_root,Vector3(p.x+face*(s.x*.5+.035),4.7,p.z+z),Vector3(.08,1.7,1.7),tex_glass,false)

func _make_player() -> void:
    player = CharacterBody3D.new()
    player.name = "PLAYER"
    player.collision_layer = 4
    player.collision_mask = 1 | 2
    var col := CollisionShape3D.new()
    var sh := CapsuleShape3D.new()
    sh.height=1.85
    sh.radius=.35
    col.shape=sh
    player.add_child(col)
    player.position=Vector3(0,1.2,9) if map_id==3 else Vector3(0,1.2,28)
    scene_root.add_child(player)
    neck=Node3D.new()
    neck.position.y=.63
    player.add_child(neck)
    camera=Camera3D.new()
    camera.current=true
    camera.fov=75
    camera.near=.035
    camera.far=150
    neck.add_child(camera)
    gun_root=Node3D.new()
    gun_root.position=Vector3(.31,-.18,-.66)
    camera.add_child(gun_root)
    _make_first_person_weapon()
    muzzle=OmniLight3D.new()
    muzzle.light_color=Color("ffc88c")
    muzzle.light_energy=0.0
    muzzle.omni_range=5.0
    muzzle.position=Vector3(0,0,-1.6)
    gun_root.add_child(muzzle)
    audio_gun=AudioStreamPlayer.new()
    if ResourceLoader.exists("res://assets/sfx/gunshot.ogg"):
        audio_gun.stream=load("res://assets/sfx/gunshot.ogg")
        audio_gun.volume_db=-5.0
    player.add_child(audio_gun)
    audio_hit=AudioStreamPlayer.new()
    if ResourceLoader.exists("res://assets/sfx/hit.ogg"):
        audio_hit.stream=load("res://assets/sfx/hit.ogg")
        audio_hit.volume_db=-9.0
    player.add_child(audio_hit)

func _scene_mesh_bounds(root:Node3D)->AABB:
    var collected=AABB()
    var has=false
    for node in root.find_children("*","MeshInstance3D",true,false):
        if not node is MeshInstance3D or node.mesh==null:continue
        var tr=Transform3D.IDENTITY
        var obj:Node3D=node as Node3D
        while obj!=root and obj!=null:
            tr=obj.transform*tr
            obj=obj.get_parent() as Node3D
        var bound=tr*node.mesh.get_aabb()
        if not has:
            collected=bound
            has=true
        else:
            collected=collected.merge(bound)
    if not has:
        collected=AABB(Vector3(-1,-1,-1),Vector3(2,2,2))
    return collected

func _make_first_person_weapon() -> void:
    using_authored_rig=false
    fps_anim=null
    gun_mesh=null
    var rig_path="res://assets/rig/scene.gltf"
    if ResourceLoader.exists(rig_path):
        var res=load(rig_path)
        if res is PackedScene:
            var authored=res.instantiate()
            if authored is Node3D:
                var holder:=Node3D.new()
                gun_root.add_child(holder)
                holder.add_child(authored)
                var bounds=_scene_mesh_bounds(authored)
                var big=maxf(bounds.size.x,maxf(bounds.size.y,bounds.size.z))
                var scale_factor=1.6/maxf(.01,big)
                authored.scale=Vector3.ONE*scale_factor
                authored.position=-bounds.get_center()*scale_factor
                # Use a single corrected viewmodel pivot; F6/F7 calibration remains available.
                # No arbitrary 180° flip or per-animation rotation offsets.
                holder.rotation=Vector3(-.45,-1.10+gun_orientation,-.12)
                holder.position=Vector3(.23,0,-.92)
                gun_mesh=holder
                using_authored_rig=true
                var animations=authored.find_children("*","AnimationPlayer",true,false)
                if animations.size()>0:
                    fps_anim=animations[0] as AnimationPlayer
                _play_rig_anim("idle")
    if not using_authored_rig:
        var old="res://assets/"+String(GUNS[weapon_idx]["model"])+".glb"
        if ResourceLoader.exists(old):
            var oldres=load(old)
            if oldres is PackedScene:
                gun_mesh=oldres.instantiate()
                gun_root.add_child(gun_mesh)
                gun_mesh.rotation.y=PI+gun_orientation
                gun_mesh.scale=Vector3.ONE*.7
                gun_mesh.position=Vector3(0,-.08,-.25)
        if not is_instance_valid(gun_mesh):
            gun_mesh=Node3D.new()
            gun_root.add_child(gun_mesh)
            _box(gun_mesh,Vector3(0,-.1,-.42),Vector3(.15,.19,.95),tex_metal,false)
        var arm_scene="res://assets/npc-arms-ct.glb"
        if ResourceLoader.exists(arm_scene):
            var arms=load(arm_scene)
            if arms is PackedScene:
                var hands=arms.instantiate()
                gun_root.add_child(hands)
                hands.position=Vector3(-.22,-.18,.04)
                hands.scale=Vector3.ONE*.65
                hands.rotation_degrees=Vector3(-8,180,0)

func _weapon_data() -> Dictionary:
    return GUNS[weapon_idx]

func _equip(idx:int) -> void:
    if idx<0 or idx>=GUNS.size():return
    weapon_idx=idx
    if not is_instance_valid(gun_root):return
    if is_instance_valid(gun_mesh):
        gun_root.remove_child(gun_mesh)
        gun_mesh.queue_free()
    # Remove old fallback hands when switching from a sidearm.
    for child in gun_root.get_children():
        if child==muzzle:continue
        if child is OmniLight3D:continue
        if child is Node3D:
            gun_root.remove_child(child)
            child.queue_free()
    gun_mesh=null
    fps_anim=null
    fps_anim_name=""
    if weapon_idx==0:
        _make_first_person_weapon()
    else:
        var path="res://assets/"+String(_weapon_data()["model"])+".glb"
        if ResourceLoader.exists(path):
            var resource=load(path)
            if resource is PackedScene:
                var holder:=Node3D.new()
                gun_root.add_child(holder)
                var model=resource.instantiate()
                holder.add_child(model)
                var bounds=_scene_mesh_bounds(model)
                var big=maxf(bounds.size.x,maxf(bounds.size.y,bounds.size.z))
                model.scale=Vector3.ONE*(.65/maxf(big,.001))
                model.position=-bounds.get_center()*(.65/maxf(big,.001))
                holder.rotation=Vector3(-.10,PI+gun_orientation,-.02)
                holder.position=Vector3(.14,-.06,-.32)
                gun_mesh=holder
        if not is_instance_valid(gun_mesh):
            gun_mesh=Node3D.new()
            gun_root.add_child(gun_mesh)
            _box(gun_mesh,Vector3(0,0,-.2),Vector3(.16,.16,.6),tex_metal,false)
    if weapon_idx!=0:
        # Visible articulated arm mesh for every other weapon.
        var arms_path="res://assets/npc-arms-ct.glb"
        if ResourceLoader.exists(arms_path):
            var arm_resource=load(arms_path)
            if arm_resource is PackedScene:
                var arm_holder:=Node3D.new()
                arm_holder.name="FPS_HANDS"
                gun_root.add_child(arm_holder)
                var arm_instance=arm_resource.instantiate()
                arm_holder.add_child(arm_instance)
                arm_holder.position=Vector3(-.25,-.15,-.14)
                arm_holder.scale=Vector3.ONE*.72
                arm_holder.rotation_degrees=Vector3(-8,180,0)
    mag=int(_weapon_data()["mag"])
    reserve=int(_weapon_data()["reserve"])
    reload_time=0
    hint_label.text=String(_weapon_data()["name"])+"   |   R — ПЕРЕЗАРЯДКА"

func _buy_gun(idx:int) -> void:
    if idx<0 or idx>=GUNS.size():return
    var p=int(GUNS[idx]["price"])
    if money<p:
        hint_label.text="НЕДОСТАТОЧНО ДЕНЕГ"
        return
    money-=p
    _equip(idx)
    buy_overlay.hide()
    running=true
    Input.mouse_mode=Input.MOUSE_MODE_CAPTURED

func _buy_grenade(kind:int) -> void:
    var cost=300 if kind==0 else 250
    if money<cost:
        hint_label.text="НЕДОСТАТОЧНО ДЕНЕГ"
        return
    money-=cost
    if kind==0:
        grenade_he+=1
    else:
        grenade_smoke+=1
    if is_instance_valid(buy_overlay):
        buy_overlay.hide()
        running=true
        Input.mouse_mode=Input.MOUSE_MODE_CAPTURED

func _grenade_throw(smoke:bool) -> void:
    if grenade_time>0.0:return
    if smoke:
        if grenade_smoke<=0:return
        grenade_smoke-=1
    else:
        if grenade_he<=0:return
        grenade_he-=1
    grenade_time=.75
    var sphere:=RigidBody3D.new()
    sphere.name="SMOKE_GRENADE" if smoke else "FRAG_GRENADE"
    sphere.mass=.45
    sphere.continuous_cd=true
    sphere.collision_layer=2
    sphere.collision_mask=1|2
    var col:=CollisionShape3D.new()
    var shape:=SphereShape3D.new()
    shape.radius=.12
    col.shape=shape
    sphere.add_child(col)
    var mesh:=MeshInstance3D.new()
    var ge:=SphereMesh.new()
    ge.radius=.12
    ge.height=.24
    mesh.mesh=ge
    mesh.material_override=_mat(Color("7d9c9c") if smoke else Color("526645"),.45,.42)
    sphere.add_child(mesh)
    scene_root.add_child(sphere)
    sphere.global_position=camera.global_position-camera.global_transform.basis.z*1.0+Vector3(0,-.14,0)
    sphere.linear_velocity=-camera.global_transform.basis.z*17+Vector3(0,4.6,0)+player.velocity*.25
    projectiles.append({"body":sphere,"timer":2.5,"smoke":smoke})
    hint_label.text="ДЫМОВАЯ ГРАНАТА!" if smoke else "ОСКОЛОЧНАЯ ГРАНАТА!"

func _explode_grenade(data:Dictionary) -> void:
    var body:RigidBody3D=data["body"]
    if not is_instance_valid(body):return
    var xyz=body.global_position
    var smoke:bool=bool(data["smoke"])
    var glow:=OmniLight3D.new()
    glow.position=xyz
    glow.omni_range=8
    glow.light_energy=3.0
    glow.light_color=Color("ccd6da") if smoke else Color("ffa653")
    scene_root.add_child(glow)
    var burst:=Node3D.new()
    burst.position=xyz
    scene_root.add_child(burst)
    if smoke:
        for i in range(22):
            var p:=MeshInstance3D.new()
            var sphere:=SphereMesh.new()
            sphere.radius=rng.randf_range(.65,1.2)
            sphere.height=sphere.radius*2
            p.mesh=sphere
            var cloud:=StandardMaterial3D.new()
            cloud.albedo_color=Color(.51,.59,.61,.23)
            cloud.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
            cloud.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
            p.material_override=cloud
            p.position=Vector3(rng.randf_range(-2.3,2.3),rng.randf_range(0,2.3),rng.randf_range(-2.3,2.3))
            burst.add_child(p)
        var timer=get_tree().create_timer(7.0)
        var smoke_tween=get_tree().create_tween()
        smoke_tween.tween_interval(7.0)
        smoke_tween.finished.connect(burst.queue_free)
    else:
        for b in bots:
            if is_instance_valid(b) and not b.get_meta("ally"):
                var dist=b.global_position.distance_to(xyz)
                if dist<7.0:
                    _hurt_bot(b,65.0*(1.0-dist/7.0)+10.0,player)
        if is_instance_valid(player):
            var dist=player.global_position.distance_to(xyz)
            if dist<5:_hurt(40.0*(1.0-dist/5.0))
        var particles:=GPUParticles3D.new()
        particles.amount=65
        particles.lifetime=.8
        particles.one_shot=true
        var process_mat:=ParticleProcessMaterial.new()
        process_mat.direction=Vector3.UP
        process_mat.spread=180.0
        process_mat.initial_velocity_min=3
        process_mat.initial_velocity_max=10
        particles.process_material=process_mat
        var qm:=SphereMesh.new()
        qm.radius=.08
        qm.height=.16
        particles.draw_pass_1=qm
        burst.add_child(particles)
        particles.emitting=true
        var burst_tween=get_tree().create_tween()
        burst_tween.tween_interval(1.7)
        burst_tween.finished.connect(burst.queue_free)
    var flash_tween=get_tree().create_tween()
    flash_tween.tween_interval(.3)
    flash_tween.finished.connect(glow.queue_free)
    body.queue_free()

func _play_rig_anim(wanted:String) -> void:
    if not is_instance_valid(fps_anim):return
    if fps_anim_name==wanted:return
    for name in fps_anim.get_animation_list():
        var low=String(name).to_lower()
        if low.contains(wanted):
            fps_anim.play(String(name),.12)
            fps_anim_name=wanted
            return


func _make_bot(ally: bool,idx: int) -> void:
    var bot:=CharacterBody3D.new()
    bot.name=("ALLY_" if ally else "ENEMY_")+str(idx+1)
    bot.collision_layer=2
    bot.collision_mask=1|2|4
    bot.position=Vector3((idx-2)*2.0,1.2,(-14.0 if not ally else 14.0)) if map_id==3 else Vector3((idx-2)*3.3 if not ally else (idx-1)*3.1,1.2,-28 if not ally else 23)
    var col:=CollisionShape3D.new()
    var shp:=CapsuleShape3D.new()
    shp.height=1.85
    shp.radius=.39
    col.shape=shp
    bot.add_child(col)
    bot.set_meta("hp",100.0)
    bot.set_meta("ally",ally)
    bot.set_meta("shot",rng.randf_range(.4,1.8))
    bot.set_meta("wander",rng.randf_range(-1,1))
    bot.set_meta("bomber",not ally and idx==0)
    bot.set_meta("last_target",Vector3.ZERO)
    bot.set_meta("next_repath",0.0)
    bot.set_meta("path",PackedVector2Array())
    bot.set_meta("path_i",0)
    bot.set_meta("reaction",rng.randf_range(.20,.55))
    var pack_path="res://assets/military_soldier.glb"
    if not ResourceLoader.exists(pack_path):
        pack_path="res://assets/soldier_ct.glb" if ally else "res://assets/soldier_t.glb"
    if ResourceLoader.exists(pack_path):
        var pack=load(pack_path)
        if pack is PackedScene:
            var model=pack.instantiate()
            bot.add_child(model)
            if pack_path.ends_with("military_soldier.glb"):
                # BAMEN's rig is already authored at human scale.
                # Skinned AABBs can be tiny/incorrect until animation updates;
                # auto-normalizing them caused gigantic soldiers above the map.
                model.scale=Vector3.ONE*.95
                model.position=Vector3(0,-.92,0)
                model.rotation.y=PI
                var clips=model.find_children("*","AnimationPlayer",true,false)
                if clips.size()>0:
                    var ap:AnimationPlayer=clips[0]
                    bot.set_meta("animation_player",ap)
                    bot.set_meta("animation_state","")
                    _set_bot_anim(bot,"idle")
            else:
                model.position.y=-.92
                model.scale=Vector3.ONE*.8
            # Clear friend/foe identification, without repainting realistic textures.
            var emblem:=MeshInstance3D.new()
            var emblem_mesh:=BoxMesh.new()
            emblem_mesh.size=Vector3(.10,.22,.05)
            emblem.mesh=emblem_mesh
            emblem.material_override=_mat(Color("4dd7d2") if ally else Color("f39070"),.52,.06)
            emblem.position=Vector3(.34,.44,.11)
            bot.add_child(emblem)
    else:
        var shell:=MeshInstance3D.new()
        var capsule:=CapsuleMesh.new()
        capsule.height=1.8
        capsule.radius=.36
        shell.mesh=capsule
        shell.material_override=_mat(Color("457caa") if ally else Color("b65e4c"))
        bot.add_child(shell)
    var overhead:=Label3D.new()
    overhead.text=("CT "+str(idx+1)) if ally else ("OP "+str(idx+1))
    overhead.font_size=22
    overhead.pixel_size=.006
    overhead.modulate=Color("73dbd3") if ally else Color("ed977b")
    overhead.position=Vector3(0,1.48,0)
    overhead.billboard=BaseMaterial3D.BILLBOARD_ENABLED
    bot.add_child(overhead)
    scene_root.add_child(bot)
    bots.append(bot)

func _set_bot_anim(bot:CharacterBody3D,want:String) -> void:
    if not bot.has_meta("animation_player"):return
    var ap=bot.get_meta("animation_player") as AnimationPlayer
    if not is_instance_valid(ap):return
    if bot.get_meta("animation_state","")==want:return
    var chosen=""
    for nm in ap.get_animation_list():
        var low=String(nm).to_lower()
        if low.contains(want):
            chosen=String(nm)
            break
    if chosen=="":
        for nm in ap.get_animation_list():
            if String(nm).to_lower().contains("idle"):
                chosen=String(nm)
                break
    if chosen=="" and ap.get_animation_list().size()>0:
        chosen=String(ap.get_animation_list()[0])
    if chosen!="":
        ap.play(chosen,.18)
        bot.set_meta("animation_state",want)

func _physics_process(dt: float) -> void:
    if not running:return
    var wish=Vector3.ZERO
    if Input.is_physical_key_pressed(KEY_W):wish-=player.transform.basis.z
    if Input.is_physical_key_pressed(KEY_S):wish+=player.transform.basis.z
    if Input.is_physical_key_pressed(KEY_A):wish-=player.transform.basis.x
    if Input.is_physical_key_pressed(KEY_D):wish+=player.transform.basis.x
    wish.y=0
    wish=wish.normalized()
    var crouch=Input.is_physical_key_pressed(KEY_CTRL)
    var run=Input.is_physical_key_pressed(KEY_SHIFT) and not crouch
    var target_speed=CROUCH_SPEED if crouch else RUN_SPEED if run else SPEED
    player.velocity.x=move_toward(player.velocity.x,wish.x*target_speed,35*dt)
    player.velocity.z=move_toward(player.velocity.z,wish.z*target_speed,35*dt)
    player.velocity.y-=GRAVITY*dt
    current_speed=Vector2(player.velocity.x,player.velocity.z).length()
    if player.is_on_floor() and Input.is_physical_key_pressed(KEY_SPACE):player.velocity.y=7.0
    player.move_and_slide()
    neck.position.y=lerpf(neck.position.y,.35 if crouch else .63,dt*11)
    for bot in bots:
        if not is_instance_valid(bot) or bot.is_queued_for_deletion():continue
        var ally:bool=bool(bot.get_meta("ally"))
        var target:Node3D=null
        var best=INF
        if not ally and health>0:
            target=player
            best=bot.global_position.distance_squared_to(player.global_position)
        for other in bots:
            if other==bot or not is_instance_valid(other) or other.is_queued_for_deletion():continue
            if bool(other.get_meta("ally"))==ally:continue
            var dist=bot.global_position.distance_squared_to(other.global_position)
            if dist<best:
                best=dist
                target=other
        if not is_instance_valid(target):continue
        var tactical_target=target.global_position
        if not ally and is_instance_valid(bomb) and bomb.stage==0 and is_instance_valid(bomb.carrier) and bomb.carrier==bot:
            tactical_target=bomb.site_a
        var combat_distance=bot.global_position.distance_to(target.global_position)
        var delta=tactical_target-bot.global_position
        var range_m=delta.length()
        var direct=Vector3(delta.x,0,delta.z).normalized()
        var move_dir=direct
        if is_instance_valid(nav_grid) and range_m>6.0:
            var next_repath=float(bot.get_meta("next_repath"))
            if game_time>=next_repath:
                var path:PackedVector2Array=nav_grid.route(bot.global_position,target.global_position)
                bot.set_meta("path",path)
                bot.set_meta("path_i",1 if path.size()>1 else 0)
                bot.set_meta("next_repath",game_time+rng.randf_range(.65,1.3))
                total_nav_replans+=1
            var path_points:PackedVector2Array=bot.get_meta("path")
            var index:int=int(bot.get_meta("path_i"))
            if path_points.size()>index:
                var waypoint=path_points[index]
                var heading=Vector3(waypoint.x-bot.global_position.x,0.0,waypoint.y-bot.global_position.z)
                if heading.length()<1.05 and index+1<path_points.size():
                    index+=1
                    bot.set_meta("path_i",index)
                    waypoint=path_points[index]
                    heading=Vector3(waypoint.x-bot.global_position.x,0.0,waypoint.y-bot.global_position.z)
                if heading.length()>.15:
                    move_dir=heading.normalized()
        var evasive=Vector3(-direct.z,0,direct.x)*sin(game_time*.73+float(bot.get_instance_id()%17))
        if range_m<10:
            move_dir=(move_dir*.35+evasive*.7).normalized()
        var speed=4.1 if range_m>14 else 2.5 if range_m>5.0 else 1.5
        var desired=move_dir*speed
        bot.velocity.x=move_toward(bot.velocity.x,desired.x,dt*13.0)
        bot.velocity.z=move_toward(bot.velocity.z,desired.z,dt*13.0)
        bot.velocity.y-=GRAVITY*dt
        bot.move_and_slide()
        _set_bot_anim(bot,"run" if Vector2(bot.velocity.x,bot.velocity.z).length()>2.0 else "idle")
        if combat_distance<28:
            bot.look_at(Vector3(target.global_position.x,bot.global_position.y,target.global_position.z),Vector3.UP)
        elif move_dir.length()>.1:
            bot.look_at(bot.global_position+move_dir,Vector3.UP)
        var cooldown=float(bot.get_meta("shot"))-dt
        var reacting=float(bot.get_meta("reaction"))-dt
        if cooldown<=0.0 and reacting<=0 and combat_distance<34.0 and not suppress_bots:
            cooldown=rng.randf_range(.32,.8)/bot_skill
            var muzzle_origin=bot.global_position+Vector3(0,.53,0)
            var target_pos=target.global_position+Vector3(0,.48,0)
            var query=PhysicsRayQueryParameters3D.create(muzzle_origin,target_pos)
            query.exclude=[bot.get_rid()]
            var hit=get_world_3d().direct_space_state.intersect_ray(query)
            if not hit.is_empty() and hit["collider"]==target:
                var accuracy=clampf(bot_skill*(1.1-combat_distance*.012),.14,.85)
                if rng.randf()<accuracy:
                    if target==player:
                        _hurt(rng.randf_range(8,14))
                    elif target is CharacterBody3D:
                        _hurt_bot(target,rng.randf_range(13,21),bot)
        bot.set_meta("shot",cooldown)
        bot.set_meta("reaction",reacting)

func _process(dt: float) -> void:
    if not running:return
    game_time+=dt
    round_time=maxf(0,round_time-dt)
    if is_instance_valid(bomb):
        var result:String=bomb.tick(dt,player,bots,Input.is_physical_key_pressed(KEY_E))
        if result=="defused":
            score_blue+=1
            _finish("БОМБА ОБЕЗВРЕЖЕНА · СПЕЦНАЗ ПОБЕДИЛ")
            return
        elif result=="detonated":
            score_red+=1
            _finish("ВЗРЫВ БОМБЫ · АТАКУЮЩИЕ ПОБЕДИЛИ")
            return
    fire_delay=maxf(0,fire_delay-dt)
    grenade_time=maxf(0,grenade_time-dt)
    for n in range(projectiles.size()-1,-1,-1):
        var g:Dictionary=projectiles[n]
        g["timer"]=float(g["timer"])-dt
        if float(g["timer"])<=0.0:
            _explode_grenade(g)
            projectiles.remove_at(n)
        else:
            projectiles[n]=g
    if is_instance_valid(crosshair_ui):
        crosshair_ui.set("spread",lerpf(float(crosshair_ui.get("spread")),0.0 if weapon_aim else clampf(current_speed*.6+recoil*9.0,0.0,20.0),dt*14))
        crosshair_ui.set("scope",weapon_aim and weapon_idx==2)
    recoil=move_toward(recoil,0,dt*4.2)
    running_bob+=dt*(10.0 if current_speed>8.0 else 6.2 if current_speed>.5 else 1.8)
    var bob=(sin(running_bob)*.017) if current_speed>.4 else 0.0
    gun_root.position.y=lerpf(gun_root.position.y,-.18-recoil*.12+bob,dt*16)
    gun_root.position.z=lerpf(gun_root.position.z,-.66+cos(running_bob)*.012,dt*8)
    if is_instance_valid(muzzle):muzzle.light_energy=move_toward(muzzle.light_energy,0.0,dt*125)
    if is_instance_valid(damage_flash):
        damage_flash_time=maxf(damage_flash_time-dt,0)
        damage_flash.color.a=.29*damage_flash_time
    if reload_time>0:_play_rig_anim("reload")
    elif game_time<shot_anim_ends:_play_rig_anim("shot")
    elif current_speed>8.0:_play_rig_anim("run")
    elif current_speed>.5:_play_rig_anim("walk")
    else:_play_rig_anim("idle")
    gun_root.rotation.x=lerpf(gun_root.rotation.x,recoil*.12,dt*13)
    weapon_aim=Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
    if weapon_aim:
        camera.fov=lerpf(camera.fov,26 if weapon_idx==2 else 58,dt*14)
        gun_root.position.x=lerpf(gun_root.position.x,.06,dt*11)
    else:
        camera.fov=lerpf(camera.fov,75,dt*13)
        gun_root.position.x=lerpf(gun_root.position.x,.31,dt*11)
    if reload_time>0:
        reload_time-=dt
        if reload_time<=0:
            var add=mini(int(_weapon_data()["mag"])-mag,reserve)
            mag+=add
            reserve-=add
            hint_label.text="ПЕРЕЗАРЯДКА ЗАВЕРШЕНА"
    if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and reload_time<=0 and Input.mouse_mode==Input.MOUSE_MODE_CAPTURED:
        _shoot()
    var remaining=0
    for bot in bots:
        if is_instance_valid(bot) and not bot.get_meta("ally"):
            remaining+=1
    var time_text="%02d:%02d" % [int(round_time)/60,int(round_time)%60]
    top_label.text="CONTACT ZERO    /    "+["BASTION","NIGHTSHIFT","RIDGE","COMPOUND"][map_id]+"    |    ROUND "+str(score_blue+score_red+1)+"     "+time_text
    info_label.text="СПЕЦНАЗ  "+str(score_blue)+"  :  "+str(score_red)+"  АТАКУЮЩИЕ      ПРОТИВНИКИ: "+str(remaining)
    if is_instance_valid(bomb_label) and is_instance_valid(bomb):
        if bomb.stage==1:
            bomb_label.text="БОМБА ЗАЛОЖЕНА   "+str(ceili(bomb.timer))+"с    [ E — ОБЕЗВРЕДИТЬ ]"
            if bomb.defuse_progress>0:
                bomb_label.text+="  "+str(int(bomb.defuse_progress*20))+"%"
        elif bomb.plant_progress>0:
            bomb_label.text="ПРОТИВНИК ЗАКЛАДЫВАЕТ БОМБУ!"
        else:
            bomb_label.text="ЗАЩИТА ОБЪЕКТОВ   A  /  B"
    hp_label.text="ЗДОРОВЬЕ "+str(int(health))+"    БРОНЯ "+str(int(armor))+"    $"+str(money)
    ammo_label.text=str(mag)+" / "+str(reserve)+"   "+String(_weapon_data()["name"])
    if is_instance_valid(grenade_label):
        grenade_label.text="G  HE  ×"+str(grenade_he)+"    H  SMOKE  ×"+str(grenade_smoke)+"     [ B — МАГАЗИН ]"
    if remaining==0 and (not is_instance_valid(bomb) or bomb.stage!=1):
        score_blue+=1
        _finish("РАУНД ВЫИГРАН · ПРОТИВНИКИ УСТРАНЕНЫ")
    elif round_time<=0:
        score_red+=1
        _finish("ВРЕМЯ ВЫШЛО · РАУНД ПРОИГРАН")

func _shoot() -> void:
    if fire_delay>0:return
    if mag<=0:
        _reload()
        return
    mag-=1
    fire_delay=float(_weapon_data()["interval"])
    last_shot=game_time
    recoil=1.0
    shot_anim_ends=game_time+.16
    fps_anim_name=""
    _play_rig_anim("shot")
    if is_instance_valid(muzzle):muzzle.light_energy=5.4
    if is_instance_valid(audio_gun) and audio_gun.stream!=null:
        audio_gun.pitch_scale=rng.randf_range(.94,1.06)
        audio_gun.play()
    neck.rotation.x=clampf(neck.rotation.x+float(_weapon_data()["recoil"]),-1.40,1.4)
    var start=camera.global_position
    var end=start-camera.global_transform.basis.z*120
    var q=PhysicsRayQueryParameters3D.create(start,end)
    q.exclude=[player.get_rid()]
    var hit=get_world_3d().direct_space_state.intersect_ray(q)
    if not hit.is_empty():
        var target=hit["collider"]
        if target is CharacterBody3D and target.has_meta("hp") and not target.get_meta("ally"):
            _hurt_bot(target,float(_weapon_data()["damage"]),player)
            hint_label.text="ПОПАДАНИЕ"
            if is_instance_valid(crosshair_ui):crosshair_ui.set("hit_flash",.13)
            if is_instance_valid(audio_hit) and audio_hit.stream!=null:audio_hit.play()
            cross.modulate=Color("f3b7a0")
    if mag==0:hint_label.text="МАГАЗИН ПУСТ — R"

func _hurt_bot(bot: CharacterBody3D,dmg: float,killer: Node3D) -> void:
    if not is_instance_valid(bot) or bot.is_queued_for_deletion():return
    var hp=float(bot.get_meta("hp"))-dmg
    bot.set_meta("hp",hp)
    if hp<=0:
        bots.erase(bot)
        bot.queue_free()
        if killer==player:
            kills+=1
            money+=300
            hint_label.text="УСТРАНЕНИЕ +300$"

func _hurt(amount: float) -> void:
    var absorbed=minf(armor,amount*.5)
    armor-=absorbed
    health-=amount-absorbed
    if is_instance_valid(damage_flash):
        damage_flash_time=.95
        damage_flash.color.a=.25
    if health<=0:
        health=0
        deaths+=1
        score_red+=1
        _finish("ВЫ ПОГИБЛИ · ПОПРОБУЙТЕ СНОВА")

func _reload() -> void:
    if reload_time<=0 and mag<int(_weapon_data()["mag"]) and reserve>0:
        reload_time=float(_weapon_data()["reload"])
        _play_rig_anim("reload")
        hint_label.text="ПЕРЕЗАРЯДКА..."

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseMotion and running and Input.mouse_mode==Input.MOUSE_MODE_CAPTURED:
        player.rotate_y(-event.relative.x*MOUSE_SENS)
        neck.rotate_x(-event.relative.y*MOUSE_SENS)
        neck.rotation.x=clampf(neck.rotation.x,-1.4,1.4)
    if event is InputEventKey and event.pressed and not event.echo:
        if is_instance_valid(buy_overlay) and buy_overlay.visible:
            if event.physical_keycode==KEY_ESCAPE or event.physical_keycode==KEY_B:
                _resume_from_buy()
                return
            var code=event.physical_keycode
            if code>=KEY_1 and code<=KEY_6:
                _buy_gun(code-KEY_1)
                return
        if event.physical_keycode==KEY_ESCAPE:
            if running:
                Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
                running=false
                _show_menu()
            return
        if running:
            if event.physical_keycode==KEY_R:_reload()
            if event.physical_keycode==KEY_G:_grenade_throw(false)
            if event.physical_keycode==KEY_H:_grenade_throw(true)
            if event.physical_keycode==KEY_1:_equip(0)
            if event.physical_keycode==KEY_2:_equip(1)
            if event.physical_keycode==KEY_3:_equip(2)
            if event.physical_keycode==KEY_4:_equip(3)
            if event.physical_keycode==KEY_5:_equip(4)
            if event.physical_keycode==KEY_6:_equip(5)
            if event.physical_keycode==KEY_F6:
                gun_orientation-=.13
                _equip(weapon_idx)
                hint_label.text="ПОВОРОТ ОРУЖИЯ ВЛЕВО: "+str(rad_to_deg(gun_orientation))+"°"
            if event.physical_keycode==KEY_F7:
                gun_orientation+=.13
                _equip(weapon_idx)
                hint_label.text="ПОВОРОТ ОРУЖИЯ ВПРАВО: "+str(rad_to_deg(gun_orientation))+"°"
            if event.physical_keycode==KEY_F8:
                gun_orientation=0
                _equip(weapon_idx)
                hint_label.text="ПОЛОЖЕНИЕ ОРУЖИЯ СБРОШЕНО"
            if event.physical_keycode==KEY_B:
                running=false
                buy_overlay.show()
                Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
            if event.physical_keycode==KEY_F:hint_label.text="CONTACT ZERO · NATIVE"
        else:
            if event.physical_keycode==KEY_1:_start_match(0)
            if event.physical_keycode==KEY_2:_start_match(1)
            if event.physical_keycode==KEY_3:_start_match(2)

func _make_label(parent: Node, text: String, font: int, color: Color) -> Label:
    var l:=Label.new()
    l.text=text
    l.add_theme_font_size_override("font_size",font)
    l.add_theme_color_override("font_color",color)
    parent.add_child(l)
    return l

func _make_style(bg:Color,line:Color,rounded:int=8) -> StyleBoxFlat:
    var style:=StyleBoxFlat.new()
    style.bg_color=bg
    style.border_color=line
    style.set_border_width_all(1)
    style.set_corner_radius_all(rounded)
    style.content_margin_left=14.0
    style.content_margin_right=14.0
    style.content_margin_top=13.0
    style.content_margin_bottom=13.0
    return style

func _style_button(b:Button,bg:Color,accent:Color) -> void:
    b.add_theme_stylebox_override("normal",_make_style(bg,accent))
    b.add_theme_stylebox_override("hover",_make_style(Color("243b48"),Color("f0b671")))
    b.add_theme_stylebox_override("pressed",_make_style(Color("405969"),Color("f0bf7b")))
    b.add_theme_stylebox_override("focus",_make_style(Color(0,0,0,0),Color("f0b671")))
    b.add_theme_color_override("font_color",Color("eff5f7"))
    b.add_theme_color_override("font_hover_color",Color("fff4dc"))
    b.add_theme_font_size_override("font_size",19)

func _create_ui() -> void:
    ui=CanvasLayer.new()
    ui.layer=10
    add_child(ui)
    hud=Control.new()
    hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.mouse_filter=Control.MOUSE_FILTER_IGNORE
    ui.add_child(hud)
    var hudbar:=ColorRect.new()
    hudbar.color=Color(.025,.05,.068,.79)
    hudbar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
    hudbar.offset_bottom=94
    hudbar.mouse_filter=Control.MOUSE_FILTER_IGNORE
    hud.add_child(hudbar)
    top_label=_make_label(hud,"CONTACT  ZERO      /      TACTICAL OPERATIONS",23,Color("edf5f7"))
    top_label.position=Vector2(37,15)
    info_label=_make_label(hud,"5V5  •  РЕЖИМ УНИЧТОЖЕНИЯ",17,Color("f0b97e"))
    info_label.position=Vector2(39,52)
    bomb_label=_make_label(hud,"ЗАЩИТА ОБЪЕКТОВ    A / B",18,Color("ffd0a0"))
    bomb_label.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
    bomb_label.position=Vector2(-510,23)
    var bottombar:=ColorRect.new()
    bottombar.color=Color(.025,.047,.064,.43)
    bottombar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
    bottombar.offset_top=-84
    bottombar.mouse_filter=Control.MOUSE_FILTER_IGNORE
    hud.add_child(bottombar)
    hp_label=_make_label(hud,"ЗДОРОВЬЕ   100",21,Color("afdfbf"))
    hp_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
    hp_label.position=Vector2(34,-71)
    ammo_label=_make_label(hud,"30 / 150   AK-74M",28,Color("eaf4f6"))
    ammo_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
    ammo_label.position=Vector2(-370,-74)
    hint_label=_make_label(hud,"",16,Color("ffd09a"))
    hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
    hint_label.position=Vector2(35,-112)
    grenade_label=_make_label(hud,"G  HE  ×2     H  SMOKE  ×1       B — МАГАЗИН",15,Color("c0d3dc"))
    grenade_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
    grenade_label.position=Vector2(-469,-109)
    cross=_make_label(hud,"",1,Color("e5f8f7"))
    cross.visible=false
    crosshair_ui=Control.new()
    crosshair_ui.set_script(load("res://crosshair.gd"))
    crosshair_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.add_child(crosshair_ui)
    damage_flash=ColorRect.new()
    damage_flash.color=Color(1,.12,.1,0)
    damage_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    damage_flash.mouse_filter=Control.MOUSE_FILTER_IGNORE
    hud.add_child(damage_flash)
    # Fullscreen menu with deliberate typographic hierarchy and three playable arenas.
    cover=ColorRect.new()
    cover.color=Color("070f17")
    cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    ui.add_child(cover)
    var strip:=ColorRect.new()
    strip.color=Color("df9456")
    strip.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
    strip.offset_bottom=6
    cover.add_child(strip)
    var superhead:=Label.new()
    superhead.text="C Z     //     T A C T I C A L    S Y S T E M S"
    superhead.position=Vector2(69,44)
    superhead.add_theme_font_size_override("font_size",16)
    superhead.add_theme_color_override("font_color",Color("b9a993"))
    cover.add_child(superhead)
    panel=VBoxContainer.new()
    panel.position=Vector2(67,66)
    panel.custom_minimum_size=Vector2(700,545)
    panel.add_theme_constant_override("separation",8)
    cover.add_child(panel)
    title_label=_make_label(panel,"CONTACT   ZERO",55,Color("f0f6fa"))
    subtitle_label=_make_label(panel,"TACTICAL FPS  /  WINDOWS  /  VERSION 3",22,Color("ed9e72"))
    var divider=HSeparator.new()
    panel.add_child(divider)
    _make_label(panel,"ВЫБЕРИ ЛОКАЦИЮ",19,Color("b8c9d1"))
    for i in range(4):
        var b:=Button.new()
        b.text=["01     BASTION            ГОРОДСКИЕ КВАРТАЛЫ  /  ДЕНЬ",
                "02     NIGHTSHIFT         ПРОМЫШЛЕННЫЙ ПОРТ  /  НОЧЬ",
                "03     RIDGE                 ВОЕННАЯ БАЗА  /  СНЕГ",
                "04     COMPOUND          ПРОМЫШЛЕННЫЙ КОМПЛЕКС  /  ДЕНЬ"][i]
        b.alignment=HORIZONTAL_ALIGNMENT_LEFT
        b.custom_minimum_size=Vector2(690,56)
        _style_button(b,Color("152430"),Color("405d70"))
        b.pressed.connect(_start_match.bind(i))
        panel.add_child(b)
    var foot=_make_label(panel,"5 НА 5   •   6 ВИДОВ ОРУЖИЯ   •   ДЫМ И ОСКОЛОЧНЫЕ ГРАНАТЫ",18,Color("9fb3bf"))
    foot.position.y+=9
    _make_label(panel,"WASD / SHIFT / CTRL     •     ЛКМ ОГОНЬ     •     ПКМ ПРИЦЕЛ    •    R ПЕРЕЗАРЯДКА",14,Color("8ca6b4"))
    _make_label(panel,"1–6 ОРУЖИЕ     •     B МАГАЗИН     •     G/H ГРАНАТЫ     •     ESC МЕНЮ",14,Color("8ca6b4"))
    var right_panel:=PanelContainer.new()
    right_panel.position=Vector2(814,119)
    right_panel.custom_minimum_size=Vector2(395,425)
    right_panel.add_theme_stylebox_override("panel",_make_style(Color("101c26"),Color("30495b"),10))
    cover.add_child(right_panel)
    var info_col:=VBoxContainer.new()
    info_col.add_theme_constant_override("separation",14)
    right_panel.add_child(info_col)
    _make_label(info_col,"ОПЕРАЦИЯ   /   CONTACT ZERO",18,Color("efba7a"))
    _make_label(info_col,"ТАКТИЧЕСКИЙ ШУТЕР",26,Color("f3f5f8"))
    _make_label(info_col,"Играй за синюю команду, защищай позиции и уничтожь противников. Используй укрытия и экономику.",17,Color("bdcbd4")).autowrap_mode=TextServer.AUTOWRAP_WORD
    _make_label(info_col,"СНАРЯЖЕНИЕ",17,Color("efba7a"))
    _make_label(info_col,"АК-74M  ·  M4A1  ·  AWP\nDESERT EAGLE  ·  MP5  ·  USP-S",17,Color("d7e4e9"))
    _make_label(info_col,"В РАЗРАБОТКЕ",17,Color("efba7a"))
    _make_label(info_col,"Локации, стрельба, бот-матч, гранаты и выбор оружия. Это прототип, не копия CS2.",16,Color("a0b2be")).autowrap_mode=TextServer.AUTOWRAP_WORD
    # Buy panel
    buy_overlay=ColorRect.new()
    buy_overlay.color=Color(.015,.028,.042,.96)
    buy_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    ui.add_child(buy_overlay)
    var buy_col:=VBoxContainer.new()
    buy_col.position=Vector2(310,60)
    buy_col.custom_minimum_size=Vector2(660,590)
    buy_col.add_theme_constant_override("separation",7)
    buy_overlay.add_child(buy_col)
    _make_label(buy_col,"АРСЕНАЛ    /    CONTACT ZERO",38,Color("f0f4f6"))
    _make_label(buy_col,"ВЫБЕРИ ОРУЖИЕ  •  ДЕНЬГИ СПИСЫВАЮТСЯ ПРИ ПОКУПКЕ",16,Color("edb17b"))
    for i in range(GUNS.size()):
        var button:=Button.new()
        var data:Dictionary=GUNS[i]
        button.text=str(i+1)+"     "+String(data["name"])+"       $"+str(data["price"])+"       [ "+str(data["damage"])+" DMG ]"
        button.alignment=HORIZONTAL_ALIGNMENT_LEFT
        button.custom_minimum_size=Vector2(625,51)
        _style_button(button,Color("152833"),Color("3b5966"))
        button.pressed.connect(_buy_gun.bind(i))
        buy_col.add_child(button)
    for i in range(2):
        var g_button:=Button.new()
        g_button.text="   "+("ОСКОЛОЧНАЯ   +1    $300" if i==0 else "ДЫМОВАЯ          +1    $250")
        _style_button(g_button,Color("2b2d30"),Color("586263"))
        g_button.pressed.connect(_buy_grenade.bind(i))
        buy_col.add_child(g_button)
    var close:=Button.new()
    close.text="НАЗАД К ИГРЕ   /   B"
    _style_button(close,Color("454027"),Color("bba76a"))
    close.pressed.connect(_resume_from_buy)
    buy_col.add_child(close)
    buy_overlay.hide()

func _resume_from_buy() -> void:
    buy_overlay.hide()
    running=true
    Input.mouse_mode=Input.MOUSE_MODE_CAPTURED

func _show_menu() -> void:
    cover.show()
    hud.hide()
    Input.mouse_mode=Input.MOUSE_MODE_VISIBLE

func _start_match(which: int) -> void:
    cover.hide()
    _reset_scene(which)
    await get_tree().process_frame
    health=100
    armor=50
    fps_anim_name=""
    shot_anim_ends=0.0
    damage_flash_time=0.0
    weapon_idx=0
    _equip(0)
    mag=int(_weapon_data()["mag"])
    reserve=int(_weapon_data()["reserve"])
    grenade_he=2
    grenade_smoke=1
    projectiles.clear()
    reload_time=0
    round_time=180
    running=true
    cover.hide()
    hud.show()
    hint_label.text="СПЕЦНАЗ · ОСТАНОВИ ЗАКЛАДКУ БОМБЫ"
    Input.mouse_mode=Input.MOUSE_MODE_CAPTURED

func _finish(message: String) -> void:
    running=false
    cover.show()
    title_label.text="РАУНД ОКОНЧЕН"
    subtitle_label.text=message
    hud.hide()
    Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
