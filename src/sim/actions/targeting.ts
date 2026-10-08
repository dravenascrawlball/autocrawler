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
 * Melee's reachable pool, lane by lane: only the frontmost living unit in
 * the attacker's own lane is reachable — whoever stands behind it is
 * protected until it falls. Once the attacker's lane is empty, reach moves
 * to the nearest lane that still has anyone (both side lanes count as
 * equally near for a center-lane attacker), again only its frontmost unit.
 * So a squishy is only fully safe standing *behind* someone. Lane is
 * measured on each side's own grid (lane 0 faces lane 0). Several units can
 * come back when lanes tie, or if a lane's front cell is somehow stacked.
 * Empty only when the whole opposing roster is dead, which shouldn't happen
 * mid-room (the room ends first).
 */
function meleeEligibleOpponents(context: TargetingContext): Adventurer[] {
  const living = livingOpponents(context);
  const actorLane = context.actor.position.lane;
  let bestDistance = Infinity;
  let exposed: Adventurer[] = [];
  for (const lane of [0, 1, 2] as const) {
    const inLane = living.filter((candidate) => candidate.position.lane === lane);
    if (inLane.length === 0) continue;
    const frontRank = Math.min(...inLane.map((candidate) => candidate.position.rank));
    const front = inLane.filter((candidate) => candidate.position.rank === frontRank);
    const distance = Math.abs(lane - actorLane);
    if (distance < bestDistance) {
      bestDistance = distance;
      exposed = front;
    } else if (distance === bestDistance) {
      exposed = [...exposed, ...front];
    }
  }
  // Keep roster order, so "first eligible" tie-breaks stay stable across lanes.
  return living.filter((candidate) => exposed.includes(candidate));
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

/**
 * The actor's "guard": the nearest living ally standing directly in front
 * of it in its own lane (same lane, lower rank, closest rank first) — the
 * unit that shields it under the lane-limited melee rule (see
 * meleeEligibleOpponents). Null if the actor is frontmost in its lane or
 * nobody living stands ahead of it. Used by Dawneth's lane-guardian kit
 * (Mending Charge, Guardian's Vow — see actions/heal.ts / support.ts).
 */
export function selectGuardAlly(context: TargetingContext): Adventurer | null {
  const { actor } = context;
  const ahead = getOwnRoster(context.battle, actor).filter(
    (candidate) =>
      candidate !== actor &&
      candidate.hp > 0 &&
      candidate.position.lane === actor.position.lane &&
      candidate.position.rank < actor.position.rank,
  );
  if (ahead.length === 0) return null;
  return ahead.reduce((nearest, candidate) => (candidate.position.rank > nearest.position.rank ? candidate : nearest));
}

/** The lowest-HP living ally (including the actor) who is actually below effective max HP — null when nobody is hurt. */
export function selectLowestHpHurtAlly(context: TargetingContext): Adventurer | null {
  const hurt = getOwnRoster(context.battle, context.actor).filter(
    (candidate) => candidate.hp > 0 && candidate.hp < getEffectiveStat(candidate.maxHp, 'maxHp', candidate.modifiers),
  );
  if (hurt.length === 0) return null;
  return hurt.reduce((lowest, candidate) => (candidate.hp < lowest.hp ? candidate : lowest));
}
