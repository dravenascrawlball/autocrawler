import type { Adventurer } from './adventurer';
import type { RngSource } from './rng';

export const DRAFT_ROUND_COUNT = 4;
export const DRAFT_OFFERS_PER_ROUND = 3;

/**
 * Rolls one draft round's random offers: a uniform sample (no repeats) of
 * `size` characters from `unlockedAdventurers` minus whoever's already been
 * picked this draft (`alreadyPicked` — by id). Shrinks gracefully if fewer
 * than `size` remain eligible, rather than erroring or padding with
 * duplicates. Draws from the same persistent per-character records the
 * town roster holds, so an offer's preview reflects real current equipment.
 */
export function generateDraftRound(
  unlockedAdventurers: Adventurer[],
  alreadyPicked: ReadonlySet<string>,
  rng: RngSource,
  size: number = DRAFT_OFFERS_PER_ROUND,
): Adventurer[] {
  const pool = unlockedAdventurers.filter((adventurer) => !alreadyPicked.has(adventurer.id));

  // Fisher-Yates partial shuffle: only need the first `size` slots to be
  // correctly randomized, not the whole array.
  const shuffled = [...pool];
  const drawCount = Math.min(size, shuffled.length);
  for (let i = 0; i < drawCount; i++) {
    const j = i + Math.floor(rng() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, drawCount);
}
