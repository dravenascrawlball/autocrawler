import { describe, it, expect } from 'vitest';
import { resolveDefaultRow, resolvePosition, toRowLabel, isAdjacent } from './formation';

describe('resolveDefaultRow', () => {
  it('defaults Fighter (and any unlisted/missing role) to front', () => {
    expect(resolveDefaultRow({ role: 'Fighter' })).toBe('front');
    expect(resolveDefaultRow({ role: 'Rogue' })).toBe('front');
    expect(resolveDefaultRow({})).toBe('front');
  });

  it('defaults Healer, Mage, Tactician, and Ranger to back', () => {
    expect(resolveDefaultRow({ role: 'Healer' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Mage' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Tactician' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Ranger' })).toBe('back');
  });

  it('an explicit defaultRow overrides the role-based fallback', () => {
    expect(resolveDefaultRow({ role: 'Rogue', defaultRow: 'back' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Healer', defaultRow: 'front' })).toBe('front');
  });
});

describe('resolvePosition', () => {
  it('resolves the legacy "front"/"back" shorthand to a centered grid position', () => {
    expect(resolvePosition('front')).toEqual({ lane: 1, rank: 0 });
    expect(resolvePosition('back')).toEqual({ lane: 1, rank: 2 });
  });

  it('passes a real GridPosition through unchanged', () => {
    expect(resolvePosition({ lane: 0, rank: 1 })).toEqual({ lane: 0, rank: 1 });
  });
});

describe('toRowLabel', () => {
  it('is "front" only at rank 0, "back" for rank 1 or 2', () => {
    expect(toRowLabel({ lane: 1, rank: 0 })).toBe('front');
    expect(toRowLabel({ lane: 1, rank: 1 })).toBe('back');
    expect(toRowLabel({ lane: 2, rank: 2 })).toBe('back');
  });
});

describe('isAdjacent', () => {
  it('is true for orthogonal neighbors (one step in lane or rank, not both)', () => {
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 1, rank: 0 })).toBe(true);
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 1, rank: 2 })).toBe(true);
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 0, rank: 1 })).toBe(true);
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 2, rank: 1 })).toBe(true);
  });

  it('is false for the same cell, a diagonal neighbor, or anything farther', () => {
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 1, rank: 1 })).toBe(false); // same cell
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 0, rank: 0 })).toBe(false); // diagonal
    expect(isAdjacent({ lane: 1, rank: 1 }, { lane: 2, rank: 2 })).toBe(false); // diagonal
    expect(isAdjacent({ lane: 0, rank: 0 }, { lane: 2, rank: 0 })).toBe(false); // two lanes apart
  });
});
