extends SceneTree

func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var game=load("res://main.tscn").instantiate()
    root.add_child(game)
    await process_frame
    game._start_match(0)
    await create_timer(2.5).timeout
    game.player.rotation.y=0.15
    game.neck.rotation.x=-.035
    await create_timer(.7).timeout
    var img=root.get_texture().get_image()
    img.save_png("res://build/CONTACT_ZERO_qa.png")
    print("RENDER_QA ",img.get_width(),"x",img.get_height())
    quit()
