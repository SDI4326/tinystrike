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
        [Color("b5c3cd"),Color("8394a2"),Color("9caebc")]
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
    world.ambient_light_energy = .8 if which == 1 else 1.2
    world.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    world.fog_enabled = true
    world.fog_light_color = sky_tint
    world.fog_density = .0055
    env.environment = world
    scene_root.add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-56,-38,0)
    sun.light_color = Color("a8d8ff") if which == 1 else Color("ffe1b1")
    sun.light_energy = .70 if which == 1 else 1.35
    sun.shadow_enabled = true
    scene_root.add_child(sun)
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
    for q in [[-19,-22],[20,-22],[-20,0],[19,2],[-18,20],[18,22],[0,24],[1,-27],[0,-2]]:
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
    _make_player()
    for n in range(4):
        _make_bot(true,n)
    for n in range(5):
        _make_bot(false,n)

func _building(p: Vector3,s: Vector3) -> void:
    _box(scene_root,p+Vector3(0,s.y*.5,0),s,tex_stone)
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
    player.position=Vector3(0,1.2,28)
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
    gun_root.position=Vector3(.31,-.27,-.66)
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
                holder.rotation=Vector3(-.27,-.54,-.10)
                holder.position=Vector3(.09,-.14,-.72)
                gun_mesh=holder
                using_authored_rig=true
                var animations=authored.find_children("*","AnimationPlayer",true,false)
                if animations.size()>0:
                    fps_anim=animations[0] as AnimationPlayer
                _play_rig_anim("idle")
    if not using_authored_rig:
        var old="res://assets/ak47.glb"
        if ResourceLoader.exists(old):
            var oldres=load(old)
            if oldres is PackedScene:
                gun_mesh=oldres.instantiate()
                gun_root.add_child(gun_mesh)
                gun_mesh.rotation.y=PI
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
    bot.position=Vector3((idx-2)*3.3 if not ally else (idx-1)*3.1,1.2,-28 if not ally else 23)
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
    var pack_path="res://assets/soldier_ct.glb" if ally else "res://assets/soldier_t.glb"
    if ResourceLoader.exists(pack_path):
        var pack=load(pack_path)
        if pack is PackedScene:
            var model=pack.instantiate()
            bot.add_child(model)
            model.position.y=-.92
            model.scale=Vector3.ONE*.8
    else:
        var shell:=MeshInstance3D.new()
        var capsule:=CapsuleMesh.new()
        capsule.height=1.8
        capsule.radius=.36
        shell.mesh=capsule
        shell.material_override=_mat(Color("457caa") if ally else Color("b65e4c"))
        bot.add_child(shell)
    scene_root.add_child(bot)
    bots.append(bot)

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
        if not is_instance_valid(bot):continue
        var target=player
        if bot.get_meta("ally"):
            target=null
            var best=INF
            for other in bots:
                if not is_instance_valid(other) or other.get_meta("ally"):continue
                var dist=bot.global_position.distance_squared_to(other.global_position)
                if dist<best:
                    best=dist
                    target=other
        if not is_instance_valid(target):continue
        var vec=target.global_position-bot.global_position
        var d=vec.length()
        var dir=Vector3(vec.x,0,vec.z).normalized()
        var sidestep=Vector3(-dir.z,0,dir.x)*sin(game_time*.9+float(bot.get_instance_id()%11))
        var approach=dir*.9+sidestep*.42
        var origin=bot.global_position+Vector3(0,.30,0)
        var q_obstacle=PhysicsRayQueryParameters3D.create(origin,origin+dir*2.6)
        q_obstacle.exclude=[bot.get_rid(),player.get_rid()]
        var obstacle=get_world_3d().direct_space_state.intersect_ray(q_obstacle)
        if not obstacle.is_empty():
            var surface=obstacle["normal"]
            var tangent=Vector3(-dir.z,0,dir.x)
            var side=signf(surface.dot(tangent))
            approach=tangent*side*.8+dir*.25
            if absf(side)<.2:
                approach=tangent if bot.get_instance_id()%2==0 else -tangent
        var vel=approach.normalized()*(3.6 if d>14 else 2.2 if d>6 else -1.3)
        bot.velocity.x=move_toward(bot.velocity.x,vel.x,dt*8)
        bot.velocity.z=move_toward(bot.velocity.z,vel.z,dt*8)
        bot.velocity.y-=GRAVITY*dt
        bot.move_and_slide()
        bot.look_at(Vector3(target.global_position.x,bot.global_position.y,target.global_position.z),Vector3.UP)
        var cooldown=float(bot.get_meta("shot"))-dt
        if cooldown<=0.0 and d<33:
            cooldown=rng.randf_range(.5,1.2)
            var source=bot.global_position+Vector3(0,.55,0)
            var dest=target.global_position+Vector3(0,.45,0)
            var query=PhysicsRayQueryParameters3D.create(source,dest)
            query.exclude=[bot.get_rid()]
            var hit=get_world_3d().direct_space_state.intersect_ray(query)
            if not hit.is_empty() and hit["collider"]==target:
                if target==player:
                    _hurt(7.0+rng.randf_range(0,8))
                else:
                    _hurt_bot(target,12.0,bot)
        bot.set_meta("shot",cooldown)

func _process(dt: float) -> void:
    if not running:return
    game_time+=dt
    round_time=maxf(0,round_time-dt)
    fire_delay=maxf(0,fire_delay-dt)
    recoil=move_toward(recoil,0,dt*4.2)
    running_bob+=dt*(10.0 if current_speed>8.0 else 6.2 if current_speed>.5 else 1.8)
    var bob=(sin(running_bob)*.017) if current_speed>.4 else 0.0
    gun_root.position.y=lerpf(gun_root.position.y,-.27-recoil*.12+bob,dt*16)
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
    if Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
        camera.fov=lerpf(camera.fov,57,dt*14)
        gun_root.position.x=lerpf(gun_root.position.x,.06,dt*11)
    else:
        camera.fov=lerpf(camera.fov,75,dt*13)
        gun_root.position.x=lerpf(gun_root.position.x,.31,dt*11)
    if reload_time>0:
        reload_time-=dt
        if reload_time<=0:
            var add=mini(30-mag,reserve)
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
    top_label.text="CONTACT ZERO    /    "+["BASTION","NIGHTSHIFT","RIDGE"][map_id]+"    |    ROUND "+str(score_blue+score_red+1)+"     "+time_text
    info_label.text="СИНИЕ  "+str(score_blue)+"  :  "+str(score_red)+"  КРАСНЫЕ       ПРОТИВНИКИ: "+str(remaining)
    hp_label.text="ЗДОРОВЬЕ "+str(int(health))+"    БРОНЯ "+str(int(armor))+"    $"+str(money)
    ammo_label.text=str(mag)+" / "+str(reserve)+"     AK-74M"
    if remaining==0:
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
    fire_delay=.115
    last_shot=game_time
    recoil=1.0
    shot_anim_ends=game_time+.16
    fps_anim_name=""
    _play_rig_anim("shot")
    if is_instance_valid(muzzle):muzzle.light_energy=5.4
    if is_instance_valid(audio_gun) and audio_gun.stream!=null:
        audio_gun.pitch_scale=rng.randf_range(.94,1.06)
        audio_gun.play()
    neck.rotation.x=clampf(neck.rotation.x+.013,-1.40,1.4)
    var start=camera.global_position
    var end=start-camera.global_transform.basis.z*120
    var q=PhysicsRayQueryParameters3D.create(start,end)
    q.exclude=[player.get_rid()]
    var hit=get_world_3d().direct_space_state.intersect_ray(q)
    if not hit.is_empty():
        var target=hit["collider"]
        if target is CharacterBody3D and target.has_meta("hp") and not target.get_meta("ally"):
            _hurt_bot(target,32.0,player)
            hint_label.text="ПОПАДАНИЕ +32"
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
    if reload_time<=0 and mag<30 and reserve>0:
        reload_time=2.3
        _play_rig_anim("reload")
        hint_label.text="ПЕРЕЗАРЯДКА..."

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseMotion and running and Input.mouse_mode==Input.MOUSE_MODE_CAPTURED:
        player.rotate_y(-event.relative.x*MOUSE_SENS)
        neck.rotate_x(-event.relative.y*MOUSE_SENS)
        neck.rotation.x=clampf(neck.rotation.x,-1.4,1.4)
    if event is InputEventKey and event.pressed and not event.echo:
        if event.physical_keycode==KEY_ESCAPE:
            if running:
                Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
                running=false
                _show_menu()
            return
        if running:
            if event.physical_keycode==KEY_R:_reload()
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

func _create_ui() -> void:
    ui=CanvasLayer.new()
    ui.layer=10
    add_child(ui)
    hud=Control.new()
    hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.mouse_filter=Control.MOUSE_FILTER_IGNORE
    ui.add_child(hud)
    top_label=_make_label(hud,"CONTACT ZERO",24,Color("e7f2f7"))
    top_label.position=Vector2(36,20)
    info_label=_make_label(hud,"5 v 5",19,Color("f0ac7b"))
    info_label.position=Vector2(36,51)
    hp_label=_make_label(hud,"100",22,Color("b2dfc6"))
    hp_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
    hp_label.position=Vector2(33,-70)
    ammo_label=_make_label(hud,"30 / 120",30,Color("eaf4f6"))
    ammo_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
    ammo_label.position=Vector2(-285,-78)
    hint_label=_make_label(hud,"",17,Color("f6d19b"))
    hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
    hint_label.position=Vector2(36,-105)
    cross=_make_label(hud,"+",30,Color("e5f8f7"))
    cross.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
    cross.position=Vector2(-9,-24)
    damage_flash=ColorRect.new()
    damage_flash.color=Color(1,.12,.1,0)
    damage_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    damage_flash.mouse_filter=Control.MOUSE_FILTER_IGNORE
    hud.add_child(damage_flash)
    cover=ColorRect.new()
    cover.color=Color(0.035,0.062,0.09,.98)
    cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    ui.add_child(cover)
    panel=VBoxContainer.new()
    panel.custom_minimum_size=Vector2(520,430)
    panel.position=Vector2(70,115)
    cover.add_child(panel)
    title_label=_make_label(panel,"CONTACT ZERO",72,Color("f0f6fa"))
    subtitle_label=_make_label(panel,"REMASTERED   /   NATIVE WINDOWS BUILD",22,Color("ed9e72"))
    _make_label(panel,"",18,Color.WHITE)
    _make_label(panel,"ВЫБЕРИ КАРТУ И НАЧНИ МАТЧ 5 НА 5",24,Color("bed0dd"))
    for i in range(3):
        var b:=Button.new()
        b.text=["01   BASTION     — Крепость","02   NIGHTSHIFT — Ночной порт","03   RIDGE      — Снежная база"][i]
        b.custom_minimum_size=Vector2(510,66)
        b.add_theme_font_size_override("font_size",22)
        b.pressed.connect(_start_match.bind(i))
        panel.add_child(b)
    _make_label(panel,"",16,Color.WHITE)
    _make_label(panel,"WASD — движение   |   MOUSE — прицел   |   ЛКМ — огонь",16,Color("abbfcd"))
    _make_label(panel,"SHIFT — бег   |   CTRL — присесть   |   SPACE — прыжок",16,Color("abbfcd"))
    _make_label(panel,"R — перезарядка   |   ESC — меню",16,Color("abbfcd"))

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
    mag=30
    reserve=150
    reload_time=0
    round_time=180
    running=true
    cover.hide()
    hud.show()
    hint_label.text="КОМАНДА: СИНИЕ · УСТРАНИ 5 ПРОТИВНИКОВ"
    Input.mouse_mode=Input.MOUSE_MODE_CAPTURED

func _finish(message: String) -> void:
    running=false
    cover.show()
    title_label.text="РАУНД ОКОНЧЕН"
    subtitle_label.text=message
    hud.hide()
    Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
