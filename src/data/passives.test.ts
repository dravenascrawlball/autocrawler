import { describe, it, expect } from 'vitest';
import { ALL_PASSIVES } from './passives';

describe('passive roster', () => {
  it('has unique ids across the whole roster', () => {
    const ids = ALL_PASSIVES.map((passive) => passive.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every passive at least one StatModifier', () => {
    for (const passive of ALL_PASSIVES) {
      expect(passive.modifiers.length).toBeGreaterThan(0);
    }
  });

  it('only uses stats already wired through getEffectiveStat elsewhere in the sim', () => {
    const wiredStats = new Set(['maxHp', 'speed', 'interRoomHeal', 'attackPower']);
    for (const passive of ALL_PASSIVES) {
      for (const modifier of passive.modifiers) {
        expect(wiredStats.has(modifier.stat)).toBe(true);
      }
    }
  });
});
