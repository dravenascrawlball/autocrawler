import type { Adventurer } from '../sim/adventurer';
import { BODYGUARD_TRAIT } from '../sim/traits';

/**
 * Names of `adventurer`'s adjacency abilities (the adjacency pass): Traits
 * carrying an adjacent-range aura, the Bodyguard Trait, and Specials with
 * the 'on-adjacent-ally-downed' trigger. Used by the formation board to
 * highlight the cells an ability reaches and mark allies standing next to
 * it. Empty for a unit with none.
 */
export function adjacencyAbilities(adventurer: Adventurer): string[] {
  const fromTraits = adventurer.traits
    .filter((trait) => trait.aura?.range === 'adjacent' || trait.id === BODYGUARD_TRAIT.id)
    .map((trait) => trait.name);
  const fromSpecials = adventurer.activeSpecialActions
    .filter((special) => special.trigger === 'on-adjacent-ally-downed')
    .map((special) => special.name);
  return [...fromTraits, ...fromSpecials];
}
