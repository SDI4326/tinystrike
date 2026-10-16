extends SceneTree
func _initialize() -> void:
    call_deferred("_capture")
func _capture() -> void:
    var game=load("res://main.tscn").instantiate()
    root.add_child(game)
    await process_frame
    game._start_match(4)
    await create_timer(1.4).timeout
    game.running=false
    game.player.global_position=Vector3(0,1.2,24)
    game.player.rotation.y=0.05
    game.neck.rotation.x=-.035
    var trials=[
        {"r":Vector3(-.3,-.25,-.1),"p":Vector3(.25,-.18,-.75),"s":.70},
        {"r":Vector3(-.4,-.10,-.1),"p":Vector3(.27,-.20,-.79),"s":.70},
        {"r":Vector3(-.42,-.57,-.1),"p":Vector3(.29,-.20,-.80),"s":.70},
        {"r":Vector3(-.45,-.85,-.1),"p":Vector3(.30,-.20,-.80),"s":.70}
    ]
    for i in range(4):
        var trial=trials[i]
        game.gun_mesh.rotation=trial["r"]
        game.gun_mesh.position=trial["p"]
        game.gun_mesh.scale=Vector3.ONE*float(trial["s"])
        await create_timer(.6).timeout
        var img=root.get_texture().get_image()
        img.save_png("res://build/CONTACT_ZERO_candidate_"+str(i+1)+".png")
        print("RIG_VARIANT "+str(i)+" rotation="+str(trial["r"]))
    root.get_texture().get_image().save_png("res://build/CONTACT_ZERO_qa.png")
    quit()
