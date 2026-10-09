import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { createBattleState } from './battle';
import { resolveTurn } from './turnEngine';
import { createSeededRng } from './rng';
import { getEffectiveStat } from './stats';
import { rollMilestoneOffers, isMilestonePause, grantTrait } from './milestones';
import {
  VAMPIRIC_TRAIT,
  SECOND_WIND_TRAIT,
  GIANT_SLAYER_TRAIT,
  EXECUTIONER_TRAIT,
  JUGGERNAUT_TRAIT,
  SECOND_WIND_HP_FRACTION,
} from './traits';
import { MILESTONE_REWARD_POOL } from '../data/milestones';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return { name: 'Unit', maxHp: 100, attackPower: 20, speed: 5, actions: ['attack-nearest'], dieFaces: plainFaces(AttackNearestAction), ...overrides };
}
const noVariance = () => 0.5;

describe('milestone pauses and offers', () => {
  it('fires after the floor 1 and 2 bosses, not the finale', () => {
    expect([1, 4, 5, 9, 10, 15].map((n) => isMilestonePause(n, 15))).toEqual([false, false, true, false, true, false]);
  });

  it('rolls 3 cards on different heroes, never a Trait the hero already has', () => {
    const party = ['a', 'b', 'c', 'd'].map((id) => createAdventurer(id, template(), 'front'));
    grantTrait(party[0], VAMPIRIC_TRAIT);
    for (let seed = 0; seed < 50; seed++) {
      const offers = rollMilestoneOffers(party, MILESTONE_REWARD_POOL, createSeededRng(seed));
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.adventurerId)).size).toBe(3);
      expect(offers.some((o) => o.adventurerId === 'a' && o.trait.id === 'vampiric')).toBe(false);
    }
  });

  it('grantTrait adds the Trait and its stat changes once', () => {
    const unit = createAdventurer('u', template(), 'front');
    grantTrait(unit, JUGGERNAUT_TRAIT);
    grantTrait(unit, JUGGERNAUT_TRAIT);
    expect(unit.traits.filter((t) => t.id === 'juggernaut')).toHaveLength(1);
    expect(getEffectiveStat(0, 'armor', unit.modifiers)).toBe(2);
  });
});

describe('Milestone Trait combat effects', () => {
  it('Vampiric heals the attacker and records a trait-effect event', () => {
    const vamp = createAdventurer('vamp', template({ traits: [VAMPIRIC_TRAIT] }), 'front');
    vamp.hp = 50;
    const foe = createAdventurer('foe', template({ maxHp: 1000 }), 'front');
    const battle = createBattleState([vamp], [foe]);
    const result = resolveTurn(vamp, battle, noVariance);
    expect(vamp.hp).toBe(55);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'trait-effect', kind: 'heal', unitId: 'vamp', amount: 5 }));
  });

  it('Second Wind saves its holder from a lethal hit once per fight', () => {
    const killer = createAdventurer('killer', template({ attackPower: 500 }), 'front');
    const survivor = createAdventurer('survivor', template({ traits: [SECOND_WIND_TRAIT] }), 'front');
    const battle = createBattleState([survivor], [killer]);

    resolveTurn(killer, battle, noVariance);
    expect(survivor.hp).toBe(100 * SECOND_WIND_HP_FRACTION);
    resolveTurn(killer, battle, noVariance);
    expect(survivor.hp).toBe(0);
  });

  it('Giant Slayer and Executioner add damage against big or nearly-dead targets', () => {
    const hitFor = (traits: typeof VAMPIRIC_TRAIT[], foeMaxHp: number, foeHp: number) => {
      const attacker = createAdventurer('a', template({ traits }), 'front');
      const foe = createAdventurer('f', template({ maxHp: foeMaxHp }), 'front');
      foe.hp = foeHp;
      const battle = createBattleState([attacker], [foe]);
      const outcome = AttackNearestAction.resolve({ actor: attacker, target: foe, battle, rng: noVariance });
      return outcome.type === 'attack' ? outcome.damage : NaN;
    };
    expect(hitFor([], 400, 400)).toBe(20);
    expect(hitFor([GIANT_SLAYER_TRAIT], 400, 400)).toBe(26);
    expect(hitFor([GIANT_SLAYER_TRAIT], 100, 100)).toBe(20);
    expect(hitFor([EXECUTIONER_TRAIT], 1000, 200)).toBe(28);
  });
});
