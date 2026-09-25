import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, PowerAttackAction, CardThrowAction } from './actions/attack';
import { SelfHealAction } from './actions/heal';
import { RetreatAction } from './actions/retreat';
import { resolveTurn } from './turnEngine';
import type { BattleState } from './battle';

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

/** rng() returns each value in order, repeating the last once exhausted (same convention as actions/attack.test.ts). */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** The first rng() call picks the die face via `Math.floor(rng() * 6)` — 0.9 lands on face 5. */
const FACE_5_ROLL = 0.9;
const FACE_0_ROLL = 0;

describe('resolveTurn', () => {
  it('executes whichever action the roll lands on when its target is in range', () => {
    const dieFaces = plainFaces(AttackNearestAction);
    dieFaces[5] = { action: PowerAttackAction };
    const actor = createAdventurer('actor', template({ dieFaces }), 'front');
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [target], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    // face roll -> 5 (Power Attack); then a guaranteed-hit roll and a zero-variance roll.
    const turn = resolveTurn(actor, battle, sequence(FACE_5_ROLL, 0.5, 0.5));

    expect(turn.rolledFaceIndex).toBe(5);
    expect(turn.rolledActionId).toBe('power-attack');
    expect(turn.events).toEqual([
      {
        type: 'action',
        actionId: 'power-attack',
        outcome: { type: 'attack', damage: 10, hit: true, targetId: 'target' }, // 5 attackPower * 2
      },
    ]);
  });

  it('is an idle turn (no events) when the rolled action has no valid target at all', () => {
    const actor = createAdventurer('actor', template({ dieFaces: plainFaces(SelfHealAction) }), 'front');
    actor.hp = actor.maxHp; // full HP: SelfHealAction's selectTarget finds nobody to heal (not even itself)
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [enemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    const turn = resolveTurn(actor, battle, sequence(FACE_0_ROLL));

    expect(turn.rolledActionId).toBe('self-heal');
    expect(turn.events).toEqual([]);
  });

  it('ends the room via triggerRetreat when the rolled Retreat face is valid', () => {
    const actor = createAdventurer('actor', template({ dieFaces: plainFaces(RetreatAction) }), 'front');
    actor.hp = 1; // party average HP ratio far below the retreat threshold
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [enemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    const turn = resolveTurn(actor, battle, sequence(FACE_0_ROLL));

    expect(turn.events).toEqual([{ type: 'action', actionId: 'retreat', outcome: { type: 'retreat' } }]);
    expect(battle.retreatRequested).toBe(true);
  });

  it('applies the rolled face\'s enchantment to the target on a landed hit, and ticks it on the target\'s own next turn', () => {
    const actor = createAdventurer(
      'actor',
      template({ dieFaces: [{ action: AttackNearestAction, enchantmentId: 'burning' }, ...plainFaces(AttackNearestAction, 5)] }),
      'front',
    );
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [target], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    // face roll -> 0 (the enchanted face); guaranteed-hit roll, zero-variance roll.
    resolveTurn(actor, battle, sequence(FACE_0_ROLL, 0.5, 0.5));

    expect(target.statusEffects).toEqual([{ id: 'burn', damagePerTick: 2, remainingTicks: 3 }]);

    // The burn ticks at the start of the target's own next turn, before it rolls/acts.
    const targetTurn = resolveTurn(target, battle, sequence(FACE_0_ROLL));
    expect(targetTurn.events[0]).toEqual({ type: 'status-tick', effectId: 'burn', damage: 2 });
    expect(target.statusEffects).toEqual([{ id: 'burn', damagePerTick: 2, remainingTicks: 2 }]);
  });

  it('does not apply the enchantment on a miss', () => {
    const actor = createAdventurer(
      'actor',
      template({ dieFaces: [{ action: AttackNearestAction, enchantmentId: 'burning' }, ...plainFaces(AttackNearestAction, 5)] }),
      'front',
    );
    // Evasion this high clamps hit chance to the floor regardless of accuracy — see actions/attack.ts.
    const target = createAdventurer('target', template({ maxHp: 100, evasion: 200 }), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [target], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    // 0.5 >= the hit-chance floor -> miss.
    resolveTurn(actor, battle, sequence(FACE_0_ROLL, 0.5));

    expect(target.statusEffects).toEqual([]);
  });

  it('applies an enchantment to the actual hit target, not selectTarget\'s pre-resolve pick (Isilwen\'s Card Throw re-targets randomly inside resolve — roadmap item 11)', () => {
    const actor = createAdventurer(
      'actor',
      template({ dieFaces: [{ action: CardThrowAction, enchantmentId: 'burning' }, ...plainFaces(CardThrowAction, 5)] }),
      'front',
    );
    const enemyA = createAdventurer('enemy-a', template({ maxHp: 100 }), 'front');
    const enemyB = createAdventurer('enemy-b', template({ maxHp: 100 }), 'front');
    const battle: BattleState = { adventurers: [actor], enemies: [enemyA, enemyB], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {} };

    // face roll -> 0 (enchanted); random-target roll -> index 1 (enemy-b, not selectTarget's enemy-a);
    // guaranteed-hit roll; neutral-variance roll.
    const turn = resolveTurn(actor, battle, sequence(FACE_0_ROLL, 0.9, 0.5, 0.5));

    expect(turn.events).toEqual([
      { type: 'action', actionId: 'card-throw', outcome: { type: 'attack', damage: 5, hit: true, targetId: 'enemy-b' } },
    ]);
    expect(enemyB.statusEffects).toEqual([{ id: 'burn', damagePerTick: 2, remainingTicks: 3 }]);
    expect(enemyA.statusEffects).toEqual([]); // selectTarget's stale pick — never actually hit, never burned
  });
});
