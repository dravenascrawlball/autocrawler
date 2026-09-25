import type { Action } from './action';
import type { EnchantmentId } from './enchantments';

/**
 * One physical face of a 6-sided die (see turnEngine.ts). Enchantment is
 * per-face, not per-action — two faces both showing Power Attack can carry
 * different enchantments (or none), matching the original pitch's "Burning
 * (Power Attack)" example. Always its own object per slot, never shared
 * across faces or adventurer instances (enchanting one face must not affect
 * another that merely shows the same action) — see plainFaces below and
 * createAdventurer's clone of template.dieFaces.
 */
export interface DieFace {
  action: Action;
  enchantmentId?: EnchantmentId;
}

/** `count` distinct (never shared-reference) unenchanted faces for `action` — the common case, used wherever a template used to write `Array(count).fill(action)` before enchantments existed. */
export function plainFaces(action: Action, count = 6): DieFace[] {
  return Array.from({ length: count }, () => ({ action }));
}
