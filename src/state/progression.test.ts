import { describe, it, expect } from 'vitest';
import { createAdventurer, rerollPoolPicks } from '../sim/adventurer';
import { THARAVEL_TEMPLATE, GUDRUN_TEMPLATE, FALLACY_TEMPLATE, MIRA_TEMPLATE, CHARACTER_TEMPLATES } from '../data/characters';
import { CHARACTER_UNLOCK_POOL } from '../data/characterUnlocks';
import { KIT_SHOP_CATALOG } from '../data/kitShop';
import { clearUnlocksFor, newUnlocksForRun, kitsFor, isUnlockEarned, conditionLabel } from './progression';
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
