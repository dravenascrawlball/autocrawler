import { describe, it, expect } from 'vitest';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { plainFaces } from './dieFace';
import { applyBurn, applyPoison, tickStatusEffects } from './statusEffects';

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

describe('applyBurn / tickStatusEffects', () => {
  it('deals damagePerTick and counts down remainingTicks, removing the effect once exhausted', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBurn(unit, 2, 3);

    expect(tickStatusEffects(unit)).toEqual([{ effectId: 'burn', damage: 2 }]);
    expect(unit.hp).toBe(18);
    expect(unit.statusEffects).toHaveLength(1);

    tickStatusEffects(unit);
    expect(unit.hp).toBe(16);
    expect(unit.statusEffects).toHaveLength(1);

    tickStatusEffects(unit);
    expect(unit.hp).toBe(14);
    expect(unit.statusEffects).toEqual([]); // third and final tick removes it

    // A further tick with nothing active is a no-op.
    expect(tickStatusEffects(unit)).toEqual([]);
    expect(unit.hp).toBe(14);
  });

  it('refreshes rather than stacks when burn is applied again while already active', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBurn(unit, 2, 1);
    applyBurn(unit, 5, 3); // reapplied before the first stack ticks even once

    expect(unit.statusEffects).toEqual([{ id: 'burn', damagePerTick: 5, remainingTicks: 3 }]);
  });

  it('clamps damage so a tick can never reduce hp below 0', () => {
    const unit = createAdventurer('unit', template({ maxHp: 3 }), 'front');
    unit.hp = 2;
    applyBurn(unit, 10, 1);

    tickStatusEffects(unit);

    expect(unit.hp).toBe(0);
  });

  it('poison ticks independently of burn — both active at once tick separately, in a single call', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBurn(unit, 2, 3);
    applyPoison(unit, 1, 5);

    const ticks = tickStatusEffects(unit);

    expect(ticks).toEqual(
      expect.arrayContaining([
        { effectId: 'burn', damage: 2 },
        { effectId: 'poison', damage: 1 },
      ]),
    );
    expect(unit.hp).toBe(17); // 20 - 2 (burn) - 1 (poison)
    expect(unit.statusEffects).toHaveLength(2);
  });

  it('applyPoison refreshes rather than stacks when reapplied while already active', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyPoison(unit, 1, 2);
    applyPoison(unit, 3, 5); // reapplied before the first stack ticks even once

    expect(unit.statusEffects).toEqual([{ id: 'poison', damagePerTick: 3, remainingTicks: 5 }]);
  });
});
