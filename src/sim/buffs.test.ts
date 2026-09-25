import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { applyBuff, tickBuffs } from './buffs';
import { getEffectiveStat } from './stats';

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

describe('applyBuff / tickBuffs', () => {
  it('grants the modifier immediately and it affects the relevant stat', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBuff(unit, 'test-armor', { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, 3);

    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(3);
    expect(unit.buffs).toEqual([{ id: 'test-armor', modifier: { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, remainingTurns: 3 }]);
  });

  it('refreshes (not stacks) a re-applied buff with the same id', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBuff(unit, 'test-armor', { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, 3);
    unit.buffs[0].remainingTurns = 1; // simulate it about to expire

    applyBuff(unit, 'test-armor', { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, 3);

    expect(unit.buffs).toHaveLength(1);
    expect(unit.buffs[0].remainingTurns).toBe(3);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(3); // not doubled
  });

  it('counts down remainingTurns and removes the modifier once expired', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyBuff(unit, 'test-armor', { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, 2);

    tickBuffs(unit);
    expect(unit.buffs[0].remainingTurns).toBe(1);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(3); // still active

    tickBuffs(unit);
    expect(unit.buffs).toEqual([]);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(0); // expired, modifier removed
  });

  it('leaves other permanent modifiers untouched when a buff expires', () => {
    const unit = createAdventurer('unit', template(), 'front', [
      { stat: 'armor', type: 'flat', amount: 2, source: 'item:test-armor' },
    ]);
    applyBuff(unit, 'test-armor', { stat: 'armor', type: 'flat', amount: 3, source: 'buff:test' }, 1);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(5);

    tickBuffs(unit);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(2); // buff gone, gear modifier remains
  });
});
