extends SceneTree
func _initialize() -> void:
    call_deferred("_capture")
func _capture() -> void:
    var game=load("res://main.tscn").instantiate()
    root.add_child(game)
    await process_frame
    game._start_match(4)
    await create_timer(1.5).timeout
    game.running=false
    var points=[
        {"pos":Vector3(0,1.2,25),"yaw":.05,"pitch":-.04},
        {"pos":Vector3(-27,1.2,5),"yaw":.01,"pitch":-.03},
        {"pos":Vector3(27,1.2,5),"yaw":.0,"pitch":-.03},
        {"pos":Vector3(-9,1.2,-10),"yaw":1.6,"pitch":-.045}
    ]
    for i in range(4):
        var p=points[i]
        game.player.global_position=p["pos"]
        game.player.rotation.y=p["yaw"]
        game.neck.rotation.x=p["pitch"]
        await create_timer(.45).timeout
        var im=root.get_texture().get_image()
        im.save_png("res://build/CONTACT_ZERO_candidate_"+str(i+1)+".png")
        print("V5_FINAL_RENDER_OK "+str(i))
    root.get_texture().get_image().save_png("res://build/CONTACT_ZERO_qa.png")
    quit()
