import { describe, it, expect } from 'vitest';
import {
  resolveDefaultRow,
  resolvePosition,
  toRowLabel,
  isAdjacent,
  findFreeCell,
  assignUniquePositions,
  moveToCell,
  placeUnplaced,
  type GridPosition,
  type Placeable,
} from './formation';

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

const at = (lane: 0 | 1 | 2, rank: 0 | 1 | 2): GridPosition => ({ lane, rank });
const unit = (id: string, position: GridPosition): Placeable => ({ id, position });

describe('findFreeCell', () => {
  it('prefers the center lane of the preferred rank, then left, then right', () => {
    expect(findFreeCell([], 0)).toEqual(at(1, 0));
    expect(findFreeCell([at(1, 0)], 0)).toEqual(at(0, 0));
    expect(findFreeCell([at(1, 0), at(0, 0)], 0)).toEqual(at(2, 0));
  });

  it('falls back to the nearest other rank once the preferred rank is full', () => {
    expect(findFreeCell([at(0, 2), at(1, 2), at(2, 2)], 2)).toEqual(at(1, 1));
    expect(findFreeCell([at(0, 1), at(1, 1), at(2, 1)], 1)).toEqual(at(1, 0)); // tie goes frontward
  });

  it('returns null when every cell is taken', () => {
    const all = [0, 1, 2].flatMap((lane) => [0, 1, 2].map((rank) => at(lane as 0 | 1 | 2, rank as 0 | 1 | 2)));
    expect(findFreeCell(all, 0)).toBeNull();
  });
});

describe('assignUniquePositions', () => {
  it('keeps the first unit in a cell and spreads later ones around their own rank', () => {
    const units = [unit('a', at(1, 0)), unit('b', at(1, 0)), unit('c', at(1, 2)), unit('d', at(1, 0))];
    assignUniquePositions(units);
    expect(units.map((u) => u.position)).toEqual([at(1, 0), at(0, 0), at(1, 2), at(2, 0)]);
  });
});

describe('moveToCell', () => {
  it('moves a grid unit into an empty cell', () => {
    const units = [unit('a', at(1, 0))];
    expect(moveToCell(units, [], 'a', at(2, 2))).toEqual([]);
    expect(units[0].position).toEqual(at(2, 2));
  });

  it('swaps two grid units rather than stacking them', () => {
    const units = [unit('a', at(1, 0)), unit('b', at(0, 2))];
    moveToCell(units, [], 'a', at(0, 2));
    expect(units[0].position).toEqual(at(0, 2));
    expect(units[1].position).toEqual(at(1, 0));
  });

  it('sends the occupant back to the tray when placing from the tray', () => {
    const units = [unit('a', at(1, 0)), unit('b', at(1, 0))];
    const tray = moveToCell(units, ['b'], 'b', at(1, 0));
    expect(tray).toEqual(['a']);
    expect(units[1].position).toEqual(at(1, 0));
  });

  it('ignores tray units when deciding whether a cell is occupied', () => {
    const units = [unit('a', at(1, 0)), unit('b', at(1, 0))];
    const tray = moveToCell(units, ['a', 'b'], 'b', at(1, 0));
    expect(tray).toEqual(['a']);
  });
});

describe('placeUnplaced', () => {
  it('auto-places tray units into free cells near their own rank and empties the tray', () => {
    const units = [unit('a', at(1, 0)), unit('b', at(1, 0)), unit('c', at(1, 2))];
    expect(placeUnplaced(units, ['b', 'c'])).toEqual([]);
    expect(units.map((u) => u.position)).toEqual([at(1, 0), at(0, 0), at(1, 2)]);
  });
});
