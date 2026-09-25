import type { Adventurer } from './adventurer';

export type StatusEffectId = 'burn' | 'poison';

/** A damage-over-time (or similar) affliction currently active on an adventurer — see enchantments.ts for what applies these. */
export interface ActiveStatusEffect {
  id: StatusEffectId;
  /** Damage dealt each time this effect ticks (see tickStatusEffects). */
  damagePerTick: number;
  /** Ticks remaining, including the one about to happen — decremented to 0 and removed by tickStatusEffects. */
  remainingTicks: number;
}

/** Applies (or refreshes, if already present) a burn stack on `target` — single-stack, not additive, to keep this simple. */
export function applyBurn(target: Adventurer, damagePerTick: number, ticks: number): void {
  target.statusEffects = target.statusEffects.filter((effect) => effect.id !== 'burn');
  target.statusEffects.push({ id: 'burn', damagePerTick, remainingTicks: ticks });
}

/** Applies (or refreshes, if already present) a poison stack on `target` — same single-stack-per-id convention as applyBurn; independent of it, so a target can be both burning and poisoned at once. */
export function applyPoison(target: Adventurer, damagePerTick: number, ticks: number): void {
  target.statusEffects = target.statusEffects.filter((effect) => effect.id !== 'poison');
  target.statusEffects.push({ id: 'poison', damagePerTick, remainingTicks: ticks });
}

export interface StatusEffectTick {
  effectId: StatusEffectId;
  damage: number;
}

/**
 * Ticks every active status effect on `adventurer` once — called at the
 * start of its own turn (see turnEngine.ts), so an effect deals damage once
 * per turn the affected unit takes, not once per round. Never called for an
 * already-downed unit (room.ts skips resolveTurn for hp <= 0 entirely), and
 * damage here is clamped so it can't itself push hp below 0. Returns one
 * entry per effect that ticked, for the caller to turn into TurnEvents.
 */
export function tickStatusEffects(adventurer: Adventurer): StatusEffectTick[] {
  if (adventurer.statusEffects.length === 0) {
    return [];
  }

  const ticks: StatusEffectTick[] = [];
  const remaining: ActiveStatusEffect[] = [];

  for (const effect of adventurer.statusEffects) {
    adventurer.hp = Math.max(0, adventurer.hp - effect.damagePerTick);
    ticks.push({ effectId: effect.id, damage: effect.damagePerTick });

    if (effect.remainingTicks > 1) {
      remaining.push({ ...effect, remainingTicks: effect.remainingTicks - 1 });
    }
  }

  adventurer.statusEffects = remaining;
  return ticks;
}
