import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { plainFaces } from '../sim/dieFace';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { startDungeonRun } from '../sim/dungeonRun';
import { grantTrait } from '../sim/milestones';
import { VAMPIRIC_TRAIT } from '../sim/traits';
import { buildRunSummary, recordRunSummary, runLog, RUN_LOG_LIMIT, type RunSummary } from './runSummary';
import { createRunTotals, dungeonPlayback, type DungeonPlaybackState } from './dungeonPlayback';
import { roster } from './roster';
import { startDungeon, finishDungeonRun } from './dungeonOrchestrator';
import type { ItemLookup, Item } from '../sim/items';

function template(name: string, overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return { name, maxHp: 20, attackPower: 5, speed: 5, actions: ['attack-nearest'], dieFaces: plainFaces(AttackNearestAction), ...overrides };
}
const lookupItem: ItemLookup = () => undefined as unknown as Item;

function playbackFor(roomCount: number, roomIndex: number, outcome: DungeonPlaybackState['outcome']): DungeonPlaybackState {
  const a = createAdventurer('a', template('Ada'), 'front');
  const b = createAdventurer('b', template('Bea'), 'back');
  a.runDamageDealt = 90;
  a.runKills = 3;
  b.runHealingDone = 40;
  b.runDamageTaken = 25;
  grantTrait(a, VAMPIRIC_TRAIT);
  const rooms = Array.from({ length: roomCount }, (_, i) => ({
    enemies: [createAdventurer(`boss-${i}`, template(i === 4 ? 'Troll Warlord' : 'Grunt', { maxHp: i === 4 ? 200 : 10 }), 'front')],
  }));
  const runState = startDungeonRun([a, b], rooms);
  runState.roomIndex = roomIndex;
  return {
    runState,
    inventory: { items: [], gold: 0 },
    outcome,
    shopOffers: { recruits: [], relics: [], equipment: [] },
    unplacedIds: [],
    milestoneOffers: [],
    runTotals: { ...createRunTotals(), goldEarned: 120, goldSpent: 80, relicsBought: ['War Trophy'] },
  };
}

describe('buildRunSummary', () => {
  it('captures outcome, path, bosses, the fatal room, MVPs and earned Traits', () => {
    const summary = buildRunSummary(playbackFor(15, 7, 'loss'), 1000);
    expect(summary.outcome).toBe('loss');
    expect(summary.roomsWon).toBe(6);
    expect(summary.floorReached).toBe(2);
    expect(summary.bossesBeaten).toEqual(['Troll Warlord']);
    expect(summary.endedBy).toEqual(['Grunt']);
    expect(summary.mvps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ award: 'Top Damage', heroName: 'Ada', value: 90 }),
        expect.objectContaining({ award: 'Top Healer', heroName: 'Bea', value: 40 }),
        expect.objectContaining({ award: 'Slayer', heroName: 'Ada', value: 3 }),
      ]),
    );
    expect(summary.heroes[0].traitsEarned).toEqual([{ name: 'Vampiric', kind: 'milestone' }]);
    expect(summary.goldEarned).toBe(120);
    expect(summary.relics).toEqual(['War Trophy']);
  });

  it('treats a run with no outcome as a retreat with every resolved room won', () => {
    const summary = buildRunSummary(playbackFor(15, 3, null));
    expect(summary.outcome).toBe('retreat');
    expect(summary.roomsWon).toBe(3);
    expect(summary.endedBy).toEqual([]);
  });
});

describe('run log', () => {
  beforeEach(() => {
    runLog.set([]);
    dungeonPlayback.set(null);
  });

  it(`keeps only the newest ${RUN_LOG_LIMIT}`, () => {
    let log: RunSummary[] = [];
    for (let i = 0; i < RUN_LOG_LIMIT + 3; i++) log = recordRunSummary(log, { id: `r${i}` } as RunSummary);
    expect(log).toHaveLength(RUN_LOG_LIMIT);
    expect(log[0].id).toBe(`r${RUN_LOG_LIMIT + 2}`);
  });

  it('finishing a run records its summary before the party resets', () => {
    const hero = createAdventurer('hero', template('Gudrun', { maxHp: 500, attackPower: 100 }), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });
    startDungeon([hero], [{ enemies: [createAdventurer('e', template('Grunt', { maxHp: 3 }), 'front')] }], () => 0, lookupItem);
    finishDungeonRun();

    const [summary] = get(runLog);
    expect(summary.outcome).toBe('completed');
    expect(summary.heroes[0].kills).toBe(1);
    expect(summary.heroes[0].damageDealt).toBeGreaterThan(0);
  });
});
