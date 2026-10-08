import type { RoomDefinition } from '../sim/dungeonRun';
import type { RngSource } from '../sim/rng';
import type { Adventurer } from '../sim/adventurer';
import { findFreeCell, samePosition, type GridPosition, type Lane, type Rank } from '../sim/formation';
import {
  createGrunt,
  createBrute,
  createShaman,
  createKoboldSkirmisher,
  createGoblinFlanker,
  createEmberImp,
  createVenomSpitter,
  createBoneSentinel,
  createTrollWarlord,
  type EnemyFactory,
} from './enemies';

/**
 * Which ranks each enemy archetype may stand in (see placeEnemies): Brute
 * anchors the front, Grunts and Kobolds vary between front and middle, and
 * Shaman (support) stays in back. Anything unlisted defaults to front.
 */
export const ENEMY_RANK_OPTIONS: Record<string, Rank[]> = {
  Brute: [0],
  Grunt: [0, 1],
  'Kobold Skirmisher': [0, 1],
  Shaman: [2],
  'Goblin Flanker': [0, 1],
  'Ember Imp': [0, 1],
  'Venom Spitter': [2],
  'Bone Sentinel': [0],
  'Troll Warlord': [0],
};

const BACK_RANK: Rank = 2;

function rankOptionsFor(enemy: Adventurer): Rank[] {
  return ENEMY_RANK_OPTIONS[enemy.name] ?? [0];
}

function pickRandom<T>(items: T[], rng: RngSource): T {
  return items[Math.floor(rng() * items.length)];
}

function freeLanesAt(rank: Rank, taken: GridPosition[]): Lane[] {
  return ([0, 1, 2] as Lane[]).filter((lane) => !taken.some((position) => samePosition(position, { lane, rank })));
}

/**
 * Spreads `enemies` over their side's 3x3 grid, one per cell: front/middle
 * units first (each picks one of its ENEMY_RANK_OPTIONS at random, then a
 * random free lane in it), then back-rank units, which prefer a lane that
 * already has someone in front of them so they start out protected under
 * the lane-limited melee rule (see actions/targeting.ts). Falls back to the
 * nearest free cell if a unit's own ranks are full.
 */
export function placeEnemies(enemies: Adventurer[], rng: RngSource): void {
  const isBackLine = (enemy: Adventurer) => rankOptionsFor(enemy).includes(BACK_RANK);
  const ordered = [...enemies.filter((enemy) => !isBackLine(enemy)), ...enemies.filter(isBackLine)];
  const taken: GridPosition[] = [];

  for (const enemy of ordered) {
    const options = rankOptionsFor(enemy);
    let cell: GridPosition | null = null;

    if (isBackLine(enemy)) {
      const free = freeLanesAt(BACK_RANK, taken);
      const shielded = free.filter((lane) => taken.some((position) => position.lane === lane && position.rank < BACK_RANK));
      const lanes = shielded.length > 0 ? shielded : free;
      if (lanes.length > 0) cell = { lane: pickRandom(lanes, rng), rank: BACK_RANK };
    } else {
      const firstRank = pickRandom(options, rng);
      for (const rank of [firstRank, ...options.filter((option) => option !== firstRank)]) {
        const lanes = freeLanesAt(rank, taken);
        if (lanes.length > 0) {
          cell = { lane: pickRandom(lanes, rng), rank };
          break;
        }
      }
    }

    cell ??= findFreeCell(taken, options[0]);
    if (cell) enemy.position = cell;
    taken.push(enemy.position);
  }
}

/**
 * Builds a room from `factories`, placing the enemies on the grid (see
 * placeEnemies) and scaling each one's maxHp/attackPower/healPower by
 * `statScale` (see ROOM_SLOT_ENEMY_STAT_SCALE) — 1 leaves the template's
 * numbers untouched.
 */
export function room(
  factories: EnemyFactory[],
  { rng = () => Math.random(), statScale = 1 }: { rng?: RngSource; statScale?: number } = {},
): RoomDefinition {
  const enemies = factories.map((factory) => {
    const enemy = factory('front');
    if (statScale !== 1) {
      enemy.maxHp = Math.round(enemy.maxHp * statScale);
      enemy.hp = enemy.maxHp;
      enemy.attackPower = Math.round(enemy.attackPower * statScale);
      enemy.healPower = Math.round(enemy.healPower * statScale);
    }
    return enemy;
  });
  placeEnemies(enemies, rng);
  return { enemies };
}

/** One room slot's possible enemy compositions, each entry a distinct combination of the current enemy archetypes. */
type CompositionPool = EnemyFactory[][];

const grunt = createGrunt;
const brute = createBrute;
const shaman = createShaman;
const kobold = createKoboldSkirmisher;
const flanker = createGoblinFlanker;
const imp = createEmberImp;
const spitter = createVenomSpitter;
const sentinel = createBoneSentinel;
const troll = createTrollWarlord;

/**
 * Five difficulty slots (opener -> finale), each a pool of 2-3
 * comparable-difficulty compositions — createStarterDungeonRooms rolls one
 * per slot per run, so the escalating shape of a run stays intact (weak
 * opener, hard finale) while the actual enemies faced vary run to run.
 * Reuses the 4 existing archetypes (Kobold Skirmisher/Grunt/Brute/Shaman);
 * new enemy content is a separate pass. Grid placement isn't authored here
 * — see placeEnemies / ENEMY_RANK_OPTIONS.
 *
 * Compositions and ROOM_SLOT_ENEMY_STAT_SCALE were retuned together in the
 * second balance pass (docs/roadmap.md) against src/sim/balanceSim.test.ts:
 * slot 3 became a real trio instead of a breather, slots 4-5 field a Brute
 * with support, and Brute+Brute stays excluded (too swingy for any slot).
 */
export const ROOM_DIFFICULTY_POOLS: CompositionPool[] = [
  // Slot 1 (opener): a single weak enemy, or a pair of weaker ones. The
  // enemy variety pass added mechanic enemies here so the opener can
  // actually cost something (it previously almost never ended a run).
  [[grunt], [shaman], [kobold, kobold], [flanker, kobold], [imp, imp]],
  // Slot 2: a light pair/trio.
  [
    [grunt, grunt],
    [grunt, shaman],
    [kobold, kobold, kobold],
    [flanker, imp],
    [grunt, spitter],
  ],
  // Slot 3 (mid): still Brute-free (see above), but always a real fight.
  [
    [grunt, shaman, shaman],
    [grunt, grunt, shaman],
    [grunt, kobold, kobold, kobold],
    [sentinel, spitter],
    [flanker, flanker, imp],
  ],
  // Slot 4: first heavy enemy, now with support.
  [
    [grunt, brute],
    [brute, kobold, kobold],
    [brute, shaman],
    [sentinel, flanker, spitter],
    [brute, imp, imp],
  ],
  // Slot 5 (finale): always the Troll Warlord boss, plus support.
  [
    [troll, shaman],
    [troll, spitter],
    [troll, flanker, kobold],
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
 * Rooms 1-2 start well above 1 since the enemy variety pass: at 1 they
 * almost never ended a run; now losses climb steadily room by room, with
 * the room-5 boss the biggest single wall.
 */
export const ROOM_SLOT_ENEMY_STAT_SCALE: number[] = [1.85, 1.95, 2.1, 2.2, 2.85];

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

function pickComposition(pool: CompositionPool, rng: RngSource): EnemyFactory[] {
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
    ...room(pickComposition(pool, rng), { rng, statScale: ROOM_SLOT_ENEMY_STAT_SCALE[slotIndex] }),
    clearGold: ROOM_SLOT_CLEAR_GOLD[slotIndex],
  }));
}
