extends SceneTree
# Visual quality gate: real in-engine scene capture on EVERY map.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var packed=load("res://main.tscn")
    var game=packed.instantiate()
    root.add_child(game)
    await process_frame
    for i in range(4):
        game._start_match(i)
        await create_timer(1.1).timeout
        game.running=false
        # Every map is photographed at its actual player spawn.
        # Never substitute promo renders for actual playable frames.
        game.player.rotation.y=.14
        game.neck.rotation.x=-.06
        await create_timer(.35).timeout
        var screen=root.get_texture().get_image()
        var path="res://build/CONTACT_ZERO_candidate_"+str(i+1)+".png"
        screen.save_png(path)
        print("MAP_RENDER_OK "+str(i)+" "+str(screen.get_width())+"x"+str(screen.get_height()))
    root.get_texture().get_image().save_png("res://build/CONTACT_ZERO_qa.png")
    quit()
