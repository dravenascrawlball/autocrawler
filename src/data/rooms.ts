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

export function room(specs: EnemySpec[]): RoomDefinition {
  return {
    enemies: specs.map((spec) => spec.factory(spec.row)),
  };
}

/** One room slot's possible enemy compositions, each entry a distinct combination of the 3 current archetypes. */
type CompositionPool = EnemySpec[][];

/**
 * Five difficulty slots (opener -> finale), each a pool of 2
 * comparable-difficulty compositions — createStarterDungeonRooms rolls one
 * per slot per run, so the escalating shape of a run stays intact (weak
 * opener, hard finale) while the actual enemies faced vary run to run.
 * Deliberately reuses only the 3 existing archetypes (Grunt/Brute/Shaman)
 * — new enemy content is a separate pass, not part of this one.
 *
 * Row assignment (front/back — see sim/formation.ts, roadmap item 7's
 * follow-up): Grunt/Brute front (the tough melee threats), Shaman back (a
 * support unit, protected until the front line falls, same as the
 * intent behind a player putting a Healer in back). A "reasonable default"
 * call, easy to retune per composition later.
 *
 * Tiers picked from a standalone-difficulty ranking (% of a fresh
 * Fighter/Ranger/Healer party's total HP lost clearing that composition
 * alone, worst first) measured under the old grid/energy system — worth
 * remeasuring now that movement/positioning no longer factors in: Grunt 4%,
 * Shaman 12%, Grunt+Grunt 12%, Grunt+Shaman 12%, Shaman+Shaman 14%, Brute
 * 23%, Grunt+Brute 43%, Brute+Shaman 65%, Brute+Brute 100% (an outright loss
 * even at full HP standalone — excluded entirely, too swingy for any slot).
 * Slots 3-5 deliberately overlap by a tier rather than partition cleanly, so
 * every slot still gets 2 real options without ever reaching Brute+Brute.
 */
export const ROOM_DIFFICULTY_POOLS: CompositionPool[] = [
  // Slot 1 (opener): a single weak enemy. ~4-12%
  [
    [front(createGrunt)], [back(createShaman)],
    [front(createKoboldSkirmisher), front(createKoboldSkirmisher)],
  ],
  // Slot 2: a light pair. ~12%
  [
    [front(createGrunt), front(createGrunt)],
    [front(createGrunt), back(createShaman)],
    [front(createKoboldSkirmisher), front(createKoboldSkirmisher), back(createKoboldSkirmisher)],
  ],
  // Slot 3 (mid): support-ish pairs — deliberately Brute-free, since Brute
  // appearing in 3 consecutive slots (exhaustively checked, under the old
  // grid system) compounds across only-partial inter-room healing into an
  // unwinnable run. ~12-14%
  [
    [back(createShaman), back(createShaman)],
    [front(createGrunt), back(createShaman)],
  ],
  // Slot 4: first heavy enemy. ~23-43%
  [[front(createBrute)], [front(createGrunt), front(createBrute)]],
  // Slot 5 (finale): the hardest pairings this roster supports. ~43-65%
  [
    [front(createGrunt), front(createBrute)],
    [front(createBrute), back(createShaman)],
  ],
];

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
  return ROOM_DIFFICULTY_POOLS.map((pool) => room(pickComposition(pool, rng)));
}
