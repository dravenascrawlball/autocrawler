import { writable, get } from 'svelte/store';
import type { Adventurer } from '../sim/adventurer';
import type { Relic } from '../sim/relics';
import { applyRelicToAdventurer, applyActiveRelicsToAdventurer } from '../sim/relics';
import type { Item } from '../sim/items';
import { rollRecruitOffers, rollRelicOffers, rollEquipmentOffers, type ShopOffers } from '../sim/shopOffers';
import { MAX_PARTY_SIZE } from '../sim/draft';
import { ITEM_REGISTRY } from '../data/items';
import { RELIC_REGISTRY } from '../data/relics';
import { roster } from './roster';
import { recruitPriceFor } from './dungeonPlayback';
import { startDungeon } from './dungeonOrchestrator';
import type { RngSource } from '../sim/rng';
import type { ItemLookup } from '../sim/items';

/**
 * Replaces the old single-character Embark draft (balance pass, see
 * docs/roadmap.md): a solo start against room 1 was close to unwinnable for
 * most characters, and there was never enough in-run gold to recruit a
 * second member before the run was already lost. Embark now opens straight
 * onto this gold-shop screen instead — the same Recruit/Relics/Equipment
 * mechanism the between-room pause already uses (see sim/shopOffers.ts),
 * just spending a one-time starting grant to build the whole opening party
 * from nothing, with at least one recruit required before continuing.
 */
export const STARTING_SHOP_GOLD = 200;

export interface OpeningShopState {
  gold: number;
  party: Adventurer[];
  activeRelics: Relic[];
  /** Equipment bought here, staged until embarkFromOpeningShop seeds the run's RunInventory with it. */
  items: Item[];
  offers: ShopOffers;
}

export const openingShop = writable<OpeningShopState | null>(null);

function rollOffers(party: Adventurer[], activeRelics: Relic[], rng: RngSource): ShopOffers {
  return {
    recruits: rollRecruitOffers(get(roster).adventurers, party, (adventurer) => recruitPriceFor(adventurer.name), rng),
    relics: rollRelicOffers(RELIC_REGISTRY, activeRelics, rng),
    equipment: rollEquipmentOffers(Object.values(ITEM_REGISTRY), rng),
  };
}

/** Starts a fresh opening shop: STARTING_SHOP_GOLD, an empty party, and one rolled set of offers. */
export function startOpeningShop(rng: RngSource = () => Math.random()): void {
  openingShop.set({
    gold: STARTING_SHOP_GOLD,
    party: [],
    activeRelics: [],
    items: [],
    offers: rollOffers([], [], rng),
  });
}

/** Buys `adventurerId` from the current Recruit offers, adding them to the opening party. No-ops the usual ways (no shop in progress, offer gone, can't afford, party already full). */
export function buyOpeningRecruit(adventurerId: string): void {
  const state = get(openingShop);
  if (!state) {
    return;
  }

  const offer = state.offers.recruits.find((candidate) => candidate.adventurer.id === adventurerId);
  if (!offer || state.gold < offer.price || state.party.length >= MAX_PARTY_SIZE) {
    return;
  }

  applyActiveRelicsToAdventurer(offer.adventurer, state.activeRelics);

  openingShop.set({
    ...state,
    gold: state.gold - offer.price,
    party: [...state.party, offer.adventurer],
    offers: { ...state.offers, recruits: state.offers.recruits.filter((candidate) => candidate !== offer) },
  });
}

/** Buys `relicId`, granting it to everyone recruited so far and to anyone recruited afterward (see applyActiveRelicsToAdventurer above). */
export function buyOpeningRelic(relicId: string): void {
  const state = get(openingShop);
  if (!state) {
    return;
  }

  const offer = state.offers.relics.find((candidate) => candidate.relic.id === relicId);
  if (!offer || state.gold < offer.price) {
    return;
  }

  for (const adventurer of state.party) {
    applyRelicToAdventurer(adventurer, offer.relic);
  }

  openingShop.set({
    ...state,
    gold: state.gold - offer.price,
    activeRelics: [...state.activeRelics, offer.relic],
    offers: { ...state.offers, relics: state.offers.relics.filter((candidate) => candidate !== offer) },
  });
}

/** Buys `itemId`, staging it for the run's inventory once the player actually embarks. */
export function buyOpeningEquipment(itemId: string): void {
  const state = get(openingShop);
  if (!state) {
    return;
  }

  const offer = state.offers.equipment.find((candidate) => candidate.item.id === itemId);
  if (!offer || state.gold < offer.price) {
    return;
  }

  openingShop.set({
    ...state,
    gold: state.gold - offer.price,
    items: [...state.items, { ...offer.item, promptDismissed: true }],
    offers: { ...state.offers, equipment: state.offers.equipment.filter((candidate) => candidate !== offer) },
  });
}

/** Clears the in-progress opening shop (e.g. once Embark actually starts the run). */
export function clearOpeningShop(): void {
  openingShop.set(null);
}

/** Starts the dungeon run with the opening shop's party, seeding the run with its leftover gold, bought Relics, and bought Equipment. No-ops if there's no party recruited yet. */
export function embarkFromOpeningShop(
  rng: RngSource = () => Math.random(),
  lookupItem: ItemLookup = (id) => ITEM_REGISTRY[id],
): void {
  const state = get(openingShop);
  if (!state || state.party.length === 0) {
    return;
  }

  startDungeon(state.party, undefined, rng, lookupItem, {
    partyGold: state.gold,
    activeRelics: state.activeRelics,
    items: state.items,
  });
  clearOpeningShop();
}
