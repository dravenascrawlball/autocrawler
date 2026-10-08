import type { SpecialAction } from './specialActions';
import type { Trait } from './traits';
import type { RngSource } from './rng';

/**
 * One candidate in a character's unlockable kit pool — either a Special
 * Action (trigger + action, see specialActions.ts) or a Trait (always-on
 * passive, see traits.ts). At join time, exactly one entry is granted (see
 * pickPoolEntry) — not every entry in the pool at once.
 *
 * A character's full pool is their template's base entry (see
 * data/characters.ts's retheme of each existing signature mechanic) plus
 * whatever they've unlocked through meta-progression (see
 * data/characterUnlocks.ts, gated on state/runHistory.ts's
 * clearedWithIds) — so a pool commonly has more than one entry, and the
 * pick genuinely needs to be random, not just "take the only one."
 */
export type CharacterPoolEntry =
  | { kind: 'special-action'; specialAction: SpecialAction }
  | { kind: 'trait'; trait: Trait };

/** Grants one uniformly-random entry from `pool` — null if the pool is empty. A pool of exactly one entry (the common case for a character with no unlocks yet) always resolves to that entry regardless of `rng`'s value. */
export function pickPoolEntry(pool: CharacterPoolEntry[], rng: RngSource): CharacterPoolEntry | null {
  if (pool.length === 0) {
    return null;
  }
  return pool[Math.floor(rng() * pool.length)];
}
