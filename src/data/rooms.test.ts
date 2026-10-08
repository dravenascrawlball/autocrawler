import { describe, it, expect } from 'vitest';
import { createAdventurer } from '../sim/adventurer';
import { runDungeon } from '../sim/dungeonRun';
import { createSeededRng } from '../sim/rng';
import { createStarterDungeonRooms, room, ROOM_DIFFICULTY_POOLS, ROOM_SLOT_ENEMY_STAT_SCALE } from './rooms';
import { ISILWEN_TEMPLATE } from './characters';
import { createBrute, BRUTE_TEMPLATE } from './enemies';

describe('createStarterDungeonRooms', () => {
  it('always has exactly 5 rooms', () => {
    expect(createStarterDungeonRooms(createSeededRng(1))).toHaveLength(5);
  });

  it('is deterministic for a given rng', () => {
    const roomsA = createStarterDungeonRooms(createSeededRng(42));
    const roomsB = createStarterDungeonRooms(createSeededRng(42));

    const summarize = (rooms: ReturnType<typeof createStarterDungeonRooms>) =>
      rooms.map((r) => r.enemies.map((e) => e.name).sort().join(','));

    expect(summarize(roomsA)).toEqual(summarize(roomsB));
  });

  it('varies composition across different seeds (not the same run every time)', () => {
    const summarize = (rooms: ReturnType<typeof createStarterDungeonRooms>) =>
      rooms.map((r) => r.enemies.map((e) => e.name).sort().join(',')).join('|');

    const summaries = new Set(Array.from({ length: 10 }, (_, i) => summarize(createStarterDungeonRooms(createSeededRng(i)))));

    expect(summaries.size).toBeGreaterThan(1);
  });

  it('picks each room from its own difficulty-pool slot', () => {
    const rooms = createStarterDungeonRooms(createSeededRng(7));

    rooms.forEach((r, slotIndex) => {
      const pool = ROOM_DIFFICULTY_POOLS[slotIndex];
      const enemyNames = r.enemies.map((e) => e.name).sort().join(',');
      const matchesSomeOption = pool.some(
        (composition) =>
          composition
            .map((spec) => spec.factory(spec.row).name)
            .sort()
            .join(',') === enemyNames,
      );
      expect(matchesSomeOption).toBe(true);
    });
  });

  it('every combination of pool choices eventually loses a lone under-powered adventurer before the run completes', () => {
    const total = ROOM_DIFFICULTY_POOLS.reduce((acc, pool) => acc * pool.length, 1);

    for (let combo = 0; combo < total; combo++) {
      let n = combo;
      const rooms = ROOM_DIFFICULTY_POOLS.map((pool) => {
        const choice = pool[n % pool.length];
        n = Math.floor(n / pool.length);
        return room(choice);
      });

      const lone = createAdventurer('lone', ISILWEN_TEMPLATE, 'back');
      const result = runDungeon([lone], rooms, () => 0.5);

      // A lone adventurer who goes Downed no longer gets revived between rooms (Downed now lasts
      // for the rest of the run — see dungeonRun.ts's healBetweenRooms), so a loss can now land as
      // early as room 1 rather than always partway through.
      expect(result.outcome).toBe('loss');
      expect(result.rooms.length).toBeGreaterThanOrEqual(1);
      expect(result.rooms.length).toBeLessThan(5);
    }
  });
});

describe('room stat scaling', () => {
  it('leaves template stats untouched at scale 1', () => {
    const [brute] = room([{ factory: createBrute, row: 'front' }]).enemies;
    expect(brute.maxHp).toBe(BRUTE_TEMPLATE.maxHp);
    expect(brute.attackPower).toBe(BRUTE_TEMPLATE.attackPower);
  });

  it('scales maxHp (at full HP) and attackPower, rounded', () => {
    const [brute] = room([{ factory: createBrute, row: 'front' }], 1.25).enemies;
    expect(brute.maxHp).toBe(Math.round(BRUTE_TEMPLATE.maxHp * 1.25));
    expect(brute.hp).toBe(brute.maxHp);
    expect(brute.attackPower).toBe(Math.round(BRUTE_TEMPLATE.attackPower * 1.25));
  });

  it('has one scale per difficulty slot', () => {
    expect(ROOM_SLOT_ENEMY_STAT_SCALE).toHaveLength(ROOM_DIFFICULTY_POOLS.length);
  });
});
