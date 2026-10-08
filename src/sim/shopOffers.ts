import type { Adventurer } from './adventurer';
import type { Relic } from './relics';
import type { Item } from './items';
import type { RngSource } from './rng';

/**
 * This pause's Recruit shop offer: a character + gold price. `alreadyInParty`
 * is true when the roll landed on someone already fighting this run — see
 * state/dungeonOrchestrator.ts's buyRecruitOffer, which levels them up
 * instead of adding a duplicate to the party.
 */
export interface RecruitShopOffer {
  adventurer: Adventurer;
  price: number;
  alreadyInParty: boolean;
}

export interface RelicShopOffer {
  relic: Relic;
  price: number;
}

export interface EquipmentShopOffer {
  item: Item;
  price: number;
}

/** The between-room shop's three sections (see docs/roadmap.md's Level Up Rework) — rolled fresh at every pause (see dungeonOrchestrator.ts's rollShopOffers). */
export interface ShopOffers {
  recruits: RecruitShopOffer[];
  relics: RelicShopOffer[];
  equipment: EquipmentShopOffer[];
}

export const RECRUIT_SHOP_OFFER_COUNT = 3;
export const RELIC_SHOP_OFFER_COUNT = 2;
export const EQUIPMENT_SHOP_OFFER_COUNT = 3;
/** Fallback recruit price for a character with no `recruitCost` set on their template. */
export const DEFAULT_RECRUIT_PRICE = 50;

/** Fisher-Yates partial shuffle: only the first `count` slots need to be correctly randomized. */
function sampleRandom<T>(pool: T[], count: number, rng: RngSource): T[] {
  const shuffled = [...pool];
  const drawCount = Math.min(count, shuffled.length);
  for (let i = 0; i < drawCount; i++) {
    const j = i + Math.floor(rng() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, drawCount);
}

/**
 * Rolls the Recruit section: a uniform sample of `unlockedAdventurers`
 * (includes current party members too, unlike the old free mid-run recruit
 * offer this replaces — landing on one is what triggers a level-up instead
 * of a new recruit). `lookupRecruitCost` is injected so sim/ never depends
 * on data/characters.ts.
 */
export function rollRecruitOffers(
  unlockedAdventurers: Adventurer[],
  party: Adventurer[],
  lookupRecruitCost: (adventurer: Adventurer) => number,
  rng: RngSource,
  count: number = RECRUIT_SHOP_OFFER_COUNT,
): RecruitShopOffer[] {
  const inParty = new Set(party.map((adventurer) => adventurer.id));
  return sampleRandom(unlockedAdventurers, count, rng).map((adventurer) => ({
    adventurer,
    price: lookupRecruitCost(adventurer),
    alreadyInParty: inParty.has(adventurer.id),
  }));
}

/** Rolls the Relics section: a uniform sample of `relicPool`, excluding whatever's already active this run. */
export function rollRelicOffers(
  relicPool: Relic[],
  activeRelics: Relic[],
  rng: RngSource,
  count: number = RELIC_SHOP_OFFER_COUNT,
): RelicShopOffer[] {
  const activeIds = new Set(activeRelics.map((relic) => relic.id));
  const pool = relicPool.filter((relic) => !activeIds.has(relic.id));
  return sampleRandom(pool, count, rng).map((relic) => ({ relic, price: relic.price }));
}

/** Rolls the Equipment section: a uniform sample of `itemPool`, each at its own price. */
export function rollEquipmentOffers(
  itemPool: Item[],
  rng: RngSource,
  count: number = EQUIPMENT_SHOP_OFFER_COUNT,
): EquipmentShopOffer[] {
  return sampleRandom(itemPool, count, rng).map((item) => ({ item, price: item.price }));
}
