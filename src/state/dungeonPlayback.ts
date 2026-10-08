import { get, writable } from 'svelte/store';
import type { DungeonOutcome, DungeonRoomRecord, DungeonRunState } from '../sim/dungeonRun';
import type { RunInventory } from '../sim/items';
import { ITEM_REGISTRY } from '../data/items';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { RELIC_REGISTRY } from '../data/relics';
import { rollRecruitOffers, rollRelicOffers, rollEquipmentOffers, type ShopOffers, DEFAULT_RECRUIT_PRICE } from '../sim/shopOffers';
import { INITIAL_SAVE } from './persistence';
import { roster } from './roster';

/** Shared by resumeFromSave and dungeonOrchestrator.ts's startDungeon/continueDungeonRun — looks up a character's town recruit price by name, falling back to DEFAULT_RECRUIT_PRICE for anyone without one set. */
export function recruitPriceFor(name: string): number {
  return CHARACTER_TEMPLATES.find((template) => template.name === name)?.recruitCost ?? DEFAULT_RECRUIT_PRICE;
}

/** Rolls a fresh ShopOffers for a pause — shared by resumeFromSave (below) and dungeonOrchestrator.ts, which can't import each other (circular). */
export function rollShopOffers(runState: DungeonRunState, rng: () => number): ShopOffers {
  return {
    recruits: rollRecruitOffers(get(roster).adventurers, runState.party, (adventurer) => recruitPriceFor(adventurer.name), rng),
    relics: rollRelicOffers(RELIC_REGISTRY, runState.activeRelics, rng),
    equipment: rollEquipmentOffers(Object.values(ITEM_REGISTRY), rng),
  };
}

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
  /**
   * This pause's between-room shop offers (see rollShopOffers above) —
   * rerolled every pause; buying from one section (see
   * state/dungeonOrchestrator.ts's buyRecruitOffer/buyRelicOffer/
   * buyEquipmentOffer) only removes that specific offer, not the whole
   * section. Not persisted across a save/reload (see resumeFromSave below);
   * a resumed run just rolls a fresh one, same as a newly-reached pause.
   */
  shopOffers: ShopOffers;
}

/**
 * Reconstructs a paused, ready-to-continue DungeonPlaybackState from a
 * saved run (see state/activeRun.ts's ActiveDungeonRunState) so closing and
 * reopening the app mid-run picks back up where it left off instead of
 * losing the run entirely. `party` is rebuilt by looking up each persisted
 * id against the already-loaded roster, so it shares the exact same live
 * Adventurer references the rest of the app expects — equip/unequip, HP,
 * etc. all stay in sync automatically, same as during a live run.
 * `downedDuringRun` is re-derived from current HP — anyone at 0 HP right
 * now is necessarily Downed, so definitely belongs in the set; this
 * undercounts anyone who was Downed earlier in the run and already
 * revived by `healBetweenRooms` before this save happened, a known gap in
 * an otherwise-unconsumed field (see DungeonRunState's own doc comment).
 * `roomRecords` starts fresh empty — see
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

  const runState: DungeonRunState = {
    party,
    rooms: saved.rooms,
    roomIndex: saved.currentRoomIndex,
    downedDuringRun,
    roomRecords: [],
    partyGold: saved.partyGold,
    activeRelics: saved.activeRelics ?? [],
  };

  const shopOffers: ShopOffers =
    saved.outcome === null
      ? rollShopOffers(runState, () => Math.random())
      : { recruits: [], relics: [], equipment: [] };

  return { runState, inventory: saved.inventory, outcome: saved.outcome, shopOffers };
}

/** Set by startDungeon (or reconstructed from a save at boot — see resumeFromSave), read/advanced by the Phaser replay layer and the between-room pause UI, cleared by finishDungeonRun. */
export const dungeonPlayback = writable<DungeonPlaybackState | null>(resumeFromSave());
