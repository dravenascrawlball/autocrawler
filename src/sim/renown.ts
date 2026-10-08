import type { DungeonOutcome, DungeonRoomRecord } from './dungeonRun';

/** Renown earned per room actually won, regardless of how the run ultimately ends — placeholder pending the balance pass, same convention as recruitCost/item prices. */
export const ROOM_CLEAR_RENOWN = 3;
/** Extra Renown earned only when the whole run completes (every room cleared) — meaningfully bigger than the per-room floor so finishing is worth chasing, not just surviving a while. */
export const RUN_COMPLETION_BONUS_RENOWN = 15;

/**
 * Renown earned for one finished run: ROOM_CLEAR_RENOWN per room actually
 * won (the floor — a loss or retreat still banks credit for whatever was
 * cleared beforehand) plus RUN_COMPLETION_BONUS_RENOWN if `outcome` is
 * 'completed'. `outcome` accepts null since a retreat never actually sets
 * DungeonPlaybackState.outcome before finishDungeonRun runs (see
 * state/dungeonOrchestrator.ts) — treated the same as any other
 * non-'completed' outcome, no bonus.
 */
export function calculateRunRenown(roomRecords: DungeonRoomRecord[], outcome: DungeonOutcome | null): number {
  const roomsWon = roomRecords.filter((record) => record.result.outcome === 'win').length;
  const completionBonus = outcome === 'completed' ? RUN_COMPLETION_BONUS_RENOWN : 0;
  return roomsWon * ROOM_CLEAR_RENOWN + completionBonus;
}
