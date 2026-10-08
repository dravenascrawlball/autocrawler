import type { Adventurer } from './adventurer';

/**
 * A temporary, depletable HP buffer — distinct from both a Buff (a timed
 * StatModifier, e.g. flat armor) and healing (restores HP directly): a
 * Shield absorbs incoming damage before it touches HP at all, and shrinks
 * as it absorbs, rather than staying a flat value for its whole duration.
 * Expires on its own timer (see tickShields) same as a Buff, whichever
 * comes first — fully depleted or out of turns, both remove the entry.
 */
export interface ActiveShield {
  id: string;
  /** Remaining absorb capacity — decremented by consumeShield, never regenerates. */
  amount: number;
  remainingTurns: number;
}

/**
 * Grants (or refreshes, if already present) a Shield on `target` —
 * single-stack per `id`, not additive, same convention as
 * buffs.ts's applyBuff/statusEffects.ts's applyBurn: a re-cast before
 * expiry replaces the old amount/duration rather than stacking with it.
 */
export function applyShield(target: Adventurer, id: string, amount: number, durationTurns: number): void {
  target.shields = [...target.shields.filter((shield) => shield.id !== id), { id, amount, remainingTurns: durationTurns }];
}

/**
 * Ticks every active Shield on `adventurer` once, removing any that just
 * expired (regardless of how much absorb capacity remains) — called at
 * the start of the unit's own turn (see turnEngine.ts), same cadence as
 * tickBuffs/tickAuras.
 */
export function tickShields(adventurer: Adventurer): void {
  if (adventurer.shields.length === 0) {
    return;
  }

  adventurer.shields = adventurer.shields
    .filter((shield) => shield.remainingTurns > 1)
    .map((shield) => ({ ...shield, remainingTurns: shield.remainingTurns - 1 }));
}

/**
 * Depletes `target`'s active Shields (oldest-granted first) by up to
 * `incomingDamage`, mutating `target.shields` in place, and returns how
 * much was actually absorbed — the caller subtracts the remainder from HP
 * (see actions/attack.ts's applyAttackToTarget). A Shield can fully
 * absorb a hit (unlike armor's MIN_DAMAGE_AFTER_ARMOR floor, which only
 * applies before this step) — that's the point of a Shield over a flat
 * mitigation stat.
 */
export function consumeShield(target: Adventurer, incomingDamage: number): number {
  if (target.shields.length === 0 || incomingDamage <= 0) {
    return 0;
  }

  let remaining = incomingDamage;
  const updated: ActiveShield[] = [];
  for (const shield of target.shields) {
    if (remaining <= 0) {
      updated.push(shield);
      continue;
    }
    const absorbed = Math.min(shield.amount, remaining);
    remaining -= absorbed;
    const leftover = shield.amount - absorbed;
    if (leftover > 0) {
      updated.push({ ...shield, amount: leftover });
    }
  }

  target.shields = updated;
  return incomingDamage - remaining;
}
