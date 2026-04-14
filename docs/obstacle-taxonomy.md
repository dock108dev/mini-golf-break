# Obstacle Taxonomy Reference

Canonical reference for all mechanic types available in the mini-golf-break hole designer toolkit. Each mechanic is a self-contained component registered via `MechanicRegistry` and instantiated from hole config data by `HoleEntity`.

**Coordinate system**: Positions use `[x, y, z]` arrays hydrated to `THREE.Vector3`. X = lateral, Y = vertical (up), Z = depth. All dimensions are in game units. Surface height (`surfaceHeight`) is passed to each mechanic at construction time.

---

## Structural Mechanics

### bank_wall

- **Gameplay purpose**: Angled wall segments for intentional bank shots. Teaches players to use ricochet angles rather than direct shots. Creates routing puzzles where the direct path is blocked.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `segments` | `Array<{ start: [x,y,z], end: [x,y,z] }>` | yes | | Wall segment endpoints |
  | `height` | `number` | no | `0.6` | Wall height above surface |
  | `thickness` | `number` | no | `0.15` | Wall thickness |
  | `restitution` | `number` | no | `0.8` | Bounce coefficient (visual hint only; physics uses world bumperMaterial) |
  | `color` | `number` | no | `0x6666aa` | Wall color |

- **Placement rules**: Place walls to block the direct tee-to-cup line, forcing bank shots. Wall endpoints use world coordinates relative to the hole group origin. Ensure walls do not overlap boundary walls or other mechanics.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `height` | 0.3 | 1.0 | Below 0.3: ball can hop over. Above 1.0: visually heavy |
  | `thickness` | 0.1 | 0.3 | Below 0.1: tunneling risk. Above 0.3: eats playable space |
  | `restitution` | 0.5 | 1.0 | Used in configs at 0.85-0.9 |

- **Common pitfalls**: The `restitution` field in config is not directly applied to the physics body; the world's `bumperMaterial` governs actual bounce. Changing this value only affects the config record, not gameplay. To change actual bounce behavior, modify the contact material in `PhysicsWorld`.

- **Example config snippet**:
  ```js
  {
    type: 'bank_wall',
    restitution: 0.85,
    segments: [
      { start: [-3, 0, -2], end: [0, 0, 2] },
      { start: [0, 0, 2], end: [3, 0, -1] }
    ]
  }
  ```

---

### split_route

- **Gameplay purpose**: Dividing walls that create two or more alternate paths from tee to cup. Forces the player to choose a route, adding strategic depth. Best used with one "safe but long" path and one "risky but short" path.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `walls` | `Array<{ start: [x,y,z], end: [x,y,z] }>` | yes | | Wall segment endpoints |
  | `height` | `number` | no | `0.8` | Wall height |
  | `thickness` | `number` | no | `0.15` | Wall thickness |
  | `color` | `number` | no | `0x8888aa` | Wall color |

- **Placement rules**: Position divider walls to create distinct lanes. Each lane must be wide enough for the ball to pass (minimum 1.5 units). Both routes must reach the cup area. Place the split early in the hole so the player sees the choice from the tee.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `height` | 0.5 | 1.2 | Standard is 0.8 across all configs |
  | `thickness` | 0.1 | 0.3 | Same constraints as bank_wall |

- **Common pitfalls**: Creating routes where one path is strictly better than the other defeats the purpose. Both paths should have different risk/reward tradeoffs. Ensure wall endpoints connect to boundary walls or other obstacles so the ball cannot slip around the divider.

- **Example config snippet**:
  ```js
  {
    type: 'split_route',
    height: 0.8,
    walls: [
      { start: [0, 0, -4], end: [0, 0, 4] }
    ]
  }
  ```

---

### elevated_green

- **Gameplay purpose**: Raised platform with ramp access, adding vertical challenge. The player must hit the ball up a ramp to reach the elevated surface. Teaches power control on inclines.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `platform` | `{ position: [x,y,z], width: number, length: number }` | yes | | Platform dimensions and center |
  | `elevation` | `number` | no | `0.5` | Height above base surface |
  | `ramp` | `{ start: [x,y,z], end: [x,y,z], width: number }` | yes | | Ramp connection points and width |
  | `color` | `number` | no | `0x2ecc71` | Platform surface color |

- **Placement rules**: Position the ramp start at surface level and the ramp end at the platform edge. The platform should be placed where the cup or a key waypoint sits. Ramp width must be at least 2x ball diameter (0.4 units) for comfortable play.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `elevation` | 0.3 | 3.0 | Clamped internally by MAX_RAMP_ANGLE (30 degrees) |
  | `platform.width` | 3.0 | 10.0 | Used at 5-8 in configs |
  | `platform.length` | 2.0 | 8.0 | Used at 3-6 in configs |
  | `ramp.width` | 1.5 | 5.0 | Used at 2.5-4.0 in configs |

- **Common pitfalls**: Setting elevation too high relative to ramp length triggers the MAX_RAMP_ANGLE clamp (30 degrees / pi/6). The actual elevation will be silently reduced to `tan(30) * rampHorizontalLength`. Always verify the effective elevation matches intent. Side rails (height 0.3, thickness 0.1) are added automatically to prevent the ball from rolling off the ramp edges.

- **Example config snippet**:
  ```js
  {
    type: 'elevated_green',
    elevation: 0.5,
    platform: { position: [0, 0.5, -3], width: 6, length: 4 },
    ramp: { start: [0, 0, 1], end: [0, 0.5, -1], width: 3 }
  }
  ```

---

### multi_level_ramp

- **Gameplay purpose**: Traversable elevation ramp connecting two different height levels. Simpler than `elevated_green` when only a ramp is needed without a full platform. Useful for connecting sections at different elevations.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `startPosition` | `[x,y,z]` | yes | | Ramp base position |
  | `endPosition` | `[x,y,z]` | yes | | Ramp top position |
  | `width` | `number` | no | `1.2` | Ramp width |
  | `sideWalls` | `boolean` | no | `true` | Whether to add guard rails |
  | `surfaceColor` | `number` | no | `0x4a90d9` | Ramp surface color |

- **Placement rules**: Place between two areas at different elevations. The ramp auto-calculates angle from the height difference between start and end positions. Works for both ascending and descending directions. Ensure the ramp connects to walkable surfaces at both ends.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `width` | 0.8 | 3.0 | Default 1.2. Below 0.8: ball may miss the ramp |
  | elevation difference | 0.2 | 3.0 | Clamped by MAX_RAMP_ANGLE (30 degrees) |

- **Common pitfalls**: Same MAX_RAMP_ANGLE (30 degrees) clamp as `elevated_green`. If the height difference exceeds `tan(30) * horizontalDistance`, the effective elevation is silently reduced. Disabling `sideWalls` on narrow ramps risks the ball rolling off the edge.

- **Example config snippet**:
  ```js
  {
    type: 'multi_level_ramp',
    startPosition: [0, 0, 2],
    endPosition: [0, 1.0, -2],
    width: 1.5,
    sideWalls: true
  }
  ```

---

### disappearing_platform

- **Gameplay purpose**: Timed floor segments that fade in and out, creating timing-based traversal challenges. The player must time their shot to cross while platforms are solid. Combines spatial and temporal skill.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `platforms` | `Array<PlatformConfig>` | yes | | Array of platform definitions |
  | `platforms[].position` | `[x,y,z]` | yes | | Platform center |
  | `platforms[].size` | `[width, height, depth]` | no | `[2, 0.15, 2]` | Platform dimensions |
  | `platforms[].onDuration` | `number` | no | `3` | Seconds visible and solid |
  | `platforms[].offDuration` | `number` | no | `2` | Seconds invisible |
  | `platforms[].offset` | `number` | no | `0` | Timer offset for staggering |
  | `hazardBelowY` | `number` | no | `surfaceHeight - 2` | Y-level that triggers ball reset |

- **Placement rules**: Use over gaps or voids where the ball needs a temporary surface. Stagger `offset` values across platforms to create a crossing sequence. Place at least two platforms in sequence so the player learns the timing on the first before committing on the second.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `onDuration` | 1.5 | 5.0 | Used at 2.0 in configs. Below 1.5: too punishing |
  | `offDuration` | 1.0 | 3.0 | Used at 1.5 in configs |
  | `offset` | 0 | sum of on+off durations | Stagger relative to cycle length |
  | `size[0]` (width) | 2.0 | 6.0 | Used at 4.0 in configs |
  | `size[2]` (depth) | 1.5 | 4.0 | Used at 2.0 in configs |

- **Common pitfalls**: Collision is only active when `fadeProgress >= 1` (fully visible). During the 0.2s fade-in period, the platform is visible but not solid. Players may perceive this as unfair if the fade duration is too long. An amber warning pulse appears 0.3s before disappearing; design timing so this warning is visible to the player.

- **Example config snippet**:
  ```js
  {
    type: 'disappearing_platform',
    platforms: [
      { position: [-2, 0, 0], size: [4, 0.15, 2], onDuration: 2.0, offDuration: 1.5, offset: 0 },
      { position: [2, 0, -3], size: [4, 0.15, 2], onDuration: 2.0, offDuration: 1.5, offset: 1.0 }
    ]
  }
  ```

---

## Force Field Mechanics

### boost_strip

- **Gameplay purpose**: Directional force zone that accelerates the ball along a specific vector. Teaches players to use environmental forces to reach distant targets. Can enable shots that would otherwise require too much power.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Strip center |
  | `direction` | `[x,y,z]` | yes | | Normalized boost direction |
  | `force` | `number` | yes | | Force magnitude applied per frame |
  | `size` | `{ width: number, length: number }` | yes | | Strip dimensions |
  | `color` | `number` | no | `0x00ffaa` | Strip color |

- **Placement rules**: Align the strip's `direction` with the intended ball travel path. Place on straightaways where the player benefits from extra speed. Avoid placing near walls where the boosted ball would crash and lose control. The strip visual should clearly indicate direction to the player.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `force` | 4 | 14 | Used at 10-14 in configs. Above 14: ball becomes uncontrollable |
  | `size.width` | 1.0 | 5.0 | Used at 2-4 in configs |
  | `size.length` | 2.0 | 5.0 | Used at 3 in configs |

- **Common pitfalls**: The force is applied continuously every frame while the ball overlaps the zone. A long strip with high force can accelerate the ball beyond controllable speeds. Always test by rolling the ball through the strip at minimum power and verifying it does not overshoot the hole boundary. Sound has a 0.3s cooldown to prevent audio spam.

- **Example config snippet**:
  ```js
  {
    type: 'boost_strip',
    position: [0, 0, 0],
    direction: [0, 0, -1],
    force: 10,
    size: { width: 2, length: 3 }
  }
  ```

---

### bowl_contour

- **Gameplay purpose**: Radial gravity pull toward center, creating a funnel or crater effect. The ball curves toward the center when rolling near the bowl. Teaches players to account for curved trajectories and use the bowl shape to redirect shots.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Bowl center |
  | `radius` | `number` | yes | | Bowl influence radius |
  | `force` | `number` | yes | | Inward pull strength |
  | `color` | `number` | no | `0x887744` | Bowl tint color |

- **Placement rules**: Place at the center of curved sections or near the cup to create approach challenges. The bowl center should be visible from the tee so the player can plan for the curved trajectory. Avoid overlapping with other force fields (boost strips, suction zones) as combined forces produce unpredictable results.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 2.0 | 8.0 | Used at 6.0 in configs |
  | `force` | 1.0 | 5.0 | Used at 3.0 in configs. Above 5: ball orbits indefinitely |

- **Common pitfalls**: Force scales as `force * (distance / radius)`, meaning it is weakest at the center and strongest at the edge. This is the inverse of what players might expect. If the cup is at the bowl center, the ball may oscillate through the center rather than settling. Pair with sufficient surface friction or a suction zone at center to capture the ball.

- **Example config snippet**:
  ```js
  {
    type: 'bowl_contour',
    position: [0, 0, 0],
    radius: 6.0,
    force: 3.0
  }
  ```

---

### low_gravity_zone

- **Gameplay purpose**: Reduces effective gravity in a circular area, making the ball float and travel farther. Creates a floaty, space-like feel. Teaches players to use reduced power in low-gravity areas to avoid overshooting.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Zone center |
  | `radius` | `number` | yes | | Zone influence radius |
  | `gravityMultiplier` | `number` | yes | | Fraction of normal gravity (0.0-1.0) |
  | `color` | `number` | no | `0x44aaff` | Zone tint color |

- **Placement rules**: Place on sections where the player needs to modulate power. Works well before ramps or elevated areas where reduced gravity helps the ball climb. The visual disc should be clearly visible so the player knows the zone boundary.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 1.5 | 6.0 | Used at 3.5 in configs |
  | `gravityMultiplier` | 0.1 | 0.8 | Used at 0.2 in configs. Below 0.1: ball barely falls |

- **Common pitfalls**: The mechanic applies an upward counter-force equal to `mass * 9.81 * (1 - gravityMultiplier)`. At `gravityMultiplier: 0`, the ball experiences zero gravity and will never settle. Always use a value above 0.1. The zone only affects gravity, not lateral friction, so the ball still decelerates horizontally at the normal rate.

- **Example config snippet**:
  ```js
  {
    type: 'low_gravity_zone',
    position: [0, 0, -2],
    radius: 3.5,
    gravityMultiplier: 0.2
  }
  ```

---

### suction_zone

- **Gameplay purpose**: Pulls the ball toward center with force that increases as the ball gets closer (inverse of bowl_contour). Creates a black hole or drain effect. The player must either avoid the zone or use it strategically to curve toward the cup.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Zone center |
  | `radius` | `number` | yes | | Influence radius |
  | `force` | `number` | yes | | Maximum pull strength |
  | `color` | `number` | no | `0x6600cc` | Zone color |

- **Placement rules**: Place as a hazard near the intended shot path. Works well as a "black hole" obstacle the player must navigate around. If placed near the cup, it can serve as a helper that guides the ball in, but too strong a force traps the ball in orbit.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 1.5 | 6.0 | Used at 4.0 in configs |
  | `force` | 2.0 | 8.0 | Used at 5.0 in configs. Above 8: ball cannot escape |

- **Common pitfalls**: Force formula is `force * (1 - distance/radius)`, meaning maximum pull at the center and zero at the edge. This is the opposite of `bowl_contour`. Sleeping balls are woken when inside the zone, which can cause unexpected ball movement if the player has not yet taken their shot. A suction zone centered on the cup can make the hole too easy; offset it slightly to create a slingshot challenge.

- **Example config snippet**:
  ```js
  {
    type: 'suction_zone',
    position: [0, 0, -4],
    radius: 4.0,
    force: 5.0
  }
  ```

---

### gravity_funnel

- **Gameplay purpose**: Directional gravity pull that steers the ball toward an exit point. Unlike `suction_zone` (radial pull) or `bowl_contour` (radial inward), the gravity funnel applies a lateral corrective force that channels the ball along a specific direction. Creates a guided corridor effect.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,z]` or `[x,y,z]` | yes | | Zone center |
  | `exitPoint` | `[x,z]` or `[x,y,z]` | yes | | Target exit direction |
  | `radius` | `number` | no | `3` | Zone radius |
  | `force` | `number` | no | `2.0` | Lateral correction strength |
  | `funnelAngle` | `number` | no | `30` | Visual cone angle (degrees) |
  | `color` | `number` | no | `0x4488ff` | Zone color |

- **Placement rules**: Position with the exit point aimed toward the next waypoint or the cup. The arrow visual shows exit direction. Place on sections where the player needs help staying on course, or as a challenge that redirects shots off the intended line.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 2.0 | 8.0 | Used at 5-6 in configs |
  | `force` | 1.0 | 6.0 | Used at 4.0-5.0 in configs. Above 6: overrides player input |

- **Common pitfalls**: The funnel decomposes ball velocity into components parallel and perpendicular to the exit direction, then applies corrective force against the perpendicular component plus a 0.3x push-forward along the exit direction. High force values make the funnel feel like a rail rather than a guide. Force is only applied when the lateral component exceeds 0.001, preventing jitter when the ball is already aligned.

- **Example config snippet**:
  ```js
  {
    type: 'gravity_funnel',
    position: [0, 0],
    exitPoint: [0, -8],
    radius: 6,
    force: 5.0
  }
  ```

---

## Obstacle Mechanics

### moving_sweeper

- **Gameplay purpose**: Rotating arm obstacle that the player must time their shot around. The sweeper arm rotates continuously around a pivot point. Teaches timing and patience; the player waits for the arm to clear their shot line.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `pivot` | `[x,y,z]` | yes | | Rotation center |
  | `armLength` | `number` | yes | | Arm reach from pivot |
  | `speed` | `number` | yes | | Rotation speed in rad/s (positive = counterclockwise) |
  | `size` | `{ width: number, height: number, depth: number }` | yes | | Arm box dimensions |
  | `phase` | `number` | no | `0` | Initial rotation angle (radians) |
  | `color` | `number` | no | `0xff4444` | Arm color |

- **Placement rules**: Place the pivot at a point where the sweeping arm blocks the shot line at regular intervals. The arm sweeps a circle of radius `armLength`, so ensure this circle intersects the intended shot path. Do not place the pivot inside a wall or boundary; leave clearance for the arm plus ball diameter.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `speed` | 0.5 | 2.5 | Used at 0.7-2.0 in configs. Above 2.5: too fast to read |
  | `armLength` | 1.5 | 4.0 | Used at 2-3 in configs |
  | `size.height` | 0.3 | 0.6 | Standard is 0.4 |
  | `size.depth` | 0.2 | 0.5 | Standard is 0.3 |

- **Common pitfalls**: The arm uses a KINEMATIC physics body, meaning it pushes dynamic bodies (the ball) but is unaffected by collisions. On frame-rate drops, `onDtSpike()` recalculates elapsed time from the current angle to prevent the arm from jumping positions. Multiple sweepers with the same speed but different `phase` values create intricate timing windows. Plays `sweeperHit` sound on collision.

- **Example config snippet**:
  ```js
  {
    type: 'moving_sweeper',
    pivot: [0, 0, 0],
    armLength: 3,
    speed: 0.7,
    size: { width: 3, height: 0.4, depth: 0.3 }
  }
  ```

---

### ricochet_bumpers

- **Gameplay purpose**: Array of cylindrical, spherical, or box bumpers for pinball-style bouncing. Creates unpredictable deflections that add chaos and excitement. Best used in clusters to create a bumper field the ball bounces through.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `bumpers` | `Array<BumperConfig>` | yes | | Array of bumper definitions |
  | `bumpers[].position` | `[x,y,z]` | yes | | Bumper center |
  | `bumpers[].geometry` | `'cylinder'\|'sphere'\|'box'` | no | `'cylinder'` | Bumper shape |
  | `bumpers[].radius` | `number` | no | `0.4` | Radius (cylinder/sphere) |
  | `bumpers[].height` | `number` | no | `0.5` | Height (cylinder) |
  | `bumpers[].size` | `[x,y,z]` | no | `[0.8, height, 0.8]` | Dimensions (box) |
  | `bumpers[].restitution` | `number` | no | `0.9` | Config record only (see pitfalls) |
  | `bumpers[].color` | `number` | no | inherited | Per-bumper color override |
  | `color` | `number` | no | `0xff6600` | Default color for all bumpers |

- **Placement rules**: Arrange bumpers to create a field between the tee and cup. Space bumpers at least 2x ball diameter apart so the ball can pass between them. Place at least one bumper directly on the shot line to force engagement. Cluster 3-5 bumpers for a satisfying pinball feel.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 0.2 | 0.8 | Used at 0.4-0.6 in configs |
  | `height` | 0.3 | 0.8 | Standard is 0.5 for cylinders |

- **Common pitfalls**: Like `bank_wall`, the `restitution` field is stored in config but not applied to the physics body. Actual bounce behavior comes from the world's contact material settings. Spheres are positioned at `surfaceHeight + radius` (sitting on surface), while cylinders and boxes are at `surfaceHeight + height/2`. Ensure positions account for this auto-placement.

- **Example config snippet**:
  ```js
  {
    type: 'ricochet_bumpers',
    bumpers: [
      { position: [-1, 0, -1], geometry: 'cylinder', radius: 0.5 },
      { position: [1, 0, 0], geometry: 'sphere', radius: 0.4 },
      { position: [0, 0, -3], geometry: 'cylinder', radius: 0.6 }
    ]
  }
  ```

---

## Timed / Hazard Mechanics

### timed_gate

- **Gameplay purpose**: Gate that cycles between open and closed states on a timer. When closed, it blocks the shot path; when open, the ball can pass. Teaches timing and shot planning around periodic obstacles.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Gate center |
  | `size` | `{ width: number, height: number, depth: number }` | yes | | Gate dimensions |
  | `openDuration` | `number` | yes | | Seconds the gate stays open |
  | `closedDuration` | `number` | yes | | Seconds the gate stays closed |
  | `phase` | `number` | no | `0` | Timer offset (seconds) |
  | `color` | `number` | no | `0x4488cc` | Gate color |

- **Placement rules**: Place across corridors or chokepoints to create timing gates. The gate width should match or slightly exceed the corridor width. Multiple gates with staggered `phase` values create rhythm challenges. Ensure the total cycle time (open + closed) gives the player at least one comfortable window per shot attempt.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `openDuration` | 1.0 | 4.0 | Used at 1.5-2.5 in configs |
  | `closedDuration` | 1.0 | 4.0 | Used at 1.5-3.0 in configs |
  | `size.width` | 1.5 | 12.0 | Used at 2-10 in configs |
  | `size.height` | 0.5 | 1.0 | Standard is 0.8 |
  | `size.depth` | 0.15 | 0.4 | Standard is 0.2 |

- **Common pitfalls**: The gate uses a KINEMATIC body that lerps between closed (surface level) and open (below surface) positions at lerp speed 5. Very short open durations combined with fast-moving balls may result in the ball hitting the gate during its closing animation. On frame-rate spikes, `onDtSpike()` resets the gate to closed position immediately, which can trap a ball mid-transit. Plays `gateOpen`/`gateClose` sounds on state transitions.

- **Example config snippet**:
  ```js
  {
    type: 'timed_gate',
    position: [0, 0, -2],
    size: { width: 4, height: 0.8, depth: 0.2 },
    openDuration: 2.5,
    closedDuration: 3.0
  }
  ```

---

### timed_hazard

- **Gameplay purpose**: Hazard zone that activates and deactivates on a cycle. When active, the ball is penalized on contact (bounce impulse). Creates timing windows the player must exploit to cross safely.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `position` | `[x,y,z]` | yes | | Hazard center |
  | `size` | `{ width: number, length: number }` | yes | | Hazard area dimensions |
  | `onDuration` | `number` | yes | | Seconds active |
  | `offDuration` | `number` | yes | | Seconds inactive |
  | `hazardType` | `'water'\|'sand'` | no | `'water'` | Hazard visual style |
  | `phase` | `number` | no | `0` | Timer offset (seconds) |
  | `color` | `number` | no | type-dependent | Override color |

- **Placement rules**: Place across the shot path where the player must time their approach. Stagger multiple hazards with different `phase` values to create a gauntlet. The hazard area should be large enough that the ball cannot skip over it at normal speeds. Use `hazardType` to signal severity: water (harsh) vs. sand (mild).

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `onDuration` | 1.0 | 3.0 | Used at 1.5-2.0 in configs |
  | `offDuration` | 1.5 | 4.0 | Used at 2.0-3.0 in configs |
  | `size.width` | 2.0 | 8.0 | Used at 3.5-7.0 in configs |
  | `size.length` | 1.0 | 4.0 | Used at 1.5-3.0 in configs |
  | `phase` | 0 | cycle length | Used at 0-1.5 in configs |

- **Common pitfalls**: Detection uses simple AABB overlap (not physics collision), so the hazard works even without a physics body. The bounce impulse `(0, 2, 0)` launches the ball upward, which may cause it to land outside the boundary on narrow holes. Default color for water is 0xff4400 (orange), not blue, which may confuse players expecting water-colored hazards; consider overriding with a blue tint for water type.

- **Example config snippet**:
  ```js
  {
    type: 'timed_hazard',
    position: [0, 0, -3],
    size: { width: 5, length: 2 },
    onDuration: 1.5,
    offDuration: 3.0,
    hazardType: 'water',
    phase: 0
  }
  ```

---

### laser_grid

- **Gameplay purpose**: Timed beam hazard that the player must thread through during off-cycles. Beams activate and deactivate in sync, creating gates of light the ball must avoid. Visually striking with pulsing opacity and warning flashes.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `beams` | `Array<{ start: [x,y,z], end: [x,y,z] }>` | yes | | Beam segment endpoints |
  | `onDuration` | `number` | yes | | Seconds beams are active |
  | `offDuration` | `number` | yes | | Seconds beams are inactive |
  | `offset` | `number` | no | `0` | Phase offset (0-1, fraction of cycle) |
  | `width` | `number` | no | `0.05` | Visual beam radius |
  | `color` | `number` | no | `0xff2222` | Beam color |

- **Placement rules**: Position beam endpoints to create lines the ball must cross. Place beams perpendicular to the shot path for maximum challenge. Multiple beams with different `offset` values create complex timing puzzles. Beams work in the XZ plane for detection; Y coordinates affect visuals only.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `onDuration` | 0.8 | 5.0 | Used at 1.2 in configs |
  | `offDuration` | 0.8 | 5.0 | Used at 1.0 in configs |
  | `offset` | 0 | 1.0 | Fraction of total cycle |
  | `width` | 0.02 | 0.1 | Visual only; detection uses width * 4 |

- **Common pitfalls**: Ball detection threshold is `beamWidth * 4`, so increasing `width` also increases the detection hitbox. A 0.1s warning flash (opacity 0.3) fires before reactivation; ensure `offDuration` is at least 0.3s longer than the minimum time for the ball to cross. The bounce impulse `(0, 2, 0)` on contact can launch the ball off narrow courses. Beams pulse opacity at 8Hz when active (`0.7 + 0.3 * sin(timer * 8)`).

- **Example config snippet**:
  ```js
  {
    type: 'laser_grid',
    onDuration: 1.2,
    offDuration: 1.0,
    offset: 0,
    beams: [
      { start: [-3, 0.3, -2], end: [3, 0.3, -2] },
      { start: [-3, 0.3, -4], end: [3, 0.3, -4] }
    ]
  }
  ```

---

## Special Mechanics

### portal_gate

- **Gameplay purpose**: Teleports the ball from an entry position to an exit position. Creates shortcut opportunities and non-linear hole layouts. The player aims for the entry portal to warp to a different part of the course.

- **Config shape**:
  | Field | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `entryPosition` | `[x,y,z]` | yes | | Entry portal center |
  | `exitPosition` | `[x,y,z]` | yes | | Exit portal center |
  | `radius` | `number` | no | `0.6` | Trigger radius |
  | `color` | `number` | no | `0x8800ff` | Portal color |

- **Placement rules**: Place the entry portal on or near the intended shot path. The exit portal should be at a meaningful location (closer to the cup, on a different elevation, past an obstacle). Ensure the exit position has clearance; the ball is placed at `exitY = surfaceHeight + 0.3` to prevent clipping. Do not place exit portals near boundaries, hazards, or other portals without adequate spacing.

- **Safe parameter ranges**:
  | Parameter | Min | Max | Notes |
  |-----------|-----|-----|-------|
  | `radius` | 0.4 | 1.0 | Used at 0.7 in configs. Below 0.4: too hard to hit |

- **Common pitfalls**: A 1-second cooldown prevents the ball from immediately re-entering a portal after teleporting. If the exit portal is within the entry portal's radius of another portal, the ball can chain-teleport uncontrollably. Detection uses 2D distance (XZ plane): `dx*dx + dz*dz <= radius*radius`. The entry/exit visuals are ring + glow disc meshes with no physics bodies; the trigger is purely distance-based.

- **Example config snippet**:
  ```js
  {
    type: 'portal_gate',
    entryPosition: [0, 0, 2],
    exitPosition: [0, 0, -6],
    radius: 0.7
  }
  ```

---

## Quick Reference Table

| Type | Category | Has Physics Body | Updates Per Frame | Audio |
|------|----------|-----------------|-------------------|-------|
| `bank_wall` | Structural | STATIC | No | -- |
| `split_route` | Structural | STATIC | No | -- |
| `elevated_green` | Structural | STATIC (trimesh) | No | -- |
| `multi_level_ramp` | Structural | STATIC (trimesh) | No | -- |
| `disappearing_platform` | Structural | STATIC (toggled) | Yes | -- |
| `boost_strip` | Force Field | STATIC (trigger) | Yes | boost |
| `bowl_contour` | Force Field | None | Yes | -- |
| `low_gravity_zone` | Force Field | None | Yes | -- |
| `suction_zone` | Force Field | None | Yes | -- |
| `gravity_funnel` | Force Field | None | Yes | -- |
| `moving_sweeper` | Obstacle | KINEMATIC | Yes | sweeperHit |
| `ricochet_bumpers` | Obstacle | STATIC | No | -- |
| `timed_gate` | Timed | KINEMATIC | Yes | gateOpen, gateClose |
| `timed_hazard` | Hazard | None | Yes | -- |
| `laser_grid` | Hazard | KINEMATIC (trigger) | Yes | -- |
| `portal_gate` | Special | None | Yes | teleport |
