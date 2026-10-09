import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { EmpowerAction } from './actions/support';
import { SelfHealAction } from './actions/heal';
import type { BattleState } from './battle';
import { resolveSpecialActionTriggers, type SpecialAction } from './specialActions';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

function battleOf(adventurers: ReturnType<typeof createAdventurer>[], enemies: ReturnType<typeof createAdventurer>[]): BattleState {
  return { adventurers, enemies, retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [] };
}

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('resolveSpecialActionTriggers', () => {
  it('resolves a matching Special Action and returns its outcome', () => {
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const onHitTaken: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };

    const results = resolveSpecialActionTriggers(actor, [onHitTaken], { trigger: 'on-hit-taken' }, battle, sequence(0.5, 0.5));

    expect(results).toEqual([
      { specialActionId: 'retaliate', outcome: { type: 'attack', damage: 5, hit: true, targetId: 'enemy' } },
    ]);
  });

  it('does not resolve a Special Action whose trigger does not match the event', () => {
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const onTurnStart: SpecialAction = { id: 'early-strike', name: 'Early Strike', trigger: 'on-turn-start', action: AttackNearestAction };

    const results = resolveSpecialActionTriggers(actor, [onTurnStart], { trigger: 'on-hit-taken' }, battle, sequence(0.5, 0.5));

    expect(results).toEqual([]);
  });

  it('fires every matching Special Action off a single event, not just the first', () => {
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    const ally = createAdventurer('ally', template({ maxHp: 100 }), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor, ally], [enemy]);

    const retaliate: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };
    const empowerSelf: SpecialAction = { id: 'adrenaline', name: 'Adrenaline', trigger: 'on-hit-taken', action: EmpowerAction };

    const results = resolveSpecialActionTriggers(
      actor,
      [retaliate, empowerSelf],
      { trigger: 'on-hit-taken' },
      battle,
      sequence(0.5, 0.5),
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.specialActionId)).toEqual(['retaliate', 'adrenaline']);
    expect(results[0].outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' });
    expect(results[1].outcome?.type).toBe('support-buff');
  });

  it('never consumes a turn — resolving a trigger has no effect on turn order or who acts next', () => {
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const onHitTaken: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };

    resolveSpecialActionTriggers(actor, [onHitTaken], { trigger: 'on-hit-taken' }, battle, sequence(0.5, 0.5));

    // Nothing about the engine's own state (battle, retreat flag, roster order) is touched
    // merely by resolving a trigger — only the action's own effect (here, enemy taking damage).
    expect(battle.retreatRequested).toBe(false);
    expect(battle.adventurers).toEqual([actor]);
  });

  it('reports a null outcome (not a throw) when the Special Action finds no valid target', () => {
    const actor = createAdventurer('actor', template(), 'front');
    actor.hp = actor.maxHp; // full HP: SelfHealAction finds nobody to heal
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const onTurnStart: SpecialAction = { id: 'mend', name: 'Mend', trigger: 'on-turn-start', action: SelfHealAction };

    const results = resolveSpecialActionTriggers(actor, [onTurnStart], { trigger: 'on-turn-start' }, battle, sequence(0.5));

    expect(results).toEqual([{ specialActionId: 'mend', outcome: null }]);
  });
});
