import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type Adventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import {
  generateRecruitmentPool,
  recruitAdventurer,
  DEFAULT_RECRUITMENT_POOL_SIZE,
  type RecruitCandidate,
} from './recruitment';

function characterTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Fenwick',
    role: 'Fighter',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    recruitCost: 50,
    ...overrides,
  };
}

function adventurer(id: string, overrides: Partial<AdventurerTemplate> = {}): Adventurer {
  return createAdventurer(id, characterTemplate(overrides), 'front');
}

const costLookup = () => 50;

describe('generateRecruitmentPool', () => {
  it('builds one candidate per eligible unlocked adventurer, using the injected cost lookup', () => {
    const fenwick = adventurer('fenwick');

    const pool = generateRecruitmentPool([fenwick], new Set(), costLookup);

    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe('fenwick');
    expect(pool[0].adventurer).toBe(fenwick);
    expect(pool[0].cost).toBe(50);
  });

  it('excludes already-recruited adventurers', () => {
    const fenwick = adventurer('fenwick');
    const ysolde = adventurer('ysolde', { name: 'Ysolde' });

    const pool = generateRecruitmentPool([fenwick, ysolde], new Set(['fenwick']), costLookup);

    expect(pool.map((c) => c.id)).toEqual(['ysolde']);
  });

  it('caps the pool at `size`, defaulting to DEFAULT_RECRUITMENT_POOL_SIZE', () => {
    const adventurers = Array.from({ length: DEFAULT_RECRUITMENT_POOL_SIZE + 2 }, (_, i) =>
      adventurer(`character-${i}`, { name: `Character${i}` }),
    );

    const defaultPool = generateRecruitmentPool(adventurers, new Set(), costLookup);
    expect(defaultPool).toHaveLength(DEFAULT_RECRUITMENT_POOL_SIZE);

    const smallerPool = generateRecruitmentPool(adventurers, new Set(), costLookup, 1);
    expect(smallerPool).toHaveLength(1);
  });
});

describe('recruitAdventurer', () => {
  function makeCandidate(cost: number): RecruitCandidate {
    return { id: 'candidate-x', adventurer: adventurer('candidate-x'), cost };
  }

  it('deducts the cost, marks the candidate recruited, and removes them from the pool', () => {
    const candidate = makeCandidate(50);
    const otherCandidate = makeCandidate(60);
    const pool = [candidate, otherCandidate];
    const recruitedIds: string[] = [];
    const wallet = { renown: 100 };

    const succeeded = recruitAdventurer(candidate, pool, recruitedIds, wallet);

    expect(succeeded).toBe(true);
    expect(wallet.renown).toBe(50);
    expect(recruitedIds).toEqual(['candidate-x']);
    expect(pool).toEqual([otherCandidate]);
  });

  it('fails cleanly with no side effects when Renown is insufficient', () => {
    const candidate = makeCandidate(50);
    const pool = [candidate];
    const recruitedIds: string[] = [];
    const wallet = { renown: 49 }; // just short

    const succeeded = recruitAdventurer(candidate, pool, recruitedIds, wallet);

    expect(succeeded).toBe(false);
    expect(wallet.renown).toBe(49);
    expect(recruitedIds).toEqual([]);
    expect(pool).toEqual([candidate]);
  });

});
