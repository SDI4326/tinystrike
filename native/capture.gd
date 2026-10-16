extends SceneTree

func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var game=load("res://main.tscn").instantiate()
    root.add_child(game)
    await process_frame
    game._start_match(0)
    await create_timer(1.1).timeout
    game.running=false
    game.player.position=Vector3(4.0,1.1,27.0)
    game.player.rotation.y=0.14
    game.neck.rotation.x=-.06
    var variants=[
        {"r":Vector3(-.31,-.57,-.10),"p":Vector3(.09,-.14,-.72),"base":Vector3(.31,-.27,-.66)},
        {"r":Vector3(-.40,.10,-.10),"p":Vector3(.14,-.03,-.80),"base":Vector3(.31,-.19,-.66)},
        {"r":Vector3(-.45,.55,-.08),"p":Vector3(.20,.02,-.90),"base":Vector3(.31,-.17,-.66)},
        {"r":Vector3(-.45,-1.10,-.12),"p":Vector3(.20,.0,-.92),"base":Vector3(.31,-.18,-.66)}
    ]
    for i in range(variants.size()):
        var v=variants[i]
        game.gun_mesh.rotation=v["r"]
        game.gun_mesh.position=v["p"]
        game.gun_root.position=v["base"]
        await create_timer(.55).timeout
        var img=root.get_texture().get_image()
        img.save_png("res://build/CONTACT_ZERO_candidate_"+str(i+1)+".png")
        print("RENDER_CANDIDATE ",i+1," ",img.get_width(),"x",img.get_height())
    var image=root.get_texture().get_image()
    image.save_png("res://build/CONTACT_ZERO_qa.png")
    quit()
