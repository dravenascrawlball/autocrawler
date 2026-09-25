import { describe, it, expect, beforeEach } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { currentView } from './view';
import { dungeonPlayback } from './dungeonPlayback';
import { activeRun } from './activeRun';
import { runHistory } from './runHistory';
import {
  startDungeon,
  finishDungeonRun,
  continueDungeonRun,
  retreatFromDungeon,
  equipItemDuringRun,
  unequipItemDuringRun,
  dismissLootPrompt,
} from './dungeonOrchestrator';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { createTownStorage } from '../sim/townStorage';
import { GUDRUN_TEMPLATE } from '../data/characters';
import type { RoomDefinition } from '../sim/dungeonRun';
import type { Item, ItemLookup } from '../sim/items';

function enemyTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Enemy',
    maxHp: 5,
    attackPower: 1,
    speed: 1,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

// GUDRUN_TEMPLATE is a real entry in CHARACTER_TEMPLATES, so finishDungeonRun's
// resetToTemplateBaseline lookup-by-name actually finds a template and resets against it —
// a from-scratch custom template (name not in CHARACTER_TEMPLATES) would silently skip the reset.
function hero(id: string, overrides: Partial<AdventurerTemplate> = {}) {
  return createAdventurer(id, { ...GUDRUN_TEMPLATE, ...overrides }, 'front');
}

const LOOT_ITEM: Item = { id: 'test-loot', name: 'Test Loot', slot: 'trinket', modifiers: [], price: 0 };
const lookupItem: ItemLookup = (id) => (id === LOOT_ITEM.id ? LOOT_ITEM : (undefined as unknown as Item));
const alwaysDropRng = () => 0; // rng() < dropChance is true for any dropChance > 0

describe('startDungeon / finishDungeonRun', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    townStorage.set(createTownStorage());
    currentView.set('town');
    dungeonPlayback.set(null);
    activeRun.set(null);
    runHistory.set({ clearedWithIds: [] });
  });

  it('wins a run, then resets the party to template baseline and returns to town', () => {
    const drafted = hero('hero');
    const bench = hero('bench');
    roster.set({ adventurers: [drafted, bench], recruitedIds: [] });

    const room: RoomDefinition = {
      enemies: [
        createAdventurer(
          'enemy',
          enemyTemplate({ xpReward: 5, lootTable: [{ itemId: LOOT_ITEM.id, dropChance: 1 }] }),
          'front',
        ),
      ],
    };

    startDungeon([drafted], [room], alwaysDropRng, lookupItem);

    expect(get(currentView)).toBe('dungeon');
    const playback = get(dungeonPlayback);
    expect(playback).not.toBeNull();
    expect(playback?.outcome).toBe('completed');

    // Simulate a level-up mid-run so the post-run reset has something to undo.
    drafted.level = 5;
    drafted.hp = 1;

    finishDungeonRun();

    expect(get(currentView)).toBe('town');
    expect(get(dungeonPlayback)).toBeNull();

    const updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
    expect(updatedHero.level).toBe(1);
    expect(updatedHero.hp).toBe(updatedHero.maxHp);

    // The benched member never departed, so their state is untouched by this run.
    const updatedBench = get(roster).adventurers.find((a) => a.id === 'bench')!;
    expect(updatedBench.level).toBe(1);

    expect(get(townStorage).items).toEqual([LOOT_ITEM]);
  });

  it('loses a run, still resets the party, and returns to town', () => {
    const drafted = hero('hero', { maxHp: 10, attackPower: 1 });
    roster.set({ adventurers: [drafted], recruitedIds: [] });

    // An overwhelming, faster enemy: it acts first and one-shots the hero before the hero can act at all.
    const room: RoomDefinition = {
      enemies: [createAdventurer('enemy', enemyTemplate({ maxHp: 100, attackPower: 50, speed: 20 }), 'front')],
    };

    startDungeon([drafted], [room], alwaysDropRng, lookupItem);

    const playback = get(dungeonPlayback);
    expect(playback?.outcome).toBe('loss');

    finishDungeonRun();

    expect(get(currentView)).toBe('town');

    const updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
    expect(updatedHero.hp).toBe(updatedHero.maxHp); // reset restores full HP regardless of outcome

    // A loss still merges whatever loot was collected before the wipe (none here, since the only room was lost).
    expect(get(townStorage).items).toEqual([]);
  });

  it('pauses between rooms, lets equipment change mid-run, then continues on to the next room', () => {
    const drafted = hero('hero');
    roster.set({ adventurers: [drafted], recruitedIds: [] });

    const weakEnemy = createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front');
    const secondEnemy = createAdventurer('second', enemyTemplate({ maxHp: 5 }), 'front');
    const rooms: RoomDefinition[] = [
      { enemies: [weakEnemy] },
      { enemies: [secondEnemy] },
    ];
    const ring: Item = { id: 'ring', name: 'Ring', slot: 'trinket', modifiers: [], price: 0 };

    startDungeon([drafted], rooms, () => 0, lookupItem);

    // First room won; run pauses here rather than resolving room 2 immediately.
    expect(get(dungeonPlayback)?.outcome).toBeNull();
    expect(get(currentView)).toBe('dungeon');

    unequipItemDuringRun('hero', 'weapon'); // no-op: nothing equipped yet, but exercises the path without throwing
    get(dungeonPlayback)!.inventory.items.push(ring);
    equipItemDuringRun('hero', ring);

    expect(get(roster).adventurers[0].equipment.trinket).toBe(ring);
    expect(get(dungeonPlayback)!.inventory.items).not.toContain(ring);

    continueDungeonRun(() => 0, lookupItem);

    expect(get(dungeonPlayback)?.outcome).toBe('completed');
    // The equip made during the pause carries through to the next (and final) room.
    expect(get(dungeonPlayback)?.runState.party[0].equipment.trinket).toBe(ring);

    finishDungeonRun();
    expect(get(currentView)).toBe('town');

    // Equipment survives the post-run reset; nothing else does.
    const updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
    expect(updatedHero.equipment.trinket).toBe(ring);
  });

  it('retreats from a between-room pause: ends the run, merges loot so far, returns to town', () => {
    const drafted = hero('hero');
    roster.set({ adventurers: [drafted], recruitedIds: [] });

    const weakEnemy = createAdventurer(
      'weak',
      enemyTemplate({ maxHp: 5, lootTable: [{ itemId: LOOT_ITEM.id, dropChance: 1 }] }),
      'front',
    );
    const rooms: RoomDefinition[] = [
      { enemies: [weakEnemy] },
      { enemies: [createAdventurer('e2', enemyTemplate({}), 'front')] },
    ];

    startDungeon([drafted], rooms, alwaysDropRng, lookupItem);
    expect(get(dungeonPlayback)?.outcome).toBeNull();

    retreatFromDungeon();

    expect(get(currentView)).toBe('town');
    expect(get(dungeonPlayback)).toBeNull();
    // Loot from the one room actually played still made it to town storage.
    expect(get(townStorage).items).toEqual([LOOT_ITEM]);

    const updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
    expect(updatedHero.hp).toBe(updatedHero.maxHp);
  });

  it('dismissLootPrompt marks an item so it stops being re-prompted, without equipping it', () => {
    const drafted = hero('hero');
    roster.set({ adventurers: [drafted], recruitedIds: [] });
    const room: RoomDefinition = {
      enemies: [
        createAdventurer('e', enemyTemplate({ maxHp: 5, lootTable: [{ itemId: LOOT_ITEM.id, dropChance: 1 }] }), 'front'),
      ],
    };

    startDungeon([drafted], [room], alwaysDropRng, lookupItem);

    const droppedItem = get(dungeonPlayback)!.inventory.items[0];
    expect(droppedItem.promptDismissed).toBeUndefined();

    dismissLootPrompt(droppedItem);

    expect(droppedItem.promptDismissed).toBe(true);
    // Still sitting in the run's inventory, unequipped — dismissing isn't equipping.
    expect(get(dungeonPlayback)!.inventory.items).toContain(droppedItem);
    expect(get(roster).adventurers[0].equipment.trinket).toBeNull();
  });

  it('dismissLootPrompt no-ops when there is no run in progress', () => {
    const item: Item = { id: 'orphan', name: 'Orphan Item', slot: 'trinket', modifiers: [], price: 0 };
    expect(() => dismissLootPrompt(item)).not.toThrow();
    expect(item.promptDismissed).toBeUndefined();
  });

  describe('activeRun sync (resume snapshot — see state/dungeonPlayback.ts\'s resumeFromSave)', () => {
    it('populates activeRun once a run starts, and keeps it in sync as rooms resolve', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      townStorage.set({ items: [], gold: 40 });

      const weakEnemy = createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front');
      const secondEnemy = createAdventurer('second', enemyTemplate({ maxHp: 5 }), 'front');
      const rooms: RoomDefinition[] = [{ enemies: [weakEnemy] }, { enemies: [secondEnemy] }];

      startDungeon([drafted], rooms, () => 0, lookupItem);

      expect(get(activeRun)).not.toBeNull();
      expect(get(activeRun)?.partyIds).toEqual(['hero']);
      expect(get(activeRun)?.currentRoomIndex).toBe(1); // room 0 already resolved
      expect(get(activeRun)?.partyGold).toBe(40);
      expect(get(activeRun)?.outcome).toBeNull();

      continueDungeonRun(() => 0, lookupItem);

      expect(get(activeRun)?.currentRoomIndex).toBe(2);
      expect(get(activeRun)?.outcome).toBe('completed');
    });

    it('clears activeRun once the run finishes, so there is nothing left to resume', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const room: RoomDefinition = { enemies: [createAdventurer('e', enemyTemplate(), 'front')] };

      startDungeon([drafted], [room], () => 0, lookupItem);
      expect(get(activeRun)).not.toBeNull();

      finishDungeonRun();

      expect(get(activeRun)).toBeNull();
    });

    it('clears activeRun on retreat', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front')] },
        { enemies: [createAdventurer('e2', enemyTemplate(), 'front')] },
      ];

      startDungeon([drafted], rooms, () => 0, lookupItem);
      retreatFromDungeon();

      expect(get(activeRun)).toBeNull();
    });
  });

  describe('runHistory tracking (a foundation for future achievements/branching paths)', () => {
    it('credits every party member on a completed run, even one who went Downed along the way', () => {
      const survivor = hero('survivor');
      const downed = hero('downed', { maxHp: 1 });
      roster.set({ adventurers: [survivor, downed], recruitedIds: [] });

      // A weak room the party still wins, but downed's own 1 HP means any landed hit fells them first.
      const room: RoomDefinition = { enemies: [createAdventurer('enemy', enemyTemplate({ maxHp: 3 }), 'front')] };

      startDungeon([survivor, downed], [room], () => 0, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('completed');

      finishDungeonRun();

      expect(get(runHistory).clearedWithIds.sort()).toEqual(['downed', 'survivor']);
    });

    it('does not credit anyone on a loss or a retreat', () => {
      const drafted = hero('hero', { maxHp: 10, attackPower: 1 });
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const overwhelming = createAdventurer('enemy', enemyTemplate({ maxHp: 100, attackPower: 50, speed: 20 }), 'front');

      startDungeon([drafted], [{ enemies: [overwhelming] }], alwaysDropRng, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('loss');
      finishDungeonRun();
      expect(get(runHistory).clearedWithIds).toEqual([]);

      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front')] },
        { enemies: [createAdventurer('e2', enemyTemplate(), 'front')] },
      ];
      startDungeon([drafted], rooms, () => 0, lookupItem);
      retreatFromDungeon();
      expect(get(runHistory).clearedWithIds).toEqual([]);
    });

    it('accumulates across multiple completed runs without duplicating an id', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const room: RoomDefinition = { enemies: [createAdventurer('enemy', enemyTemplate({ maxHp: 3 }), 'front')] };

      startDungeon([drafted], [room], () => 0, lookupItem);
      finishDungeonRun();
      startDungeon([drafted], [room], () => 0, lookupItem);
      finishDungeonRun();

      expect(get(runHistory).clearedWithIds).toEqual(['hero']);
    });
  });
});
