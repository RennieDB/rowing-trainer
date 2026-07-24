# Rowing Manoeuvring Trainer (PoC)

A browser-based trainer to help new rowers learn boat handling — a top-down
coxless double (2x), modelled as a ~9.5 m rigid hull on open water, with
realistic turn/yaw physics. Built with Vite + TypeScript, canvas rendering, no
game engine.

**Live demo:** https://renniedb.github.io/rowing-trainer/

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173  (add -- --host to test from another device on your LAN)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

Requires Node 20+.

## Controls (current PoC — per-side)

Each **side** drives both rowers' same-side oars together. The two sides are
fully independent, so you can, for example, hold port while rowing starboard.

| Action | Port (left) | Starboard (right) |
| --- | --- | --- |
| Row on (drive forward) | `Q` | `W` |
| Hold (square blade — brake / "check") | `A` | `S` |
| Back down (reverse) | `Z` | `X` |

- Both sides together → goes straight. One side only → the boat turns (port
  drives the bow to port, starboard to starboard).
- `R` — reset the level (boat back to start, gates cleared).
- `Esc` / `P` — pause (overlay with Resume / Restart / Menu).
- `Enter` or **Launch trainer** — start from the landing screen.

A landing/menu screen explains the controls and start/stop before play.
Gamepad support is planned (left/right stick = port/starboard effort), not yet
wired.

To switch schemes, change `CONTROL.scheme` in `src/config.ts`:
`"simple"` (legacy single-stick), `"sideBySide"` (current), or `"perOar"`
(full independent 4-oar control — stubbed, the learning goal). Physics is
identical regardless of scheme.

## How it works

- `src/physics.ts` — rigid-body boat: each oar applies force offset from the
  centreline, producing thrust **and** yaw torque. Anisotropic drag (very high
  lateral, low longitudinal) makes it handle like a hull, not a puck. Angular
  drag is applied as a torque divided by **inertia**, so yaw stops quickly when
  you stop rowing.
- `src/input.ts` — the only layer that knows about keys/gamepad. Emits an
  `OarCommand[4]` consumed identically by physics, so the control scheme is
  swappable.
- `src/camera.ts` / `src/render.ts` — top-down follow camera (north-up, world
  scroll), canvas draw with debug vectors.
- `src/levels/` — scenarios are **data** (JSON). Add a file + register it; no
  engine changes. See `src/scenario.ts` for gate/win logic.
- `src/main.ts` — fixed-timestep loop (physics decoupled from render,
  deterministic — enables later server-side replay validation).

All "feel" constants live in `src/config.ts`.

## Deploy (GitHub Pages)

Deployment is automated: `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages on every push to `main` (using OpenID Connect — **no stored
token**). Live at **https://renniedb.github.io/rowing-trainer/**.

Manual alternative:

```bash
npm run build
# serve dist/ from any static host (Netlify / Cloudflare Pages drag-and-drop, etc.)
```

`vite.config.ts` sets `base: "./"` so it works from a project sub-path.

## License

Copyright © 2026 David Rennie. **All rights reserved.** See
[LICENSE](LICENSE). Permission to use, copy, modify, or distribute this
software is granted only with the express written permission of the copyright
holder.

## Roadmap

- **Per-oar control** — the actual learning goal: drive each rower's each oar
  independently (`CONTROL.scheme = "perOar"` is stubbed).
- River flow / current and wind / gusts.
- Other boats / river traffic with collision.
- Landing-stage docking scenarios (away-from / onto the bank).
- Scoring + leaderboard with server-side replay validation.
- More courses (busy river, slalom) — the level framework is already data-driven.
- Camera toggle (boat-relative view); sound / haptics; mobile/touch controls.
