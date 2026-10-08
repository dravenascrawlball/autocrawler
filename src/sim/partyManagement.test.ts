import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, AttackLowestHpAction } from './actions/attack';
import { EmpowerAction } from './actions/support';
import { equipItem, unequipItem, swapInAction, enchantFace, spareFaceCount, distinctFaceActions } from './partyManagement';
import { createRunInventory, type Item } from './items';
import type { SpecialAction } from './specialActions';

function heroTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Hero',
    maxHp: 30,
    attackPower: 100,
    speed: 10,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('equipItem / unequipItem', () => {
  it('moves an item between the run inventory and the adventurer, applying and removing its stat modifiers', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const sword: Item = {
      id: 'sword',
      name: 'Sword',
      slot: 'weapon',
      modifiers: [{ stat: 'attackPower', type: 'flat', amount: 5, source: 'item:sword' }],
      price: 0,
    };
    const betterSword: Item = {
      id: 'better-sword',
      name: 'Better Sword',
      slot: 'weapon',
      modifiers: [{ stat: 'attackPower', type: 'flat', amount: 9, source: 'item:better-sword' }],
      price: 0,
    };
    inventory.items.push(sword, betterSword);

    equipItem(hero, inventory, sword, 'weapon');

    expect(hero.equipment.weapon).toBe(sword);
    expect(inventory.items).toEqual([betterSword]);
    expect(hero.modifiers).toEqual([sword.modifiers[0]]);

    // Equipping into an occupied slot swaps the previous item back into the inventory.
    equipItem(hero, inventory, betterSword, 'weapon');

    expect(hero.equipment.weapon).toBe(betterSword);
    expect(inventory.items).toEqual([sword]);
    expect(hero.modifiers).toEqual([betterSword.modifiers[0]]);

    unequipItem(hero, inventory, 'weapon');

    expect(hero.equipment.weapon).toBeNull();
    expect(inventory.items).toEqual(expect.arrayContaining([sword, betterSword]));
    expect(inventory.items).toHaveLength(2);
    expect(hero.modifiers).toEqual([]);
  });

  it('rejects equipping an item into the wrong slot, and equipping an item not in the inventory', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const shield: Item = { id: 'shield', name: 'Shield', slot: 'armor', modifiers: [], price: 0 };
    inventory.items.push(shield);

    expect(() => equipItem(hero, inventory, shield, 'weapon')).toThrow();

    const notInInventory: Item = { id: 'ring', name: 'Ring', slot: 'trinket', modifiers: [], price: 0 };
    expect(() => equipItem(hero, inventory, notInInventory, 'trinket')).toThrow();
  });

  it('unequipping an empty slot is a no-op', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();

    expect(() => unequipItem(hero, inventory, 'armor')).not.toThrow();
    expect(inventory.items).toEqual([]);
  });
});

describe('equipItem / unequipItem: grantedSpecialAction (roadmap item 13)', () => {
  const RING_SPECIAL: SpecialAction = { id: 'test-ring-special', name: 'Test Ring Special', trigger: 'on-hit-landed', action: EmpowerAction };

  function ringItem(): Item {
    return {
      id: 'ring-of-embers',
      name: 'Ring of Embers',
      slot: 'trinket',
      modifiers: [],
      price: 0,
      grantedSpecialAction: RING_SPECIAL,
    };
  }

  it('equipping a Special-Action-granting item adds it to activeSpecialActions; unequipping removes it again', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const ring = ringItem();
    inventory.items.push(ring);

    equipItem(hero, inventory, ring, 'trinket');
    expect(hero.activeSpecialActions).toEqual([RING_SPECIAL]);

    unequipItem(hero, inventory, 'trinket');
    expect(hero.activeSpecialActions).toEqual([]);
  });

  it('is purely additive: granting alongside an already-active Special Action keeps both', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const joinTimeSpecial: SpecialAction = { id: 'join-time', name: 'Join Time', trigger: 'on-turn-start', action: EmpowerAction };
    hero.activeSpecialActions = [joinTimeSpecial];
    const inventory = createRunInventory();
    const ring = ringItem();
    inventory.items.push(ring);

    equipItem(hero, inventory, ring, 'trinket');
    expect(hero.activeSpecialActions).toEqual([joinTimeSpecial, RING_SPECIAL]);

    unequipItem(hero, inventory, 'trinket');
    expect(hero.activeSpecialActions).toEqual([joinTimeSpecial]);
  });

  it('swapping a new granting item into an occupied slot removes the previous grant first', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const otherSpecial: SpecialAction = { id: 'other-special', name: 'Other Special', trigger: 'on-turn-start', action: EmpowerAction };
    const inventory = createRunInventory();
    const ring = ringItem();
    const other: Item = { id: 'other-trinket', name: 'Other Trinket', slot: 'trinket', modifiers: [], price: 0, grantedSpecialAction: otherSpecial };
    inventory.items.push(ring, other);

    equipItem(hero, inventory, ring, 'trinket');
    expect(hero.activeSpecialActions).toEqual([RING_SPECIAL]);

    equipItem(hero, inventory, other, 'trinket');
    expect(hero.activeSpecialActions).toEqual([otherSpecial]);
  });

  it('an item without a grantedSpecialAction leaves activeSpecialActions untouched', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const plainSword: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 0 };
    inventory.items.push(plainSword);

    equipItem(hero, inventory, plainSword, 'weapon');
    expect(hero.activeSpecialActions).toEqual([]);
  });
});

describe('swapInAction / spareFaceCount / distinctFaceActions', () => {
  it('only replaces a die face when a spare owned copy of the action is available', () => {
    // Owns one spare copy via the template's bonusFaces extra (beyond its 6 starting dieFaces).
    const known = createAdventurer('known', heroTemplate({ bonusFaces: [AttackLowestHpAction] }), 'front');
    const accepted = swapInAction(known, AttackLowestHpAction, 0);

    expect(accepted).toBe(true);
    expect(known.dieFaces[0].action).toBe(AttackLowestHpAction);

    // No spare: a fresh hero owns exactly 6 copies of Attack Nearest (its starting dieFaces) and
    // nothing else — no spare Attack Lowest HP to swap in.
    const unknown = createAdventurer('unknown', heroTemplate(), 'front');
    expect(distinctFaceActions(unknown)).toEqual([AttackNearestAction]);

    const rejected = swapInAction(unknown, AttackLowestHpAction, 0);

    expect(rejected).toBe(false);
    expect(unknown.dieFaces[0].action).toBe(AttackNearestAction);
  });

  it('rejects an out-of-range face index', () => {
    const hero = createAdventurer('hero', heroTemplate({ bonusFaces: [AttackLowestHpAction] }), 'front');

    expect(swapInAction(hero, AttackLowestHpAction, 6)).toBe(false);
    expect(hero.dieFaces[0].action).toBe(AttackNearestAction);
  });

  it('spareFaceCount reflects owned minus currently-slotted copies, and drops to 0 once every spare is used', () => {
    // Owns 6 Attack Nearest (starting dieFaces) + 2 bonus Attack Lowest HP = 2 spares of the latter.
    const hero = createAdventurer('hero', heroTemplate({ bonusFaces: [AttackLowestHpAction, AttackLowestHpAction] }), 'front');

    expect(spareFaceCount(hero, AttackLowestHpAction)).toBe(2);
    expect(spareFaceCount(hero, AttackNearestAction)).toBe(0); // all 6 owned copies are already slotted

    expect(swapInAction(hero, AttackLowestHpAction, 0)).toBe(true);
    expect(spareFaceCount(hero, AttackLowestHpAction)).toBe(1);

    expect(swapInAction(hero, AttackLowestHpAction, 1)).toBe(true);
    expect(spareFaceCount(hero, AttackLowestHpAction)).toBe(0);

    // Third copy: no spare left.
    expect(swapInAction(hero, AttackLowestHpAction, 2)).toBe(false);
  });
});

describe('town-storage boundary', () => {
  it('never accepts or references anything resembling a town-storage identifier', () => {
    const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'partyManagement.ts');
    const source = readFileSync(filePath, 'utf-8');

    expect(source).not.toMatch(/town/i);
  });
});
