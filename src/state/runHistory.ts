import { writable } from 'svelte/store';
import { INITIAL_SAVE } from './persistence';

/**
 * A foundation for future achievements/branching paths keyed by character
 * (e.g. "clear a run with Gudrun", a story path only available once cleared
 * with a specific character) — deliberately minimal for now, just the raw
 * history a later feature can read. See dungeonOrchestrator.ts's
 * finishDungeonRun for where this gets written.
 */
export interface RunHistoryState {
  /**
   * Adventurer ids who have been in the party for at least one completed
   * (won) run — every party member gets credit, not just survivors, since
   * "cleared with X" means X was part of the clear, not that they
   * personally never went Downed along the way.
   */
  clearedWithIds: string[];
  /** Per-character run stats, keyed by adventurer id — shown on the Progress screen and character sheet. Missing entry = never taken on a run. */
  characterStats: Record<string, CharacterRunStats>;
}

export interface CharacterRunStats {
  /** Runs this character was in the party for, however they ended. */
  runs: number;
  /** Runs completed (every room cleared) with this character in the party. */
  clears: number;
  /** Most rooms won in any single run with this character in the party. */
  bestRoomsWon: number;
}

export function createEmptyRunHistory(): RunHistoryState {
  return { clearedWithIds: [], characterStats: {} };
}

function createInitialRunHistoryState(): RunHistoryState {
  return INITIAL_SAVE?.runHistory ?? createEmptyRunHistory();
}

/**
 * Records one finished run for every member of `partyIds`: bumps their run
 * count (and clear count on a completed run), raises their best rooms-won,
 * and adds them to clearedWithIds on a clear. Pure — returns a new state.
 */
export function recordRun(history: RunHistoryState, partyIds: string[], roomsWon: number, completed: boolean): RunHistoryState {
  const characterStats = { ...history.characterStats };
  for (const id of partyIds) {
    const previous = characterStats[id] ?? { runs: 0, clears: 0, bestRoomsWon: 0 };
    characterStats[id] = {
      runs: previous.runs + 1,
      clears: previous.clears + (completed ? 1 : 0),
      bestRoomsWon: Math.max(previous.bestRoomsWon, roomsWon),
    };
  }
  const clearedWithIds = completed ? [...new Set([...history.clearedWithIds, ...partyIds])] : history.clearedWithIds;
  return { clearedWithIds, characterStats };
}

/** Sourced from a save if one exists, otherwise empty — nobody's cleared a run yet on a fresh install. */
export const runHistory = writable<RunHistoryState>(createInitialRunHistoryState());
