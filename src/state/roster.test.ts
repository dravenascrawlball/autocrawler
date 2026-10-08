import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { plainFaces } from '../sim/dieFace';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import type { GameState } from './persistence';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Gudrun', // a real CHARACTER_TEMPLATES entry — see the "retired" test below for why that matters
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

function baseSave(roster: GameState['roster']): GameState {
  return {
    roster,
    townStorage: { items: [], gold: 0 },
    dayCount: 0,
    activeRun: null,
    recruitmentPool: [],
    runHistory: { clearedWithIds: [] },
    metaProgression: { renown: 0, unlockedKitIds: {} },
  };
}

// roster's initial value is computed once, at module load, from INITIAL_SAVE — these tests mock
// ./persistence and dynamically re-import the module per case so each gets its own fresh
// evaluation of that module-load-time logic (a plain top-level import can't be reconfigured per test).
describe('roster createInitialRosterState (module init)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('drops a saved adventurer whose name no longer matches any current CHARACTER_TEMPLATES entry', async () => {
    const gudrun = createAdventurer('gudrun', template(), 'front');
    const envy = createAdventurer('envy', template({ name: 'Envy' }), 'front');

    vi.doMock('./persistence', () => ({
      INITIAL_SAVE: baseSave({ adventurers: [gudrun, envy], recruitedIds: ['envy'] }),
    }));

    const { roster } = await import('./roster');
    const state = get(roster);

    expect(state.adventurers.map((a) => a.id)).toEqual(['gudrun']);
    // Envy's id is also dropped from recruitedIds — a retired character can't stay recruited.
    expect(state.recruitedIds).toEqual([]);
  });

  it('keeps a saved adventurer whose name still matches a current template', async () => {
    const gudrun = createAdventurer('gudrun', template(), 'front');

    vi.doMock('./persistence', () => ({
      INITIAL_SAVE: baseSave({ adventurers: [gudrun], recruitedIds: ['gudrun'] }),
    }));

    const { roster } = await import('./roster');
    const state = get(roster);

    expect(state.adventurers).toEqual([gudrun]);
    expect(state.recruitedIds).toEqual(['gudrun']);
  });
});
