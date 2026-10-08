## Tech Stack
- Engine: Phaser 3 (npm)
- Bundler: Vite, svelte-ts template
- UI: Svelte (Town Phase DOM layer)
- Language: TypeScript throughout
- Testing: Vitest for simulation logic

## Architecture (module boundaries)
- /src/sim/    — pure TS, zero Phaser/Svelte/data imports (data depends on sim,
                  never the reverse). Adventurer, Action, Battle resolution, Grid
                  logic. Deterministic, unit-testable; RNG and item/action
                  lookups are always injected, never hardcoded or called
                  directly, so tests stay deterministic.
- /src/data/   — TS definitions: character/enemy templates, Actions, Special
                  Actions, items. Data-driven, not hardcoded in sim logic.
- /src/game/   — Phaser scenes. Reads sim state, renders the 3x3 grid + tweened
                  movement. Never mutates sim state directly.
- /src/ui/     — Svelte components for the Town Phase (roster, equipment,
                  recruitment, character sheet) and the dungeon-run pause/
                  replay screens.
- /src/state/  — Svelte stores wrapping sim state + persistence (save/load).

## Core Mechanics
1. **Town Phase:** Management mode using HTML/DOM UI layered over the canvas —
   manage the roster, equip/unequip items, recruit, and view each character's
   kit on their character sheet.
2. **Dungeon Phase:** Turn-based auto-battling on a 3x3-per-side grid
   (`{lane, rank}` positions). No dice/action-queue step: each turn always
   resolves the character's deterministic Basic Action, then evaluates their
   Special Action's trigger (`on-turn-start`/`on-hit-landed`/`on-hit-taken`/
   `on-ally-downed`/`on-enemy-downed`) and any always-on Traits — see
   `docs/character-abilities.md` for the full per-character catalog and
   `docs/kit-trait-tag-framework.md` for the Kit/Trait/Tag system layered on
   top (Tags, Auras, Kit variants, the universal Trait pool).
3. **Movement:** Character positions are stored as grid coordinates
   (`{lane, rank}`), but visually render using Phaser Tweens to glide, lunge,
   and slide smoothly between tiles.

## Persistence
- localStorage (roster, equipment, town storage, active run, recruitment pool,
  run history) — a single serializable save-state object owned by /src/state/,
  versioned (see state/persistence.ts's CURRENT_SAVE_VERSION). A save that
  predates the current version is discarded (treated as a fresh start), not
  migrated.

## Dev Commands
- Dev server: npm run dev
- Build: npm run build
- Test sim logic: npm run test