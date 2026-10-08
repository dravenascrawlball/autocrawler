import type { Adventurer } from './adventurer';
import type { StatModifier } from './stats';

/**
 * A whole-party buff bought from the between-room shop's Relics section —
 * distinct from an Item (per-character equipment, see items.ts): a Relic
 * applies to every current and future party member for the rest of the
 * run, never to just one. Lasts until the run ends (resetToTemplateBaseline
 * clears the granted modifiers along with everything else mid-run-only).
 */
export interface Relic {
  id: string;
  name: string;
  description: string;
  /** Applied to every party member while this relic is active — source should read `relic:<relicId>`. */
  modifiers: StatModifier[];
  /** Gold cost in the between-room shop. */
  price: number;
}

/** Grants `relic`'s modifiers to `adventurer` — called once per party member when a relic is bought, and again for anyone who joins the party afterward (see dungeonOrchestrator.ts's buyRelicOffer/buyRecruitOffer). */
export function applyRelicToAdventurer(adventurer: Adventurer, relic: Relic): void {
  adventurer.modifiers = [...adventurer.modifiers, ...relic.modifiers];
}

/** Grants every relic in `activeRelics` to `adventurer` — used when a new party member joins mid-run, so relics bought before they arrived still apply to them. */
export function applyActiveRelicsToAdventurer(adventurer: Adventurer, activeRelics: Relic[]): void {
  for (const relic of activeRelics) {
    applyRelicToAdventurer(adventurer, relic);
  }
}
