import { describe, it, expect } from 'vitest';
import { createRunInventory, type Item } from './items';

describe('createRunInventory', () => {
  it('starts empty, with zero gold', () => {
    const inventory = createRunInventory();
    expect(inventory).toEqual({ items: [], gold: 0 });
  });
});

describe('Item shape', () => {
  it('grantedSpecialAction is optional — a plain stat item omits it entirely', () => {
    const plainItem: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 0 };
    expect(plainItem.grantedSpecialAction).toBeUndefined();
  });
});
