import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, CleaveAction } from './actions/attack';
import { CommandAction } from './actions/support';
import { resolveRoom } from './room';
import type { BattleState } from './battle';

function template(overrides: Partial<AdventurerTemplate>): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 1,
    speed: 0,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('resolveRoom', () => {
  it('interleaves adventurers and enemies by speed, and stops the instant all enemies hit 0 HP', () => {
    // Speeds interleave the two sides: adv1(10) > e1(9) > adv2(8) > e2(7).
    const adv1 = createAdventurer('adv1', template({ name: 'Adv1', speed: 10, attackPower: 3, maxHp: 20 }), 'front');
    const adv2 = createAdventurer('adv2', template({ name: 'Adv2', speed: 8, attackPower: 3, maxHp: 20 }), 'front');
    const e1 = createAdventurer('e1', template({ name: 'E1', speed: 9, attackPower: 1, maxHp: 5 }), 'front');
    const e2 = createAdventurer('e2', template({ name: 'E2', speed: 7, attackPower: 1, maxHp: 5 }), 'front');

    const battle: BattleState = {
      adventurers: [adv1, adv2],
      enemies: [e1, e2],
      retreatRequested: false,
      partyGold: 0,
      healEnergyByUnitId: {},
      pendingIntercepts: [],
      pendingTraitEffects: [],
      secondWindUsedIds: [],
      turnsTakenByUnitId: {},
      chargeByUnitId: {},
      reactiveCooldowns: {},
      specialPowerMultiplier: 1,
    };

    const result = resolveRoom(battle, () => 0.5);

    expect(result.outcome).toBe('win');

    // Round 1: all four are alive and act, in speed order, genuinely
    // interleaving the two sides (not resolved as two separate phases).
    // adv1 hits e1 (nearest, tie broken to roster order) for 3 -> e1 at 2.
    // e1 hits adv1 (nearest) for 1 -> adv1 at 19.
    // adv2 hits e1 (still nearest/first) for 3 -> e1 dies (2 - 3 -> 0).
    // e2 hits adv1 (nearest, tie broken to roster order) for 1 -> adv1 at 18.
    expect(result.rounds[0].turnOrder).toEqual(['adv1', 'e1', 'adv2', 'e2']);

    // Round 2: e1 is dead, excluded from the turn order entirely.
    // adv1 hits e2 (only enemy left) for 3 -> e2 at 2.
    // adv2 hits e2 for 3 -> e2 dies (2 - 3 -> 0) -> all enemies at 0 -> win.
    // e2 never gets a round-2 turn: the room stops the instant adv2's hit lands.
    expect(result.rounds[1].turnOrder).toEqual(['adv1', 'adv2']);

    // No further rounds were resolved once the win was reached.
    expect(result.rounds).toHaveLength(2);

    // Final HP: only adv1 was ever targeted (tie-break always picks the
    // first adventurer), taking one hit from each enemy before they died.
    expect(adv1.hp).toBe(18);
    expect(adv2.hp).toBe(20);
    expect(e1.hp).toBe(0);
    expect(e2.hp).toBe(0);
  });

  it('breaks speed ties by position in the combined [...adventurers, ...enemies] roster', () => {
    const a = createAdventurer('a', template({ speed: 5 }), 'front');
    const b = createAdventurer('b', template({ speed: 5 }), 'front');
    // High enough HP that a single round of attacks can't decide the room,
    // so the round completes in full and the turn order below reflects
    // every unit, not just whoever acted before an early win/loss break.
    const enemy = createAdventurer('enemy', template({ speed: 5, maxHp: 100 }), 'front');

    const battle: BattleState = {
      adventurers: [b, a], // deliberately not in "expected" order
      enemies: [enemy],
      retreatRequested: false,
      partyGold: 0,
      healEnergyByUnitId: {},
      pendingIntercepts: [],
      pendingTraitEffects: [],
      secondWindUsedIds: [],
      turnsTakenByUnitId: {},
      chargeByUnitId: {},
      reactiveCooldowns: {},
      specialPowerMultiplier: 1,
    };

    const result = resolveRoom(battle, () => 0.5, 1);

    // Combined roster is [...adventurers, ...enemies] = [b, a, enemy]; all
    // tied on speed, so that's the turn order.
    expect(result.rounds[0].turnOrder).toEqual(['b', 'a', 'enemy']);
    // Hitting maxRounds without either side wiped is forced to 'retreat'
    // rather than left undecided — see resolveRoom's stalemate handling.
    expect(result.outcome).toBe('retreat');
  });

  it('sorts turn order by effective (modifier-adjusted) speed, not the raw field', () => {
    const slowOnPaper = createAdventurer('slow-on-paper', template({ speed: 1 }), 'front');
    slowOnPaper.modifiers = [{ stat: 'speed', type: 'flat', amount: 20, source: 'test' }]; // now effectively fastest
    const fastOnPaper = createAdventurer('fast-on-paper', template({ speed: 10 }), 'front');
    const enemy = createAdventurer('enemy', template({ speed: 5, maxHp: 100 }), 'front');

    const battle: BattleState = {
      adventurers: [fastOnPaper, slowOnPaper],
      enemies: [enemy],
      retreatRequested: false,
      partyGold: 0,
      healEnergyByUnitId: {},
      pendingIntercepts: [],
      pendingTraitEffects: [],
      secondWindUsedIds: [],
      turnsTakenByUnitId: {},
      chargeByUnitId: {},
      reactiveCooldowns: {},
      specialPowerMultiplier: 1,
    };

    const result = resolveRoom(battle, () => 0.5, 1);

    expect(result.rounds[0].turnOrder).toEqual(['slow-on-paper', 'fast-on-paper', 'enemy']);
  });

  it('tracks run-scoped damage dealt/taken and healing done as the room plays out', () => {
    const adv = createAdventurer('adv', template({ speed: 10, attackPower: 3, maxHp: 5 }), 'front');
    const enemy = createAdventurer('enemy', template({ name: 'Ogre', speed: 1, attackPower: 10, maxHp: 100 }), 'front');

    const battle: BattleState = { adventurers: [adv], enemies: [enemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
    resolveRoom(battle, () => 0.5);

    // adv hits first (higher speed) for 3, then the ogre's counterhit for 10 downs adv (loss ends
    // the room immediately, so the ogre never gets attacked again).
    expect(adv.runDamageDealt).toBe(3);
    expect(adv.runDamageTaken).toBe(10);
    expect(enemy.runDamageDealt).toBe(10);
    expect(enemy.runDamageTaken).toBe(3);
  });

  it('captures a DownedSummary attributing the kill to the attacker the instant hp hits 0', () => {
    const adv = createAdventurer('adv', template({ speed: 10, attackPower: 3, maxHp: 5 }), 'front');
    const enemy = createAdventurer('enemy', template({ name: 'Ogre', speed: 1, attackPower: 10, maxHp: 100 }), 'front');

    const battle: BattleState = { adventurers: [adv], enemies: [enemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
    const result = resolveRoom(battle, () => 0.5, 100, 2);

    expect(result.outcome).toBe('loss');
    expect(adv.downedSummary).toEqual({
      roomIndex: 2,
      killerArchetype: 'Ogre',
      damageDone: 3,
      damageTaken: 10,
      healed: 0,
      acknowledged: false,
    });
    // The enemy that landed the kill isn't a party member — it gets no summary of its own.
    expect(enemy.downedSummary).toBeUndefined();
  });

  it('attributes a status-effect kill (e.g. Burn) to no attacker', () => {
    const adv = createAdventurer('adv', template({ speed: 10, maxHp: 3 }), 'front');
    adv.statusEffects = [{ id: 'burn', damagePerTick: 5, remainingTicks: 1 }];
    const enemy = createAdventurer('enemy', template({ name: 'Ogre', speed: 1, maxHp: 100 }), 'front');

    const battle: BattleState = { adventurers: [adv], enemies: [enemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
    const result = resolveRoom(battle, () => 0.5);

    expect(result.outcome).toBe('loss');
    expect(adv.downedSummary?.killerArchetype).toBeNull();
  });

  it('aggregates an attack-multi outcome (e.g. Cleave) across every hit target, including per-target DownedSummaries', () => {
    // Cleave isn't archetype-exclusive at the sim level — reused here on an "enemy" side purely to
    // exercise the multi-target stats/DownedSummary path against real party members (only party
    // members ever get a DownedSummary — see the status-effect-kill test above).
    const cleavingEnemy = createAdventurer(
      'ogre',
      template({ name: 'Ogre', speed: 10, attackPower: 5, maxHp: 100, dieFaces: plainFaces(CleaveAction) }),
      'front',
    );
    const advA = createAdventurer('adv-a', template({ name: 'Adv A', speed: 1, maxHp: 3 }), 'front');
    const advB = createAdventurer('adv-b', template({ name: 'Adv B', speed: 1, maxHp: 3 }), 'front');

    const battle: BattleState = { adventurers: [advA, advB], enemies: [cleavingEnemy], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
    const result = resolveRoom(battle, () => 0.5);

    expect(result.outcome).toBe('loss');
    // One Cleave hits both party members for 5 each -> both die in round 1, damage summed across both hits.
    expect(cleavingEnemy.runDamageDealt).toBe(10);
    expect(advA.downedSummary).toEqual({
      roomIndex: 0,
      killerArchetype: 'Ogre',
      damageDone: 0,
      damageTaken: 5,
      healed: 0,
      acknowledged: false,
    });
    expect(advB.downedSummary).toEqual({
      roomIndex: 0,
      killerArchetype: 'Ogre',
      damageDone: 0,
      damageTaken: 5,
      healed: 0,
      acknowledged: false,
    });
  });

  it('attributes a command outcome\'s damage/kill to the commanded ally, not the commander', () => {
    // Same reuse-on-the-enemy-side approach as the Cleave test above: a "Commander" enemy commands
    // its own "Striker" ally to land the killing blow on a party member.
    const commander = createAdventurer(
      'commander',
      template({ name: 'Commander', speed: 10, attackPower: 1, maxHp: 100, dieFaces: plainFaces(CommandAction) }),
      'front',
    );
    const striker = createAdventurer('striker', template({ name: 'Striker', speed: 1, attackPower: 5 }), 'front');
    const adv = createAdventurer('adv', template({ name: 'Adv', speed: 0, maxHp: 3 }), 'front');

    const battle: BattleState = { adventurers: [adv], enemies: [commander, striker], retreatRequested: false, partyGold: 0, healEnergyByUnitId: {}, pendingIntercepts: [], pendingTraitEffects: [], secondWindUsedIds: [], turnsTakenByUnitId: {}, chargeByUnitId: {}, reactiveCooldowns: {}, specialPowerMultiplier: 1 };
    const result = resolveRoom(battle, () => 0.5);

    expect(result.outcome).toBe('loss');
    expect(commander.runDamageDealt).toBe(0); // she never attacks directly
    expect(striker.runDamageDealt).toBe(5); // the commanded bonus attack is credited to her
    expect(adv.downedSummary).toMatchObject({ killerArchetype: 'Striker' });
  });
});
