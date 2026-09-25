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
}

function createInitialRunHistoryState(): RunHistoryState {
  return INITIAL_SAVE?.runHistory ?? { clearedWithIds: [] };
}

/** Sourced from a save if one exists, otherwise empty — nobody's cleared a run yet on a fresh install. */
export const runHistory = writable<RunHistoryState>(createInitialRunHistoryState());
