import type { Adventurer } from './adventurer';
import { applyBurn, applyPoison } from './statusEffects';

export type EnchantmentId = 'burning' | 'poison';

export interface Enchantment {
  id: EnchantmentId;
  name: string;
  /** Applied to the target when the enchanted face's action lands a hit — see turnEngine.ts. */
  applyOnHit(target: Adventurer): void;
}

/** Placeholder magnitudes pending the balance pass — proves the enchantment hook works, not tuned. */
export const BURN_DAMAGE_PER_TICK = 2;
export const BURN_TICKS = 3;

export const BURNING_ENCHANTMENT: Enchantment = {
  id: 'burning',
  name: 'Burning',
  applyOnHit(target: Adventurer): void {
    applyBurn(target, BURN_DAMAGE_PER_TICK, BURN_TICKS);
  },
};

/** Lighter per-tick damage than Burning but lasts longer — placeholder magnitudes pending the balance pass, same as Burning's own. */
export const POISON_DAMAGE_PER_TICK = 1;
export const POISON_TICKS = 5;

export const POISON_ENCHANTMENT: Enchantment = {
  id: 'poison',
  name: 'Poison',
  applyOnHit(target: Adventurer): void {
    applyPoison(target, POISON_DAMAGE_PER_TICK, POISON_TICKS);
  },
};

export const ENCHANTMENT_REGISTRY: Record<EnchantmentId, Enchantment> = {
  burning: BURNING_ENCHANTMENT,
  poison: POISON_ENCHANTMENT,
};
