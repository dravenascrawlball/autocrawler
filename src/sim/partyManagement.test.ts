import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, AttackLowestHpAction, PowerAttackAction } from './actions/attack';
import {
  equipItem,
  unequipItem,
  swapInAction,
  enchantFace,
  spareFaceCount,
  distinctFaceActions,
  isFaceLockedByEquipment,
} from './partyManagement';
import { createRunInventory, type Item } from './items';

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

describe('equipItem / unequipItem: faceEffect (roadmap item 13)', () => {
  function replaceActionItem(faceIndex: number): Item {
    return {
      id: 'tome-of-power',
      name: 'Tome of Power',
      slot: 'trinket',
      modifiers: [],
      price: 0,
      faceEffect: { faceIndex, effect: { kind: 'replace-action', action: PowerAttackAction } },
    };
  }

  function enchantItem(faceIndex: number): Item {
    return {
      id: 'ring-of-embers',
      name: 'Ring of Embers',
      slot: 'trinket',
      modifiers: [],
      price: 0,
      faceEffect: { faceIndex, effect: { kind: 'enchant', enchantmentId: 'burning' } },
    };
  }

  it('a replace-action item overwrites the target face on equip and restores it exactly on unequip', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front'); // all 6 faces start as Attack Nearest
    const inventory = createRunInventory();
    const tome = replaceActionItem(2);
    inventory.items.push(tome);

    equipItem(hero, inventory, tome, 'trinket');

    expect(hero.dieFaces[2].action).toBe(PowerAttackAction);
    expect(tome.faceEffect?.previousFace).toEqual({ action: AttackNearestAction });

    unequipItem(hero, inventory, 'trinket');

    expect(hero.dieFaces[2].action).toBe(AttackNearestAction);
    expect(tome.faceEffect?.previousFace).toBeUndefined();
  });

  it('an enchant item enchants the target face on equip and restores it exactly on unequip', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    hero.dieFaces[3] = { action: AttackLowestHpAction }; // some pre-existing, unenchanted face
    const inventory = createRunInventory();
    const ring = enchantItem(3);
    inventory.items.push(ring);

    equipItem(hero, inventory, ring, 'trinket');

    expect(hero.dieFaces[3]).toEqual({ action: AttackLowestHpAction, enchantmentId: 'burning' });

    unequipItem(hero, inventory, 'trinket');

    expect(hero.dieFaces[3]).toEqual({ action: AttackLowestHpAction });
  });

  it('swapping a new item into an occupied slot restores the previous item\'s face effect first', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const tome = replaceActionItem(0);
    const ring = enchantItem(0);
    inventory.items.push(tome, ring);

    equipItem(hero, inventory, tome, 'trinket');
    expect(hero.dieFaces[0].action).toBe(PowerAttackAction);

    equipItem(hero, inventory, ring, 'trinket');

    // The tome's effect was reverted before the ring's was applied.
    expect(hero.dieFaces[0]).toEqual({ action: AttackNearestAction, enchantmentId: 'burning' });
    expect(tome.faceEffect?.previousFace).toBeUndefined();
  });

  it('isFaceLockedByEquipment is true only while a faceEffect item is actively equipped', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const inventory = createRunInventory();
    const tome = replaceActionItem(1);
    inventory.items.push(tome);

    expect(isFaceLockedByEquipment(hero, 1)).toBe(false); // still just sitting in inventory

    equipItem(hero, inventory, tome, 'trinket');
    expect(isFaceLockedByEquipment(hero, 1)).toBe(true);

    unequipItem(hero, inventory, 'trinket');
    expect(isFaceLockedByEquipment(hero, 1)).toBe(false);
  });

  it('swapInAction and enchantFace refuse to touch a face locked by an equipped item', () => {
    const hero = createAdventurer('hero', heroTemplate({ bonusFaces: [AttackLowestHpAction] }), 'front');
    const inventory = createRunInventory();
    const tome = replaceActionItem(4);
    inventory.items.push(tome);
    equipItem(hero, inventory, tome, 'trinket');

    expect(swapInAction(hero, AttackLowestHpAction, 4)).toBe(false);
    expect(hero.dieFaces[4].action).toBe(PowerAttackAction); // untouched

    expect(enchantFace(hero, 4, 'burning')).toBe(false);
    expect(hero.dieFaces[4]).toEqual({ action: PowerAttackAction }); // untouched, no enchantment applied

    // An unlocked face is unaffected.
    expect(swapInAction(hero, AttackLowestHpAction, 5)).toBe(true);
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
