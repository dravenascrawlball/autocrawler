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

/**
 * Index of whichever action occupies the most of `dieFaces`, ties broken by
 * face order — the interim Basic Action derivation for any template that
 * doesn't declare an explicit `basicAction` (see adventurer.ts's
 * createAdventurer). Every named player character now declares one
 * explicitly (see data/characters.ts); this fallback exists for enemies and
 * any other template not yet retheme'd.
 */
export function dominantFaceIndex(dieFaces: DieFace[]): number {
  const counts = new Map<string, number>();
  for (const face of dieFaces) {
    counts.set(face.action.id, (counts.get(face.action.id) ?? 0) + 1);
  }

  let bestIndex = 0;
  let bestCount = 0;
  for (let i = 0; i < dieFaces.length; i++) {
    const count = counts.get(dieFaces[i].action.id) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestIndex = i;
    }
  }

  return bestIndex;
}
