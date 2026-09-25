import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { recruitmentPool, refreshRecruitmentPool } from './recruitmentPool';
import { roster } from './roster';
import { plainFaces } from '../sim/dieFace';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import type { GameState } from './persistence';
import type { RecruitCandidate } from '../sim/recruitment';

describe('recruitmentPool', () => {
  it('excludes every already-recruited adventurer from the pool, and admits one back in if un-recruited', () => {
    refreshRecruitmentPool();
    const recruitedIds = get(roster).recruitedIds;
    for (const candidate of get(recruitmentPool)) {
      expect(recruitedIds).not.toContain(candidate.id);
    }

    const original = get(roster);
    const candidateToRecruit = get(recruitmentPool)[0];
    roster.set({ ...original, recruitedIds: [...original.recruitedIds, candidateToRecruit.id] });

    refreshRecruitmentPool();
    expect(get(recruitmentPool).map((c) => c.id)).not.toContain(candidateToRecruit.id);

    roster.set({ ...original, recruitedIds: original.recruitedIds });
    refreshRecruitmentPool();
    expect(get(recruitmentPool).map((c) => c.id)).toContain(candidateToRecruit.id);
  });
});

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Gudrun', // a real CHARACTER_TEMPLATES entry
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

// recruitmentPool's initial value is computed once, at module load, from INITIAL_SAVE — mocked and
// dynamically re-imported per case, same as state/roster.test.ts's module-init tests, for the same
// reason (a plain top-level import can't be reconfigured per test).
describe('recruitmentPool createInitialPool (module init)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('drops a saved candidate for a since-retired character (e.g. Envy)', async () => {
    const gudrunCandidate: RecruitCandidate = {
      id: 'gudrun',
      adventurer: createAdventurer('gudrun', template(), 'front'),
      cost: 50,
    };
    const envyCandidate: RecruitCandidate = {
      id: 'envy',
      adventurer: createAdventurer('envy', template({ name: 'Envy' }), 'front'),
      cost: 50,
    };

    const savedState: GameState = {
      roster: { adventurers: [], recruitedIds: [] },
      townStorage: { items: [], gold: 0 },
      dayCount: 0,
      activeRun: null,
      recruitmentPool: [gudrunCandidate, envyCandidate],
      runHistory: { clearedWithIds: [] },
    };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { recruitmentPool: pool } = await import('./recruitmentPool');
    expect(get(pool).map((c) => c.id)).toEqual(['gudrun']);
  });
});
