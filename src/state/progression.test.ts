import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { roster } from './roster';
import { metaProgression } from './metaProgression';
import { buyTrainingRank, buyKitFromShop } from './townActions';
import { createAdventurer, rerollPoolPicks, effectiveMaxHp } from '../sim/adventurer';
import { THARAVEL_TEMPLATE, GUDRUN_TEMPLATE, BODIL_TEMPLATE, FALLACY_TEMPLATE, MIRA_TEMPLATE, CHARACTER_TEMPLATES } from '../data/characters';
import { CHARACTER_UNLOCK_POOL } from '../data/characterUnlocks';
import { KIT_SHOP_CATALOG } from '../data/kitShop';
import { clearUnlocksFor, newUnlocksForRun, kitsFor, isUnlockEarned, conditionLabel, wearKit, halloweenUnlocksForRun } from './progression';
import { recordRun, createEmptyRunHistory } from './runHistory';

describe('recordRun', () => {
  it('counts runs, clears and best rooms won per character, and adds clearers to clearedWithIds', () => {
    let history = createEmptyRunHistory();
    history = recordRun(history, ['a', 'b'], 3, false);
    history = recordRun(history, ['a'], 5, true);
    history = recordRun(history, ['a'], 2, false);

    expect(history.characterStats).toEqual({
      a: { runs: 3, clears: 1, bestRoomsWon: 5 },
      b: { runs: 1, clears: 0, bestRoomsWon: 3 },
    });
    expect(history.clearedWithIds).toEqual(['a']);
  });
});

describe('unlock conditions', () => {
  const history = (stats: Record<string, { runs: number; clears: number; bestRoomsWon: number }>, cleared: string[] = []) => ({
    clearedWithIds: cleared,
    characterStats: stats,
  });

  it('checks clear-run, reach-room and runs conditions against run history', () => {
    const h = history({ a: { runs: 2, clears: 0, bestRoomsWon: 3 } }, []);
    expect(isUnlockEarned({ kind: 'clear-run' }, 'a', h)).toBe(false);
    expect(isUnlockEarned({ kind: 'reach-room', roomsWon: 3 }, 'a', h)).toBe(true);
    expect(isUnlockEarned({ kind: 'runs', count: 3 }, 'a', h)).toBe(false);
    expect(isUnlockEarned({ kind: 'runs', count: 3 }, 'a', history({ a: { runs: 3, clears: 0, bestRoomsWon: 0 } }))).toBe(true);
    expect(isUnlockEarned({ kind: 'clear-run' }, 'a', history({}, ['a']))).toBe(true);
  });

  it('describes each condition as a player-facing goal', () => {
    expect(conditionLabel({ kind: 'clear-run' }, 'Mira')).toBe('Clear a run with Mira');
    expect(conditionLabel({ kind: 'reach-room', roomsWon: 3 }, 'Bodil')).toBe('Reach room 4 with Bodil');
    expect(conditionLabel({ kind: 'runs', count: 3 }, 'Fallacy')).toBe('Take Fallacy on 3 runs');
  });

  it('gives every character except Dee exactly one unlock', () => {
    for (const template of CHARACTER_TEMPLATES) {
      expect(clearUnlocksFor(template.name, 'x', createEmptyRunHistory())).toHaveLength(template.name === 'Dee' ? 0 : 1);
    }
  });

  it('newUnlocksForRun reports only unlocks that flip from locked to earned', () => {
    const tharavel = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'front');
    const fallacy = createAdventurer('fallacy', FALLACY_TEMPLATE, 'front');
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    const party = [tharavel, fallacy, gudrun];
    // Fallacy's goal is 3 runs; she already has 2. Gudrun's is also 3 runs; she has 0.
    const before = history({ fallacy: { runs: 2, clears: 0, bestRoomsWon: 1 } });
    const after = recordRun(before, party.map((m) => m.id), 2, false);

    expect(newUnlocksForRun(party, before, after).map((u) => u.name)).toEqual(['Battle Orders']);
  });
});

describe('rerollPoolPicks', () => {
  it('re-draws the pool Special without touching innate Specials', () => {
    const mira = createAdventurer('mira', MIRA_TEMPLATE, 'back', [], [], [], () => 0);
    expect(mira.activeSpecialActions.map((s) => s.id)).toEqual(['mira-splash-heal', 'mira-potion-toss-ally']);

    rerollPoolPicks(mira, MIRA_TEMPLATE, [], [], () => 0.99);
    expect(mira.activeSpecialActions.map((s) => s.id)).toEqual(['mira-splash-heal', 'mira-revive']);
  });

  it('can draw an earned unlock into the pool', () => {
    const fallacy = createAdventurer('fallacy', FALLACY_TEMPLATE, 'back', [], [], [], () => 0);
    rerollPoolPicks(fallacy, FALLACY_TEMPLATE, CHARACTER_UNLOCK_POOL.Fallacy.map((u) => u.entry), [], () => 0.99);
    expect(fallacy.activeSpecialActions.map((s) => s.id)).toEqual(['fallacy-battle-orders']);
  });
});

describe('kitsFor', () => {
  it('lists the Shop\'s Kits for a character with ownership', () => {
    const entry = KIT_SHOP_CATALOG[0];
    const kits = kitsFor(entry.characterName, { [entry.characterName]: [entry.kit.id] });
    expect(kits).toContainEqual(expect.objectContaining({ kitId: entry.kit.id, owned: true, price: entry.price }));
    expect(kitsFor(entry.characterName, {}).every((kit) => !kit.owned)).toBe(true);
  });
});

describe('buyTrainingRank', () => {
  it('spends Renown, raises the rank, and applies it to the roster character at full HP', () => {
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    roster.set({ adventurers: [gudrun], recruitedIds: [] });
    metaProgression.set({ renown: 55, unlockedKitIds: {}, trainingRanks: {} });

    expect(buyTrainingRank('Gudrun')).toBe(true);
    expect(buyTrainingRank('Gudrun')).toBe(true); // 20 + 30
    expect(buyTrainingRank('Gudrun')).toBe(false); // 40 more, only 5 left

    expect(get(metaProgression)).toMatchObject({ renown: 5, trainingRanks: { Gudrun: 2 } });
    expect(gudrun.modifiers.filter((m) => m.source === 'training')).toHaveLength(3);
    expect(gudrun.hp).toBe(effectiveMaxHp(gudrun));
  });
});

describe('wearKit (free outfit swap)', () => {
  it('swaps into an owned Kit and back to the base outfit, restoring role and stats', () => {
    const tharavel = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'back');
    metaProgression.set({ renown: 0, unlockedKitIds: { Tharavel: ['tharavel-field-medic'] }, trainingRanks: {} });

    expect(wearKit(tharavel, 'tharavel-field-medic')).toBe(true);
    expect(tharavel.role).toBe('Healer');
    expect(tharavel.activeKit?.id).toBe('tharavel-field-medic');

    expect(wearKit(tharavel, null)).toBe(true);
    expect(tharavel.role).toBe(THARAVEL_TEMPLATE.role);
    expect(tharavel.activeKit).toBeUndefined();
    expect(tharavel.modifiers.some((m) => m.source.startsWith('kit:'))).toBe(false);
  });

  it('refuses a Kit the character does not own', () => {
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    metaProgression.set({ renown: 0, unlockedKitIds: {}, trainingRanks: {} });
    expect(wearKit(gudrun, 'gudrun-berserker')).toBe(false);
    expect(gudrun.activeKit).toBeUndefined();
  });

  it('caps HP at the new max rather than healing (a -HP Kit cannot kill, a +HP Kit does not heal)', () => {
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    metaProgression.set({ renown: 0, unlockedKitIds: { Gudrun: ['gudrun-berserker'] }, trainingRanks: {} });
    const fullHp = gudrun.hp;

    wearKit(gudrun, 'gudrun-berserker'); // -15% max HP
    expect(gudrun.hp).toBe(effectiveMaxHp(gudrun));
    expect(gudrun.hp).toBeLessThan(fullHp);

    wearKit(gudrun, null);
    expect(gudrun.hp).toBeLessThan(effectiveMaxHp(gudrun)); // not healed back up
  });
});

describe('Halloween event Kits', () => {
  it("reaching Floor 2 unlocks each party member's Halloween Kit once", () => {
    const bodil = createAdventurer('bodil', BODIL_TEMPLATE, 'front');
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    expect(halloweenUnlocksForRun([bodil, gudrun], 4, {})).toEqual([]);
    expect(halloweenUnlocksForRun([bodil, gudrun], 5, {}).map((u) => u.kitName)).toEqual(['Pumpkin Bunny', 'Blood Countess']);
    expect(halloweenUnlocksForRun([bodil], 7, { Bodil: ['bodil-halloween'] })).toEqual([]);
  });

  it("can't be bought while the event is running, and the Progress listing says how to earn it", () => {
    metaProgression.set({ renown: 999, unlockedKitIds: {}, trainingRanks: {} });
    expect(buyKitFromShop('Bodil', 'bodil-halloween')).toBe(false);
    const halloween = kitsFor('Bodil', {}).find((k) => k.kitId === 'bodil-halloween')!;
    expect(halloween.howToEarn).toBe('Reach Floor 2 with Bodil');
  });
});
