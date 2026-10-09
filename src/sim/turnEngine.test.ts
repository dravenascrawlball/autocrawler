import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, PowerAttackAction } from './actions/attack';
import { SelfHealAction } from './actions/heal';
import { RetreatAction } from './actions/retreat';
import { EmpowerAction } from './actions/support';
import { applyShield } from './shields';
import { resolveTurn } from './turnEngine';
import type { BattleState } from './battle';
import type { Adventurer } from './adventurer';
import type { SpecialAction } from './specialActions';

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

function battleOf(adventurers: Adventurer[], enemies: Adventurer[]): BattleState {
  return { adventurers, enemies, retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [] };
}

/** rng() returns each value in order, repeating the last once exhausted (same convention as actions/attack.test.ts). */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('resolveTurn', () => {
  it("resolves the die faces' majority action as the Basic Action — never a random roll", () => {
    const dieFaces = [...plainFaces(PowerAttackAction, 5), { action: AttackNearestAction }];
    const actor = createAdventurer('actor', template({ dieFaces }), 'front');
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    const battle = battleOf([actor], [target]);

    const turn = resolveTurn(actor, battle, sequence(0.5, 0.5));

    expect(turn.rolledFaceIndex).toBe(0);
    expect(turn.rolledActionId).toBe('power-attack');
    expect(turn.events).toEqual([
      { type: 'action', actionId: 'power-attack', outcome: { type: 'attack', damage: 10, hit: true, targetId: 'target' } }, // 5 attackPower * 2
    ]);
  });

  it('is deterministic: the same actor/dieFaces always resolves to the same action, with no rng consumed to choose it', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    const battle = battleOf([actor], [target]);

    const first = resolveTurn(actor, battle, sequence(0.5, 0.5));
    const second = resolveTurn(actor, battle, sequence(0.5, 0.5));

    expect(first.rolledActionId).toBe('attack-nearest');
    expect(second.rolledActionId).toBe('attack-nearest');
  });

  it('is an idle turn (no action event) when the Basic Action has no valid target at all', () => {
    const actor = createAdventurer('actor', template({ dieFaces: plainFaces(SelfHealAction) }), 'front');
    actor.hp = actor.maxHp; // full HP: SelfHealAction's selectTarget finds nobody to heal (not even itself)
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const turn = resolveTurn(actor, battle, sequence(0.5));

    expect(turn.rolledActionId).toBe('self-heal');
    expect(turn.events).toEqual([]);
  });

  it('ends the room via triggerRetreat when the Basic Action is Retreat and a valid target exists', () => {
    const actor = createAdventurer('actor', template({ dieFaces: plainFaces(RetreatAction) }), 'front');
    actor.hp = 1; // party average HP ratio far below the retreat threshold
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = battleOf([actor], [enemy]);

    const turn = resolveTurn(actor, battle, sequence(0));

    expect(turn.events).toEqual([{ type: 'action', actionId: 'retreat', outcome: { type: 'retreat' } }]);
    expect(battle.retreatRequested).toBe(true);
  });

  it('fires an on-turn-start Special Action before the Basic Action resolves', () => {
    const adrenaline: SpecialAction = { id: 'adrenaline', name: 'Adrenaline', trigger: 'on-turn-start', action: EmpowerAction };
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    actor.activeSpecialActions = [adrenaline];
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    const battle = battleOf([actor], [target]);

    const turn = resolveTurn(actor, battle, sequence(0.5, 0.5));

    expect(turn.events[0]).toEqual({
      type: 'special-action',
      actorId: 'actor',
      specialActionId: 'adrenaline',
      outcome: expect.objectContaining({ type: 'support-buff', targetId: 'actor' }),
    });
    expect(turn.events[1]).toMatchObject({ type: 'action', actionId: 'attack-nearest' });
  });

  it('fires on-hit-landed on the actor and on-hit-taken on the target when the Basic Action lands a hit', () => {
    const followThrough: SpecialAction = { id: 'follow-through', name: 'Follow Through', trigger: 'on-hit-landed', action: EmpowerAction };
    const retaliate: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    actor.activeSpecialActions = [followThrough];
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    target.activeSpecialActions = [retaliate];
    const battle = battleOf([actor], [target]);

    const turn = resolveTurn(actor, battle, sequence(0.5));

    const specialEvents = turn.events.filter((event) => event.type === 'special-action');
    expect(specialEvents).toEqual([
      {
        type: 'special-action',
        actorId: 'actor',
        specialActionId: 'follow-through',
        outcome: expect.objectContaining({ type: 'support-buff', targetId: 'actor' }),
      },
      {
        type: 'special-action',
        actorId: 'target',
        specialActionId: 'retaliate',
        outcome: expect.objectContaining({ type: 'attack', targetId: 'actor' }),
      },
    ]);
  });

  it('does not fire on-hit-landed/on-hit-taken (or anything else) when nothing actually got through (e.g. a fully-Shielded hit)', () => {
    // Every attack always connects now (no Accuracy/Evasion miss roll — the "pure auto-battler"
    // pass, see docs/roadmap.md), so the "nothing happened" case this test covers is a hit that
    // landed but dealt 0 damage, not a miss — see turnEngine.ts's landedHitTargetIds.
    const followThrough: SpecialAction = { id: 'follow-through', name: 'Follow Through', trigger: 'on-hit-landed', action: EmpowerAction };
    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    actor.activeSpecialActions = [followThrough];
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    applyShield(target, 'test-shield', 1000, 3);
    const battle = battleOf([actor], [target]);

    const turn = resolveTurn(actor, battle, sequence(0.5));

    expect(turn.events.some((event) => event.type === 'special-action')).toBe(false);
  });

  it('fires on-enemy-downed for every living enemy and on-ally-downed for every living ally once a hit downs a unit, after the outcome fully resolves', () => {
    const vengeance: SpecialAction = { id: 'vengeance', name: 'Vengeance', trigger: 'on-enemy-downed', action: EmpowerAction };
    const mourning: SpecialAction = { id: 'mourning', name: 'Mourning', trigger: 'on-ally-downed', action: EmpowerAction };

    const actor = createAdventurer('actor', template({ maxHp: 100, attackPower: 999 }), 'front');
    const doomedTarget = createAdventurer('doomed-target', template({ maxHp: 1 }), 'front');
    const watchingAlly = createAdventurer('watching-ally', template({ maxHp: 100 }), 'front');
    watchingAlly.activeSpecialActions = [vengeance];
    const grievingEnemy = createAdventurer('grieving-enemy', template({ maxHp: 100 }), 'front');
    grievingEnemy.activeSpecialActions = [mourning];

    const battle = battleOf([actor, watchingAlly], [doomedTarget, grievingEnemy]);

    const turn = resolveTurn(actor, battle, sequence(0.5));

    expect(doomedTarget.hp).toBe(0);
    const specialEvents = turn.events.filter((event) => event.type === 'special-action');
    // doomedTarget's own roster (the enemies) is processed before its opposing roster (the
    // adventurers) — see turnEngine.ts's downed-unit loop — so grieving-enemy's on-ally-downed
    // fires before watching-ally's on-enemy-downed.
    expect(specialEvents).toEqual([
      {
        type: 'special-action',
        actorId: 'grieving-enemy',
        specialActionId: 'mourning',
        outcome: expect.objectContaining({ type: 'support-buff' }),
      },
      {
        type: 'special-action',
        actorId: 'watching-ally',
        specialActionId: 'vengeance',
        outcome: expect.objectContaining({ type: 'support-buff' }),
      },
    ]);
  });

  it('does not let a hit caused by a triggered Special Action itself fire further triggers', () => {
    // retaliate fires on-hit-taken; its own attack lands a hit on `actor`, but that hit must not
    // itself fire another round of on-hit-landed/on-hit-taken (no recursive triggering).
    const retaliate: SpecialAction = { id: 'retaliate', name: 'Retaliate', trigger: 'on-hit-taken', action: AttackNearestAction };
    const chainReaction: SpecialAction = { id: 'chain-reaction', name: 'Chain Reaction', trigger: 'on-hit-taken', action: EmpowerAction };

    const actor = createAdventurer('actor', template({ maxHp: 100 }), 'front');
    actor.activeSpecialActions = [chainReaction]; // would fire again if retaliate's hit re-triggered
    const target = createAdventurer('target', template({ maxHp: 100 }), 'front');
    target.activeSpecialActions = [retaliate];
    const battle = battleOf([actor], [target]);

    const turn = resolveTurn(actor, battle, sequence(0.5));

    const specialEvents = turn.events.filter((event) => event.type === 'special-action');
    expect(specialEvents).toEqual([
      {
        type: 'special-action',
        actorId: 'target',
        specialActionId: 'retaliate',
        outcome: expect.objectContaining({ type: 'attack', targetId: 'actor' }),
      },
    ]);
  });
});
