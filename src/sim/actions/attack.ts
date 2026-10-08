import type { Action, ActionContext, ActionId, ActionOutcome, TargetingContext } from '../action';
import { selectFirstEnemy, selectLowestHpEnemy, selectWeakestLaneFront } from './targeting';
import { getEffectiveStat } from '../stats';
import { actionLevelPercentBonus } from '../leveling';
import { RAGE_TRAIT, rageDamageBonusFraction, ENRAGE_TRAIT, ENRAGE_HP_FRACTION, ENRAGE_BONUS_FRACTION } from '../traits';
import { getOpposingRoster, getOwnRoster, getHealEnergy } from '../battle';
import { applyBuff } from '../buffs';
import { rollGold } from '../gold';
import { applyPoison, applyBurn, type StatusEffectId } from '../statusEffects';
import { POISON_DAMAGE_PER_TICK, POISON_TICKS } from '../enchantments';
import { consumeShield } from '../shields';
import { THORNS_TRAIT, THORNS_REFLECT_PERCENT, DODGE_TRAIT, DODGE_CHANCE } from '../traits';
import type { Adventurer } from '../adventurer';

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

  const hasEnrage = context.actor.traits.some((trait) => trait.id === ENRAGE_TRAIT.id);
  if (hasEnrage) {
    const effectiveMaxHp = getEffectiveStat(context.actor.maxHp, 'maxHp', context.actor.modifiers);
    if (context.actor.hp < effectiveMaxHp * ENRAGE_HP_FRACTION) power *= 1 + ENRAGE_BONUS_FRACTION;
  }

  return power;
}

/** A single rng() draw mapped from [0,1) to a [1-varianceFraction, 1+varianceFraction] multiplier — defaults to DAMAGE_VARIANCE_FRACTION, but a signature move can widen its own swing (see Isilwen's Card Throw). */
function rollDamageVariance(context: ActionContext, varianceFraction: number = DAMAGE_VARIANCE_FRACTION): number {
  return 1 + (context.rng() * 2 - 1) * varianceFraction;
}

/**
 * Whether this attack is also a critical — an independent roll (its own
 * rng() draw), since there's no hit/miss roll left to piggyback on
 * (removed when Accuracy/Evasion were cut — every attack always connects
 * now, see docs/roadmap.md's "pure auto-battler" pass).
 */
function rollIsCrit(context: ActionContext): boolean {
  const critChance = getEffectiveStat(context.actor.critChance, 'critChance', context.actor.modifiers);
  return context.rng() < critChance / 100;
}

/**
 * Every attack always connects — there's no Accuracy/Evasion hit-chance
 * roll (removed as part of the "pure auto-battler" pass; see
 * docs/roadmap.md). The one exception is Drifta's Dodge Trait
 * (DODGE_TRAIT — a genuine, rare, probabilistic negation, checked first,
 * before anything else rolls), which reports the same `hit: true,
 * damage: 0` shape as a fully-absorbed Shield or an Invulnerable target,
 * rather than resurrecting a `hit: false` branch. Past that: rolls
 * whether it's a critical (see rollIsCrit), applies random variance and
 * the crit multiplier, then Mark's vulnerability multiplier (a timed
 * positive StatModifier on a synthetic 'vulnerability' stat — see
 * actions/support.ts's MarkAction; 0 for an unmarked target, a no-op),
 * then flat armor mitigation (target's `armor` StatModifiers off a base
 * of 0 — no item grants it yet without an armor-slot piece equipped),
 * floored at MIN_DAMAGE_AFTER_ARMOR. A target with an active
 * Invulnerability window (see the Invulnerability ability type — a timed
 * buff on a synthetic 'invulnerable' stat) takes none of this at all,
 * Shield included — checked next, before Shield even gets a chance to
 * deplete. Otherwise, any active Shield (see shields.ts) absorbs from the
 * floored amount before it touches HP — unlike armor's floor, a Shield
 * can fully negate a hit, since blocking it entirely is the point of a
 * Shield. `damage` in the returned shape is the actual HP lost, post-
 * Shield (0 if a Shield fully absorbed it, or the hit was Invulnerable or
 * Dodged) — a hit always "lands" (`hit: true`) and can still deal 0
 * damage this way. If the target has the Thorns Trait (Gudrun's second
 * ability — THORNS_TRAIT), a percent of whatever final damage *did* land
 * reflects straight back onto the attacker, unmitigated by the
 * attacker's own armor/Shield — a true passive, checked here rather than
 * through the Special Action trigger pipeline (see traits.ts's
 * THORNS_TRAIT doc comment for why). `target` defaults to
 * `context.target`, but can be overridden — see resolveCleaveHits, which
 * rolls this once per row-mate rather than just context.target.
 * `varianceFraction` likewise defaults to DAMAGE_VARIANCE_FRACTION but
 * can be widened per-action.
 */
function applyAttackToTarget(
  context: ActionContext,
  damage: number,
  target: ActionContext['target'],
  varianceFraction: number = DAMAGE_VARIANCE_FRACTION,
): { damage: number; hit: boolean; targetId: string } {
  const hasDodge = target.traits.some((trait) => trait.id === DODGE_TRAIT.id);
  if (hasDodge && context.rng() < DODGE_CHANCE) {
    return { damage: 0, hit: true, targetId: target.id };
  }

  const critMultiplier = rollIsCrit(context) ? CRIT_DAMAGE_MULTIPLIER : 1;
  const vulnerabilityPercent = getEffectiveStat(0, 'vulnerability', target.modifiers);
  const variedDamage = damage * rollDamageVariance(context, varianceFraction) * critMultiplier * (1 + vulnerabilityPercent / 100);
  const armor = getEffectiveStat(0, 'armor', target.modifiers);
  const damageAfterArmor = Math.max(MIN_DAMAGE_AFTER_ARMOR, Math.round(variedDamage - armor));

  const isInvulnerable = getEffectiveStat(0, 'invulnerable', target.modifiers) > 0;
  if (isInvulnerable) {
    return { damage: 0, hit: true, targetId: target.id };
  }

  const absorbedByShield = consumeShield(target, damageAfterArmor);
  const finalDamage = damageAfterArmor - absorbedByShield;

  target.hp = Math.max(0, target.hp - finalDamage);

  const hasThorns = target.traits.some((trait) => trait.id === THORNS_TRAIT.id);
  if (hasThorns && finalDamage > 0) {
    const reflected = Math.round(finalDamage * (THORNS_REFLECT_PERCENT / 100));
    context.actor.hp = Math.max(0, context.actor.hp - reflected);
  }

  return { damage: finalDamage, hit: true, targetId: target.id };
}

function applyAttack(context: ActionContext, damage: number): ActionOutcome {
  return { type: 'attack', ...applyAttackToTarget(context, damage, context.target) };
}

/** Picks up to `count` distinct living units from `pool` uniformly at random, without replacement — shared by ChainStrikeAction/ScatterShotAction. Never mutates `pool`. */
function pickRandomDistinct(pool: Adventurer[], count: number, rng: ActionContext['rng']): Adventurer[] {
  const remaining = [...pool];
  const picked: Adventurer[] = [];
  // Fixed up front — `remaining.length` shrinks every iteration (via splice below), so re-evaluating
  // `Math.min` in the loop condition itself would cut the loop short after roughly half the intended picks.
  const targetCount = Math.min(count, remaining.length);
  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(rng() * remaining.length);
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return picked;
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
      (unit) => unit.hp > 0 && unit.position.rank === context.target.position.rank,
    );
    const hits = rowMates.map((rowMate) => applyAttackToTarget(context, damage, rowMate));
    return { type: 'attack-multi', hits };
  },
};

/** Percent extra damage Fear's debuff causes its targets to take — placeholder pending the balance pass. */
export const FEAR_VULNERABILITY_PERCENT = 20;
/** How many of the feared unit's own turns Fear lasts before expiring — same cadence as Rallying Strike/Empower. */
export const FEAR_DURATION_TURNS = 3;
const FEAR_BUFF_ID = 'fear-vulnerability';

/**
 * Mirka's signature mechanic (roadmap item 11): a pure debuff face, no
 * attack of her own — applies a timed positive StatModifier on the
 * synthetic 'vulnerability' stat (the Mark ability type — see
 * actions/support.ts's MarkAction) to every living enemy in her target's
 * row at once (same row-selection rule as Cleave), reusing buffs.ts's
 * timed-modifier system. Reframed from its original "lowers accuracy"
 * flavor (rattled enemies are worse at hitting back) to "takes more
 * damage" (rattled enemies are easier for the party to finish off) when
 * the "pure auto-battler" pass removed Accuracy/Evasion as a mechanic to
 * key off of — see docs/roadmap.md.
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
      (unit) => unit.hp > 0 && unit.position.rank === context.target.position.rank,
    );
    for (const rowMate of rowMates) {
      applyBuff(
        rowMate,
        FEAR_BUFF_ID,
        { stat: 'vulnerability', type: 'flat', amount: FEAR_VULNERABILITY_PERCENT, source: 'buff:fear' },
        FEAR_DURATION_TURNS,
      );
    }
    return {
      type: 'fear',
      fearedEnemyIds: rowMates.map((rowMate) => rowMate.id),
      vulnerabilityAmount: FEAR_VULNERABILITY_PERCENT,
      durationTurns: FEAR_DURATION_TURNS,
    };
  },
};

/** Flat armor granted by Rallying Strike's buff — cut from 3 in the second balance pass (docs/roadmap.md): party-wide, it nearly cancelled Kobold/Grunt hits and made Glint the strongest pick by a wide margin. */
export const RALLY_ARMOR_BONUS = 2;
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
    const reachesBackRow = context.actor.position.rank === 0;
    return selectLowestHpEnemy(context, !reachesBackRow);
  },
  resolve(context: ActionContext): ActionOutcome {
    return applyAttack(context, effectiveAttackPower(context, 'piercing-strike'));
  },
};

/** HP fraction (of effective maxHp) a target must be below, before the hit, to qualify for Execute Strike's finishing blow. */
export const EXECUTE_THRESHOLD_FRACTION = 0.3;

/**
 * Drifta's second signature mechanic (the Execute ability type from
 * docs/missing-ability-types.md): a normal lowest-HP-targeted melee
 * attack — but if the target was already below EXECUTE_THRESHOLD_FRACTION
 * *before* the hit (checked first, not re-checked after normal damage),
 * a landed hit finishes them off entirely, regardless of what the
 * roll/armor/Shield would otherwise have left them at. A miss never
 * executes (same "a miss costs the turn, nothing else happens" rule as
 * every other attack), and a target already above the threshold just
 * takes a normal attack's worth of damage like AttackLowestHpAction would.
 */
export const ExecuteStrikeAction: Action = {
  id: 'execute-strike',
  name: 'Execute Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectLowestHpEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const effectiveMaxHp = getEffectiveStat(context.target.maxHp, 'maxHp', context.target.modifiers);
    const qualifiesForExecute = context.target.hp / effectiveMaxHp < EXECUTE_THRESHOLD_FRACTION;
    const hpBeforeHit = context.target.hp;

    const damage = effectiveAttackPower(context, 'execute-strike');
    const attackHit = applyAttackToTarget(context, damage, context.target);

    // Invulnerability blocks the finishing blow too — "takes zero damage" means zero, no exceptions.
    const isInvulnerable = getEffectiveStat(0, 'invulnerable', context.target.modifiers) > 0;
    let executed = false;
    let totalDamage = attackHit.damage;
    if (attackHit.hit && qualifiesForExecute && !isInvulnerable && context.target.hp > 0) {
      context.target.hp = 0;
      executed = true;
      totalDamage = hpBeforeHit;
    }

    return { type: 'attack-with-execute', damage: totalDamage, hit: attackHit.hit, targetId: attackHit.targetId, executed };
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
    const goldGenerated = attackHit.damage > 0
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

/** How many additional targets Chain Strike bounces to beyond the primary, and what percent of normal damage each bounce deals — placeholders pending the balance pass. */
export const CHAIN_BOUNCE_COUNT = 2;
export const CHAIN_BOUNCE_DAMAGE_PERCENT = 60;

/**
 * Nerissa's second signature mechanic (the Chain ability type from
 * docs/missing-ability-types.md): a ranged attack on her normal target at
 * full damage, plus up to CHAIN_BOUNCE_COUNT additional distinct living
 * enemies (picked uniformly at random, no row restriction) each hit
 * independently for CHAIN_BOUNCE_DAMAGE_PERCENT of normal damage — each
 * bounce rolls its own hit/miss/armor/Shield exactly like a normal attack,
 * via applyAttackToTarget. Fewer bounces land if there aren't enough other
 * living enemies to reach — never pads with duplicates.
 */
export const ChainStrikeAction: Action = {
  id: 'chain-strike',
  name: 'Chain Strike',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'chain-strike');
    const primaryHit = applyAttackToTarget(context, damage, context.target);

    const others = getOpposingRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.id !== context.target.id,
    );
    const bounceTargets = pickRandomDistinct(others, CHAIN_BOUNCE_COUNT, context.rng);
    const bounceDamage = damage * (CHAIN_BOUNCE_DAMAGE_PERCENT / 100);
    const bounceHits = bounceTargets.map((target) => applyAttackToTarget(context, bounceDamage, target));

    return { type: 'attack-multi', hits: [primaryHit, ...bounceHits] };
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
 * (Blind) to the same target, but only if the bolt actually dealt damage
 * — a target that fully blocked it (Shield, Invulnerability, Dodge)
 * blinds nobody, same reasoning as turnEngine.ts's landedHitTargetIds.
 * Reuses buffs.ts's timed-modifier system with a negative percent amount,
 * same convention as Empower (a positive version of the same mechanism).
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
    const dealtDamage = attackHit.damage > 0;

    if (dealtDamage) {
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
      debuffApplied: dealtDamage,
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
      (unit) => unit.hp > 0 && unit.position.rank === 2,
    );
    const sneaksPastFrontRow = livingBackRow.length > 0 && context.rng() < SNEAK_STRIKE_BACK_ROW_CHANCE;
    const target = sneaksPastFrontRow ? livingBackRow[Math.floor(context.rng() * livingBackRow.length)] : context.target;

    return applyAttack({ ...context, target }, damage);
  },
};

/**
 * Caladwen's restored signature flavor (roadmap: "do existing characters
 * have the abilities they need?" pass) — a per-face Poison enchant used to
 * live on one of her Sneak Strike die faces, lost when per-face
 * enchantments were retired (step 2 of the combat overhaul) and never
 * ported to anything in the new system. This is that mechanism's
 * replacement: a Special Action that poisons whichever living enemy its
 * own targeting picks, same "independent targeting, not necessarily the
 * exact unit the triggering hit landed on" convention already established
 * by Ring of Embers' Ember Burn (see actions/itemEffects.ts). Same
 * POISON_DAMAGE_PER_TICK/POISON_TICKS magnitude the old enchantment used
 * (see enchantments.ts) — a deliberate restoration, not a retune.
 */
export const VenomStingAction: Action = {
  id: 'venom-sting',
  name: 'Venom Sting',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyPoison(context.target, POISON_DAMAGE_PER_TICK, POISON_TICKS);
    return { type: 'inflict-status', targetId: context.target.id, effectId: 'poison' };
  },
};

/** Percent of damage dealt Lifesteal Strike heals the attacker for — placeholder pending the balance pass. */
export const LIFESTEAL_PERCENT = 50;

/**
 * Caladwen's second signature mechanic (the Lifesteal ability type from
 * docs/missing-ability-types.md): a normal front-row melee attack that
 * also heals the attacker for LIFESTEAL_PERCENT of the damage actually
 * dealt — 0 on a miss, and 0 if a Shield fully absorbed the hit (damage
 * dealt was 0), since there's nothing to steal from either. The heal is
 * clamped to the attacker's own effective maxHp, same as any other heal.
 */
export const LifestealStrikeAction: Action = {
  id: 'lifesteal-strike',
  name: 'Lifesteal Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'lifesteal-strike');
    const attackHit = applyAttackToTarget(context, damage, context.target);

    let healedAmount = 0;
    if (attackHit.damage > 0) {
      const effectiveMaxHp = getEffectiveStat(context.actor.maxHp, 'maxHp', context.actor.modifiers);
      healedAmount = Math.round(attackHit.damage * (LIFESTEAL_PERCENT / 100));
      context.actor.hp = Math.min(effectiveMaxHp, context.actor.hp + healedAmount);
    }

    return { type: 'attack-and-heal-self', ...attackHit, healedAmount };
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

/** How many living enemies Scatter Shot hits at once — placeholder pending the balance pass. */
export const SCATTER_SHOT_TARGET_COUNT = 2;

/**
 * Melpomene's second signature mechanic (the AoE-beyond-rank ability type
 * from docs/missing-ability-types.md): hits SCATTER_SHOT_TARGET_COUNT
 * distinct living enemies at once, picked uniformly at random from the
 * whole opposing roster — no row restriction, and unlike Cleave (which is
 * rank-scoped), each hit lands at full normal damage, not a reduced
 * falloff. Fewer hits land if there aren't enough living enemies to reach.
 */
export const ScatterShotAction: Action = {
  id: 'scatter-shot',
  name: 'Scatter Shot',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'scatter-shot');
    const livingEnemies = getOpposingRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    const targets = pickRandomDistinct(livingEnemies, SCATTER_SHOT_TARGET_COUNT, context.rng);
    const hits = targets.map((target) => applyAttackToTarget(context, damage, target));

    return { type: 'attack-multi', hits };
  },
};

/** How many distinct enemies Volley hits — one more than Scatter Shot. */
export const VOLLEY_TARGET_COUNT = 3;

/**
 * Melpomene's unlock Special (the unlock content pass — a deliberately
 * slightly stronger Scatter Shot, since she trailed the field): full damage
 * to VOLLEY_TARGET_COUNT distinct random living enemies, any rank.
 */
export const VolleyAction: Action = {
  id: 'volley',
  name: 'Volley',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'volley');
    const livingEnemies = getOpposingRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    const hits = pickRandomDistinct(livingEnemies, VOLLEY_TARGET_COUNT, context.rng).map((target) =>
      applyAttackToTarget(context, damage, target),
    );
    return { type: 'attack-multi', hits };
  },
};

// --- Enemy variety pass (docs/roadmap.md item 7): enemy-only attacks ---

/**
 * Goblin Flanker's Basic Action: a melee hit that isn't bound to its own
 * lane — it goes for the front of whichever party lane is weakest (lowest
 * total HP), so a thin lane gets punished even if nobody stands in front of
 * the Flanker. Still can't reach past a lane's front unit (see
 * targeting.ts's selectWeakestLaneFront).
 */
export const FlankStrikeAction: Action = {
  id: 'flank-strike',
  name: 'Flank Strike',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectWeakestLaneFront(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    const damage = effectiveAttackPower(context, 'flank-strike');
    return { type: 'attack', ...applyAttackToTarget(context, damage, context.target) };
  },
};

/** Damage-over-time magnitudes the enemy status attacks apply — placeholders tuned by the balance sim. */
export const VENOM_SPIT_POISON_PER_TICK = 2;
export const VENOM_SPIT_POISON_TICKS = 3;
export const SEARING_TOUCH_BURN_PER_TICK = 2;
export const SEARING_TOUCH_BURN_TICKS = 2;

/** Shared by Venom Spit/Searing Touch: a normal attack that also applies a status effect if any damage got through. */
function resolveAttackAndStatus(
  context: ActionContext,
  actionId: ActionId,
  effectId: StatusEffectId,
  damagePerTick: number,
  ticks: number,
): ActionOutcome {
  const damage = effectiveAttackPower(context, actionId);
  const attackHit = applyAttackToTarget(context, damage, context.target);
  const statusApplied = attackHit.damage > 0 && context.target.hp > 0;
  if (statusApplied) {
    if (effectId === 'poison') applyPoison(context.target, damagePerTick, ticks);
    else applyBurn(context.target, damagePerTick, ticks);
  }
  return { type: 'attack-and-status', ...attackHit, effectId, statusApplied };
}

/**
 * Venom Spitter's Basic Action: a ranged hit on the weakest reachable party
 * member (ranged — ignores lanes and ranks) that also poisons them, so a
 * back-row healer isn't automatically safe from it.
 */
export const VenomSpitAction: Action = {
  id: 'venom-spit',
  name: 'Venom Spit',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectLowestHpEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    return resolveAttackAndStatus(context, 'venom-spit', 'poison', VENOM_SPIT_POISON_PER_TICK, VENOM_SPIT_POISON_TICKS);
  },
};

/** Ember Imp's Basic Action: a melee hit (lane rules apply) that also sets the target on fire. */
export const SearingTouchAction: Action = {
  id: 'searing-touch',
  name: 'Searing Touch',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    return resolveAttackAndStatus(context, 'searing-touch', 'burn', SEARING_TOUCH_BURN_PER_TICK, SEARING_TOUCH_BURN_TICKS);
  },
};

