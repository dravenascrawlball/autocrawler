import { describe, it, expect } from 'vitest';
import { createAdventurer } from './adventurer';
import { applyTraining, trainingCost, MAX_TRAINING_RANK, TRAINING_PERCENT_PER_RANK } from './training';
import { getEffectiveStat } from './stats';
import { GUDRUN_TEMPLATE } from '../data/characters';

describe('Training', () => {
  it('costs 20, 30, 40, 50, 60 Renown for ranks 1-5, and nothing past the cap', () => {
    expect([0, 1, 2, 3, 4].map(trainingCost)).toEqual([20, 30, 40, 50, 60]);
    expect(trainingCost(MAX_TRAINING_RANK)).toBeNull();
  });

  it('adds a percent to maxHp, attackPower and healPower per rank, replacing rather than stacking', () => {
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    const base = getEffectiveStat(gudrun.attackPower, 'attackPower', gudrun.modifiers);

    applyTraining(gudrun, 3);
    applyTraining(gudrun, 5);

    const expected = base * (1 + (5 * TRAINING_PERCENT_PER_RANK) / 100);
    expect(getEffectiveStat(gudrun.attackPower, 'attackPower', gudrun.modifiers)).toBeCloseTo(expected);
    expect(gudrun.modifiers.filter((m) => m.source === 'training')).toHaveLength(3);

    applyTraining(gudrun, 0);
    expect(gudrun.modifiers.filter((m) => m.source === 'training')).toHaveLength(0);
  });
});
