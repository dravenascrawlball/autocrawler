import { describe, it, expect } from 'vitest';
import { rollTraits, UNIVERSAL_TRAIT_ROLL_CAP, type Trait } from './traits';

const HARDY: Trait = { id: 'hardy', name: 'Hardy', description: 'test fixture' };
const LUCKY: Trait = { id: 'lucky', name: 'Lucky', description: 'test fixture' };
const GRIZZLED: Trait = { id: 'grizzled', name: 'Grizzled', description: 'test fixture' };
const POOL = [HARDY, LUCKY, GRIZZLED];

describe('rollTraits', () => {
  it('returns an empty array for an empty pool', () => {
    expect(rollTraits([], 2, () => 0.5)).toEqual([]);
  });

  it('returns an empty array when maxCount is 0', () => {
    expect(rollTraits(POOL, 0, () => 0.5)).toEqual([]);
  });

  it('never returns more than maxCount entries', () => {
    expect(rollTraits(POOL, 2, () => 0)).toHaveLength(2);
  });

  it('never returns more entries than the pool has, even if maxCount is larger', () => {
    expect(rollTraits(POOL, 10, () => 0)).toHaveLength(POOL.length);
  });

  it('never returns duplicate entries', () => {
    const picked = rollTraits(POOL, 3, () => 0.999);
    const ids = picked.map((trait) => trait.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate the pool passed in', () => {
    const copy = [...POOL];
    rollTraits(POOL, 2, () => 0.5);
    expect(POOL).toEqual(copy);
  });
});

describe('UNIVERSAL_TRAIT_ROLL_CAP', () => {
  it('is 2, per docs/kit-trait-tag-framework.md\'s locked-in decision', () => {
    expect(UNIVERSAL_TRAIT_ROLL_CAP).toBe(2);
  });
});
