import type { RngSource } from './rng';
import type { Aura } from './auras';

/**
 * A permanent, narrative-flavored marker distinct from a passive (which is
 * just a permanent StatModifier grant) — a trait can instead feed into
 * other sim rules directly, the way RAGE_TRAIT feeds into damage. Granted
 * automatically by game events or seeded on a template, or drawn from the
 * universal pool (see rollTraits/data/traits.ts) — never player-chosen
 * from a pool the way items/passives are.
 */
export interface Trait {
  id: string;
  name: string;
  description: string;
  /** A passive Aura this Trait carries (e.g. Glint's Shield Bearer) — merged into Adventurer.auras at creation (see adventurer.ts). */
  aura?: Aura;
}

/** Creation-time ceiling on how many universal Traits a character rolls at once (see docs/kit-trait-tag-framework.md) — a ceiling on the roll itself, not a lifetime cap; mid-run trait growth (not yet built) is explicitly meant to exceed this. */
export const UNIVERSAL_TRAIT_ROLL_CAP = 2;

/**
 * Draws up to `maxCount` distinct Traits from `pool` uniformly at random,
 * without replacement — order doesn't matter, just which ones. Returns
 * fewer than `maxCount` if the pool itself is smaller (never duplicates an
 * entry to pad the count). A partial Fisher-Yates shuffle: never mutates
 * `pool` itself.
 */
export function rollTraits(pool: Trait[], maxCount: number, rng: RngSource): Trait[] {
  const count = Math.min(Math.max(maxCount, 0), pool.length);
  if (count === 0) {
    return [];
  }

  const shuffled = [...pool];
  const picked: Trait[] = [];
  for (let i = 0; i < count; i++) {
    const swapIndex = i + Math.floor(rng() * (shuffled.length - i));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
    picked.push(shuffled[i]);
  }
  return picked;
}

/**
 * Gudrun's signature trait (roadmap item 11) — seeded on her template rather
 * than granted by a game event, unlike SURVIVOR_TRAIT. Checked directly by
 * actions/attack.ts's effectiveAttackPower.
 */
export const RAGE_TRAIT: Trait = {
  id: 'rage',
  name: 'Rage',
  description: "The lower her HP, the harder she hits — up to +50% damage at the brink of being downed.",
};

/** Damage bonus Rage grants at 0 HP — scales linearly down to 0 at full HP. */
export const RAGE_MAX_BONUS_FRACTION = 0.5;

/**
 * Gudrun's second ability (docs/kit-trait-tag-framework.md's second-Special
 * pass — the Reflect/Thorns ability type): a true passive, like Rage, so
 * it's a Trait rather than a triggered Special Action — there's no
 * 'on-hit-taken' TriggerEvent payload carrying "how much damage did I just
 * take" for a Special Action to react to (see specialActions.ts's
 * TriggerEvent), so this is checked directly by actions/attack.ts's
 * applyAttackToTarget instead, the same way RAGE_TRAIT is checked directly
 * by effectiveAttackPower.
 */
export const THORNS_TRAIT: Trait = {
  id: 'thorns',
  name: 'Thorns',
  description: 'Returns a portion of incoming melee damage straight back to the attacker.',
};

/** Percent of a landed hit's final damage Thorns reflects back onto the attacker. */
export const THORNS_REFLECT_PERCENT = 30;

/**
 * Drifta's new identity following the "pure auto-battler" pass (see
 * docs/roadmap.md) that removed Accuracy/Evasion as baseline stats
 * everyone had a little of — a genuine, rare, TFT-style dodge keyword
 * scoped to one character instead, rather than a universal miss-chance
 * stat. Checked directly by actions/attack.ts's applyAttackToTarget
 * (first, before anything else rolls), same convention as RAGE_TRAIT/
 * THORNS_TRAIT — a true passive, not a Special Action, since there's no
 * trigger payload to hang "did I just dodge" off of.
 */
export const DODGE_TRAIT: Trait = {
  id: 'dodge',
  name: 'Dodge',
  description: 'A genuine chance to avoid an incoming hit entirely.',
};

/** Chance DODGE_TRAIT fully negates an incoming hit — placeholder pending the balance pass. */
export const DODGE_CHANCE = 0.2;

/** Linear scaling from 0 bonus at full HP to RAGE_MAX_BONUS_FRACTION at 0 HP. */
export function rageDamageBonusFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) {
    return 0;
  }
  const missingFraction = 1 - Math.max(0, Math.min(1, hp / maxHp));
  return RAGE_MAX_BONUS_FRACTION * missingFraction;
}

/**
 * The Troll Warlord's boss Trait (enemy variety pass — see data/enemies.ts):
 * below ENRAGE_HP_FRACTION of effective max HP, its attacks deal
 * ENRAGE_BONUS_FRACTION more damage. A step, unlike Rage's linear ramp —
 * the fight changes phase once it's bloodied. Checked directly by
 * actions/attack.ts's effectiveAttackPower, same convention as RAGE_TRAIT.
 */
export const ENRAGE_TRAIT: Trait = {
  id: 'enrage',
  name: 'Enrage',
  description: 'Hits much harder once below half health.',
};

export const ENRAGE_HP_FRACTION = 0.5;
export const ENRAGE_BONUS_FRACTION = 0.5;

// --- Adjacency Traits (roadmap: adjacency pass) ---
// "Adjacent" = orthogonally adjacent on the same side's grid (formation.ts's isAdjacent).

/**
 * Bodil: when an adjacent ally is hit, she takes BODYGUARD_SHARE of the
 * damage that got through instead of them. Checked by actions/attack.ts's
 * applyAttackToTarget. Doesn't cover hits on herself, and only one
 * bodyguard steps in per hit.
 */
export const BODYGUARD_TRAIT: Trait = {
  id: 'bodyguard',
  name: 'Bodyguard',
  description: 'When an adjacent ally is hit, she takes 40% of the damage instead.',
};
export const BODYGUARD_SHARE = 0.4;

/** Glint: adjacent allies take 15% less damage (a negative 'vulnerability' modifier). */
export const SHIELD_BEARER_TRAIT: Trait = {
  id: 'shield-bearer',
  name: 'Shield Bearer',
  description: 'Adjacent allies take 15% less damage.',
  aura: {
    id: 'shield-bearer',
    name: 'Shield Bearer',
    description: 'Adjacent allies take 15% less damage.',
    range: 'adjacent',
    grants: { stat: 'vulnerability', type: 'flat', amount: -15, source: 'aura:shield-bearer' },
  },
};

/** Tharavel: adjacent allies deal 10% more damage. */
export const COMMANDING_PRESENCE_TRAIT: Trait = {
  id: 'commanding-presence',
  name: 'Commanding Presence',
  description: 'Adjacent allies deal 10% more damage.',
  aura: {
    id: 'commanding-presence',
    name: 'Commanding Presence',
    description: 'Adjacent allies deal 10% more damage.',
    range: 'adjacent',
    grants: { stat: 'attackPower', type: 'percent', amount: 10, source: 'aura:commanding-presence' },
  },
};

/** Dawneth: adjacent allies gain +2 armor. */
export const SANCTUARY_TRAIT: Trait = {
  id: 'sanctuary',
  name: 'Sanctuary',
  description: 'Adjacent allies gain +2 armor.',
  aura: {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Adjacent allies gain +2 armor.',
    range: 'adjacent',
    grants: { stat: 'armor', type: 'flat', amount: 2, source: 'aura:sanctuary' },
  },
};

