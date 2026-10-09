import type { Action, ActionContext, ActionOutcome, TargetingContext } from '../action';
import { getOwnRoster, getOpposingRoster, getHealEnergy } from '../battle';
import { applyBuff } from '../buffs';
import { applyShield } from '../shields';
import { getEffectiveStat } from '../stats';
import { selectHighestAttackPowerAlly, selectFirstEnemy, selectLowestHpAlly, selectGuardAlly } from './targeting';
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
 * like AttackNearestAction would for them (their own attackPower, normal
 * melee targeting) — reused directly rather than reimplemented.
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

/** How many distinct allies Battle Orders commands at once — one more than Command. */
export const BATTLE_ORDERS_ALLY_COUNT = 2;

/**
 * Fallacy's unlock Special (the unlock content pass — deliberately a
 * little stronger than Command, since she trailed the field): up to
 * BATTLE_ORDERS_ALLY_COUNT distinct random living allies (never herself)
 * each make a bonus Attack Nearest right now, same as Command's single one.
 */
export const BattleOrdersAction: Action = {
  id: 'battle-orders',
  name: 'Battle Orders',
  reach: 'melee', // unused — targets allies, never the opposing roster directly
  selectTarget(context: TargetingContext) {
    return CommandAction.selectTarget(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    const pool = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0 && unit.id !== context.actor.id);
    const commands = [];
    for (let i = 0; i < BATTLE_ORDERS_ALLY_COUNT && pool.length > 0; i++) {
      const [ally] = pool.splice(Math.floor(context.rng() * pool.length), 1);
      const enemyTarget = AttackNearestAction.selectTarget({ actor: ally, battle: context.battle });
      const outcome = enemyTarget
        ? AttackNearestAction.resolve({ actor: ally, target: enemyTarget, rng: context.rng, battle: context.battle })
        : null;
      const attackOutcome =
        outcome?.type === 'attack' ? { damage: outcome.damage, hit: outcome.hit, targetId: outcome.targetId } : null;
      commands.push({ commandedAllyId: ally.id, attackOutcome });
    }
    return { type: 'command-multi', commands };
  },
};

/**
 * Consolidated from two separate bonuses (10 accuracy + 10 crit) into one
 * stronger crit buff once Accuracy was removed (the "pure auto-battler"
 * pass — see docs/roadmap.md). Raised 20 → 30 in the unlock content pass
 * to pull Tharavel (a trailing pick) up toward the field.
 */
export const INSPIRE_CRIT_CHANCE_BONUS = 30;
export const INSPIRE_DURATION_TURNS = 3;
const INSPIRE_CRIT_BUFF_ID = 'inspire-crit';

/**
 * Tharavel's signature mechanic (roadmap item 11): no attack of her own —
 * grants every living ally at once (herself included) a timed critChance
 * buff, same whole-party scope as Glint's Rallying Strike but with no
 * attack half (like Fallacy's Empower's shape, just party-wide instead of
 * single-target). Used to be two separate buffs (accuracy + crit);
 * consolidated into one stronger crit buff once Accuracy was removed as a
 * baseline stat.
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
        INSPIRE_CRIT_BUFF_ID,
        { stat: 'critChance', type: 'flat', amount: INSPIRE_CRIT_CHANCE_BONUS, source: 'buff:inspire' },
        INSPIRE_DURATION_TURNS,
      );
    }

    return {
      type: 'party-buff',
      buffedAllyIds: allies.map((ally) => ally.id),
      critChanceAmount: INSPIRE_CRIT_CHANCE_BONUS,
      durationTurns: INSPIRE_DURATION_TURNS,
    };
  },
};

/** Shield amount and duration Shield Wall grants — placeholders pending the balance pass, same as every other combat number. */
export const SHIELD_WALL_AMOUNT = 8;
export const SHIELD_WALL_DURATION_TURNS = 3;
const SHIELD_WALL_ID = 'shield-wall';

/**
 * Glint's second signature mechanic (the Shield ability type from
 * docs/missing-ability-types.md — a depletable damage-absorb pool,
 * distinct from Rallying Strike/Guard Up's flat armor/attackPower buffs):
 * no attack of her own — grants SHIELD_WALL_AMOUNT Shield to whichever
 * living ally (herself included) currently has the lowest HP, same
 * "always resolves, never gated on anyone being hurt enough" targeting as
 * Dawneth's Mending Charge (selectLowestHpAlly, not the
 * below-threshold variant).
 */
export const ShieldWallAction: Action = {
  id: 'shield-wall',
  name: 'Shield Wall',
  reach: 'melee', // unused — Shield Wall targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectLowestHpAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyShield(context.target, SHIELD_WALL_ID, SHIELD_WALL_AMOUNT, SHIELD_WALL_DURATION_TURNS);
    return {
      type: 'support-shield',
      targetId: context.target.id,
      amount: SHIELD_WALL_AMOUNT,
      durationTurns: SHIELD_WALL_DURATION_TURNS,
    };
  },
};

/** Guardian's Vow shield before any Mending Charge energy is added. */
export const GUARDIANS_VOW_BASE_SHIELD = 2;
/** Extra Guardian's Vow shield per point of Dawneth's stored Mending Charge energy (see actions/heal.ts). */
export const GUARDIANS_VOW_SHIELD_PER_ENERGY = 1;
/** Cap on Guardian's Vow's shield, however much energy is banked. */
export const GUARDIANS_VOW_MAX_SHIELD = 10;
export const GUARDIANS_VOW_DURATION_TURNS = 2;
const GUARDIANS_VOW_ID = 'guardians-vow';

/**
 * Dawneth's lane-guardian Special (the healer redesign, replacing Cleanse —
 * see docs/roadmap.md): shields her guard (the ally directly in front of
 * her in her lane — see targeting.ts's selectGuardAlly), or the lowest-HP
 * ally if nobody stands in front of her. The shield grows with her stored
 * Mending Charge energy (capped), without spending it — so it's the
 * defensive counterpart to Mourning Strike's energy-scaled damage.
 * Single-stack: re-casting refreshes rather than stacks (see shields.ts).
 */
export const GuardiansVowAction: Action = {
  id: 'guardians-vow',
  name: "Guardian's Vow",
  reach: 'ranged', // unused — targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectGuardAlly(context) ?? selectLowestHpAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    const energy = getHealEnergy(context.battle, context.actor.id);
    const amount = Math.min(GUARDIANS_VOW_MAX_SHIELD, GUARDIANS_VOW_BASE_SHIELD + energy * GUARDIANS_VOW_SHIELD_PER_ENERGY);
    applyShield(context.target, GUARDIANS_VOW_ID, amount, GUARDIANS_VOW_DURATION_TURNS);
    return { type: 'support-shield', targetId: context.target.id, amount, durationTurns: GUARDIANS_VOW_DURATION_TURNS };
  },
};

/** How many of her own turns Taunt lasts before expiring — placeholder pending the balance pass. */
export const TAUNT_DURATION_TURNS = 3;
const TAUNT_BUFF_ID = 'taunt-self';

/**
 * Bodil's second signature mechanic (the Taunt ability type from
 * docs/missing-ability-types.md): no attack of her own — grants herself a
 * timed buff on a synthetic 'taunt' stat (same "encode a flag as a
 * StatModifier" convention as Fear/Blind, just on a stat nothing else
 * reads for its numeric value) that forces every opposing basic-attack-style
 * targeting call (selectFirstEnemy/selectLowestHpEnemy — see
 * actions/targeting.ts) onto her specifically, regardless of row/reach,
 * for as long as it's active. Does not yet override every special-cased
 * targeting roll (Card Throw/Sneak Strike's own random picks, Fear/
 * Cleave's row grab, Potion Toss Enemy) — flagged as a follow-up, not
 * silently assumed covered.
 */
export const TauntAction: Action = {
  id: 'taunt',
  name: 'Taunt',
  reach: 'melee', // unused — Taunt targets herself only
  selectTarget(context: TargetingContext) {
    return context.actor;
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(context.actor, TAUNT_BUFF_ID, { stat: 'taunt', type: 'flat', amount: 1, source: 'buff:taunt' }, TAUNT_DURATION_TURNS);
    return { type: 'support-buff', targetId: context.actor.id, stat: 'taunt', amount: 1, durationTurns: TAUNT_DURATION_TURNS };
  },
};

/** Percent extra damage Mark causes its target to take, and how long it lasts — placeholders pending the balance pass. */
export const MARK_VULNERABILITY_PERCENT = 30;
export const MARK_DURATION_TURNS = 3;
const MARK_DEBUFF_ID = 'mark-vulnerability';

/**
 * Isilwen's second signature mechanic (the Mark ability type from
 * docs/missing-ability-types.md): no attack of her own — applies a timed
 * positive StatModifier on a synthetic 'vulnerability' stat to a single
 * living enemy, read directly by actions/attack.ts's applyAttackToTarget
 * to scale up whatever damage they next take, distinct from
 * support-debuff's existing stat-lowering flavor (this raises incoming
 * damage rather than lowering the target's own stats). Deliberately a
 * 'flat' StatModifier even though `amount` is itself a percentage —
 * attack.ts reads the summed amount directly as the bonus-damage percent,
 * rather than running it through getEffectiveStat's usual `(base +
 * flat) * (1 + percent/100)` formula, which would always evaluate to 0
 * against a 0 base (there's no real "vulnerability" stat to have a base
 * value in the first place — same reasoning as Taunt/Silence/Stun/
 * Stealth/Invulnerable's own flag-as-flat-buff convention).
 */
export const MarkAction: Action = {
  id: 'mark',
  name: 'Mark',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(
      context.target,
      MARK_DEBUFF_ID,
      { stat: 'vulnerability', type: 'flat', amount: MARK_VULNERABILITY_PERCENT, source: 'buff:mark' },
      MARK_DURATION_TURNS,
    );
    return {
      type: 'support-debuff',
      targetId: context.target.id,
      stat: 'vulnerability',
      amount: MARK_VULNERABILITY_PERCENT,
      durationTurns: MARK_DURATION_TURNS,
    };
  },
};

/** How long Silence lasts — placeholder pending the balance pass. */
export const SILENCE_DURATION_TURNS = 3;
const SILENCE_DEBUFF_ID = 'silence';

/**
 * Fallacy's second signature mechanic (the Silence ability type from
 * docs/missing-ability-types.md): no attack of her own — applies a timed
 * flag-as-buff on a synthetic 'silence' stat to a single living enemy,
 * checked by specialActions.ts's resolveSpecialActionTriggers to suppress
 * every one of that unit's Special Actions for the duration — their Basic
 * Action still fires normally every turn, unlike Stun, which stops both.
 */
export const SilenceAction: Action = {
  id: 'silence',
  name: 'Silence',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, false);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(context.target, SILENCE_DEBUFF_ID, { stat: 'silence', type: 'flat', amount: 1, source: 'buff:silence' }, SILENCE_DURATION_TURNS);
    return { type: 'support-debuff', targetId: context.target.id, stat: 'silence', amount: 1, durationTurns: SILENCE_DURATION_TURNS };
  },
};

/** How long Stun lasts — shorter than Silence/Mark since it suppresses a whole turn outright, not just one half of it — placeholder pending the balance pass. */
export const STUN_DURATION_TURNS = 2;
const STUN_DEBUFF_ID = 'stun';

/**
 * Mirka's second signature mechanic (the Stun ability type from
 * docs/missing-ability-types.md): no attack of her own — applies a timed
 * flag-as-buff on a synthetic 'stun' stat to a single living enemy,
 * checked by turnEngine.ts's resolveTurn to skip that unit's entire next
 * turn (both Basic Action and any 'on-turn-start' Special Action) —
 * stronger than Silence, which only suppresses the Special Action half.
 */
export const StunAction: Action = {
  id: 'stun',
  name: 'Stun',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(context.target, STUN_DEBUFF_ID, { stat: 'stun', type: 'flat', amount: 1, source: 'buff:stun' }, STUN_DURATION_TURNS);
    return { type: 'support-debuff', targetId: context.target.id, stat: 'stun', amount: 1, durationTurns: STUN_DURATION_TURNS };
  },
};

/** How long Guardian's Ward lasts — short, since full damage immunity is powerful — placeholder pending the balance pass. */
export const GUARDIANS_WARD_DURATION_TURNS = 1;
const GUARDIANS_WARD_BUFF_ID = 'guardians-ward';

/**
 * Tharavel's second Special (the Invulnerability ability type from
 * docs/missing-ability-types.md, picked as a stand-in since her originally
 * intended ability — resource denial — is blocked on the charge-meter
 * system not existing yet, see docs/kit-trait-tag-framework.md): no attack
 * of her own — grants whichever living ally currently has the lowest HP
 * (herself included, same always-resolves targeting as Shield Wall/
 * Mending Charge) a timed flag-as-buff on a synthetic 'invulnerable' stat,
 * read directly by actions/attack.ts's applyAttackToTarget to zero out any
 * damage they'd otherwise take — no absorb cap, unlike Shield; just immune.
 */
export const GuardiansWardAction: Action = {
  id: 'guardians-ward',
  name: "Guardian's Ward",
  reach: 'melee', // unused — targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectLowestHpAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(
      context.target,
      GUARDIANS_WARD_BUFF_ID,
      { stat: 'invulnerable', type: 'flat', amount: 1, source: 'buff:guardians-ward' },
      GUARDIANS_WARD_DURATION_TURNS,
    );
    return {
      type: 'support-buff',
      targetId: context.target.id,
      stat: 'invulnerable',
      amount: 1,
      durationTurns: GUARDIANS_WARD_DURATION_TURNS,
    };
  },
};

/** How long Vanish lasts — placeholder pending the balance pass. */
export const VANISH_DURATION_TURNS = 2;
const VANISH_BUFF_ID = 'vanish-stealth';

/**
 * Dravena's second Special (the Stealth/untargetable ability type from
 * docs/missing-ability-types.md, picked as a stand-in since her originally
 * intended ability — a typed-damage layer — is blocked on the
 * damage-type/resistance system not existing yet, see
 * docs/kit-trait-tag-framework.md): no attack of her own — grants herself
 * a timed flag-as-buff on a synthetic 'stealth' stat, checked by
 * actions/targeting.ts's livingOpponents to remove her from every opposing
 * targeting pool entirely for the duration (genuinely unselectable, not
 * just harder to hit — distinct from evasion).
 */
export const VanishAction: Action = {
  id: 'vanish',
  name: 'Vanish',
  reach: 'melee', // unused — targets herself only
  selectTarget(context: TargetingContext) {
    return context.actor;
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(context.actor, VANISH_BUFF_ID, { stat: 'stealth', type: 'flat', amount: 1, source: 'buff:vanish' }, VANISH_DURATION_TURNS);
    return { type: 'support-buff', targetId: context.actor.id, stat: 'stealth', amount: 1, durationTurns: VANISH_DURATION_TURNS };
  },
};

/**
 * Magnitudes and duration for Mira's potion tosses (roadmap item 3) —
 * placeholder pending the balance pass, same shape as Empower/Fear/Blind's
 * own numbers. The accuracy half of each pair was replaced with a crit
 * chance buff / vulnerability debuff once Accuracy/Evasion were removed
 * as baseline stats (the "pure auto-battler" pass — see docs/roadmap.md).
 */
export const POTION_BUFF_ATTACK_PERCENT = 20;
export const POTION_BUFF_CRIT_CHANCE = 10;
export const POTION_DEBUFF_ATTACK_PERCENT = -20;
export const POTION_DEBUFF_VULNERABILITY_PERCENT = 20;
export const POTION_EFFECT_DURATION_TURNS = 3;
const POTION_BUFF_ATTACK_ID = 'potion-buff-attack';
const POTION_BUFF_CRIT_ID = 'potion-buff-crit';
const POTION_DEBUFF_ATTACK_ID = 'potion-debuff-attack';
const POTION_DEBUFF_VULNERABILITY_ID = 'potion-debuff-vulnerability';

/**
 * Mira's first signature mechanic (roadmap item 3, "chaotic healer/
 * support"): throws a potion at a uniformly random living ally (herself
 * included), granting a random one of two possible timed buffs —
 * attackPower or critChance. Both the target and the effect are rolled
 * here in `resolve`, not `selectTarget` (no rng there) — same reasoning as
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
    const stat = isAttackBuff ? 'attackPower' : 'critChance';
    const amount = isAttackBuff ? POTION_BUFF_ATTACK_PERCENT : POTION_BUFF_CRIT_CHANCE;
    const buffId = isAttackBuff ? POTION_BUFF_ATTACK_ID : POTION_BUFF_CRIT_ID;

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
 * attackPower or vulnerability (the Mark ability type, making the target
 * take more damage from the party). Same "roll both in resolve" pattern
 * as her ally version above; never deals damage of its own, purely a
 * debuff.
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
    const stat = isAttackDebuff ? 'attackPower' : 'vulnerability';
    const amount = isAttackDebuff ? POTION_DEBUFF_ATTACK_PERCENT : POTION_DEBUFF_VULNERABILITY_PERCENT;
    const debuffId = isAttackDebuff ? POTION_DEBUFF_ATTACK_ID : POTION_DEBUFF_VULNERABILITY_ID;

    applyBuff(
      target,
      debuffId,
      { stat, type: isAttackDebuff ? 'percent' : 'flat', amount, source: 'buff:potion-toss' },
      POTION_EFFECT_DURATION_TURNS,
    );

    return { type: 'support-debuff', targetId: target.id, stat, amount, durationTurns: POTION_EFFECT_DURATION_TURNS };
  },
};

/** Percent attackPower the Bone Sentinel's Vengeance grants, and how long it lasts (long enough to cover the rest of most fights). */
export const VENGEANCE_ATTACK_PERCENT = 50;
export const VENGEANCE_DURATION_TURNS = 99;
const VENGEANCE_BUFF_ID = 'vengeance';

/**
 * The Bone Sentinel's reactive Special (enemy variety pass — fires
 * 'on-ally-downed', see data/specialActions.ts): when one of its allies
 * falls, it gains VENGEANCE_ATTACK_PERCENT attackPower for the rest of the
 * fight. Single-stack (a second fallen ally refreshes, not stacks — see
 * buffs.ts's applyBuff), so killing its friends first is a real trade-off
 * rather than a death spiral.
 */
export const VengeanceAction: Action = {
  id: 'vengeance',
  name: 'Vengeance',
  reach: 'melee', // unused — always targets the actor itself
  selectTarget(context: TargetingContext) {
    return context.actor.hp > 0 ? context.actor : null;
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(
      context.actor,
      VENGEANCE_BUFF_ID,
      { stat: 'attackPower', type: 'percent', amount: VENGEANCE_ATTACK_PERCENT, source: 'buff:vengeance' },
      VENGEANCE_DURATION_TURNS,
    );
    return {
      type: 'support-buff',
      targetId: context.actor.id,
      stat: 'attackPower',
      amount: VENGEANCE_ATTACK_PERCENT,
      durationTurns: VENGEANCE_DURATION_TURNS,
    };
  },
};

// --- Monster pass: infernal court / demon army ---

/** Hex's attack penalty and duration (it also Silences for the same duration). */
export const HEX_ATTACK_PERCENT = -25;
export const HEX_DURATION_TURNS = 3;

/**
 * The Hex Witch's Basic Action (debuffer): targets the opposing unit with
 * the highest effective attackPower — your strongest hero, at any range —
 * cutting its attack by HEX_ATTACK_PERCENT and Silencing its Special
 * Actions (same 'silence' flag as SilenceAction) for HEX_DURATION_TURNS.
 */
export const HexAction: Action = {
  id: 'hex',
  name: 'Hex',
  reach: 'ranged',
  selectTarget(context: TargetingContext) {
    const living = getOpposingRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    if (living.length === 0) return null;
    const attackOf = (unit: (typeof living)[number]) => getEffectiveStat(unit.attackPower, 'attackPower', unit.modifiers);
    return living.reduce((strongest, unit) => (attackOf(unit) > attackOf(strongest) ? unit : strongest));
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBuff(
      context.target,
      'hex-attack',
      { stat: 'attackPower', type: 'percent', amount: HEX_ATTACK_PERCENT, source: 'buff:hex' },
      HEX_DURATION_TURNS,
    );
    applyBuff(context.target, SILENCE_DEBUFF_ID, { stat: 'silence', type: 'flat', amount: 1, source: 'buff:silence' }, HEX_DURATION_TURNS);
    return { type: 'support-debuff', targetId: context.target.id, stat: 'hex', amount: HEX_ATTACK_PERCENT, durationTurns: HEX_DURATION_TURNS };
  },
};

/** War Banner's attack bonus for every allied monster, refreshed each turn rather than stacking. */
export const WAR_BANNER_ATTACK_PERCENT = 20;
export const WAR_BANNER_DURATION_TURNS = 2;

/**
 * The Infernal Bannerman's always-on Special (ally empower): every living
 * ally (itself included) gets +WAR_BANNER_ATTACK_PERCENT attack for a
 * couple of turns, refreshed each turn it lives — kill it first and the
 * buff lapses.
 */
export const WarBannerAction: Action = {
  id: 'war-banner',
  name: 'War Banner',
  reach: 'melee', // unused — buffs its own side
  selectTarget(context: TargetingContext) {
    return context.actor.hp > 0 ? context.actor : null;
  },
  resolve(context: ActionContext): ActionOutcome {
    const allies = getOwnRoster(context.battle, context.actor).filter((unit) => unit.hp > 0);
    for (const ally of allies) {
      applyBuff(
        ally,
        'war-banner',
        { stat: 'attackPower', type: 'percent', amount: WAR_BANNER_ATTACK_PERCENT, source: 'buff:war-banner' },
        WAR_BANNER_DURATION_TURNS,
      );
    }
    return {
      type: 'ally-rally',
      stat: 'attackPower',
      amount: WAR_BANNER_ATTACK_PERCENT,
      durationTurns: WAR_BANNER_DURATION_TURNS,
      buffedIds: allies.map((ally) => ally.id),
    };
  },
};

