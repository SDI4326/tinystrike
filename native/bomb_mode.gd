extends RefCounted
# Contact Zero tactical round objective: attacker plants, defender defuses.
# Standalone runtime logic so it can be unit-tested without a renderer.
var stage := 0 # 0 carrying / 1 armed / 2 defused / 3 detonated
var site_a := Vector3.ZERO
var site_b := Vector3.ZERO
var active_site := Vector3.ZERO
var timer := 40.0
var plant_progress := 0.0
var defuse_progress := 0.0
var carrier:CharacterBody3D
var model:Node3D
var bomb_light:OmniLight3D
var owner:Node3D

func setup(world:Node3D,which:int) -> void:
    owner=world
    stage=0
    timer=40.0
    plant_progress=0
    defuse_progress=0
    carrier=null
    site_a=Vector3(-13.3,0,0) if which==3 else Vector3(-18,0,-9)
    site_b=Vector3(13.3,0,3) if which==3 else Vector3(18,0,10)
    active_site=site_a
    for site_id in range(2):
        var pos=site_a if site_id==0 else site_b
        var marker=Node3D.new()
        marker.name="BOMBSITE_A" if site_id==0 else "BOMBSITE_B"
        marker.position=pos
        world.add_child(marker)
        var art=MeshInstance3D.new()
        var disk=CylinderMesh.new()
        disk.top_radius=2.6
        disk.bottom_radius=2.6
        disk.height=.035
        disk.radial_segments=40
        art.mesh=disk
        var mat=StandardMaterial3D.new()
        mat.albedo_color=Color(.81,.48,.15,.34) if site_id==0 else Color(.20,.60,.75,.34)
        mat.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
        mat.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
        art.material_override=mat
        art.position.y=.025
        marker.add_child(art)
        var sign=Label3D.new()
        sign.text="A" if site_id==0 else "B"
        sign.font_size=40
        sign.pixel_size=.02
        sign.position=Vector3(0,1.1,0)
        sign.billboard=BaseMaterial3D.BILLBOARD_ENABLED
        sign.modulate=Color("ffc98b") if site_id==0 else Color("9adfff")
        marker.add_child(sign)
    model=Node3D.new()
    model.name="ARMED_BOMB"
    world.add_child(model)
    var box=MeshInstance3D.new()
    var sh=BoxMesh.new()
    sh.size=Vector3(.48,.16,.30)
    box.mesh=sh
    var surface=StandardMaterial3D.new()
    surface.albedo_color=Color("39454a")
    surface.metallic=.36
    box.material_override=surface
    model.add_child(box)
    var keypad=MeshInstance3D.new()
    var panel=BoxMesh.new()
    panel.size=Vector3(.27,.025,.17)
    keypad.mesh=panel
    keypad.position.y=.10
    var green=StandardMaterial3D.new()
    green.albedo_color=Color("4ec4af")
    green.emission_enabled=true
    green.emission=Color("38b3b1")
    green.emission_energy_multiplier=1.4
    keypad.material_override=green
    model.add_child(keypad)
    bomb_light=OmniLight3D.new()
    bomb_light.omni_range=5.2
    bomb_light.light_color=Color("f6675c")
    bomb_light.light_energy=0
    model.add_child(bomb_light)
    model.visible=false

func set_carrier(bots:Array) -> void:
    if stage!=0:return
    if is_instance_valid(carrier) and not carrier.is_queued_for_deletion():return
    carrier=null
    for bot in bots:
        if is_instance_valid(bot) and not bot.is_queued_for_deletion() and not bool(bot.get_meta("ally",true)):
            carrier=bot
            break

func tick(delta:float,player:CharacterBody3D,bots:Array,holding_e:bool)->String:
    if stage==2 or stage==3:return ""
    if stage==0:
        set_carrier(bots)
        if not is_instance_valid(carrier):return ""
        var position=carrier.global_position
        var in_a=position.distance_to(site_a)<3.1
        var in_b=position.distance_to(site_b)<3.1
        if in_a or in_b:
            active_site=site_a if in_a else site_b
            plant_progress+=delta
            if plant_progress>=3.2:
                stage=1
                timer=40.0
                model.global_position=active_site+Vector3(0,.20,0)
                model.visible=true
                print("BOMB_PLANTED site=",("A" if in_a else "B"))
        else:
            plant_progress=maxf(0,plant_progress-delta*.65)
    elif stage==1:
        timer=maxf(0,timer-delta)
        if is_instance_valid(bomb_light):
            bomb_light.light_energy=4.0 if fmod(timer*2.1,1.0)<.2 else .0
        var nearby=is_instance_valid(player) and player.global_position.distance_to(active_site)<2.7
        if nearby and holding_e:
            defuse_progress+=delta
            if defuse_progress>=5.0:
                stage=2
                model.visible=false
                print("BOMB_DEFUSED")
                return "defused"
        else:
            defuse_progress=maxf(0,defuse_progress-delta*.7)
        if timer<=0:
            stage=3
            print("BOMB_DETONATED")
            return "detonated"
    return ""
