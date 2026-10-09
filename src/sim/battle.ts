import type { Adventurer } from './adventurer';

export interface BattleState {
  adventurers: Adventurer[];
  enemies: Adventurer[];
  /** Set by triggerRetreat (via a Retreat action's outcome) to end the room early. */
  retreatRequested: boolean;
  /**
   * The town's banked gold, snapshotted once at run start (see
   * dungeonRun.ts's startDungeonRun) — used by Nerissa's Gilded Strike
   * (roadmap item 11) to scale damage with how rich the party currently
   * is. Deliberately a fixed snapshot, not live-updated mid-run (even by
   * her own Pickpocket Strike's gold gains, which are banked at run end
   * like any other loot instead) — keeps the mechanic simple rather than
   * needing the sim layer to mutate town economy state live.
   */
  partyGold: number;
  /**
   * Dawneth's Mending Charge energy, keyed by unit id (roadmap item 11) —
   * built by rolling her Mending Charge face (whether or not it actually
   * heals anyone), spent by nothing (Mourning Strike scales off it
   * continuously rather than consuming it). Lives on BattleState rather
   * than Adventurer specifically so it resets every room for free (a
   * fresh BattleState is created per room already — see dungeonRun.ts's
   * resolveNextRoom) instead of needing an explicit reset step or a new
   * persistent Adventurer field/save migration. Absent key means 0 energy,
   * not an error — see getHealEnergy.
   */
  healEnergyByUnitId: Record<string, number>;
  /**
   * Bodyguard intercepts recorded mid-attack (actions/attack.ts's
   * applyAttackToTarget) and drained into the turn's events by turnEngine.ts
   * — the attack outcome types don't carry the redirected damage, so this
   * is how the replay learns the guardian took a hit.
   */
  pendingIntercepts: { attackerId: string; guardianId: string; protectedId: string; damage: number }[];
  /** Milestone Trait effects recorded mid-attack (Vampiric heals, Second Wind revives), drained into turn events like pendingIntercepts. */
  pendingTraitEffects: { kind: 'heal' | 'revive'; unitId: string; amount: number; traitName: string }[];
  /** Units whose Second Wind has already fired this fight (once per fight). */
  secondWindUsedIds: string[];
  /** Turns each unit has started this fight — e.g. the Hellcaller summons on every 3rd (sim/summons.ts). */
  turnsTakenByUnitId: Record<string, number>;
}

export function createBattleState(adventurers: Adventurer[], enemies: Adventurer[], partyGold = 0): BattleState {
  return { adventurers, enemies, retreatRequested: false, partyGold, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {} };
}

/** Current Mending Charge energy for `unitId` — 0 if it's never gained any this room. */
export function getHealEnergy(battle: BattleState, unitId: string): number {
  return battle.healEnergyByUnitId[unitId] ?? 0;
}

/** Returns the roster opposing `actor` — enemies for an adventurer, adventurers for an enemy. */
export function getOpposingRoster(battle: BattleState, actor: Adventurer): Adventurer[] {
  return battle.adventurers.includes(actor) ? battle.enemies : battle.adventurers;
}

/** Returns `actor`'s own roster (allies, including itself) — the complement of getOpposingRoster. */
export function getOwnRoster(battle: BattleState, actor: Adventurer): Adventurer[] {
  return battle.adventurers.includes(actor) ? battle.adventurers : battle.enemies;
}

export type RoomOutcome = 'win' | 'loss' | 'retreat';

/**
 * Ends the room early with a distinct 'retreat' outcome. Called by the turn
 * engine whenever an action resolves with a `{ type: 'retreat' }` outcome
 * (see actions/retreat.ts) — any single party member's Retreat action ends
 * the room for the whole party, not just themselves.
 */
export function triggerRetreat(battle: BattleState): void {
  battle.retreatRequested = true;
}

/** Checks whether the room has reached a terminal outcome; null if still ongoing. */
export function checkRoomOutcome(battle: BattleState): RoomOutcome | null {
  if (battle.retreatRequested) return 'retreat';
  if (battle.enemies.every((enemy) => enemy.hp <= 0)) return 'win';
  if (battle.adventurers.every((adventurer) => adventurer.hp <= 0)) return 'loss';
  return null;
}
