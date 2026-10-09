import type { Adventurer } from './adventurer';
import type { Trait } from './traits';
import type { RngSource } from './rng';
import { ROOMS_PER_FLOOR } from './dungeonRun';

/**
 * Mid-run Trait growth: after each floor boss (but not the finale), the
 * player picks one of MILESTONE_OFFER_COUNT cards, each a specific Trait
 * for a specific party member (state/dungeonOrchestrator.ts's
 * chooseMilestoneOffer). Earned Traits last the rest of the run — wiped by
 * resetToTemplateBaseline at run end, like level-ups and Quirks.
 */
export const MILESTONE_OFFER_COUNT = 3;

export interface MilestoneOffer {
  adventurerId: string;
  trait: Trait;
}

/** Whether the pause after `roomsResolved` rooms is a floor-boss reward pause (end of floor 1 or 2, not the finale). */
export function isMilestonePause(roomsResolved: number, totalRooms: number): boolean {
  return roomsResolved > 0 && roomsResolved % ROOMS_PER_FLOOR === 0 && roomsResolved < totalRooms;
}

/**
 * Rolls up to `count` distinct (hero, Trait) cards: each pairs a party
 * member with a Trait from `pool` they don't already have, spreading cards
 * across different heroes where the party allows.
 */
export function rollMilestoneOffers(party: Adventurer[], pool: Trait[], rng: RngSource, count = MILESTONE_OFFER_COUNT): MilestoneOffer[] {
  const offers: MilestoneOffer[] = [];
  const heroes = [...party];
  for (let attempt = 0; offers.length < count && attempt < count * 10; attempt++) {
    // Prefer heroes who don't have a card yet.
    const fresh = heroes.filter((hero) => !offers.some((offer) => offer.adventurerId === hero.id));
    const candidates = fresh.length > 0 ? fresh : heroes;
    const hero = candidates[Math.floor(rng() * candidates.length)];
    if (!hero) break;
    const options = pool.filter(
      (trait) =>
        !hero.traits.some((held) => held.id === trait.id) &&
        !offers.some((offer) => offer.adventurerId === hero.id && offer.trait.id === trait.id),
    );
    if (options.length === 0) continue;
    offers.push({ adventurerId: hero.id, trait: options[Math.floor(rng() * options.length)] });
  }
  return offers;
}

/** Gives `adventurer` `trait` for the rest of the run, with its stat changes. HP isn't topped up — a max HP boost fills in as they heal. */
export function grantTrait(adventurer: Adventurer, trait: Trait): void {
  if (adventurer.traits.some((held) => held.id === trait.id)) return;
  adventurer.traits = [...adventurer.traits, trait];
  adventurer.modifiers = [...adventurer.modifiers, ...(trait.modifiers ?? [])];
}
