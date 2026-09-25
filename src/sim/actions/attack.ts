import type { Action, ActionContext, ActionId, ActionOutcome, TargetingContext } from '../action';
import { selectFirstEnemy, selectLowestHpEnemy } from './targeting';
import { getEffectiveStat } from '../stats';
import { actionLevelPercentBonus } from '../leveling';
import { RAGE_TRAIT, rageDamageBonusFraction } from '../traits';
import { getOpposingRoster, getOwnRoster, getHealEnergy } from '../battle';
import { applyBuff } from '../buffs';
import { rollGold } from '../gold';

/**
 * Hit-chance floor/ceiling — an attack is never a guaranteed hit or a
 * guaranteed miss, regardless of how lopsided accuracy vs. evasion gets.
 * Placeholder pending the balance pass (roadmap item 6).
 */
export const MIN_HIT_CHANCE = 0.05;
export const MAX_HIT_CHANCE = 0.95;
/** Random multiplier range applied to a landed hit's damage — e.g. 0.15 draws uniformly from [0.85, 1.15]. Placeholder pending the balance pass. */
export const DAMAGE_VARIANCE_FRACTION = 0.15;
/** A landed hit always deals at least this much damage, so armor can never fully negate an attack that connects. */
export const MIN_DAMAGE_AFTER_ARMOR = 1;
/** Damage multiplier a critical hit applies, on top of normal variance. Placeholder pending the balance pass. */
export const CRIT_DAMAGE_MULTIPLIER = 2;

/**
 * Runs the actor's attackPower through getEffectiveStat so weapon/trinket
 * StatModifiers actually affect damage, then applies actionId's own
 * action-level percent bonus on top (see leveling.ts), then RAGE_TRAIT's
 * missing-HP damage bonus if the actor has it (see traits.ts) — applies to
 * every attack action alike, not just one signature move.
 */
function effectiveAttackPower(context: ActionContext, actionId: ActionId): number {
  const base = getEffectiveStat(context.actor.attackPower, 'attackPower', context.actor.modifiers);
  const levelBonusPercent = actionLevelPercentBonus(context.actor, actionId);
  let power = base * (1 + levelBonusPercent / 100);

  const hasRage = context.actor.traits.some((trait) => trait.id === RAGE_TRAIT.id);
  if (hasRage) {
    const effectiveMaxHp = getEffectiveStat(context.actor.maxHp, 'maxHp', context.actor.modifiers);
    power *= 1 + rageDamageBonusFraction(context.actor.hp, effectiveMaxHp);
  }

  return power;
}

/** Attacker's accuracy minus target's evasion (both run through StatModifiers), clamped to [MIN_HIT_CHANCE, MAX_HIT_CHANCE]. */
function hitChance(context: ActionContext): number {
  const accuracy = getEffectiveStat(context.actor.accuracy, 'accuracy', context.actor.modifiers);
  const evasion = getEffectiveStat(context.target.evasion, 'evasion', context.target.modifiers);
  return Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, (accuracy - evasion) / 100));
}

/** A single rng() draw mapped from [0,1) to a [1-varianceFraction, 1+varianceFraction] multiplier — defaults to DAMAGE_VARIANCE_FRACTION, but a signature move can widen its own swing (see Isilwen's Card Throw). */
function rollDamageVariance(context: ActionContext, varianceFraction: number = DAMAGE_VARIANCE_FRACTION): number {
  return 1 + (context.rng() * 2 - 1) * varianceFraction;
}

/**
 * Whether a landed hit is also a critical — reuses `hitRoll` (the same
 * draw already spent on the hit/miss check) rather than consuming a fresh
 * rng() call of its own (roadmap item 11's Tharavel). Deliberate
 * simplification: critChance is normally much smaller than hitChance, so
 * this approximates an independent roll closely enough for a placeholder
 * system (P(crit | hit) ≈ critChance/hitChance) while avoiding a second
 * draw on every single attack in the game — which would have shifted the
 * rng-sequence position of every other roll (variance, gold, enchantment
 * chances, ...) in every existing action and test.
 */
function rollIsCrit(context: ActionContext, hitRoll: number): boolean {
  const critChance = getEffectiveStat(context.actor.critChance, 'critChance', context.actor.modifiers);
  return hitRoll < critChance / 100;
}

/**
 * Rolls hit/miss against hitChance first — a miss still costs the actor's
 * turn (it doesn't get to try again this turn). A landed hit rolls whether
 * it's also a critical (see rollIsCrit), applies random variance and the
 * crit multiplier if applicable, then flat armor mitigation
 * (target's `armor` StatModifiers off a base of 0 — no item grants it yet
 * without an armor-slot piece equipped), floored at MIN_DAMAGE_AFTER_ARMOR.
 * `target` defaults to `context.target`, but can be overridden — see
 * resolveCleaveHits, which rolls this once per row-mate rather than just
 * context.target. `varianceFraction` likewise defaults to
 * DAMAGE_VARIANCE_FRACTION but can be widened per-action.
 */
function applyAttackToTarget(
  context: ActionContext,
  damage: number,
  target: ActionContext['target'],
  varianceFraction: number = DAMAGE_VARIANCE_FRACTION,
): { damage: number; hit: boolean; targetId: string } {
  const hitRoll = context.rng();
  if (hitRoll >= hitChance({ ...context, target })) {
    return { damage: 0, hit: false, targetId: target.id };
  }

  const critMultiplier = rollIsCrit(context, hitRoll) ? CRIT_DAMAGE_MULTIPLIER : 1;
  const variedDamage = damage * rollDamageVariance(context, varianceFraction) * critMultiplier;
  const armor = getEffectiveStat(0, 'armor', target.modifiers);
  const finalDamage = Math.max(MIN_DAMAGE_AFTER_ARMOR, Math.round(variedDamage - armor));

  target.hp = Math.max(0, target.hp - finalDamage);
  return { damage: finalDamage, hit: true, targetId: target.id };
}

function applyAttack(context: ActionContext, damage: number): ActionOutcome {
  return { type: 'attack', ...applyAttackToTarget(context, damage, context.target) };
}

/** Cheap, fast melee attack — front row only, falling through to back once front is empty. */
export const AttackNearestAction: Action = {
  id: 'attack-nearest',
  name: 'Attack (Front)',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext) {
    return applyAttack(context, effectiveAttackPower(context, 'attack-nearest'));
  },
};

/** Cheap, fast melee attack finishing off the weakest reachable enemy. */
export const AttackLowestHpAction: Action = {
  id: 'attack-lowest-hp',
  name: 'Attack (Lowest HP)',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectLowestHpEnemy(context, true);
  },
  resolve(context: ActionContext) {
    return applyAttack(context, effectiveAttackPower(context, 'attack-lowest-hp'));
  },
};

/**
 * Hard-hitting melee attack on the weakest reachable enemy — same targeting
 * rule as AttackLowestHpAction, but double the damage. Fires whenever its
 * die face comes up, same as any other action; a unit's mix of faces (see
 * data/characters.ts) is what controls how often it lands versus a cheaper
 * attack.
 */
export const PowerAttackAction: Action = {
  id: 'power-attack',
  name: 'Power Attack',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectLowestHpEnemy(context, true);
  },
  resolve(context: ActionContext) {
    return applyAttack(context, effectiveAttackPower(context, 'power-attack') * 2);
  },
};

/**
 * Bodil's signature mechanic (roadmap item 11): hits every living opponent
 * in the same row as her normal melee target (front row, or back row once
 * front is wiped — same reach rule as AttackNearestAction), each for full
 * effectiveAttackPower rather than a split/reduced share. Each row-mate
 * rolls its own independent hit/variance/armor check via
 * applyAttackToTarget, exactly like a normal single-target attack would
 * against them.
 */
export const CleaveAction: Action = {
  id: 'cleave',
  name: 'Cleave',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'cleave');
    const rowMates = getOpposingRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.row === context.target.row,
    );
    const hits = rowMates.map((rowMate) => applyAttackToTarget(context, damage, rowMate));
    return { type: 'attack-multi', hits };
  },
};

/** Flat accuracy penalty Fear applies — negative, since it's a debuff. Placeholder pending the balance pass. */
export const FEAR_ACCURACY_PENALTY = -20;
/** How many of the feared unit's own turns Fear lasts before expiring — same cadence as Rallying Strike/Empower. */
export const FEAR_DURATION_TURNS = 3;
const FEAR_BUFF_ID = 'fear-accuracy';

/**
 * Mirka's signature mechanic (roadmap item 11): a pure debuff face, no
 * attack of her own — applies a timed negative-accuracy StatModifier to
 * every living enemy in her target's row at once (same row-selection rule
 * as Cleave), reusing buffs.ts's timed-modifier system with a negative
 * amount rather than inventing a separate debuff mechanism.
 */
export const FearAction: Action = {
  id: 'fear',
  name: 'Fear',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const rowMates = getOpposingRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.row === context.target.row,
    );
    for (const rowMate of rowMates) {
      applyBuff(
        rowMate,
        FEAR_BUFF_ID,
        { stat: 'accuracy', type: 'flat', amount: FEAR_ACCURACY_PENALTY, source: 'buff:fear' },
        FEAR_DURATION_TURNS,
      );
    }
    return {
      type: 'fear',
      fearedEnemyIds: rowMates.map((rowMate) => rowMate.id),
      accuracyAmount: FEAR_ACCURACY_PENALTY,
      durationTurns: FEAR_DURATION_TURNS,
    };
  },
};

/** Flat armor granted by Rallying Strike's buff — placeholder pending the balance pass, same as every other combat number. */
export const RALLY_ARMOR_BONUS = 3;
/** How many of the buffed unit's own turns the Rallying Strike armor buff lasts before expiring. */
export const RALLY_BUFF_DURATION_TURNS = 3;
const RALLY_BUFF_ID = 'rallying-strike-armor';

/**
 * Glint's signature mechanic (roadmap item 11): a normal melee hit on her
 * usual target, plus a timed armor buff (RALLY_ARMOR_BONUS for
 * RALLY_BUFF_DURATION_TURNS turns) granted to every living ally at once,
 * herself included — see buffs.ts. The buff refreshes (not stacks) if
 * re-cast before it expires, same convention as the Burning enchantment.
 */
export const RallyingStrikeAction: Action = {
  id: 'rallying-strike',
  name: 'Rallying Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'rallying-strike');
    const attackHit = applyAttackToTarget(context, damage, context.target);

    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    for (const ally of allies) {
      applyBuff(
        ally,
        RALLY_BUFF_ID,
        { stat: 'armor', type: 'flat', amount: RALLY_ARMOR_BONUS, source: 'buff:rallying-strike' },
        RALLY_BUFF_DURATION_TURNS,
      );
    }

    return {
      type: 'attack-and-buff',
      ...attackHit,
      buffedAllyIds: allies.map((ally) => ally.id),
      armorAmount: RALLY_ARMOR_BONUS,
      durationTurns: RALLY_BUFF_DURATION_TURNS,
    };
  },
};

/**
 * Drifta's signature mechanic (roadmap item 11): while she herself is in
 * the front row, reaches every living enemy (front or back) and finishes
 * off the lowest-HP one — a live check of `context.actor.row`, not a
 * permanent trait, so moving her to the back row via Formation turns it
 * off. From the back row she falls back to a normal front-row-restricted
 * lowest-HP melee attack (same targeting as AttackLowestHpAction), so the
 * face is never invalid — it just loses its special reach.
 */
export const PiercingStrikeAction: Action = {
  id: 'piercing-strike',
  name: 'Piercing Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    const reachesBackRow = context.actor.row === 'front';
    return selectLowestHpEnemy(context, !reachesBackRow);
  },
  resolve(context: ActionContext): ActionOutcome {
    return applyAttack(context, effectiveAttackPower(context, 'piercing-strike'));
  },
};

/** Gold-drop config for Pickpocket Strike's on-hit bonus gold — same rollGold mechanism enemies' own loot tables use. Placeholder pending the balance pass. */
export const PICKPOCKET_GOLD_CHANCE = 0.6;
export const PICKPOCKET_GOLD_MIN = 1;
export const PICKPOCKET_GOLD_MAX = 4;

/**
 * Nerissa's first signature mechanic (roadmap item 11): a normal
 * single-target attack that also rolls bonus gold on a landed hit (never
 * on a miss), via the same rollGold(table, rng) mechanism an enemy's own
 * loot table uses. The gold is real — it's banked into the run's total at
 * room-end (see gold.ts's sumGeneratedGold) regardless of how the room
 * ends, not just on a win.
 */
export const PickpocketStrikeAction: Action = {
  id: 'pickpocket-strike',
  name: 'Pickpocket Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'pickpocket-strike');
    const attackHit = applyAttackToTarget(context, damage, context.target);
    const goldGenerated = attackHit.hit
      ? rollGold({ chance: PICKPOCKET_GOLD_CHANCE, min: PICKPOCKET_GOLD_MIN, max: PICKPOCKET_GOLD_MAX }, context.rng)
      : 0;

    return { type: 'attack-and-gold', ...attackHit, goldGenerated };
  },
};

/** Percent damage bonus Gilded Strike grants per gold the party has, and the cap on that bonus — placeholders pending the balance pass. */
export const GOLD_SCALING_PERCENT_PER_GOLD = 0.5;
export const GOLD_SCALING_MAX_PERCENT = 100;

/**
 * Nerissa's second signature mechanic (roadmap item 11): a normal
 * single-target attack whose damage scales up with `context.battle.partyGold`
 * (the town's banked gold, snapshotted once at run start — see
 * battle.ts's BattleState.partyGold doc comment for why it's a fixed
 * snapshot rather than live-updated), capped at GOLD_SCALING_MAX_PERCENT
 * so an extremely wealthy town doesn't produce absurd damage.
 */
export const GildedStrikeAction: Action = {
  id: 'gilded-strike',
  name: 'Gilded Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const base = effectiveAttackPower(context, 'gilded-strike');
    const goldBonusPercent = Math.min(GOLD_SCALING_MAX_PERCENT, context.battle.partyGold * GOLD_SCALING_PERCENT_PER_GOLD);
    const damage = base * (1 + goldBonusPercent / 100);
    return applyAttack(context, damage);
  },
};

/** Ranged attack — can reach either row directly, unlike a melee action's front-row restriction. */
export const RangedShotAction: Action = {
  id: 'ranged-shot',
  name: 'Ranged Shot',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext) {
    return applyAttack(context, effectiveAttackPower(context, 'ranged-shot'));
  },
};

/** Percent attackPower penalty Blind applies, and how many of the blinded unit's own turns it lasts — placeholders pending the balance pass. */
export const BLIND_ATTACK_PERCENT_PENALTY = -30;
export const BLIND_DURATION_TURNS = 3;
const BLIND_BUFF_ID = 'blind-attack-power';

/**
 * Dravena's signature mechanic (roadmap item 11): a ranged single-target
 * attack that also applies a timed negative-attackPower StatModifier
 * (Blind) to the same target, but only on a landed hit — a miss deals no
 * damage and blinds nobody. Reuses buffs.ts's timed-modifier system with a
 * negative percent amount, same convention as Fear (accuracy) and Empower
 * (a positive version of the same mechanism).
 */
export const BlindingBoltAction: Action = {
  id: 'blinding-bolt',
  name: 'Blinding Bolt',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'blinding-bolt');
    const attackHit = applyAttackToTarget(context, damage, context.target);

    if (attackHit.hit) {
      applyBuff(
        context.target,
        BLIND_BUFF_ID,
        { stat: 'attackPower', type: 'percent', amount: BLIND_ATTACK_PERCENT_PENALTY, source: 'buff:blind' },
        BLIND_DURATION_TURNS,
      );
    }

    return {
      type: 'attack-and-debuff',
      ...attackHit,
      debuffApplied: attackHit.hit,
      attackPowerPercent: BLIND_ATTACK_PERCENT_PENALTY,
      durationTurns: BLIND_DURATION_TURNS,
    };
  },
};

/** Much wider damage swing than a normal attack's ±DAMAGE_VARIANCE_FRACTION — the "chaotic" half of Card Throw. Placeholder pending the balance pass. */
export const CARD_THROW_VARIANCE_FRACTION = 0.5;

/**
 * Isilwen's signature mechanic (roadmap item 11): a ranged attack against a
 * uniformly random living enemy (front or back row alike — no melee
 * front-row-first bias) with a much wider damage swing than normal. The
 * random pick happens in `resolve`, not `selectTarget`: TargetingContext
 * has no rng source, so `selectTarget` can only gate validity (falls back
 * to the same "first living enemy" rule every ranged action uses); the
 * actual target is re-rolled uniformly here, where `context.rng` exists —
 * same pattern as Fallacy's Command re-picking who it commands.
 */
export const CardThrowAction: Action = {
  id: 'card-throw',
  name: 'Card Throw',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const livingEnemies = getOpposingRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    const target = livingEnemies[Math.floor(context.rng() * livingEnemies.length)];
    const damage = effectiveAttackPower(context, 'card-throw');

    return { type: 'attack', ...applyAttackToTarget(context, damage, target, CARD_THROW_VARIANCE_FRACTION) };
  },
};

/** Percent damage bonus Mourning Strike grants per point of Mending Charge energy, and the cap on that bonus — placeholders pending the balance pass. */
export const MOURNING_STRIKE_PERCENT_PER_ENERGY = 15;
export const MOURNING_STRIKE_MAX_PERCENT = 100;

/**
 * Dawneth's second signature mechanic (roadmap item 11): a ranged
 * single-target attack whose damage scales up with however much Mending
 * Charge energy she currently has (see battle.ts's healEnergyByUnitId) —
 * continuous scaling, never consumed, same shape as Nerissa's Gilded
 * Strike but reading her own built-up energy instead of the party's gold.
 * Capped at MOURNING_STRIKE_MAX_PERCENT so a very long room doesn't
 * produce absurd damage.
 */
export const MourningStrikeAction: Action = {
  id: 'mourning-strike',
  name: 'Mourning Strike',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const base = effectiveAttackPower(context, 'mourning-strike');
    const energy = getHealEnergy(context.battle, context.actor.id);
    const energyBonusPercent = Math.min(MOURNING_STRIKE_MAX_PERCENT, energy * MOURNING_STRIKE_PERCENT_PER_ENERGY);
    const damage = base * (1 + energyBonusPercent / 100);
    return applyAttack(context, damage);
  },
};

/** Chance Sneak Strike bypasses the front row entirely to hit a random living back-row enemy instead of her normal melee target — the "sometimes" in "can sometimes target the back row." Placeholder pending the balance pass. */
export const SNEAK_STRIKE_BACK_ROW_CHANCE = 0.35;

/**
 * Caladwen's signature mechanic (roadmap item 3): a quick melee attack that
 * usually behaves like a normal front-row strike, but has a chance to slip
 * past the front line and hit a random living back-row enemy directly
 * instead. The random pick (and whether it happens at all) is rolled here
 * in `resolve`, not `selectTarget` — TargetingContext has no rng source,
 * same reasoning as Isilwen's Card Throw. Falls back to the normal melee
 * target when there's no back row to sneak into, so the face is never
 * wasted.
 */
export const SneakStrikeAction: Action = {
  id: 'sneak-strike',
  name: 'Sneak Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'sneak-strike');
    const livingBackRow = getOpposingRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.row === 'back',
    );
    const sneaksPastFrontRow = livingBackRow.length > 0 && context.rng() < SNEAK_STRIKE_BACK_ROW_CHANCE;
    const target = sneaksPastFrontRow ? livingBackRow[Math.floor(context.rng() * livingBackRow.length)] : context.target;

    return applyAttack({ ...context, target }, damage);
  },
};

/**
 * Melpomene's signature mechanic (roadmap item 3): a ranged execute —
 * reaches either row directly like Ranged Shot, but targets the lowest-HP
 * living enemy instead of the nearest one, at plain (unmultiplied)
 * attackPower same as AttackLowestHpAction's melee version, not a
 * PowerAttack-style bonus — the "lower-damage" in "lower-damage targeted
 * attacks" is what lets her focus-fire from range without also hitting
 * harder than a front-line bruiser's execute.
 */
export const FocusedShotAction: Action = {
  id: 'focused-shot',
  name: 'Focused Shot',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectLowestHpEnemy(context, false);
  },
  resolve(context: ActionContext) {
    return applyAttack(context, effectiveAttackPower(context, 'focused-shot'));
  },
};
