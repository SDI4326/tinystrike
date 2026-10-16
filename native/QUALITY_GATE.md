# CONTACT ZERO v4 — internal visual / gameplay quality gate

Status: **NOT APPROVED FOR PUBLIC RELEASE**.

## Evidence from Godot desktop captures
Verified on GitHub Actions run 38939027659 (2026-10-16).
- Gameplay loads in 1280×720 without syntax/runtime errors.
- Four map images visually inspected: BASTION, NIGHTSHIFT, RIDGE, COMPOUND.
- Procedural rooms and giant rectangular covers are too crude for a CS:GO-like tactical FPS.
- Weapon rig is structurally intact but its on-screen orientation/framing and animation blending need dedicated polish.
- Character silhouettes and animations feel stylized and lack equipped third-person firearms.
- Environment lighting, materials, clutter and sky do not yet reach acceptable consistency.
- The special COMPOUND arena has geometry/props but the bots and map composition still look like a prototype.

## Implemented and tested in v4
- Collision-grid A* pathfinding and target selection for bots on all 4 maps.
- Bomb planting by attacking team, 40-second timer, manual five-second CT defuse.
- Basic HUD objective status, economy/guns and grenades preserved.
- Repaired missing Kenney industrial colormap.
- COMPOUND arena with independent two-lane design and collision geometry.
- Godot headless QA passes all four map load tests, pathfinding, six guns, grenade spawning, bomb plant and defuse.

## Minimum gate for any new download link
1. **Visual:** a real in-engine capture of menu, all maps, hands, weapon variants and NPCs. No missing textures, giant/rotated meshes or blocky placeholders. The scene must be evaluated against tactical FPS references, not just compiled successfully.
2. **Interaction:** full round loop (buy phase, objectives, death/spectating, next round), responsive weapons and reloading, third-person bot weapons, aim, tactical bot movement, grenade effects.
3. **QA:** Windows native executable starts without external installers, 60-second game test, no runtime errors, screenshots assessed manually, and all automated core gameplay tests green.

Do not publish development ZIP as CONTACT ZERO 'ready' until the above gates are passed.
