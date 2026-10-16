extends RefCounted
## Local A* navigation for player-size bots, built from ACTUAL collision meshes.
## No player-specific shortcuts: on every map bots plan through free lanes,
## can approach targets behind cover, and re-plan as opponents move.

const CELL := 1.0
const MIN_INDEX := -39
const MAX_INDEX := 39
var grid: AStarGrid2D
var blocked_total := 0
var counted_colliders := 0

func _cell(p: Vector3) -> Vector2i:
    return Vector2i(clampi(roundi(p.x / CELL),MIN_INDEX,MAX_INDEX),
                    clampi(roundi(p.z / CELL),MIN_INDEX,MAX_INDEX))

func _nearest_open(pos: Vector2i) -> Vector2i:
    if grid.is_in_boundsv(pos) and not grid.is_point_solid(pos):
        return pos
    for radius in range(1,9):
        for dz in range(-radius,radius+1):
            for dx in range(-radius,radius+1):
                if absi(dx)!=radius and absi(dz)!=radius:continue
                var pt=pos+Vector2i(dx,dz)
                if grid.is_in_boundsv(pt) and not grid.is_point_solid(pt):
                    return pt
    return pos

func build(world:Node3D) -> void:
    grid=AStarGrid2D.new()
    grid.region=Rect2i(Vector2i(MIN_INDEX,MIN_INDEX),
                       Vector2i(MAX_INDEX-MIN_INDEX+1,MAX_INDEX-MIN_INDEX+1))
    grid.cell_size=Vector2.ONE*CELL
    grid.offset=Vector2.ZERO
    grid.diagonal_mode=AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
    grid.update()
    counted_colliders=0
    blocked_total=0
    for body in world.find_children("*","StaticBody3D",true,false):
        if not body is StaticBody3D:continue
        for col in body.get_children():
            if not col is CollisionShape3D:continue
            if not col.shape is BoxShape3D:continue
            var size=(col.shape as BoxShape3D).size
            var b=col.global_transform.basis
            var half=size*.5
            var center=col.global_position
            var vy=absf(b.x.y)*half.x+absf(b.y.y)*half.y+absf(b.z.y)*half.z
            # Ground geometry never blocks a horizontal navigation cell.
            if center.y+vy < .8 or center.y-vy>1.9:continue
            var vx=absf(b.x.x)*half.x+absf(b.y.x)*half.y+absf(b.z.x)*half.z+.62
            var vz=absf(b.x.z)*half.x+absf(b.y.z)*half.y+absf(b.z.z)*half.z+.62
            var lo_x=clampi(floori((center.x-vx)/CELL),MIN_INDEX,MAX_INDEX)
            var hi_x=clampi(ceili((center.x+vx)/CELL),MIN_INDEX,MAX_INDEX)
            var lo_z=clampi(floori((center.z-vz)/CELL),MIN_INDEX,MAX_INDEX)
            var hi_z=clampi(ceili((center.z+vz)/CELL),MIN_INDEX,MAX_INDEX)
            counted_colliders+=1
            for gx in range(lo_x,hi_x+1):
                for gz in range(lo_z,hi_z+1):
                    var cell=Vector2i(gx,gz)
                    if not grid.is_point_solid(cell):
                        blocked_total+=1
                        grid.set_point_solid(cell,true)
    # Spawns must be reachable even if placed near small props.
    for spawn in [Vector2i(0,28),Vector2i(0,-28),Vector2i(-5,24),Vector2i(5,-24)]:
        for dx in range(-2,3):
            for dz in range(-2,3):
                var q=spawn+Vector2i(dx,dz)
                if grid.is_in_boundsv(q):
                    grid.set_point_solid(q,false)
    print("NAV_GRID_READY obstacles=",counted_colliders," blocked_cells=",blocked_total)

func route(start:Vector3,goal:Vector3) -> PackedVector2Array:
    var route_points=PackedVector2Array()
    if grid==null:return route_points
    var from=_nearest_open(_cell(start))
    var to=_nearest_open(_cell(goal))
    if not grid.is_in_boundsv(from) or not grid.is_in_boundsv(to):
        return route_points
    var result=grid.get_point_path(from,to,true)
    for p in result:
        route_points.append(p)
    return route_points

func can_reach(start:Vector3,goal:Vector3) -> bool:
    return route(start,goal).size()>=2
