import { describe, it, expect } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { dayCount } from './dayCount';
import { activeRun } from './activeRun';
import { dungeonPlayback } from './dungeonPlayback';
import { currentView } from './view';
import { recruitmentPool } from './recruitmentPool';
import { openingShop, startOpeningShop } from './openingShop';
import { resetGame } from './newGame';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { createTownStorage } from '../sim/townStorage';
import { createStarterRoster } from '../data/roster';
import { STARTER_TOWN_ITEMS } from '../data/items';
import type { RoomDefinition } from '../sim/dungeonRun';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Dirty',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('resetGame', () => {
  it('resets every store to exactly what a brand new install looks like', () => {
    // Dirty every store resetGame touches.
    roster.set({ adventurers: [createAdventurer('dirty', template(), 'front')], recruitedIds: ['dirty'] });

    const dirtyStorage = createTownStorage();
    dirtyStorage.gold = 999;
    townStorage.set(dirtyStorage);

    dayCount.set(42);

    const room: RoomDefinition = {
      enemies: [],
      maxRounds: 10,
    };
    activeRun.set({
      rooms: [room],
      currentRoomIndex: 0,
      partyIds: ['dirty'],
      partyGold: 0,
      inventory: { items: [], gold: 0 },
      outcome: null,
      activeRelics: [],
    });

    currentView.set('dungeon');
    recruitmentPool.set([]);
    startOpeningShop();

    resetGame();

    expect(get(roster).adventurers.map((a) => a.id)).toEqual(createStarterRoster().map((a) => a.id));
    expect(get(roster).recruitedIds).toEqual([]);
    expect(get(openingShop)).toBeNull();

    expect(get(townStorage).gold).toBe(0);
    expect(get(townStorage).items).toEqual(STARTER_TOWN_ITEMS);

    expect(get(dayCount)).toBe(0);
    expect(get(activeRun)).toBeNull();
    expect(get(dungeonPlayback)).toBeNull();
    expect(get(currentView)).toBe('town');
    // Non-empty on a fresh install: data/characters.ts now has more named characters than fit in
    // the starter roster, so some are recruitable from the start.
    expect(get(recruitmentPool).length).toBeGreaterThan(0);
  });

  it('is safe to call on an already-fresh game (no dirty state to clear)', () => {
    resetGame();
    expect(() => resetGame()).not.toThrow();
    expect(get(currentView)).toBe('town');
  });
});
