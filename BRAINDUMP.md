# Mini Golf — BRAINDUMP.md

## TL;DR

It works. It’s not a game yet.

Right now this is:
- ball physics in a box
- random objects placed in space
- low readability
- no real hole identity
- no motion
- weak theme usage

What it needs:
- **readable holes**
- **reliable interactions**
- **defined obstacle systems**
- **actual hole design (not object placement)**
- **motion + timing**
- **theme-driven mechanics**

This is not a polish problem.  
This is a **design language problem**.

---

## Current State (Honest)

### What works
- Ball movement exists
- Holes technically function
- Basic UI/strokes tracking exists
- Theme direction (space) is started
- Some obstacles visually imply interaction

### What doesn’t
- You can’t reliably read a hole
- You don’t know what matters vs decoration
- Objects feel inconsistent
- Layouts feel the same
- Nothing moves
- Theme doesn’t affect gameplay
- Lighting actively hurts clarity
- Some cups are hidden or hard to see

---

## Core Problem

This is not mini golf yet.

It is:
> “A physics sandbox with golf controls”

Mini golf is:
> “Readable geometry + intentional shots + consistent rules + small surprises”

Right now:
- holes are not designed → they are assembled
- objects are not systems → they are props
- theme is not gameplay → it is background

---

## What Mini Golf Needs (Non-Negotiables)

### 1. Immediate Readability
Player must instantly understand:
- where the ball starts
- where the hole is
- what blocks them
- what might move
- what the first shot likely is

If they have to search → you already lost them.

---

### 2. Trust in Physics
If the player thinks:
> “that should have worked”

…it must work.

No:
- ghost collisions
- fake objects
- inconsistent bounce
- getting stuck in seams
- unclear hitboxes

---

### 3. Hole Identity
Every hole needs a sentence.

Examples:
- “timing gate hole”
- “bank shot hole”
- “asteroid drift hole”
- “split route risk/reward”
- “launch pad jump hole”

If you can’t describe it in one line, it’s not a real hole.

---

### 4. Meaningful Objects Only
If it’s on the course, it must:
- block
- redirect
- move
- punish
- reward
- teach

Otherwise → remove it or move it off the playfield.

---

### 5. Motion (Selective but Critical)
Right now nothing moves → game feels dead.

Need:
- rotating sweepers
- sliding gates
- orbiting blockers
- pulsing barriers

Doesn’t need to be everywhere, but enough to create rhythm + timing.

---

## Current Problems (Detailed)

### 1. Cups / Holes Visibility
- blend into surface
- hidden by walls/angles
- low contrast
- sometimes feel “buried”

**Fix:**
- emissive glow
- brighter rim
- contrast color
- never hidden at spawn angle

---

### 2. Layout Repetition
Everything feels like:
- rectangle
- ball → forward
- object in the way
- hole at end

No:
- lateral movement
- vertical play
- branching decisions
- layered routing

---

### 3. Object Confusion
Player cannot tell:
- what is solid
- what moves
- what matters

This kills trust instantly.

---

### 4. Static World
No motion = no life.

Space theme is wasted without:
- orbit
- drift
- rotation
- timing

---

### 5. Weak Theme Integration
Currently:
- space = stars + dark

Needs:
- space = mechanics

---

### 6. Lighting / Contrast Issues
Too dark + flat:
- walls blend into floor
- hole blends into surface
- objects lack hierarchy

Mini golf needs clarity > realism.

---

### 7. Dead Space / Filler
Some areas:
- exist but don’t matter
- have props that do nothing
- create noise instead of gameplay

---

## What the Game Should Feel Like

- fast to read
- satisfying to hit
- consistent physics
- occasionally clever
- slightly chaotic (controlled)
- replayable
- arcade-clean (not sim-heavy)
- every hole feels intentional

---

## Object System (Must Define This)

### Static Geometry
- walls
- rails
- ramps
- funnels
- wedges

### Dynamic Objects
- rotating bars
- sliding gates
- pendulums
- orbiting bumpers

### Hazards
- void zones
- reset areas
- black holes (pull)
- energy pits

### Utility
- launch pads
- teleporters
- boost strips
- checkpoints

### Decoration (OFF PLAYFIELD)
- asteroids (background)
- ships
- lights
- environment

---

## Hole Taxonomy (Core Types)

Do NOT design holes randomly. Pick a type.

- timing gate
- bank shot
- narrow precision lane
- split path (safe vs risky)
- ramp / jump
- funnel recovery
- hazard carry
- moving obstacle
- multi-stage
- ricochet puzzle
- gravity gimmick
- pinball chaos
- finale/boss hole

Each hole = 1–2 types max.

---

## First Real Course (9-Hole Plan)

### Hole 1 — Docking Lane
- simple
- teach timing (single sweeper)

### Hole 2 — Bank Right
- forced wall bank
- teach bounce reliability

### Hole 3 — Debris Drift
- slow moving asteroid blockers

### Hole 4 — Split Route
- safe long vs risky shortcut

### Hole 5 — Launch Pad
- ramp or boost to upper level

### Hole 6 — Gravity Funnel
- controlled pull zone mechanic

### Hole 7 — Satellite Array
- rotating arms / timing windows

### Hole 8 — Reactor Core
- hazards + tighter control

### Hole 9 — Orbital Finale
- combine mechanics into multi-stage hole

---

## Space Theme (Make It Matter)

Use mechanics, not just visuals.

### Mechanics to Add
- low gravity pads
- launch tubes
- orbiting obstacles
- laser timing gates
- teleport gates
- magnetic rails
- black hole pulls
- ringworld curves
- docking targets

---

## Visual Direction

### Goals
- high contrast
- readable surfaces
- clear interaction signals

### Rules
- floor ≠ walls
- hole always highlighted
- hazards = bright/danger colors
- interactives = glow/accent
- decoration pushed away from play area

---

## Design Rules (Strict)

### Course
- every hole has a gimmick
- cup visible within 1 second
- intended shot readable within 3 seconds
- no random clutter
- avoid flat rectangles unless intentional

### Physics
- if it looks solid → it is
- no weird collisions
- no getting stuck
- consistent bounce

### Theme
- every few holes introduce or remix a mechanic
- visuals support gameplay, not override it

---

## Development Plan

### Phase 1 — Readability
- fix hole visibility
- improve lighting/contrast
- clean camera angles

### Phase 2 — Systems
- define obstacle behaviors
- remove fake objects
- standardize collisions

### Phase 3 — Hole Design
- rebuild holes with clear gimmicks
- create 9-hole course
- remove weak holes

### Phase 4 — Motion + Theme
- add moving objects
- introduce space mechanics

### Phase 5 — Polish
- better feedback (hits, scoring)
- intro flyovers
- ambient motion
- course progression feel

---

## Hard Truth

This is not bad because it’s unfinished.

It’s bad because:
- there is no consistent design language yet
- holes are not authored
- systems are not defined

The fix is NOT:
> “add more stuff”

The fix is:
- fewer systems
- clearer rules
- better holes
- real motion
- consistent interactions

---

## Target Outcome

After fixes, the game should feel like:

- I see the hole → I understand it immediately  
- I take a shot → result feels fair  
- I retry → I learn something  
- I succeed → it feels earned  
- I move on → next hole feels different  

---

## Final Note

Right now:
> “space mini golf prototype”

Target:
> “tight, readable, satisfying mini golf game that happens to be in space”

The difference is:
**intent + clarity + trust**

Everything should move toward that.
