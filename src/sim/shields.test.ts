import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { applyShield, tickShields, consumeShield } from './shields';

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

describe('applyShield / tickShields', () => {
  it('grants the shield immediately', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'test-shield', 10, 3);

    expect(unit.shields).toEqual([{ id: 'test-shield', amount: 10, remainingTurns: 3 }]);
  });

  it('refreshes (not stacks) a re-applied shield with the same id', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'test-shield', 10, 3);
    applyShield(unit, 'test-shield', 5, 1);

    expect(unit.shields).toEqual([{ id: 'test-shield', amount: 5, remainingTurns: 1 }]);
  });

  it('counts down remainingTurns and removes the shield once expired, regardless of leftover amount', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'test-shield', 10, 2);

    tickShields(unit);
    expect(unit.shields).toEqual([{ id: 'test-shield', amount: 10, remainingTurns: 1 }]);

    tickShields(unit);
    expect(unit.shields).toEqual([]);
  });

  it('leaves other active shields untouched when one expires', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'short', 5, 1);
    applyShield(unit, 'long', 10, 3);

    tickShields(unit);

    expect(unit.shields).toEqual([{ id: 'long', amount: 10, remainingTurns: 2 }]);
  });
});

describe('consumeShield', () => {
  it('absorbs up to the full incoming damage when the shield has enough capacity', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'test-shield', 10, 3);

    const absorbed = consumeShield(unit, 6);

    expect(absorbed).toBe(6);
    expect(unit.shields).toEqual([{ id: 'test-shield', amount: 4, remainingTurns: 3 }]);
  });

  it('absorbs only up to its remaining amount, removing the entry once fully depleted', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'test-shield', 6, 3);

    const absorbed = consumeShield(unit, 10);

    expect(absorbed).toBe(6);
    expect(unit.shields).toEqual([]);
  });

  it('returns 0 and leaves shields untouched when there is nothing active', () => {
    const unit = createAdventurer('unit', template(), 'front');
    expect(consumeShield(unit, 10)).toBe(0);
  });

  it('depletes older shields first when more than one is active', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyShield(unit, 'first', 5, 3);
    applyShield(unit, 'second', 5, 3);

    const absorbed = consumeShield(unit, 7);

    expect(absorbed).toBe(7);
    expect(unit.shields).toEqual([{ id: 'second', amount: 3, remainingTurns: 3 }]);
  });
});
