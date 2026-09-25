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
  FEAR_ACCURACY_PENALTY,
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
  FocusedShotAction,
  DAMAGE_VARIANCE_FRACTION,
  MIN_DAMAGE_AFTER_ARMOR,
  CRIT_DAMAGE_MULTIPLIER,
} from './attack';
import { createBattleState } from '../battle';
import { MendingChargeAction } from './heal';
import { RAGE_TRAIT } from '../traits';
import { tickBuffs } from '../buffs';
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

describe('hit chance, damage variance, and armor', () => {
  it('misses when the roll exceeds hit chance, dealing no damage but still resolving the outcome', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    // Evasion this high clamps hit chance to MIN_HIT_CHANCE (5%) regardless of accuracy.
    const evasiveEnemy = createAdventurer('enemy', template({ maxHp: 100, evasion: 200 }), 'front');
    const battle = createBattleState([attacker], [evasiveEnemy]);

    // 0.5 >= the 5% floor -> miss.
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: evasiveEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack', damage: 0, hit: false, targetId: 'enemy' });
    expect(evasiveEnemy.hp).toBe(100);
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
    expect(target?.row).toBe('back');

    const outcome = CleaveAction.resolve({ actor: attacker, target: target!, battle, rng: () => 0.5 });
    expect(outcome).toMatchObject({
      type: 'attack-multi',
      hits: [
        { targetId: 'back-a', hit: true },
        { targetId: 'back-b', hit: true },
      ],
    });
  });

  it('rolls hit/miss independently per target', () => {
    const attacker = createAdventurer('attacker', template(), 'front');
    // First rng() call (front-a's hit roll) misses at MIN_HIT_CHANCE-adjacent evasion; second target hits.
    const missEnemy = createAdventurer('miss', template({ maxHp: 100, evasion: 200 }), 'front');
    const hitEnemy = createAdventurer('hit', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([attacker], [missEnemy, hitEnemy]);

    const outcome = CleaveAction.resolve({ actor: attacker, target: missEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-multi',
      hits: [
        { damage: 0, hit: false, targetId: 'miss' },
        { damage: 5, hit: true, targetId: 'hit' },
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

    drifta.row = 'back'; // player moves her via Formation
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

describe('FearAction (Mirka\'s signature mechanic — roadmap item 11)', () => {
  it('applies a timed negative-accuracy debuff to every living enemy in the target row, dealing no damage', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const frontA = createAdventurer('front-a', template({ maxHp: 100 }), 'front');
    const frontB = createAdventurer('front-b', template({ maxHp: 100 }), 'front');
    const back = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([mirka], [frontA, frontB, back]);

    const outcome = FearAction.resolve({ actor: mirka, target: frontA, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'fear',
      fearedEnemyIds: ['front-a', 'front-b'],
      accuracyAmount: FEAR_ACCURACY_PENALTY,
      durationTurns: FEAR_DURATION_TURNS,
    });
    expect(getEffectiveStat(85, 'accuracy', frontA.modifiers)).toBe(85 + FEAR_ACCURACY_PENALTY);
    expect(getEffectiveStat(85, 'accuracy', frontB.modifiers)).toBe(85 + FEAR_ACCURACY_PENALTY);
    expect(getEffectiveStat(85, 'accuracy', back.modifiers)).toBe(85); // back row untouched
    expect(frontA.hp).toBe(100); // no damage
  });

  it('actually lowers hit chance while active, and stops once it expires', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const feared = createAdventurer('feared', template({ accuracy: 90, maxHp: 100 }), 'front');
    const ally = createAdventurer('ally', template({ evasion: 0, maxHp: 100 }), 'front');
    const battle = createBattleState([mirka, ally], [feared]);

    FearAction.resolve({ actor: mirka, target: feared, battle, rng: () => 0.5 });

    // 90 accuracy - 20 penalty = 70 vs 0 evasion -> rng of 0.75 is now a miss (0.75 >= 0.70).
    const debuffedRoll = AttackNearestAction.resolve({ actor: feared, target: ally, battle, rng: () => 0.75 });
    expect(debuffedRoll).toMatchObject({ hit: false });

    for (let i = 0; i < FEAR_DURATION_TURNS; i++) {
      tickBuffs(feared);
    }
    expect(feared.buffs).toEqual([]);

    // Same roll now lands: 90 accuracy vs 0 evasion -> 0.75 < 0.90 -> hit.
    const clearedRoll = AttackNearestAction.resolve({ actor: feared, target: ally, battle, rng: () => 0.75 });
    expect(clearedRoll).toMatchObject({ hit: true });
  });

  it('falls through to the back row once the front row is wiped, same as Cleave', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const downedFront = createAdventurer('front', template({ maxHp: 100 }), 'front');
    downedFront.hp = 0;
    const backA = createAdventurer('back-a', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([mirka], [downedFront, backA]);

    const target = FearAction.selectTarget({ actor: mirka, battle });
    expect(target?.row).toBe('back');

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

  it('never generates gold on a miss', () => {
    const nerissa = createAdventurer('nerissa', template(), 'front');
    const evasiveEnemy = createAdventurer('enemy', template({ maxHp: 100, evasion: 200 }), 'front');
    const battle = createBattleState([nerissa], [evasiveEnemy]);

    const outcome = PickpocketStrikeAction.resolve({ actor: nerissa, target: evasiveEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'attack-and-gold', damage: 0, hit: false, targetId: 'enemy', goldGenerated: 0 });
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

  it('never blinds on a miss', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const evasiveEnemy = createAdventurer('enemy', template({ maxHp: 100, evasion: 200 }), 'front');
    const battle = createBattleState([dravena], [evasiveEnemy]);

    const outcome = BlindingBoltAction.resolve({ actor: dravena, target: evasiveEnemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'attack-and-debuff',
      damage: 0,
      hit: false,
      targetId: 'enemy',
      debuffApplied: false,
      attackPowerPercent: BLIND_ATTACK_PERCENT_PENALTY,
      durationTurns: BLIND_DURATION_TURNS,
    });
    expect(getEffectiveStat(evasiveEnemy.attackPower, 'attackPower', evasiveEnemy.modifiers)).toBe(
      evasiveEnemy.attackPower,
    );
  });

  it('actually lowers the target\'s damage output while active, and stops once it expires', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const enemy = createAdventurer('enemy', template({ attackPower: 10, maxHp: 100 }), 'front');
    const ally = createAdventurer('ally', template({ evasion: 0, maxHp: 100 }), 'front');
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

  it('misses cleanly like a normal attack, dealing no damage', () => {
    const isilwen = createAdventurer('isilwen', template(), 'front');
    const evasiveEnemy = createAdventurer('enemy', template({ maxHp: 100, evasion: 200 }), 'front');
    const battle = createBattleState([isilwen], [evasiveEnemy]);

    const outcome = CardThrowAction.resolve({ actor: isilwen, target: evasiveEnemy, battle, rng: () => 0.5 });
    expect(outcome).toEqual({ type: 'attack', damage: 0, hit: false, targetId: 'enemy' });
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
