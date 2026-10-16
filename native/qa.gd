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
    for mode in range(4):
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
        if not is_instance_valid(game.nav_grid) or (game.nav_grid.counted_colliders<10 and mode!=3):
            push_error("QA: Navigation grid missing colliders on map "+str(mode))
            quit(1)
            return
        var route=game.nav_grid.route(Vector3(0,1.2,9),Vector3(0,1.2,-9)) if mode==3 else game.nav_grid.route(Vector3(0,1.2,27),Vector3(0,1.2,-27))
        if route.size()<5:
            push_error("QA: No A* walking route through map "+str(mode))
            quit(1)
            return
        if mode==3 and game.nav_grid.counted_colliders<25:
            push_error("QA: Missing COMPOUND tactical geometry")
            quit(1)
            return
        print("QA_NAV_OK map=",mode," waypoints=",route.size()," obstacles=",game.nav_grid.counted_colliders)
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
    if not is_instance_valid(game.bomb) or not is_instance_valid(game.bomb.carrier):
        push_error("QA: No enemy bomb carrier")
        quit(1)
        return
    game.running=false
    var planted_bomber=game.bomb.carrier
    planted_bomber.global_position=game.bomb.site_a+Vector3(0,1.2,0)
    game.bomb.tick(3.5,game.player,game.bots,false)
    if game.bomb.stage!=1 or not game.bomb.model.visible:
        push_error("QA: Bomb could not be planted")
        quit(1)
        return
    game.player.global_position=game.bomb.site_a+Vector3(0,1.2,0)
    var defused=game.bomb.tick(5.05,game.player,game.bots,true)
    if defused!="defused" or game.bomb.stage!=2:
        push_error("QA: Hold E defusal failed")
        quit(1)
        return
    print("QA_BOMB_OK plant=3.2s defuse=5.0s fuse=40s")
    # NEW: the player's actual CharacterBody must physically advance on the
    # primary route.  An A* path by itself does not prove a walkable map.
    game._start_match(4)
    await process_frame
    await process_frame
    game.running=false
    if game.map_id!=4 or game.nav_grid.counted_colliders<25:
        push_error("V5: IRONWORKS did not construct")
        quit(1)
        return
    var start=game.player.global_position
    for n in range(95):
        await physics_frame
        game.player.velocity=Vector3(0,-.5,-7.5)
        game.player.move_and_slide()
    var moved=start.z-game.player.global_position.z
    if moved<8.5:
        push_error("V5: player stuck in geometry after "+str(moved)+" metres")
        quit(1)
        return
    print("QA_PLAYER_WALK_OK distance_m=",snappedf(moved,.01))
    for lane_x in [-27.,0.,27.]:
        var lane=game.nav_grid.route(Vector3(lane_x,1.2,36),Vector3(lane_x,1.2,-36))
        if lane.size()<45:
            push_error("V5: flank or middle blocked x="+str(lane_x)+" waypoints="+str(lane.size()))
            quit(1)
            return
        print("QA_FULL_LANE_OK x=",lane_x," path_cells=",lane.size())
    for site in [game.bomb.site_a,game.bomb.site_b]:
        var route=game.nav_grid.route(Vector3(0,1.2,36),site)
        if route.size()<12:
            push_error("V5: can't reach bombsite "+str(site))
            quit(1)
            return
        print("QA_BOMBSITE_REACHABLE ",site)
    print("NATIVE_QA_SUCCESS 5 maps, IRONWORKS real player walking + 3 traversable lanes, 6 guns, grenades, bomb, menu, bots")


    quit(0)
