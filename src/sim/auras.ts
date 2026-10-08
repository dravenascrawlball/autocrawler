import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';
import { getOwnRoster } from './battle';
import type { StatModifier } from './stats';
import type { TagId } from './tags';
import { hasTag } from './tags';

/**
 * A continuous, party-wide effect granted by whichever ally currently
 * carries it (via a Kit or Trait — see docs/kit-trait-tag-framework.md) —
 * distinct from a Buff (timed, applied once) or a StatusEffect (timed,
 * damage-only). An Aura has no duration of its own: it applies for as
 * long as its carrier is alive and on the field, and is recomputed from
 * scratch every tick (see tickAuras) rather than ticked down.
 *
 * `requiresTag` describes the *targets* the aura affects, not the
 * carrier — a non-Bunny unit can carry an aura that only buffs Bunnies
 * without being one itself.
 */
export interface Aura {
  id: string;
  name: string;
  description: string;
  requiresTag: TagId;
  grants: StatModifier;
}

/** One currently-applied aura-derived modifier, tracked so the next tick can cleanly remove it before recomputing (same single-stack-per-id convention as Buffs/StatusEffects). */
export interface AppliedAura {
  auraId: string;
  modifier: StatModifier;
}

/**
 * Recomputes every Aura modifier currently affecting `unit` from scratch:
 * strips whatever this function applied last tick, then re-scans `unit`'s
 * own side (see getOwnRoster — includes `unit` itself, since a unit can
 * benefit from its own aura if it happens to carry the required tag) for
 * every living ally's `auras`, applying `grants` to `unit` wherever
 * `unit` carries `requiresTag`. Called once per `unit`'s own turn (see
 * turnEngine.ts), same cadence as tickBuffs — an aura-granter downed
 * mid-round takes effect out of play starting next tick, not instantly.
 */
export function tickAuras(unit: Adventurer, battle: BattleState): void {
  if (unit.appliedAuras.length > 0) {
    const stale = new Set(unit.appliedAuras.map((applied) => applied.modifier));
    unit.modifiers = unit.modifiers.filter((modifier) => !stale.has(modifier));
    unit.appliedAuras = [];
  }

  const applied: AppliedAura[] = [];
  for (const ally of getOwnRoster(battle, unit).filter((other) => other.hp > 0)) {
    for (const aura of ally.auras) {
      if (hasTag(unit, aura.requiresTag)) {
        applied.push({ auraId: aura.id, modifier: aura.grants });
      }
    }
  }

  if (applied.length > 0) {
    unit.appliedAuras = applied;
    unit.modifiers = [...unit.modifiers, ...applied.map((a) => a.modifier)];
  }
}
