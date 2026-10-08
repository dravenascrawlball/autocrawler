import { describe, it, expect, beforeEach } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { metaProgression } from './metaProgression';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import type { RecruitCandidate } from '../sim/recruitment';
import { recruitmentPool } from './recruitmentPool';
import { recruitAdventurer, buyKitFromShop } from './townActions';
import { KIT_SHOP_CATALOG } from '../data/kitShop';

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
    metaProgression.set({ renown: 0, unlockedKitIds: {} });
  });

  describe('recruitAdventurer', () => {
    function makeCandidate(id: string, cost: number): RecruitCandidate {
      const adventurer = createAdventurer(id, template(), 'front');
      adventurer.name = 'Fenwick';
      return { id, adventurer, cost };
    }

    it('deducts Renown, marks the candidate recruited, and removes them from the pool', () => {
      const candidate = makeCandidate('candidate-a', 50);
      const other = makeCandidate('candidate-b', 60);
      recruitmentPool.set([candidate, other]);
      roster.set({ adventurers: [candidate.adventurer, other.adventurer], recruitedIds: [] });
      metaProgression.set({ renown: 100, unlockedKitIds: {} });

      const succeeded = recruitAdventurer('candidate-a');

      expect(succeeded).toBe(true);
      expect(get(metaProgression).renown).toBe(50);
      expect(get(roster).recruitedIds).toEqual(['candidate-a']);
      expect(get(recruitmentPool).map((c) => c.id)).toEqual(['candidate-b']);
    });

    it('fails cleanly with no side effects when Renown is insufficient', () => {
      const candidate = makeCandidate('candidate-a', 50);
      recruitmentPool.set([candidate]);
      roster.set({ adventurers: [candidate.adventurer], recruitedIds: [] });
      metaProgression.set({ renown: 10, unlockedKitIds: {} });

      const succeeded = recruitAdventurer('candidate-a');

      expect(succeeded).toBe(false);
      expect(get(metaProgression).renown).toBe(10);
      expect(get(roster).recruitedIds).toEqual([]);
      expect(get(recruitmentPool).map((c) => c.id)).toEqual(['candidate-a']);
    });

    it('returns false for an id no longer in the pool', () => {
      recruitmentPool.set([]);
      expect(recruitAdventurer('nonexistent')).toBe(false);
    });
  });

  describe('buyKitFromShop', () => {
    const [firstEntry] = KIT_SHOP_CATALOG;

    it('deducts the Kit price and records the unlock when affordable', () => {
      metaProgression.set({ renown: 100, unlockedKitIds: {} });

      const succeeded = buyKitFromShop(firstEntry.characterName, firstEntry.kit.id);

      expect(succeeded).toBe(true);
      expect(get(metaProgression).renown).toBe(100 - firstEntry.price);
      expect(get(metaProgression).unlockedKitIds[firstEntry.characterName]).toEqual([firstEntry.kit.id]);
    });

    it('fails cleanly when Renown is insufficient', () => {
      metaProgression.set({ renown: 0, unlockedKitIds: {} });

      const succeeded = buyKitFromShop(firstEntry.characterName, firstEntry.kit.id);

      expect(succeeded).toBe(false);
      expect(get(metaProgression).renown).toBe(0);
      expect(get(metaProgression).unlockedKitIds[firstEntry.characterName]).toBeUndefined();
    });

    it('returns false for a kit/character pairing not in the catalog', () => {
      metaProgression.set({ renown: 1000, unlockedKitIds: {} });
      expect(buyKitFromShop('Nobody', 'nonexistent-kit')).toBe(false);
    });
  });
});
