import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';
import type { RngSource } from './rng';
import type { StatusEffectId } from './statusEffects';

export type ActionId =
  | 'attack-nearest'
  | 'attack-lowest-hp'
  | 'power-attack'
  | 'ranged-shot'
  | 'heal'
  | 'retreat'
  | 'cleave'
  | 'self-heal'
  | 'rallying-strike'
  | 'piercing-strike'
  | 'empower'
  | 'command'
  | 'fear'
  | 'pickpocket-strike'
  | 'gilded-strike'
  | 'blinding-bolt'
  | 'card-throw'
  | 'mending-charge'
  | 'mourning-strike'
  | 'inspire'
  | 'sneak-strike'
  | 'focused-shot'
  | 'potion-toss-ally'
  | 'potion-toss-enemy'
  | 'ember-burn'
  | 'venom-sting'
  | 'shield-wall'
  | 'splash-heal'
  | 'guardians-vow'
  | 'flank-strike'
  | 'venom-spit'
  | 'searing-touch'
  | 'regenerate'
  | 'vengeance'
  | 'lifesteal-strike'
  | 'taunt'
  | 'cleanse'
  | 'mark'
  | 'execute-strike'
  | 'silence'
  | 'stun'
  | 'chain-strike'
  | 'scatter-shot'
  | 'revive'
  | 'guardians-ward'
  | 'vanish';

export interface ActionContext {
  actor: Adventurer;
  target: Adventurer;
  /** Injected, never Math.random() directly — same convention as loot/gold/recruitment. Required because attack resolution (hit chance, damage variance) consumes it; heal/retreat ignore it. */
  rng: RngSource;
  /** Full battle state — only consumed by actions that need more than their single selected `target` (e.g. Cleave hitting every row-mate of `target`). Most actions ignore it. */
  battle: BattleState;
}

export interface TargetingContext {
  actor: Adventurer;
  battle: BattleState;
}

export type ActionOutcome =
  /**
   * `hit` is always `true` — every attack connects (no Accuracy/Evasion
   * miss roll; the "pure auto-battler" pass, see docs/roadmap.md). Kept
   * in the shape rather than removed everywhere `hit` is read, but
   * `damage` is the field that actually carries meaning now: 0 means
   * something fully blocked it (Shield, Invulnerability, Drifta's Dodge),
   * not that it missed.
   */
  | { type: 'attack'; damage: number; hit: boolean; targetId: string }
  /** A single action landing on more than one target at once (e.g. Bodil's Cleave — see actions/attack.ts) — each entry is resolved exactly like a plain 'attack' hit, just batched under one turn/one die roll. */
  | { type: 'attack-multi'; hits: { damage: number; hit: boolean; targetId: string }[] }
  /**
   * Glint's Rallying Strike (roadmap item 11): a normal single-target attack
   * (same `damage`/`hit`/`targetId` shape as 'attack') plus a timed armor
   * buff granted to every living ally at once — see actions/attack.ts and
   * buffs.ts. `buffedAllyIds` is every ally who received the buff (always
   * includes Glint herself), for the replay UI to announce.
   */
  | {
      type: 'attack-and-buff';
      damage: number;
      hit: boolean;
      targetId: string;
      buffedAllyIds: string[];
      armorAmount: number;
      durationTurns: number;
    }
  /**
   * A heal on `targetId`. `splashes` (Mira's Splash Heal — see
   * actions/heal.ts's SplashHealAction) lists the smaller heals that also
   * landed on allies adjacent to the target; absent for a plain heal.
   */
  | { type: 'heal'; amount: number; targetId: string; splashes?: { targetId: string; amount: number }[] }
  /**
   * Fallacy's Empower (roadmap item 11): a timed StatModifier buff granted
   * to a single ally (no attack of her own) — see actions/support.ts and
   * buffs.ts. Generic over `stat` so a future single-ally buff could reuse
   * it too, not hardcoded to attackPower — reused by Mira's Potion Toss
   * (Ally) (roadmap item 3).
   */
  | { type: 'support-buff'; targetId: string; stat: string; amount: number; durationTurns: number }
  /**
   * Glint's Shield Wall (second Special Action — the Shield ability type
   * from docs/missing-ability-types.md): grants a single ally (herself
   * included, whoever's lowest-HP) a depletable damage-absorb pool, no
   * attack of her own — see actions/support.ts and shields.ts. Distinct
   * from 'support-buff': the granted amount shrinks as it absorbs hits
   * rather than staying flat for the whole duration.
   */
  | { type: 'support-shield'; targetId: string; amount: number; durationTurns: number }
  /**
   * Caladwen's second Special Action (the Lifesteal ability type from
   * docs/missing-ability-types.md): a normal single-target attack (same
   * `damage`/`hit`/`targetId` shape as 'attack') that also heals the
   * attacker for a percent of the damage actually dealt — see
   * actions/attack.ts's LifestealStrikeAction. `healedAmount` is 0 on a
   * miss or a hit a Shield fully absorbed (damage dealt was 0), and is
   * itself clamped by the attacker's own effective maxHp.
   */
  | { type: 'attack-and-heal-self'; damage: number; hit: boolean; targetId: string; healedAmount: number }
  /**
   * Dawneth's Cleanse (second-Special pass — the Cleanse ability type):
   * no attack of her own — clears every active status effect (Burn/
   * Poison) from a single ally, herself included. Scoped to status
   * effects only for now, not StatModifier debuffs (e.g. Blind) — a
   * deliberate first-pass cut, not an oversight. `clearedEffectIds` is
   * empty if the target had nothing to cleanse (still resolves — same
   * "always fires" convention as Mending Charge).
   */
  | { type: 'cleanse'; targetId: string; clearedEffectIds: StatusEffectId[] }
  /**
   * Drifta's Execute Strike (second-Special pass — the Execute ability
   * type): a normal lowest-HP-targeted melee attack, but a target already
   * below EXECUTE_THRESHOLD_FRACTION (checked before the hit) is finished
   * off entirely on a landed hit, regardless of what the roll/armor/Shield
   * would otherwise have left them at. `damage` reports the true total HP
   * lost (including the finishing blow), not just the rolled hit.
   */
  | { type: 'attack-with-execute'; damage: number; hit: boolean; targetId: string; executed: boolean }
  /**
   * Mira's Revive (second-Special pass — the Revive ability type): brings
   * a Downed ally (hp <= 0) back into the fight at a fraction of their
   * effective maxHp — see actions/heal.ts's ReviveAction. `amount` is the
   * HP they come back with. Never fires if nobody on her side is
   * currently Downed (see targeting.ts's selectDownedAlly).
   */
  | { type: 'revive'; targetId: string; amount: number }
  /**
   * Mira's Potion Toss (Enemy) (roadmap item 3): the debuff counterpart to
   * 'support-buff' above — a timed StatModifier applied to a single enemy,
   * no attack of her own. `amount` is negative (a debuff), same convention
   * as Fear/Blind's own negative amounts.
   */
  | { type: 'support-debuff'; targetId: string; stat: string; amount: number; durationTurns: number }
  /**
   * Fallacy's Command (roadmap item 11): grants a random living ally
   * (never herself) a bonus attack right now, on top of their own turn
   * later in the round — see actions/support.ts. `attackOutcome` mirrors a
   * plain 'attack' outcome; null only if the commanded ally somehow had no
   * valid enemy target (shouldn't happen mid-room).
   */
  | { type: 'command'; commandedAllyId: string; attackOutcome: { damage: number; hit: boolean; targetId: string } | null }
  /**
   * Mirka's Fear (roadmap item 11): no attack of her own — applies a timed
   * positive 'vulnerability' StatModifier (the Mark ability type) to every
   * living enemy in her target's row at once (front, or back once front is
   * empty — same row rule as Bodil's Cleave), so they all take more damage
   * from the party while it's active. See actions/attack.ts's FearAction
   * and buffs.ts. Reframed from an accuracy debuff once Accuracy/Evasion
   * were removed (the "pure auto-battler" pass — see docs/roadmap.md).
   */
  | { type: 'fear'; fearedEnemyIds: string[]; vulnerabilityAmount: number; durationTurns: number }
  /**
   * Nerissa's Pickpocket Strike (roadmap item 11): a normal single-target
   * attack (same `damage`/`hit`/`targetId` shape as 'attack') that also
   * rolls bonus gold when it actually deals damage — see actions/attack.ts
   * and gold.ts's rollGold. `goldGenerated` is 0 if nothing got through
   * (Shield/Invulnerability/Dodge) or a failed roll; the amount is banked
   * into the run's gold at room-end regardless of how the room ends (see
   * gold.ts's sumGeneratedGold), not gated on a win.
   */
  | { type: 'attack-and-gold'; damage: number; hit: boolean; targetId: string; goldGenerated: number }
  /**
   * Dravena's Blinding Bolt (roadmap item 11): a ranged single-target
   * attack that also applies a timed negative-attackPower StatModifier
   * (Blind) to that same target — but only if the bolt actually deals
   * damage; nothing getting through (Shield/Invulnerability/Dodge) blinds
   * nobody. See actions/attack.ts's BlindingBoltAction
   * and buffs.ts. `debuffApplied` mirrors `hit` (always false when
   * `hit` is false), kept as its own field so the replay UI doesn't need
   * to re-derive it.
   */
  /**
   * An attack that also inflicts a status effect if any damage got through
   * (enemy variety pass — Venom Spit's poison, Searing Touch's burn; see
   * actions/attack.ts's resolveAttackAndStatus).
   */
  | {
      type: 'attack-and-status';
      damage: number;
      hit: boolean;
      targetId: string;
      effectId: StatusEffectId;
      statusApplied: boolean;
    }
  | {
      type: 'attack-and-debuff';
      damage: number;
      hit: boolean;
      targetId: string;
      debuffApplied: boolean;
      attackPowerPercent: number;
      durationTurns: number;
    }
  /**
   * Dawneth's Mending Charge (roadmap item 11): always resolves (never an
   * idle roll, unlike plain Heal) — heals the lowest-HP ally if anyone
   * actually qualifies (`amount` is 0 otherwise), and always grants
   * `energyGained` Mending Charge energy regardless. See actions/heal.ts's
   * MendingChargeAction and battle.ts's healEnergyByUnitId.
   */
  | { type: 'heal-and-charge'; amount: number; targetId: string; energyGained: number; totalEnergy: number }
  /**
   * Tharavel's Inspire (roadmap item 11): no attack of her own — grants
   * every living ally (herself included) a timed critChance buff at once
   * (consolidated from a separate accuracy + crit pair once Accuracy was
   * removed as a baseline stat — see docs/roadmap.md). See
   * actions/support.ts's InspireAction and buffs.ts.
   */
  | { type: 'party-buff'; buffedAllyIds: string[]; critChanceAmount: number; durationTurns: number }
  /** Signals the turn engine to end the room early via triggerRetreat — see actions/retreat.ts. */
  | { type: 'retreat' }
  /**
   * Ring of Embers' granted Special Action (roadmap item 13's replacement
   * now that per-face enchantments are retired — see data/specialActions.ts
   * and sim/actions/itemEffects.ts): applies a status effect to a target
   * with no attack roll of its own.
   */
  | { type: 'inflict-status'; targetId: string; effectId: StatusEffectId };

export interface Action {
  id: ActionId;
  name: string;
  /**
   * 'melee' can only reach the opposing roster's front row (falling through
   * to back once front has no living members); 'ranged' can reach either
   * row directly. See actions/targeting.ts. Irrelevant for an action that
   * doesn't target the opposing roster (Heal, Retreat) — set to whatever,
   * it's never consulted for those.
   */
  reach: 'melee' | 'ranged';
  /** Picks this action's best qualifying target, respecting `reach`'s row rule — null only if none exists at all. */
  selectTarget(context: TargetingContext): Adventurer | null;
  /** Applies the action's effect to the context's actor/target and returns what happened. */
  resolve(context: ActionContext): ActionOutcome;
}
