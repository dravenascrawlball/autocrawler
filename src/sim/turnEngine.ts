import type { Adventurer } from './adventurer';
import type { Action, ActionOutcome } from './action';
import type { BattleState } from './battle';
import { triggerRetreat, getOpposingRoster } from './battle';
import type { RngSource } from './rng';
import { ENCHANTMENT_REGISTRY } from './enchantments';
import { tickStatusEffects, type StatusEffectId } from './statusEffects';
import { tickBuffs } from './buffs';

export type TurnEvent =
  | { type: 'action'; actionId: Action['id']; outcome: ActionOutcome }
  /** A status effect (e.g. Burn) dealing its per-turn damage — see statusEffects.ts. */
  | { type: 'status-tick'; effectId: StatusEffectId; damage: number };

export interface TurnResult {
  events: TurnEvent[];
  /** Which of the 6 die faces (0-5) was rolled this turn — for the future dice-roll animation. */
  rolledFaceIndex: number;
  rolledActionId: Action['id'];
}

const DIE_FACE_COUNT = 6;

/**
 * Resolves one turn for `adventurer`: first ticks its own active status
 * effects (e.g. Burn), then rolls one of its 6 die faces uniformly at
 * random and attempts that face's action. If the rolled face is enchanted
 * and its action lands a hit, the enchantment's effect is applied to the
 * target (see enchantments.ts). If the action finds no valid target at all
 * (e.g. a Heal roll with nobody hurt, or a Retreat roll while the party is
 * healthy), the rest of the turn is simply idle — no movement to fall back
 * to since the front/back formation system replaced the grid entirely (see
 * formation.ts / actions/targeting.ts). No energy, no deck cursor: every
 * turn is a status tick plus exactly one roll, one action attempt. Timed
 * buffs (e.g. Glint's Rallying Strike armor — see buffs.ts) tick down here
 * too, silently, right alongside status effects.
 */
export function resolveTurn(adventurer: Adventurer, battle: BattleState, rng: RngSource): TurnResult {
  const events: TurnEvent[] = tickStatusEffects(adventurer).map((tick) => ({
    type: 'status-tick',
    effectId: tick.effectId,
    damage: tick.damage,
  }));
  tickBuffs(adventurer);

  const faceIndex = Math.floor(rng() * DIE_FACE_COUNT);
  const face = adventurer.dieFaces[faceIndex];
  const action = face.action;
  const result = { events, rolledFaceIndex: faceIndex, rolledActionId: action.id };

  if (adventurer.hp <= 0) {
    // A lethal status tick just downed this unit before it could act.
    return result;
  }

  const target = action.selectTarget({ actor: adventurer, battle });
  if (target === null) {
    return result;
  }

  const outcome = action.resolve({ actor: adventurer, target, rng, battle });
  events.push({ type: 'action', actionId: action.id, outcome });

  if (
    face.enchantmentId &&
    (outcome.type === 'attack' ||
      outcome.type === 'attack-and-buff' ||
      outcome.type === 'attack-and-gold' ||
      outcome.type === 'attack-and-debuff') &&
    outcome.hit
  ) {
    // Looked up by outcome.targetId, not the pre-resolve `target` above — most actions hit exactly
    // who they selected, but one that re-picks its real target inside resolve() (e.g. Isilwen's
    // Card Throw, which selectTarget can't randomize since it has no rng) would otherwise enchant
    // the wrong enemy.
    const hitTarget = getOpposingRoster(battle, adventurer).find((unit) => unit.id === outcome.targetId);
    if (hitTarget) {
      ENCHANTMENT_REGISTRY[face.enchantmentId].applyOnHit(hitTarget);
    }
  }
  if (face.enchantmentId && outcome.type === 'attack-multi') {
    for (const hit of outcome.hits) {
      if (!hit.hit) continue;
      const hitTarget = getOpposingRoster(battle, adventurer).find((unit) => unit.id === hit.targetId);
      if (hitTarget) {
        ENCHANTMENT_REGISTRY[face.enchantmentId].applyOnHit(hitTarget);
      }
    }
  }
  if (outcome.type === 'retreat') {
    triggerRetreat(battle);
  }

  return result;
}
