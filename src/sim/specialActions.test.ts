import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { EmpowerAction } from './actions/support';
import { SelfHealAction } from './actions/heal';
import type { BattleState } from './battle';
import { resolveSpecialActionTriggers, type SpecialAction } from './specialActions';
import { CHARGE_MAX, REACTIVE_COOLDOWN_TURNS, tickReactiveCooldowns } from './charge';

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
  return { adventurers, enemies, retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
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
    battle.chargeByUnitId.actor = CHARGE_MAX;

    const onTurnStart: SpecialAction = { id: 'mend', name: 'Mend', trigger: 'on-turn-start', action: SelfHealAction };

    const results = resolveSpecialActionTriggers(actor, [onTurnStart], { trigger: 'on-turn-start' }, battle, sequence(0.5));

    expect(results).toEqual([{ specialActionId: 'mend', outcome: null }]);
    expect(battle.chargeByUnitId.actor).toBe(CHARGE_MAX); // no target: the charge is kept, not wasted
  });

  it('holds an on-turn-start Special until the charge meter is full, then fires it and empties the meter', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);
    const strike: SpecialAction = { id: 'strike', name: 'Strike', trigger: 'on-turn-start', action: AttackNearestAction };

    battle.chargeByUnitId.actor = CHARGE_MAX - 1;
    expect(resolveSpecialActionTriggers(actor, [strike], { trigger: 'on-turn-start' }, battle, sequence(0.5))).toEqual([]);

    battle.chargeByUnitId.actor = CHARGE_MAX;
    const results = resolveSpecialActionTriggers(actor, [strike], { trigger: 'on-turn-start' }, battle, sequence(0.5));
    expect(results).toHaveLength(1);
    // the hit itself refills a little (CHARGE_PER_HIT) after the reset
    expect(battle.chargeByUnitId.actor).toBeLessThan(CHARGE_MAX);
  });

  it('hits harder when fired from a full meter than the same Action as a Basic Action', () => {
    const fire = (charged: boolean) => {
      const actor = createAdventurer('actor', template(), 'front');
      const enemy = createAdventurer('enemy', template({ maxHp: 1000 }), 'front');
      const battle = battleOf([actor], [enemy]);
      if (!charged) return AttackNearestAction.resolve({ actor, target: enemy, rng: sequence(0.5), battle });
      battle.chargeByUnitId.actor = CHARGE_MAX;
      const strike: SpecialAction = { id: 'strike', name: 'Strike', trigger: 'on-turn-start', action: AttackNearestAction };
      return resolveSpecialActionTriggers(actor, [strike], { trigger: 'on-turn-start' }, battle, sequence(0.5))[0].outcome;
    };
    const plain = fire(false) as { damage: number };
    const charged = fire(true) as { damage: number };
    expect(charged.damage).toBeGreaterThan(plain.damage * 1.5);
  });

  it('puts a reactive Special on a short cooldown after it fires', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 1000 }), 'front');
    const battle = battleOf([actor], [enemy]);
    const retaliate: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };

    expect(resolveSpecialActionTriggers(actor, [retaliate], { trigger: 'on-hit-taken' }, battle, sequence(0.5))).toHaveLength(1);
    expect(resolveSpecialActionTriggers(actor, [retaliate], { trigger: 'on-hit-taken' }, battle, sequence(0.5))).toEqual([]);
    for (let turn = 0; turn < REACTIVE_COOLDOWN_TURNS; turn += 1) tickReactiveCooldowns(battle, actor.id);
    expect(resolveSpecialActionTriggers(actor, [retaliate], { trigger: 'on-hit-taken' }, battle, sequence(0.5))).toHaveLength(1);
  });

  it('fires an alwaysOn Special every time, ignoring the meter and cooldowns', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 1000 }), 'front');
    const battle = battleOf([actor], [enemy]);
    const aura: SpecialAction = { id: 'aura', name: 'Aura', trigger: 'on-turn-start', action: AttackNearestAction, alwaysOn: true };

    expect(resolveSpecialActionTriggers(actor, [aura], { trigger: 'on-turn-start' }, battle, sequence(0.5))).toHaveLength(1);
    expect(resolveSpecialActionTriggers(actor, [aura], { trigger: 'on-turn-start' }, battle, sequence(0.5))).toHaveLength(1);
  });
});
