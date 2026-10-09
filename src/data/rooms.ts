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
  createSuccubus,
  createDemonKing,
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
  Succubus: [2],
  'Demon King': [0],
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
const succubus = createSuccubus;
const demonKing = createDemonKing;

/**
 * Fifteen difficulty slots — three floors of ROOMS_PER_FLOOR (5) rooms,
 * each floor ending in a boss: Troll Warlord (floor 1), Succubus (floor 2),
 * Demon King (floor 3, the finale). createStarterDungeonRooms rolls one
 * composition per slot per run, so the escalating shape stays intact while
 * the actual enemies vary run to run. Grid placement isn't authored here —
 * see placeEnemies / ENEMY_RANK_OPTIONS. Floors 2-3 reuse the regular
 * enemies in bigger, nastier mixes; ROOM_SLOT_ENEMY_STAT_SCALE does the
 * rest of the escalation.
 */
export const ROOM_DIFFICULTY_POOLS: CompositionPool[] = [
  // --- Floor 1 ---
  // Slot 1 (opener): a single weak enemy, or a pair of weaker ones.
  [[grunt], [shaman], [kobold, kobold], [flanker, kobold], [imp, imp]],
  // Slot 2: a light pair/trio.
  [
    [grunt, grunt],
    [grunt, shaman],
    [kobold, kobold, kobold],
    [flanker, imp],
    [grunt, spitter],
  ],
  // Slot 3: Brute-free, but always a real fight.
  [
    [grunt, shaman, shaman],
    [grunt, grunt, shaman],
    [grunt, kobold, kobold, kobold],
    [sentinel, spitter],
    [flanker, flanker, imp],
  ],
  // Slot 4: first heavy enemy, with support.
  [
    [grunt, brute],
    [brute, kobold, kobold],
    [brute, shaman],
    [sentinel, flanker, spitter],
    [brute, imp, imp],
  ],
  // Slot 5: floor 1 boss — the Troll Warlord plus support.
  [
    [troll, shaman],
    [troll, spitter],
    [troll, flanker, kobold],
  ],
  // --- Floor 2 ---
  [
    [grunt, grunt, shaman],
    [flanker, imp, kobold],
    [sentinel, spitter],
  ],
  [
    [brute, kobold, kobold],
    [grunt, grunt, spitter],
    [flanker, flanker, shaman],
  ],
  [
    [sentinel, grunt, shaman],
    [brute, imp, imp],
    [flanker, spitter, spitter],
  ],
  [
    [brute, sentinel],
    [brute, flanker, shaman],
    [sentinel, flanker, imp, spitter],
  ],
  // Slot 10: floor 2 boss — the Succubus, guarded.
  [
    [succubus, grunt, grunt],
    [succubus, sentinel],
    [succubus, brute],
  ],
  // --- Floor 3 ---
  [
    [brute, flanker, spitter],
    [sentinel, grunt, grunt, shaman],
    [imp, imp, flanker, kobold],
  ],
  [
    [brute, brute],
    [sentinel, sentinel, spitter],
    [brute, imp, shaman],
  ],
  [
    [brute, sentinel, shaman],
    [flanker, flanker, spitter, spitter],
    [troll, imp],
  ],
  [
    [troll, flanker],
    [brute, brute, shaman],
    [sentinel, sentinel, imp, imp],
  ],
  // Slot 15: the finale — the Demon King and his court.
  [
    [demonKing, imp, imp],
    [demonKing, sentinel],
    [demonKing, flanker, spitter],
  ],
];

/**
 * Per-slot enemy stat multiplier (room 1 -> 15), applied on top of the
 * enemy templates by createStarterDungeonRooms — the main difficulty knob,
 * tuned with src/sim/balanceSim.test.ts. Targets for a fresh profile on the
 * 15-room dungeon: ~75% clear floor 1, ~50% clear floor 2, ~30-40% clear
 * the whole run, each floor's boss room its biggest single wall. Floors 2-3
 * jump steeply because by then the party is ~9 strong with synergies,
 * duplicate stars and scaling relics (roadmap item 6) — retune this
 * together with any change to gold income or party growth.
 */
export const ROOM_SLOT_ENEMY_STAT_SCALE: number[] = [
  // Floor 1
  1.7, 1.8, 1.9, 2, 2.55,
  // Floor 2
  4.8, 5.2, 5.6, 6, 6.6,
  // Floor 3
  5.8, 6.1, 6.4, 6.7, 7.4,
];

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
export const ROOM_SLOT_CLEAR_GOLD: number[] = [60, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55];

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

/** Rooms in a full run — 15 (three floors of five). */
export const TOTAL_ROOMS = ROOM_DIFFICULTY_POOLS.length;

