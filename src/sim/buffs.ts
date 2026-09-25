import type { Adventurer } from './adventurer';
import type { StatModifier } from './stats';

/**
 * A temporary, timed StatModifier grant — the positive counterpart to
 * statusEffects.ts's Burn (a timed debuff). Ticked down once per the
 * buffed unit's own turn (see turnEngine.ts), same cadence as status
 * effects; unlike Burn, expiry is silent (no event, no damage), it just
 * removes `modifier` from the unit's modifiers array again.
 */
export interface ActiveBuff {
  id: string;
  modifier: StatModifier;
  remainingTurns: number;
}

/**
 * Grants (or refreshes, if already present) `modifier` on `target` for
 * `durationTurns` — single-stack per `id`, not additive, same convention
 * as statusEffects.ts's applyBurn. Refreshing replaces the old modifier
 * instance with the new one rather than stacking both.
 */
export function applyBuff(target: Adventurer, id: string, modifier: StatModifier, durationTurns: number): void {
  const existing = target.buffs.find((buff) => buff.id === id);
  if (existing) {
    target.modifiers = target.modifiers.filter((m) => m !== existing.modifier);
    target.buffs = target.buffs.filter((buff) => buff.id !== id);
  }

  target.buffs.push({ id, modifier, remainingTurns: durationTurns });
  target.modifiers.push(modifier);
}

/**
 * Ticks every active buff on `adventurer` once, removing (from both
 * `buffs` and `modifiers`) any that just expired. Called at the start of
 * the unit's own turn (see turnEngine.ts), right alongside
 * tickStatusEffects.
 */
export function tickBuffs(adventurer: Adventurer): void {
  if (adventurer.buffs.length === 0) {
    return;
  }

  const remaining: ActiveBuff[] = [];
  const expiredModifiers: StatModifier[] = [];

  for (const buff of adventurer.buffs) {
    if (buff.remainingTurns > 1) {
      remaining.push({ ...buff, remainingTurns: buff.remainingTurns - 1 });
    } else {
      expiredModifiers.push(buff.modifier);
    }
  }

  adventurer.buffs = remaining;
  if (expiredModifiers.length > 0) {
    adventurer.modifiers = adventurer.modifiers.filter((m) => !expiredModifiers.includes(m));
  }
}
