import { describe, it, expect } from 'vitest';
import { createAdventurer, grantSecondPoolSpecial } from './adventurer';
import { applyTraining, trainingCost, MAX_TRAINING_RANK, TRAINING_PERCENT_PER_RANK } from './training';
import { getEffectiveStat } from './stats';
import { GUDRUN_TEMPLATE, MIRA_TEMPLATE } from '../data/characters';

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

describe('grantSecondPoolSpecial (duplicate stars)', () => {
  it('adds a different Special from the pool, and nothing once every pool Special is active', () => {
    const mira = createAdventurer('mira', MIRA_TEMPLATE, 'back', [], [], [], () => 0);
    const pool = MIRA_TEMPLATE.specialActionPool!;

    expect(grantSecondPoolSpecial(mira, pool, () => 0)?.id).toBe('mira-revive');
    expect(mira.activeSpecialActions.map((s) => s.id)).toEqual(['mira-splash-heal', 'mira-potion-toss-ally', 'mira-revive']);
    expect(grantSecondPoolSpecial(mira, pool, () => 0)).toBeNull();
  });
});
