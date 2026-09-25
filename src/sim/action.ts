import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';
import type { RngSource } from './rng';

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
  | 'potion-toss-enemy';

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
  /** `hit: false` means the attack missed — `damage` is always 0 in that case; a landed hit is never 0 (see attack.ts's MIN_DAMAGE_AFTER_ARMOR). */
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
  | { type: 'heal'; amount: number; targetId: string }
  /**
   * Fallacy's Empower (roadmap item 11): a timed StatModifier buff granted
   * to a single ally (no attack of her own) — see actions/support.ts and
   * buffs.ts. Generic over `stat` so a future single-ally buff could reuse
   * it too, not hardcoded to attackPower — reused by Mira's Potion Toss
   * (Ally) (roadmap item 3).
   */
  | { type: 'support-buff'; targetId: string; stat: string; amount: number; durationTurns: number }
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
   * negative-accuracy StatModifier to every living enemy in her target's
   * row at once (front, or back once front is empty — same row rule as
   * Bodil's Cleave), so they're all worse at landing hits while it's
   * active. See actions/attack.ts's FearAction and buffs.ts.
   */
  | { type: 'fear'; fearedEnemyIds: string[]; accuracyAmount: number; durationTurns: number }
  /**
   * Nerissa's Pickpocket Strike (roadmap item 11): a normal single-target
   * attack (same `damage`/`hit`/`targetId` shape as 'attack') that also
   * rolls bonus gold on a landed hit — see actions/attack.ts and gold.ts's
   * rollGold. `goldGenerated` is 0 on a miss or a failed roll; the amount
   * is banked into the run's gold at room-end regardless of how the room
   * ends (see gold.ts's sumGeneratedGold), not gated on a win.
   */
  | { type: 'attack-and-gold'; damage: number; hit: boolean; targetId: string; goldGenerated: number }
  /**
   * Dravena's Blinding Bolt (roadmap item 11): a ranged single-target
   * attack that also applies a timed negative-attackPower StatModifier
   * (Blind) to that same target — but only if the bolt actually lands;
   * a miss never blinds anyone. See actions/attack.ts's BlindingBoltAction
   * and buffs.ts. `debuffApplied` mirrors `hit` (always false when
   * `hit` is false), kept as its own field so the replay UI doesn't need
   * to re-derive it.
   */
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
   * every living ally (herself included) a timed accuracy + critChance
   * buff at once. See actions/support.ts's InspireAction and buffs.ts.
   */
  | { type: 'party-buff'; buffedAllyIds: string[]; accuracyAmount: number; critChanceAmount: number; durationTurns: number }
  /** Signals the turn engine to end the room early via triggerRetreat — see actions/retreat.ts. */
  | { type: 'retreat' };

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
