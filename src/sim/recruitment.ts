import type { Adventurer } from './adventurer';
import type { RenownWallet } from './shop';

export const DEFAULT_RECRUITMENT_POOL_SIZE = 3;
/** Roughly 3 moderately successful runs' worth of gold (placeholder, per the ~42g/run net measured in the balance pass) — recruiting is meta-progression now, not a cheap early buy. */
export const DEFAULT_RECRUIT_COST = 150;

export interface RecruitCandidate {
  id: string;
  adventurer: Adventurer;
  cost: number;
}

/**
 * Generates the current recruitment pool: every unlocked character not
 * already recruited, in roster order, capped at `size` (default
 * DEFAULT_RECRUITMENT_POOL_SIZE). Pulls the actual persistent per-character
 * records (not fresh template previews) so a candidate's preview reflects
 * their real currently-equipped gear. `costLookup` is injected (rather than
 * reading a template's `recruitCost` directly) so sim/ never depends on
 * data/ — the caller resolves id/name -> cost from CHARACTER_TEMPLATES.
 */
export function generateRecruitmentPool(
  unlockedAdventurers: Adventurer[],
  recruitedIds: ReadonlySet<string>,
  costLookup: (adventurer: Adventurer) => number,
  size: number = DEFAULT_RECRUITMENT_POOL_SIZE,
): RecruitCandidate[] {
  const eligible = unlockedAdventurers.filter((adventurer) => !recruitedIds.has(adventurer.id));

  return eligible.slice(0, size).map((adventurer) => ({
    id: adventurer.id,
    adventurer,
    cost: costLookup(adventurer),
  }));
}

/**
 * Recruits `candidate`: deducts its cost from `wallet.renown` (no-ops,
 * returning false, if that's insufficient — see state/metaProgression.ts;
 * Recruit moved off town gold entirely once gold stopped banking to town
 * at all, Town Storage Cleanup, see docs/roadmap.md) — adds the
 * candidate's id to `recruitedIds` and removes it from `pool`. Doesn't
 * touch the adventurer itself: the persistent record already exists
 * (every unlocked character has one — see state/roster.ts), recruiting
 * only grants "always offerable as a draft substitute" rights.
 */
export function recruitAdventurer(
  candidate: RecruitCandidate,
  pool: RecruitCandidate[],
  recruitedIds: string[],
  wallet: RenownWallet,
): boolean {
  if (wallet.renown < candidate.cost) {
    return false;
  }

  wallet.renown -= candidate.cost;
  recruitedIds.push(candidate.id);

  const index = pool.indexOf(candidate);
  if (index !== -1) {
    pool.splice(index, 1);
  }

  return true;
}
