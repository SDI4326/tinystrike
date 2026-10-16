extends SceneTree

func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var packed=load("res://main.tscn")
    var game=packed.instantiate()
    root.add_child(game)
    await process_frame
    game._start_match(4)
    await create_timer(1.6).timeout
    game.running=false
    var shots=[
        {"pos":Vector3(0,1.2,36),"yaw":0.0,"pitch":-.03},
        {"pos":Vector3(-27,1.2,7),"yaw":0.0,"pitch":-.04},
        {"pos":Vector3(27,1.2,7),"yaw":0.0,"pitch":-.04},
        {"pos":Vector3(-9,1.2,-10),"yaw":1.6,"pitch":-.025}
    ]
    for i in range(shots.size()):
        var data=shots[i]
        game.player.global_position=data["pos"]
        game.player.rotation.y=data["yaw"]
        game.neck.rotation.x=data["pitch"]
        await create_timer(.45).timeout
        var img=root.get_texture().get_image()
        img.save_png("res://build/CONTACT_ZERO_candidate_"+str(i+1)+".png")
        print("RENDER_V5_OK ",i," ",img.get_width(),"x",img.get_height())
    root.get_texture().get_image().save_png("res://build/CONTACT_ZERO_qa.png")
    quit()
