import type { Adventurer } from '../adventurer';
import type { TargetingContext } from '../action';
import { getOpposingRoster, getOwnRoster } from '../battle';
import { getEffectiveStat } from '../stats';

function livingOpponents(context: TargetingContext): Adventurer[] {
  return getOpposingRoster(context.battle, context.actor).filter((candidate) => candidate.hp > 0);
}

/**
 * Melee's reachable pool: the opposing roster's living front-row members,
 * or its living back-row members once front has none left (per the
 * front-row-wipe rule — see formation.ts). Empty only when the whole
 * opposing roster is dead, which shouldn't happen mid-room (the room ends
 * first).
 */
function meleeEligibleOpponents(context: TargetingContext): Adventurer[] {
  const living = livingOpponents(context);
  const front = living.filter((candidate) => candidate.row === 'front');
  return front.length > 0 ? front : living.filter((candidate) => candidate.row === 'back');
}

/**
 * Picks the first eligible opposing unit (ties broken by roster order).
 * `restrictToMelee` narrows the pool to meleeEligibleOpponents (front row,
 * or back once front is empty); a ranged action passes false to reach the
 * whole living opposing roster directly.
 */
export function selectFirstEnemy(context: TargetingContext, restrictToMelee: boolean): Adventurer | null {
  const candidates = restrictToMelee ? meleeEligibleOpponents(context) : livingOpponents(context);
  return candidates[0] ?? null;
}

/** Picks the lowest-HP eligible opposing unit, ties broken by roster order — see selectFirstEnemy's restrictToMelee note. */
export function selectLowestHpEnemy(context: TargetingContext, restrictToMelee: boolean): Adventurer | null {
  const candidates = restrictToMelee ? meleeEligibleOpponents(context) : livingOpponents(context);
  if (candidates.length === 0) return null;

  return candidates.reduce((lowest, candidate) => (candidate.hp < lowest.hp ? candidate : lowest));
}

/**
 * Picks the lowest-HP living ally (including the actor itself) whose HP
 * fraction is strictly below `thresholdFraction` — null if no ally
 * qualifies (nobody hurt enough, or everybody already at/above the
 * threshold). Never row-restricted — healing your own side doesn't care
 * about front/back.
 */
export function selectLowestHpAllyBelowThreshold(
  context: TargetingContext,
  thresholdFraction: number,
): Adventurer | null {
  const candidates = getOwnRoster(context.battle, context.actor).filter((candidate) => {
    const effectiveMaxHp = getEffectiveStat(candidate.maxHp, 'maxHp', candidate.modifiers);
    return candidate.hp > 0 && candidate.hp / effectiveMaxHp < thresholdFraction;
  });
  if (candidates.length === 0) return null;

  return candidates.reduce((lowest, candidate) => (candidate.hp < lowest.hp ? candidate : lowest));
}

/**
 * Picks the lowest-HP living ally (including the actor itself),
 * unconditionally — unlike selectLowestHpAllyBelowThreshold, this never
 * returns null just because nobody's hurt enough (only if the whole own
 * roster is downed, which shouldn't happen mid-turn). Used by Dawneth's
 * Mending Charge (roadmap item 11), which always resolves — including when
 * nobody actually needs healing — so it can always grant its energy.
 */
export function selectLowestHpAlly(context: TargetingContext): Adventurer | null {
  const candidates = getOwnRoster(context.battle, context.actor).filter((candidate) => candidate.hp > 0);
  if (candidates.length === 0) return null;

  return candidates.reduce((lowest, candidate) => (candidate.hp < lowest.hp ? candidate : lowest));
}

/**
 * Picks the living ally (including the actor itself) with the highest
 * effective attackPower — used by Fallacy's Empower (roadmap item 11) to
 * pick who gets her attack buff. Compares getEffectiveStat, not the raw
 * base, so gear/other buffs already in place are accounted for. Null only
 * if the whole own roster is downed, which shouldn't happen mid-turn.
 */
export function selectHighestAttackPowerAlly(context: TargetingContext): Adventurer | null {
  const candidates = getOwnRoster(context.battle, context.actor).filter((candidate) => candidate.hp > 0);
  if (candidates.length === 0) return null;

  return candidates.reduce((highest, candidate) =>
    getEffectiveStat(candidate.attackPower, 'attackPower', candidate.modifiers) >
    getEffectiveStat(highest.attackPower, 'attackPower', highest.modifiers)
      ? candidate
      : highest,
  );
}
