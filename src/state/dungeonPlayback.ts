import { get, writable } from 'svelte/store';
import type { DungeonOutcome, DungeonRoomRecord, DungeonRunState } from '../sim/dungeonRun';
import type { RunInventory } from '../sim/items';
import { INITIAL_SAVE } from './persistence';
import { roster } from './roster';

export interface DungeonPlaybackState {
  /** Live sim state for the run in progress — resolveNextRoom mutates it in place as rooms are resolved. */
  runState: DungeonRunState;
  /** Loot rolled so far this run, merged into town storage once the run ends. */
  inventory: RunInventory;
  /**
   * The room record the Phaser layer should currently be replaying — absent
   * only when resuming a run from a save (see resumeFromSave below), which
   * always lands directly on the Between-Rooms pause screen rather than
   * re-animating the last room's battle.
   */
  currentRecord?: DungeonRoomRecord;
  /** Non-null once the run has ended (this is the last room to replay); null means more rooms remain and the run pauses, once this room finishes replaying, for the player to act (equip, retreat) before continuing. */
  outcome: DungeonOutcome | null;
}

/**
 * Reconstructs a paused, ready-to-continue DungeonPlaybackState from a
 * saved run (see state/activeRun.ts's ActiveDungeonRunState) so closing and
 * reopening the app mid-run picks back up where it left off instead of
 * losing the run entirely. `party` is rebuilt by looking up each persisted
 * id against the already-loaded roster, so it shares the exact same live
 * Adventurer references the rest of the app expects — equip/unequip, HP,
 * etc. all stay in sync automatically, same as during a live run.
 * `downedDuringRun` is re-derived from current HP (Downed persists for the
 * rest of a run once triggered, so anyone at 0 HP now was necessarily
 * downed during it). `roomRecords` starts fresh empty — see
 * ActiveDungeonRunState's own doc comment for why that log never needs to
 * survive a reload.
 */
function resumeFromSave(): DungeonPlaybackState | null {
  const saved = INITIAL_SAVE?.activeRun;
  if (!saved) {
    return null;
  }

  const rosterAdventurers = get(roster).adventurers;
  const party = saved.partyIds
    .map((id) => rosterAdventurers.find((adventurer) => adventurer.id === id))
    .filter((adventurer): adventurer is NonNullable<typeof adventurer> => adventurer !== undefined);
  if (party.length === 0) {
    return null; // shouldn't happen, but a run with nobody left to resume isn't resumable
  }

  const downedDuringRun = new Set(
    party.filter((adventurer) => adventurer.hp <= 0).map((adventurer) => adventurer.id),
  );

  return {
    runState: {
      party,
      rooms: saved.rooms,
      roomIndex: saved.currentRoomIndex,
      downedDuringRun,
      roomRecords: [],
      partyGold: saved.partyGold,
    },
    inventory: saved.inventory,
    outcome: saved.outcome,
  };
}

/** Set by startDungeon (or reconstructed from a save at boot — see resumeFromSave), read/advanced by the Phaser replay layer and the between-room pause UI, cleared by finishDungeonRun. */
export const dungeonPlayback = writable<DungeonPlaybackState | null>(resumeFromSave());
