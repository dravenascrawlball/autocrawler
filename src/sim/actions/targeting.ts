import type { Adventurer } from '../adventurer';
import type { TargetingContext } from '../action';
import { getOpposingRoster, getOwnRoster } from '../battle';
import { getEffectiveStat } from '../stats';

/** Whether `unit` currently has an active Vanish/Stealth (see actions/support.ts's VanishAction) — same "encode a flag as a buff on a synthetic stat" convention as Taunt. */
function isStealthed(unit: Adventurer): boolean {
  return getEffectiveStat(0, 'stealth', unit.modifiers) > 0;
}

/**
 * The opposing roster's living members, with any currently-Stealthed unit
 * filtered out entirely — "genuinely unselectable," not just deprioritized
 * (see docs/missing-ability-types.md's Stealth/untargetable entry). Falls
 * back to including Stealthed units anyway if filtering them would leave
 * no candidates at all (every living opponent Stealthed simultaneously) —
 * a safety valve so combat can never stall with nothing targetable.
 */
function livingOpponents(context: TargetingContext): Adventurer[] {
  const all = getOpposingRoster(context.battle, context.actor).filter((candidate) => candidate.hp > 0);
  const visible = all.filter((candidate) => !isStealthed(candidate));
  return visible.length > 0 ? visible : all;
}

/** Whether `unit` currently has an active Taunt (see actions/support.ts's TauntAction) — a timed buff on a synthetic 'taunt' stat, same convention as Fear's vulnerability debuff or Blind's attackPower debuff, rather than a dedicated tracked field. */
function isTaunting(unit: Adventurer): boolean {
  return getEffectiveStat(0, 'taunt', unit.modifiers) > 0;
}

/**
 * Every living, currently-Taunting member of the opposing roster — never
 * row/reach-restricted, since Taunt overrides normal targeting entirely
 * (see docs/missing-ability-types.md's Taunt entry), unlike every other
 * selector here which respects melee/ranged reach.
 */
function livingTaunters(context: TargetingContext): Adventurer[] {
  return livingOpponents(context).filter(isTaunting);
}

/**
 * Melee's reachable pool: the opposing roster's living members at the
 * frontmost rank (0) that still has anyone alive, falling through to rank
 * 1 then rank 2 once a rank is wiped (the generalization of the old
 * front-row-wipe rule to a 3-rank grid — see formation.ts). Empty only
 * when the whole opposing roster is dead, which shouldn't happen mid-room
 * (the room ends first).
 */
function meleeEligibleOpponents(context: TargetingContext): Adventurer[] {
  const living = livingOpponents(context);
  for (const rank of [0, 1, 2] as const) {
    const atRank = living.filter((candidate) => candidate.position.rank === rank);
    if (atRank.length > 0) return atRank;
  }
  return [];
}

/**
 * Picks the first eligible opposing unit (ties broken by roster order).
 * `restrictToMelee` narrows the pool to meleeEligibleOpponents (front row,
 * or back once front is empty); a ranged action passes false to reach the
 * whole living opposing roster directly. A living Taunter on the opposing
 * side overrides all of that — see livingTaunters.
 */
export function selectFirstEnemy(context: TargetingContext, restrictToMelee: boolean): Adventurer | null {
  const taunters = livingTaunters(context);
  if (taunters.length > 0) return taunters[0];

  const candidates = restrictToMelee ? meleeEligibleOpponents(context) : livingOpponents(context);
  return candidates[0] ?? null;
}

/** Picks the lowest-HP eligible opposing unit, ties broken by roster order — see selectFirstEnemy's restrictToMelee and Taunt notes. */
export function selectLowestHpEnemy(context: TargetingContext, restrictToMelee: boolean): Adventurer | null {
  const taunters = livingTaunters(context);
  const candidates = taunters.length > 0 ? taunters : restrictToMelee ? meleeEligibleOpponents(context) : livingOpponents(context);
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
/**
 * Picks the first Downed (hp <= 0) member of the actor's own roster — used
 * by Mira's Revive (the Revive ability type from
 * docs/missing-ability-types.md). Deterministic tie-break by roster order,
 * same convention as selectFirstEnemy; null if nobody on the side is
 * currently Downed.
 */
export function selectDownedAlly(context: TargetingContext): Adventurer | null {
  const downed = getOwnRoster(context.battle, context.actor).filter((candidate) => candidate.hp <= 0);
  return downed[0] ?? null;
}

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
