import type { Adventurer } from './adventurer';
import { addCharge, chargeOf, tickReactiveCooldowns, CHARGE_PER_TURN } from './charge';
import type { Action, ActionOutcome } from './action';
import type { BattleState } from './battle';
import { triggerRetreat, getOpposingRoster, getOwnRoster } from './battle';
import type { RngSource } from './rng';
import { tickStatusEffects, type StatusEffectId } from './statusEffects';
import { tickBuffs } from './buffs';
import { tickAuras } from './auras';
import { tickShields } from './shields';
import { isAdjacent } from './formation';
import { banishOrphanedSummons } from './summons';
import { resolveSpecialActionTriggers, type SpecialActionOutcome } from './specialActions';
import { getEffectiveStat } from './stats';

/** Whether `unit` currently has an active Stun (see actions/support.ts's StunAction) — a timed buff on a synthetic 'stun' stat, same convention as Taunt/Silence. */
function isStunned(unit: Adventurer): boolean {
  return getEffectiveStat(0, 'stun', unit.modifiers) > 0;
}

export type TurnEvent =
  | { type: 'action'; actionId: Action['id']; outcome: ActionOutcome }
  /** A status effect (e.g. Burn) dealing its per-turn damage — see statusEffects.ts. */
  | { type: 'status-tick'; effectId: StatusEffectId; damage: number }
  /**
   * A Special Action's trigger matched and was resolved — see
   * specialActions.ts. `actorId` is whoever the Special Action belongs to,
   * which may differ from whoever's turn this is (e.g. an 'on-hit-taken'
   * special fires on the unit that got hit, during the attacker's turn).
   * `outcome` is null when the Special Action found no valid target.
   */
  | { type: 'special-action'; actorId: string; specialActionId: string; outcome: ActionOutcome | null }
  /** A Bodyguard (traits.ts's BODYGUARD_TRAIT) took `damage` of a hit meant for `protectedId` — see battle.ts's pendingIntercepts. */
  | { type: 'intercept'; attackerId: string; guardianId: string; protectedId: string; damage: number }
  /** A Milestone Trait fired mid-attack: a Vampiric heal or a Second Wind revive — see battle.ts's pendingTraitEffects. */
  | { type: 'trait-effect'; kind: 'heal' | 'revive'; unitId: string; amount: number; traitName: string }
  /** Summons whose summoner fell this turn, banished — see sim/summons.ts. */
  | { type: 'banish'; unitIds: string[] };

export interface TurnResult {
  events: TurnEvent[];
  /** Which of the 6 die faces (0-5) the Basic Action was derived from — for the future dice-face-art UI. */
  rolledFaceIndex: number;
  rolledActionId: Action['id'];
  /** Every unit's Special Action charge (sim/charge.ts) once this turn ends — for the replay's charge bars. */
  chargeAfter?: Record<string, number>;
}

/**
 * Every targetId `outcome` actually dealt damage to — [] for an outcome
 * shape with no damage payload at all (heal, support-buff, etc). Every
 * attack always "hits" now (`hit` is vestigially always `true` — see
 * action.ts's doc comments on the "pure auto-battler" pass), so this
 * checks `damage > 0` instead: a target that fully blocked the hit
 * (Shield, Invulnerability, Dodge) took no damage and shouldn't fire
 * 'on-hit-landed'/'on-hit-taken' triggers, even though the attack
 * "landed" in the sense of resolving at all.
 */
function landedHitTargetIds(outcome: ActionOutcome): string[] {
  switch (outcome.type) {
    case 'attack':
    case 'attack-and-buff':
    case 'attack-and-gold':
    case 'attack-and-debuff':
    case 'attack-and-status':
    case 'attack-and-pull':
    case 'attack-with-execute':
    case 'attack-and-heal-self':
      return outcome.damage > 0 ? [outcome.targetId] : [];
    case 'attack-multi':
      return outcome.hits.filter((hit) => hit.damage > 0).map((hit) => hit.targetId);
    default:
      return [];
  }
}

/** Banishes any summons whose summoner has fallen (sim/summons.ts) and records it for the replay. */
function pushBanishes(events: TurnEvent[], battle: BattleState): void {
  const unitIds = banishOrphanedSummons(battle);
  if (unitIds.length > 0) events.push({ type: 'banish', unitIds });
}

/** Moves any Bodyguard intercepts recorded during resolution (battle.pendingIntercepts) into `events`, in order. */
function drainIntercepts(events: TurnEvent[], battle: BattleState): void {
  for (const intercept of battle.pendingIntercepts) events.push({ type: 'intercept', ...intercept });
  battle.pendingIntercepts = [];
  for (const effect of battle.pendingTraitEffects) events.push({ type: 'trait-effect', ...effect });
  battle.pendingTraitEffects = [];
}

function pushSpecialActionEvents(events: TurnEvent[], outcomes: SpecialActionOutcome[], actorId: string): void {
  for (const outcome of outcomes) {
    events.push({ type: 'special-action', actorId, specialActionId: outcome.specialActionId, outcome: outcome.outcome });
  }
}

/**
 * Resolves one turn for `adventurer`: ticks its own status effects/buffs/
 * shields and recomputes active Auras affecting it, then — unless Stunned
 * (see isStunned), which skips the rest of this entirely — fires any
 * 'on-turn-start' Special Action triggers, then always resolves
 * its deterministic `basicAction` (see adventurer.ts) — no roll, no
 * randomness in which action fires. If the action landed a hit, fires
 * 'on-hit-landed' (on the actor) and 'on-hit-taken' (on whoever was hit)
 * triggers; if it downed one or more units (checked once the whole outcome
 * has finished resolving, so a multi-hit action like Cleave is evaluated as
 * a batch rather than unit-by-unit mid-resolution), fires
 * 'on-ally-downed'/'on-enemy-downed' for every other living unit on the
 * relevant side(s). None of this consumes anyone's turn, and a hit caused
 * by a Special Action's own effect does not itself fire further triggers —
 * see specialActions.ts's own doc comment for why.
 */
export function resolveTurn(adventurer: Adventurer, battle: BattleState, rng: RngSource): TurnResult {
  const result = resolveTurnEvents(adventurer, battle, rng);
  result.chargeAfter = Object.fromEntries(
    [...battle.adventurers, ...battle.enemies].map((unit) => [unit.id, chargeOf(battle, unit.id)]),
  );
  return result;
}

function resolveTurnEvents(adventurer: Adventurer, battle: BattleState, rng: RngSource): TurnResult {
  battle.turnsTakenByUnitId[adventurer.id] = (battle.turnsTakenByUnitId[adventurer.id] ?? 0) + 1;
  addCharge(battle, adventurer.id, CHARGE_PER_TURN);
  tickReactiveCooldowns(battle, adventurer.id);
  const events: TurnEvent[] = tickStatusEffects(adventurer).map((tick) => ({
    type: 'status-tick',
    effectId: tick.effectId,
    damage: tick.damage,
  }));
  tickBuffs(adventurer);
  tickShields(adventurer);
  tickAuras(adventurer, battle);

  const action = adventurer.basicAction;
  // Reports whichever die face currently shows the Basic Action, for the dice-face-art UI — falls
  // back to 0 if none does (the Basic Action was explicitly authored rather than derived from
  // dieFaces at all — see adventurer.ts's createAdventurer).
  const faceIndex = adventurer.dieFaces.findIndex((face) => face.action.id === action.id);
  const result: TurnResult = { events, rolledFaceIndex: faceIndex === -1 ? 0 : faceIndex, rolledActionId: action.id };

  if (adventurer.hp <= 0) {
    // A lethal status tick just downed this unit before it could act.
    pushBanishes(events, battle);
    return result;
  }

  if (isStunned(adventurer)) {
    // Stun (the Stun ability type — see actions/support.ts's StunAction) skips the whole turn: no
    // 'on-turn-start' Special Action, no Basic Action — stronger than Silence, which only
    // suppresses the Special Action half (see specialActions.ts's isSilenced). The Stun buff itself
    // already ticked down above (tickBuffs), so it still counts toward expiring normally.
    pushBanishes(events, battle);
    return result;
  }

  pushSpecialActionEvents(
    events,
    resolveSpecialActionTriggers(adventurer, adventurer.activeSpecialActions, { trigger: 'on-turn-start' }, battle, rng),
    adventurer.id,
  );

  const target = action.selectTarget({ actor: adventurer, battle });
  if (target === null) {
    pushBanishes(events, battle);
    return result;
  }

  const hpBefore = new Map<string, number>();
  for (const unit of [...battle.adventurers, ...battle.enemies]) {
    hpBefore.set(unit.id, unit.hp);
  }

  const outcome = action.resolve({ actor: adventurer, target, rng, battle });
  events.push({ type: 'action', actionId: action.id, outcome });
  drainIntercepts(events, battle);

  if (outcome.type === 'retreat') {
    triggerRetreat(battle);
  }

  const hitTargetIds = landedHitTargetIds(outcome);
  if (hitTargetIds.length > 0) {
    pushSpecialActionEvents(
      events,
      resolveSpecialActionTriggers(adventurer, adventurer.activeSpecialActions, { trigger: 'on-hit-landed' }, battle, rng),
      adventurer.id,
    );

    const opposing = getOpposingRoster(battle, adventurer);
    for (const targetId of hitTargetIds) {
      const hitUnit = opposing.find((unit) => unit.id === targetId);
      if (hitUnit) {
        pushSpecialActionEvents(
          events,
          resolveSpecialActionTriggers(hitUnit, hitUnit.activeSpecialActions, { trigger: 'on-hit-taken', source: adventurer }, battle, rng),
          hitUnit.id,
        );
      }
    }
  }

  drainIntercepts(events, battle);

  for (const unit of [...battle.adventurers, ...battle.enemies]) {
    const wasAlive = (hpBefore.get(unit.id) ?? 0) > 0;
    if (!wasAlive || unit.hp > 0) {
      continue;
    }

    for (const ally of getOwnRoster(battle, unit).filter((other) => other.id !== unit.id && other.hp > 0)) {
      pushSpecialActionEvents(
        events,
        resolveSpecialActionTriggers(ally, ally.activeSpecialActions, { trigger: 'on-ally-downed', source: unit }, battle, rng),
        ally.id,
      );
      // Adjacency pass: allies standing next to the fallen unit also get an adjacent-only trigger
      // (e.g. Mirka's Avenger).
      if (isAdjacent(ally.position, unit.position)) {
        pushSpecialActionEvents(
          events,
          resolveSpecialActionTriggers(ally, ally.activeSpecialActions, { trigger: 'on-adjacent-ally-downed', source: unit }, battle, rng),
          ally.id,
        );
      }
    }
    for (const enemy of getOpposingRoster(battle, unit).filter((other) => other.hp > 0)) {
      pushSpecialActionEvents(
        events,
        resolveSpecialActionTriggers(enemy, enemy.activeSpecialActions, { trigger: 'on-enemy-downed', source: unit }, battle, rng),
        enemy.id,
      );
    }
  }

  drainIntercepts(events, battle);
  pushBanishes(events, battle);
  return result;
}
