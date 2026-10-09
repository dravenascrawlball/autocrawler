import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { VengeanceAction } from './actions/support';
import { createBattleState } from './battle';
import { tickAuras } from './auras';
import { getEffectiveStat } from './stats';
import { resolveTurn } from './turnEngine';
import { BODYGUARD_TRAIT, BODYGUARD_SHARE, SHIELD_BEARER_TRAIT } from './traits';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 100,
    attackPower: 10,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

const noVariance = () => 0.5;

describe('adjacent auras', () => {
  it('Shield Bearer protects only orthogonally adjacent allies, never itself', () => {
    const glint = createAdventurer('glint', template({ traits: [SHIELD_BEARER_TRAIT] }), { lane: 1, rank: 0 });
    const beside = createAdventurer('beside', template(), { lane: 0, rank: 0 });
    const behind = createAdventurer('behind', template(), { lane: 1, rank: 1 });
    const diagonal = createAdventurer('diagonal', template(), { lane: 0, rank: 1 });
    const battle = createBattleState([glint, beside, behind, diagonal], []);

    for (const unit of [glint, beside, behind, diagonal]) tickAuras(unit, battle);

    expect(getEffectiveStat(0, 'vulnerability', beside.modifiers)).toBe(-15);
    expect(getEffectiveStat(0, 'vulnerability', behind.modifiers)).toBe(-15);
    expect(getEffectiveStat(0, 'vulnerability', diagonal.modifiers)).toBe(0);
    expect(getEffectiveStat(0, 'vulnerability', glint.modifiers)).toBe(0);
  });
});

describe('Bodyguard', () => {
  it('takes a share of a hit on an adjacent ally, and the turn records an intercept event', () => {
    const enemy = createAdventurer('enemy', template({ attackPower: 20 }), { lane: 1, rank: 0 });
    const healer = createAdventurer('healer', template(), { lane: 1, rank: 0 });
    const bodil = createAdventurer('bodil', template({ traits: [BODYGUARD_TRAIT] }), { lane: 0, rank: 0 });
    const battle = createBattleState([healer, bodil], [enemy]);

    const result = resolveTurn(enemy, battle, noVariance);
    const share = Math.round(20 * BODYGUARD_SHARE);

    expect(bodil.hp).toBe(100 - share);
    expect(healer.hp).toBe(100 - (20 - share));
    expect(result.events).toContainEqual({ type: 'intercept', attackerId: 'enemy', guardianId: 'bodil', protectedId: 'healer', damage: share });
    expect(battle.pendingIntercepts).toEqual([]);
  });

  it('does not step in for a non-adjacent ally', () => {
    const enemy = createAdventurer('enemy', template({ attackPower: 20 }), { lane: 1, rank: 0 });
    const healer = createAdventurer('healer', template(), { lane: 1, rank: 0 });
    const bodil = createAdventurer('bodil', template({ traits: [BODYGUARD_TRAIT] }), { lane: 2, rank: 2 });
    const battle = createBattleState([healer, bodil], [enemy]);

    resolveTurn(enemy, battle, noVariance);
    expect(bodil.hp).toBe(100);
  });
});

describe('on-adjacent-ally-downed (Avenger)', () => {
  it('fires only for allies standing next to the fallen unit', () => {
    const avenger = { id: 'avenger', name: 'Avenger', trigger: 'on-adjacent-ally-downed' as const, action: VengeanceAction };
    const killer = createAdventurer('killer', template({ attackPower: 500 }), { lane: 1, rank: 0 });
    const doomed = createAdventurer('doomed', template({ maxHp: 5 }), { lane: 1, rank: 0 });
    const adjacent = createAdventurer('adjacent', template(), { lane: 0, rank: 0 });
    const far = createAdventurer('far', template(), { lane: 2, rank: 2 });
    adjacent.activeSpecialActions = [avenger];
    far.activeSpecialActions = [{ ...avenger }];
    const battle = createBattleState([doomed, adjacent, far], [killer]);

    const result = resolveTurn(killer, battle, noVariance);
    const fired = result.events.filter((e) => e.type === 'special-action' && e.specialActionId === 'avenger');
    expect(fired).toEqual([expect.objectContaining({ actorId: 'adjacent' })]);
  });
});
