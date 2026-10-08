import { describe, it, expect } from 'vitest';
import { createAdventurer } from '../sim/adventurer';
import { THARAVEL_TEMPLATE, DRIFTA_TEMPLATE, GUDRUN_TEMPLATE } from '../data/characters';
import { KIT_SHOP_CATALOG } from '../data/kitShop';
import { clearUnlocksFor, newUnlocksForRun, kitsFor } from './progression';
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

describe('clear-unlocks', () => {
  it('lists a character\'s clear-unlock Specials by name and action', () => {
    expect(clearUnlocksFor('Tharavel')).toEqual([expect.objectContaining({ characterName: 'Tharavel', name: 'Rally Cry' })]);
    expect(clearUnlocksFor('Gudrun')).toEqual([]);
  });

  it('newUnlocksForRun returns only first-time clearers with an unlock, and only on a completed run', () => {
    const tharavel = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'front');
    const drifta = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front');
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    const party = [tharavel, drifta, gudrun];

    expect(newUnlocksForRun(party, 'completed', ['drifta']).map((u) => u.name)).toEqual(['Rally Cry']);
    expect(newUnlocksForRun(party, 'loss', [])).toEqual([]);
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
