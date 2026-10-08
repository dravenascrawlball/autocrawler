import { describe, it, expect } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { createAdventurer, DEFAULT_CRIT_CHANCE, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, AttackLowestHpAction } from '../sim/actions/attack';
import { createBattleState } from '../sim/battle';
import { resolveRoom } from '../sim/room';
import type { RoomDefinition } from '../sim/dungeonRun';
import { createRunInventory } from '../sim/items';
import { createTownStorage } from '../sim/townStorage';
import { IRON_SWORD_ITEM, SAGES_CHARM_ITEM } from '../data/items';
import { DAWNETH_TEMPLATE } from '../data/characters';
import { DAWNETH_CLEANSE_SPECIAL } from '../data/specialActions';
import { MendingChargeAction } from '../sim/actions/heal';
import { saveGame, loadGame, type GameState } from './persistence';
import type { ActiveDungeonRunState } from './activeRun';
import type { RosterState } from './roster';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function heroTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Hero',
    maxHp: 20,
    attackPower: 10,
    speed: 10,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    bonusFaces: [AttackLowestHpAction],
    ...overrides,
  };
}

function enemyTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Goblin',
    maxHp: 15,
    attackPower: 3,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('saveGame / loadGame', () => {
  it('reproduces an identical town-only state', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    hero.hp = 14;
    hero.level = 2;

    const bench = createAdventurer('bench', heroTemplate(), 'front');
    bench.hp = 5;

    const roster: RosterState = { adventurers: [hero, bench], recruitedIds: ['hero'] };

    const townStorage = createTownStorage();
    // A real, ITEM_REGISTRY-registered item — items are now persisted narrowed to their id (see
    // state/persistence.ts's serializeItem), so a save/load round trip can't rehydrate an item
    // that isn't actually registered.
    townStorage.items.push(IRON_SWORD_ITEM);

    const state: GameState = {
      roster,
      townStorage,
      dayCount: 4,
      activeRun: null,
      recruitmentPool: [],
      runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };

    const storage = createMemoryStorage();
    saveGame(state, storage);
    const loaded = loadGame(storage);

    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(state);

    // Actions must rehydrate to the exact same canonical singletons (identity
    // matters for reference-based logic like swapInAction/equip elsewhere).
    expect(loaded?.roster.adventurers[0].dieFaces[0].action).toBe(AttackNearestAction);
    expect(loaded?.roster.adventurers[0].ownedFaces).toContain(AttackLowestHpAction);
  });

  it('resumes a mid-dungeon-run at the same room/HP/position state', () => {
    // Real combat, deliberately stopped mid-room by capping rounds at 1, so
    // both the hero and the enemy are left with non-default live state.
    const hero = createAdventurer('hero', heroTemplate({ maxHp: 30, attackPower: 5 }), 'front');
    const bench = createAdventurer('bench', heroTemplate(), 'front');
    const enemy = createAdventurer('enemy', enemyTemplate(), 'front');

    const battle = createBattleState([hero], [enemy]);
    resolveRoom(battle, () => 0.5, 1);

    // Sanity check: combat actually happened and left non-default state.
    expect(enemy.hp).toBeLessThan(enemy.maxHp);

    const room0: RoomDefinition = { enemies: [enemy] };
    const room1: RoomDefinition = { enemies: [createAdventurer('enemy2', enemyTemplate(), 'front')] };

    const inventory = createRunInventory();
    inventory.items.push(SAGES_CHARM_ITEM); // a real, ITEM_REGISTRY-registered item — see the other test's note

    const activeRun: ActiveDungeonRunState = {
      rooms: [room0, room1],
      currentRoomIndex: 0,
      partyIds: ['hero'],
      partyGold: 30,
      inventory,
      outcome: null,
      activeRelics: [],
    };

    const roster: RosterState = { adventurers: [hero, bench], recruitedIds: [] };
    const state: GameState = {
      roster,
      townStorage: createTownStorage(),
      dayCount: 2,
      activeRun,
      recruitmentPool: [], runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };

    const storage = createMemoryStorage();
    saveGame(state, storage);
    const loaded = loadGame(storage);

    expect(loaded).not.toBeNull();
    expect(loaded?.activeRun?.currentRoomIndex).toBe(0);
    expect(loaded?.activeRun?.partyIds).toEqual(['hero']);
    expect(loaded?.activeRun?.partyGold).toBe(30);
    expect(loaded?.activeRun?.outcome).toBeNull();
    expect(loaded?.activeRun?.inventory.items).toEqual(inventory.items);

    const loadedHero = loaded?.roster.adventurers.find((a) => a.id === 'hero');
    expect(loadedHero?.hp).toBe(hero.hp);

    const loadedEnemy = loaded?.activeRun?.rooms[0].enemies[0];
    expect(loadedEnemy?.hp).toBe(enemy.hp);

    // Full deep equality as the final word, once the targeted checks above pass.
    expect(loaded).toEqual(state);
  });

  it('returns null with no existing save, without throwing', () => {
    const storage = createMemoryStorage();

    expect(() => loadGame(storage)).not.toThrow();
    expect(loadGame(storage)).toBeNull();
  });

  it('returns null for corrupted/malformed JSON, without throwing', () => {
    const storage = createMemoryStorage();
    storage.setItem('autocrawler:save', '{not valid json');

    expect(() => loadGame(storage)).not.toThrow();
    expect(loadGame(storage)).toBeNull();
  });

  it('returns null for well-formed JSON that does not look like a save', () => {
    const storage = createMemoryStorage();
    storage.setItem('autocrawler:save', JSON.stringify({ unrelated: true }));

    expect(loadGame(storage)).toBeNull();
  });

  it('rejects a save with a non-numeric version field', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'autocrawler:save',
      JSON.stringify({
        version: 'not-a-number',
        roster: { adventurers: [], recruitedIds: [] },
        townStorage: createTownStorage(),
        dayCount: 0,
        activeRun: null,
        recruitmentPool: [], runHistory: { clearedWithIds: [], characterStats: {} },
      }),
    );

    expect(loadGame(storage)).toBeNull();
  });

  it('discards a save whose version predates the current baseline, rather than migrating it', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const state: GameState = {
      roster: { adventurers: [hero], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 3,
      activeRun: null,
      recruitmentPool: [], runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };

    const storage = createMemoryStorage();
    saveGame(state, storage);

    // Simulate a save from before this rework — an old version number, and an adventurer
    // shape carrying fields (status, runMaxHp) this version no longer has.
    const raw = JSON.parse(storage.getItem('autocrawler:save') as string);
    raw.version = 11;
    raw.roster.adventurers[0].status = 'Tired';
    raw.roster.activePartyIds = ['hero'];
    delete raw.roster.recruitedIds;
    storage.setItem('autocrawler:save', JSON.stringify(raw));

    expect(loadGame(storage)).toBeNull();
  });

  it('round-trips critChance unchanged', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const state: GameState = {
      roster: { adventurers: [hero], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 0,
      activeRun: null,
      recruitmentPool: [], runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };

    const storage = createMemoryStorage();
    saveGame(state, storage);
    const loaded = loadGame(storage);

    expect(loaded?.roster.adventurers[0].critChance).toBe(DEFAULT_CRIT_CHANCE);
  });

  it('never throws even if the storage backend itself throws', () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };

    const state: GameState = {
      roster: { adventurers: [], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 0,
      activeRun: null,
      recruitmentPool: [], runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };

    expect(() => saveGame(state, throwingStorage)).not.toThrow();
    expect(() => loadGame(throwingStorage)).not.toThrow();
    expect(loadGame(throwingStorage)).toBeNull();
  });
});

describe('loadGame: kit drift repair (healer redesign)', () => {
  it("updates a saved pre-redesign Dawneth to her current kit without discarding the save", () => {
    const dawneth = createAdventurer('dawneth', DAWNETH_TEMPLATE, 'back', [], [], [], () => 0.99);
    // Shape of a Dawneth saved before the redesign: healer Basic Action, Cleanse as her only Special.
    dawneth.basicAction = MendingChargeAction;
    dawneth.activeSpecialActions = [DAWNETH_CLEANSE_SPECIAL];

    const state: GameState = {
      roster: { adventurers: [dawneth], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 1,
      activeRun: null,
      recruitmentPool: [],
      runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 42, unlockedKitIds: {} },
    };
    const storage = createMemoryStorage();
    saveGame(state, storage);
    const loaded = loadGame(storage)!;

    expect(loaded.metaProgression.renown).toBe(42);
    const repaired = loaded.roster.adventurers[0];
    expect(repaired.basicAction.id).toBe('attack-nearest');
    expect(repaired.activeSpecialActions.map((special) => special.id)).toEqual([
      'dawneth-mending-charge',
      'dawneth-guardians-vow',
    ]);
  });
});

describe('loadGame: runHistory.characterStats', () => {
  it('round-trips per-character run stats', () => {
    const state: GameState = {
      roster: { adventurers: [], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 1,
      activeRun: null,
      recruitmentPool: [],
      runHistory: { clearedWithIds: ['a'], characterStats: { a: { runs: 2, clears: 1, bestRoomsWon: 5 } } },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };
    const storage = createMemoryStorage();
    saveGame(state, storage);
    expect(loadGame(storage)!.runHistory).toEqual(state.runHistory);
  });

  it('loads a save from before characterStats existed with empty stats', () => {
    const state: GameState = {
      roster: { adventurers: [], recruitedIds: [] },
      townStorage: createTownStorage(),
      dayCount: 1,
      activeRun: null,
      recruitmentPool: [],
      runHistory: { clearedWithIds: [], characterStats: {} },
      metaProgression: { renown: 0, unlockedKitIds: {} },
    };
    const storage = createMemoryStorage();
    saveGame(state, storage);
    // Strip characterStats from the stored JSON to mimic an older save.
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)!;
      const parsed = JSON.parse(storage.getItem(key)!);
      if (parsed?.runHistory) {
        delete parsed.runHistory.characterStats;
        storage.setItem(key, JSON.stringify(parsed));
      }
    }
    expect(loadGame(storage)!.runHistory).toEqual({ clearedWithIds: [], characterStats: {} });
  });
});
