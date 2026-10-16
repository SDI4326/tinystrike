extends Control
# Resolution-independent reticle that expands under recoil/movement and narrows when aiming.
var spread := 5.0
var hit_flash := 0.0
var dot := true
var lines := true
var scope := false

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    process_mode = Node.PROCESS_MODE_ALWAYS

func _process(delta: float) -> void:
    hit_flash=maxf(0.0,hit_flash-delta)
    queue_redraw()

func _draw() -> void:
    var mid=get_viewport_rect().size*.5
    var tone=Color("ffd19b") if hit_flash>0 else Color("d7f3e8")
    var black=Color(0.02,0.07,0.08,.88)
    var gap=6.0+spread
    var arm=8.0
    if scope:
        draw_circle(mid,2.1,tone)
        for a in range(4):
            var rot=float(a)*PI*.5
            var ray=Vector2(cos(rot),sin(rot))
            draw_line(mid+ray*10.0,mid+ray*minf(get_viewport_rect().size.x,700.0)*.38,black,3.2)
            draw_line(mid+ray*10.0,mid+ray*minf(get_viewport_rect().size.x,700.0)*.38,tone,1.2)
        return
    if dot:draw_circle(mid,1.65,tone)
    if lines:
        for a in range(4):
            var rot=float(a)*PI*.5
            var v=Vector2(cos(rot),sin(rot))
            draw_line(mid+v*(gap-.8),mid+v*(gap+arm+.9),black,4.0,true)
            draw_line(mid+v*gap,mid+v*(gap+arm),tone,2.0,true)
    if hit_flash>0.0:
        var s=9.0
        for a in range(4):
            var xx=float(-1 if a%2==0 else 1)
            var yy=float(-1 if a/2<1 else 1)
            draw_line(mid+Vector2(xx*7.0,yy*7.0),mid+Vector2(xx*13.5,yy*13.5),Color("ff905e"),2.0,true)
