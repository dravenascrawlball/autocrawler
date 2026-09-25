import type { Action, ActionContext, ActionOutcome, TargetingContext } from '../action';
import { getOwnRoster, getOpposingRoster } from '../battle';
import { applyBuff } from '../buffs';
import { selectHighestAttackPowerAlly, selectFirstEnemy } from './targeting';
import { AttackNearestAction } from './attack';

/** Percent attackPower bonus Empower grants — placeholder pending the balance pass, same as every other combat number. */
export const EMPOWER_ATTACK_PERCENT_BONUS = 25;
/** How many of the buffed ally's own turns Empower's buff lasts before expiring — same cadence as Glint's Rallying Strike. */
export const EMPOWER_BUFF_DURATION_TURNS = 3;
const EMPOWER_BUFF_ID = 'empower-attack';

/**
 * Fallacy's first signature mechanic (roadmap item 11): no attack of her
 * own — the whole face is spent granting a timed attackPower buff to
 * whichever living ally (herself included) currently hits hardest, so the
 * boost lands on whoever benefits most from it rather than a fixed or
 * random pick.
 */
export const EmpowerAction: Action = {
  id: 'empower',
  name: 'Empower',
  reach: 'melee', // unused — Empower targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectHighestAttackPowerAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(
      context.target,
      EMPOWER_BUFF_ID,
      { stat: 'attackPower', type: 'percent', amount: EMPOWER_ATTACK_PERCENT_BONUS, source: 'buff:empower' },
      EMPOWER_BUFF_DURATION_TURNS,
    );
    return {
      type: 'support-buff',
      targetId: context.target.id,
      stat: 'attackPower',
      amount: EMPOWER_ATTACK_PERCENT_BONUS,
      durationTurns: EMPOWER_BUFF_DURATION_TURNS,
    };
  },
};

/**
 * Fallacy's second signature mechanic (roadmap item 11): grants a random
 * living ally (never herself) a genuine bonus attack right now — they
 * still take their own normal turn later in the round unaffected, this is
 * a real extra action, not a redirect. The commanded ally attacks exactly
 * like AttackNearestAction would for them (their own attackPower/accuracy,
 * normal melee targeting) — reused directly rather than reimplemented.
 * `selectTarget` only gates on "is there anyone to command" (deterministic,
 * no rng available there); the actual random pick happens in `resolve`,
 * which does have `context.rng`.
 */
export const CommandAction: Action = {
  id: 'command',
  name: 'Command',
  reach: 'melee', // unused — Command targets an ally, never the opposing roster directly
  selectTarget(context: TargetingContext) {
    const commandableAllies = getOwnRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.id !== context.actor.id,
    );
    return commandableAllies[0] ?? null;
  },
  resolve(context: ActionContext): ActionOutcome {
    const commandableAllies = getOwnRoster(context.battle, context.actor).filter(
      (unit) => unit.hp > 0 && unit.id !== context.actor.id,
    );
    const commandedAlly = commandableAllies[Math.floor(context.rng() * commandableAllies.length)];

    const enemyTarget = AttackNearestAction.selectTarget({ actor: commandedAlly, battle: context.battle });
    if (!enemyTarget) {
      return { type: 'command', commandedAllyId: commandedAlly.id, attackOutcome: null };
    }

    const outcome = AttackNearestAction.resolve({
      actor: commandedAlly,
      target: enemyTarget,
      rng: context.rng,
      battle: context.battle,
    });
    // AttackNearestAction always resolves to a plain 'attack' outcome — narrowed here for the
    // 'command' outcome's own attackOutcome shape.
    const attackOutcome = outcome.type === 'attack' ? { damage: outcome.damage, hit: outcome.hit, targetId: outcome.targetId } : null;

    return { type: 'command', commandedAllyId: commandedAlly.id, attackOutcome };
  },
};

/** Flat accuracy and critChance bonuses Inspire grants, and how many of each buffed ally's own turns they last — placeholders pending the balance pass. */
export const INSPIRE_ACCURACY_BONUS = 10;
export const INSPIRE_CRIT_CHANCE_BONUS = 10;
export const INSPIRE_DURATION_TURNS = 3;
const INSPIRE_ACCURACY_BUFF_ID = 'inspire-accuracy';
const INSPIRE_CRIT_BUFF_ID = 'inspire-crit';

/**
 * Tharavel's signature mechanic (roadmap item 11): no attack of her own —
 * grants every living ally at once (herself included) a timed accuracy
 * buff and a timed critChance buff, same whole-party scope as Glint's
 * Rallying Strike but with no attack half (like Fallacy's Empower's shape,
 * just party-wide instead of single-target). Two separate applyBuff calls
 * per ally since they're independent stats with independent ids — a
 * refresh of one never clobbers the other.
 */
export const InspireAction: Action = {
  id: 'inspire',
  name: 'Inspire',
  reach: 'melee', // unused — Inspire targets the whole party, never the opposing roster
  selectTarget(context: TargetingContext) {
    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    return allies[0] ?? null;
  },
  resolve(context: ActionContext): ActionOutcome {
    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    for (const ally of allies) {
      applyBuff(
        ally,
        INSPIRE_ACCURACY_BUFF_ID,
        { stat: 'accuracy', type: 'flat', amount: INSPIRE_ACCURACY_BONUS, source: 'buff:inspire' },
        INSPIRE_DURATION_TURNS,
      );
      applyBuff(
        ally,
        INSPIRE_CRIT_BUFF_ID,
        { stat: 'critChance', type: 'flat', amount: INSPIRE_CRIT_CHANCE_BONUS, source: 'buff:inspire' },
        INSPIRE_DURATION_TURNS,
      );
    }

    return {
      type: 'party-buff',
      buffedAllyIds: allies.map((ally) => ally.id),
      accuracyAmount: INSPIRE_ACCURACY_BONUS,
      critChanceAmount: INSPIRE_CRIT_CHANCE_BONUS,
      durationTurns: INSPIRE_DURATION_TURNS,
    };
  },
};

/** Magnitudes and duration for Mira's potion tosses (roadmap item 3) — placeholder pending the balance pass, same shape as Empower/Fear/Blind's own numbers. */
export const POTION_BUFF_ATTACK_PERCENT = 20;
export const POTION_BUFF_ACCURACY = 10;
export const POTION_DEBUFF_ATTACK_PERCENT = -20;
export const POTION_DEBUFF_ACCURACY = -10;
export const POTION_EFFECT_DURATION_TURNS = 3;
const POTION_BUFF_ATTACK_ID = 'potion-buff-attack';
const POTION_BUFF_ACCURACY_ID = 'potion-buff-accuracy';
const POTION_DEBUFF_ATTACK_ID = 'potion-debuff-attack';
const POTION_DEBUFF_ACCURACY_ID = 'potion-debuff-accuracy';

/**
 * Mira's first signature mechanic (roadmap item 3, "chaotic healer/
 * support"): throws a potion at a uniformly random living ally (herself
 * included), granting a random one of two possible timed buffs —
 * attackPower or accuracy. Both the target and the effect are rolled here
 * in `resolve`, not `selectTarget` (no rng there) — same reasoning as
 * Fallacy's Command re-picking who it commands.
 */
export const PotionTossAllyAction: Action = {
  id: 'potion-toss-ally',
  name: 'Potion Toss (Ally)',
  reach: 'melee', // unused — targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    return allies[0] ?? null;
  },
  resolve(context: ActionContext): ActionOutcome {
    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    const target = allies[Math.floor(context.rng() * allies.length)];

    const isAttackBuff = context.rng() < 0.5;
    const stat = isAttackBuff ? 'attackPower' : 'accuracy';
    const amount = isAttackBuff ? POTION_BUFF_ATTACK_PERCENT : POTION_BUFF_ACCURACY;
    const buffId = isAttackBuff ? POTION_BUFF_ATTACK_ID : POTION_BUFF_ACCURACY_ID;

    applyBuff(
      target,
      buffId,
      { stat, type: isAttackBuff ? 'percent' : 'flat', amount, source: 'buff:potion-toss' },
      POTION_EFFECT_DURATION_TURNS,
    );

    return { type: 'support-buff', targetId: target.id, stat, amount, durationTurns: POTION_EFFECT_DURATION_TURNS };
  },
};

/**
 * Mira's second signature mechanic: throws a potion at a uniformly random
 * living enemy (either row — no melee front-row bias, same as a ranged
 * action), applying a random one of two possible timed debuffs —
 * attackPower or accuracy. Same "roll both in resolve" pattern as her ally
 * version above; never deals damage of its own, purely a debuff.
 */
export const PotionTossEnemyAction: Action = {
  id: 'potion-toss-enemy',
  name: 'Potion Toss (Enemy)',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    const livingEnemies = getOpposingRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    const target = livingEnemies[Math.floor(context.rng() * livingEnemies.length)];

    const isAttackDebuff = context.rng() < 0.5;
    const stat = isAttackDebuff ? 'attackPower' : 'accuracy';
    const amount = isAttackDebuff ? POTION_DEBUFF_ATTACK_PERCENT : POTION_DEBUFF_ACCURACY;
    const debuffId = isAttackDebuff ? POTION_DEBUFF_ATTACK_ID : POTION_DEBUFF_ACCURACY_ID;

    applyBuff(
      target,
      debuffId,
      { stat, type: isAttackDebuff ? 'percent' : 'flat', amount, source: 'buff:potion-toss' },
      POTION_EFFECT_DURATION_TURNS,
    );

    return { type: 'support-debuff', targetId: target.id, stat, amount, durationTurns: POTION_EFFECT_DURATION_TURNS };
  },
};
