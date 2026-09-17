## Tech Stack
- Engine: Phaser 3 (npm)
- Bundler: Vite, svelte-ts template
- UI: Svelte (Town Phase DOM layer)
- Language: TypeScript throughout
- Testing: Vitest for simulation logic

## Architecture (module boundaries)
- /src/sim/    — pure TS, zero Phaser/Svelte imports. Adventurer, Action, 
                  Battle resolution, Grid logic. Deterministic, unit-testable.
- /src/data/   — TS/JSON definitions: adventurer templates, action definitions, 
                  items. Data-driven, not hardcoded in logic.
- /src/game/   — Phaser scenes. Reads sim state, renders grid + tweened movement.
                  Never mutates sim state directly.
- /src/ui/     — Svelte components for Town Phase (bench, inventory, action 
                  queue editor).
- /src/state/  — Svelte stores wrapping sim state + persistence (save/load).

## Core Mechanics
## Core Mechanics
1. **Town Phase:** Management mode using HTML/DOM UI layered over the canvas. Manage the adventurer bench, item inventory, and re-order character action queues.
2. **Dungeon Phase:** Turn-based auto-battling executed on a grid matrix.
3. **Movement:** Character positions are stored as grid indices (x, y), but visually render using Phaser Tweens to glide, lunge, and slide smoothly between tiles.

## Persistence
- localStorage to start (bench roster, injured status, inventory, action configs)
- Structured as a single serializable save-state object owned by /src/state/

## Dev Commands
- Dev server: npm run dev
- Build: npm run build
- Test sim logic: npm run test