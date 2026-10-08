import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import {
  AttackNearestAction,
  PowerAttackAction,
  CleaveAction,
  RallyingStrikeAction,
  RALLY_ARMOR_BONUS,
  RALLY_BUFF_DURATION_TURNS,
  PiercingStrikeAction,
  FearAction,
  FEAR_VULNERABILITY_PERCENT,
  FEAR_DURATION_TURNS,
  PickpocketStrikeAction,
  PICKPOCKET_GOLD_MIN,
  PICKPOCKET_GOLD_MAX,
  GildedStrikeAction,
  GOLD_SCALING_PERCENT_PER_GOLD,
  GOLD_SCALING_MAX_PERCENT,
  BlindingBoltAction,
  BLIND_ATTACK_PERCENT_PENALTY,
  BLIND_DURATION_TURNS,
  CardThrowAction,
  CARD_THROW_VARIANCE_FRACTION,
  MourningStrikeAction,
  MOURNING_STRIKE_PERCENT_PER_ENERGY,
  MOURNING_STRIKE_MAX_PERCENT,
  SneakStrikeAction,
  SNEAK_STRIKE_BACK_ROW_CHANCE,
  VenomStingAction,
  FocusedShotAction,
  LifestealStrikeAction,
  LIFESTEAL_PERCENT,
  ExecuteStrikeAction,
  ChainStrikeAction,
  CHAIN_BOUNCE_COUNT,
  ScatterShotAction,
  SCATTER_SHOT_TARGET_COUNT,
  DAMAGE_VARIANCE_FRACTION,
  MIN_DAMAGE_AFTER_ARMOR,
  CRIT_DAMAGE_MULTIPLIER,
} from './attack';
import { createBattleState } from '../battle';
import { MendingChargeAction } from './heal';
import { RAGE_TRAIT, THORNS_TRAIT, THORNS_REFLECT_PERCENT } from '../traits';
import { tickBuffs, applyBuff } from '../buffs';
import { applyShield } from '../shields';
import { getEffectiveStat } from '../stats';

/** rng() returns each value in order, repeating the last once exhausted — lets a test control the hit roll and the variance roll (two separate rng() calls) independently. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

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

describe('attack actions and StatModifiers', () => {
  it('deals plain attackPower damage with no modifiers', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' });
    expect(enemy.hp).toBe(95);
  });

  it('applies a flat attackPower StatModifier (e.g. from an equipped weapon) to damage', () => {
    const attacker = createAdventurer(
      'attacker',
      template(),
      'front',
      [{ stat: 'attackPower', type: 'flat', amount: 3, source: 'item:test-weapon' }],
    );
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 8, hit: true, targetId: 'enemy' }); // 5 base + 3 flat
    expect(enemy.hp).toBe(92);
  });

  it('applies a percent attackPower StatModifier and rounds the resulting damage', () => {
    const attacker = createAdventurer(
      'attacker',
      template(),
      'front',
      [{ stat: 'attackPower', type: 'percent', amount: 20, source: 'item:test-weapon' }],
    );
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 6, hit: true, targetId: 'enemy' }); // 5 * 1.2 = 6
    expect(enemy.hp).toBe(94);
  });

  it('applies the same attackPower modifier to Power Attack, on top of its own multiplier', () => {
    const attacker = createAdventurer(
      'attacker',
      template(),
      'front',
      [{ stat: 'attackPower', type: 'flat', amount: 3, source: 'item:test-weapon' }],
    );
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = PowerAttackAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 16, hit: true, targetId: 'enemy' }); // (5 + 3) * 2
  });

  it('applies its own action-level percent bonus on top of StatModifiers, independent of other actions\' levels', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    attacker.actionLevels['attack-nearest'] = 2; // +15% per level beyond 1 -> +15%
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 6, hit: true, targetId: 'enemy' }); // round(5 * 1.15) = 6

    // Power Attack's own level is untouched -> no bonus there.
    const powerOutcome = PowerAttackAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(powerOutcome).toEqual({ type: 'attack', damage: 10, hit: true, targetId: 'enemy' }); // 5 * 2, no bonus
  });
});

describe('damage variance, armor, and Shield/Invulnerability/Dodge (no hit/miss roll)', () => {
  it('always connects regardless of rng — there is no Accuracy/Evasion miss roll', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // Even the highest possible rng roll still lands — no miss chance exists anymore.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.999999 });

    expect(outcome.type).toBe('attack');
    if (outcome.type !== 'attack') throw new Error('expected attack');
    expect(outcome.hit).toBe(true);
    expect(outcome.damage).toBeGreaterThan(0);
  });

  it('rolls damage variance within ±DAMAGE_VARIANCE_FRACTION of the base value on a landed hit', () => {
    // critChance: 0 isolates this from Tharavel's crit mechanic (roadmap item 11), which reuses this
    // same low hit-roll value as its own check — see attack.ts's rollIsCrit.
    const attacker = createAdventurer('attacker', template({ attackPower: 100, critChance: 0 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const lowRoll = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0, 0) });
    const highRoll = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0, 0.999999) });

    expect(lowRoll).toMatchObject({ hit: true, damage: Math.round(100 * (1 - DAMAGE_VARIANCE_FRACTION)) });
    expect(highRoll).toMatchObject({ hit: true, damage: Math.round(100 * (1 + DAMAGE_VARIANCE_FRACTION)) });
  });

  it('mitigates damage by the target\'s flat armor StatModifiers, floored at MIN_DAMAGE_AFTER_ARMOR', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const armoredEnemy = createAdventurer(
      'enemy',
      template({ maxHp: 100 }),
      'front',
      [{ stat: 'armor', type: 'flat', amount: 4, source: 'item:test-armor' }],
    );
    const battle = createBattleState([attacker], [armoredEnemy]);

    // No variance at rng 0.5 -> 10 base - 4 armor = 6.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: armoredEnemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 6, hit: true, targetId: 'enemy' });

    // Armor exceeding raw damage still lets MIN_DAMAGE_AFTER_ARMOR through, never fully negating a landed hit.
    const heavilyArmored = createAdventurer(
      'tank',
      template({ maxHp: 100 }),
      'front',
      [{ stat: 'armor', type: 'flat', amount: 50, source: 'item:test-plate' }],
    );
    const heavilyArmoredBattle = createBattleState([attacker], [heavilyArmored]);
    const flooredOutcome = AttackNearestAction.resolve({
      actor: attacker,
      target: heavilyArmored,
      battle: heavilyArmoredBattle,
      rng: () => 0.5,
    });
    expect(flooredOutcome).toMatchObject({ hit: true, damage: MIN_DAMAGE_AFTER_ARMOR });
  });

  it('a Shield absorbs damage before HP, partially depleting rather than staying flat', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const shieldedEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 4, 3);
    const battle = createBattleState([attacker], [shieldedEnemy]);

    // No variance at rng 0.5 -> 10 damage, 4 absorbed by Shield, 6 reaches HP.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 6, hit: true, targetId: 'enemy' });
    expect(shieldedEnemy.hp).toBe(94);
    expect(shieldedEnemy.shields).toEqual([]);
  });

  it('a Shield can fully negate a landed hit, unlike armor\'s MIN_DAMAGE_AFTER_ARMOR floor', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const shieldedEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 50, 3);
    const battle = createBattleState([attacker], [shieldedEnemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 0, hit: true, targetId: 'enemy' });
    expect(shieldedEnemy.hp).toBe(100);
    expect(shieldedEnemy.shields).toEqual([{ id: 'test-shield', amount: 40, remainingTurns: 3 }]);
  });

  it('Invulnerability blocks all damage, Shield included, and never depletes the Shield', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const target = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(target, 'test-shield', 50, 3);
    applyBuff(target, 'invuln', { stat: 'invulnerable', type: 'flat', amount: 1, source: 'buff:test' }, 3);
    const battle = createBattleState([attacker], [target]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 0, hit: true, targetId: 'enemy' });
    expect(target.hp).toBe(100);
    expect(target.shields).toEqual([{ id: 'test-shield', amount: 50, remainingTurns: 3 }]);
  });

  it('Thorns reflects a percent of final damage back onto the attacker, after Shield absorption', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10, maxHp: 100 }), 'front');
    const thornyTarget = createAdventurer('enemy', template({ maxHp: 100, traits: [THORNS_TRAIT] }), 'front');
    const battle = createBattleState([attacker], [thornyTarget]);

    // No variance at rng 0.5 -> 10 damage; THORNS_REFLECT_PERCENT of that reflects onto the attacker.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: thornyTarget, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 10, hit: true, targetId: 'enemy' });
    expect(attacker.hp).toBe(100 - Math.round(10 * (THORNS_REFLECT_PERCENT / 100)));
  });

  it('Thorns does not reflect anything on a miss or a fully-Shielded hit (no final damage landed)', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10, maxHp: 100 }), 'front');
    const thornyTarget = createAdventurer('enemy', template({ maxHp: 100, traits: [THORNS_TRAIT] }), 'front');
    applyShield(thornyTarget, 'test-shield', 50, 3);
    const battle = createBattleState([attacker], [thornyTarget]);

    AttackNearestAction.resolve({ actor: attacker, target: thornyTarget, battle, rng: () => 0.5 });

    expect(attacker.hp).toBe(100);
  });
});

describe('RAGE_TRAIT (Gudrun\'s signature mechanic — roadmap item 11)', () => {
  it('deals plain damage at full HP — no bonus yet', () => {
    const attacker = createAdventurer('attacker', template({ traits: [RAGE_TRAIT] }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ hit: true, damage: 5 });
  });

  it('scales damage up linearly as HP drops, capping at +50% at 0 HP', () => {
    const attacker = createAdventurer('attacker', template({ traits: [RAGE_TRAIT] }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    attacker.hp = 10; // half HP -> half of the +50% max bonus = +25%
    const halfHpOutcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(halfHpOutcome).toMatchObject({ hit: true, damage: Math.round(5 * 1.25) });

    attacker.hp = 0; // at the brink of being downed -> full +50% bonus
    const zeroHpOutcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(zeroHpOutcome).toMatchObject({ hit: true, damage: Math.round(5 * 1.5) });
  });

  it('does not affect a unit without the trait', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    attacker.hp = 0;
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ hit: true, damage: 5 });
  });

  it('computes the missing-HP fraction against effective (modifier-adjusted) maxHp, not the raw field', () => {
    const attacker = createAdventurer('attacker', template({ traits: [RAGE_TRAIT] }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // A -50% maxHp modifier drops effective maxHp to 10; at raw hp 10, that's full effective HP
    // (0 missing) despite being "half" of the raw 20 maxHp field — proves the bonus reads through
    // getEffectiveStat rather than the raw field.
    attacker.modifiers = [{ stat: 'maxHp', type: 'percent', amount: -50, source: 'test' }];
    attacker.hp = 10;
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ hit: true, damage: 5 });
  });
});

describe('CleaveAction (Bodil\'s signature mechanic — roadmap item 11)', () => {
  it('hits every living enemy in the target row, each for full damage', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const frontA = createAdventurer('front-a', template({ maxHp: 100 }), 'front');
    const frontB = createAdventurer('front-b', template({ maxHp: 100 }), 'front');
    const back = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([attacker], [frontA, frontB, back]);

    const outcome = CleaveAction.resolve({ actor: attacker, target: frontA, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-multi',
      hits: [
        { damage: 5, hit: true, targetId: 'front-a' },
        { damage: 5, hit: true, targetId: 'front-b' },
      ],
    });
    expect(frontA.hp).toBe(95);
    expect(frontB.hp).toBe(95);
    expect(back.hp).toBe(100); // back row untouched — not in the cleaved row
  });

  it('falls through to the back row once the front row is wiped, same as a normal melee target', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const downedFront = createAdventurer('front', template({ maxHp: 100 }), 'front');
    downedFront.hp = 0;
    const backA = createAdventurer('back-a', template({ maxHp: 100 }), 'back');
    const backB = createAdventurer('back-b', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([attacker], [downedFront, backA, backB]);

    const target = CleaveAction.selectTarget({ actor: attacker, battle });
    expect(target?.position.rank).toBe(2);

    const outcome = CleaveAction.resolve({ actor: attacker, target: target!, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({
      type: 'attack-multi',
      hits: [
        { targetId: 'back-a', hit: true },
        { targetId: 'back-b', hit: true },
      ],
    });
  });

  it('resolves each row-mate independently — one Shielded, one not', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    const shieldedEnemy = createAdventurer('shielded', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 1000, 3);
    const openEnemy = createAdventurer('open', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [shieldedEnemy, openEnemy]);

    const outcome = CleaveAction.resolve({ actor: attacker, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-multi',
      hits: [
        { damage: 0, hit: true, targetId: 'shielded' },
        { damage: 5, hit: true, targetId: 'open' },
      ],
    });
  });
});

describe('RallyingStrikeAction (Glint\'s signature mechanic — roadmap item 11)', () => {
  it('deals normal single-target damage, same as a plain attack', () => {
    const glint = createAdventurer('glint', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([glint], [enemy]);

    const outcome = RallyingStrikeAction.resolve({ actor: glint, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toMatchObject({ type: 'attack-and-buff', damage: 5, hit: true, targetId: 'enemy' });
    expect(enemy.hp).toBe(95);
  });

  it('grants a timed armor buff to every living ally, including herself, but not a downed ally or enemies', () => {
    const glint = createAdventurer('glint', template(), 'front');
    const ally = createAdventurer('ally', template({ maxHp: 100 }), 'front');
    const downedAlly = createAdventurer('downed', template({ maxHp: 100 }), 'front');
    downedAlly.hp = 0;
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([glint, ally, downedAlly], [enemy]);

    const outcome = RallyingStrikeAction.resolve({ actor: glint, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toMatchObject({
      buffedAllyIds: ['glint', 'ally'],
      armorAmount: RALLY_ARMOR_BONUS,
      durationTurns: RALLY_BUFF_DURATION_TURNS,
    });
    expect(getEffectiveStat(0, 'armor', glint.modifiers)).toBe(RALLY_ARMOR_BONUS);
    expect(getEffectiveStat(0, 'armor', ally.modifiers)).toBe(RALLY_ARMOR_BONUS);
    expect(getEffectiveStat(0, 'armor', downedAlly.modifiers)).toBe(0);
    expect(getEffectiveStat(0, 'armor', enemy.modifiers)).toBe(0);
  });

  it('the buff actually mitigates damage while active, and stops once it expires', () => {
    const glint = createAdventurer('glint', template({ attackPower: 10 }), 'front');
    const ally = createAdventurer('ally', template({ maxHp: 100 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100, attackPower: 10 }), 'front');
    const battle = createBattleState([glint, ally], [enemy]);

    RallyingStrikeAction.resolve({ actor: glint, target: enemy, battle, rng: () => 0.5 });

    // Enemy attacks the buffed ally: 10 base - RALLY_ARMOR_BONUS armor.
    const buffedHit = AttackNearestAction.resolve({ actor: enemy, target: ally, battle, rng: () => 0.5 });
    expect(buffedHit).toMatchObject({ hit: true, damage: 10 - RALLY_ARMOR_BONUS });

    for (let i = 0; i < RALLY_BUFF_DURATION_TURNS; i++) {
      tickBuffs(ally);
    }
    expect(ally.buffs).toEqual([]);

    const unbuffedHit = AttackNearestAction.resolve({ actor: enemy, target: ally, battle, rng: () => 0.5 });
    expect(unbuffedHit).toMatchObject({ hit: true, damage: 10 }); // buff expired, full damage again
  });

  it('refreshes the buff duration rather than stacking armor if re-cast before it expires', () => {
    const glint = createAdventurer('glint', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([glint], [enemy]);

    RallyingStrikeAction.resolve({ actor: glint, target: enemy, battle, rng: () => 0.5 });
    tickBuffs(glint);
    RallyingStrikeAction.resolve({ actor: glint, target: enemy, battle, rng: () => 0.5 });

    expect(glint.buffs).toHaveLength(1);
    expect(glint.buffs[0].remainingTurns).toBe(RALLY_BUFF_DURATION_TURNS);
    expect(getEffectiveStat(0, 'armor', glint.modifiers)).toBe(RALLY_ARMOR_BONUS); // not doubled
  });
});

describe('PiercingStrikeAction (Drifta\'s signature mechanic — roadmap item 11)', () => {
  it('while in the front row, reaches the lowest-HP enemy in EITHER row, not just front', () => {
    const drifta = createAdventurer('drifta', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    frontEnemy.hp = 50;
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    backEnemy.hp = 10; // lower HP, but in the back row
    const battle = createBattleState([drifta], [frontEnemy, backEnemy]);

    const target = PiercingStrikeAction.selectTarget({ actor: drifta, battle });
    expect(target?.id).toBe('back');
  });

  it('from the back row, falls back to a normal front-row-restricted lowest-HP attack', () => {
    const drifta = createAdventurer('drifta', template(), 'back');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    frontEnemy.hp = 50;
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    backEnemy.hp = 10; // lower HP, but unreachable — front row is still occupied
    const battle = createBattleState([drifta], [frontEnemy, backEnemy]);

    const target = PiercingStrikeAction.selectTarget({ actor: drifta, battle });
    expect(target?.id).toBe('front');
  });

  it('is a live check of the actor\'s row, not a fixed trait — reassigning her row changes targeting immediately', () => {
    const drifta = createAdventurer('drifta', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    frontEnemy.hp = 50;
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    backEnemy.hp = 10;
    const battle = createBattleState([drifta], [frontEnemy, backEnemy]);

    expect(PiercingStrikeAction.selectTarget({ actor: drifta, battle })?.id).toBe('back');

    drifta.position = { lane: 1, rank: 2 }; // player moves her via Formation
    expect(PiercingStrikeAction.selectTarget({ actor: drifta, battle })?.id).toBe('front');
  });

  it('deals plain single-target damage like a normal attack', () => {
    const drifta = createAdventurer('drifta', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([drifta], [enemy]);

    const outcome = PiercingStrikeAction.resolve({ actor: drifta, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' });
  });
});

describe('ExecuteStrikeAction (Drifta\'s second signature mechanic)', () => {
  it('finishes off a target already below EXECUTE_THRESHOLD_FRACTION on a landed hit', () => {
    const drifta = createAdventurer('drifta', template({ attackPower: 1 }), 'front');
    const weakEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    weakEnemy.hp = 20; // 20% of maxHp — below EXECUTE_THRESHOLD_FRACTION (30%)
    const battle = createBattleState([drifta], [weakEnemy]);

    const outcome = ExecuteStrikeAction.resolve({ actor: drifta, target: weakEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-with-execute', damage: 20, hit: true, targetId: 'enemy', executed: true });
    expect(weakEnemy.hp).toBe(0);
  });

  it('deals only normal damage against a target above the threshold', () => {
    const drifta = createAdventurer('drifta', template({ attackPower: 10 }), 'front');
    const healthyEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([drifta], [healthyEnemy]);

    const outcome = ExecuteStrikeAction.resolve({ actor: drifta, target: healthyEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-with-execute', damage: 10, hit: true, targetId: 'enemy', executed: false });
    expect(healthyEnemy.hp).toBe(90);
  });

  it('Invulnerability blocks the finishing blow too', () => {
    const drifta = createAdventurer('drifta', template({ attackPower: 1 }), 'front');
    const weakInvulnerableEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    weakInvulnerableEnemy.hp = 20;
    applyBuff(weakInvulnerableEnemy, 'invuln', { stat: 'invulnerable', type: 'flat', amount: 1, source: 'buff:test' }, 3);
    const battle = createBattleState([drifta], [weakInvulnerableEnemy]);

    const outcome = ExecuteStrikeAction.resolve({ actor: drifta, target: weakInvulnerableEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-with-execute', damage: 0, hit: true, targetId: 'enemy', executed: false });
    expect(weakInvulnerableEnemy.hp).toBe(20);
  });
});

describe('FearAction (Mirka\'s signature mechanic — roadmap item 11)', () => {
  it('applies a timed vulnerability debuff to every living enemy in the target row, dealing no damage', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const frontA = createAdventurer('front-a', template({ maxHp: 100 }), 'front');
    const frontB = createAdventurer('front-b', template({ maxHp: 100 }), 'front');
    const back = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([mirka], [frontA, frontB, back]);

    const outcome = FearAction.resolve({ actor: mirka, target: frontA, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'fear',
      fearedEnemyIds: ['front-a', 'front-b'],
      vulnerabilityAmount: FEAR_VULNERABILITY_PERCENT,
      durationTurns: FEAR_DURATION_TURNS,
    });
    expect(getEffectiveStat(0, 'vulnerability', frontA.modifiers)).toBe(FEAR_VULNERABILITY_PERCENT);
    expect(getEffectiveStat(0, 'vulnerability', frontB.modifiers)).toBe(FEAR_VULNERABILITY_PERCENT);
    expect(getEffectiveStat(0, 'vulnerability', back.modifiers)).toBe(0); // back row untouched
    expect(frontA.hp).toBe(100); // no damage from Fear itself
  });

  it('actually makes the feared target take more damage while active, and stops once it expires', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const feared = createAdventurer('feared', template({ maxHp: 1000 }), 'front');
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const battle = createBattleState([mirka, attacker], [feared]);

    FearAction.resolve({ actor: mirka, target: feared, battle, rng: () => 0.5 });

    const debuffedHit = AttackNearestAction.resolve({ actor: attacker, target: feared, battle, rng: () => 0.5 });
    expect(debuffedHit).toMatchObject({ damage: Math.round(10 * (1 + FEAR_VULNERABILITY_PERCENT / 100)) });

    for (let i = 0; i < FEAR_DURATION_TURNS; i++) {
      tickBuffs(feared);
    }
    expect(feared.buffs).toEqual([]);

    const clearedHit = AttackNearestAction.resolve({ actor: attacker, target: feared, battle, rng: () => 0.5 });
    expect(clearedHit).toMatchObject({ damage: 10 });
  });

  it('falls through to the back row once the front row is wiped, same as Cleave', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const downedFront = createAdventurer('front', template({ maxHp: 100 }), 'front');
    downedFront.hp = 0;
    const backA = createAdventurer('back-a', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([mirka], [downedFront, backA]);

    const target = FearAction.selectTarget({ actor: mirka, battle });
    expect(target?.position.rank).toBe(2);

    const outcome = FearAction.resolve({ actor: mirka, target: target!, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({ fearedEnemyIds: ['back-a'] });
  });
});

describe('PickpocketStrikeAction (Nerissa\'s signature mechanic — roadmap item 11)', () => {
  it('deals normal damage and rolls bonus gold on a landed hit', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([nerissa], [enemy]);

    // rng always 0.5: hit lands (0.5 < 0.85 hit chance), neutral variance -> damage 5;
    // gold-chance check 0.5 < PICKPOCKET_GOLD_CHANCE(0.6) -> triggers; amount = round(1 + 0.5*3) = 3.
    const outcome = PickpocketStrikeAction.resolve({ actor: nerissa, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-and-gold', damage: 5, hit: true, targetId: 'enemy', goldGenerated: 3 });
    expect(PICKPOCKET_GOLD_MIN).toBeLessThanOrEqual(3);
    expect(PICKPOCKET_GOLD_MAX).toBeGreaterThanOrEqual(3);
  });

  it('never generates gold when a Shield fully absorbs the hit', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const shieldedEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 1000, 3);
    const battle = createBattleState([nerissa], [shieldedEnemy]);

    const outcome = PickpocketStrikeAction.resolve({ actor: nerissa, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-and-gold', damage: 0, hit: true, targetId: 'enemy', goldGenerated: 0 });
  });

  it('can also land a hit that generates no gold, if the gold-chance roll fails', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([nerissa], [enemy]);

    // hit(0) -> lands; variance(0) -> lower bound; gold-chance(0.99) -> 0.99 >= 0.6, fails.
    const outcome = PickpocketStrikeAction.resolve({ actor: nerissa, target: enemy, battle, rng: sequence(0, 0, 0.99) });

    expect(outcome).toMatchObject({ hit: true, goldGenerated: 0 });
  });
});

describe('GildedStrikeAction (Nerissa\'s signature mechanic — roadmap item 11)', () => {
  it('deals plain damage with no party gold', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([nerissa], [enemy], 0);

    const outcome = GildedStrikeAction.resolve({ actor: nerissa, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' });
  });

  it('scales damage up with the party\'s banked gold', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([nerissa], [enemy], 20); // 20 * 0.5%/gold = +10%

    const outcome = GildedStrikeAction.resolve({ actor: nerissa, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: Math.round(5 * (1 + 10 / 100)), hit: true, targetId: 'enemy' });
  });

  it('caps the bonus at GOLD_SCALING_MAX_PERCENT regardless of how much gold the party has', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const richBattle = createBattleState([nerissa], [enemy], 100000);

    const outcome = GildedStrikeAction.resolve({ actor: nerissa, target: enemy, battle: richBattle, rng: () => 0.5 });
    expect(outcome).toEqual({
      type: 'attack',
      damage: Math.round(5 * (1 + GOLD_SCALING_MAX_PERCENT / 100)),
      hit: true,
      targetId: 'enemy',
    });
  });

  it('confirms the scaling formula constants are wired as documented', () => {
    expect(GOLD_SCALING_PERCENT_PER_GOLD).toBe(0.5);
    expect(GOLD_SCALING_MAX_PERCENT).toBe(100);
  });
});

describe('ChainStrikeAction (Nerissa\'s second signature mechanic)', () => {
  it('hits the primary target at full damage plus up to CHAIN_BOUNCE_COUNT other distinct living enemies at reduced damage', () => {
    const nerissa = createAdventurer('nerissa', template({ attackPower: 10 }), 'front');
    const primary = createAdventurer('primary', template({ maxHp: 100 }), 'front');
    const bounceA = createAdventurer('bounce-a', template({ maxHp: 100 }), 'front');
    const bounceB = createAdventurer('bounce-b', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([nerissa], [primary, bounceA, bounceB]);

    const outcome = ChainStrikeAction.resolve({ actor: nerissa, target: primary, battle, rng: () => 0.5 });

    expect(outcome.type).toBe('attack-multi');
    if (outcome.type !== 'attack-multi') throw new Error('expected attack-multi');
    expect(outcome.hits).toHaveLength(1 + CHAIN_BOUNCE_COUNT);
    expect(outcome.hits[0]).toEqual({ damage: 10, hit: true, targetId: 'primary' });
    const bounceIds = outcome.hits.slice(1).map((hit) => hit.targetId);
    expect(new Set(bounceIds).size).toBe(CHAIN_BOUNCE_COUNT); // distinct, no duplicates
    expect(bounceIds).not.toContain('primary');
  });

  it('bounces fewer than CHAIN_BOUNCE_COUNT times when there are not enough other living enemies', () => {
    const nerissa = createAdventurer('nerissa', template({ attackPower: 10 }), 'front');
    const primary = createAdventurer('primary', template({ maxHp: 100 }), 'front');
    const onlyOtherEnemy = createAdventurer('other', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([nerissa], [primary, onlyOtherEnemy]);

    const outcome = ChainStrikeAction.resolve({ actor: nerissa, target: primary, battle, rng: () => 0.5 });

    expect(outcome.type).toBe('attack-multi');
    if (outcome.type !== 'attack-multi') throw new Error('expected attack-multi');
    expect(outcome.hits).toHaveLength(2); // primary + the one other enemy, not CHAIN_BOUNCE_COUNT
  });
});

describe('BlindingBoltAction (Dravena\'s signature mechanic — roadmap item 11)', () => {
  it('deals normal damage and blinds the target (lowers attackPower) on a landed hit', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dravena], [enemy]);

    const outcome = BlindingBoltAction.resolve({ actor: dravena, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-and-debuff',
      damage: 5,
      hit: true,
      targetId: 'enemy',
      debuffApplied: true,
      attackPowerPercent: BLIND_ATTACK_PERCENT_PENALTY,
      durationTurns: BLIND_DURATION_TURNS,
    });
    expect(getEffectiveStat(enemy.attackPower, 'attackPower', enemy.modifiers)).toBe(
      enemy.attackPower * (1 + BLIND_ATTACK_PERCENT_PENALTY / 100),
    );
  });

  it('never blinds when a Shield fully absorbs the hit', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const shieldedEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 1000, 3);
    const battle = createBattleState([dravena], [shieldedEnemy]);

    const outcome = BlindingBoltAction.resolve({ actor: dravena, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-and-debuff',
      damage: 0,
      hit: true,
      targetId: 'enemy',
      debuffApplied: false,
      attackPowerPercent: BLIND_ATTACK_PERCENT_PENALTY,
      durationTurns: BLIND_DURATION_TURNS,
    });
    expect(getEffectiveStat(shieldedEnemy.attackPower, 'attackPower', shieldedEnemy.modifiers)).toBe(
      shieldedEnemy.attackPower,
    );
  });

  it('actually lowers the target\'s damage output while active, and stops once it expires', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const enemy = createAdventurer('enemy', template({ attackPower: 10, maxHp: 100 }), 'front');
    const ally = createAdventurer('ally', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dravena, ally], [enemy]);

    BlindingBoltAction.resolve({ actor: dravena, target: enemy, battle, rng: () => 0.5 });

    // 10 * 0.7 = 7 -> rounds to 7.
    const blindedHit = AttackNearestAction.resolve({ actor: enemy, target: ally, battle, rng: () => 0.5 });
    expect(blindedHit).toMatchObject({ hit: true, damage: 7 });

    for (let i = 0; i < BLIND_DURATION_TURNS; i++) {
      tickBuffs(enemy);
    }
    expect(enemy.buffs).toEqual([]);

    const clearedHit = AttackNearestAction.resolve({ actor: enemy, target: ally, battle, rng: () => 0.5 });
    expect(clearedHit).toMatchObject({ hit: true, damage: 10 });
  });

  it('reaches the back row directly (ranged), even while the front row is alive', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    // Back-row enemy listed first in roster order: a melee-restricted selector would still only
    // consider front-row candidates and skip straight to frontEnemy; an unrestricted (ranged)
    // selector picks whichever is genuinely first in the roster, back row included.
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dravena], [backEnemy, frontEnemy]);

    expect(BlindingBoltAction.reach).toBe('ranged');
    expect(BlindingBoltAction.selectTarget({ actor: dravena, battle })?.id).toBe('back');
  });
});

describe('CardThrowAction (Isilwen\'s signature mechanic — roadmap item 11)', () => {
  it('rolls damage variance within ±CARD_THROW_VARIANCE_FRACTION, much wider than a normal attack', () => {
    // critChance: 0 isolates this from Tharavel's crit mechanic (roadmap item 11) — see the
    // equivalent note on AttackNearestAction's own variance test above.
    const isilwen = createAdventurer('isilwen', template({ attackPower: 100, critChance: 0 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([isilwen], [enemy]);

    // rng order: random-target pick (only one enemy, any value picks it), hit roll, variance roll.
    const lowRoll = CardThrowAction.resolve({ actor: isilwen, target: enemy, battle, rng: sequence(0, 0, 0) });
    const highRoll = CardThrowAction.resolve({ actor: isilwen, target: enemy, battle, rng: sequence(0, 0, 0.999999) });

    expect(lowRoll).toMatchObject({ hit: true, damage: Math.round(100 * (1 - CARD_THROW_VARIANCE_FRACTION)) });
    expect(highRoll).toMatchObject({ hit: true, damage: Math.round(100 * (1 + CARD_THROW_VARIANCE_FRACTION)) });
    expect(CARD_THROW_VARIANCE_FRACTION).toBeGreaterThan(DAMAGE_VARIANCE_FRACTION);
  });

  it('targets a uniformly random living enemy, not just the first', () => {
    const isilwen = createAdventurer('isilwen', template(), 'front');
    const enemyA = createAdventurer('enemy-a', template({ maxHp: 100 }), 'front');
    const enemyB = createAdventurer('enemy-b', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([isilwen], [enemyA, enemyB]);

    const lowPick = CardThrowAction.resolve({ actor: isilwen, target: enemyA, battle, rng: sequence(0, 0.5, 0.5) });
    expect(lowPick).toMatchObject({ targetId: 'enemy-a' });

    const highPick = CardThrowAction.resolve({ actor: isilwen, target: enemyA, battle, rng: sequence(0.99, 0.5, 0.5) });
    expect(highPick).toMatchObject({ targetId: 'enemy-b' });
  });

  it('can reach the back row directly (ranged) as the random pick, even while the front row is alive', () => {
    const isilwen = createAdventurer('isilwen', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([isilwen], [frontEnemy, backEnemy]);

    expect(CardThrowAction.reach).toBe('ranged');
    // index 1 of [front, back] -> backEnemy, proving the back row is genuinely in the random pool.
    const outcome = CardThrowAction.resolve({ actor: isilwen, target: frontEnemy, battle, rng: sequence(0.99, 0.5, 0.5) });
    expect(outcome).toMatchObject({ targetId: 'back' });
  });

});

describe('SneakStrikeAction (Caladwen\'s signature mechanic — roadmap item 3)', () => {
  it('is a melee action, restricted to the front row for its own selectTarget', () => {
    expect(SneakStrikeAction.reach).toBe('melee');
  });

  it('falls back to the normal melee target when there is no living back row to sneak into', () => {
    const caladwen = createAdventurer('caladwen', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([caladwen], [frontEnemy]);

    // No back row at all: livingBackRow.length > 0 short-circuits before ever calling rng() for the
    // chance roll, so the first rng() consumed here is the hit roll.
    const outcome = SneakStrikeAction.resolve({ actor: caladwen, target: frontEnemy, battle, rng: sequence(0, 0) });

    expect(outcome).toMatchObject({ targetId: 'front', hit: true });
  });

  it('falls back to the normal target when the back-row roll misses SNEAK_STRIKE_BACK_ROW_CHANCE', () => {
    const caladwen = createAdventurer('caladwen', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([caladwen], [frontEnemy, backEnemy]);

    // chance roll (0.99, well above SNEAK_STRIKE_BACK_ROW_CHANCE) -> no sneak; hit roll; variance roll.
    const outcome = SneakStrikeAction.resolve({
      actor: caladwen,
      target: frontEnemy,
      battle,
      rng: sequence(0.99, 0, 0),
    });

    expect(outcome).toMatchObject({ targetId: 'front', hit: true });
  });

  it('sneaks past the front row to hit a random back-row enemy when the chance roll lands', () => {
    const caladwen = createAdventurer('caladwen', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const backA = createAdventurer('back-a', template({ maxHp: 100 }), 'back');
    const backB = createAdventurer('back-b', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([caladwen], [frontEnemy, backA, backB]);

    expect(SNEAK_STRIKE_BACK_ROW_CHANCE).toBeLessThan(1);
    // chance roll (0, well below SNEAK_STRIKE_BACK_ROW_CHANCE) -> sneak; index roll picks backB; hit; variance.
    const outcome = SneakStrikeAction.resolve({
      actor: caladwen,
      target: frontEnemy,
      battle,
      rng: sequence(0, 0.99, 0, 0),
    });

    expect(outcome).toMatchObject({ targetId: 'back-b', hit: true });
  });
});

describe("VenomStingAction (Caladwen's restored Poison identity)", () => {
  it('is a melee action with no attack roll — applies Poison and reports inflict-status', () => {
    const caladwen = createAdventurer('caladwen', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([caladwen], [enemy]);

    const outcome = VenomStingAction.resolve({ actor: caladwen, target: enemy, battle, rng: sequence(0.5) });

    expect(VenomStingAction.reach).toBe('melee');
    expect(outcome).toEqual({ type: 'inflict-status', targetId: 'enemy', effectId: 'poison' });
    expect(enemy.statusEffects).toEqual([{ id: 'poison', damagePerTick: 1, remainingTicks: 5 }]);
  });

  it('selects the same melee-eligible target a Basic Action would', () => {
    const caladwen = createAdventurer('caladwen', template(), 'front');
    const deadFront = createAdventurer('front', template({ maxHp: 100 }), 'front');
    deadFront.hp = 0;
    const back = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([caladwen], [deadFront, back]);

    expect(VenomStingAction.selectTarget({ actor: caladwen, battle })).toBe(back);
  });
});

describe('LifestealStrikeAction (Caladwen\'s second signature mechanic)', () => {
  it('heals the attacker for LIFESTEAL_PERCENT of the damage actually dealt on a landed hit', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    attacker.hp = 10;
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // No variance at rng 0.5 -> 10 damage dealt; LIFESTEAL_PERCENT of that healed back.
    const outcome = LifestealStrikeAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    const expectedHeal = Math.round(10 * (LIFESTEAL_PERCENT / 100));
    expect(outcome).toEqual({ type: 'attack-and-heal-self', damage: 10, hit: true, targetId: 'enemy', healedAmount: expectedHeal });
    expect(attacker.hp).toBe(10 + expectedHeal);
  });

  it('heals nothing when a Shield fully absorbs the hit, even though it landed', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    attacker.hp = 10;
    const shieldedEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    applyShield(shieldedEnemy, 'test-shield', 50, 3);
    const battle = createBattleState([attacker], [shieldedEnemy]);

    const outcome = LifestealStrikeAction.resolve({ actor: attacker, target: shieldedEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-and-heal-self', damage: 0, hit: true, targetId: 'enemy', healedAmount: 0 });
    expect(attacker.hp).toBe(10);
  });

  it('clamps the heal to the attacker\'s own effective maxHp', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 100, maxHp: 20 }), 'front');
    attacker.hp = 15;
    const enemy = createAdventurer('enemy', template({ maxHp: 1000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    LifestealStrikeAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(attacker.hp).toBe(20);
  });
});

describe('FocusedShotAction (Melpomene\'s signature mechanic — roadmap item 3)', () => {
  it('is a ranged action', () => {
    expect(FocusedShotAction.reach).toBe('ranged');
  });

  it('targets the lowest-HP living enemy, reaching the back row directly even while the front row is alive', () => {
    const melemnope = createAdventurer('melemnope', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    backEnemy.hp = 1; // lowest HP, but behind a living front row
    const battle = createBattleState([melemnope], [frontEnemy, backEnemy]);

    expect(FocusedShotAction.selectTarget({ actor: melemnope, battle })).toBe(backEnemy);
  });

  it('deals plain attackPower with no multiplier — the "lower-damage" trade-off for its ranged execute reach', () => {
    // critChance: 0 isolates this from Tharavel's crit mechanic — see the equivalent note elsewhere in this file.
    const melemnope = createAdventurer('melemnope', template({ attackPower: 10, critChance: 0 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([melemnope], [enemy]);

    // hit roll, then a variance roll of exactly 0.5 -> the variance multiplier's own midpoint (1.0).
    const outcome = FocusedShotAction.resolve({ actor: melemnope, target: enemy, battle, rng: sequence(0, 0.5) });

    expect(outcome).toMatchObject({ hit: true, damage: 10 });
  });
});

describe('ScatterShotAction (Melpomene\'s second signature mechanic)', () => {
  it('hits SCATTER_SHOT_TARGET_COUNT distinct living enemies at full damage, regardless of rank', () => {
    const melpomene = createAdventurer('melpomene', template({ attackPower: 10 }), 'front');
    const frontEnemy = createAdventurer('front-enemy', template({ maxHp: 100 }), 'front');
    const backEnemy = createAdventurer('back-enemy', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([melpomene], [frontEnemy, backEnemy]);

    const outcome = ScatterShotAction.resolve({ actor: melpomene, target: frontEnemy, battle, rng: () => 0.5 });

    expect(outcome.type).toBe('attack-multi');
    if (outcome.type !== 'attack-multi') throw new Error('expected attack-multi');
    expect(outcome.hits).toHaveLength(SCATTER_SHOT_TARGET_COUNT);
    for (const hit of outcome.hits) {
      expect(hit.damage).toBe(10); // full damage, no falloff unlike Chain Strike's bounces
    }
  });

  it('hits fewer targets when there are not enough living enemies to reach', () => {
    const melpomene = createAdventurer('melpomene', template({ attackPower: 10 }), 'front');
    const onlyEnemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([melpomene], [onlyEnemy]);

    const outcome = ScatterShotAction.resolve({ actor: melpomene, target: onlyEnemy, battle, rng: () => 0.5 });

    expect(outcome.type).toBe('attack-multi');
    if (outcome.type !== 'attack-multi') throw new Error('expected attack-multi');
    expect(outcome.hits).toHaveLength(1);
  });
});

describe('MourningStrikeAction (Dawneth\'s signature mechanic — roadmap item 11)', () => {
  it('deals plain damage with no built-up energy', () => {
    const dawneth = createAdventurer('dawneth', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dawneth], [enemy]);

    const outcome = MourningStrikeAction.resolve({ actor: dawneth, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' });
  });

  it('scales damage up with her own Mending Charge energy, without consuming it', () => {
    const dawneth = createAdventurer('dawneth', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dawneth], [enemy]);

    // 2 rolls of Mending Charge -> 2 energy -> 2 * MOURNING_STRIKE_PERCENT_PER_ENERGY bonus.
    MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });
    MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });

    const bonusPercent = 2 * MOURNING_STRIKE_PERCENT_PER_ENERGY;
    const outcome = MourningStrikeAction.resolve({ actor: dawneth, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: Math.round(5 * (1 + bonusPercent / 100)), hit: true, targetId: 'enemy' });

    // Never consumed: a second Mourning Strike right after still sees the same energy.
    const secondOutcome = MourningStrikeAction.resolve({ actor: dawneth, target: enemy, battle, rng: () => 0.5 });
    expect(secondOutcome).toEqual({ type: 'attack', damage: Math.round(5 * (1 + bonusPercent / 100)), hit: true, targetId: 'enemy' });
  });

  it('caps the bonus at MOURNING_STRIKE_MAX_PERCENT regardless of how much energy she has', () => {
    const dawneth = createAdventurer('dawneth', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dawneth], [enemy]);

    for (let i = 0; i < 50; i++) {
      MendingChargeAction.resolve({ actor: dawneth, target: dawneth, battle, rng: () => 0.5 });
    }

    const outcome = MourningStrikeAction.resolve({ actor: dawneth, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({
      type: 'attack',
      damage: Math.round(5 * (1 + MOURNING_STRIKE_MAX_PERCENT / 100)),
      hit: true,
      targetId: 'enemy',
    });
  });

  it('reads energy per-unit — another ally\'s Mending Charge rolls don\'t affect her own scaling', () => {
    const dawneth = createAdventurer('dawneth', template(), 'front');
    const otherHealer = createAdventurer('other', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dawneth, otherHealer], [enemy]);

    MendingChargeAction.resolve({ actor: otherHealer, target: otherHealer, battle, rng: () => 0.5 });

    const outcome = MourningStrikeAction.resolve({ actor: dawneth, target: enemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 5, hit: true, targetId: 'enemy' }); // no bonus — 0 energy of her own
  });
});

describe('critical hits (universal mechanic, roadmap item 11 — Tharavel\'s Inspire buffs an existing stat rather than inventing one)', () => {
  it('doubles damage when the hit-roll falls within critChance — reused, not a fresh rng() draw', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 100, critChance: 50 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // hit-roll 0.3 -> hits (< 85% hit chance) AND crits (< 50% critChance, same draw); variance 0.5 -> neutral.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0.3, 0.5) });
    expect(outcome).toMatchObject({ hit: true, damage: 100 * CRIT_DAMAGE_MULTIPLIER });
  });

  it('does not crit when the hit-roll lands above critChance, even on a landed hit', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 100, critChance: 50 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // hit-roll 0.6 -> hits (< 85%) but not a crit (>= 50% critChance); variance 0.5 -> neutral.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0.6, 0.5) });
    expect(outcome).toMatchObject({ hit: true, damage: 100 });
  });

  it('never crits at 0% critChance, even on the lowest possible hit-roll', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 100, critChance: 0 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0, 0.5) });
    expect(outcome).toMatchObject({ hit: true, damage: 100 });
  });

  it('everyone has a real baseline critChance by default, not just Tharavel-buffed units', () => {
    const attacker = createAdventurer('attacker', template({ attackPower: 100 }), 'front'); // default critChance
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    // hit-roll 0.01 is comfortably inside any nonzero default critChance.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0.01, 0.5) });
    expect(outcome).toMatchObject({ hit: true, damage: 100 * CRIT_DAMAGE_MULTIPLIER });
  });

  it('respects a critChance StatModifier (e.g. Tharavel\'s Inspire), not just the base stat', () => {
    const attacker = createAdventurer(
      'attacker',
      template({ attackPower: 100, critChance: 0 }),
      'front',
      [{ stat: 'critChance', type: 'flat', amount: 50, source: 'buff:inspire' }],
    );
    const enemy = createAdventurer('enemy', template({ maxHp: 100000 }), 'front');
    const battle = createBattleState([attacker], [enemy]);

    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: sequence(0.3, 0.5) });
    expect(outcome).toMatchObject({ hit: true, damage: 100 * CRIT_DAMAGE_MULTIPLIER });
  });
});
