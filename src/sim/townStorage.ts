import type { Item, RunInventory } from './items';

/**
 * Persistent, town-scoped storage: items and gold. Structurally separate
 * from any dungeon run's RunInventory — a distinct type with its own item
 * list and gold balance, never merged with or referenced by run-scoped sim
 * state except through `mergeRunInventoryIntoTown` below.
 */
export interface TownStorage {
  items: Item[];
  gold: number;
}

export function createTownStorage(): TownStorage {
  return { items: [], gold: 0 };
}

/** Deducts `amount` from `townStorage.gold` if affordable; no-ops and returns false otherwise. */
export function spendGold(townStorage: TownStorage, amount: number): boolean {
  if (townStorage.gold < amount) {
    return false;
  }
  townStorage.gold -= amount;
  return true;
}

/**
 * Moves every item and all gold out of a completed run's inventory into
 * town storage, leaving the run inventory empty. Call this once a run
 * ends, regardless of outcome — completed, loss, or retreat all merge the
 * same way, so loot (and gold) earned during a run is never lost on a
 * failed one.
 */
export function mergeRunInventoryIntoTown(run: RunInventory, townStorage: TownStorage): void {
  townStorage.items.push(...run.items);
  townStorage.gold += run.gold;
  run.items.length = 0;
  run.gold = 0;
}
