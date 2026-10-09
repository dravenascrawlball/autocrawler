import { describe, it, expect } from 'vitest';
import { createAdventurer } from '../sim/adventurer';
import { runDungeon, ROOMS_PER_FLOOR } from '../sim/dungeonRun';
import { createSeededRng } from '../sim/rng';
import { createStarterDungeonRooms, room, placeEnemies, ROOM_DIFFICULTY_POOLS, ROOM_SLOT_ENEMY_STAT_SCALE, ENEMY_RANK_OPTIONS } from './rooms';
import { ISILWEN_TEMPLATE } from './characters';
import { createBrute, createGrunt, createShaman, createKoboldSkirmisher, BRUTE_TEMPLATE } from './enemies';

describe('createStarterDungeonRooms', () => {
  it('always has exactly 5 rooms', () => {
    expect(createStarterDungeonRooms(createSeededRng(1))).toHaveLength(15);
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
            .map((factory) => factory('front').name)
            .sort()
            .join(',') === enemyNames,
      );
      expect(matchesSomeOption).toBe(true);
    });
  });

  it('a lone under-powered adventurer always loses well before the end, across many rolled dungeons', () => {
    // Sampled rather than exhaustive: with 15 rooms the full combination space is in the billions.
    for (let seed = 0; seed < 200; seed++) {
      const rooms = createStarterDungeonRooms(createSeededRng(seed));
      const lone = createAdventurer('lone', ISILWEN_TEMPLATE, 'back');
      const result = runDungeon([lone], rooms, () => 0.5);

      expect(result.outcome).toBe('loss');
      expect(result.rooms.length).toBeLessThan(ROOMS_PER_FLOOR);
    }
  });
});

describe('room stat scaling', () => {
  it('leaves template stats untouched at scale 1', () => {
    const [brute] = room([createBrute]).enemies;
    expect(brute.maxHp).toBe(BRUTE_TEMPLATE.maxHp);
    expect(brute.attackPower).toBe(BRUTE_TEMPLATE.attackPower);
  });

  it('scales maxHp (at full HP) and attackPower, rounded', () => {
    const [brute] = room([createBrute], { statScale: 1.25 }).enemies;
    expect(brute.maxHp).toBe(Math.round(BRUTE_TEMPLATE.maxHp * 1.25));
    expect(brute.hp).toBe(brute.maxHp);
    expect(brute.attackPower).toBe(Math.round(BRUTE_TEMPLATE.attackPower * 1.25));
  });

  it('has one scale per difficulty slot', () => {
    expect(ROOM_SLOT_ENEMY_STAT_SCALE).toHaveLength(ROOM_DIFFICULTY_POOLS.length);
  });
});

describe('enemy grid placement', () => {
  const key = (p: { lane: number; rank: number }) => `${p.lane},${p.rank}`;

  it('never stacks two enemies in one cell, and keeps each archetype within its allowed ranks', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const r of createStarterDungeonRooms(createSeededRng(seed))) {
        const cells = r.enemies.map((e) => key(e.position));
        expect(new Set(cells).size).toBe(cells.length);
        for (const enemy of r.enemies) {
          expect(ENEMY_RANK_OPTIONS[enemy.name]).toContain(enemy.position.rank);
        }
      }
    }
  });

  it('puts a Shaman behind someone in its own lane whenever a front/middle unit exists', () => {
    for (let seed = 0; seed < 100; seed++) {
      const enemies = [createGrunt('front'), createShaman('front')];
      placeEnemies(enemies, createSeededRng(seed));
      const [g, s] = enemies;
      expect(s.position.rank).toBe(2);
      expect(s.position.lane).toBe(g.position.lane);
    }
  });

  it('varies lanes across seeds rather than always using the center', () => {
    const lanes = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const enemies = [createKoboldSkirmisher('front')];
      placeEnemies(enemies, createSeededRng(seed));
      lanes.add(enemies[0].position.lane);
    }
    expect(lanes.size).toBe(3);
  });
});

describe('floor bosses', () => {
  it('ends each floor with its boss: Troll Warlord, Succubus, then the Demon King', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rooms = createStarterDungeonRooms(createSeededRng(seed));
      const names = (index: number) => rooms[index].enemies.map((e) => e.name);
      expect(names(4)).toContain('Troll Warlord');
      expect(names(9)).toContain('Succubus');
      expect(names(14)).toContain('Demon King');
    }
  });
});

describe('monster Quirks', () => {
  it('some monsters in a seeded dungeon roll Quirks, and hand-built rooms never do', () => {
    let quirked = 0;
    let total = 0;
    for (let seed = 0; seed < 100; seed++) {
      for (const r of createStarterDungeonRooms(createSeededRng(seed))) {
        for (const enemy of r.enemies) {
          total += 1;
          if (enemy.traits.some((t) => t.quirk)) quirked += 1;
        }
      }
    }
    expect(quirked / total).toBeGreaterThan(0.1);
    expect(quirked / total).toBeLessThan(0.35);
    expect(room([createBrute]).enemies[0].traits.some((t) => t.quirk)).toBe(false);
  });
});
