import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import {
  HealAction,
  SelfHealAction,
  MendingChargeAction,
  MENDING_CHARGE_ENERGY_PER_ROLL,
  CleanseAction,
  ReviveAction,
  REVIVE_HP_FRACTION,
  SplashHealAction,
  SPLASH_HEAL_FRACTION,
} from './heal';
import { GuardiansVowAction, GUARDIANS_VOW_BASE_SHIELD, GUARDIANS_VOW_SHIELD_PER_ENERGY, GUARDIANS_VOW_MAX_SHIELD } from './support';
import { AttackNearestAction } from './attack';
import { createBattleState, getHealEnergy } from '../battle';
import { resolveTurn } from '../turnEngine';
import { applyBurn, applyPoison } from '../statusEffects';

function allyTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Ally',
    maxHp: 20,
    attackPower: 5,
    healPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('HealAction', () => {
  it('targets and heals the lowest-HP living ally, over one merely wounded but not as low', () => {
    const healer = createAdventurer('healer', allyTemplate(), 'front');
    const healthyAlly = createAdventurer('healthy', allyTemplate(), 'front');
    healthyAlly.hp = 15; // 75% — not the lowest, not eligible

    const woundedAlly = createAdventurer('wounded', allyTemplate(), 'front');
    woundedAlly.hp = 9; // 45% — wounded, but not the lowest

    const criticalAlly = createAdventurer('critical', allyTemplate(), 'front');
    criticalAlly.hp = 4; // 20% — below threshold and the lowest of the three

    const battle = createBattleState([healer, healthyAlly, woundedAlly, criticalAlly], []);

    const target = HealAction.selectTarget({ actor: healer, battle });
    expect(target?.id).toBe('critical');

    const outcome = HealAction.resolve({ actor: healer, target: target!, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'heal', amount: 5, targetId: 'critical' });
    expect(criticalAlly.hp).toBe(9); // 4 + healer's healPower (5)
  });

  it('caps a heal at effective (modifier-adjusted) maxHp, not the raw field', () => {
    const healer = createAdventurer('healer', allyTemplate({ healPower: 10 }), 'front');
    const target = createAdventurer('target', allyTemplate(), 'front');
    target.modifiers = [{ stat: 'maxHp', type: 'flat', amount: -5, source: 'test' }]; // effective maxHp 15
    target.hp = 9;
    const battle = createBattleState([healer, target], []);

    const outcome = HealAction.resolve({ actor: healer, target, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'heal', amount: 10, targetId: 'target' });
    expect(target.hp).toBe(15); // 9 + 10 would overshoot 19 (raw cap) but is capped at effective 15
  });

  it('never returns null (never an idle roll) — picks a living ally even at full HP, excluding Downed allies', () => {
    const healer = createAdventurer('healer', allyTemplate(), 'front'); // full HP
    const healthyAlly = createAdventurer('healthy', allyTemplate(), 'front');
    healthyAlly.hp = 20; // full HP — still a valid target now that the threshold is gone

    const downedAlly = createAdventurer('downed', allyTemplate(), 'front');
    downedAlly.hp = 0; // Downed and excluded regardless

    const battle = createBattleState([healer, healthyAlly, downedAlly], []);

    const target = HealAction.selectTarget({ actor: healer, battle });
    expect(target).not.toBeNull();
    expect(target?.id).not.toBe('downed');
  });

  it('rolling Heal with nobody hurt still fires, healing the (already full) lowest-HP ally for the raw amount', () => {
    const healer = createAdventurer('healer', allyTemplate({ dieFaces: plainFaces(HealAction) }), 'front');
    const enemy = createAdventurer('enemy', allyTemplate(), 'front');
    const battle = createBattleState([healer], [enemy]);

    const turn = resolveTurn(healer, battle, () => 0);

    expect(turn.rolledActionId).toBe('heal');
    expect(turn.events).toEqual([
      { type: 'action', actionId: 'heal', outcome: { type: 'heal', amount: 5, targetId: 'healer' } },
    ]);
    expect(healer.hp).toBe(healer.maxHp); // already full — resolveHeal's amount is raw, not the actual HP delta
  });

  it('rolling Heal on a die with a wounded ally in range heals them via the turn engine', () => {
    const healer = createAdventurer('healer', allyTemplate({ dieFaces: plainFaces(HealAction) }), 'front');
    const ally = createAdventurer('ally', allyTemplate(), 'front');
    ally.hp = 5; // 25% of 20 — below the heal threshold
    const battle = createBattleState([healer, ally], []);

    const turn = resolveTurn(healer, battle, () => 0);

    expect(turn.events).toEqual([
      { type: 'action', actionId: 'heal', outcome: { type: 'heal', amount: 5, targetId: 'ally' } },
    ]);
    expect(ally.hp).toBe(10); // 5 + healer's healPower (5)
  });

  it('applies a healPower StatModifier (e.g. from an equipped trinket) to heal amount, independent of attackPower', () => {
    const healer = createAdventurer(
      'healer',
      allyTemplate(),
      'front',
      [{ stat: 'healPower', type: 'flat', amount: 2, source: 'item:test-trinket' }],
    );
    const woundedAlly = createAdventurer('wounded', allyTemplate(), 'front');
    woundedAlly.hp = 4;
    const battle = createBattleState([healer, woundedAlly], []);

    const target = HealAction.selectTarget({ actor: healer, battle });
    const outcome = HealAction.resolve({ actor: healer, target: target!, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'heal', amount: 7, targetId: 'wounded' }); // 5 base + 2 flat
    expect(woundedAlly.hp).toBe(11);
  });

  it('applies its own action-level percent bonus to heal amount', () => {
    const healer = createAdventurer('healer', allyTemplate(), 'front');
    healer.actionLevels['heal'] = 2; // +15% per level beyond 1 -> +15%
    const woundedAlly = createAdventurer('wounded', allyTemplate(), 'front');
    woundedAlly.hp = 4;
    const battle = createBattleState([healer, woundedAlly], []);

    const target = HealAction.selectTarget({ actor: healer, battle });
    const outcome = HealAction.resolve({ actor: healer, target: target!, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'heal', amount: 6, targetId: 'wounded' }); // round(5 * 1.15) = 6
  });
});

describe('SelfHealAction (Bodil\'s signature mechanic — roadmap item 11)', () => {
  it('targets itself once below the heal threshold, ignoring a more-hurt ally', () => {
    const bodil = createAdventurer('bodil', allyTemplate(), 'front');
    bodil.hp = 9; // 45% — below the 50% threshold
    const moreHurtAlly = createAdventurer('ally', allyTemplate(), 'front');
    moreHurtAlly.hp = 2; // more hurt than Bodil, but irrelevant — Self-Heal only ever targets self
    const battle = createBattleState([bodil, moreHurtAlly], []);

    const target = SelfHealAction.selectTarget({ actor: bodil, battle });
    expect(target?.id).toBe('bodil');

    const outcome = SelfHealAction.resolve({ actor: bodil, target: bodil, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'heal', amount: 5, targetId: 'bodil' });
    expect(bodil.hp).toBe(14);
  });

  it('selects no target above the heal threshold — an idle turn, not a wasted heal', () => {
    const bodil = createAdventurer('bodil', allyTemplate(), 'front');
    bodil.hp = 15; // 75% — above threshold
    const battle = createBattleState([bodil], []);

    expect(SelfHealAction.selectTarget({ actor: bodil, battle })).toBeNull();
  });
});

describe('MendingChargeAction (Dawneth\'s signature mechanic — roadmap item 11)', () => {
  it('heals the lowest-HP ally and grants energy when someone qualifies', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), 'front');
    const woundedAlly = createAdventurer('wounded', allyTemplate(), 'front');
    woundedAlly.hp = 4; // below the 50% threshold
    const battle = createBattleState([dawneth, woundedAlly], []);

    const target = MendingChargeAction.selectTarget({ actor: dawneth, battle });
    expect(target?.id).toBe('wounded');

    const outcome = MendingChargeAction.resolve({ actor: dawneth, target: target!, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'heal-and-charge',
      amount: 5,
      targetId: 'wounded',
      energyGained: MENDING_CHARGE_ENERGY_PER_ROLL,
      totalEnergy: MENDING_CHARGE_ENERGY_PER_ROLL,
    });
    expect(woundedAlly.hp).toBe(9);
    expect(getHealEnergy(battle, 'dawneth')).toBe(MENDING_CHARGE_ENERGY_PER_ROLL);
  });

  it('never returns null (never an idle roll) — picks the lowest-HP ally even at full HP, healing nothing but still charging', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), 'front'); // full HP
    const healthyAlly = createAdventurer('healthy', allyTemplate(), 'front'); // also full HP
    const battle = createBattleState([dawneth, healthyAlly], []);

    const target = MendingChargeAction.selectTarget({ actor: dawneth, battle });
    expect(target).not.toBeNull();

    const outcome = MendingChargeAction.resolve({ actor: dawneth, target: target!, battle, rng: () => 0.5 });

    expect(outcome).toMatchObject({ type: 'heal-and-charge', amount: 0, energyGained: MENDING_CHARGE_ENERGY_PER_ROLL });
    expect(getHealEnergy(battle, 'dawneth')).toBe(MENDING_CHARGE_ENERGY_PER_ROLL);
  });

  it('accumulates energy across multiple rolls within the same room', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), 'front');
    const battle = createBattleState([dawneth], []);

    MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });
    MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });
    const third = MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });

    expect(getHealEnergy(battle, 'dawneth')).toBe(3 * MENDING_CHARGE_ENERGY_PER_ROLL);
    expect(third).toMatchObject({ totalEnergy: 3 * MENDING_CHARGE_ENERGY_PER_ROLL });
  });
});

describe("CleanseAction (Dawneth's second signature mechanic)", () => {
  it('clears every active status effect from the lowest-HP living ally', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), 'front');
    const woundedAlly = createAdventurer('ally', allyTemplate(), 'front');
    woundedAlly.hp = 5;
    applyBurn(woundedAlly, 2, 3);
    applyPoison(woundedAlly, 1, 5);
    const battle = createBattleState([dawneth, woundedAlly], []);

    const target = CleanseAction.selectTarget({ actor: dawneth, battle });
    expect(target).toBe(woundedAlly);

    const outcome = CleanseAction.resolve({ actor: dawneth, target: woundedAlly, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'cleanse', targetId: 'ally', clearedEffectIds: ['burn', 'poison'] });
    expect(woundedAlly.statusEffects).toEqual([]);
  });

  it('still resolves with an empty clearedEffectIds when the target has nothing to cleanse', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), 'front');
    const battle = createBattleState([dawneth], []);

    const outcome = CleanseAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'cleanse', targetId: 'dawneth', clearedEffectIds: [] });
  });
});

describe("ReviveAction (Mira's second signature mechanic)", () => {
  it('targets the first Downed ally and brings them back at REVIVE_HP_FRACTION of effective maxHp', () => {
    const mira = createAdventurer('mira', allyTemplate(), 'front');
    const downedAlly = createAdventurer('ally', allyTemplate({ maxHp: 20 }), 'front');
    downedAlly.hp = 0;
    const battle = createBattleState([mira, downedAlly], []);

    const target = ReviveAction.selectTarget({ actor: mira, battle });
    expect(target).toBe(downedAlly);

    const outcome = ReviveAction.resolve({ actor: mira, target: downedAlly, battle, rng: () => 0.5 });

    const expectedAmount = Math.round(20 * REVIVE_HP_FRACTION);
    expect(outcome).toEqual({ type: 'revive', targetId: 'ally', amount: expectedAmount });
    expect(downedAlly.hp).toBe(expectedAmount);
  });

  it('clears downedSummary on the revived ally so a later down this run gets a fresh summary', () => {
    const mira = createAdventurer('mira', allyTemplate(), 'front');
    const downedAlly = createAdventurer('ally', allyTemplate(), 'front');
    downedAlly.hp = 0;
    downedAlly.downedSummary = {
      roomIndex: 0,
      killerArchetype: 'Grunt',
      damageDone: 0,
      damageTaken: 0,
      healed: 0,
      acknowledged: true,
    };
    const battle = createBattleState([mira, downedAlly], []);

    ReviveAction.resolve({ actor: mira, target: downedAlly, battle, rng: () => 0.5 });

    expect(downedAlly.downedSummary).toBeUndefined();
  });

  it('selectTarget returns null when nobody on the side is Downed', () => {
    const mira = createAdventurer('mira', allyTemplate(), 'front');
    const healthyAlly = createAdventurer('ally', allyTemplate(), 'front');
    const battle = createBattleState([mira, healthyAlly], []);

    expect(ReviveAction.selectTarget({ actor: mira, battle })).toBeNull();
  });
});

describe("Dawneth's lane-guardian kit (healer redesign)", () => {
  it('Mending Charge heals her guard (the ally in front of her in her lane) over a lower-HP ally elsewhere', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), { lane: 0, rank: 2 });
    const guard = createAdventurer('guard', allyTemplate(), { lane: 0, rank: 0 });
    guard.hp = 15;
    const elsewhere = createAdventurer('elsewhere', allyTemplate(), { lane: 2, rank: 0 });
    elsewhere.hp = 3;
    const battle = createBattleState([dawneth, guard, elsewhere], []);

    expect(MendingChargeAction.selectTarget({ actor: dawneth, battle })).toBe(guard);
  });

  it('picks the nearest ally in front when two stand ahead in her lane', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), { lane: 1, rank: 2 });
    const front = createAdventurer('front', allyTemplate(), { lane: 1, rank: 0 });
    const middle = createAdventurer('middle', allyTemplate(), { lane: 1, rank: 1 });
    front.hp = 5;
    middle.hp = 10;
    const battle = createBattleState([dawneth, front, middle], []);

    expect(MendingChargeAction.selectTarget({ actor: dawneth, battle })).toBe(middle);
  });

  it('Mending Charge falls back to the lowest-HP hurt ally when her guard is at full HP, with no 50% gate', () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), { lane: 0, rank: 2 });
    const guard = createAdventurer('guard', allyTemplate(), { lane: 0, rank: 0 });
    const elsewhere = createAdventurer('elsewhere', allyTemplate(), { lane: 2, rank: 0 });
    elsewhere.hp = 18; // only slightly hurt — the old 50% gate would have skipped this
    const battle = createBattleState([dawneth, guard, elsewhere], []);

    const target = MendingChargeAction.selectTarget({ actor: dawneth, battle })!;
    expect(target).toBe(elsewhere);
    const outcome = MendingChargeAction.resolve({ actor: dawneth, target, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ type: 'heal-and-charge', amount: 5 });
    expect(elsewhere.hp).toBe(20);
  });

  it("Guardian's Vow shields her guard, growing with banked energy up to the cap", () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), { lane: 0, rank: 2 });
    const guard = createAdventurer('guard', allyTemplate(), { lane: 0, rank: 0 });
    const battle = createBattleState([dawneth, guard], []);
    battle.healEnergyByUnitId[dawneth.id] = 3;

    const target = GuardiansVowAction.selectTarget({ actor: dawneth, battle })!;
    expect(target).toBe(guard);
    const outcome = GuardiansVowAction.resolve({ actor: dawneth, target, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ type: 'support-shield', amount: GUARDIANS_VOW_BASE_SHIELD + 3 * GUARDIANS_VOW_SHIELD_PER_ENERGY });

    battle.healEnergyByUnitId[dawneth.id] = 100;
    expect(GuardiansVowAction.resolve({ actor: dawneth, target, battle, rng: () => 0.5 })).toMatchObject({
      amount: GUARDIANS_VOW_MAX_SHIELD,
    });
  });

  it("Guardian's Vow shields the lowest-HP ally when nobody stands in front of her", () => {
    const dawneth = createAdventurer('dawneth', allyTemplate(), { lane: 0, rank: 0 });
    const hurt = createAdventurer('hurt', allyTemplate(), { lane: 2, rank: 0 });
    hurt.hp = 4;
    const battle = createBattleState([dawneth, hurt], []);

    expect(GuardiansVowAction.selectTarget({ actor: dawneth, battle })).toBe(hurt);
  });
});

describe("Mira's Splash Heal (healer redesign)", () => {
  it('heals the lowest-HP hurt ally and splashes a fraction onto orthogonally adjacent allies only', () => {
    const mira = createAdventurer('mira', allyTemplate({ healPower: 8 }), { lane: 2, rank: 2 });
    const target = createAdventurer('target', allyTemplate(), { lane: 1, rank: 0 });
    target.hp = 2;
    const adjacent = createAdventurer('adjacent', allyTemplate(), { lane: 0, rank: 0 });
    adjacent.hp = 10;
    const diagonal = createAdventurer('diagonal', allyTemplate(), { lane: 0, rank: 1 });
    diagonal.hp = 10;
    const battle = createBattleState([mira, target, adjacent, diagonal], []);

    expect(SplashHealAction.selectTarget({ actor: mira, battle })).toBe(target);
    const outcome = SplashHealAction.resolve({ actor: mira, target, battle, rng: () => 0.5 });

    const splash = Math.round(8 * SPLASH_HEAL_FRACTION);
    expect(outcome).toEqual({ type: 'heal', amount: 8, targetId: 'target', splashes: [{ targetId: 'adjacent', amount: splash }] });
    expect(target.hp).toBe(10);
    expect(adjacent.hp).toBe(10 + splash);
    expect(diagonal.hp).toBe(10);
  });

  it('selects no target (no wasted overheal) when nobody is hurt', () => {
    const mira = createAdventurer('mira', allyTemplate(), 'back');
    const ally = createAdventurer('ally', allyTemplate(), 'front');
    const battle = createBattleState([mira, ally], []);

    expect(SplashHealAction.selectTarget({ actor: mira, battle })).toBeNull();
  });
});
