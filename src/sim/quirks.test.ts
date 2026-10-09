import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, resetToTemplateBaseline, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { selectFirstEnemy, selectLowestHpEnemy } from './actions/targeting';
import { createBattleState } from './battle';
import { getEffectiveStat } from './stats';
import { createSeededRng } from './rng';
import { rollQuirks, applyQuirks, stripQuirks, quirksOf, quirkPriceMultiplier, QUIRK_PRICE_STEP } from './quirks';
import { HERO_QUIRK_POOL, MONSTER_QUIRK_POOL } from '../data/quirks';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return { name: 'Unit', maxHp: 20, attackPower: 10, speed: 5, actions: ['attack-nearest'], dieFaces: plainFaces(AttackNearestAction), ...overrides };
}
const quirk = (id: string) => [...HERO_QUIRK_POOL, ...MONSTER_QUIRK_POOL].find((q) => q.id === id)!;

describe('rollQuirks', () => {
  it('rolls roughly 20% one Quirk and ~4% two, never duplicates', () => {
    const rng = createSeededRng(7);
    const counts = [0, 0, 0];
    for (let i = 0; i < 20000; i++) {
      const rolled = rollQuirks(HERO_QUIRK_POOL, rng);
      counts[rolled.length] += 1;
      if (rolled.length === 2) expect(rolled[0].id).not.toBe(rolled[1].id);
    }
    expect((counts[1] + counts[2]) / 20000).toBeCloseTo(0.2, 1);
    expect(counts[2] / 20000).toBeCloseTo(0.04, 1);
  });

  it('a deterministic rng returning 0 rolls nothing', () => {
    expect(rollQuirks(HERO_QUIRK_POOL, () => 0)).toEqual([]);
  });
});

describe('applying Quirks', () => {
  it('adds stat changes and resets HP to the new max, and replaces rather than stacks', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyQuirks(unit, [quirk('tough')]);
    expect(getEffectiveStat(unit.maxHp, 'maxHp', unit.modifiers)).toBe(23);
    expect(unit.hp).toBe(23);

    applyQuirks(unit, [quirk('frail')]);
    expect(quirksOf(unit).map((q) => q.id)).toEqual(['frail']);
    expect(getEffectiveStat(unit.maxHp, 'maxHp', unit.modifiers)).toBe(17);

    stripQuirks(unit);
    expect(quirksOf(unit)).toEqual([]);
    expect(unit.modifiers.some((m) => m.source.startsWith('quirk:'))).toBe(false);
  });

  it('prices good Quirks up and bad ones down', () => {
    const unit = createAdventurer('unit', template(), 'front');
    applyQuirks(unit, [quirk('strong'), quirk('lucky')]);
    expect(quirkPriceMultiplier(unit)).toBeCloseTo(1 + 2 * QUIRK_PRICE_STEP);
    applyQuirks(unit, [quirk('strong'), quirk('weak')]);
    expect(quirkPriceMultiplier(unit)).toBe(1);
  });

  it('is wiped when the character resets after a run', () => {
    const tpl = template();
    const unit = createAdventurer('unit', tpl, 'front');
    applyQuirks(unit, [quirk('strong')]);
    resetToTemplateBaseline(unit, tpl);
    expect(quirksOf(unit)).toEqual([]);
  });
});

describe('prey Quirks', () => {
  it('Goblin Hater reaches a goblin anywhere, past the front line, and goes for it first', () => {
    const hater = createAdventurer('hater', template(), { lane: 0, rank: 0 });
    applyQuirks(hater, [quirk('goblin-hater')]);
    const front = createAdventurer('front', template(), { lane: 0, rank: 0 });
    const goblin = createAdventurer('goblin', template({ tags: ['goblin'] }), { lane: 2, rank: 2 });
    const battle = createBattleState([hater], [front, goblin]);

    expect(selectFirstEnemy({ actor: hater, battle }, true)).toBe(goblin);
    expect(selectLowestHpEnemy({ actor: hater, battle }, true)).toBe(goblin);
  });

  it('Healer Hunter (monster) goes for a back-row Healer', () => {
    const hunter = createAdventurer('hunter', template(), { lane: 1, rank: 0 });
    applyQuirks(hunter, [quirk('healer-hunter')]);
    const tank = createAdventurer('tank', template({ role: 'Fighter' }), { lane: 1, rank: 0 });
    const healer = createAdventurer('healer', template({ role: 'Healer' }), { lane: 1, rank: 2 });
    const battle = createBattleState([tank, healer], [hunter]);

    expect(selectFirstEnemy({ actor: hunter, battle }, true)).toBe(healer);
  });

  it('falls back to normal targeting when no prey is alive', () => {
    const hater = createAdventurer('hater', template(), { lane: 0, rank: 0 });
    applyQuirks(hater, [quirk('goblin-hater')]);
    const front = createAdventurer('front', template(), { lane: 0, rank: 0 });
    const battle = createBattleState([hater], [front]);
    expect(selectFirstEnemy({ actor: hater, battle }, true)).toBe(front);
  });
});
