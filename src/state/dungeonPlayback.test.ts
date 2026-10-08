import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { plainFaces } from '../sim/dieFace';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import type { GameState } from './persistence';
import type { RoomDefinition } from '../sim/dungeonRun';

// Named 'Gudrun' (a real CHARACTER_TEMPLATES entry) rather than a made-up name — roster.ts's
// createInitialRosterState drops any saved adventurer whose name isn't a current character (see
// its dropRetiredCharacters, added when Envy was retired), so a fake name would get silently
// filtered out of the reconstructed roster and break these tests.
function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Gudrun',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

function baseSave(overrides: Partial<GameState['activeRun']> = {}): GameState {
  return {
    roster: { adventurers: [], recruitedIds: [] },
    townStorage: { items: [], gold: 0 },
    dayCount: 3,
    activeRun: {
      rooms: [{ enemies: [] }],
      currentRoomIndex: 0,
      partyIds: [],
      partyGold: 0,
      inventory: { items: [], gold: 0 },
      outcome: null,
      activeRelics: [],
      ...overrides,
    },
    recruitmentPool: [],
    runHistory: { clearedWithIds: [] },
    metaProgression: { renown: 0, unlockedKitIds: {} },
  };
}

// dungeonPlayback's initial value is computed once, at module load, from INITIAL_SAVE — these tests
// mock ./persistence and dynamically re-import the module per case so each gets its own fresh
// evaluation of that module-load-time logic (a plain top-level import can't be reconfigured per test).
describe('dungeonPlayback resumeFromSave (module init)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reconstructs a paused playback state from a saved run, sharing live roster Adventurer references', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.hp = 8; // mid-run damage, already persisted via the roster
    const room: RoomDefinition = { enemies: [] };

    const savedState = baseSave({
      rooms: [room, room],
      currentRoomIndex: 1,
      partyIds: ['hero'],
      partyGold: 25,
      inventory: { items: [], gold: 10 },
    });
    savedState.roster = { adventurers: [hero], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    const playback = get(dungeonPlayback);

    expect(playback).not.toBeNull();
    expect(playback?.currentRecord).toBeUndefined(); // nothing to replay — lands straight on Between Rooms
    expect(playback?.outcome).toBeNull();
    expect(playback?.runState.roomIndex).toBe(1);
    expect(playback?.runState.partyGold).toBe(25);
    expect(playback?.runState.party).toEqual([hero]);
    expect(playback?.runState.party[0]).toBe(hero); // same live object, not a copy
    expect(playback?.runState.downedDuringRun.size).toBe(0);
    expect(playback?.inventory.gold).toBe(10);
  });

  it('marks a party member downed on resume when their persisted hp is 0', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.hp = 0;

    const savedState = baseSave({ partyIds: ['hero'] });
    savedState.roster = { adventurers: [hero], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    expect(get(dungeonPlayback)?.runState.downedDuringRun.has('hero')).toBe(true);
  });

  it('carries over a non-null outcome (run already ended, pending Return to Town)', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    const savedState = baseSave({ partyIds: ['hero'], outcome: 'completed' });
    savedState.roster = { adventurers: [hero], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    expect(get(dungeonPlayback)?.outcome).toBe('completed');
  });

  it('returns null with no saved activeRun', async () => {
    vi.doMock('./persistence', () => ({ INITIAL_SAVE: null }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    expect(get(dungeonPlayback)).toBeNull();
  });

  it('returns null if none of the saved partyIds still exist on the roster', async () => {
    const savedState = baseSave({ partyIds: ['ghost'] });
    savedState.roster = { adventurers: [], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    expect(get(dungeonPlayback)).toBeNull();
  });

  it('rolls fresh shop offers on resume (not persisted — see ActiveDungeonRunState) when the run is still paused', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    const bench = createAdventurer('bench', template({ name: 'Bodil' }), 'front');
    const savedState = baseSave({ partyIds: ['hero'] });
    savedState.roster = { adventurers: [hero, bench], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    const playback = get(dungeonPlayback);
    expect(playback?.shopOffers.recruits.map((o) => o.adventurer.id).sort()).toEqual(['bench', 'hero']);
  });

  it('rolls no shop offers on resume once the run has already ended', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    const bench = createAdventurer('bench', template({ name: 'Bodil' }), 'front');
    const savedState = baseSave({ partyIds: ['hero'], outcome: 'completed' });
    savedState.roster = { adventurers: [hero, bench], recruitedIds: [] };

    vi.doMock('./persistence', () => ({ INITIAL_SAVE: savedState }));

    const { dungeonPlayback } = await import('./dungeonPlayback');
    const playback = get(dungeonPlayback);
    expect(playback?.shopOffers).toEqual({ recruits: [], relics: [], equipment: [] });
  });
});
