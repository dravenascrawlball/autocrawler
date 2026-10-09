import type { Adventurer, AdventurerTemplate } from './adventurer';
import type { StatModifier } from './stats';
import type { TagId } from './tags';
import type { RngSource } from './rng';

/**
 * A character-specific "costume" variant (see
 * docs/kit-trait-tag-framework.md) — alters stats, may grant Tags, and
 * swaps the art key, but never Basic Action or die faces (that stays
 * Special's job; Kit and Special are independently-rolled, orthogonal
 * axes — see adventurer.ts's createAdventurer). Picked from a
 * character's own `kitPool` at creation and rerolled on every reset to
 * template baseline, same lifecycle as Special Action.
 */
export interface Kit {
  id: string;
  name: string;
  description: string;
  /** Additive on top of whatever modifiers createAdventurer is otherwise passed (equipment, recruitment, etc.) — not a replacement of them. */
  modifiers: StatModifier[];
  /** Additive on top of the template's innate tags. */
  tags?: TagId[];
  /** Asset-lookup key for this Kit's alternate costume art — callers wanting Kit-aware art should use `activeKit?.artKey ?? archetype`, falling back to the base archetype when no Kit is active. */
  artKey: string;
  /** Display title while this Kit is active (e.g. "Barbarian" instead of "Fighter") — cosmetic only; see displayTitle. */
  title?: string;
  /**
   * Replaces the character's actual role (what role synergies count — see
   * synergies.ts) while this Kit is active, for the few Kits that are
   * deliberately a build lever (e.g. Field Medic makes Tharavel count as a
   * Healer). Omit to keep the template's role.
   */
  synergyRole?: string;
}

/** Grants one uniformly-random Kit from `pool` — null if the pool is empty (the common case today: no character has a kitPool yet). */
export function pickKit(pool: Kit[], rng: RngSource): Kit | null {
  if (pool.length === 0) {
    return null;
  }
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Switches `adventurer` onto `kit` in place — strips whatever the
 * previously-active Kit (if any) contributed to `modifiers`/`tags`/`role`
 * by reference, same convention as partyManagement.ts's equipItem swapping
 * a previous item's modifiers out, then applies `kit`'s. Lets something
 * override the kit `pickKit` randomly rolled at the adventurer's last
 * reset, rather than adding a second roll mechanism — no current UI calls
 * this (the old Embark detail view's kit-choice step was removed along
 * with the single-character draft, see docs/roadmap.md's Renown section),
 * kept for whenever kit choice gets a new home.
 */
export function applyKit(adventurer: Adventurer, template: AdventurerTemplate, kit: Kit): void {
  const previous = adventurer.activeKit;
  if (previous) {
    adventurer.modifiers = adventurer.modifiers.filter((modifier) => !previous.modifiers.includes(modifier));
    const previousTags = previous.tags ?? [];
    adventurer.tags = adventurer.tags.filter((tag) => !previousTags.includes(tag));
  }

  adventurer.activeKit = kit;
  adventurer.modifiers = [...adventurer.modifiers, ...kit.modifiers];
  adventurer.tags = [...adventurer.tags, ...(kit.tags ?? [])];
  adventurer.role = kit.synergyRole ?? template.role ?? '';
}

/** What to show as `adventurer`'s class/title: their Kit's title if one is active, otherwise their role. */
export function displayTitle(adventurer: Adventurer): string {
  return adventurer.activeKit?.title ?? adventurer.role;
}

/** Asset key for `adventurer`'s art: their Kit's costume if one is active, otherwise their base archetype. Callers fall back to the archetype when no Kit art file exists yet. */
export function artKeyFor(adventurer: Adventurer): string {
  return adventurer.activeKit?.artKey ?? adventurer.archetype;
}

