import type { Trait } from '../sim/traits';

/**
 * Universal Trait pool (see docs/kit-trait-tag-framework.md) — any
 * character can roll from this, independent of their Kit/Special roll
 * (see sim/adventurer.ts's createAdventurer). Distinct from a
 * character-seeded Trait like Gudrun's Rage (sim/traits.ts), which is
 * always present rather than rolled.
 *
 * Empty for now — no universal Traits have been authored/content-designed
 * yet. The roll mechanism (sim/traits.ts's rollTraits) and its wiring into
 * character creation are live; adding a Trait here makes it immediately
 * rollable for every character without further plumbing changes.
 */
export const UNIVERSAL_TRAIT_POOL: Trait[] = [];
