import { writable } from 'svelte/store';
import { INITIAL_SAVE } from './persistence';

/**
 * Cross-run meta-progression currency and Kit unlocks (Town Storage
 * Cleanup's deferred "some kind of meta-progression thing," see
 * docs/roadmap.md) — distinct from a dungeon run's own gold (purely
 * run-scoped, never banks here) and from the free, automatic
 * clearedWithIds/CHARACTER_UNLOCK_POOL unlock system (state/runHistory.ts),
 * which this doesn't touch. Earned per run (see sim/renown.ts's
 * calculateRunRenown) and spent on Recruit (sim/recruitment.ts) and the
 * Shop's Kit roster (ui/ShopView.svelte, data/kitShop.ts).
 */
export interface MetaProgressionState {
  renown: number;
  /** Character name (matches AdventurerTemplate.name) -> ids of Kits bought from the Shop — merged into that character's kitPool at their next creation/reset (see sim/adventurer.ts). */
  unlockedKitIds: Record<string, string[]>;
}

function createInitialMetaProgressionState(): MetaProgressionState {
  return INITIAL_SAVE?.metaProgression ?? { renown: 0, unlockedKitIds: {} };
}

/** Sourced from a save if one exists, otherwise nobody's earned any Renown yet. */
export const metaProgression = writable<MetaProgressionState>(createInitialMetaProgressionState());
