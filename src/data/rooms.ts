import type { RoomDefinition } from '../sim/dungeonRun';
import type { RngSource } from '../sim/rng';
import type { Row } from '../sim/formation';
import { createGrunt, createBrute, createShaman, type EnemyFactory, createKoboldSkirmisher } from './enemies';

interface EnemySpec {
  factory: EnemyFactory;
  row: Row;
}

/** Shorthand for authoring a composition pool below — see ROOM_DIFFICULTY_POOLS. */
function front(factory: EnemyFactory): EnemySpec {
  return { factory, row: 'front' };
}
function back(factory: EnemyFactory): EnemySpec {
  return { factory, row: 'back' };
}

/**
 * Builds a room from `specs`, scaling each enemy's maxHp/attackPower/
 * healPower by `statScale` (see ROOM_SLOT_ENEMY_STAT_SCALE) — 1 leaves the
 * template's numbers untouched.
 */
export function room(specs: EnemySpec[], statScale = 1): RoomDefinition {
  return {
    enemies: specs.map((spec) => {
      const enemy = spec.factory(spec.row);
      if (statScale !== 1) {
        enemy.maxHp = Math.round(enemy.maxHp * statScale);
        enemy.hp = enemy.maxHp;
        enemy.attackPower = Math.round(enemy.attackPower * statScale);
        enemy.healPower = Math.round(enemy.healPower * statScale);
      }
      return enemy;
    }),
  };
}

/** One room slot's possible enemy compositions, each entry a distinct combination of the current enemy archetypes. */
type CompositionPool = EnemySpec[][];

/**
 * Five difficulty slots (opener -> finale), each a pool of 2-3
 * comparable-difficulty compositions — createStarterDungeonRooms rolls one
 * per slot per run, so the escalating shape of a run stays intact (weak
 * opener, hard finale) while the actual enemies faced vary run to run.
 * Reuses the 4 existing archetypes (Kobold Skirmisher/Grunt/Brute/Shaman);
 * new enemy content is a separate pass.
 *
 * Row assignment (front/back — see sim/formation.ts): Kobold/Grunt/Brute
 * front (the melee threats), Shaman back (a support unit, protected until
 * the front line falls, same as the intent behind a player putting a
 * Healer in back). A "reasonable default" call, easy to retune per
 * composition later.
 *
 * Compositions and ROOM_SLOT_ENEMY_STAT_SCALE were retuned together in the
 * second balance pass (docs/roadmap.md) against src/sim/balanceSim.test.ts:
 * slot 3 became a real trio instead of a breather, slots 4-5 field a Brute
 * with support, and Brute+Brute stays excluded (too swingy for any slot).
 */
export const ROOM_DIFFICULTY_POOLS: CompositionPool[] = [
  // Slot 1 (opener): a single weak enemy, or a pair of weaker ones.
  [
    [front(createGrunt)], [back(createShaman)],
    [front(createKoboldSkirmisher), front(createKoboldSkirmisher)],
  ],
  // Slot 2: a light pair/trio.
  [
    [front(createGrunt), front(createGrunt)],
    [front(createGrunt), back(createShaman)],
    [front(createKoboldSkirmisher), front(createKoboldSkirmisher), back(createKoboldSkirmisher)],
  ],
  // Slot 3 (mid): still Brute-free (see above), but a real trio now rather
  // than the old support-only pairs — the second balance pass measured this
  // slot as a breather (parties left it at ~97% HP).
  [
    [front(createGrunt), back(createShaman), back(createShaman)],
    [front(createGrunt), front(createGrunt), back(createShaman)],
    [front(createGrunt), front(createKoboldSkirmisher), front(createKoboldSkirmisher), back(createKoboldSkirmisher)],
  ],
  // Slot 4: first heavy enemy, now with support.
  [
    [front(createGrunt), front(createBrute)],
    [front(createBrute), front(createKoboldSkirmisher), front(createKoboldSkirmisher)],
    [front(createBrute), back(createShaman)],
  ],
  // Slot 5 (finale): a Brute plus a full supporting cast.
  [
    [front(createGrunt), front(createBrute), back(createShaman)],
    [front(createBrute), front(createKoboldSkirmisher), front(createKoboldSkirmisher), back(createShaman)],
    [front(createGrunt), front(createGrunt), front(createBrute)],
  ],
];

/**
 * Per-slot enemy stat multiplier (opener -> finale), applied on top of the
 * enemy templates by createStarterDungeonRooms — the main difficulty knob
 * from the second balance pass (docs/roadmap.md), tuned with
 * src/sim/balanceSim.test.ts toward a ~50-60% full-clear rate for a party
 * that shops sensibly. Lets later rooms reuse the same few archetypes
 * while still escalating. Steep because ROOM_SLOT_CLEAR_GOLD lets the
 * party grow by ~1 member per room (3 at room 1 -> ~7 by the finale), so
 * enemies have to outscale a much bigger board — retune both together.
 */
export const ROOM_SLOT_ENEMY_STAT_SCALE: number[] = [1, 1.3, 1.6, 1.9, 2.2];

/**
 * Flat gold paid for winning each slot's room (opener -> finale), on top of
 * enemy goldDrops — the gold-income pass after the second balance pass
 * (docs/roadmap.md): enemy drops alone (~29g/room) rarely covered even one
 * recruit (50-65g), so the between-room shop went mostly unused. Sized so a
 * party with no gold-generating kit (Nerissa's Pickpocket Strike) can make
 * 1-2 recruit-sized purchases at every pause (sim: >=1 affordable at 100%
 * of pauses, >=2 rising from ~5% after room 1 to ~80% after room 4). Paid
 * on the final room too, though there's no shop after it.
 */
export const ROOM_SLOT_CLEAR_GOLD: number[] = [60, 55, 55, 55, 55];

function pickComposition(pool: CompositionPool, rng: RngSource): EnemySpec[] {
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Rolls a fresh 5-room run: one composition per ROOM_DIFFICULTY_POOLS slot,
 * via the injected RNG (never Math.random() directly — same convention as
 * loot/recruitment generation). Fresh Adventurer instances are built on
 * every call so replaying a run never reuses a previous run's dead enemies,
 * and two calls with the same rng produce the same run.
 */
export function createStarterDungeonRooms(rng: RngSource = () => Math.random()): RoomDefinition[] {
  return ROOM_DIFFICULTY_POOLS.map((pool, slotIndex) => ({
    ...room(pickComposition(pool, rng), ROOM_SLOT_ENEMY_STAT_SCALE[slotIndex]),
    clearGold: ROOM_SLOT_CLEAR_GOLD[slotIndex],
  }));
}
