import { ROOMS_PER_FLOOR, type DungeonOutcome, type DungeonRoomRecord } from './dungeonRun';

/** Renown earned per room actually won, regardless of how the run ultimately ends — placeholder pending the balance pass, same convention as recruitCost/item prices. */
export const ROOM_CLEAR_RENOWN = 3;
/** Extra Renown earned only when the whole run completes (every room cleared) — meaningfully bigger than the per-room floor so finishing is worth chasing, not just surviving a while. */
export const RUN_COMPLETION_BONUS_RENOWN = 15;
/** Extra Renown for every full floor cleared (every ROOMS_PER_FLOOR rooms won) — so a run that falls on floor 2 or 3 still pays out for the floors behind it. */
export const FLOOR_CLEAR_RENOWN = 10;

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
  return calculateRunRenownBreakdown(roomRecords, outcome).total;
}

/** Where a run's Renown came from — shown on the run-end recap and the town toast (see ui/DungeonPauseView.svelte / ui/TownPhase.svelte). */
export interface RunRenownBreakdown {
  roomsWon: number;
  roomRenown: number;
  floorsCleared: number;
  floorBonus: number;
  completionBonus: number;
  total: number;
}

/** The same calculation as calculateRunRenown, itemized. */
export function calculateRunRenownBreakdown(roomRecords: DungeonRoomRecord[], outcome: DungeonOutcome | null): RunRenownBreakdown {
  const roomsWon = roomRecords.filter((record) => record.result.outcome === 'win').length;
  const roomRenown = roomsWon * ROOM_CLEAR_RENOWN;
  const floorsCleared = Math.floor(roomsWon / ROOMS_PER_FLOOR);
  const floorBonus = floorsCleared * FLOOR_CLEAR_RENOWN;
  const completionBonus = outcome === 'completed' ? RUN_COMPLETION_BONUS_RENOWN : 0;
  return { roomsWon, roomRenown, floorsCleared, floorBonus, completionBonus, total: roomRenown + floorBonus + completionBonus };
}
