import { describe, it, expect, beforeEach } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { createTownStorage } from '../sim/townStorage';
import type { Item } from '../sim/items';
import type { RecruitCandidate } from '../sim/recruitment';
import { recruitmentPool } from './recruitmentPool';
import { equipItemForAdventurer, unequipItemForAdventurer, recruitAdventurer, buyShopItem } from './townActions';
import { RUSTY_DAGGER_ITEM } from '../data/items';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Adventurer',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('townActions', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    townStorage.set(createTownStorage());
  });

  describe('equipItemForAdventurer / unequipItemForAdventurer', () => {
    it('moves an item between town storage and the adventurer, applying/removing modifiers', () => {
      const hero = createAdventurer('hero', template(), 'front');
      roster.set({ adventurers: [hero], recruitedIds: [] });

      const sword: Item = {
        id: 'sword',
        name: 'Sword',
        slot: 'weapon',
        modifiers: [{ stat: 'attackPower', type: 'flat', amount: 5, source: 'item:sword' }],
        price: 0,
      };
      const betterSword: Item = {
        id: 'better-sword',
        name: 'Better Sword',
        slot: 'weapon',
        modifiers: [{ stat: 'attackPower', type: 'flat', amount: 9, source: 'item:better-sword' }],
        price: 0,
      };
      const storage = createTownStorage();
      storage.items.push(sword, betterSword);
      townStorage.set(storage);

      equipItemForAdventurer('hero', sword);

      let updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
      expect(updatedHero.equipment.weapon).toBe(sword);
      expect(get(townStorage).items).toEqual([betterSword]);
      expect(updatedHero.modifiers).toEqual([sword.modifiers[0]]);

      // Equipping a second weapon swaps the first back into town storage.
      equipItemForAdventurer('hero', betterSword);
      updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
      expect(updatedHero.equipment.weapon).toBe(betterSword);
      expect(get(townStorage).items).toEqual([sword]);

      unequipItemForAdventurer('hero', 'weapon');
      updatedHero = get(roster).adventurers.find((a) => a.id === 'hero')!;
      expect(updatedHero.equipment.weapon).toBeNull();
      expect(updatedHero.modifiers).toEqual([]);
      expect(get(townStorage).items).toEqual(expect.arrayContaining([sword, betterSword]));
      expect(get(townStorage).items).toHaveLength(2);
    });
  });

  describe('recruitAdventurer', () => {
    function makeCandidate(id: string, cost: number): RecruitCandidate {
      const adventurer = createAdventurer(id, template(), 'front');
      adventurer.name = 'Fenwick';
      return { id, adventurer, cost };
    }

    it('deducts gold, marks the candidate recruited, and removes them from the pool', () => {
      const candidate = makeCandidate('candidate-a', 50);
      const other = makeCandidate('candidate-b', 60);
      recruitmentPool.set([candidate, other]);
      roster.set({ adventurers: [candidate.adventurer, other.adventurer], recruitedIds: [] });
      const storage = createTownStorage();
      storage.gold = 100;
      townStorage.set(storage);

      const succeeded = recruitAdventurer('candidate-a');

      expect(succeeded).toBe(true);
      expect(get(townStorage).gold).toBe(50);
      expect(get(roster).recruitedIds).toEqual(['candidate-a']);
      expect(get(recruitmentPool).map((c) => c.id)).toEqual(['candidate-b']);
    });

    it('fails cleanly with no side effects when gold is insufficient', () => {
      const candidate = makeCandidate('candidate-a', 50);
      recruitmentPool.set([candidate]);
      roster.set({ adventurers: [candidate.adventurer], recruitedIds: [] });
      const storage = createTownStorage();
      storage.gold = 10;
      townStorage.set(storage);

      const succeeded = recruitAdventurer('candidate-a');

      expect(succeeded).toBe(false);
      expect(get(townStorage).gold).toBe(10);
      expect(get(roster).recruitedIds).toEqual([]);
      expect(get(recruitmentPool).map((c) => c.id)).toEqual(['candidate-a']);
    });

    it('returns false for an id no longer in the pool', () => {
      recruitmentPool.set([]);
      expect(recruitAdventurer('nonexistent')).toBe(false);
    });

  });

  describe('buyShopItem', () => {
    it('deducts the item price and adds it to town storage when affordable', () => {
      const storage = createTownStorage();
      storage.gold = 100;
      townStorage.set(storage);

      const succeeded = buyShopItem(RUSTY_DAGGER_ITEM.id);

      expect(succeeded).toBe(true);
      expect(get(townStorage).gold).toBe(100 - RUSTY_DAGGER_ITEM.price);
      expect(get(townStorage).items).toEqual([RUSTY_DAGGER_ITEM]);
    });

    it('fails cleanly when gold is insufficient', () => {
      const storage = createTownStorage();
      storage.gold = 0;
      townStorage.set(storage);

      const succeeded = buyShopItem(RUSTY_DAGGER_ITEM.id);

      expect(succeeded).toBe(false);
      expect(get(townStorage).gold).toBe(0);
      expect(get(townStorage).items).toEqual([]);
    });
  });
});
