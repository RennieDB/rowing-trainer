# Rowing Manoeuvring Trainer (PoC)

A browser-based trainer to help new rowers learn boat handling — starting with a
top-down coxless double (2x) on open water, controlled per-oar, with realistic
turn/yaw physics. Built with Vite + TypeScript, canvas rendering, no game
engine.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production (also type-checks):

```bash
npm run build    # outputs to dist/
npm run preview  # serve the build locally
```

## Controls (PoC: simplified scheme)

| Key            | Action                                  |
| -------------- | --------------------------------------- |
| W / ↑          | Both rowers drive forward (straight)    |
| S / ↓          | Both rowers back down (reverse)         |
| A / ←          | Starboard-only → yaw bow to port (left) |
| D / →          | Port-only → yaw bow to starboard (right)|
| Shift          | Reverse modifier (per-oar mode)         |

Gamepad: left stick = forward/back + turn (simple), or per-oar when
`CONTROL.scheme="perOar"` in `src/config.ts`.

Flip to full independent 4-oar control by setting `CONTROL.scheme` to
`"perOar"` in `src/config.ts` (mapping: Q/E rower A port/starboard, Z/C rower B).

## How it works

- `src/physics.ts` — rigid-body boat: each oar applies force offset from the
  centreline, producing thrust **and** yaw torque. Anisotropic drag (strong
  lateral, weak longitudinal) makes it handle like a hull, not a puck.
- `src/input.ts` — maps keys/gamepad to an `OarCommands[4]` array. Physics
  never knows the control scheme.
- `src/camera.ts` / `src/render.ts` — top-down follow camera (north-up), canvas
  draw with debug vectors.
- `src/levels/` — scenarios are **data** (JSON). Add a file + register it; no
  engine changes. See `src/scenario.ts` for gate/win logic.
- `src/main.ts` — fixed-timestep loop (physics decoupled from render,
  deterministic).

All feel constants live in `src/config.ts`.

## Deploy to GitHub Pages (beta testing)

The build is static (`dist/`). Two easy options:

### Option A — GitHub Actions (recommended, zero manual steps)

1. Create the repo and push this project.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

4. Push to `main`. Your game appears at
   `https://<user>.github.io/<repo>/`.

### Option B — Manual

```bash
npm run build
# copy dist/ contents to a `docs/` folder (or use gh-pages branch)
git add docs && git commit -m "deploy" && git push
# Settings → Pages → Source: main branch /docs folder
```

Send the URL to club members for feedback. `vite.config.ts` already sets
`base: "./"` so it works from a project sub-path.

## Extending (Copilot tasks)

See `COPILOT_PROMPTS.md` for 10 scoped tasks: per-oar control, wind/gusts,
other boats, docking, scoring, replay, camera toggle, landing page.

## Roadmap

- Per-oar control (learning goal) — flip the config flag.
- River flow, wind, other boats, landing-stage docking (level data).
- Server-side leaderboard (validate replays via the deterministic sim).
