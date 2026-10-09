import { writable } from 'svelte/store';
import type { DungeonOutcome, RoomDefinition } from '../sim/dungeonRun';
import type { RunInventory } from '../sim/items';
import type { Relic } from '../sim/relics';
import { INITIAL_SAVE } from './persistence';

/**
 * A resumable snapshot of the in-progress run — kept in sync with
 * state/dungeonPlayback.ts's live DungeonPlaybackState (see
 * dungeonOrchestrator.ts's touchActiveRun) so closing/reloading the app
 * mid-run doesn't lose it (see state/dungeonPlayback.ts's resumeFromSave,
 * the reverse direction). Deliberately omits the room-by-room battle event
 * log (DungeonRunState.roomRecords) — resuming always lands on the
 * Between-Rooms pause screen rather than re-animating a past room, so that
 * log is never needed again once a room's outcome is already decided.
 */
export interface ActiveDungeonRunState {
  rooms: RoomDefinition[];
  currentRoomIndex: number;
  /** Roster ids currently deployed on this run; their live hp lives on the roster's own Adventurer objects. */
  partyIds: string[];
  /** The town's banked gold snapshotted at run start — see sim/dungeonRun.ts's DungeonRunState.partyGold. */
  partyGold: number;
  inventory: RunInventory;
  /** Non-null once the run has ended but the player hasn't hit "Return to Town" yet. */
  outcome: DungeonOutcome | null;
  /** Relics bought from the between-room shop so far — see sim/dungeonRun.ts's DungeonRunState.activeRelics. */
  activeRelics: Relic[];
  /** A floor-boss reward pick was waiting when the game was saved — resume re-rolls the cards (see dungeonPlayback.ts's resumeFromSave). */
  milestonePending?: boolean;
}

/** Sourced from a save if one exists; null means no run is in progress. */
export const activeRun = writable<ActiveDungeonRunState | null>(INITIAL_SAVE?.activeRun ?? null);
