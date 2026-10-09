import type { Adventurer } from './adventurer';
import { getEffectiveStat } from './stats';
import type { Trait } from './traits';
import type { RngSource } from './rng';

/**
 * Quirks (roadmap: Quirks pass): rare, random little boons or flaws —
 * Traits flagged `quirk: 'good' | 'bad'` — rolled onto a hero when they
 * show up as a recruit offer (state/progression.ts's
 * rerollOfferedCharacters) and onto monsters when a room is built
 * (data/rooms.ts). Heroes and monsters draw from separate pools
 * (data/quirks.ts). A hero's Quirks last the run they're recruited for and
 * are wiped by resetToTemplateBaseline at run end.
 */

/** Chance an offer/monster gets at least one Quirk, and (given one) the chance of a second. */
export const QUIRK_CHANCE = 0.2;
export const SECOND_QUIRK_CHANCE = 0.2; // 0.2 × 0.2 ≈ 4% overall
/** Recruit price change per good Quirk (+) or bad Quirk (−). */
export const QUIRK_PRICE_STEP = 0.15;

const QUIRK_SOURCE_PREFIX = 'quirk:';

/**
 * Rolls 0, 1 or (rarely) 2 distinct Quirks from `pool`. Triggers on *high*
 * rolls (rng() >= 1 - chance) — same odds, but a deterministic rng that
 * always returns 0 (common in tests) rolls no Quirks.
 */
export function rollQuirks(pool: Trait[], rng: RngSource): Trait[] {
  if (pool.length === 0 || rng() < 1 - QUIRK_CHANCE) return [];
  const first = pool[Math.floor(rng() * pool.length)];
  if (pool.length < 2 || rng() < 1 - SECOND_QUIRK_CHANCE) return [first];
  const rest = pool.filter((quirk) => quirk.id !== first.id);
  return [first, rest[Math.floor(rng() * rest.length)]];
}

/** Removes every Quirk (and its stat changes) from `adventurer`. */
export function stripQuirks(adventurer: Adventurer): void {
  adventurer.traits = adventurer.traits.filter((trait) => !trait.quirk);
  adventurer.modifiers = adventurer.modifiers.filter((modifier) => !modifier.source.startsWith(QUIRK_SOURCE_PREFIX));
}

/**
 * Gives `adventurer` `quirks` (replacing any they had), then sets HP to the
 * new effective max — Quirks are only ever applied to someone at full
 * health (a fresh offer or a freshly built monster), so Tough/Frail/Wounded
 * just change how full "full" is.
 */
export function applyQuirks(adventurer: Adventurer, quirks: Trait[]): void {
  stripQuirks(adventurer);
  adventurer.traits = [...adventurer.traits, ...quirks];
  adventurer.modifiers = [...adventurer.modifiers, ...quirks.flatMap((quirk) => quirk.modifiers ?? [])];
  adventurer.hp = getEffectiveStat(adventurer.maxHp, 'maxHp', adventurer.modifiers);
}

/** `adventurer`'s current Quirks. */
export function quirksOf(adventurer: Adventurer): Trait[] {
  return adventurer.traits.filter((trait) => trait.quirk);
}

/** Recruit price multiplier from `adventurer`'s Quirks: +QUIRK_PRICE_STEP per good one, −QUIRK_PRICE_STEP per bad one. */
export function quirkPriceMultiplier(adventurer: Adventurer): number {
  const net = quirksOf(adventurer).reduce((sum, quirk) => sum + (quirk.quirk === 'good' ? 1 : -1), 0);
  return 1 + net * QUIRK_PRICE_STEP;
}
