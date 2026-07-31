# Rowing Manoeuvring Trainer

A top-down rowing simulation for learning 2x (double scull) handling. Builds real boat feel — the hull resists sideways skid, yaw decays fast when you stop rowing, and per-side oar control makes you learn to steer.

## Controls

**Per-side 3-state (default scheme):**

| Side      | Row on | Hold | Back down |
|-----------|--------|------|-----------|
| Port      | Q      | A    | Z         |
| Starboard | W      | S    | X         |

- **Row on** — drives forward. Both sides = straight; one side = turn.
- **Hold** — squares the blade in the water to check/brake and yaw the boat.
- **Back down** — reverses.

**Other keys:**
- `P` / `Esc` — pause/resume
- `R` — reset to start

**Menu buttons (top-right of the simulation):**
- **Toggle View** — switches between North View and Boat View
- **Reset (R)** — boat back to start, gates cleared
- **Menu** — back to the landing screen

## Views

### North View (default)
World-fixed, north-up. The boat rotates on the map. The camera follows with a slight lead in the direction of travel.

### Boat View
Boat-fixed, world rotates around the boat. The boat's bow always points **down** on screen. Grid lines, gates, and debug vectors all rotate with the world to give a sense of motion.

**On mobile/touch devices:** the on-screen left/right buttons automatically swap port/stbd sides in Boat View so screen-left controls starboard oars (starboard is now screen-left with bow-down orientation).

## Features

- Realistic 2x rigid-body physics (anisotropic drag, oar-offset torque)
- Per-side 3-state oar control (row / hold / back-down)
- Camera toggle — north-up ↔ boat-relative
- Open-water scenario with sequential gates (1 → 2 → …)
- Off-screen target indicator (chevron orbiting the boat)
- On-screen touch controls (mobile/touch devices, auto-swap in boat view)
- Debug overlay (velocity/heading vectors, toggled in config)
- Deterministic fixed-timestep simulation (Δt = 1/60 s)

## Tech

- **Language:** TypeScript
- **Build:** Vite
- **Renderer:** HTML5 Canvas (2D)
- **Physics:** Semi-implicit Euler, hull-local anisotropic drag

## Project structure

```
rowing-game/
├── index.html          # Landing/menu screen + canvas + touch controls
├── src/
│   ├── main.ts         # Game loop, HUD, input setup, view toggle
│   ├── physics.ts      # Rigid-body boat physics
│   ├── render.ts       # Canvas renderer (grid, shore, gates, boat, debug)
│   ├── camera.ts       # Follow camera + view modes (north-up / boat-relative)
│   ├── input.ts        # Keyboard + gamepad input → oar commands
│   ├── config.ts       # All tunables (boat dimensions, drag, camera, render)
│   ├── types.ts        # Shared type definitions
│   └── levels.ts       # Level data (gates, start pose, bounds)
├── vite.config.ts      # Vite configuration
└── package.json
```

## Development

```bash
npm install
npm run dev        # Start Vite dev server
npm run typecheck  # Type-check without emitting
npm run build      # Type-check + production build
```

The dev server binds to `localhost:5173` by default. For network access (e.g. testing from another machine):

```bash
npm run dev -- --host
```

## Roadmap (not yet built)

- Per-oar independent control (the actual learning goal — each rower's each oar)
- River flow / current and wind / gusts
- Other boats / river traffic with collision
- Landing-stage docking scenarios
- Scoring + leaderboard with server-side replay validation
- More courses (busy river, slalom)
- Sound / haptics