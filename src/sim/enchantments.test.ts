import { describe, it, expect } from 'vitest';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { plainFaces } from './dieFace';
import {
  BURNING_ENCHANTMENT,
  BURN_DAMAGE_PER_TICK,
  BURN_TICKS,
  POISON_ENCHANTMENT,
  POISON_DAMAGE_PER_TICK,
  POISON_TICKS,
  ENCHANTMENT_REGISTRY,
} from './enchantments';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('BURNING_ENCHANTMENT', () => {
  it('is registered under its own id', () => {
    expect(ENCHANTMENT_REGISTRY.burning).toBe(BURNING_ENCHANTMENT);
  });

  it('applyOnHit gives the target a burn stack at the configured magnitude', () => {
    const target = createAdventurer('target', template(), 'front');

    BURNING_ENCHANTMENT.applyOnHit(target);

    expect(target.statusEffects).toEqual([
      { id: 'burn', damagePerTick: BURN_DAMAGE_PER_TICK, remainingTicks: BURN_TICKS },
    ]);
  });
});

describe('POISON_ENCHANTMENT', () => {
  it('is registered under its own id', () => {
    expect(ENCHANTMENT_REGISTRY.poison).toBe(POISON_ENCHANTMENT);
  });

  it('applyOnHit gives the target a poison stack at the configured magnitude', () => {
    const target = createAdventurer('target', template(), 'front');

    POISON_ENCHANTMENT.applyOnHit(target);

    expect(target.statusEffects).toEqual([
      { id: 'poison', damagePerTick: POISON_DAMAGE_PER_TICK, remainingTicks: POISON_TICKS },
    ]);
  });

  it('stacks independently of Burning — a target can carry both at once', () => {
    const target = createAdventurer('target', template(), 'front');

    BURNING_ENCHANTMENT.applyOnHit(target);
    POISON_ENCHANTMENT.applyOnHit(target);

    expect(target.statusEffects).toHaveLength(2);
    expect(target.statusEffects.map((effect) => effect.id).sort()).toEqual(['burn', 'poison']);
  });
});
