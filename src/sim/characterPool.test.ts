import { describe, it, expect } from 'vitest';
import { pickPoolEntry, type CharacterPoolEntry } from './characterPool';
import { RAGE_TRAIT } from './traits';
import { EmpowerAction } from './actions/support';
import type { SpecialAction } from './specialActions';

const SPECIAL: SpecialAction = { id: 'test-special', name: 'Test Special', trigger: 'on-turn-start', action: EmpowerAction };
const SPECIAL_ENTRY: CharacterPoolEntry = { kind: 'special-action', specialAction: SPECIAL };
const TRAIT_ENTRY: CharacterPoolEntry = { kind: 'trait', trait: RAGE_TRAIT };

describe('pickPoolEntry', () => {
  it('returns null for an empty pool', () => {
    expect(pickPoolEntry([], () => 0.5)).toBeNull();
  });

  it('always returns the only entry for a pool of one, regardless of rng', () => {
    expect(pickPoolEntry([TRAIT_ENTRY], () => 0)).toBe(TRAIT_ENTRY);
    expect(pickPoolEntry([TRAIT_ENTRY], () => 0.999)).toBe(TRAIT_ENTRY);
  });

  it('picks by rng index across a multi-entry pool', () => {
    const pool = [TRAIT_ENTRY, SPECIAL_ENTRY];
    expect(pickPoolEntry(pool, () => 0)).toBe(TRAIT_ENTRY);
    expect(pickPoolEntry(pool, () => 0.6)).toBe(SPECIAL_ENTRY);
  });
});
