# Copilot Prompt Pack — Rowing Manoeuvring Trainer

Scoped tasks for GitHub Copilot (or a human) to extend the PoC. Each task names
the files it may touch and the constraint "do not modify X". The core physics
(src/physics.ts) and types (src/types.ts) are the contract — extend around them,
don't rewrite them unless explicitly asked.

General rules for every prompt:
- TypeScript strict mode is on. No `any`. No unused vars/params.
- The `OarCommands` array shape (4 oars) is fixed; input mappers fill it.
- Physics consumes `OarCommands` + `Level` only. Keep it that way.
- Prefer editing existing files over creating new ones unless the task says so.

---

## Task 1 — Per-oar control scheme (the learning goal)
Files: src/input.ts, src/config.ts
Do not modify: src/physics.ts, src/types.ts
Prompt:
"In src/config.ts set CONTROL.scheme to 'perOar' and ensure allowReverse stays
true. In src/input.ts the perOar branch already exists (Q/E for rower A port/
starboard, Z/C for rower B). Improve it: hold Space = reverse all currently
engaged oars; show a small on-screen hint of which oars are engaged. Keep the
OarCommand[4] output shape identical. Add unit-test-style comments describing
the expected yaw direction for each single-oar input."

## Task 2 — Gamepad analogue effort
Files: src/input.ts
Do not modify: physics, types
Prompt:
"Replace the binary gamepad mapping with analogue: stick deflection 0..1 maps
to oar power; deadzone 0.15; trigger (buttons 6/7) = reverse for that rower.
Support both simple and perOar schemes. Keep usingGamepad flag accurate."

## Task 3 — River flow visualisation + stronger current level
Files: src/levels/, src/render.ts
Prompt:
"Add a new level JSON 'river-flow-1' with bounds 600x200, start at one end,
flow vx ~1.2 m/s (downstream), and 3 gates. In render.ts draw subtle animated
flow arrows (a repeating arrow field scrolling in the flow direction). Do not
change physics; it already applies flow. Register the level in levels/index.ts."

## Task 4 — Wind effect + gusts
Files: src/physics.ts (extend wind block only), src/levels/
Prompt:
"Extend the wind model in stepBoat: wind should mainly affect the boat when
moving slowly (more lateral push at low speed), and add optional level-defined
gusts (array of {t, speed, dir, duration}). Keep the relative-velocity drag
formulation intact. Add a windy level JSON."

## Task 5 — Other boats (moving obstacles)
Files: src/types.ts (add OtherBoat), src/physics.ts (collision), src/render.ts,
src/scenario.ts
Prompt:
"Add optional `otherBoats` to Level: each has a path (waypoints) and speed.
Simulate them as kinematic (scripted) obstacles. Add simple circle collision
with the player boat (push-out + speed penalty). Render them distinctly. Do not
break the deterministic fixed-step loop."

## Task 6 — Landing-stage docking scenario
Files: src/levels/, src/scenario.ts
Prompt:
"Add a 'docking-1' level: a landing stage (rectangle) at the bank. Win
condition = bring the boat to near-zero speed within the stage rectangle
(defined in level). Extend ScenarioState with a docked flag. Keep gate logic."

## Task 7 — Scoring + local leaderboard (pre-backend)
Files: src/scenario.ts, src/main.ts, new src/score.ts
Prompt:
"Add a scoring module: time-to-complete, gates passed, collisions, and a
smoothness metric (low angular jerk = better). Store best runs in
localStorage keyed by level id. Show a results overlay on completion. Keep the
sim deterministic so scores are comparable."

## Task 8 — Boat-relative camera toggle
Files: src/camera.ts, src/main.ts
Prompt:
"Add a camera mode 'boat-relative' where the world rotates so the boat always
points up (useful before players learn north-up). Toggle with key 'C'. Only the
render transform changes — physics and input stay world-space. Ensure gates and
flow arrows rotate consistently."

## Task 9 — Replay / record inputs
Files: new src/replay.ts, src/main.ts
Prompt:
"Record the OarCommands + dt sequence each run. Add playback that feeds the
recorded inputs back through stepBoat (deterministic). This supports later
server-side leaderboard validation. Keep recording optional (key 'R')."

## Task 10 — Landing page + feedback form
Files: new index.html section or separate /beta page
Prompt:
"Add a simple landing page listing levels with thumbnails and a feedback form
(Google Form or GitHub Discussions link). Keep the game iframe-based so it
stays a static deploy."
