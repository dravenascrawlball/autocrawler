import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';
import { createBattleState } from './battle';
import { resolveRoom, type RoomResult } from './room';
import { getEffectiveStat } from './stats';
import type { Relic } from './relics';
import type { RngSource } from './rng';
import { assignUniquePositions } from './formation';
import { applySynergies, type Synergy } from './synergies';
import { applyRelicScaling } from './relics';

/** How a completed dungeon run ended. */
export type DungeonOutcome = 'completed' | 'loss' | 'retreat';

/** Base heal applied between rooms, run through getEffectiveStat so StatModifiers can adjust it later. */
export const DEFAULT_INTER_ROOM_HEAL_FLAT = 5;
/** Fraction of effective maxHp a Downed party member is revived to between rooms — part of the Autobattle Revision Cleanup's "Heal Downed Characters Between Fights" pass (see docs/roadmap.md). */
export const DOWNED_REVIVE_HP_FRACTION = 0.7;

/** A dungeon is split into floors of this many rooms, each ending in a boss (the 15-room dungeon — see data/rooms.ts). */
export const ROOMS_PER_FLOOR = 5;

/** 1-based floor number for a 0-based room index. */
export function floorOf(roomIndex: number): number {
  return Math.floor(roomIndex / ROOMS_PER_FLOOR) + 1;
}

export interface RoomDefinition {
  enemies: Adventurer[];
  maxRounds?: number;
  /** Flat gold paid out for winning this room, on top of enemy goldDrops — see data/rooms.ts's ROOM_SLOT_CLEAR_GOLD. Absent means 0. */
  clearGold?: number;
}

export interface PartyMemberSnapshot {
  id: string;
  hp: number;
}

export interface DungeonRoomRecord {
  roomIndex: number;
  /** Party state right after that room's position reset and heal, before combat runs. */
  partyAtRoomStart: PartyMemberSnapshot[];
  result: RoomResult;
}

export interface DungeonRunResult {
  outcome: DungeonOutcome;
  rooms: DungeonRoomRecord[];
}

/**
 * Held by the caller across a room-by-room run so it can pause between rooms
 * (e.g. for equipment changes or a Retreat choice) instead of resolving the
 * whole dungeon in one synchronous pass. `party` is the same Adventurer
 * references passed to startDungeonRun, mutated in place by each
 * resolveNextRoom call. These are the run's *drafted* party — the same
 * persistent per-character records the town roster holds (see
 * state/roster.ts) — reset back to their template baseline once the run
 * ends (see adventurer.ts's resetToTemplateBaseline).
 */
export interface DungeonRunState {
  party: Adventurer[];
  rooms: RoomDefinition[];
  /** Index into `rooms` of the room resolveNextRoom will resolve next. */
  roomIndex: number;
  /** Ids of every party member who was Downed at least once this run — "was", not "is still": healBetweenRooms now revives a Downed member before the next room (see its own doc comment), so this no longer implies they're currently out. Not consumed anywhere today; kept for a future run-recap/achievement surface. */
  downedDuringRun: Set<string>;
  roomRecords: DungeonRoomRecord[];
  /** The town's banked gold at run start — threaded into each room's BattleState for Nerissa's Gilded Strike (see battle.ts's BattleState.partyGold doc comment). */
  partyGold: number;
  /** Relics bought from the between-room shop so far this run — see state/dungeonOrchestrator.ts's buyRelicOffer. Granted to every current party member on purchase, and to anyone who joins afterward (see buyRecruitOffer). */
  activeRelics: Relic[];
  /** Role synergy definitions (data/synergies.ts), injected — re-evaluated against the party at every room start. See sim/synergies.ts. */
  synergies: Synergy[];
}

function snapshotParty(party: Adventurer[]): PartyMemberSnapshot[] {
  return party.map((adventurer) => ({
    id: adventurer.id,
    hp: adventurer.hp,
  }));
}

/**
 * Applies the automatic between-room heal, capped at maxHp. A Downed party
 * member (hp <= 0) is revived instead, at DOWNED_REVIVE_HP_FRACTION of
 * their effective maxHp — no longer a permanent-for-the-run state (the
 * Autobattle Revision Cleanup's "Heal Downed Characters Between Fights"
 * pass, see docs/roadmap.md; DungeonRunState's downedDuringRun tracking
 * predates this and is now a "was Downed at some point" record, not "is
 * still Downed"). Also clears `downedSummary` so a later down this run
 * produces a fresh one, rather than silently reusing the old one — same
 * reasoning as Mira's Revive ability (see actions/heal.ts's ReviveAction).
 */
function healBetweenRooms(party: Adventurer[]): void {
  for (const adventurer of party) {
    const effectiveMaxHp = getEffectiveStat(adventurer.maxHp, 'maxHp', adventurer.modifiers);

    if (adventurer.hp <= 0) {
      adventurer.hp = Math.round(effectiveMaxHp * DOWNED_REVIVE_HP_FRACTION);
      adventurer.downedSummary = undefined;
      continue;
    }

    const heal = getEffectiveStat(DEFAULT_INTER_ROOM_HEAL_FLAT, 'interRoomHeal', adventurer.modifiers);
    adventurer.hp = Math.min(effectiveMaxHp, adventurer.hp + heal);
  }
}

/**
 * Begins a dungeon run for `party` (the drafted 4, or fewer) through `rooms`
 * in order. Resolves no combat itself — call resolveNextRoom to advance
 * room by room. `party` arrives at full HP by construction (a draft pick is
 * either freshly reset via resetToTemplateBaseline, or has simply never
 * been on a run yet) — there's no cross-run injury to carry in anymore.
 */
export function startDungeonRun(
  party: Adventurer[],
  rooms: RoomDefinition[],
  partyGold = 0,
  synergies: Synergy[] = [],
): DungeonRunState {
  if (rooms.length === 0) {
    throw new Error('startDungeonRun requires at least one room');
  }

  return { party, rooms, roomIndex: 0, downedDuringRun: new Set(), roomRecords: [], partyGold, activeRelics: [], synergies };
}

/**
 * Resolves exactly one room — `state.rooms[state.roomIndex]` — and advances
 * `state.roomIndex`. Between rooms (roomIndex > 0): heals the party via
 * `healBetweenRooms` (HP is never reset, only healed/revived, and never
 * above maxHp — see that function's own doc comment for Downed revival).
 * Formation (each member's full lane/rank grid position) is a player
 * choice that persists across rooms, not reset here — see
 * state/townActions.ts's setAdventurerPosition.
 *
 * Returns the run's final outcome once it ends (Loss or a room-level
 * Retreat outcome ends it immediately; a Win on the last room completes
 * it). Returns null if the run should pause here: there are more rooms left
 * and the caller (e.g. to let the player adjust equipment, or choose to
 * retreat via `retreatDungeonRun`) should call resolveNextRoom again once
 * ready to continue.
 *
 * A room that hits its round cap without either side wiped (see
 * resolveRoom) comes back as a 'retreat' outcome, not `null` — it's handled
 * by the same branch as a player-chosen retreat, ending the run immediately.
 */
export function resolveNextRoom(state: DungeonRunState, rng: RngSource = () => Math.random()): DungeonOutcome | null {
  const { party, rooms, roomIndex } = state;
  const room = rooms[roomIndex];

  if (roomIndex > 0) {
    healBetweenRooms(party);
  }
  // One unit per cell — see formation.ts's assignUniquePositions. Normally a no-op (the player's
  // placement, or placeUnplaced on Continue, already guarantees it); catches old saves and callers
  // that never placed anyone.
  assignUniquePositions(party);
  // In-run snowballing (roadmap item 6): synergies and scaling relics are recomputed for the party
  // as it stands now. Every room before this one was won (a loss ends the run), so roomIndex is
  // the rooms-cleared count — and unlike roomRecords, it survives a save/resume.
  applySynergies(party, state.synergies);
  applyRelicScaling(party, state.activeRelics, roomIndex);

  const partyAtRoomStart = snapshotParty(party);
  // Displacement (e.g. the Chain Warden's Hook Chain) moves heroes only for this fight — the
  // player's chosen formation comes back afterward.
  const formation = new Map(party.map((member) => [member.id, { ...member.position }]));
  const battle: BattleState = createBattleState(party, room.enemies, state.partyGold);
  const result = resolveRoom(battle, rng, room.maxRounds, roomIndex);
  for (const member of party) member.position = formation.get(member.id) ?? member.position;

  state.roomRecords.push({ roomIndex, partyAtRoomStart, result });

  for (const adventurer of party) {
    if (adventurer.hp <= 0) {
      state.downedDuringRun.add(adventurer.id);
    }
  }

  state.roomIndex += 1;

  if (result.outcome === 'loss' || result.outcome === 'retreat') {
    return result.outcome;
  }
  if (state.roomIndex >= rooms.length) {
    return 'completed';
  }
  return null;
}

/** Ends the run early at a between-room pause point, e.g. from a player-chosen Retreat. */
export function retreatDungeonRun(): DungeonOutcome {
  return 'retreat';
}

/** Convenience wrapper: resolves every room of a run in one synchronous pass, with no pause between rooms. */
export function runDungeon(
  party: Adventurer[],
  rooms: RoomDefinition[],
  rng: RngSource = () => Math.random(),
  partyGold = 0,
): DungeonRunResult {
  const state = startDungeonRun(party, rooms, partyGold);
  let outcome: DungeonOutcome | null = null;
  while (outcome === null) {
    outcome = resolveNextRoom(state, rng);
  }
  return { outcome, rooms: state.roomRecords };
}
