import type { Adventurer } from './adventurer';
import type { StatModifier } from './stats';

/**
 * Permanent per-character growth (roadmap item 5): Training ranks bought
 * with Renown on the Progress screen (state/townActions.ts's
 * buyTrainingRank), persisted per character name in metaProgression.
 * Deliberately small and capped — a fully trained character is noticeably
 * stronger but the run is still a run (balance target: ~50-55% full clear
 * fresh, ~65-70% fully grown — see balanceSim.test.ts's
 * BALANCE_SIM_TRAINING).
 */
export const MAX_TRAINING_RANK = 5;
/** Percent maxHp, attackPower and healPower each Training rank adds. */
export const TRAINING_PERCENT_PER_RANK = 2;
/** `source` on every Training StatModifier — how applyTraining finds and replaces them. */
export const TRAINING_MODIFIER_SOURCE = 'training';

/** Renown cost of going from `currentRank` to the next rank (20, 30, 40, 50, 60), or null at the cap. */
export function trainingCost(currentRank: number): number | null {
  return currentRank >= MAX_TRAINING_RANK ? null : 20 + 10 * currentRank;
}

/** Training's StatModifiers at `rank` — empty at rank 0. */
export function trainingModifiers(rank: number): StatModifier[] {
  if (rank <= 0) return [];
  const amount = rank * TRAINING_PERCENT_PER_RANK;
  return (['maxHp', 'attackPower', 'healPower'] as const).map((stat) => ({
    stat,
    type: 'percent',
    amount,
    source: TRAINING_MODIFIER_SOURCE,
  }));
}

/** Sets `adventurer`'s Training to `rank` in place, replacing whatever Training modifiers they had. */
export function applyTraining(adventurer: Adventurer, rank: number): void {
  adventurer.modifiers = [
    ...adventurer.modifiers.filter((modifier) => modifier.source !== TRAINING_MODIFIER_SOURCE),
    ...trainingModifiers(rank),
  ];
}
