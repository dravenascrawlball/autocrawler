/**
 * A permanent, narrative-flavored marker distinct from a passive (which is
 * just a permanent StatModifier grant) — a trait can instead feed into
 * other sim rules directly, the way RAGE_TRAIT feeds into damage. Granted
 * automatically by game events or seeded on a template, never
 * player-chosen from a pool the way items/passives are.
 */
export interface Trait {
  id: string;
  name: string;
  description: string;
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

/** Linear scaling from 0 bonus at full HP to RAGE_MAX_BONUS_FRACTION at 0 HP. */
export function rageDamageBonusFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) {
    return 0;
  }
  const missingFraction = 1 - Math.max(0, Math.min(1, hp / maxHp));
  return RAGE_MAX_BONUS_FRACTION * missingFraction;
}
