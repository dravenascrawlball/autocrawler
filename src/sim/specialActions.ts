import type { Adventurer } from './adventurer';
import type { Action, ActionOutcome } from './action';
import type { BattleState } from './battle';
import { isFullyCharged, reactiveCooldown, startReactiveCooldown, CHARGED_SPECIAL_POWER } from './charge';
import type { RngSource } from './rng';
import { getEffectiveStat } from './stats';

/** Whether `unit` currently has an active Silence (see actions/support.ts's SilenceAction) — a timed buff on a synthetic 'silence' stat, same "encode a flag as a buff" convention as Taunt/Stun. */
function isSilenced(unit: Adventurer): boolean {
  return getEffectiveStat(0, 'silence', unit.modifiers) > 0;
}

/**
 * Closed set of events a Special Action can react to. Deliberately not
 * positional yet (e.g. "an ally adjacent to you is downed") — adjacency
 * doesn't exist until the 3x3 grid work lands. 'on-ally-downed' and
 * 'on-enemy-downed' fire for every living unit on the relevant side rather
 * than being adjacency-filtered for now, and can be narrowed to an
 * adjacency-qualified variant once grid position exists.
 */
export type SpecialActionTriggerId =
  | 'on-turn-start'
  | 'on-hit-landed'
  | 'on-hit-taken'
  | 'on-ally-downed'
  /** Like 'on-ally-downed', but only for an ally orthogonally adjacent to the fallen unit (adjacency pass — e.g. Mirka's Avenger). */
  | 'on-adjacent-ally-downed'
  | 'on-enemy-downed';

/**
 * One occurrence of a trigger condition, handed to resolveSpecialActionTriggers
 * by whatever resolves the underlying event (turn start, an attack landing,
 * a unit's hp hitting 0, etc.) — this module doesn't dispatch events on its
 * own, see resolveSpecialActionTriggers's own doc comment. `source` is the
 * unit that caused the event, when there is one distinct from the unit the
 * trigger is being checked against (e.g. the attacker for 'on-hit-taken',
 * the ally who was just downed for 'on-ally-downed') — absent for
 * 'on-turn-start', which is purely self-caused.
 */
export interface TriggerEvent {
  trigger: SpecialActionTriggerId;
  source?: Adventurer;
}

/**
 * A character's trigger + effect pair — the "when X, do Y" half of a kit,
 * distinct from a Trait (traits.ts; always-on, no trigger) and from a
 * character's Basic Action (a plain Action resolved deterministically every
 * turn, no trigger needed). Reuses the existing Action shape for `action` so
 * a Special Action's effect is authored the same way a Basic Action is
 * (selectTarget + resolve) rather than inventing a second effect format.
 */
export interface SpecialAction {
  id: string;
  name: string;
  trigger: SpecialActionTriggerId;
  action: Action;
  /**
   * Fires whenever its trigger matches, ignoring the charge meter and
   * reactive cooldowns (sim/charge.ts) — for core always-active abilities:
   * healers' every-turn heals, auras, boss mechanics, summons.
   */
  alwaysOn?: boolean;
}

/**
 * What happened when one Special Action's trigger matched and was resolved.
 * `outcome` is null if `action.selectTarget` found nobody valid (e.g. a
 * single-ally buff special with no living ally to target) — mirrors an idle
 * Basic Action turn rather than throwing.
 */
export interface SpecialActionOutcome {
  specialActionId: string;
  outcome: ActionOutcome | null;
}

/**
 * Resolves every Special Action in `specialActions` whose trigger matches
 * `event.trigger`, against `actor`. Per the confirmed design, ALL matching
 * Special Actions fire — there's no priority/first-match-wins rule — and
 * firing one is always free: it never consumes `actor`'s own turn, so this
 * can be called from anywhere an event occurs (mid-turn, on another unit's
 * turn, etc.) without touching turn order or the die roll. Only one Special
 * Action is active on a character at a time today (granted at join from
 * their unlocked pool), so `specialActions` will usually have 0 or 1 entries
 * in practice — multi-slot support (leveling/equipment granting more) is a
 * later concern, not designed here.
 *
 * Callers are responsible for actually dispatching TriggerEvents at the
 * right moments (e.g. the turn engine calling this with 'on-turn-start' at
 * the top of a turn, or an attack's resolution calling it with
 * 'on-hit-taken' against the target) — this module only defines the
 * matching/resolution step, not the wiring. Nothing calls it yet; wiring it
 * into the live turn loop (replacing the die roll) is a later step.
 *
 * A Silenced `actor` (see isSilenced) never fires any Special Action here,
 * regardless of trigger — their Basic Action still resolves normally
 * elsewhere in the turn engine; only this half of their kit is suppressed.
 */
export function resolveSpecialActionTriggers(
  actor: Adventurer,
  specialActions: SpecialAction[],
  event: TriggerEvent,
  battle: BattleState,
  rng: RngSource,
): SpecialActionOutcome[] {
  if (isSilenced(actor)) {
    return [];
  }

  const matching = specialActions.filter((special) => special.trigger === event.trigger);
  const results: SpecialActionOutcome[] = [];

  for (const special of matching) {
    // Charge meter (sim/charge.ts): an on-turn-start Special waits for a full meter; a reactive one
    // for its cooldown. alwaysOn Specials skip both.
    const charged = !special.alwaysOn && event.trigger === 'on-turn-start';
    const reactive = !special.alwaysOn && event.trigger !== 'on-turn-start';
    if (charged && !isFullyCharged(battle, actor.id)) continue;
    if (reactive && reactiveCooldown(battle, actor.id, special.id) > 0) continue;

    const target = special.action.selectTarget({ actor, battle });
    if (target === null) {
      results.push({ specialActionId: special.id, outcome: null });
      continue;
    }

    battle.specialPowerMultiplier = charged ? CHARGED_SPECIAL_POWER : 1;
    const outcome = special.action.resolve({ actor, target, rng, battle });
    battle.specialPowerMultiplier = 1;
    if (charged) battle.chargeByUnitId[actor.id] = 0;
    if (reactive) startReactiveCooldown(battle, actor.id, special.id);
    results.push({ specialActionId: special.id, outcome });
  }

  return results;
}
