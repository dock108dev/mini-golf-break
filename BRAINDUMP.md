# mini-golf-break

Space Mini Golf — 18-Hole Course Braindump

What this is

This is the product/design braindump for taking the current mini golf prototype from “8-hole basic space POC” into a full 18-hole, visually interesting, mechanically fair, actually playable course with a clean path for future course creation.

This is not just “make more holes.” The goal is to:
	•	replace placeholder-feeling geometry with intentional hole design
	•	eliminate broken or immersion-breaking course behavior
	•	make obstacles matter and sit in the actual line of play
	•	create a full 18-hole themed course that feels like one coherent place
	•	define reusable course-building rules so future holes/courses are much easier to author
	•	keep the game readable and fun, not over-engineered nonsense

⸻

Current state, bluntly

The current prototype is good enough to prove the idea, but not good enough to trust as a real course.

Right now the course sounds like it has a few core problems:
	•	only 8 holes
	•	most holes are basically one shape with a few attached props
	•	some obstacles are decorative more than gameplay-relevant
	•	weird geometry / collision issues, including things like holes under the green
	•	questionable routing / unclear intended shot path
	•	likely inconsistent scale, collision, friction, slope, or cup placement rules
	•	no strong authoring pattern for building more content cleanly

That means the next step is not just making 10 more holes. The next step is:
	1.	audit what is currently working and broken
	2.	define a real hole design language
	3.	rebuild or heavily revise the existing holes under that language
	4.	expand to a full 18-hole course
	5.	leave behind a course framework/template so this does not become painful every time we add content

⸻

Product goal

Create a space-themed 18-hole mini golf course that:
	•	looks cool immediately
	•	feels readable and fair on first play
	•	has enough variety that players remember individual holes
	•	includes trick shots, banks, timing, alternate routes, and risk/reward
	•	avoids cheap randomness or broken physics traps
	•	has strong visual identity without sacrificing gameplay clarity
	•	supports future content packs / new courses without reinventing the pipeline

The course should feel like a real shipped first course, not a tech demo.

⸻

Experience goal

The player should feel:
	•	“oh this is actually polished”
	•	“this hole has an idea”
	•	“I can see what the game wants from me”
	•	“I messed that up” rather than “the game screwed me”
	•	“I want to see the next hole”

Every hole should have a readable gimmick or identity, but still feel like mini golf.

Not every hole needs to be insane. Some should be clean setup holes, some should be trick holes, and a few should be standout signature holes.

⸻

High-level design principles

1. Gameplay first, theme second

Space theme should enhance readability and novelty, not bury the path in visual clutter.

2. Every obstacle must matter

If an obstacle is not realistically influencing the player’s intended line, move it, resize it, or delete it.

3. One strong idea per hole

A good mini golf hole usually has a clear main concept:
	•	bank shot
	•	timing gate
	•	split route
	•	elevation change
	•	gravity funnel
	•	ricochet lane
	•	risky shortcut
	•	precision threading

Do not stack five weak ideas and call it creativity.

4. Fair over flashy

If something looks cool but creates unreadable bounces, broken collision, or random-feeling outcomes, it loses.

5. Visual language should signal gameplay

Players should be able to roughly infer:
	•	what is playable surface
	•	what is wall / bumper / hazard
	•	what is decorative background
	•	what moves
	•	what is dangerous
	•	what is targetable for bank shots

6. Escalation matters

Hole 1 should not feel like Hole 18. The course should ramp in complexity, spectacle, and execution demands.

7. Reusability is mandatory

This cannot be a one-off pile of bespoke hacks. Need a hole/system structure that supports easy authoring, testing, and extension.

⸻

Repo review goals

Before hole redesign starts, review the repo for these areas:

Gameplay / physics
	•	ball movement tuning
	•	collision reliability
	•	wall bounce consistency
	•	friction / damping
	•	slopes / gravity behavior if present
	•	cup detection reliability
	•	reset / out-of-bounds logic
	•	spawn positioning
	•	stroke counting and completion state

Hole construction
	•	how hole geometry is authored
	•	whether holes are hardcoded, scene-based, data-driven, or mixed
	•	how obstacles are placed and configured
	•	whether reusable prefabs/components exist
	•	whether there is any clear separation between gameplay surfaces and art dressing

Course flow
	•	loading holes in sequence
	•	par / metadata support
	•	hole intro/outro logic
	•	camera setup per hole
	•	checkpoint / restart flow
	•	score persistence across the course

Debuggability
	•	ability to visualize collision
	•	ability to preview intended shot lines or test spawn points
	•	easy reset / replay tools
	•	authoring workflow for fast iteration

Expansion readiness
	•	whether new holes can be added by data/config only
	•	whether there is a clean template for new obstacle types
	•	whether current logic supports multiple courses/themes later

⸻

Core problems to likely fix in the current build

These are the kinds of issues I would expect to find and want fixed before calling the course “real”:

Broken cup placement / invalid sink geometry

The cup cannot be under the green, embedded weirdly, or placed where collision looks wrong. Cup placement needs consistent rules:
	•	flush with playable surface
	•	clean lip / rim behavior
	•	no hidden clipping
	•	reachable by intended shot speed ranges

Decorative obstacles not in the line of play

If most obstacles are off to the side or easy to ignore, they are noise. They should either:
	•	define the shot path
	•	threaten a punishment
	•	create routing decisions
	•	support a trick shot
	•	or be removed

Single-shape hole design

A hole that is just one flat shape with random props on top will feel amateur. Need stronger composition:
	•	runway
n- turn
	•	lane split
	•	elevation transition
	•	guarded cup zone
	•	recovery space

Unclear boundaries / collision language

Players should instantly know what the ball can ride, bounce off, fall through, or ignore.

Inconsistent visual scale / proportions

Walls, props, ramps, hazards, and cup sizes need consistency or deliberate variation.

Overly empty playfields

Space theme can tempt giant empty voids. Need enough structure and landmarks to make the hole feel authored.

⸻

Target structure for the first full course

18 holes should be organized with pacing, not random idea order.

Holes 1–3: onboarding / confidence

Teach readability and core shot feel.
	•	clean banks
	•	one obvious route
	•	low punishment
	•	establish the visual language of the course

Holes 4–6: introduce interaction

Start adding moving obstacles, lane splits, and positional punishment.

Holes 7–9: mid-course creativity spike

More memorable holes. First real “wow” moments.

Holes 10–12: control and planning

Precision, route choice, maybe tighter geometry.

Holes 13–15: spectacle + execution

Larger set pieces, more timing and spatial demand.

Holes 16–18: signature finish

Harder but fair. Strong visuals. Strong identity. Final hole should feel like a finale, not just another obstacle arrangement.

⸻

Suggested space-course identity

The course should feel like a single coherent place instead of “18 random space props.”

Potential framing:

Orbital Drift Mini Golf — a course built across floating stations, asteroid bridges, satellite platforms, reactor rings, lunar docks, and a final cosmic launch platform.

That gives permission for:
	•	sleek sci-fi surfaces
	•	glowing rails
	•	asteroid hazards
	•	force-field gates
	•	low-gravity-feeling visuals
	•	turbines / rotating satellites
	•	launch tubes / wormhole visuals
	•	meteor impacts / crater bowls
	•	black hole / gravity well-inspired funnels

Important: keep the actual gameplay grounded and consistent even if the theme implies wild physics.

⸻

Hole design framework

Each hole should be designed with a standard template.

Required fields per hole
	•	hole number
	•	hole name
	•	par
	•	primary mechanic
	•	intended first-shot line
	•	alternate route(s)
	•	punishments / failure cases
	•	recovery pattern
	•	visual set piece
	•	required obstacle assets
	•	gameplay validation notes

Questions every hole must answer
	•	What is the idea of this hole?
	•	What does the player probably try first?
	•	What happens on a decent shot?
	•	What happens on an overhit / underhit?
	•	Can the player recover without it feeling hopeless?
	•	Is the obstacle actually in play?
	•	Is the cup placement fair?
	•	Is the route readable from camera/start?
	•	Is it memorable compared to the previous hole?

⸻

Proposed 18-hole course concepts

These are starting concepts, not sacred final blueprints.

Hole 1 — Docking Lane

Par 2
A clean introductory hole on a space station runway with side bumpers and a guarded but straightforward cup.

Purpose:
	•	establish ball speed
	•	establish bounce feel
	•	teach the player that walls are useful

Needs:
	•	one central lane
	•	slight angle option for a cleaner approach
	•	clear cup visibility

Hole 2 — Solar Bank

Par 2
A simple bank-shot hole where the direct line is blocked by a solar panel array, forcing a gentle wall use.

Purpose:
	•	introduce intentional banking
	•	obstacle finally matters

Hole 3 — Crater Lip

Par 3
The green has a shallow crater depression/funnel that helps a well-paced ball but punishes overhits with a rim-out or overshoot lane.

Purpose:
	•	introduce surface shaping
	•	teach speed control

Hole 4 — Satellite Split

Par 3
Two lanes around a rotating satellite obstruction: safer long route vs tighter direct route.

Purpose:
	•	introduce route choice
	•	make timing visible but forgiving

Hole 5 — Meteor Gate

Par 3
Timed gate using moving asteroid/meteor blockers crossing the intended line.

Purpose:
	•	introduce timing
	•	first real dynamic obstacle in play

Hole 6 — Thruster Ramp

Par 2 or 3
A boost ramp / launch pad sends the ball to an upper platform. Miss the angle and the ball falls into a recovery lane below.

Purpose:
	•	first vertical transition
	•	high cool factor without chaos

Hole 7 — Orbital Ring

Par 3
Circular outer wall/ring shot where the player can wrap the ball around the perimeter into a central finish zone.

Purpose:
	•	memorable geometry
	•	rewarding rebound planning

Hole 8 — Cargo Drift

Par 3
Slow-moving cargo crates shift the lane layout over time, changing safe windows and bank options.

Purpose:
	•	moving cover / dynamic lane control
	•	mid-course variety

Hole 9 — Moonbase Switchback

Par 4
A multi-turn hole with staggered walls and one optional shortcut shot over/through a narrow opening.

Purpose:
	•	first more complex routing hole
	•	end front-nine with something substantial

Hole 10 — Laser Grid

Par 3
Alternating laser barriers visually mark danger zones. Touching them does not need to be punishingly complex; can reset, deflect, or add stroke penalty depending system support.

Purpose:
	•	clean sci-fi identity
	•	precise shot threading

Hole 11 — Blackout Corridor

Par 3
Tighter lane, stronger contrast lighting, narrow bounce geometry, maybe disappearing/reappearing forcefield panels.

Purpose:
	•	more controlled technical shot
	•	tonal change from broader holes

Hole 12 — Gravity Well

Par 4
A large bowl/funnel-like middle section that can be used skillfully to curve into a cup zone, or avoided through a safer side route.

Purpose:
	•	signature terrain hole
	•	memorable visual centerpiece

Hole 13 — Debris Field

Par 4
Several asteroid chunks create ricochet opportunities and punish bad entry angles. Needs to feel authored, not random.

Purpose:
	•	controlled chaos
	•	reward reading the geometry

Hole 14 — Reactor Bypass

Par 3
Hazard zones near a glowing reactor core force a bank around the danger or a fast precision thread through the middle.

Purpose:
	•	strong visual drama
	•	tight risk/reward

Hole 15 — Wormhole Relay

Par 4
A teleport mechanic or faux-teleport lane system if supported. Ball enters one portal and exits another predictable point/orientation.

Purpose:
	•	standout gimmick hole
	•	good late-course surprise

If true teleportation is too messy technically, fake it with launch tubes, hidden transfer, or controlled one-way channels.

Hole 16 — Eclipse Steps

Par 4
Tiered platforms with narrow ramps or drops, requiring deliberate progression instead of one giant lucky shot.

Purpose:
	•	late-course tension
	•	elevation and pacing control

Hole 17 — Comet Run

Par 3
A fast, longer hole with moving hazards and one very satisfying clean line if timed well.

Purpose:
	•	adrenaline / spectacle before finale

Hole 18 — Starforge Finale

Par 5
Big final set piece combining a launch, a bank or split decision, and a guarded final sink area. Should feel epic but still fair.

Purpose:
	•	memorable course closer
	•	culmination of everything learned

⸻

Obstacle/system wishlist

Need a library of reusable obstacle/system types, not bespoke hacks for every hole.

Static fundamentals
	•	straight wall
	•	curved wall
	•	bumper / angled reflector
	•	ramp
	•	funnel/bowl surface
	•	narrow gate
	•	hazard zone
	•	drop lane / return lane

Dynamic elements
	•	rotating blocker
	•	sliding blocker
	•	timed gate
	•	oscillating bumper
	•	moving platform if physics supports it cleanly

Themed elements
	•	solar panel blocker
	•	asteroid bumper
	•	satellite arm spinner
	•	force-field gate
	•	thruster pad / launch ramp
	•	portal / warp tunnel
	•	reactor hazard core

Every obstacle type should define:
	•	gameplay purpose
	•	collision behavior
	•	placement rules
	•	readability rules
	•	safe parameter ranges

⸻

Strong recommendation: define a course authoring system

The project will be way easier if each hole is data-backed instead of being a fully handcrafted one-off mess.

Ideal direction:

Hole as a structured scene + data config

Each hole should have:
	•	a scene/prefab for unique geometry/art
	•	a config/data file for metadata and tunable values

Example metadata:
	•	holeId
	•	courseId
	•	number
	•	par
	•	displayName
	•	themeVariant
	•	spawnPoint
	•	cupPoint
	•	bounds
	•	cameraPreset
	•	obstacle instances
	•	validation flags

Reusable obstacle prefabs/components

Rather than custom logic per hole, obstacles should be instances of reusable pieces with exposed params.

Clear separation between:
	•	gameplay collision surfaces
	•	visuals / dressing
	•	hazard logic
	•	dynamic obstacle logic
	•	hole metadata / scoring

This separation matters because right now the weird behavior likely comes from art/gameplay/collision all bleeding together.

⸻

Validation rules for every hole

This is the kind of thing that should exist as a checklist, debug command, or editor validation pass.

Geometry / collision validation
	•	cup must be above/flush with playable surface
	•	no invalid overlaps between cup and green mesh/collider
	•	no unreachable spawn positions
	•	no ball spawn clipping
	•	no walls with visibly broken collision gaps
	•	no decorative meshes accidentally colliding unless intended

Playability validation
	•	hole must be completable with normal physics
	•	intended route must be viable with reasonable shot strength
	•	underhit and overhit should produce understandable results
	•	obstacle must affect intended route meaningfully
	•	no soft-lock zones
	•	no infinite bounce traps
	•	recovery path must exist where intended

UX validation
	•	player can see the main shot idea from start or preview camera
	•	hole boundaries are visually readable
	•	hazard vs decoration is readable
	•	moving obstacles telegraph timing clearly

Performance / maintainability validation
	•	no unnecessary high-complexity collision meshes
	•	no hole-specific hacks when shared logic should exist
	•	no magic-number-only tuning with no notes

⸻

Visual direction notes

Need more than “space props on a plane.”

Surfaces
	•	glossy dark metals
	•	lunar dust / crater textures where appropriate
	•	neon trims or emissive edge lines for readability
	•	contrast between main fairway, rough/hazard, and non-play space

Background dressing
	•	planets, stars, satellite silhouettes, nebula skybox, distant stations
	•	keep background clearly non-interactive

Hole identity props

Each hole should have 1–2 landmark props max that define it. Not clutter.

Examples:
	•	giant satellite dish
	•	cracked asteroid arch
	•	glowing reactor core
	•	docking clamps
	•	wormhole ring
	•	comet trail emitter

Readability over noise

Space can get visually busy fast. The ball path needs contrast.

⸻

Difficulty philosophy

This should be a course people enjoy, not streamer rage bait.

Need a fair difficulty ramp:
	•	early holes: understandable, forgiving
	•	middle holes: introduce route choice and timing
	•	late holes: ask for combination execution
	•	final holes: hard but readable

Avoid:
	•	blind shots unless preview/camera supports it
	•	random moving chaos
	•	tight punishment with no recovery
	•	giant empty travel distances that waste time
	•	gimmicks that only work once the player already knows the trick

⸻

Expansion plan beyond the first course

This repo should not stop at one course if the system is built right.

Future course packs could be:
	•	Moonbase Classic
	•	Alien Jungle
	•	Retro Arcade Spaceport
	•	Black Hole Lab
	•	Mars Industrial Yard

But the first course should establish the reusable framework:
	•	course manifest
	•	hole metadata schema
	•	obstacle library
	•	validation rules
	•	authoring template
	•	naming conventions

Once this exists, creating Course 2 becomes content work instead of architecture surgery.

⸻

Deliverables I’d want from the repo review + redesign effort

1. Audit doc

A blunt summary of:
	•	what is reusable
	•	what is broken
	•	what must be refactored before hole expansion
	•	what can stay

2. Course design spec

Full 18-hole concept list with rough layouts, pars, mechanics, and progression logic.

3. Authoring framework proposal

How holes should be structured in repo/code/scenes/data.

4. Obstacle library spec

What reusable pieces exist and what new ones need to be built.

5. Validation checklist / tooling

How to prevent broken cup placement, irrelevant obstacles, and bad collision from sneaking in again.

6. Implementation plan

Phased build order for turning the current POC into the actual first course.

⸻

Suggested implementation phases

Phase 1 — Repo audit and stabilization
	•	inspect current hole architecture
	•	inspect physics/collision/cup logic
	•	identify broken geometry and invalid placements
	•	identify current reusable pieces
	•	fix foundational bugs that would poison future work

Phase 2 — Define SSOT for holes and obstacles
	•	create hole metadata structure
	•	create obstacle/component taxonomy
	•	define naming and folder structure
	•	define authoring workflow

Phase 3 — Rebuild the first 8 holes properly
	•	keep only what is actually good
	•	revise weak layouts
	•	make obstacles matter
	•	establish the visual/gameplay quality bar

Phase 4 — Build holes 9–18
	•	complete pacing curve
	•	add signature mechanics later, not all at once
	•	keep testing after each hole, not only at the end

Phase 5 — Polish and validation pass
	•	camera tuning
	•	readability pass
	•	collision pass
	•	pacing/difficulty pass
	•	par balancing
	•	visual cohesion pass

Phase 6 — Expansion support
	•	hole template
	•	new course bootstrap flow
	•	documentation for building future themed courses

⸻

Acceptance criteria for calling this successful

The 18-hole course is successful when:
	•	all 18 holes are playable and complete reliably
	•	cup placement and collision are clean everywhere
	•	each hole has a distinct identity and intentional gameplay idea
	•	obstacles are in play, not decorative filler
	•	the course escalates in a clear and satisfying way
	•	the space theme feels cohesive across the whole course
	•	adding Hole 19 or a Course 2 would be straightforward under the new structure
	•	there is a documented authoring/validation path so broken layouts are less likely to recur

⸻

What I would tell the agent/reviewer to focus on

Do not just make the current holes prettier.

Review the repo like the goal is to ship a real first course and make future courses easy.

Specifically:
	•	identify every foundational issue making the current holes feel fake or broken
	•	propose the cleanest architecture for hole authoring and obstacle reuse
	•	redesign the course as a full 18-hole experience with progression and identity
	•	fix the geometry/collision/cup-placement weirdness at the root
	•	ensure every obstacle meaningfully affects gameplay
	•	leave behind a system, not just content

⸻

Final framing

This should end up as:

“a polished 18-hole space mini golf course with real hole design, strong pacing, meaningful obstacles, and a reusable framework for future courses”

Not:

“the original 8-hole prototype but with 10 more random space holes glued on.”