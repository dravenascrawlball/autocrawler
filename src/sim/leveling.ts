import type { Adventurer } from './adventurer';
import type { ActionId } from './action';

export const ACTION_LEVEL_PERCENT_PER_LEVEL = 15;

/**
 * Percent bonus (0 at level 1, scaling by ACTION_LEVEL_PERCENT_PER_LEVEL per
 * level beyond that) for `actionId` at `adventurer`'s current level in it —
 * a live combat multiplier (see actions/attack.ts/heal.ts), independent of
 * the dupe-draw `level`/levelUpAdventurer below. Nothing currently bumps
 * `actionLevels` (the old pick-an-action-to-level offer this fed is gone —
 * see docs/roadmap.md's Level Up Rework), so every action effectively sits
 * at its level-1 baseline today; kept rather than ripped out since
 * attack/heal's formulas already read it and a future system (a Kit
 * upgrade? a relic?) may want to grant it again.
 */
export function actionLevelPercentBonus(adventurer: Adventurer, actionId: ActionId): number {
  const level = adventurer.actionLevels[actionId] ?? 1;
  return (level - 1) * ACTION_LEVEL_PERCENT_PER_LEVEL;
}

/**
 * Percent stat growth applied by levelUpAdventurer — deliberately large
 * (autobattler duplicate-unit convention: TFT/Super Auto Pets-style, a
 * meaningfully stronger unit per level, not an incremental XP trickle).
 */
export const DUPE_LEVEL_STAT_PERCENT = 25;

/**
 * Levels up `adventurer` in place — triggered by the between-room shop's
 * Recruit section rolling a character already in the run's party (see
 * state/dungeonOrchestrator.ts's buyRecruitOffer): instead of adding a
 * duplicate to the party, the existing copy gets stronger. Bumps `level`
 * and scales maxHp/attackPower/healPower up by DUPE_LEVEL_STAT_PERCENT,
 * healing to the new (higher) max in the process. Scoped to a single run —
 * resetToTemplateBaseline wipes it back to template stats once the run
 * ends, same as every other mid-run-only growth lever.
 */
export function levelUpAdventurer(adventurer: Adventurer): void {
  const scale = 1 + DUPE_LEVEL_STAT_PERCENT / 100;
  adventurer.level += 1;
  adventurer.maxHp = Math.round(adventurer.maxHp * scale);
  adventurer.attackPower = Math.round(adventurer.attackPower * scale);
  adventurer.healPower = Math.round(adventurer.healPower * scale);
  adventurer.hp = adventurer.maxHp;
}
