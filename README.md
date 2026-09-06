# Candyland Pinball

A local-first Three.js pinball game based on `design/candyland-pinball-mockup-v2.png`.

## Run

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Build a deployable static site with `npm run build`; serve `dist/` over HTTP. No backend, account, or API key is required.

## Controls

- **Enter:** start / play again
- **← / →** or **A / D:** flippers (right also controls the upper flipper)
- **Space:** hold to charge, release to launch
- **N:** nudge; three rapid nudges tilt
- **P:** pause / resume
- Touch controls provide independent flippers, nudge, and plunger.
- Camera button cycles three views. Sound can be muted; audio begins after interaction.

## Rules

Three balls per game. Each new ball has 12 seconds of ball save, which is not renewed by a saved-ball relaunch. Tilt disables flippers, scoring, and ball save until the current ball ends.

- Peppermint bumpers: 500 points.
- Candy drop targets: 1,000 each. Complete all five for a 10,000-point award and 30 seconds of double scoring.
- Ramps: 5,000. Alternate mint and berry shots within 25 seconds to increase the multiplier, capped at 5×.
- Lock scoop: 10,000. Three virtual locks start three-ball multiball. Further lock shots during multiball award a bonus without spawning more balls.
- Castle: 7,500 normally; during multiball it awards a 100,000-point jackpot, increasing by 25,000 per collection.
- Chocolate swirl: 4,000.
- A multiplier applies to awards, with an additional 2× during Sugar Rush.
- Personal best is stored in localStorage, with a safe fallback when storage is unavailable.

## Implementation

`src/physics.js` is an independent deterministic 240 Hz simulation: swept small substeps, capsule flipper collisions with moving-surface impulses, restitution, gravity, ball-to-ball collisions, targets, sensors, and game rules. The ball is constrained to the inclined playfield. Ramp and scoop traversal use scripted paths to model captive mechanisms; this is arcade pinball physics rather than a general 3D rigid-body solver.

`src/table.js` builds the actual 3D cabinet, curved translucent ramps, wire rails, candy mechanisms, and lighting. Static meshes are batched by material. The castle is an original Blender asset exported through the Blender MCP. Its editable source and reproducible generator are in `design/`.

`src/audio.js` synthesizes effects with Web Audio. `src/main.js` handles input, lifecycle, UI, and persistence. Blur/visibility changes pause the game and release held controls.

## Validation

```sh
npm test
npm run build
```

`tests/browser-smoke.mjs` runs an integration smoke test against a running dev server on port 5173. It uses a local Chrome installation, configurable through `CHROME_PATH`, and saves desktop/mobile screenshots in `design/`:

```sh
node tests/browser-smoke.mjs
```

The `?test=1` development-only hook exposes the simulation to integration tests. It is removed from production builds. `window.pinball` exposes read-only snapshots and rendering diagnostics.

## Scope

Desktop keyboard and mobile touch are implemented. This version does not include online leaderboards, payments, accounts, gamepad support, or multiplayer. Broad device QA and further human playtesting are appropriate before a commercial release; the browser test does not certify performance on every GPU or phone.
