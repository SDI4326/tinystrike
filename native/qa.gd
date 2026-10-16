extends SceneTree
# Non-interactive launch + game-world checks. Runs on the actual Godot engine.
func _initialize() -> void:
    call_deferred("_verify")

func _verify() -> void:
    var scene_resource=load("res://main.tscn")
    if not scene_resource is PackedScene:
        push_error("QA: Main scene not imported")
        quit(1)
        return
    var game=scene_resource.instantiate()
    root.add_child(game)
    await process_frame
    await process_frame
    for mode in range(3):
        game._start_match(mode)
        await process_frame
        await process_frame
        await create_timer(.25).timeout
        if not game.running:
            push_error("QA: Game could not start "+str(mode))
            quit(1)
            return
        if game.bots.size()!=9:
            push_error("QA: Expected 9 bot combatants, got "+str(game.bots.size()))
            quit(1)
            return
        if not game.using_authored_rig:
            push_error("QA: Author-created first-person hands and AK-74M were not loaded")
            quit(1)
            return
        if game.player==null or game.camera==null or game.scene_root==null:
            push_error("QA: Player/camera/world missing")
            quit(1)
            return
        print("QA_MAP_OK ",mode," bots=",game.bots.size()," rig=",game.using_authored_rig)
        game._shoot()
        await process_frame
        if game.mag!=29:
            push_error("QA: Weapon firing failed")
            quit(1)
            return
        game._reload()
        if game.reload_time<=0:
            push_error("QA: Reload did not start")
            quit(1)
            return
        game.running=false
    game._start_match(0)
    await process_frame
    await process_frame
    for i in range(6):
        game._equip(i)
        await process_frame
        if not is_instance_valid(game.gun_mesh):
            push_error("QA: Weapon model missing "+str(i))
            quit(1)
            return
        var capacity=int(game.GUNS[i]["mag"])
        if game.mag!=capacity:
            push_error("QA: Wrong magazine "+str(i))
            quit(1)
            return
        game.fire_delay=0.0
        game._shoot()
        if game.mag!=capacity-1:
            push_error("QA: Gun failed to fire "+str(i))
            quit(1)
            return
        game._reload()
        if game.reload_time<=0:
            push_error("QA: Gun failed reload "+str(i))
            quit(1)
            return
        print("QA_GUN_OK ",i," model=",game.GUNS[i]["model"])
    game.grenade_time=0.0
    game._grenade_throw(false)
    if game.projectiles.size()!=1:
        push_error("QA: Frag grenade failed")
        quit(1)
        return
    game.grenade_time=0.0
    game._grenade_throw(true)
    if game.projectiles.size()!=2:
        push_error("QA: Smoke grenade failed")
        quit(1)
        return
    if not is_instance_valid(game.crosshair_ui) or not is_instance_valid(game.buy_overlay):
        push_error("QA: HUD reticle or buy menu missing")
        quit(1)
        return
    print("NATIVE_QA_SUCCESS 3 maps, 6 guns, 2 grenade types, reticle, menu, animations, shooting, reload, bots")
    quit(0)
