import { describe, it, expect } from 'vitest';
import { getEffectiveStat, type StatModifier } from './stats';

describe('getEffectiveStat', () => {
  it('sums flat modifiers onto the base value', () => {
    const modifiers: StatModifier[] = [
      { stat: 'range', type: 'flat', amount: 1, source: 'ring-of-reach' },
      { stat: 'range', type: 'flat', amount: 2, source: 'spear' },
      { stat: 'attackPower', type: 'flat', amount: 100, source: 'unrelated-stat' },
    ];

    expect(getEffectiveStat(1, 'range', modifiers)).toBe(4);
  });

  it('applies flat modifiers first, then the combined percent modifiers as a final multiplier', () => {
    const modifiers: StatModifier[] = [
      { stat: 'range', type: 'flat', amount: 2, source: 'spear' },
      { stat: 'range', type: 'percent', amount: 50, source: 'haste' },
      { stat: 'range', type: 'percent', amount: 25, source: 'eagle-eye' },
    ];

    // (base 1 + flat 2) * (1 + (50 + 25) / 100) = 3 * 1.75 = 5.25
    expect(getEffectiveStat(1, 'range', modifiers)).toBeCloseTo(5.25);
  });
});
