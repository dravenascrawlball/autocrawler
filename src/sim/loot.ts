import type { Adventurer } from './adventurer';
import type { Item, ItemLookup, LootTableEntry } from './items';
import { rollItemInstance } from './items';
import type { RngSource } from './rng';

/**
 * Chance a room drops any loot at all, once per room-clear — not guaranteed, and not scaled by
 * how many enemies were in the room. Replaces an earlier per-enemy-per-entry model where every
 * defeated enemy rolled its own multi-entry table independently: since each enemy's table's
 * dropChances summed to ~1.1, a single kill already averaged more than one item, and a normal
 * 2-3 enemy room reliably produced several — far more loot than intended. Placeholder value
 * pending the real balance pass (roadmap item 6), same as other tuning constants in this file.
 */
export const ROOM_LOOT_DROP_CHANCE = 0.35;

/**
 * Picks at most one item from `lootTable`, weighted by each entry's `dropChance` relative to the
 * others (their sum no longer needs to total 1 — they're just relative weights now that a room
 * only ever awards a single item). Returns null only if the table is empty.
 */
function pickWeightedItem(lootTable: LootTableEntry[], lookupItem: ItemLookup, rng: RngSource): Item | null {
  const totalWeight = lootTable.reduce((sum, entry) => sum + entry.dropChance, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let roll = rng() * totalWeight;
  for (const entry of lootTable) {
    roll -= entry.dropChance;
    if (roll <= 0) {
      return rollItemInstance(lookupItem(entry.itemId), rng);
    }
  }
  return rollItemInstance(lookupItem(lootTable[lootTable.length - 1].itemId), rng); // floating-point rounding safety net
}

/**
 * Rolls loot for a just-won room: one ROOM_LOOT_DROP_CHANCE roll for the whole room (not per
 * enemy), and if it hits, one item from a randomly chosen defeated enemy's loot table (weighted
 * by that table's own relative dropChances). Returns an empty array most of the time, by design.
 * Intended to run once, right after a room ends in Win.
 */
export function rollRoomLoot(enemies: Adventurer[], lookupItem: ItemLookup, rng: RngSource): Item[] {
  const defeatedWithLoot = enemies.filter(
    (enemy) => enemy.hp <= 0 && enemy.lootTable && enemy.lootTable.length > 0,
  );
  if (defeatedWithLoot.length === 0 || rng() >= ROOM_LOOT_DROP_CHANCE) {
    return [];
  }

  const chosenEnemy = defeatedWithLoot[Math.floor(rng() * defeatedWithLoot.length)];
  const item = pickWeightedItem(chosenEnemy.lootTable!, lookupItem, rng);
  return item ? [item] : [];
}
