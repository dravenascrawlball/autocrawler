import { describe, it, expect } from 'vitest';
import { createTownStorage } from './townStorage';
import type { Item, ItemLookup } from './items';
import { buyShopItem } from './shop';

const SWORD: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 25 };
const lookupItem: ItemLookup = (id) => {
  if (id === SWORD.id) return SWORD;
  throw new Error(`unknown item ${id}`);
};

describe('buyShopItem', () => {
  it('deducts the item price and adds it to town storage when affordable', () => {
    const townStorage = createTownStorage();
    townStorage.gold = 30;

    const succeeded = buyShopItem('sword', lookupItem, townStorage);

    expect(succeeded).toBe(true);
    expect(townStorage.gold).toBe(5);
    expect(townStorage.items).toEqual([SWORD]);
  });

  it('fails cleanly with no side effects when gold is insufficient', () => {
    const townStorage = createTownStorage();
    townStorage.gold = 10;

    const succeeded = buyShopItem('sword', lookupItem, townStorage);

    expect(succeeded).toBe(false);
    expect(townStorage.gold).toBe(10);
    expect(townStorage.items).toEqual([]);
  });
});
