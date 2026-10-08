import { describe, it, expect, beforeEach } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { currentView } from './view';
import { dungeonPlayback } from './dungeonPlayback';
import { activeRun } from './activeRun';
import { runHistory } from './runHistory';
import { lastRunReward } from './progression';
import { metaProgression } from './metaProgression';
import { ROOM_CLEAR_RENOWN, RUN_COMPLETION_BONUS_RENOWN } from '../sim/renown';
import {
  startDungeon,
  finishDungeonRun,
  continueDungeonRun,
  retreatFromDungeon,
  equipItemDuringRun,
  unequipItemDuringRun,
  dismissLootPrompt,
  buyRecruitOffer,
  placePartyMemberDuringRun,
  returnPartyMemberToTrayDuringRun,
} from './dungeonOrchestrator';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { createTownStorage } from '../sim/townStorage';
import { GUDRUN_TEMPLATE, DRIFTA_TEMPLATE } from '../data/characters';
import { DRIFTA_ADRENALINE_RUSH_SPECIAL, DRIFTA_OPENING_STRIKE_SPECIAL, DRIFTA_EXECUTE_STRIKE_SPECIAL } from '../data/specialActions';
import { MAX_PARTY_SIZE } from '../sim/draft';
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
    runHistory.set({ clearedWithIds: [], characterStats: {} });
    metaProgression.set({ renown: 0, unlockedKitIds: {} });
  });

  it('finishing a run records per-character stats and the reward the town toast shows', () => {
    const drafted = hero('hero');
    roster.set({ adventurers: [drafted], recruitedIds: [] });
    const room: RoomDefinition = { enemies: [createAdventurer('enemy', enemyTemplate(), 'front')] };

    startDungeon([drafted], [room], () => 0, lookupItem);
    finishDungeonRun();

    expect(get(runHistory).characterStats.hero).toEqual({ runs: 1, clears: 1, bestRoomsWon: 1 });
    expect(get(lastRunReward)).toMatchObject({
      outcome: 'completed',
      renown: { roomsWon: 1, roomRenown: ROOM_CLEAR_RENOWN, completionBonus: RUN_COMPLETION_BONUS_RENOWN },
    });
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

    // Run loot/gold never bank to town storage anymore — see Town Storage Cleanup, docs/roadmap.md.
    expect(get(townStorage).items).toEqual([]);
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

    // Run loot/gold never bank to town storage, loss or not — see Town Storage Cleanup, docs/roadmap.md.
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

    // Equipment is run-scoped now — it clears on the post-run reset, same as everything else.
    const updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
    expect(updatedHero.equipment.trinket).toBeNull();
  });

  it('retreats from a between-room pause: ends the run, discards whatever loot was collected, returns to town', () => {
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
    // Loot from the one room actually played never made it to town storage — run-scoped only.
    expect(get(townStorage).items).toEqual([]);

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

  it("pays a won room's flat clearGold into run gold, on top of enemy drops", () => {
    const runGoldAfterRoom0 = (clearGold?: number): number => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front')], clearGold },
        { enemies: [createAdventurer('second', enemyTemplate({ maxHp: 5 }), 'front')] },
      ];
      startDungeon([drafted], rooms, () => 0, lookupItem);
      return get(dungeonPlayback)!.inventory.gold;
    };

    expect(runGoldAfterRoom0(25)).toBe(runGoldAfterRoom0() + 25);
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

  describe('between-room shop: Recruit section (start-with-1, grow-to-MAX_PARTY_SIZE)', () => {
    const rooms = (): RoomDefinition[] => [
      { enemies: [createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front')] },
      { enemies: [createAdventurer('second', enemyTemplate({ maxHp: 5 }), 'front')] },
    ];

    function setGold(gold: number): void {
      const playback = get(dungeonPlayback)!;
      dungeonPlayback.set({ ...playback, inventory: { ...playback.inventory, gold } });
    }

    it('rolls Recruit offers spanning the whole unlocked roster, flagging whoever is already in the party', () => {
      const drafted = hero('hero');
      const benchA = hero('bench-a');
      const benchB = hero('bench-b');
      roster.set({ adventurers: [drafted, benchA, benchB], recruitedIds: [] });

      startDungeon([drafted], rooms(), () => 0, lookupItem);

      const offers = get(dungeonPlayback)!.shopOffers.recruits;
      expect(offers.map((o) => o.adventurer.id).sort()).toEqual(['bench-a', 'bench-b', 'hero']);
      expect(offers.find((o) => o.adventurer.id === 'hero')!.alreadyInParty).toBe(true);
      expect(offers.find((o) => o.adventurer.id === 'bench-a')!.alreadyInParty).toBe(false);
      // Gudrun's town recruitCost (see data/characters.ts) — every test hero shares her template.
      expect(offers.find((o) => o.adventurer.id === 'bench-a')!.price).toBe(50);
    });

    it('buyRecruitOffer adds a new recruit to the party and spends run gold, never townStorage gold', () => {
      const drafted = hero('hero');
      const benchA = hero('bench-a');
      roster.set({ adventurers: [drafted, benchA], recruitedIds: [] });

      startDungeon([drafted], rooms(), () => 0, lookupItem);
      setGold(100);

      buyRecruitOffer('bench-a');

      expect(get(dungeonPlayback)!.runState.party.map((a) => a.id)).toEqual(['hero', 'bench-a']);
      expect(get(dungeonPlayback)!.inventory.gold).toBe(50);
      expect(get(dungeonPlayback)!.shopOffers.recruits.map((o) => o.adventurer.id)).not.toContain('bench-a');
      expect(get(townStorage).gold).toBe(0);
      expect(get(roster).recruitedIds).toEqual([]);
    });

    it('buyRecruitOffer on an already-in-party character levels them up instead of duplicating them', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });

      startDungeon([drafted], rooms(), () => 0, lookupItem);
      setGold(1000);
      const startingMaxHp = get(dungeonPlayback)!.runState.party[0].maxHp;

      buyRecruitOffer('hero');

      const party = get(dungeonPlayback)!.runState.party;
      expect(party).toHaveLength(1);
      expect(party[0].level).toBe(2);
      expect(party[0].maxHp).toBeGreaterThan(startingMaxHp);
      expect(get(dungeonPlayback)!.inventory.gold).toBe(1000 - 50);
    });

    it('buyRecruitOffer no-ops without enough run gold', () => {
      const drafted = hero('hero');
      const benchA = hero('bench-a');
      roster.set({ adventurers: [drafted, benchA], recruitedIds: [] });

      startDungeon([drafted], rooms(), () => 0, lookupItem);
      buyRecruitOffer('bench-a'); // starts at 0 gold

      expect(get(dungeonPlayback)!.runState.party.map((a) => a.id)).toEqual(['hero']);
    });

    it('buyRecruitOffer no-ops for an id not actually in the current offer', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });

      startDungeon([drafted], rooms(), () => 0, lookupItem);
      setGold(1000);
      buyRecruitOffer('not-offered');

      expect(get(dungeonPlayback)!.runState.party.map((a) => a.id)).toEqual(['hero']);
    });

    it('buyRecruitOffer on a new (non-party) character no-ops once the party is already at MAX_PARTY_SIZE', () => {
      const members = Array.from({ length: MAX_PARTY_SIZE }, (_, i) => hero(`member-${i}`));
      const extra = hero('extra');
      roster.set({ adventurers: [...members, extra], recruitedIds: [] });

      startDungeon(members, rooms(), () => 0, lookupItem);
      setGold(1000);
      const playback = get(dungeonPlayback)!;
      dungeonPlayback.set({
        ...playback,
        shopOffers: { ...playback.shopOffers, recruits: [{ adventurer: extra, price: 50, alreadyInParty: false }] },
      });

      buyRecruitOffer('extra');

      expect(get(dungeonPlayback)!.runState.party).toHaveLength(MAX_PARTY_SIZE);
    });
  });

  describe('meta-progression: character pool unlocks (clear a run with a character to unlock their next pool entry)', () => {
    it('grants no unlock before a character has ever cleared a run', () => {
      const drifta = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front');
      roster.set({ adventurers: [drifta], recruitedIds: [] });
      const overwhelming = createAdventurer('enemy', enemyTemplate({ maxHp: 100, attackPower: 50, speed: 20 }), 'front');

      // Not alwaysDropRng (0) here — Drifta now carries DODGE_TRAIT (the "pure auto-battler" pass),
      // and a constant-0 rng would make her dodge every incoming hit (0 < DODGE_CHANCE) rather than
      // actually losing. 0.5 keeps every attack landing (there's no more hit/miss roll) while staying
      // above DODGE_CHANCE.
      startDungeon([drifta], [{ enemies: [overwhelming] }], () => 0.5, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('loss');
      finishDungeonRun();

      const updated = get(roster).adventurers.find((a) => a.id === 'drifta')!;
      // Opening Strike and Execute Strike are both base-pool starting abilities (always available,
      // no unlock needed) — Adrenaline Rush is the separate meta-progression unlock, not granted yet.
      expect(updated.activeSpecialActions).toHaveLength(1);
      expect([DRIFTA_OPENING_STRIKE_SPECIAL, DRIFTA_EXECUTE_STRIKE_SPECIAL]).toContainEqual(updated.activeSpecialActions[0]);
    });

    it('grants the unlock on the reset immediately following the run that first clears with that character', () => {
      const drifta = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front');
      roster.set({ adventurers: [drifta], recruitedIds: [] });
      const room: RoomDefinition = { enemies: [createAdventurer('enemy', enemyTemplate({ maxHp: 3 }), 'front')] };

      startDungeon([drifta], [room], () => 0, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('completed');
      finishDungeonRun();

      expect(get(runHistory).clearedWithIds).toContain('drifta');
      const updated = get(roster).adventurers.find((a) => a.id === 'drifta')!;
      // Drifta's pool is now genuinely 3 entries (her 2 base-pool abilities plus the unlock), so
      // which one she joins with is a real random pick — just assert it's one of the three.
      expect(updated.activeSpecialActions).toHaveLength(1);
      expect([DRIFTA_OPENING_STRIKE_SPECIAL, DRIFTA_EXECUTE_STRIKE_SPECIAL, DRIFTA_ADRENALINE_RUSH_SPECIAL]).toContainEqual(
        updated.activeSpecialActions[0],
      );
    });

    it('does not grant the unlock on a loss or retreat, even with other party members clearing', () => {
      const drifta = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front');
      roster.set({ adventurers: [drifta], recruitedIds: [] });
      const overwhelming = createAdventurer('enemy', enemyTemplate({ maxHp: 100, attackPower: 50, speed: 20 }), 'front');

      // Not alwaysDropRng (0) here — Drifta now carries DODGE_TRAIT (the "pure auto-battler" pass),
      // and a constant-0 rng would make her dodge every incoming hit (0 < DODGE_CHANCE) rather than
      // actually losing. 0.5 keeps every attack landing (there's no more hit/miss roll) while staying
      // above DODGE_CHANCE.
      startDungeon([drifta], [{ enemies: [overwhelming] }], () => 0.5, lookupItem);
      finishDungeonRun();

      const updated = get(roster).adventurers.find((a) => a.id === 'drifta')!;
      expect(updated.activeSpecialActions).toHaveLength(1);
      expect([DRIFTA_OPENING_STRIKE_SPECIAL, DRIFTA_EXECUTE_STRIKE_SPECIAL]).toContainEqual(updated.activeSpecialActions[0]);
    });
  });

  describe('meta-progression: Renown (see sim/renown.ts\'s calculateRunRenown)', () => {
    it('awards the per-room floor plus the completion bonus on a fully cleared run', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('e1', enemyTemplate({ maxHp: 5 }), 'front')] },
        { enemies: [createAdventurer('e2', enemyTemplate({ maxHp: 5 }), 'front')] },
      ];

      startDungeon([drafted], rooms, () => 0, lookupItem);
      continueDungeonRun(() => 0, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('completed');

      finishDungeonRun();

      expect(get(metaProgression).renown).toBe(2 * ROOM_CLEAR_RENOWN + RUN_COMPLETION_BONUS_RENOWN);
    });

    it('still banks the per-room floor for rooms actually cleared on a loss, with no completion bonus', () => {
      const drafted = hero('hero', { maxHp: 10, attackPower: 1 });
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('weak', enemyTemplate({ maxHp: 5 }), 'front')] },
        { enemies: [createAdventurer('overwhelming', enemyTemplate({ maxHp: 100, attackPower: 50, speed: 20 }), 'front')] },
      ];

      startDungeon([drafted], rooms, () => 0, lookupItem);
      continueDungeonRun(() => 0, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBe('loss');

      finishDungeonRun();

      expect(get(metaProgression).renown).toBe(1 * ROOM_CLEAR_RENOWN);
    });

    it('banks the floor for whatever was cleared before a retreat, with no completion bonus, and accumulates across separate runs', () => {
      const drafted = hero('hero');
      roster.set({ adventurers: [drafted], recruitedIds: [] });
      const rooms: RoomDefinition[] = [
        { enemies: [createAdventurer('e1', enemyTemplate({ maxHp: 5 }), 'front')] },
        { enemies: [createAdventurer('e2', enemyTemplate({ maxHp: 5 }), 'front')] },
      ];

      // startDungeon resolves room 1, then pauses between rooms (outcome null) rather than
      // immediately playing room 2 — so the retreat below still banks that one room's floor.
      startDungeon([drafted], rooms, () => 0, lookupItem);
      expect(get(dungeonPlayback)?.outcome).toBeNull();
      retreatFromDungeon();

      expect(get(metaProgression).renown).toBe(1 * ROOM_CLEAR_RENOWN);

      startDungeon([drafted], [{ enemies: [createAdventurer('e3', enemyTemplate({ maxHp: 5 }), 'front')] }], () => 0, lookupItem);
      finishDungeonRun();

      expect(get(metaProgression).renown).toBe(2 * ROOM_CLEAR_RENOWN + RUN_COMPLETION_BONUS_RENOWN);
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

describe('between-room formation placement (tray + drag-and-drop)', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    townStorage.set(createTownStorage());
    dungeonPlayback.set(null);
    activeRun.set(null);
  });

  const threeRooms = () => [
    { enemies: [createAdventurer('e1', enemyTemplate({ maxHp: 5 }), 'front')] },
    { enemies: [createAdventurer('e2', enemyTemplate({ maxHp: 5 }), 'front')] },
    { enemies: [createAdventurer('e3', enemyTemplate({ maxHp: 5 }), 'front')] },
  ];

  function pauseWithRecruit() {
    const drafted = hero('hero');
    const recruit = hero('bench');
    roster.set({ adventurers: [drafted, recruit], recruitedIds: [] });
    startDungeon([drafted], threeRooms(), () => 0, lookupItem);
    const playback = get(dungeonPlayback)!;
    dungeonPlayback.set({ ...playback, inventory: { ...playback.inventory, gold: 1000 } });
    buyRecruitOffer('bench');
    return { drafted, recruit };
  }

  it('puts a newly bought recruit in the tray', () => {
    pauseWithRecruit();
    expect(get(dungeonPlayback)!.unplacedIds).toEqual(['bench']);
  });

  it('placing from the tray onto an occupied cell sends the occupant to the tray', () => {
    const { drafted, recruit } = pauseWithRecruit();
    placePartyMemberDuringRun('bench', drafted.position);
    expect(recruit.position).toEqual({ lane: 1, rank: 0 });
    expect(get(dungeonPlayback)!.unplacedIds).toEqual(['hero']);
  });

  it('can return a placed member to the tray', () => {
    pauseWithRecruit();
    returnPartyMemberToTrayDuringRun('hero');
    expect(get(dungeonPlayback)!.unplacedIds).toEqual(['bench', 'hero']);
  });

  it('auto-places anyone left in the tray on Continue, never sharing a cell', () => {
    const { drafted, recruit } = pauseWithRecruit();
    continueDungeonRun(() => 0, lookupItem);
    expect(get(dungeonPlayback)!.unplacedIds).toEqual([]);
    expect(recruit.position).not.toEqual(drafted.position);
  });
});
