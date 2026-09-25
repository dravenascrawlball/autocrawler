import { describe, it, expect } from 'vitest';
import { createRunInventory, type Item } from './items';
import { createTownStorage, mergeRunInventoryIntoTown, spendGold } from './townStorage';

describe('spendGold', () => {
  it('deducts the amount and returns true when affordable', () => {
    const townStorage = createTownStorage();
    townStorage.gold = 50;

    expect(spendGold(townStorage, 30)).toBe(true);
    expect(townStorage.gold).toBe(20);
  });

  it('no-ops and returns false when insufficient', () => {
    const townStorage = createTownStorage();
    townStorage.gold = 10;

    expect(spendGold(townStorage, 30)).toBe(false);
    expect(townStorage.gold).toBe(10);
  });
});

describe('mergeRunInventoryIntoTown', () => {
  it('moves every item from the run inventory into town storage, leaving the run inventory empty', () => {
    const sword: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 0 };
    const ring: Item = { id: 'ring', name: 'Ring', slot: 'trinket', modifiers: [], price: 0 };

    const runInventory = createRunInventory();
    runInventory.items.push(sword, ring);
    const townStorage = createTownStorage();

    mergeRunInventoryIntoTown(runInventory, townStorage);

    expect(townStorage.items).toEqual([sword, ring]);
    expect(runInventory.items).toEqual([]);
  });

  it('merges into existing town storage without discarding what was already there', () => {
    const existing: Item = { id: 'shield', name: 'Shield', slot: 'armor', modifiers: [], price: 0 };
    const townStorage = createTownStorage();
    townStorage.items.push(existing);

    const dropped: Item = { id: 'potion', name: 'Potion', slot: 'trinket', modifiers: [], price: 0 };
    const runInventory = createRunInventory();
    runInventory.items.push(dropped);

    mergeRunInventoryIntoTown(runInventory, townStorage);

    expect(townStorage.items).toEqual([existing, dropped]);
    expect(runInventory.items).toEqual([]);
  });

  it('is a no-op safe to call on an empty run inventory (e.g. a run with no loot)', () => {
    const townStorage = createTownStorage();
    const runInventory = createRunInventory();

    mergeRunInventoryIntoTown(runInventory, townStorage);

    expect(townStorage.items).toEqual([]);
    expect(runInventory.items).toEqual([]);
  });

  it('merges the same way regardless of why the run ended (completed, loss, or retreat)', () => {
    for (const outcome of ['completed', 'loss', 'retreat'] as const) {
      const item: Item = { id: `loot-${outcome}`, name: `Loot from ${outcome}`, slot: 'trinket', modifiers: [], price: 0 };
      const runInventory = createRunInventory();
      runInventory.items.push(item);
      const townStorage = createTownStorage();

      mergeRunInventoryIntoTown(runInventory, townStorage);

      expect(townStorage.items).toEqual([item]);
      expect(runInventory.items).toEqual([]);
    }
  });
});
