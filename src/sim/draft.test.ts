import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { generateDraftRound, DRAFT_OFFERS_PER_ROUND } from './draft';

function template(name: string): AdventurerTemplate {
  return {
    name,
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
  };
}

describe('generateDraftRound', () => {
  it('samples `size` adventurers with no repeats', () => {
    const adventurers = Array.from({ length: 6 }, (_, i) => createAdventurer(`a${i}`, template(`A${i}`), 'front'));

    const offers = generateDraftRound(adventurers, new Set(), () => 0.5, 3);

    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((a) => a.id)).size).toBe(3);
  });

  it('excludes already-picked adventurers', () => {
    const adventurers = Array.from({ length: 4 }, (_, i) => createAdventurer(`a${i}`, template(`A${i}`), 'front'));

    const offers = generateDraftRound(adventurers, new Set(['a0', 'a1']), () => 0.5, 2);

    expect(offers.map((a) => a.id).sort()).toEqual(['a2', 'a3']);
  });

  it('shrinks gracefully when fewer than `size` remain eligible', () => {
    const adventurers = Array.from({ length: 2 }, (_, i) => createAdventurer(`a${i}`, template(`A${i}`), 'front'));

    const offers = generateDraftRound(adventurers, new Set(), () => 0.5, DRAFT_OFFERS_PER_ROUND);

    expect(offers).toHaveLength(2);
  });

  it('returns an empty array when nobody is eligible', () => {
    const adventurers = [createAdventurer('a0', template('A0'), 'front')];

    const offers = generateDraftRound(adventurers, new Set(['a0']), () => 0.5);

    expect(offers).toEqual([]);
  });

  it('defaults size to DRAFT_OFFERS_PER_ROUND', () => {
    const adventurers = Array.from({ length: DRAFT_OFFERS_PER_ROUND + 2 }, (_, i) =>
      createAdventurer(`a${i}`, template(`A${i}`), 'front'),
    );

    const offers = generateDraftRound(adventurers, new Set(), () => 0.5);

    expect(offers).toHaveLength(DRAFT_OFFERS_PER_ROUND);
  });
});
