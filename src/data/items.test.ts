import { describe, it, expect } from 'vitest';
import { ALL_ITEMS, ITEM_REGISTRY, STARTER_TOWN_ITEMS } from './items';
import { GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE } from './enemies';

describe('item roster', () => {
  it('has unique ids across the whole roster', () => {
    const ids = ALL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every item at least one StatModifier', () => {
    for (const item of ALL_ITEMS) {
      expect(item.modifiers.length).toBeGreaterThan(0);
    }
  });

  it('registers every roster item by id', () => {
    for (const item of ALL_ITEMS) {
      expect(ITEM_REGISTRY[item.id]).toBe(item);
    }
  });

  it('fills every equipment slot with more than one item', () => {
    const bySlot = { weapon: 0, armor: 0, trinket: 0 };
    for (const item of ALL_ITEMS) {
      bySlot[item.slot] += 1;
    }
    expect(bySlot.weapon).toBeGreaterThan(1);
    expect(bySlot.armor).toBeGreaterThan(1);
    expect(bySlot.trinket).toBeGreaterThan(1);
  });

  it('includes at least one percent-type modifier somewhere in the roster', () => {
    const hasPercent = ALL_ITEMS.some((item) => item.modifiers.some((m) => m.type === 'percent'));
    expect(hasPercent).toBe(true);
  });

  it('resolves every starter item through the registry', () => {
    for (const item of STARTER_TOWN_ITEMS) {
      expect(ITEM_REGISTRY[item.id]).toBe(item);
    }
  });
});

describe('enemy loot tables', () => {
  const enemyTemplates = [GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE];

  it('gives every current enemy type a loot table that resolves through the item registry', () => {
    for (const template of enemyTemplates) {
      expect(template.lootTable).toBeDefined();
      expect(template.lootTable!.length).toBeGreaterThan(0);
      for (const entry of template.lootTable!) {
        expect(ITEM_REGISTRY[entry.itemId]).toBeDefined();
        expect(entry.dropChance).toBeGreaterThan(0);
        expect(entry.dropChance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not share loot table items across enemy types (each enemy has its own themed pool)', () => {
    const idSets = enemyTemplates.map((t) => new Set(t.lootTable!.map((e) => e.itemId)));
    for (let i = 0; i < idSets.length; i += 1) {
      for (let j = i + 1; j < idSets.length; j += 1) {
        const overlap = [...idSets[i]].filter((id) => idSets[j].has(id));
        expect(overlap).toEqual([]);
      }
    }
  });
});
